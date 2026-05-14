import hashlib
import json
import os
import re
from collections import OrderedDict
from datetime import datetime, timedelta, timezone

import httpx
from sqlalchemy.orm import Session

from urllib.parse import urlparse

from app.core.database import SessionLocal
from app.models.ai_cache import AICache
from app.models.bookmark import Bookmark

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
MOCK_AI = os.getenv("MOCK_AI", "").lower() in ("1", "true", "yes")


def _content_hash(content: str) -> str:
    return hashlib.sha256(content.encode("utf-8")).hexdigest()


def _strip_html(html: str) -> str:
    text = re.sub(r"<script[^>]*>.*?</script>", "", html, flags=re.DOTALL | re.IGNORECASE)
    text = re.sub(r"<style[^>]*>.*?</style>", "", text, flags=re.DOTALL | re.IGNORECASE)
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def _truncate_text(text: str, max_chars: int = 4000) -> str:
    return text[:max_chars]


def _domain_fallback(url: str, summary: str = "") -> dict:
    hostname = urlparse(url).hostname or ""
    hostname = hostname.replace("www.", "").split(".")[0]
    tags = [hostname] if hostname else []
    return {"tags": tags, "summary": summary}


def _get_cached(db: Session, content_hash: str):
    cutoff = datetime.now(timezone.utc) - timedelta(days=7)
    return (
        db.query(AICache)
        .filter(AICache.content_hash == content_hash, AICache.created_at >= cutoff)
        .first()
    )


def _llm_chat(prompt: str) -> str:
    if MOCK_AI:
        return json.dumps({
            "tags": ["demo-tag", "sample", "mock-ai"],
            "summary": "This is a mock summary generated because MOCK_AI is enabled.",
        })
    if not OPENAI_API_KEY:
        return json.dumps({"tags": [], "summary": ""})
    try:
        r = httpx.post(
            "https://api.openai.com/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {OPENAI_API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "model": OPENAI_MODEL,
                "messages": [{"role": "user", "content": prompt}],
                "temperature": 0.5,
            },
            timeout=30,
        )
        r.raise_for_status()
        data = r.json()
        content = data["choices"][0]["message"]["content"]
        if "```" in content:
            parts = content.split("```")
            content = parts[1]
            if content.startswith("json"):
                content = content[4:]
        return content.strip()
    except Exception:
        return json.dumps({"tags": [], "summary": ""})


def _call_llm(text: str) -> dict:
    prompt = (
        "You are an assistant that extracts tags and a short summary from a web page. "
        "Respond ONLY with a JSON object containing two keys: "
        "'tags' (a list of 3–7 relevant lowercase single-word or short phrase tags) and "
        "'summary' (a 1–2 sentence summary of the content). "
        "Do not include markdown formatting or any extra text.\n\n"
        f"Page content:\n{text}"
    )
    content = _llm_chat(prompt)
    try:
        parsed = json.loads(content)
        tags = [t.lower().strip() for t in parsed.get("tags", []) if isinstance(t, str)]
        summary = str(parsed.get("summary", "")).strip()
        return {"tags": tags, "summary": summary}
    except Exception:
        return {"tags": [], "summary": ""}


def _call_llm_tags(text: str) -> list[str]:
    prompt = (
        "You are an assistant that suggests relevant tags for a web page or article. "
        "Respond ONLY with a JSON object containing one key: "
        "'tags' (a list of 3–5 relevant lowercase single-word or short phrase tags). "
        "Do not include markdown formatting or any extra text.\n\n"
        f"Content:\n{text}"
    )
    content = _llm_chat(prompt)
    try:
        parsed = json.loads(content)
        tags = [t.lower().strip() for t in parsed.get("tags", []) if isinstance(t, str)]
        return tags
    except Exception:
        return []


def suggest_tags_from_text(title: str, summary: str | None = None) -> list[str]:
    text = title
    if summary:
        text += f"\n\nSummary: {summary}"
    return _call_llm_tags(text)


class _URLCache:
    """Lightweight LRU cache for URL-keyed tag suggestions with a max size."""

    def __init__(self, maxsize: int = 1000):
        self._cache: OrderedDict[str, list[str]] = OrderedDict()
        self._maxsize = maxsize

    def clear(self) -> None:
        self._cache.clear()

    def get(self, key: str) -> list[str] | None:
        if key in self._cache:
            self._cache.move_to_end(key)
            return self._cache[key]
        return None

    def set(self, key: str, value: list[str]) -> None:
        if key in self._cache:
            self._cache.move_to_end(key)
        self._cache[key] = value
        if len(self._cache) > self._maxsize:
            self._cache.popitem(last=False)


# Bounded LRU cache (max 1000 entries) to prevent unbounded memory growth
_url_cache = _URLCache(maxsize=1000)


def _url_hash(url: str) -> str:
    return hashlib.sha256(url.encode("utf-8")).hexdigest()


def get_url_cached_tags(url: str) -> list[str] | None:
    return _url_cache.get(_url_hash(url))


def set_url_cached_tags(url: str, tags: list[str]) -> None:
    _url_cache.set(_url_hash(url), tags)


def suggest_tags_for_url(url: str) -> list[str]:
    cached = get_url_cached_tags(url)
    if cached is not None:
        return cached
    result = fetch_and_enrich(url)
    tags = result.get("tags", [])
    set_url_cached_tags(url, tags)
    return tags


def fetch_and_enrich(url: str) -> dict:
    db = SessionLocal()
    try:
        try:
            resp = httpx.get(
                url,
                timeout=10,
                follow_redirects=True,
                headers={"User-Agent": "Mozilla/5.0"},
            )
            resp.raise_for_status()
            raw_html = resp.text
        except Exception:
            raw_html = ""
        if not raw_html:
            return _domain_fallback(url)
        h = _content_hash(raw_html)
        cached = _get_cached(db, h)
        if cached:
            return {"tags": cached.tags, "summary": cached.summary}
        text = _strip_html(raw_html)
        text = _truncate_text(text)
        if not text:
            return _domain_fallback(url)
        result = _call_llm(text)
        if not result.get("tags"):
            result = _domain_fallback(url, result.get("summary", ""))
        cache = AICache(content_hash=h, tags=result["tags"], summary=result["summary"])
        db.add(cache)
        db.commit()
        return result
    finally:
        db.close()


def enrich_bookmark(bookmark_id: str, url: str) -> None:
    result = fetch_and_enrich(url)
    db = SessionLocal()
    try:
        bookmark = db.query(Bookmark).filter(Bookmark.id == bookmark_id).first()
        if bookmark:
            if not bookmark.summary and result.get("summary"):
                bookmark.summary = result["summary"]
            bookmark.suggested_tags = result.get("tags", [])
            db.commit()
    finally:
        db.close()
