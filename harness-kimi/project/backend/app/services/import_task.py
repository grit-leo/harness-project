import threading
import uuid
from typing import Dict, Optional
from sqlalchemy.orm import Session
from app.core.database import SessionLocal
from app.models.user import User
from app.models.bookmark import Bookmark
from app.models.tag import Tag
from app.services.netscape_parser import ParsedBookmark


class ImportTask:
    def __init__(self):
        self.id: str = str(uuid.uuid4())
        self.status: str = "pending"  # pending, in_progress, done, failed
        self.total: int = 0
        self.processed: int = 0
        self.errors: int = 0
        self.bookmark_ids: list = []
        self.error_detail: Optional[str] = None


_import_tasks: Dict[str, ImportTask] = {}
_lock = threading.Lock()


def get_task(task_id: str) -> Optional[ImportTask]:
    with _lock:
        return _import_tasks.get(task_id)


def _ensure_tags(db: Session, user_id: str, tag_names: list) -> list:
    tags = []
    for name in set(tag_names):
        name = name.strip().lower()
        if not name:
            continue
        tag = db.query(Tag).filter(Tag.user_id == user_id, Tag.name == name).first()
        if not tag:
            tag = Tag(user_id=user_id, name=name)
            db.add(tag)
            db.flush()
        tags.append(tag)
    db.commit()
    return tags


def run_import_task(task_id: str, user_id: str, parsed_bookmarks: list) -> None:
    task = get_task(task_id)
    if not task:
        return
    task.status = "in_progress"
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            task.status = "failed"
            task.error_detail = "User not found"
            return

        for pb in parsed_bookmarks:
            try:
                bookmark = Bookmark(
                    user_id=user_id,
                    url=pb.url,
                    title=pb.title or pb.url,
                    summary="",
                )
                db.add(bookmark)
                db.flush()
                tags = []
                if pb.folder:
                    tags = _ensure_tags(db, user_id, [pb.folder])
                bookmark.tags = tags
                db.commit()
                db.refresh(bookmark)
                task.bookmark_ids.append(bookmark.id)
                task.processed += 1
            except Exception:
                task.errors += 1
                db.rollback()
        task.status = "done"
    except Exception as e:
        task.status = "failed"
        task.error_detail = str(e)
    finally:
        db.close()


def create_task(total: int) -> ImportTask:
    task = ImportTask()
    task.total = total
    with _lock:
        _import_tasks[task.id] = task
    return task


def cleanup_old_tasks() -> None:
    # Keep it simple; no cleanup needed for demo
    pass
