# -*- coding: utf-8 -*-
"""Assemble harness-article-long-running-harness.md from harness-design-guide.md, cap 40000 Unicode chars."""
from pathlib import Path

GUIDE = Path(__file__).with_name("harness-design-guide.md")
OUT = Path(__file__).with_name("harness-article-long-running-harness.md")
MAX_CHARS = 40_000

lines = GUIDE.read_text(encoding="utf-8").splitlines(keepends=True)


def take(a: int, b: int) -> str:
    """1-based inclusive line numbers, same as file display."""
    return "".join(lines[a - 1 : b])


# Order: title block + slices (skip sec 3 huge English; skip sec 9.1+ long code in middle; skip 10.3 code dump)
header = """# 长时 Agentic 编码与 Harness 实践：从 Spec、合同到 Playwright 验收

> 本文由 `harness-design-guide.md` **节录汇编**为可发布技术长文，**与仓库实现冲突时以 `harness-kimi-demo/` 及设计指南原文为准**。

**关键词**：Harness、Planner、Generator、Evaluator、Sprint Contract、Playwright MCP、Context、成本、Kimi CLI、Multi-Epoch

**字符数说明**：成稿使用 Unicode 标量字符数 **≤ 40,000**（与常见「字数」工具一致）；节录在尾部可能截断，完整内容见 `harness-design-guide.md`。

---

## 篇首摘要

用单 Agent 做「多模块、长时间」编码时，**Context anxiety**（越写越散、甚至提前收尾）与 **Self-evaluation bias**（自评偏宽）是两类常见结构性问题。Harness 的应对是：`Planner` 产高层 `spec`；按 Sprint 用 **Contract** 在写码前把验收说死；`Generator` 实现；**独立** `Evaluator` 用 **Playwright** 在真实环境验——把「写」和「验」分开。本文汇编原设计指南中**架构、合同、评分、工件、Context、成本、代码骨架、Demo 环境、Kimi、简化方法论、落地 Checklist、Multi-Epoch 升级**等章节，供一次性通读；**完整 Prompt 英文全文**仍以 `harness-kimi-demo/prompts/templates/` 为真源。

**主要参考**：[Harness design for long-running application development](https://www.anthropic.com/engineering/harness-design-long-running-apps)；[Building Effective Agents](https://www.anthropic.com/research/building-effective-agents)。

---

## 正文（节录自《Harness Design 设计指南》）

"""

# Ranges: (start_line, end_line) 1-based inclusive. Tuned to approach then cap 40000.
RANGES = [
    (60, 158),  # §1–2
    (161, 172),  # 3.1 职责+原则
    (430, 630),  # §4–7（合同、评分、文件、Context）
    (631, 676),  # §8 成本
    (678, 820),  # §9.1 Orchestrator+循环（不含 9.2+ 大段，减体积）
    (1023, 1100),  # §10.1–10.2 环境与目录
    (1639, 1710),  # 10.4+10.5 运行与过程（无大代码块段）
    (1964, 2018),  # 10.8.5–10.8.7 Kimi 与小结
    (2022, 2110),  # §11–12
    (2112, 2189),  # §13–14
    (2192, 2500),  # §15 Multi-Epoch（至约 2.3k 行，脚本再截断）
]

body_parts = [header]
n = len(lines)
for a, b in RANGES:
    a, b = max(1, a), min(b, n)
    if a > b:
        continue
    body_parts.append(take(a, b))

text = "".join(body_parts)
if len(text) > MAX_CHARS:
    text = text[: MAX_CHARS - 220]
    text += "\n\n---\n\n*（已达 40,000 字符上限，此处截断；完整内容见 `harness-design-guide.md`。）*\n"

footer = f"\n\n---\n\n**生成**：`_build_harness_article.py` | **节录源**：`harness-design-guide.md` | **成稿长度**：{len(text)} 字符\n"
text = text + footer

OUT.write_text(text, encoding="utf-8")
print(OUT, "->", len(text), "chars")
