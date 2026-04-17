import re
from html.parser import HTMLParser
from dataclasses import dataclass
from typing import List


@dataclass
class ParsedBookmark:
    url: str
    title: str
    folder: str


class _NetscapeParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.bookmarks: List[ParsedBookmark] = []
        self._folder_stack: List[str] = [""]
        self._current_folder: str = ""
        self._current_tag: str = ""
        self._in_h3 = False
        self._expect_text = False

    def handle_starttag(self, tag: str, attrs: list):
        self._current_tag = tag
        if tag == "dt":
            return
        if tag == "h3":
            self._in_h3 = True
            self._expect_text = True
        if tag == "a":
            self._expect_text = True
            attr_dict = dict(attrs)
            href = attr_dict.get("href", "")
            title = attr_dict.get("title", "")
            self._pending = {"url": href, "title": title}
        if tag == "dl":
            # entering a new folder level
            self._folder_stack.append(self._current_folder)

    def handle_endtag(self, tag: str):
        if tag == "dl":
            if len(self._folder_stack) > 1:
                self._folder_stack.pop()
            self._current_folder = self._folder_stack[-1]
        if tag == "h3":
            self._in_h3 = False
        if tag == "a":
            self._expect_text = False
            if hasattr(self, "_pending") and self._pending.get("url"):
                folder = self._current_folder
                title = self._pending.get("title", "")
                self.bookmarks.append(
                    ParsedBookmark(
                        url=self._pending["url"],
                        title=title,
                        folder=folder,
                    )
                )
            self._pending = {}

    def handle_data(self, data: str):
        if self._expect_text:
            text = data.strip()
            if self._in_h3:
                self._current_folder = text
                self._folder_stack[-1] = text
            elif self._current_tag == "a" and hasattr(self, "_pending"):
                self._pending["title"] = text


def parse_netscape_html(html: str) -> List[ParsedBookmark]:
    parser = _NetscapeParser()
    parser.feed(html)
    return parser.bookmarks
