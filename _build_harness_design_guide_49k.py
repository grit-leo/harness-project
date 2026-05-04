#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Build harness-design-guide-49000.md from full guide; long code blocks -> placeholder."""

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SRC = ROOT / "harness-design-guide.md"
OUT = ROOT / "harness-design-guide-49000.md"

# Blocks with more than this many lines (counting newlines in body) become placeholders
MAX_LINES = 32

PREFIX = """\
> **精简版说明（约 4.9 万「字」）**：为控制篇幅，**超过 32 行的** Markdown 代码块与长段原文已替换为下述占位块；**可运行代码、完整英文 System Prompt、逐行示例**仍以同目录下完整版 **`harness-design-guide.md`** 为准。本文件为独立新文档，**不修改**原文件。此处「字」指 **Unicode 码点**（如 Python `len(文本)`）；含中文的 UTF-8 文件在部分环境下 `wc -m` 可能接近字节数，与码点不等价。

---

"""

PATTERN = re.compile(r"```([a-zA-Z0-9]*)\n([\s\S]*?)```")


def replace_block(m: re.Match) -> str:
    lang, body = m.group(1), m.group(2)
    n = body.count("\n") + 1
    if n > MAX_LINES:
        return (
            "\n\n```text\n"
            f"# [已省略长内容，原约 {n} 行。完整版见：harness-design-guide.md 对应章节。]\n"
            "```\n\n"
        )
    return f"```{lang}\n{body}```"


def main() -> None:
    s = SRC.read_text(encoding="utf-8")
    # Insert after first line (title) for readability
    lines = s.splitlines(keepends=True)
    if lines and lines[0].startswith("# "):
        rest = "".join(lines[1:])
        body = lines[0] + PREFIX + rest
    else:
        body = PREFIX + s
    out = PATTERN.sub(replace_block, body)
    OUT.write_text(out, encoding="utf-8")
    nchars = len(out)
    print(f"Wrote {OUT.name}: {nchars} Unicode characters (目标约 49000)")


if __name__ == "__main__":
    main()
