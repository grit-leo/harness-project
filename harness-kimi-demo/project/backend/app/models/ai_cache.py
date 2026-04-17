import uuid
from sqlalchemy import Column, String, Text, DateTime, JSON
from sqlalchemy.dialects.sqlite import CHAR
from sqlalchemy.sql import func
from app.core.database import Base


class AICache(Base):
    __tablename__ = "ai_cache"

    id = Column(CHAR(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    content_hash = Column(String(64), unique=True, nullable=False, index=True)
    tags = Column(JSON, nullable=False, default=list)
    summary = Column(Text, nullable=False, default="")
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
