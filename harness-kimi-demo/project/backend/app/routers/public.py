from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.models.collection import Collection
from app.models.bookmark import Bookmark
from app.models.follow import Follow
from app.schemas.collection import PublicCollectionOut
from app.schemas.bookmark import BookmarkOut
from app.routers.collections import _evaluate_collection

router = APIRouter(prefix="/api/public", tags=["public"])


@router.get("/collections/{share_token}", response_model=PublicCollectionOut)
def get_public_collection(
    share_token: str,
    db: Session = Depends(get_db),
):
    collection = (
        db.query(Collection)
        .filter(Collection.share_token == share_token, Collection.visibility == "public_readonly")
        .first()
    )
    if not collection:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Collection not found")
    owner = db.query(User).filter(User.id == collection.user_id).first()
    data = {
        "id": collection.id,
        "name": collection.name,
        "rules_json": collection.rules_json,
        "owner_email": owner.email if owner else "",
        "created_at": collection.created_at,
        "updated_at": collection.updated_at,
    }
    return data


@router.get("/collections/{share_token}/bookmarks", response_model=list[BookmarkOut])
def get_public_collection_bookmarks(
    share_token: str,
    db: Session = Depends(get_db),
):
    collection = (
        db.query(Collection)
        .filter(Collection.share_token == share_token, Collection.visibility == "public_readonly")
        .first()
    )
    if not collection:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Collection not found")
    bookmarks = db.query(Bookmark).filter(Bookmark.user_id == collection.user_id).all()
    return _evaluate_collection(bookmarks, collection.rules_json or {})


@router.post("/collections/{share_token}/follow")
def follow_public_collection(
    share_token: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    collection = (
        db.query(Collection)
        .filter(Collection.share_token == share_token, Collection.visibility == "public_readonly")
        .first()
    )
    if not collection:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Collection not found")
    existing = db.query(Follow).filter(
        Follow.follower_id == current_user.id,
        Follow.following_collection_id == collection.id,
    ).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Already following this collection")
    follow = Follow(follower_id=current_user.id, following_collection_id=collection.id)
    db.add(follow)
    db.commit()
    return {"detail": "Followed collection"}
