from typing import List, Optional
from pydantic import BaseModel, Field, ConfigDict

from app.schemas.common import UtcDatetime


class Condition(BaseModel):
    field: str  # tag | domain | date
    op: str     # equals | last_n_days
    value: str | int


class Rules(BaseModel):
    operator: str = "AND"  # AND | OR
    conditions: List[Condition] = []


class CollectionCreate(BaseModel):
    name: str = Field(..., min_length=1)
    rules: Rules


class CollectionUpdate(BaseModel):
    name: str | None = Field(None, min_length=1)
    rules: Rules | None = None
    visibility: str | None = None


class CollectionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    id: str
    name: str
    rules: dict = Field(alias="rules_json", serialization_alias="rules")
    isDefault: bool = Field(alias="is_default", serialization_alias="isDefault")
    visibility: str = "private"
    shareToken: str | None = Field(alias="share_token", serialization_alias="shareToken")
    createdAt: UtcDatetime = Field(alias="created_at", serialization_alias="createdAt")
    updatedAt: UtcDatetime = Field(alias="updated_at", serialization_alias="updatedAt")


class CollaboratorOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    userId: str = Field(alias="user_id")
    email: str
    role: str


class PublicCollectionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    id: str
    name: str
    rules: dict = Field(alias="rules_json", serialization_alias="rules")
    ownerEmail: str = Field(alias="owner_email", serialization_alias="ownerEmail")
    createdAt: UtcDatetime = Field(alias="created_at", serialization_alias="createdAt")
    updatedAt: UtcDatetime = Field(alias="updated_at", serialization_alias="updatedAt")


class FollowOut(BaseModel):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    id: str
    followerId: str = Field(alias="follower_id", serialization_alias="followerId")
    followingUserId: str | None = Field(alias="following_user_id", serialization_alias="followingUserId")
    followingCollectionId: str | None = Field(alias="following_collection_id", serialization_alias="followingCollectionId")
    createdAt: UtcDatetime = Field(alias="created_at", serialization_alias="createdAt")


class DigestItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    id: str
    userId: str = Field(alias="user_id", serialization_alias="userId")
    sourceUserId: str | None = Field(alias="source_user_id", serialization_alias="sourceUserId")
    sourceCollectionId: str | None = Field(alias="source_collection_id", serialization_alias="sourceCollectionId")
    bookmarkId: str = Field(alias="bookmark_id", serialization_alias="bookmarkId")
    seen: bool
    createdAt: UtcDatetime = Field(alias="created_at", serialization_alias="createdAt")
