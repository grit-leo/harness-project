from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.models.collection import Collection
from app.models.follow import Follow
from app.models.tag import Tag
from app.models.bookmark import Bookmark

router = APIRouter(prefix="/api/discover", tags=["discover"])


@router.get("")
def discover_collections(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Get current user's tags
    user_tags = {t.name for t in db.query(Tag).filter(Tag.user_id == current_user.id).all()}

    # Get public collections with follower counts
    public_collections = (
        db.query(Collection)
        .filter(Collection.visibility == "public_readonly")
        .all()
    )

    result = []
    for coll in public_collections:
        if coll.user_id == current_user.id:
            continue  # skip own collections
        follower_count = (
            db.query(Follow)
            .filter(Follow.following_collection_id == coll.id)
            .count()
        )
        # Compute tag overlap
        owner_tags = {t.name for t in db.query(Tag).filter(Tag.user_id == coll.user_id).all()}
        overlap = list(user_tags & owner_tags)
        owner = db.query(User).filter(User.id == coll.user_id).first()
        result.append({
            "id": coll.id,
            "name": coll.name,
            "ownerEmail": owner.email if owner else "",
            "followerCount": follower_count,
            "tagOverlap": overlap,
            "shareToken": coll.share_token,
        })

    # Sort by follower count desc, then tag overlap count desc
    result.sort(key=lambda x: (-x["followerCount"], -len(x["tagOverlap"])))
    return result
