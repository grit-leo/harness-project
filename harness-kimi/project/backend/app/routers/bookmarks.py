import time
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status, Query, BackgroundTasks, UploadFile, File
from fastapi.responses import StreamingResponse, JSONResponse
from pydantic import BaseModel, HttpUrl, field_validator
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.models.bookmark import Bookmark
from app.models.tag import Tag
from app.models.collection import Collection
from app.models.collection_collaborator import CollectionCollaborator
from app.schemas.bookmark import (
    BookmarkCreate,
    BookmarkUpdate,
    BookmarkOut,
    SuggestedTagsOut,
    SuggestTagsPayload,
    ApplyTagsPayload,
)
from app.services import ai_service
from app.services.metadata_service import fetch_metadata
from app.services.netscape_parser import parse_netscape_html
from app.services.netscape_exporter import bookmarks_to_netscape_html
from app.services.import_task import create_task, run_import_task, get_task
from app.services.digest_service import generate_digest_items
import json

router = APIRouter(prefix="/api/bookmarks", tags=["bookmarks"])

# Simple in-memory rate limiter for fetch-metadata: max 10 requests per 60 seconds per user
_rate_limit_store: dict[str, list[float]] = {}


def _check_rate_limit(user_id: str, max_requests: int = 10, window_seconds: int = 60) -> bool:
    now = time.time()
    timestamps = _rate_limit_store.get(user_id, [])
    # Keep only timestamps within the window
    timestamps = [t for t in timestamps if now - t < window_seconds]
    _rate_limit_store[user_id] = timestamps
    if len(timestamps) >= max_requests:
        return False
    timestamps.append(now)
    return True


class FetchMetadataPayload(BaseModel):
    url: str

    @field_validator("url")
    @classmethod
    def validate_url_scheme(cls, v: str) -> str:
        if not v.startswith("http://") and not v.startswith("https://"):
            raise ValueError("URL must start with http:// or https://")
        return v


class MetadataFetchResponse(BaseModel):
    title: str
    description: str
    thumbnail_url: str | None = None


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


def _can_mutate_bookmark(db: Session, bookmark: Bookmark, user: User) -> bool:
    if bookmark.user_id == user.id:
        return True
    # Check if user is a collaborator on any shared-edit collection of the owner
    # and if the bookmark matches that collection's rules
    from app.routers.collections import _evaluate_collection
    collabs = (
        db.query(CollectionCollaborator, Collection)
        .join(Collection, CollectionCollaborator.collection_id == Collection.id)
        .filter(
            CollectionCollaborator.user_id == user.id,
            Collection.user_id == bookmark.user_id,
            Collection.visibility == "shared_edit",
        )
        .all()
    )
    for _, collection in collabs:
        matches = _evaluate_collection([bookmark], collection.rules_json or {})
        if matches:
            return True
    return False


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
            (Bookmark.title.ilike(like))
            | (Bookmark.summary.ilike(like))
            | (Bookmark.tags.any(Tag.name.ilike(like)))
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
        thumbnail_url=payload.thumbnail_url,
    )
    db.add(bookmark)
    db.flush()
    if payload.tags:
        bookmark.tags = ensure_tags(db, current_user, payload.tags)
    db.commit()
    db.refresh(bookmark)
    background_tasks.add_task(ai_service.enrich_bookmark, str(bookmark.id), str(bookmark.url))
    # Generate digest items for followers
    generate_digest_items(db, current_user.id, bookmark.id)
    return bookmark


@router.post("/fetch-metadata", response_model=MetadataFetchResponse)
def fetch_metadata_endpoint(
    payload: FetchMetadataPayload,
    current_user: User = Depends(get_current_user),
):
    if not _check_rate_limit(current_user.id, max_requests=10, window_seconds=60):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Rate limit exceeded. Try again later.",
        )
    result = fetch_metadata(payload.url)
    return result


@router.post("/suggest-tags", response_model=SuggestedTagsOut)
def suggest_tags(
    payload: SuggestTagsPayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    import re
    from urllib.parse import urlparse

    if payload.url:
        suggested = ai_service.suggest_tags_for_url(payload.url)
        if not suggested:
            suggested = ai_service.suggest_tags_from_text(payload.title, payload.summary)
    else:
        suggested = ai_service.suggest_tags_from_text(payload.title, payload.summary)

    # Normalize: lowercase, alphanumeric + hyphens only
    normalized: list[str] = []
    for tag in suggested:
        tag = tag.lower().strip()
        tag = re.sub(r"[^a-z0-9]+", "-", tag)
        tag = tag.strip("-")
        if tag and tag not in normalized:
            normalized.append(tag)

    # Enforce 3–5 tags
    if len(normalized) < 3:
        words = re.findall(r"[a-z0-9]+", payload.title.lower())
        for w in words:
            if w not in normalized and len(w) > 1:
                normalized.append(w)
            if len(normalized) >= 3:
                break
    if len(normalized) < 3 and payload.url:
        hostname = urlparse(payload.url).hostname or ""
        hostname = hostname.replace("www.", "").split(".")[0]
        if hostname and hostname not in normalized:
            normalized.append(hostname)
    if len(normalized) < 3:
        for g in ("reference", "article", "link"):
            if g not in normalized:
                normalized.append(g)
            if len(normalized) >= 3:
                break

    normalized = normalized[:5]

    return {"suggested_tags": normalized}


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
    bookmark = db.query(Bookmark).filter(Bookmark.id == bookmark_id).first()
    if not bookmark:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bookmark not found")
    if not _can_mutate_bookmark(db, bookmark, current_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to edit this bookmark")

    if payload.url is not None:
        bookmark.url = str(payload.url)
    if payload.title is not None:
        bookmark.title = payload.title
    if payload.summary is not None:
        bookmark.summary = payload.summary
    if payload.thumbnail_url is not None:
        bookmark.thumbnail_url = payload.thumbnail_url
    if payload.tags is not None:
        # Ensure tags belong to the bookmark owner
        owner = db.query(User).filter(User.id == bookmark.user_id).first()
        bookmark.tags = ensure_tags(db, owner, payload.tags)

    db.commit()
    db.refresh(bookmark)
    return bookmark


@router.delete("/{bookmark_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_bookmark(
    bookmark_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    bookmark = db.query(Bookmark).filter(Bookmark.id == bookmark_id).first()
    if not bookmark:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bookmark not found")
    if not _can_mutate_bookmark(db, bookmark, current_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to delete this bookmark")
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
                generate_digest_items(db, current_user.id, bookmark.id)
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


@router.get("/{bookmark_id}", response_model=BookmarkOut)
def get_bookmark(
    bookmark_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    bookmark = db.query(Bookmark).filter(Bookmark.id == bookmark_id, Bookmark.user_id == current_user.id).first()
    if not bookmark:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bookmark not found")
    return bookmark
