from typing import List
from pydantic import BaseModel, HttpUrl, Field, ConfigDict, field_validator

from app.schemas.common import UtcDatetime


class BookmarkCreate(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    url: HttpUrl
    title: str = Field(..., min_length=1)
    summary: str = ""
    tags: List[str] = []
    thumbnail_url: str | None = Field(default=None, alias="thumbnailUrl")


class BookmarkUpdate(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    url: HttpUrl | None = None
    title: str | None = Field(None, min_length=1)
    summary: str | None = None
    tags: List[str] | None = None
    thumbnail_url: str | None = Field(default=None, alias="thumbnailUrl")


class BookmarkOut(BaseModel):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    id: str
    title: str
    url: str
    tags: List[str]
    summary: str
    thumbnailUrl: str | None = Field(default=None, alias="thumbnail_url", serialization_alias="thumbnailUrl")
    suggestedTags: List[str] = Field(default=[], alias="suggested_tags", serialization_alias="suggestedTags")
    createdAt: UtcDatetime = Field(alias="created_at", serialization_alias="createdAt")
    updatedAt: UtcDatetime = Field(alias="updated_at", serialization_alias="updatedAt")

    @field_validator("tags", mode="before")
    @classmethod
    def convert_tags(cls, v):
        if v is None:
            return []
        if isinstance(v, list) and len(v) > 0 and hasattr(v[0], "name"):
            return [tag.name for tag in v]
        return v

    @field_validator("suggestedTags", mode="before")
    @classmethod
    def default_suggested_tags(cls, v):
        return v or []

    @field_validator("summary", mode="before")
    @classmethod
    def default_summary(cls, v):
        return v or ""


class SuggestedTagsOut(BaseModel):
    suggested_tags: List[str]


class SuggestTagsPayload(BaseModel):
    title: str = Field(..., min_length=1)
    url: str | None = None
    summary: str | None = None


class ApplyTagsPayload(BaseModel):
    tags: List[str] = []
