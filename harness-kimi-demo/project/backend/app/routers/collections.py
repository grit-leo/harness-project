import secrets
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import datetime, timedelta, timezone
from urllib.parse import urlparse

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.models.collection import Collection
from app.models.collection_collaborator import CollectionCollaborator
from app.models.bookmark import Bookmark
from app.schemas.collection import CollectionCreate, CollectionOut, CollectionUpdate, CollaboratorOut
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
                cutoff = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(days=int(value))
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


def _can_edit_collection(collection: Collection, user: User, db: Session) -> bool:
    if collection.user_id == user.id:
        return True
    collab = db.query(CollectionCollaborator).filter(
        CollectionCollaborator.collection_id == collection.id,
        CollectionCollaborator.user_id == user.id,
    ).first()
    return collab is not None


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


@router.patch("/{collection_id}", response_model=CollectionOut)
def update_collection(
    collection_id: str,
    payload: CollectionUpdate,
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
    if payload.name is not None:
        collection.name = payload.name
    if payload.rules is not None:
        collection.rules_json = payload.rules.model_dump()
    if payload.visibility is not None:
        collection.visibility = payload.visibility
    db.commit()
    db.refresh(collection)
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


# Share endpoints

@router.post("/{collection_id}/share")
def share_collection(
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
    if not collection.share_token:
        collection.share_token = secrets.token_urlsafe(24)
    db.commit()
    db.refresh(collection)
    return {"share_token": collection.share_token, "public_url": f"/c/{collection.share_token}"}


@router.delete("/{collection_id}/share")
def unshare_collection(
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
    collection.share_token = None
    db.commit()
    return {"detail": "Share link revoked"}


# Collaborator endpoints

@router.get("/{collection_id}/collaborators", response_model=list[CollaboratorOut])
def list_collaborators(
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
    collabs = (
        db.query(CollectionCollaborator, User)
        .join(User, CollectionCollaborator.user_id == User.id)
        .filter(CollectionCollaborator.collection_id == collection_id)
        .all()
    )
    return [{"user_id": c.user_id, "email": u.email, "role": c.role} for c, u in collabs]


@router.post("/{collection_id}/collaborators")
def invite_collaborator(
    collection_id: str,
    payload: dict,
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
    email = payload.get("email", "").strip().lower()
    if not email:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="email is required")
    user = db.query(User).filter(User.email == email).first()
    if not user:
        from app.core.security import get_password_hash
        user = User(email=email, password_hash=get_password_hash(secrets.token_urlsafe(16)))
        db.add(user)
        db.commit()
        db.refresh(user)
    existing = db.query(CollectionCollaborator).filter(
        CollectionCollaborator.collection_id == collection_id,
        CollectionCollaborator.user_id == user.id,
    ).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="User is already a collaborator")
    collab = CollectionCollaborator(collection_id=collection_id, user_id=user.id, role="editor")
    db.add(collab)
    db.commit()
    return {"user_id": user.id, "email": user.email, "role": "editor"}


@router.delete("/{collection_id}/collaborators/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_collaborator(
    collection_id: str,
    user_id: str,
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
    collab = db.query(CollectionCollaborator).filter(
        CollectionCollaborator.collection_id == collection_id,
        CollectionCollaborator.user_id == user_id,
    ).first()
    if not collab:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Collaborator not found")
    db.delete(collab)
    db.commit()
    return None
