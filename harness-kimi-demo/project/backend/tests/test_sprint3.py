from unittest.mock import patch, MagicMock
from app.services import ai_service
from app.models.bookmark import Bookmark
from app.models.collection import Collection
from app.models.user import User


def _mock_httpx_get():
    mock_resp = MagicMock()
    mock_resp.raise_for_status.return_value = None
    mock_resp.text = "<html><body><p>This is a sample article about python and ai.</p></body></html>"
    return mock_resp


def test_ai_cache_prevents_duplicate_llm_call(db):
    url = "https://example.com/article"
    fake_result = {"tags": ["python", "ai"], "summary": "A short summary."}

    call_count = 0

    def fake_call_llm(text):
        nonlocal call_count
        call_count += 1
        return fake_result

    original_call_llm = ai_service._call_llm
    original_key = ai_service.OPENAI_API_KEY
    ai_service.OPENAI_API_KEY = "fake-key"
    ai_service._call_llm = fake_call_llm

    try:
        with patch("app.services.ai_service.httpx.get", return_value=_mock_httpx_get()):
            r1 = ai_service.fetch_and_enrich(url)
            assert r1["tags"] == ["python", "ai"]
            assert call_count == 1

            r2 = ai_service.fetch_and_enrich(url)
            assert r2["tags"] == ["python", "ai"]
            assert call_count == 1

        cached = db.query(ai_service.AICache).filter(ai_service.AICache.content_hash == ai_service._content_hash(_mock_httpx_get().text)).first()
        assert cached is not None
        assert cached.summary == "A short summary."
    finally:
        ai_service._call_llm = original_call_llm
        ai_service.OPENAI_API_KEY = original_key


def test_suggested_tags_endpoint(client, auth_headers, db):
    r = client.post("/api/bookmarks", json={"url": "https://example.com", "title": "Example"}, headers=auth_headers)
    assert r.status_code == 201
    bm_id = r.json()["id"]

    bm = db.query(Bookmark).filter(Bookmark.id == bm_id).first()
    bm.suggested_tags = ["ai", "ml"]
    db.commit()

    r = client.get(f"/api/bookmarks/{bm_id}/suggested-tags", headers=auth_headers)
    assert r.status_code == 200
    assert r.json()["suggested_tags"] == ["ai", "ml"]


def test_apply_tags_persist_and_clear_suggested(client, auth_headers, db):
    r = client.post("/api/bookmarks", json={"url": "https://example.com", "title": "Example"}, headers=auth_headers)
    bm_id = r.json()["id"]

    bm = db.query(Bookmark).filter(Bookmark.id == bm_id).first()
    bm.suggested_tags = ["ai", "ml"]
    db.commit()

    r = client.post(f"/api/bookmarks/{bm_id}/apply-tags", json={"tags": ["ai", "deep-learning"]}, headers=auth_headers)
    assert r.status_code == 200
    data = r.json()
    assert sorted(data["tags"]) == ["ai", "deep-learning"]
    assert data["suggestedTags"] == []


def test_summary_generated_and_persisted(db):
    bm = Bookmark(user_id="user-123", url="https://example.com", title="Test", summary="")
    db.add(bm)
    db.commit()
    db.refresh(bm)

    fake_result = {"tags": ["tag1"], "summary": "Generated summary text."}

    original_call_llm = ai_service._call_llm
    original_key = ai_service.OPENAI_API_KEY
    ai_service.OPENAI_API_KEY = "fake-key"
    ai_service._call_llm = lambda text: fake_result

    try:
        with patch("app.services.ai_service.httpx.get", return_value=_mock_httpx_get()):
            ai_service.enrich_bookmark(bm.id, bm.url)
        db.refresh(bm)
        assert bm.summary == "Generated summary text."
        assert bm.suggested_tags == ["tag1"]
    finally:
        ai_service._call_llm = original_call_llm
        ai_service.OPENAI_API_KEY = original_key


def test_default_collections_created_on_register(client):
    r = client.post("/api/auth/register", json={"email": "coll@example.com", "password": "password"})
    assert r.status_code == 201
    login = client.post("/api/auth/login", json={"email": "coll@example.com", "password": "password"})
    token = login.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    r = client.get("/api/collections", headers=headers)
    assert r.status_code == 200
    data = r.json()
    names = [c["name"] for c in data]
    assert "Unread Last 7 Days" in names
    assert "Design Inspiration" in names
    assert "Recent Reads" in names


def test_collection_query_engine_filters_bookmarks(client, auth_headers, db):
    user = db.query(User).filter(User.email == "test@example.com").first()
    user_id = user.id

    coll = Collection(
        user_id=user_id,
        name="GitHub Only",
        rules_json={"operator": "AND", "conditions": [{"field": "domain", "op": "equals", "value": "github.com"}]},
    )
    db.add(coll)

    bm1 = Bookmark(user_id=user_id, url="https://github.com/repo", title="Repo", summary="")
    bm2 = Bookmark(user_id=user_id, url="https://example.com/page", title="Page", summary="")
    db.add(bm1)
    db.add(bm2)
    db.commit()
    db.refresh(coll)
    coll_id = coll.id

    r = client.get(f"/api/collections/{coll_id}/bookmarks", headers=auth_headers)
    assert r.status_code == 200
    data = r.json()
    assert len(data) == 1
    assert data[0]["url"] == "https://github.com/repo"
