import uuid
from sqlalchemy import Column, String, DateTime, ForeignKey
from sqlalchemy.dialects.sqlite import CHAR
from sqlalchemy.sql import func
from app.core.database import Base


class Follow(Base):
    __tablename__ = "follows"

    id = Column(CHAR(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    follower_id = Column(CHAR(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    following_user_id = Column(CHAR(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True)
    following_collection_id = Column(CHAR(36), ForeignKey("collections.id", ondelete="CASCADE"), nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
