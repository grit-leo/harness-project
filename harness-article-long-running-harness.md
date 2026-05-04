# 长时 Agentic 编码与 Harness 实践：从 Spec、合同到 Playwright 验收

> 本文由 `harness-design-guide.md` **节录汇编**为可发布技术长文，**与仓库实现冲突时以 `harness-kimi-demo/` 及设计指南原文为准**。

**关键词**：Harness、Planner、Generator、Evaluator、Sprint Contract、Playwright MCP、Context、成本、Kimi CLI、Multi-Epoch

**字符数说明**：成稿使用 Unicode 标量字符数 **≤ 40,000**（与常见「字数」工具一致）；节录在尾部可能截断，完整内容见 `harness-design-guide.md`。

---

## 篇首摘要

用单 Agent 做「多模块、长时间」编码时，**Context anxiety**（越写越散、甚至提前收尾）与 **Self-evaluation bias**（自评偏宽）是两类常见结构性问题。Harness 的应对是：`Planner` 产高层 `spec`；按 Sprint 用 **Contract** 在写码前把验收说死；`Generator` 实现；**独立** `Evaluator` 用 **Playwright** 在真实环境验——把「写」和「验」分开。本文汇编原设计指南中**架构、合同、评分、工件、Context、成本、代码骨架、Demo 环境、Kimi、简化方法论、落地 Checklist、Multi-Epoch 升级**等章节，供一次性通读；**完整 Prompt 英文全文**仍以 `harness-kimi-demo/prompts/templates/` 为真源。

**主要参考**：[Harness design for long-running application development](https://www.anthropic.com/engineering/harness-design-long-running-apps)；[Building Effective Agents](https://www.anthropic.com/research/building-effective-agents)。

---

## 正文（节录自《Harness Design 设计指南》）

## 1. 背景与核心问题

### 1.1 为什么 Naive 实现不够

Anthropic 的实验表明，直接让单个 Agent 完成复杂的长时间编码任务时，存在两个系统性失败模式：

**失败模式一：Context Anxiety（上下文焦虑）**

模型在上下文窗口逐渐填满时会丧失连贯性。部分模型（如 Sonnet 4.5）还会在认为接近上下文上限时过早收尾工作，即便实际任务远未完成。

- **Compaction（压缩）**：将早期对话摘要后缩短历史，让同一个 Agent 继续。保留了连续性，但不能给模型一个"干净的开始"，context anxiety 可能持续。
- **Context Reset（上下文重置）**：完全清空上下文窗口、启动新 Agent，通过结构化的 handoff artifact 传递前一个 Agent 的状态和下一步计划。代价是增加了编排复杂度和 token 开销。

在 Anthropic 的早期测试中，Sonnet 4.5 的 context anxiety 严重到仅靠 compaction 不够，必须使用 context reset。而 Opus 4.5/4.6 级别的模型则可以仅靠 compaction 正常运行长任务。

**失败模式二：Self-Evaluation Bias（自我评估偏差）**

当模型被要求评估自己产出的工作时，倾向于自信地给出好评——即使在人类观察者看来质量明显平庸。这在前端设计等主观任务上尤为突出，但即使在有可验证结果的任务上也会出现。

核心洞察：**将"做事的 Agent"和"评判的 Agent"分离**是解决这个问题的有效杠杆。独立的 Evaluator 虽然仍然是 LLM，天然倾向宽容，但"调教一个独立的 Evaluator 变得严格"远比"让 Generator 批评自己的工作"更加可行。

### 1.2 GAN 启发的多 Agent 架构

受 GAN（Generative Adversarial Networks）启发，Anthropic 设计了多 Agent 结构：

- 在**前端设计**场景中：Generator + Evaluator 两个 Agent 形成对抗循环
- 在**全栈应用**场景中：扩展为 Planner + Generator + Evaluator 三 Agent 架构

这种架构在两个截然不同的领域都验证有效：一个由主观品味定义（前端设计），另一个由可验证的正确性和可用性定义（全栈开发）。

---

## 2. 总体架构设计

### 2.1 系统架构图

```
┌───────────────────────────────────────────────────────────┐
│                      Orchestrator                         │
│         状态机 + Agent 调度 + 文件通信 + 成本控制            │
│                                                           │
│  ┌─────────┐    ┌──────────────┐    ┌──────────────────┐  │
│  │ Planner │───>│  Generator   │<──>│    Evaluator     │  │
│  │  Agent  │    │    Agent     │    │      Agent       │  │
│  │         │    │ (Sprint N)   │    │ (Playwright MCP) │  │
│  └─────────┘    └──────────────┘    └──────────────────┘  │
│       │                │                     │            │
│       v                v                     v            │
│  ┌────────────────────────────────────────────────────┐   │
│  │              Shared Artifacts Layer                 │   │
│  │  spec.md | sprint-contract.md | qa-report.md | git │   │
│  └────────────────────────────────────────────────────┘   │
└───────────────────────────────────────────────────────────┘
```

### 2.2 流程概览

```
用户 Prompt (1-4 句话)
        │
        v
   ┌─────────┐
   │ Planner │──> 完整产品 Spec (spec.md)
   └─────────┘
        │
        v
  ┌─────────────────────────────────────────┐
  │          Sprint 循环 (Sprint 1..N)       │
  │                                         │
  │  1. Generator 提出 Sprint Contract      │
  │  2. Evaluator 审核 Contract             │
  │  3. 协商直到达成一致                      │
  │  4. Generator 按 Contract 实现          │
  │  5. Generator 自我检查后提交             │
  │  6. Evaluator 用 Playwright 测试        │
  │  7. 评分 + Bug 报告                     │
  │  8. 若未通过 → 反馈给 Generator 修复     │
  │  9. 若通过 → 进入下一个 Sprint           │
  └─────────────────────────────────────────┘
        │
        v
   最终应用产出
```

### 2.3 推荐技术栈


| 层级        | 推荐技术                        | 说明                             |
| --------- | --------------------------- | ------------------------------ |
| Agent 编排  | Claude Agent SDK (Python)   | 原文直接使用，内置 compaction 机制        |
| 前端生成目标    | React + Vite                | 原文验证过的组合                       |
| 后端生成目标    | FastAPI + SQLite/PostgreSQL | 原文验证过的组合                       |
| E2E 测试    | Playwright MCP              | Evaluator 通过 Playwright 实际操作页面 |
| 版本控制      | Git                         | 每个 Sprint 产出一个 commit          |
| Agent 间通信 | 文件系统 (Shared Artifacts)     | 简单可靠，支持断点续跑和事后审计               |


---

### 3.1 Planner Agent

**职责**：将用户 1-4 句话的简短 Prompt 扩展为完整的产品规格文档。

**设计原则（来自原文实验）**：

1. **对 scope 保持雄心**——主动超越用户提示的字面意义，做比 solo agent 更丰富的产品设计
2. **聚焦产品上下文和高层技术设计**，不写粒度过细的技术实现细节
3. **原因**：如果 Planner 在前期就指定了具体的技术细节且有错误，这些错误会级联放大到下游实现中。更明智的做法是约束"交付物"而非"路径"
4. **主动寻找嵌入 AI 功能的机会**——让生成的应用包含 AI 辅助特性
5. **包含视觉设计方向**——颜色、字体、布局原则、整体风格调性

### 4.1 为什么需要 Sprint Contract

产品 Spec 故意保持高层（避免前期技术细节错误级联）。Sprint Contract 弥补了 Spec 与具体实现之间的鸿沟：在写代码之前，Generator 和 Evaluator 先就"什么算完成"达成一致。

### 4.2 协商流程

```
Generator                                    Evaluator
    │                                            │
    │  写 sprint-{n}-contract-draft.md           │
    │  (要建什么 + 怎么验证)                      │
    │ ────────────────────────────────────────>   │
    │                                            │
    │                                            │  审核 draft
    │                                            │  写 sprint-{n}-contract-review.md
    │   <────────────────────────────────────── │
    │                                            │
    │  若 NEEDS_REVISION:                        │
    │  修改后重新提交 draft                       │
    │ ────────────────────────────────────────>   │
    │          ... (最多 3 轮) ...                │
    │                                            │
    │  若 APPROVED:                              │
    │  产出 sprint-{n}-contract-final.md         │
    │                                            │
```

### 4.3 Contract Draft 模板 (Generator 产出)

```text
# Sprint {N} Contract Draft

## Scope
[What will be built in this sprint — specific components, pages, APIs]

## Features & Implementation Plan
### Feature A: {Name}
- Implementation approach: [brief technical plan]
- UI components: [list]
- API endpoints: [list]
- Data model changes: [list]

## Testable Acceptance Criteria
1. [Criterion 1 — must be binary PASS/FAIL, with clear definition of "done"]
2. [Criterion 2]
3. ...

## Out of Scope
[What is explicitly NOT included in this sprint]

## Dependencies
[What must already exist for this sprint to succeed]
```

### 4.4 Contract Review 模板 (Evaluator 产出)

```text
# Sprint {N} Contract Review

## Verdict: APPROVED / NEEDS_REVISION

## Criteria Assessment
- [Criterion 1]: OK / Too vague — suggest: "..."
- [Criterion 2]: Missing — the spec requires X but the contract doesn't cover it

## Gaps Between Spec and Contract
- [Gap 1]: Spec Feature Y is scheduled for this sprint but not in the contract
- [Gap 2]: ...

## Criteria That Are Not Testable
- [Criterion N]: "looks good" is not testable. Suggest: "user can click X
  and see Y within 2 seconds"

## Suggested Additions
- Add criterion for: [specific behavior]
```

### 4.5 实际效果参考

原文案例中，单个 Sprint（Sprint 3，Level Editor）的合同包含了 **27 条**验收标准。Evaluator 的发现足够具体，开发者无需额外调查即可行动。

---

## 5. 评分标准体系

### 5.1 全栈应用评分标准

用于 Evaluator 评估每个 Sprint 的产出质量。


| 维度                | 权重  | 及格线 (1-10) | 评判标准                                                                     |
| ----------------- | --- | ---------- | ------------------------------------------------------------------------ |
| **Product Depth** | 30% | 6          | 实现是否有真正的深度？功能是否完全可交互、边界情况是否处理、状态是否正确持久化？还是只有表面 UI 但实际不工作？                |
| **Functionality** | 25% | 7          | 用户能否不碰到 bug 地完成核心流程？每个交互元素都要测试。点每个按钮、提交每个表单。一个看起来对但交互时崩溃的 feature 得 0 分。 |
| **Visual Design** | 25% | 5          | 应用是否有连贯的视觉 identity？配色方案、字体层次、有意识的布局？还是默认库样式、通用 AI 风格、间距不一致？             |
| **Code Quality**  | 20% | 5          | 代码是否可维护、结构合理？错误处理是否完善、是否有死代码、文件组织是否合理？                                   |


**规则**：任意维度低于及格线 → Sprint 整体 FAIL，必须返回 Generator 修复。

### 5.2 前端设计评分标准

用于前端设计场景的 Generator-Evaluator 循环。与全栈标准不同，这套标准专门优化设计品质。


| 维度                 | 权重  | 评判标准                                                                                        |
| ------------------ | --- | ------------------------------------------------------------------------------------------- |
| **Design Quality** | 35% | 设计是否感觉像一个连贯的整体，而非零件的拼凑？颜色、字体、布局、图像等细节是否结合成独特的情绪和 identity？                                  |
| **Originality**    | 30% | 是否有自定义的设计决策证据？还是模板布局、库默认值、AI 生成模式？人类设计师能否识别出刻意的创意选择？未修改的库组件、AI 生成的典型模式（如紫色渐变覆盖白卡片）在这里得 0 分。 |
| **Craft**          | 20% | 技术执行：字体层次、间距一致性、色彩和谐、对比度。这是能力检查而非创意检查。大多数合理实现默认就能通过；不通过意味着基础功有问题。                           |
| **Functionality**  | 15% | 独立于美学的可用性。用户能否理解界面的功能、找到主要操作、不用猜测就能完成任务？                                                    |


**关键洞察**：Design Quality 和 Originality 给高权重，因为模型默认在 Craft 和 Functionality 上表现尚可，但在设计质量和原创性上通常产出平庸。高权重推动模型进行更多审美冒险。

**校准方法**：使用 Few-Shot 示例（带详细分数分解）校准 Evaluator，确保其判断与设计者偏好对齐，减少迭代中的分数漂移。

---

## 6. 文件通信协议

### 6.1 目录结构

Agent 之间通过文件系统通信。每个文件自包含，新 Agent 读一个文件即可理解上下文。

```
artifacts/
├── spec.md                          # Planner 输出 — 完整产品规格
├── sprint-1-contract-draft.md       # Generator 提出的 Sprint 1 合同草案
├── sprint-1-contract-review.md      # Evaluator 对草案的审核意见
├── sprint-1-contract-final.md       # 协商后的最终合同
├── sprint-1-handoff.md              # Generator 完成后的交付报告
├── sprint-1-qa-round-1.md           # Evaluator 第 1 轮 QA 报告
├── sprint-1-qa-round-2.md           # Evaluator 第 2 轮 QA 报告（如有）
├── sprint-2-contract-draft.md       # Sprint 2 开始...
├── sprint-2-contract-review.md
├── sprint-2-contract-final.md
├── sprint-2-handoff.md
├── sprint-2-qa-round-1.md
├── ...
└── final-report.md                  # 全部完成后的整体总结

project/
├── frontend/                        # React + Vite 项目
│   ├── src/
│   ├── package.json
│   └── ...
├── backend/                         # FastAPI 项目
│   ├── main.py
│   ├── requirements.txt
│   └── ...
├── .git/                            # Git 版本控制
└── README.md
```

### 6.2 设计原则


| 原则        | 说明                                         |
| --------- | ------------------------------------------ |
| 文件名编码阶段信息 | `sprint-{N}-{type}-round-{R}.md` 使每个文件可自解释 |
| 每个文件自包含   | 新 Agent 读一个文件就能理解全部上下文，不依赖对话历史             |
| 文件而非内存通信  | 支持断点续跑——进程崩溃后可以从最新的 artifact 恢复            |
| 不可变性      | 已写入的 artifact 不应被覆盖。新版本用新文件名（如 round-2）    |
| 可审计性      | 事后可以完整追溯每个 Sprint 的决策链：合同 → 实现 → 测试 → 修复   |


---

## 7. Context 管理策略

### 7.1 策略对比


| 策略                | 工作方式                                       | 优势                   | 劣势                              | 适用场景                        |
| ----------------- | ------------------------------------------ | -------------------- | ------------------------------- | --------------------------- |
| **Compaction**    | SDK 自动将早期对话摘要压缩                            | 简单、无需额外编排            | 不提供"干净的开始"，context anxiety 可能残留 | 强模型 (Opus 4.5+)             |
| **Context Reset** | 完全清空上下文、启动新 Agent、通过 handoff artifact 传递状态 | 彻底消除 context anxiety | 增加编排复杂度、token 开销、延迟             | 弱模型 / context anxiety 严重的模型 |
| **Sprint 分解**     | 将工作拆分为独立的 Sprint，每个 Sprint 有独立的合同和验收       | 降低单次任务复杂度            | 增加总时间和成本                        | 任务复杂度超出模型单次承受力时             |


### 7.2 选择决策树

```
模型是否出现 Context Anxiety？
├── 是 → 使用 Context Reset + Sprint 分解
│        (Sonnet 4.5 及更弱的模型)
└── 否
    ├── 任务复杂度高（>10 个 Feature）？
    │   ├── 是 → 使用 Compaction + Sprint 分解
    │   └── 否 → 仅使用 Compaction，不做 Sprint 分解
    └── (Opus 4.5+ 级别的模型)
```

### 7.3 原文验证结论

- **Opus 4.5**：context anxiety 大幅减弱，可以去掉 context reset，只用 compaction + sprint 分解
- **Opus 4.6**：进一步提升，可以去掉 sprint 分解，Generator 连续工作 2+ 小时仍保持连贯

---

## 8. 成本控制与监控

### 8.1 原文成本参考


| Harness 版本       | Prompt           | 模型       | 时长          | 成本      |
| ---------------- | ---------------- | -------- | ----------- | ------- |
| Solo (无 Harness) | Retro Game Maker | Opus 4.5 | 20 min      | $9      |
| V1 Full Harness  | Retro Game Maker | Opus 4.5 | 6 hr        | $200    |
| V2 Simplified    | DAW (数字音频工作站)    | Opus 4.6 | 3 hr 50 min | $124.70 |


**V2 Harness 各阶段成本明细**：


| Agent & Phase   | Duration        | Cost        |
| --------------- | --------------- | ----------- |
| Planner         | 4.7 min         | $0.46       |
| Build (Round 1) | 2 hr 7 min      | $71.08      |
| QA (Round 1)    | 8.8 min         | $3.24       |
| Build (Round 2) | 1 hr 2 min      | $36.89      |
| QA (Round 2)    | 6.8 min         | $3.09       |
| Build (Round 3) | 10.9 min        | $5.88       |
| QA (Round 3)    | 9.6 min         | $4.06       |
| **Total**       | **3 hr 50 min** | **$124.70** |


**观察**：

- Planner 成本极低（<$1），价值极高（决定了整个 Spec 的质量）
- Build 阶段占总成本的 ~91%
- QA 阶段成本相对低（~$10），但对最终质量的提升显著

### 8.2 成本控制策略


| 策略            | 说明                                |
| ------------- | --------------------------------- |
| 设置总预算上限       | 每次运行设置 $200 hard cap，到达 90% 时发出警告 |
| QA 轮次上限       | 每个 Sprint 最多 3 轮 QA，避免无限循环        |
| Sprint 合同范围控制 | 合同协商时控制单 Sprint 的范围，防止范围膨胀        |
| 实时监控 token 消耗 | 每次 API 调用后累计，按阶段分类记录              |
| 渐进式 scope 削减  | 如果预算紧张，后期 Sprint 可以缩减范围           |


---
## 9. 代码骨架实现

以下为基于 Claude Agent SDK (Python) 的完整代码骨架，可直接作为项目起点。

### 9.1 Orchestrator

```python
import asyncio
import json
import time
from pathlib import Path
from dataclasses import dataclass, field
from enum import Enum
from typing import Optional


class HarnessPhase(Enum):
    PLANNING = "planning"
    SPRINT_CONTRACT = "sprint_contract"
    BUILDING = "building"
    QA = "qa"
    QA_FIX = "qa_fix"
    COMPLETE = "complete"


@dataclass
class HarnessState:
    phase: HarnessPhase = HarnessPhase.PLANNING
    current_sprint: int = 0
    total_sprints: int = 0
    qa_round: int = 0
    max_qa_rounds: int = 3
    artifacts_dir: Path = field(default_factory=lambda: Path("./artifacts"))
    project_dir: Path = field(default_factory=lambda: Path("./project"))
    cost_total: float = 0.0
    cost_limit: float = 200.0

    def save(self, path: Optional[Path] = None):
        target = path or self.artifacts_dir / "harness-state.json"
        data = {
            "phase": self.phase.value,
            "current_sprint": self.current_sprint,
            "total_sprints": self.total_sprints,
            "qa_round": self.qa_round,
            "cost_total": self.cost_total,
        }
        target.write_text(json.dumps(data, indent=2))

    @classmethod
    def load(cls, path: Path) -> "HarnessState":
        data = json.loads(path.read_text())
        state = cls()
        state.phase = HarnessPhase(data["phase"])
        state.current_sprint = data["current_sprint"]
        state.total_sprints = data["total_sprints"]
        state.qa_round = data["qa_round"]
        state.cost_total = data["cost_total"]
        return state


class Orchestrator:
    def __init__(self, user_prompt: str, state: Optional[HarnessState] = None):
        self.user_prompt = user_prompt
        self.state = state or HarnessState()
        self.cost_tracker = CostTracker(budget=self.state.cost_limit)
        self._ensure_dirs()

    def _ensure_dirs(self):
        self.state.artifacts_dir.mkdir(parents=True, exist_ok=True)
        self.state.project_dir.mkdir(parents=True, exist_ok=True)

    async def run(self):
        """Main harness execution loop."""
        # Phase 1: Planning
        self.state.phase = HarnessPhase.PLANNING
        spec = await self._run_planner()
        sprints = self._parse_sprints(spec)
        self.state.total_sprints = len(sprints)
        self.state.save()

        # Phase 2: Sprint loop
        for i, sprint_spec in enumerate(sprints):
            self.state.current_sprint = i + 1
            self.state.qa_round = 0
            print(f"\n{'='*60}")
            print(f"  SPRINT {i+1}/{len(sprints)}")
            print(f"{'='*60}\n")

            # 2a: Contract negotiation
            self.state.phase = HarnessPhase.SPRINT_CONTRACT
            contract = await self._negotiate_contract(sprint_spec)

            # 2b: Build
            self.state.phase = HarnessPhase.BUILDING
            await self._run_generator(contract)

            # 2c: QA loop
            passed = False
            while not passed and self.state.qa_round < self.state.max_qa_rounds:
                self.state.qa_round += 1
                self.state.phase = HarnessPhase.QA
                qa_result = await self._run_evaluator(contract)

                if qa_result["passed"]:
                    passed = True
                    print(f"  Sprint {i+1} PASSED on QA round {self.state.qa_round}")
                else:
                    print(f"  Sprint {i+1} FAILED QA round {self.state.qa_round}")
                    self.state.phase = HarnessPhase.QA_FIX
                    await self._run_generator_fix(qa_result["feedback"])

            self.state.save()

            if self.cost_tracker.over_budget():
                print(f"\n  BUDGET LIMIT REACHED (${self.cost_tracker.spent:.2f})")
                break

        self.state.phase = HarnessPhase.COMPLETE
        self.state.save()
        self._print_summary()

    async def _run_planner(self) -> str:
        """Run the Planner agent to expand user prompt into full spec."""
        # Implementation: call Claude Agent SDK with PLANNER_SYSTEM_PROMPT
        # Write output to artifacts/spec.md
        # Return spec content
        raise NotImplementedError("Implement with Claude Agent SDK")

    def _parse_sprints(self, spec: str) -> list[str]:
        """Parse the spec to extract individual sprint definitions."""
        raise NotImplementedError("Parse sprint sections from spec.md")

    async def _negotiate_contract(self, sprint_spec: str) -> str:
        """Generator proposes, Evaluator reviews, iterate until agreed."""
        n = self.state.current_sprint
        for attempt in range(3):
            # Generator writes draft
            draft_path = self.state.artifacts_dir / f"sprint-{n}-contract-draft.md"
            await self._call_generator_contract_proposal(sprint_spec, draft_path)

            # Evaluator reviews
            review_path = self.state.artifacts_dir / f"sprint-{n}-contract-review.md"
            review = await self._call_evaluator_contract_review(draft_path, review_path)
## 10. Demo: 从零运行一个完整项目

本节以 **"Build a personal bookmark manager with tagging and search"（个人书签管理器）** 为 Demo Prompt，从环境搭建到运行产出，完整展示 Harness 的实际运行过程。

> 选择书签管理器作为 Demo 是因为它复杂度适中（前后端 + 数据库 + 搜索），单次运行预计 1-2 小时、$30-60 成本，适合作为首次验证。

### 10.1 环境准备

**Step 1: 系统依赖**

```bash
# Python 3.10+
python3 --version  # 确认 >= 3.10

# Node.js 20+ (Playwright MCP 需要)
node --version     # 确认 >= 20

# Git
git --version
```

**Step 2: 安装 Claude Agent SDK**

```bash
pip install claude-agent-sdk
```

**Step 3: 安装 Playwright MCP**

```bash
npm install -g @playwright/mcp@latest
```

**Step 4: 设置 API Key**

```bash
export ANTHROPIC_API_KEY="sk-ant-..."
```

你也可以把它写入 `~/.bashrc` 或 `~/.zshrc` 以持久化。

**Step 5: 验证安装**

```bash
python3 -c "from claude_agent_sdk import query; print('SDK OK')"
npx @playwright/mcp --help
```

### 10.2 项目结构

创建如下目录结构作为 Harness 工程：

```bash
mkdir -p ~/harness-demo && cd ~/harness-demo
mkdir -p artifacts project
```

最终的目录布局：

```
~/harness-demo/
├── main.py                  # 入口：Orchestrator + 运行脚本
├── prompts.py               # 所有 Agent 的 System Prompt
├── agents.py                # Planner / Generator / Evaluator 的调用封装
├── cost_tracker.py          # 成本追踪
├── artifacts/               # Agent 间通信的文件 (运行时自动生成)
│   ├── spec.md
│   ├── sprint-1-contract-draft.md
│   ├── sprint-1-contract-final.md
│   ├── sprint-1-handoff.md
│   ├── sprint-1-qa-round-1.md
│   └── ...
└── project/                 # Generator 产出的应用代码 (运行时自动生成)
    ├── frontend/
    ├── backend/
    └── .git/
```

### 10.4 运行 Demo

**Quick Start — 4 条命令启动：**

```bash
# 1. 进入项目目录
cd ~/harness-demo

# 2. 确认 API Key 已设置
echo $ANTHROPIC_API_KEY

# 3. 使用默认 Prompt (书签管理器) 运行
python3 main.py

# 或者: 自定义 Prompt
python3 main.py "Build a kanban board with drag-and-drop and real-time collaboration"
```

**运行时你会看到类似以下的控制台输出：**

```
  Harness starting...
  Prompt: Build a personal bookmark manager with tagging, full-text search, ...
  Budget: $100.00

============================================================
  PHASE 1: PLANNING
============================================================

[PLANNER] Generating product specification...
[PLANNER] Spec written to artifacts/spec.md (8234 chars)

  Planner produced 5 sprints

============================================================
  SPRINT 1/5
============================================================

[CONTRACT] Negotiating Sprint 1 contract...
[CONTRACT] Approved on round 1

[GENERATOR] Sprint 1 — build...
[GENERATOR] Sprint 1 build complete

[EVALUATOR] Sprint 1, QA round 1...
[EVALUATOR] Verdict: FAIL

  Sprint 1 FAILED (QA round 1)

[GENERATOR] Sprint 1 — fix...
[GENERATOR] Sprint 1 fix complete

[EVALUATOR] Sprint 1, QA round 2...
[EVALUATOR] Verdict: PASS

  Sprint 1 PASSED (QA round 2)

============================================================
  SPRINT 2/5
============================================================
...
```

### 10.5 运行过程详解

以书签管理器为例，一次典型运行的时间线如下：

```
时间线 (大约)
─────────────────────────────────────────────────────────
 0:00   Planner 启动
 0:05   Planner 完成 → spec.md (5-8 个 Sprint, 10+ Feature)
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": ["-y", "@playwright/mcp@latest", "--isolated"]
    }
  }
}
```

若出现 **「Browser is already in use for … mcp-chrome-…」**，通常是因为多个 MCP / Kimi 会话共用同一磁盘上的浏览器 profile。解决办法：**在 `args` 末尾加上 `--isolated`**（内存隔离会话，不抢同一 profile），或确保同一时刻只跑一个 Playwright MCP、并在新会话前结束残留 `playwright-mcp` / Chromium 进程。本仓库的 `harness-kimi-demo/config/playwright-mcp-isolated.json` 已按此方式配置，并由 `run-harness-full.sh` 在 Evaluator / Reviewer 阶段通过 `--mcp-config-file` 引用。

配置好后，在 Evaluator 阶段的 Prompt 中明确要求：**使用 Playwright MCP 打开 `http://localhost:5173`（及 API 根路径），按 contract 逐条验收**，并把报告写入 `artifacts/sprint-N-qa-round-R.md`。

#### 10.8.5 示例：与 10.2 相同目录下的 Shell 编排

在 `~/harness-kimi-demo` 中准备 `prompts/` 与空目录 `artifacts/`、`project/`，然后：

```bash
#!/usr/bin/env bash
# run-harness-kimi.sh — 分阶段调用 Kimi（Print 模式）
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"
mkdir -p artifacts project prompts

export USER_GOAL="${1:-Build a personal bookmark manager with tagging and search.}"

# Phase 1: Planner → artifacts/spec.md
kimi --print -w "$ROOT" -p "You are the Planner agent. User goal: ${USER_GOAL}
Write the full product spec to artifacts/spec.md following the structure in this document's §3.1 (Overview, Design Language, Sprints, Technical Architecture)."

# Phase 2+: 对每个 Sprint，先合同再实现再 QA（此处用占位；实际应把 Sprint 列表拆成多次调用或用手工确认 spec 中的 Sprint 数）
# kimi --print -w "$ROOT" -p "$(cat prompts/sprint1-contract.txt)"
# ...

echo "Done. Review artifacts/spec.md and continue sprints manually or extend this script."
```

生产使用时应把 **每个 Phase 的 Prompt** 拆成独立文件（便于版本管理与复测），并在 Phase 之间用 `test -f artifacts/spec.md` 等做简单门禁。

#### 10.8.6 Web UI（可选）

需要图形界面会话管理时：

```bash
kimi web
```

浏览器中操作与终端会话等价，仍建议 **工作目录** 选到 harness 根目录，以便相对路径与 `artifacts/` 一致。

#### 10.8.7 小结

- **同一套 Harness 设计**（文件 handoff、合同、QA）可直接用在 Kimi Coding 上；差异主要在 **编排器从 Python 换成 `kimi` + shell**。
- **快速验证**：`kimi --print -w <root> -p "..."` 分阶段执行；**长任务**：`--max-ralph-iterations` + 明确 `STOP` 结束条件。
- **Evaluator**：务必配置 **Playwright MCP**，并在 Prompt 中锁定**可访问的本地 URL**（需先在另一终端启动前后端）。
## 11. 迭代简化方法论

### 11.1 核心原则

> "Every component in a harness encodes an assumption about what the model can't do on its own, and those assumptions are worth stress testing."
>
> "Find the simplest solution possible, and only increase complexity when needed."
>
> — Anthropic, Building Effective Agents

Harness 的每个组件都编码了对模型能力的一个假设。这些假设可能本身就不成立，也可能随着模型升级而过时。

### 11.2 方法论：逐个移除组件

**错误做法**：一次性大幅削减 harness → 无法分辨哪些组件是承重的

**正确做法**：

```
1. 运行完整 Harness → 记录基线质量和成本
2. 移除一个组件（仅一个）
3. 用相同 Prompt 重新运行
4. 对比输出质量：
   ├── 质量基本不变 → 该组件是冗余的，永久移除
   └── 质量明显下降 → 该组件是承重的，保留
5. 重复 Step 2-4，直到每个组件都被测试过
6. 新模型发布后，从 Step 1 重新开始
```

### 11.3 V1 → V2 演进实例


| 组件            | V1 (Opus 4.5) | V2 (Opus 4.6)     | 变化原因                                   |
| ------------- | ------------- | ----------------- | -------------------------------------- |
| Sprint 分解     | 必须            | **移除**            | Opus 4.6 原生支持 2+ 小时连续连贯工作              |
| Context Reset | 必须            | **改为 Compaction** | Opus 4.6 无明显 context anxiety           |
| 每 Sprint QA   | 必须            | **改为构建后统一 QA**    | 模型能力提升，Sprint 内质量已足够                   |
| Planner       | 有             | **保留**            | 无 Planner 时 Generator 自行规划的 scope 明显不足 |
| Evaluator     | 有             | **保留**            | 仍然捕获到真实 bug（stub 功能、缺失交互等）             |


### 11.4 Evaluator 的动态价值判断

> "The evaluator is not a fixed yes-or-no decision. It is worth the cost when the task sits beyond what the current model does reliably solo."

Evaluator 的价值取决于任务复杂度相对于模型能力的位置：

- 任务在模型能力边界**内** → Evaluator 是不必要的开销
- 任务在模型能力边界**上** → Evaluator 提供显著的质量提升
- 模型升级 → 边界外移 → 之前需要 Evaluator 的任务可能不再需要

---

## 12. 实战效果参考

### 12.1 Retro Game Maker 对比


| 维度            | Solo Agent (无 Harness) | Full Harness                    |
| ------------- | ---------------------- | ------------------------------- |
| 运行时长          | 20 分钟                  | 6 小时                            |
| 成本            | $9                     | $200                            |
| Feature 数量    | 基础 4 个                 | 16 个 Feature / 10 个 Sprint      |
| Level Editor  | 布局浪费空间，固定高度面板          | 画布占满视口，面板大小合理                   |
| Sprite Editor | 基本可用                   | 更丰富的工具面板、更好的颜色选择器和缩放控制          |
| Play Mode     | **核心功能损坏**——实体不响应输入    | **核心功能正常**——可以控制角色、进行游戏         |
| AI 集成         | 无                      | 内置 Claude 集成，支持通过 Prompt 生成游戏内容 |
| 视觉一致性         | 默认样式，无明确 identity      | 一致的视觉 identity，跟随 Spec 的设计方向    |


### 12.2 DAW (数字音频工作站) 结果

使用 V2 简化版 Harness + Opus 4.6：

- **可工作的功能**：arrangement view、mixer、transport、Web Audio API 集成
- **AI Agent 集成**：内置 AI 可以设置 tempo 和调性、创建旋律、构建鼓轨、调整混音、添加混响
- **QA 捕获的问题示例**：
  - Clip 无法在 timeline 上拖拽/移动
  - 没有乐器 UI 面板（合成器旋钮、鼓垫）
  - 音频录制仍是 stub（按钮可切换但无麦克风捕获）
  - 效果可视化是数字滑块而非图形化（无 EQ 曲线）

### 12.3 前端设计迭代效果

- Generator 在迭代过程中逐步偏离默认模板，产出更有个性的设计
- 在荷兰美术馆网站的案例中，第 10 轮迭代时 Generator 自发放弃了传统页面布局，重新设计为 3D 空间体验：CSS 透视渲染的棋盘地板、墙上自由排列的艺术作品、以门廊进行画廊间导航
- 即便在第 1 轮迭代，有评分标准的输出也明显优于无任何 prompting 的基线

---
## 13. 实施 Checklist


| #   | 阶段           | 任务                                             | 产出物                                  | 预计耗时  | 关键依赖                  |
| --- | ------------ | ---------------------------------------------- | ------------------------------------ | ----- | --------------------- |
| 1   | 基础设施搭建       | Orchestrator 状态机 + 文件通信 + 成本监控                 | `orchestrator.py`, `cost_tracker.py` | 1-2 天 | Claude Agent SDK 安装   |
| 2   | Planner 开发   | 编写 Planner System Prompt + 测试 Spec 质量          | `planner.py`, 测试产出的 spec.md          | 0.5 天 | Step 1                |
| 3   | Generator 开发 | 编写 Generator System Prompt + 集成 Git + Shell    | `generator.py`                       | 1 天   | Step 1                |
| 4   | Evaluator 开发 | 编写 Evaluator System Prompt + 集成 Playwright MCP | `evaluator.py`                       | 1 天   | Step 1, Playwright 安装 |
| 5   | Contract 协商  | 实现 Generator-Evaluator 合同协商循环                  | 协商逻辑集成到 Orchestrator                 | 0.5 天 | Step 3, 4             |
| 6   | 集成测试         | 端到端跑一个简单 Prompt（如 "Build a todo app"）          | 完整运行日志 + 产出应用                        | 1 天   | Step 1-5              |
| 7   | Evaluator 校准 | 阅读 QA 日志 → 找不一致 → 更新 Prompt → 重跑 (3-5 轮)       | 校准后的 Evaluator Prompt                | 2-3 天 | Step 6                |
| 8   | 复杂任务验证       | 跑复杂 Prompt（如 Game Maker / DAW）                 | 质量评估报告 + 成本报告                        | 1-2 天 | Step 7                |
| 9   | Harness 简化   | 逐个移除组件，对比质量影响，精简 Harness                       | 简化后的 Harness + 对比数据                  | 2-3 天 | Step 8                |
| 10  | 文档与交付        | 整理最终 Prompt、参数、运行指南                            | 运维手册                                 | 0.5 天 | Step 9                |


**总计预估：10-15 个工作日**

---

## 14. 关键落地建议

### 14.1 先建立 Solo 基线

在加入任何 Harness 复杂度之前，先用**单个 Agent** 跑同样的 Prompt，记录输出质量。这是衡量 Harness 价值的唯一客观基准线。原文中 Solo vs Harness 的对比是说服力的核心来源。

### 14.2 Evaluator 校准是最关键的投入

原文作者明确指出，开箱即用的 Claude 是一个糟糕的 QA Agent。校准过程需要：

1. 跑完一次 Evaluator
2. 逐条阅读 QA 日志
3. 找出 Evaluator 判断与你的人类判断不一致的地方
4. 更新 Evaluator 的 Prompt 来纠正这些分歧
5. 重复 3-5 轮

这是最耗时也最不可跳过的环节。

### 14.3 从简单开始，按需加复杂度

> "Find the simplest solution possible, and only increase complexity when needed."

不要一开始就搭建全部组件。建议路径：

1. **Week 1**: Planner + Generator（无 Sprint 分解、无 Evaluator）
2. **Week 2**: 加入 Evaluator（先做单轮 QA）
3. **Week 3**: 如有需要，加入 Sprint 分解和 Contract 协商

### 14.4 新模型发布后重新审视

原文最核心的方法论洞察：**Harness 的每个组件都编码了对模型能力的一个假设。模型升级后，这些假设需要重新验证。**

具体操作：

- 新模型发布 → 用相同 Prompt 重跑
- 逐个关闭 Harness 组件，看哪些不再需要
- 关注新模型的新能力，是否可以用更少的组件达到同等或更好的效果

### 14.5 文件通信优于内存通信

文件通信的优势：

- **断点续跑**：进程崩溃后可从最新 artifact 恢复
- **事后审计**：完整追溯每个决策
- **模型切换**：可以在不同 Sprint 使用不同模型
- **调试友好**：直接阅读文件即可理解 Agent 行为

### 14.6 Evaluator 必须实际操作应用

Evaluator 的核心价值在于像真实用户一样操作：通过 Playwright MCP 导航页面、点击按钮、提交表单、截图取证。仅看代码或静态截图的 Evaluator 会遗漏大量交互层面的 bug。

### 14.7 Harness 设计空间不会缩小——而是移动

> "The space of interesting harness combinations doesn't shrink as models improve. Instead, it moves, and the interesting work for AI engineers is to keep finding the next novel combination."

模型变强后，之前需要 Harness 补偿的能力可能不再需要。但同时，更强的模型打开了新的可能性空间——之前不可能的复杂任务现在可以通过新的 Harness 组合来实现。AI 工程师的工作是持续寻找下一个有效的组合。

## 15. Multi-Epoch Evolution 架构（V2 升级）

> 更新日期：2026-04-19
>
> V1 的 Harness 是 **"一次性构建管线"**：Planner → Sprint 1..N → Done。V2 将其升级为 **"多轮进化管线"**，通过 Build → Review → Polish → Evolve 的循环持续提升产品质量。

### 15.1 问题诊断：为什么 V1 产品不够惊艳

经过多次实际运行，V1 架构暴露出五个系统性瓶颈：


| #   | 问题                    | 根因                                   | 影响                    |
| --- | --------------------- | ------------------------------------ | --------------------- |
| 1   | **跑完即停，没有改进循环**       | Harness 在所有 Sprint 完成后直接退出           | 产品停留在 "能用" 而非 "好用"    |
| 2   | **Spec 贪心：广度有余深度不足**  | Planner 倾向生成 5+ Sprint、15+ Feature   | 每个功能都有但都不精            |
| 3   | **QA 只验合同，不评产品品质**    | Evaluator 只检查 Acceptance Criteria 勾选 | "PASS" ≠ "产品体验好"      |
| 4   | **没有打磨环节**            | 所有 Sprint 都在加新功能                     | 无人关注 UX 一致性、视觉细节、边界处理 |
| 5   | **Generator 缺乏视觉全局观** | Generator 只看文字描述，不知道 App 长啥样         | 新代码可能破坏已有视觉风格         |


核心洞察：**产品质量不是一次构建出来的，而是通过 "构建 → 审视 → 打磨 → 演化" 的循环逐步提升的。**

### 15.2 解决方案：Multi-Epoch 循环

V2 将 Harness 生命周期从线性改为循环：

```
┌───────────────────────────────────────────────────────────────┐
│                    Evolution Loop (Epoch 循环)                 │
│                                                               │
│  Epoch 1: Foundation Build                                    │
│      Planner → 3 core Sprints → QA loops                     │
│      └─→ 产出：可运行的基础产品                                 │
│                                                               │
│  Epoch 2: Product Review (新增)                                │
│      Product Reviewer Agent 全站巡检                           │
│      └─→ 产出：10 维度评分 + 优先级改进清单                     │
│                                                               │
│  Epoch 3: Polish Sprints (新增)                                │
│      从改进清单生成微型打磨 Sprint                              │
│      └─→ 每轮 re-review，循环直到质量分 ≥ 阈值                 │
│                                                               │
│  Epoch 4+: Evolution (新增，可持续)                             │
│      从 goal_queue 取新需求 → 增量 Sprint                      │
│      └─→ 回到 Build → Review → Polish 循环                    │
│                                                               │
│  ∞ Loop until: 目标队列为空 AND 质量分达标                      │
└───────────────────────────────────────────────────────────────┘
```

**说明（避免误解）**：上图描述的是「理想闭环」。当前 `run-harness-full.sh` 在**一轮 Epoch 结束时**，若 `goal_queue` 为空即结束进程（**默认不会因质量分未达标而一直阻塞**）；质量未达标时脚本会提示可考虑继续打磨或 `--add-goal`。外层由 `MAX_EPOCHS`（默认 10）限制最大循环次数，并非数学意义上的无限运行。

与 V1 的关键区别：


| 维度       | V1                     | V2                                                       |
| -------- | ---------------------- | -------------------------------------------------------- |
| 生命周期     | 线性：Plan → Build → Done | 循环：Build → Review → Polish → Evolve                      |
| Sprint 数 | 5-8 个（Planner 决定）      | 3 个核心 + 按需扩展                                             |
| 质量评估     | 只有 Sprint 级 QA         | Sprint QA + 全站 Product Review                            |
| 打磨机制     | 无                      | 自动 Polish Sprint 循环                                      |
| 演化能力     | 无                      | 目标队列 + 增量 Sprint                                         |
| 终止条件     | Sprint 全部完成            | **默认**：`goal_queue` 为空且本 Epoch 流程跑完即退出；**非**「必须质量分达标才退出」 |


### 15.3 新增 Agent：Product Reviewer

**角色定位**：不同于 Evaluator（检查合同条款），Reviewer 从 **真实用户视角** 评估整体产品体验。

**核心能力**：

1. **全站巡检**：通过 Playwright MCP 访问每一个路由/页面，不遗漏
2. **核心旅程测试**：从 Spec 中提取 5 条最重要的用户旅程，端到端验证
3. **10 维度评分**：


| #   | 维度                        | 说明                       |
| --- | ------------------------- | ------------------------ |
| 1   | Visual Polish             | 颜色一致性、间距、字体、暗色模式、无未样式化元素 |
| 2   | UX Flow                   | 直觉导航、清晰 CTA、加载态、错误反馈     |
| 3   | Feature Completeness      | 所有承诺的功能是否端到端可用           |
| 4   | Responsiveness            | 移动/平板/桌面布局、无溢出、触控友好      |
| 5   | Error Handling            | 错误输入、网络异常、空状态处理          |
| 6   | Performance               | 页面加载速度、交互响应性             |
| 7   | Data Integrity            | CRUD 操作正确持久化、刷新不丢数据      |
| 8   | Cross-Feature Integration | 功能间协作（如搜索 + 筛选 + 分页）     |
| 9   | Design System Consistency | 组件复用、跨页面一致性              |
| 10  | "Wow Factor"              | 动画、微交互、智能默认值             |


1. **改进清单输出**：按影响力 × 可行性排序的 P0/P1/P2 改进条目，附具体文件和建议修复方案

**Prompt 模板**：`prompts/templates/reviewer.txt`

**产出物**：`artifacts/product-review-epoch-{N}.md`

**与 Evaluator 的分工**：

```
Evaluator：这个 Sprint 的 5 条验收标准是否通过？（合同级）
Reviewer ：这个产品作为整体，用户体验如何？值几分？（产品级）
```

### 15.4 新增 Agent：Polish Generator

**角色定位**：专注于 **改善已有功能**，不添加新功能。外科手术式精确修复。

**核心特点**：

- 输入：Product Review 报告 + Polish 合同（Top N 改进项）
- 工作方式：逐项修复，每项修复后验证，不重构无关代码
- 优先级：**坏掉的功能 > 视觉不一致 > UX 缺口 > 响应式问题 > 微交互打磨**
- 时间控制：单项修复超过 15 分钟则标记 "deferred" 跳过

**两个 Prompt 模板**：

- `prompts/templates/polish-contract.txt`：从 Review 的改进清单提取 Top N 生成 Polish 合同
- `prompts/templates/polish-generator.txt`：按合同精确修复

**产出物**：

- `artifacts/polish-{N}-contract-final.md`
- `artifacts/polish-{N}-handoff.md`

### 15.5 Quality Gate 机制

Quality Gate 是连接 Review 和 Polish 的自动化决策器。

**工作原理**：

```
Product Review 完成
        ↓
  提取 Overall Quality Score (X.X / 10)
        ↓
  score >= QUALITY_THRESHOLD ?
       ╱              ╲
     Yes              No
      ↓                ↓
  跳过 Polish      生成 Polish Sprint
  进入 Evolve      执行 → Re-review
                         ↓
                   score >= threshold ?
                        ╱         ╲
                      Yes         No (且 < MAX_POLISH_ROUNDS)
                       ↓           ↓
                    完成         继续 Polish
```

**Quality Score 加权计算**：`reviewer.txt` 要求模型在 **Overall Quality Score** 一行写出综合分（说明中约定 Feature Completeness 与 UX Flow 可加权）。**编排脚本不会按维度重算**，`lib/quality-gate.sh` 只做正则提取该行的数值并与阈值比较；若 Reviewer 未按格式写出分数，会得到 `0` 并误判为未达标。

**实现**：`lib/quality-gate.sh` 提供以下函数：

- `extract_quality_score(review_file)` — 解析 Reviewer 报告中的分数
- `quality_meets_threshold(score, threshold)` — 判断是否达标
- `count_backlog_items(review_file)` — 统计改进清单条目数
- `extract_top_backlog(review_file, n)` — 提取 Top N 改进条目
- `generate_core_journeys()` — 从 Spec 提取核心用户旅程

### 15.6 Evolution 目标队列

V2 引入了 **目标队列（Goal Queue）** 概念，支持 Harness 持续接受新需求。

**State 结构扩展**：

```json
{
  "phase": "complete",
  "epoch": 2,
  "epoch_type": "polish",
  "current_sprint": 3,
  "total_sprints": 3,
  "qa_round": 2,
  "max_qa_rounds": 3,
  "goal_queue": ["Add dark mode toggle", "Improve mobile navigation"],
  "quality_scores": [
    {"epoch": 1, "score": 5.2},
    {"epoch": "1.1", "score": 6.8},
    {"epoch": "1.2", "score": 7.3}
  ],
  "polish_round": 2,
  "total_polish_rounds": 2,
  "budget": 200,
  "user_goal": "Build a personal bookmark manager with tagging and search."
}
```

**目标注入方式**：在**任意终端**执行（会写入 `harness-state.json` 后退出；**不是**向已阻塞的 `kimi` 进程发消息）。下一轮用 `./run-harness-full.sh --resume` 时由编排脚本从队列 `pop` 目标并进入 Evolution。

```bash
./run-harness-full.sh --add-goal "Add dark mode toggle"
./run-harness-full.sh --add-goal "Improve mobile navigation"
```

**Evolution 流程**：当 Harness 完成当前 Epoch 的 Build + Review + Polish 后，自动检查目标队列：

1. 从队列取出下一个目标
2. 运行 Evolution Planner：在 `spec.md` 尾部追加 1-2 个新 Sprint（不修改已有 Sprint）
3. 重新解析 Sprint 数，从新 Sprint 开始 Build
4. Build → Review → Polish 循环

这样 Harness 可以在 `**MAX_EPOCHS` 上限内**多轮运行，持续接受用户反馈并进化产品。若一次 Evolution 在 `spec.md` 中**追加多个新 Sprint**，需核对 `run-harness-full.sh` 中 `START_FROM_SPRINT` 的计算是否覆盖全部新 Sprint（当前实现按「新总 Sprint 数」推算起始序号，极端情况下需人工调整 `START_FROM_SPRINT` 环境变量）。

### 15.7 Planner 约束优化

V1 的 Planner 鼓励 "Be AMBITIOUS about scope"，导致 5-8 个 Sprint 的过大 Spec。V2 重新平衡了 **远见** 与 **纪律**：

**关键变更**：


| 规则           | V1          | V2                                                      |
| ------------ | ----------- | ------------------------------------------------------- |
| Sprint 数     | 3-8 个       | **严格 3 个核心 Sprint**                                     |
| 每 Sprint 功能数 | 无限制         | **最多 2-3 个，深度实现**                                       |
| Sprint 1 要求  | 无特殊要求       | **必须视觉惊艳**（设计语言、动画、响应式）                                 |
| 打磨标准         | 无           | **每 Sprint 含 Polish Criteria**（加载骨架、空状态、过渡动画、响应式、键盘可访问） |
| 远期功能         | 全部排入 Sprint | **放入 "Future Vision" 部分**，由 Evolution 按需纳入              |


**理念**：3 个精品 Sprint 远胜 5 个粗糙 Sprint。质量优先于数量。

### 15.8 Visual Context 注入

V2 在 Generator 执行前，自动收集当前应用的截图，注入到 prompt 中。

**原理**：

1. `collect_visual_context()` 函数扫描 `artifacts/screenshots/`，取最新 10 张截图
2. 以截图路径列表形式注入 Generator prompt 的 `__VISUAL_CONTEXT__` 占位符
3. Generator 在修改代码前先查看截图，理解当前视觉基线

**效果**：减少 Generator 因不了解当前 UI 状态而引入视觉回退的概率。

### 15.9 完整文件清单与使用方式

#### 文件结构

```
harness-kimi-demo/
├── run-harness-full.sh          # 主编排脚本（Multi-Epoch 循环）
├── lib/
│   ├── state.sh                 # 状态持久化（支持 epoch/queue/scores）
│   ├── parse-sprints.sh         # 解析 spec.md 中的 Sprint 数
│   ├── check-verdict.sh         # 解析 QA 报告的 PASS/FAIL
│   ├── render-prompt.sh         # Prompt 模板渲染（含 visual context）
│   ├── restart-servers.sh       # 前后端服务重启
│   └── quality-gate.sh          # 质量门（分数提取/阈值判断）
├── prompts/templates/
│   ├── planner.txt              # Planner（3 核心 Sprint + Polish Criteria）
│   ├── contract.txt             # Sprint 合同
│   ├── generator.txt            # Generator（含 visual context + 未修复 bug）
│   ├── generator-fix.txt        # Generator Fix（全量 QA 上下文）
│   ├── evaluator.txt            # Evaluator（Playwright MCP + 回归测试）
│   ├── reviewer.txt             # Product Reviewer（10 维度评分）
│   ├── polish-contract.txt      # Polish 合同（从改进清单提取）
│   └── polish-generator.txt     # Polish Generator（精确修复）
└── artifacts/
    ├── harness-state.json       # 运行状态（epoch/queue/scores）
    ├── spec.md                  # 产品规格
    ├── sprint-N-contract-final.md
    ├── sprint-N-handoff.md
    ├── sprint-N-qa-round-M.md
    ├── product-review-epoch-N.md          # Product Review 报告
    ├── product-review-epoch-N-polish-M.md # Re-review 报告
    ├── polish-M-contract-final.md         # Polish 合同
    ├── polish-M-handoff.md                # Polish 交付
    └── screenshots/                       # Playwright 截图
```

*（为遵守 40,000 字符上限，§15.9 之后及 §15.10+ 未收录；完整 Multi-Epoch、配置参数、附录等见 `harness-design-guide.md` 自 §15.10 起。）*


---

**生成**：`_build_harness_article.py` 节录自 `harness-design-guide.md`（字符数 ≤ 40,000）
