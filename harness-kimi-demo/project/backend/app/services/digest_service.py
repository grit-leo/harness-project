from sqlalchemy.orm import Session
from app.models.follow import Follow
from app.models.digest_item import DigestItem


def generate_digest_items(db: Session, owner_user_id: str, bookmark_id: str):
    """Create digest items for all followers of the owner and followers of any shared/public collection."""
    # Followers of the owner
    user_follows = db.query(Follow).filter(Follow.following_user_id == owner_user_id).all()
    for f in user_follows:
        # Avoid duplicates
        existing = db.query(DigestItem).filter(
            DigestItem.user_id == f.follower_id,
            DigestItem.bookmark_id == bookmark_id,
            DigestItem.source_user_id == owner_user_id,
        ).first()
        if not existing:
            item = DigestItem(
                user_id=f.follower_id,
                source_user_id=owner_user_id,
                bookmark_id=bookmark_id,
                seen=False,
            )
            db.add(item)

    # Followers of collections that contain this bookmark
    from app.models.collection import Collection
    from app.routers.collections import _evaluate_collection
    from app.models.bookmark import Bookmark

    bookmark = db.query(Bookmark).filter(Bookmark.id == bookmark_id).first()
    if bookmark:
        collections = db.query(Collection).filter(Collection.user_id == owner_user_id).all()
        for coll in collections:
            if coll.visibility not in ("public_readonly", "shared_edit"):
                continue
            matches = _evaluate_collection([bookmark], coll.rules_json or {})
            if matches:
                coll_follows = db.query(Follow).filter(Follow.following_collection_id == coll.id).all()
                for f in coll_follows:
                    existing = db.query(DigestItem).filter(
                        DigestItem.user_id == f.follower_id,
                        DigestItem.bookmark_id == bookmark_id,
                        DigestItem.source_collection_id == coll.id,
                    ).first()
                    if not existing:
                        item = DigestItem(
                            user_id=f.follower_id,
                            source_collection_id=coll.id,
                            bookmark_id=bookmark_id,
                            seen=False,
                        )
                        db.add(item)

    db.commit()
