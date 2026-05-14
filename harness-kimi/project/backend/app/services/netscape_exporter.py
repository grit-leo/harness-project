from datetime import datetime, timezone
from typing import List


def _escape_html(text: str) -> str:
    return (
        text.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
    )


def bookmarks_to_netscape_html(bookmarks: List[dict]) -> str:
    now = int(datetime.now(timezone.utc).timestamp())
    lines = [
        "<!DOCTYPE NETSCAPE-Bookmark-file-1>",
        '<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">',
        "<TITLE>Bookmarks</TITLE>",
        "<H1>Bookmarks</H1>",
        "<DL><p>",
    ]

    # Group by first tag as folder, or "Uncategorized"
    folders: dict = {}
    for bm in bookmarks:
        tags = bm.get("tags", []) or []
        folder = tags[0] if tags else "Uncategorized"
        folders.setdefault(folder, []).append(bm)

    for folder, items in sorted(folders.items()):
        folder_escaped = _escape_html(folder)
        lines.append(f'    <DT><H3 ADD_DATE="{now}">{folder_escaped}</H3>')
        lines.append("    <DL><p>")
        for bm in items:
            url = _escape_html(bm.get("url", ""))
            title = _escape_html(bm.get("title", ""))
            created = bm.get("created_at")
            add_date = ""
            if created:
                if isinstance(created, datetime):
                    add_date = str(int(created.timestamp()))
                else:
                    try:
                        add_date = str(int(datetime.fromisoformat(str(created)).timestamp()))
                    except Exception:
                        add_date = str(now)
            else:
                add_date = str(now)
            lines.append(
                f'        <DT><A HREF="{url}" ADD_DATE="{add_date}">{title}</A>'
            )
        lines.append("    </DL><p>")

    lines.append("</DL><p>")
    return "\n".join(lines) + "\n"
