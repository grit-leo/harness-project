from pydantic import BaseModel, EmailStr, Field


class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=6)


class UserOut(BaseModel):
    id: str
    email: str

    class Config:
        from_attributes = True
