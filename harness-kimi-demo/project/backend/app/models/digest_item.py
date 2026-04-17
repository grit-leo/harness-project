import uuid
from sqlalchemy import Column, String, DateTime, ForeignKey, Boolean
from sqlalchemy.dialects.sqlite import CHAR
from sqlalchemy.sql import func
from app.core.database import Base


class DigestItem(Base):
    __tablename__ = "digest_items"

    id = Column(CHAR(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(CHAR(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    source_user_id = Column(CHAR(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=True)
    source_collection_id = Column(CHAR(36), ForeignKey("collections.id", ondelete="CASCADE"), nullable=True)
    bookmark_id = Column(CHAR(36), ForeignKey("bookmarks.id", ondelete="CASCADE"), nullable=False)
    seen = Column(Boolean, default=False, nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
