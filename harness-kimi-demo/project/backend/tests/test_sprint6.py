import pytest
from unittest.mock import patch

from app.models.bookmark import Bookmark


# --- Fetch metadata endpoint ---

def test_fetch_metadata_success(client, auth_headers):
    html = (
        '<html><head>'
        '<title>Example Page</title>'
        '<meta name="description" content="A sample page.">'
        '<meta property="og:image" content="https://example.com/image.png">'
        '</head><body></body></html>'
    )
    with patch("app.routers.bookmarks.fetch_metadata") as mock_fetch:
        mock_fetch.return_value = {
            "title": "Example Page",
            "description": "A sample page.",
            "thumbnail_url": "https://example.com/image.png",
        }
        r = client.post(
            "/api/bookmarks/fetch-metadata",
            json={"url": "https://example.com"},
            headers=auth_headers,
        )
    assert r.status_code == 200
    data = r.json()
    assert data["title"] == "Example Page"
    assert data["description"] == "A sample page."
    assert data["thumbnail_url"] == "https://example.com/image.png"


def test_fetch_metadata_rejects_ftp(client, auth_headers):
    r = client.post(
        "/api/bookmarks/fetch-metadata",
        json={"url": "ftp://example.com"},
        headers=auth_headers,
    )
    assert r.status_code == 422


def test_fetch_metadata_rate_limit(client, auth_headers):
    with patch("app.routers.bookmarks.fetch_metadata") as mock_fetch:
        mock_fetch.return_value = {"title": "T", "description": "D", "thumbnail_url": None}
        for i in range(10):
            r = client.post(
                "/api/bookmarks/fetch-metadata",
                json={"url": f"https://example{i}.com"},
                headers=auth_headers,
            )
            assert r.status_code == 200, f"Request {i+1} should succeed"

        # 11th request should be rate limited
        r = client.post(
            "/api/bookmarks/fetch-metadata",
            json={"url": "https://example-limit.com"},
            headers=auth_headers,
        )
        assert r.status_code == 429


# --- Schema serialization ---

def test_bookmark_out_includes_thumbnail_url(client, auth_headers, db):
    r = client.post(
        "/api/bookmarks",
        json={
            "url": "https://example.com/thumb",
            "title": "Thumb Test",
            "thumbnail_url": "https://example.com/img.png",
        },
        headers=auth_headers,
    )
    assert r.status_code == 201
    data = r.json()
    assert data["thumbnailUrl"] == "https://example.com/img.png"

    # List response also includes it
    r = client.get("/api/bookmarks", headers=auth_headers)
    assert r.status_code == 200
    items = r.json()
    bm = next((b for b in items if b["url"] == "https://example.com/thumb"), None)
    assert bm is not None
    assert bm["thumbnailUrl"] == "https://example.com/img.png"


def test_bookmark_create_accepts_camelcase_thumbnail_url(client, auth_headers, db):
    """Regression test for BUG-001: frontend sends thumbnailUrl (camelCase)."""
    r = client.post(
        "/api/bookmarks",
        json={
            "url": "https://example.com/camel",
            "title": "CamelCase Test",
            "thumbnailUrl": "https://example.com/camel.png",
        },
        headers=auth_headers,
    )
    assert r.status_code == 201
    data = r.json()
    assert data["thumbnailUrl"] == "https://example.com/camel.png"


# --- Existing bookmarks load with null thumbnail_url ---

def test_existing_bookmark_has_null_thumbnail_url(client, auth_headers, db):
    r = client.post(
        "/api/bookmarks",
        json={"url": "https://example.com/no-thumb", "title": "No Thumb"},
        headers=auth_headers,
    )
    assert r.status_code == 201
    data = r.json()
    assert data["thumbnailUrl"] is None


# --- Update bookmark thumbnail_url ---

def test_update_bookmark_thumbnail_url(client, auth_headers, db):
    r = client.post(
        "/api/bookmarks",
        json={"url": "https://example.com/update", "title": "Update"},
        headers=auth_headers,
    )
    bm_id = r.json()["id"]

    r = client.patch(
        f"/api/bookmarks/{bm_id}",
        json={"thumbnail_url": "https://example.com/new.png"},
        headers=auth_headers,
    )
    assert r.status_code == 200
    assert r.json()["thumbnailUrl"] == "https://example.com/new.png"


# --- Metadata service fallback behavior ---

def test_metadata_service_returns_empty_on_timeout():
    from app.services.metadata_service import fetch_metadata
    with patch("app.services.metadata_service.httpx.get") as mock_get:
        mock_get.side_effect = Exception("timeout")
        result = fetch_metadata("https://example.com")
    assert result["title"] == ""
    assert result["description"] == ""
    assert result["thumbnail_url"] is None


def test_metadata_service_parses_with_beautifulsoup():
    from app.services.metadata_service import fetch_metadata
    html = (
        '<html><head>'
        '<title>BS Title</title>'
        '<meta name="description" content="BS Desc">'
        '<meta property="og:image" content="https://bs.com/img.jpg">'
        '</head><body></body></html>'
    )
    with patch("app.services.metadata_service.httpx.get") as mock_get:
        mock_get.return_value.text = html
        mock_get.return_value.raise_for_status = lambda: None
        result = fetch_metadata("https://bs.com")
    assert result["title"] == "BS Title"
    assert result["description"] == "BS Desc"
    assert result["thumbnail_url"] == "https://bs.com/img.jpg"


def test_metadata_service_twitter_image_fallback():
    from app.services.metadata_service import fetch_metadata
    html = (
        '<html><head>'
        '<title>Twitter Title</title>'
        '<meta name="twitter:image" content="https://tw.com/tw.jpg">'
        '</head><body></body></html>'
    )
    with patch("app.services.metadata_service.httpx.get") as mock_get:
        mock_get.return_value.text = html
        mock_get.return_value.raise_for_status = lambda: None
        result = fetch_metadata("https://tw.com")
    assert result["thumbnail_url"] == "https://tw.com/tw.jpg"


def test_metadata_service_regex_fallback():
    from app.services.metadata_service import fetch_metadata
    with patch("app.services.metadata_service.httpx.get") as mock_get:
        mock_get.return_value.text = (
            '<html><head><title>Regex Title</title>'
            '<meta content="Regex Desc" name="description">'
            '<meta content="https://re.com/img.png" property="og:image">'
            '</head></html>'
        )
        mock_get.return_value.raise_for_status = lambda: None
        # Force BeautifulSoup to fail by patching it
        with patch("app.services.metadata_service.BeautifulSoup") as mock_bs:
            mock_bs.side_effect = Exception("parse error")
            result = fetch_metadata("https://re.com")
    assert result["title"] == "Regex Title"
    assert result["description"] == "Regex Desc"
    assert result["thumbnail_url"] == "https://re.com/img.png"
