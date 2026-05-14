from urllib.parse import urlparse

import httpx
from bs4 import BeautifulSoup


def fetch_metadata(url: str) -> dict:
    """Fetch HTML from a URL and extract title, description, and og:image."""
    try:
        resp = httpx.get(
            url,
            timeout=10,
            follow_redirects=True,
            headers={
                "User-Agent": (
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) "
                    "Chrome/120.0.0.0 Safari/537.36"
                )
            },
        )
        resp.raise_for_status()
        html = resp.text
    except Exception:
        return {"title": "", "description": "", "thumbnail_url": None}

    try:
        soup = BeautifulSoup(html, "html.parser")
    except Exception:
        # Fallback to regex-like parsing if BeautifulSoup fails
        return _parse_with_regex(html)

    title = ""
    description = ""
    thumbnail_url = None

    title_tag = soup.find("title")
    if title_tag and title_tag.string:
        title = title_tag.string.strip()

    desc_meta = soup.find("meta", attrs={"name": "description"})
    if desc_meta and desc_meta.get("content"):
        description = desc_meta["content"].strip()

    og_image = soup.find("meta", attrs={"property": "og:image"})
    if og_image and og_image.get("content"):
        thumbnail_url = og_image["content"].strip()
    else:
        # Fallback to twitter:image
        tw_image = soup.find("meta", attrs={"name": "twitter:image"})
        if tw_image and tw_image.get("content"):
            thumbnail_url = tw_image["content"].strip()

    return {
        "title": title,
        "description": description,
        "thumbnail_url": thumbnail_url,
    }


def _parse_with_regex(html: str) -> dict:
    import re

    title = ""
    description = ""
    thumbnail_url = None

    title_match = re.search(r"<title[^>]*>(.*?)</title>", html, re.IGNORECASE | re.DOTALL)
    if title_match:
        title = re.sub(r"<[^>]+>", "", title_match.group(1)).strip()

    desc_match = re.search(
        r'<meta[^>]*name=["\']description["\'][^>]*content=["\']([^"\']*)["\']',
        html,
        re.IGNORECASE,
    )
    if not desc_match:
        desc_match = re.search(
            r'<meta[^>]*content=["\']([^"\']*)["\'][^>]*name=["\']description["\']',
            html,
            re.IGNORECASE,
        )
    if desc_match:
        description = desc_match.group(1).strip()

    og_match = re.search(
        r'<meta[^>]*property=["\']og:image["\'][^>]*content=["\']([^"\']*)["\']',
        html,
        re.IGNORECASE,
    )
    if not og_match:
        og_match = re.search(
            r'<meta[^>]*content=["\']([^"\']*)["\'][^>]*property=["\']og:image["\']',
            html,
            re.IGNORECASE,
        )
    if og_match:
        thumbnail_url = og_match.group(1).strip()

    return {
        "title": title,
        "description": description,
        "thumbnail_url": thumbnail_url,
    }
