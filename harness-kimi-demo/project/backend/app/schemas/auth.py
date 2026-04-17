from pydantic import BaseModel


class TokenPair(BaseModel):
    access_token: str
    refresh_token: str


class TokenRefresh(BaseModel):
    refresh_token: str
