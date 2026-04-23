import pytest
from unittest.mock import patch

from app.services import ai_service


@pytest.fixture(autouse=True)
def clear_url_cache():
    ai_service._url_cache.clear()
    yield


# --- Endpoint schema & basic behavior ---


def test_suggest_tags_title_only_returns_tags(client, auth_headers):
    with patch(
        "app.services.ai_service.suggest_tags_from_text", return_value=["react", "hooks"]
    ) as mock_llm:
        r = client.post(
            "/api/bookmarks/suggest-tags",
            json={"title": "React hooks guide"},
            headers=auth_headers,
        )
    assert r.status_code == 200
    data = r.json()
    tags = data["suggested_tags"]
    assert 3 <= len(tags) <= 5
    assert all(t == t.lower() and all(c.isalnum() or c == "-" for c in t) for t in tags)
    assert "react" in tags
    assert "hooks" in tags
    mock_llm.assert_called_once_with("React hooks guide", None)


def test_suggest_tags_with_url_and_summary(client, auth_headers):
    with patch(
        "app.services.ai_service.fetch_and_enrich",
        return_value={"tags": ["python", "tutorial"], "summary": "s"},
    ) as mock_fetch:
        r = client.post(
            "/api/bookmarks/suggest-tags",
            json={
                "title": "Python tutorial",
                "url": "https://example.com",
                "summary": "A tutorial",
            },
            headers=auth_headers,
        )
    assert r.status_code == 200
    data = r.json()
    tags = data["suggested_tags"]
    assert 3 <= len(tags) <= 5
    assert "python" in tags
    assert "tutorial" in tags
    mock_fetch.assert_called_once_with("https://example.com")


def test_suggest_tags_normalization(client, auth_headers):
    with patch(
        "app.services.ai_service.suggest_tags_from_text",
        return_value=["AI/ML", "React JS", "CSS3!"],
    ):
        r = client.post(
            "/api/bookmarks/suggest-tags",
            json={"title": "Dummy"},
            headers=auth_headers,
        )
    assert r.status_code == 200
    assert r.json()["suggested_tags"] == ["ai-ml", "react-js", "css3"]


def test_suggest_tags_count_enforcement(client, auth_headers):
    # 1 tag -> padded to 3 using title words
    with patch(
        "app.services.ai_service.suggest_tags_from_text", return_value=["ai"]
    ):
        r = client.post(
            "/api/bookmarks/suggest-tags",
            json={"title": "Machine learning intro"},
            headers=auth_headers,
        )
    tags = r.json()["suggested_tags"]
    assert len(tags) == 3

    # 5 tags -> kept at 5
    with patch(
        "app.services.ai_service.suggest_tags_from_text",
        return_value=["a", "b", "c", "d", "e"],
    ):
        r = client.post(
            "/api/bookmarks/suggest-tags",
            json={"title": "X"},
            headers=auth_headers,
        )
    tags = r.json()["suggested_tags"]
    assert len(tags) == 5

    # 7 tags -> clamped to 5
    with patch(
        "app.services.ai_service.suggest_tags_from_text",
        return_value=["a", "b", "c", "d", "e", "f", "g"],
    ):
        r = client.post(
            "/api/bookmarks/suggest-tags",
            json={"title": "X"},
            headers=auth_headers,
        )
    tags = r.json()["suggested_tags"]
    assert len(tags) == 5


def test_suggest_tags_url_cache_avoids_redundant_llm(client, auth_headers):
    with patch(
        "app.services.ai_service.fetch_and_enrich",
        return_value={"tags": ["cached-tag"], "summary": ""},
    ) as mock_fetch:
        r1 = client.post(
            "/api/bookmarks/suggest-tags",
            json={"title": "T", "url": "https://cache-me.com"},
            headers=auth_headers,
        )
        assert r1.status_code == 200
        tags1 = r1.json()["suggested_tags"]
        assert "cached-tag" in tags1

        r2 = client.post(
            "/api/bookmarks/suggest-tags",
            json={"title": "T", "url": "https://cache-me.com"},
            headers=auth_headers,
        )
        assert r2.status_code == 200
        tags2 = r2.json()["suggested_tags"]
        assert tags2 == tags1

    assert mock_fetch.call_count == 1


def test_suggest_tags_fallback_when_url_fetch_empty(client, auth_headers):
    with patch(
        "app.services.ai_service.fetch_and_enrich",
        return_value={"tags": [], "summary": ""},
    ) as mock_fetch, patch(
        "app.services.ai_service.suggest_tags_from_text",
        return_value=["fallback"],
    ) as mock_text:
        r = client.post(
            "/api/bookmarks/suggest-tags",
            json={"title": "React hooks guide", "url": "https://example.com"},
            headers=auth_headers,
        )
    assert r.status_code == 200
    tags = r.json()["suggested_tags"]
    assert len(tags) >= 3
    assert "fallback" in tags
    mock_fetch.assert_called_once_with("https://example.com")
    mock_text.assert_called_once_with("React hooks guide", None)


def test_suggest_tags_missing_title_returns_422(client, auth_headers):
    r = client.post(
        "/api/bookmarks/suggest-tags",
        json={"url": "https://example.com"},
        headers=auth_headers,
    )
    assert r.status_code == 422
