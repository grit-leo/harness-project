from typing import List
from pydantic import BaseModel, HttpUrl, Field, ConfigDict, field_validator
from datetime import datetime


class BookmarkCreate(BaseModel):
    url: HttpUrl
    title: str = Field(..., min_length=1)
    summary: str = ""
    tags: List[str] = []


class BookmarkUpdate(BaseModel):
    url: HttpUrl | None = None
    title: str | None = Field(None, min_length=1)
    summary: str | None = None
    tags: List[str] | None = None


class BookmarkOut(BaseModel):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    id: str
    title: str
    url: str
    tags: List[str]
    summary: str
    createdAt: datetime = Field(alias="created_at", serialization_alias="createdAt")
    updatedAt: datetime = Field(alias="updated_at", serialization_alias="updatedAt")

    @field_validator("tags", mode="before")
    @classmethod
    def convert_tags(cls, v):
        if v is None:
            return []
        if isinstance(v, list) and len(v) > 0 and hasattr(v[0], "name"):
            return [tag.name for tag in v]
        return v
