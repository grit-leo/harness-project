from typing import List
from pydantic import BaseModel, Field, ConfigDict
from datetime import datetime


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


class CollectionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    id: str
    name: str
    rules: dict = Field(alias="rules_json", serialization_alias="rules")
    isDefault: bool = Field(alias="is_default", serialization_alias="isDefault")
    createdAt: datetime = Field(alias="created_at", serialization_alias="createdAt")
    updatedAt: datetime = Field(alias="updated_at", serialization_alias="updatedAt")
