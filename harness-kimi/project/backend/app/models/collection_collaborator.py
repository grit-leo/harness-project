from sqlalchemy import Column, String, DateTime, ForeignKey
from sqlalchemy.dialects.sqlite import CHAR
from sqlalchemy.orm import relationship
from app.core.database import Base


class CollectionCollaborator(Base):
    __tablename__ = "collection_collaborators"

    collection_id = Column(CHAR(36), ForeignKey("collections.id", ondelete="CASCADE"), primary_key=True, nullable=False)
    user_id = Column(CHAR(36), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True, nullable=False)
    role = Column(String(20), default="editor", nullable=False)

    collection = relationship("Collection", back_populates="collaborators")
    user = relationship("User", back_populates="collaborator_roles")
