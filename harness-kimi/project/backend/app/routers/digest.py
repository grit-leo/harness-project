from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.models.digest_item import DigestItem
from app.schemas.collection import DigestItemOut

router = APIRouter(prefix="/api/digest", tags=["digest"])


@router.get("", response_model=list[DigestItemOut])
def get_digest(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    items = (
        db.query(DigestItem)
        .filter(DigestItem.user_id == current_user.id, DigestItem.seen == False)
        .order_by(DigestItem.created_at.asc())
        .limit(50)
        .all()
    )
    return items


@router.post("/mark-seen")
def mark_digest_seen(
    payload: dict | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ids = payload.get("ids", []) if payload else []
    query = db.query(DigestItem).filter(
        DigestItem.user_id == current_user.id,
        DigestItem.seen == False,
    )
    if ids:
        query = query.filter(DigestItem.id.in_(ids))
    query.update({DigestItem.seen: True}, synchronize_session=False)
    db.commit()
    return {"detail": "Marked as seen"}
