from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.models.bookmark import Bookmark
from app.models.tag import Tag
from app.schemas.bookmark import BookmarkCreate, BookmarkUpdate, BookmarkOut

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
