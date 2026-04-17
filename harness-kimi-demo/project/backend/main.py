from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import auth, bookmarks, tags, collections

app = FastAPI(title="Lumina API", version="0.4.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(bookmarks.router)
app.include_router(tags.router)
app.include_router(collections.router)


@app.get("/health")
def health():
    return {"status": "ok"}
