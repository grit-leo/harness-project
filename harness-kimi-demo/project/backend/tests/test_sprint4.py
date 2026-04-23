import time
from io import BytesIO

from app.services.netscape_exporter import bookmarks_to_netscape_html
from app.services.netscape_parser import parse_netscape_html
from app.models.bookmark import Bookmark
from app.models.tag import Tag


NETSCAPE_SMALL = """<!DOCTYPE NETSCAPE-Bookmark-file-1>
<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
<TITLE>Bookmarks</TITLE>
<H1>Bookmarks</H1>
<DL><p>
    <DT><H3 ADD_DATE="1234567890">Design</H3>
    <DL><p>
        <DT><A HREF="https://example.com/design1" ADD_DATE="1234567891">Design Article 1</A>
        <DT><A HREF="https://example.com/design2" ADD_DATE="1234567892">Design Article 2</A>
    </DL><p>
    <DT><H3 ADD_DATE="1234567890">Development</H3>
    <DL><p>
        <DT><A HREF="https://github.com/repo" ADD_DATE="1234567893">GitHub Repo</A>
    </DL><p>
</DL><p>
"""


def _large_netscape(count: int) -> str:
    lines = [
        "<!DOCTYPE NETSCAPE-Bookmark-file-1>",
        '<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">',
        "<TITLE>Bookmarks</TITLE>",
        "<H1>Bookmarks</H1>",
        "<DL><p>",
        '    <DT><H3 ADD_DATE="1234567890">Bulk</H3>',
        "    <DL><p>",
    ]
    for i in range(count):
        lines.append(f'        <DT><A HREF="https://example.com/item{i}" ADD_DATE="1234567890">Item {i}</A>')
    lines.append("    </DL><p>")
    lines.append("</DL><p>")
    return "\n".join(lines) + "\n"


def test_import_small_sync(client, auth_headers):
    file = BytesIO(NETSCAPE_SMALL.encode("utf-8"))
    r = client.post(
        "/api/bookmarks/import",
        files={"file": ("bookmarks.html", file, "text/html")},
        headers=auth_headers,
    )
    assert r.status_code == 200
    data = r.json()
    assert data["imported"] == 3
    assert len(data["bookmark_ids"]) == 3

    # Verify bookmarks exist
    r2 = client.get("/api/bookmarks", headers=auth_headers)
    assert r2.status_code == 200
    bms = r2.json()
    urls = {bm["url"] for bm in bms}
    assert "https://example.com/design1" in urls
    assert "https://github.com/repo" in urls


def test_import_folders_map_to_tags(client, auth_headers, db):
    file = BytesIO(NETSCAPE_SMALL.encode("utf-8"))
    r = client.post(
        "/api/bookmarks/import",
        files={"file": ("bookmarks.html", file, "text/html")},
        headers=auth_headers,
    )
    assert r.status_code == 200

    tags = db.query(Tag).filter(Tag.user_id == db.query(Tag).first().user_id).all()
    tag_names = {t.name for t in tags}
    assert "design" in tag_names or "development" in tag_names


def test_import_large_async(client, auth_headers, db, monkeypatch):
    # Patch import_task.SessionLocal so background task uses test DB
    from app.services import import_task as import_task_mod

    class SessionWrapper:
        def __getattr__(self, name):
            attr = getattr(db, name)
            if name == "close":
                return lambda: None
            return attr

    class FakeSessionLocal:
        def __call__(self):
            return SessionWrapper()

    monkeypatch.setattr(import_task_mod, "SessionLocal", FakeSessionLocal())

    html = _large_netscape(55)
    file = BytesIO(html.encode("utf-8"))
    r = client.post(
        "/api/bookmarks/import",
        files={"file": ("bookmarks.html", file, "text/html")},
        headers=auth_headers,
    )
    assert r.status_code == 200
    data = r.json()
    assert "task_id" in data
    task_id = data["task_id"]

    # Poll until done (with timeout)
    for _ in range(30):
        r2 = client.get(f"/api/bookmarks/import-status/{task_id}", headers=auth_headers)
        assert r2.status_code == 200
        status_data = r2.json()
        if status_data["status"] in ("done", "failed"):
            break
        time.sleep(0.2)

    assert status_data["status"] == "done"
    assert status_data["total"] == 55
    assert status_data["processed"] == 55


def test_export_json(client, auth_headers, db):
    from app.models.user import User
    user = db.query(User).filter(User.email == "test@example.com").first()
    user_id = user.id
    # Create a bookmark with a tag
    bm = Bookmark(user_id=user_id, url="https://example.com/export", title="Export Test", summary="A summary")
    db.add(bm)
    db.commit()
    db.refresh(bm)
    tag = Tag(user_id=user_id, name="test-tag")
    db.add(tag)
    db.commit()
    bm.tags.append(tag)
    db.commit()

    r = client.get("/api/bookmarks/export?format=json", headers=auth_headers)
    assert r.status_code == 200
    assert "application/json" in r.headers["content-type"]
    data = r.json()
    assert isinstance(data, list)
    assert len(data) >= 1
    urls = [item["url"] for item in data]
    assert "https://example.com/export" in urls
    for item in data:
        assert "id" in item
        assert "url" in item
        assert "title" in item
        assert "tags" in item
        assert "summary" in item
        assert "created_at" in item
        assert "updated_at" in item


def test_export_netscape(client, auth_headers, db):
    from app.models.user import User
    user = db.query(User).filter(User.email == "test@example.com").first()
    user_id = user.id
    bm = Bookmark(user_id=user_id, url="https://example.com/ns", title="NS Test", summary="")
    db.add(bm)
    db.commit()
    db.refresh(bm)
    tag = Tag(user_id=user_id, name="sample")
    db.add(tag)
    db.commit()
    bm.tags.append(tag)
    db.commit()

    r = client.get("/api/bookmarks/export?format=netscape", headers=auth_headers)
    assert r.status_code == 200
    assert "text/html" in r.headers["content-type"]
    html = r.text
    assert "<!DOCTYPE NETSCAPE-Bookmark-file-1>" in html
    assert "https://example.com/ns" in html
    assert "NS Test" in html


def test_export_netscape_round_trip(client, auth_headers, db):
    from app.models.user import User
    user = db.query(User).filter(User.email == "test@example.com").first()
    user_id = user.id
    # Seed bookmarks
    for i in range(5):
        bm = Bookmark(user_id=user_id, url=f"https://example.com/rt{i}", title=f"RT {i}", summary="")
        db.add(bm)
        db.commit()
        db.refresh(bm)
        tag = Tag(user_id=user_id, name=f"folder{i % 2}")
        db.add(tag)
        db.commit()
        bm.tags.append(tag)
        db.commit()

    # Export
    r = client.get("/api/bookmarks/export?format=netscape", headers=auth_headers)
    assert r.status_code == 200
    html = r.text

    # Count before re-import
    r2 = client.get("/api/bookmarks", headers=auth_headers)
    before_count = len(r2.json())

    # Re-import (different user to avoid duplicates, but same user is fine for this test)
    file = BytesIO(html.encode("utf-8"))
    r3 = client.post(
        "/api/bookmarks/import",
        files={"file": ("bookmarks.html", file, "text/html")},
        headers=auth_headers,
    )
    assert r3.status_code == 200
    data = r3.json()
    imported_count = data.get("imported", 0)

    # The round-trip should produce the same number of bookmarks
    assert imported_count == before_count


def test_suggest_tags_endpoint(client, auth_headers, monkeypatch):
    monkeypatch.setattr("app.services.ai_service.fetch_and_enrich", lambda url: {"tags": ["demo", "test"], "summary": "ok"})
    r = client.post(
        "/api/bookmarks/suggest-tags",
        json={"url": "https://example.com/article", "title": "Article"},
        headers=auth_headers,
    )
    assert r.status_code == 200
    data = r.json()
    # Endpoint enforces 3-5 tags; title word "article" is added as padding
    assert data["suggested_tags"] == ["demo", "test", "article"]


def test_suggest_tags_works_without_url(client, auth_headers, monkeypatch):
    monkeypatch.setattr("app.services.ai_service.suggest_tags_from_text", lambda title, summary=None: ["ai", "ml"])
    r = client.post(
        "/api/bookmarks/suggest-tags",
        json={"title": "Article"},
        headers=auth_headers,
    )
    assert r.status_code == 200
    data = r.json()
    assert "ai" in data["suggested_tags"]


def test_extension_unauthorized_without_jwt(client):
    r = client.post("/api/bookmarks", json={"url": "https://example.com", "title": "Test"})
    assert r.status_code == 401

    r2 = client.post("/api/bookmarks/suggest-tags", json={"url": "https://example.com", "title": "Test"})
    assert r2.status_code == 401


def test_import_invalid_file_type(client, auth_headers):
    file = BytesIO(b"not html")
    r = client.post(
        "/api/bookmarks/import",
        files={"file": ("bookmarks.txt", file, "text/plain")},
        headers=auth_headers,
    )
    assert r.status_code == 400
