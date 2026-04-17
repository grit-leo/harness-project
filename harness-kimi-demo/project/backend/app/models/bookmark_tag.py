from sqlalchemy import Column, ForeignKey, Table
from sqlalchemy.dialects.sqlite import CHAR
from app.core.database import Base

BookmarkTag = Table(
    "bookmark_tags",
    Base.metadata,
    Column("bookmark_id", CHAR(36), ForeignKey("bookmarks.id", ondelete="CASCADE"), primary_key=True),
    Column("tag_id", CHAR(36), ForeignKey("tags.id", ondelete="CASCADE"), primary_key=True),
)
