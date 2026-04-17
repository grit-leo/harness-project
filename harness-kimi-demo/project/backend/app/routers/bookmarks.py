from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status, Query, BackgroundTasks, UploadFile, File
from fastapi.responses import StreamingResponse, JSONResponse
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.models.bookmark import Bookmark
from app.models.tag import Tag
from app.schemas.bookmark import (
    BookmarkCreate,
    BookmarkUpdate,
    BookmarkOut,
    SuggestedTagsOut,
    ApplyTagsPayload,
)
from app.services import ai_service
from app.services.netscape_parser import parse_netscape_html
from app.services.netscape_exporter import bookmarks_to_netscape_html
from app.services.import_task import create_task, run_import_task, get_task
import json

router = APIRouter(prefix="/api/bookmarks", tags=["bookmarks"])


def ensure_tags(db: Session, user: User, tag_names: List[str]) -> List[Tag]:
    tags = []
    for name in set(tag_names):
        name = name.strip().lower()
        if not name:
            continue
        tag = db.query(Tag).filter(Tag.user_id == user.id, Tag.name == name).first()
        if not tag:
            tag = Tag(user_id=user.id, name=name)
            db.add(tag)
            db.flush()
        tags.append(tag)
    db.commit()
    return tags


@router.get("", response_model=List[BookmarkOut])
def list_bookmarks(
    search: Optional[str] = Query(None),
    tag: List[str] = Query(default=[]),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(Bookmark).filter(Bookmark.user_id == current_user.id)
    if search:
        like = f"%{search}%"
        query = query.filter(
            (Bookmark.title.ilike(like)) | (Bookmark.summary.ilike(like))
        )
    if tag:
        query = query.filter(Bookmark.tags.any(Tag.name.in_(tag)))

    bookmarks = (
        query.order_by(Bookmark.created_at.desc())
        .offset((page - 1) * limit)
        .limit(limit)
        .all()
    )
    return bookmarks


@router.post("", response_model=BookmarkOut, status_code=status.HTTP_201_CREATED)
def create_bookmark(
    payload: BookmarkCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    bookmark = Bookmark(
        user_id=current_user.id,
        url=str(payload.url),
        title=payload.title,
        summary=payload.summary or "",
    )
    db.add(bookmark)
    db.flush()
    if payload.tags:
        bookmark.tags = ensure_tags(db, current_user, payload.tags)
    db.commit()
    db.refresh(bookmark)
    background_tasks.add_task(ai_service.enrich_bookmark, str(bookmark.id), str(bookmark.url))
    return bookmark


@router.post("/suggest-tags", response_model=SuggestedTagsOut)
def suggest_tags(
    payload: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    url = payload.get("url", "")
    title = payload.get("title", "")
    if not url:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="url is required")
    result = ai_service.fetch_and_enrich(url)
    suggested = result.get("tags", [])
    if not suggested and title:
        # Fallback: derive a tag from domain
        from urllib.parse import urlparse
        hostname = urlparse(url).hostname or ""
        hostname = hostname.replace("www.", "").split(".")[0]
        if hostname:
            suggested = [hostname]
    return {"suggested_tags": suggested}


@router.get("/{bookmark_id}/suggested-tags", response_model=SuggestedTagsOut)
def get_suggested_tags(
    bookmark_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    bookmark = db.query(Bookmark).filter(Bookmark.id == bookmark_id, Bookmark.user_id == current_user.id).first()
    if not bookmark:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bookmark not found")
    return {"suggested_tags": bookmark.suggested_tags or []}


@router.post("/{bookmark_id}/apply-tags", response_model=BookmarkOut)
def apply_tags(
    bookmark_id: str,
    payload: ApplyTagsPayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    bookmark = db.query(Bookmark).filter(Bookmark.id == bookmark_id, Bookmark.user_id == current_user.id).first()
    if not bookmark:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bookmark not found")
    bookmark.tags = ensure_tags(db, current_user, payload.tags)
    bookmark.suggested_tags = []
    db.commit()
    db.refresh(bookmark)
    return bookmark


@router.patch("/{bookmark_id}", response_model=BookmarkOut)
def update_bookmark(
    bookmark_id: str,
    payload: BookmarkUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    bookmark = db.query(Bookmark).filter(Bookmark.id == bookmark_id, Bookmark.user_id == current_user.id).first()
    if not bookmark:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bookmark not found")

    if payload.url is not None:
        bookmark.url = str(payload.url)
    if payload.title is not None:
        bookmark.title = payload.title
    if payload.summary is not None:
        bookmark.summary = payload.summary
    if payload.tags is not None:
        bookmark.tags = ensure_tags(db, current_user, payload.tags)

    db.commit()
    db.refresh(bookmark)
    return bookmark


@router.delete("/{bookmark_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_bookmark(
    bookmark_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    bookmark = db.query(Bookmark).filter(Bookmark.id == bookmark_id, Bookmark.user_id == current_user.id).first()
    if not bookmark:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bookmark not found")
    db.delete(bookmark)
    db.commit()
    return None


# Import endpoints

@router.post("/import")
def import_bookmarks(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not file.filename or not file.filename.endswith((".html", ".htm")):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="File must be a Netscape HTML bookmark file (.html or .htm)")
    try:
        content = file.file.read().decode("utf-8", errors="replace")
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Failed to read file: {e}")

    parsed = parse_netscape_html(content)
    if not parsed:
        return {"imported": 0, "bookmark_ids": []}

    if len(parsed) <= 50:
        # Synchronous import
        imported_ids = []
        for pb in parsed:
            try:
                bookmark = Bookmark(
                    user_id=current_user.id,
                    url=pb.url,
                    title=pb.title or pb.url,
                    summary="",
                )
                db.add(bookmark)
                db.flush()
                if pb.folder:
                    bookmark.tags = ensure_tags(db, current_user, [pb.folder])
                db.commit()
                db.refresh(bookmark)
                imported_ids.append(bookmark.id)
            except Exception:
                db.rollback()
        return {"imported": len(imported_ids), "bookmark_ids": imported_ids}

    # Async import for large files
    task = create_task(total=len(parsed))
    background_tasks.add_task(run_import_task, task.id, str(current_user.id), parsed)
    return {"task_id": task.id}


@router.get("/import-status/{task_id}")
def import_status(
    task_id: str,
    current_user: User = Depends(get_current_user),
):
    task = get_task(task_id)
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    return {
        "status": task.status,
        "total": task.total,
        "processed": task.processed,
        "errors": task.errors,
        "bookmark_ids": task.bookmark_ids,
        "error_detail": task.error_detail,
    }


# Export endpoints

@router.get("/export")
def export_bookmarks(
    format: str = Query("json"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    bookmarks = (
        db.query(Bookmark)
        .filter(Bookmark.user_id == current_user.id)
        .order_by(Bookmark.created_at.desc())
        .all()
    )

    if format == "netscape":
        bm_dicts = []
        for bm in bookmarks:
            bm_dicts.append({
                "id": bm.id,
                "url": bm.url,
                "title": bm.title,
                "tags": [t.name for t in bm.tags],
                "summary": bm.summary or "",
                "created_at": bm.created_at.isoformat() if bm.created_at else None,
                "updated_at": bm.updated_at.isoformat() if bm.updated_at else None,
            })
        html = bookmarks_to_netscape_html(bm_dicts)
        return StreamingResponse(
            iter([html]),
            media_type="text/html",
            headers={"Content-Disposition": 'attachment; filename="lumina-bookmarks.html"'},
        )

    # JSON default
    result = []
    for bm in bookmarks:
        result.append({
            "id": bm.id,
            "url": bm.url,
            "title": bm.title,
            "tags": [t.name for t in bm.tags],
            "summary": bm.summary or "",
            "created_at": bm.created_at.isoformat() if bm.created_at else None,
            "updated_at": bm.updated_at.isoformat() if bm.updated_at else None,
        })
    return StreamingResponse(
        iter([json.dumps(result, indent=2)]),
        media_type="application/json",
        headers={"Content-Disposition": 'attachment; filename="lumina-bookmarks.json"'},
    )
