from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import datetime, timedelta, timezone
from urllib.parse import urlparse

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.models.collection import Collection
from app.models.bookmark import Bookmark
from app.schemas.collection import CollectionCreate, CollectionOut
from app.schemas.bookmark import BookmarkOut

router = APIRouter(prefix="/api/collections", tags=["collections"])


def _evaluate_collection(bookmarks: list[Bookmark], rules: dict):
    op = rules.get("operator", "AND")
    conditions = rules.get("conditions", [])
    results = []
    for bm in bookmarks:
        matches = []
        for cond in conditions:
            field = cond.get("field")
            op_ = cond.get("op")
            value = cond.get("value")
            match = False
            if field == "date" and op_ == "last_n_days":
                cutoff = datetime.now(timezone.utc) - timedelta(days=int(value))
                match = bool(bm.created_at and bm.created_at >= cutoff)
            elif field == "domain" and op_ == "equals":
                hostname = urlparse(bm.url).hostname or ""
                hostname = hostname.replace("www.", "")
                target = str(value).replace("www.", "")
                match = hostname == target
            elif field == "tag" and op_ == "equals":
                match = any(tag.name == value for tag in bm.tags)
            matches.append(match)
        if op == "AND":
            if all(matches):
                results.append(bm)
        else:
            if any(matches):
                results.append(bm)
    return results


@router.get("", response_model=list[CollectionOut])
def list_collections(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    collections = (
        db.query(Collection)
        .filter(Collection.user_id == current_user.id)
        .order_by(Collection.created_at.desc())
        .all()
    )
    return collections


@router.post("", response_model=CollectionOut, status_code=status.HTTP_201_CREATED)
def create_collection(
    payload: CollectionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    collection = Collection(
        user_id=current_user.id,
        name=payload.name,
        rules_json=payload.rules.model_dump(),
    )
    db.add(collection)
    db.commit()
    db.refresh(collection)
    return collection


@router.get("/{collection_id}", response_model=CollectionOut)
def get_collection(
    collection_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    collection = (
        db.query(Collection)
        .filter(Collection.id == collection_id, Collection.user_id == current_user.id)
        .first()
    )
    if not collection:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Collection not found")
    return collection


@router.delete("/{collection_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_collection(
    collection_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    collection = (
        db.query(Collection)
        .filter(Collection.id == collection_id, Collection.user_id == current_user.id)
        .first()
    )
    if not collection:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Collection not found")
    db.delete(collection)
    db.commit()
    return None


@router.get("/{collection_id}/bookmarks", response_model=list[BookmarkOut])
def get_collection_bookmarks(
    collection_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    collection = (
        db.query(Collection)
        .filter(Collection.id == collection_id, Collection.user_id == current_user.id)
        .first()
    )
    if not collection:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Collection not found")
    bookmarks = db.query(Bookmark).filter(Bookmark.user_id == current_user.id).all()
    return _evaluate_collection(bookmarks, collection.rules_json or {})
