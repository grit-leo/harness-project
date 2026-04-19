# Harness Design for Long-Running Application Development

## 构建长时间运行 Agentic 应用的完整落地方案

> 参考来源: [Anthropic Engineering — Harness design for long-running application development](https://www.anthropic.com/engineering/harness-design-long-running-apps) (2026-03-24)
>
> 本文档将原文方法论转化为可直接落地的技术方案，包含架构设计、Agent Prompt 模板、评分标准、通信协议、代码骨架及实施 Checklist。

---

## 目录

- [1. 背景与核心问题](#1-背景与核心问题)
- [2. 总体架构设计](#2-总体架构设计)
- [3. Agent 详细设计](#3-agent-详细设计)
  - [3.1 Planner Agent](#31-planner-agent)
  - [3.2 Generator Agent](#32-generator-agent)
  - [3.3 Evaluator Agent](#33-evaluator-agent)
- [4. Sprint Contract 协商机制](#4-sprint-contract-协商机制)
- [5. 评分标准体系](#5-评分标准体系)
  - [5.1 全栈应用评分标准](#51-全栈应用评分标准)
  - [5.2 前端设计评分标准](#52-前端设计评分标准)
- [6. 文件通信协议](#6-文件通信协议)
- [7. Context 管理策略](#7-context-管理策略)
- [8. 成本控制与监控](#8-成本控制与监控)
- [9. 代码骨架实现](#9-代码骨架实现)
  - [9.1 Orchestrator](#91-orchestrator)
  - [9.2 Planner 实现](#92-planner-实现)
  - [9.3 Generator 实现](#93-generator-实现)
  - [9.4 Evaluator 实现](#94-evaluator-实现)
  - [9.5 CostTracker 实现](#95-costtracker-实现)
- [10. Demo: 从零运行一个完整项目](#10-demo-从零运行一个完整项目)
  - [10.1 环境准备](#101-环境准备)
  - [10.2 项目结构](#102-项目结构)
  - [10.3 完整可运行代码](#103-完整可运行代码)
  - [10.4 运行 Demo](#104-运行-demo)
  - [10.5 运行过程详解](#105-运行过程详解)
  - [10.6 查看产出物](#106-查看产出物)
  - [10.7 V2 简化版 Demo](#107-v2-简化版-demo)
  - [10.8 Kimi Code CLI（Kimi Coding）运行方式](#kimi-coding-harness)
- [11. 迭代简化方法论](#11-迭代简化方法论)
- [12. 实战效果参考](#12-实战效果参考)
- [13. 实施 Checklist](#13-实施-checklist)
- [14. 关键落地建议](#14-关键落地建议)
- [15. Multi-Epoch Evolution 架构（V2 升级）](#15-multi-epoch-evolution-架构v2-升级)
  - [15.1 问题诊断：为什么 V1 产品不够惊艳](#151-问题诊断为什么-v1-产品不够惊艳)
  - [15.2 解决方案：Multi-Epoch 循环](#152-解决方案multi-epoch-循环)
  - [15.3 新增 Agent：Product Reviewer](#153-新增-agentproduct-reviewer)
  - [15.4 新增 Agent：Polish Generator](#154-新增-agentpolish-generator)
  - [15.5 Quality Gate 机制](#155-quality-gate-机制)
  - [15.6 Evolution 目标队列](#156-evolution-目标队列)
  - [15.7 Planner 约束优化](#157-planner-约束优化)
  - [15.8 Visual Context 注入](#158-visual-context-注入)
  - [15.9 完整文件清单与使用方式](#159-完整文件清单与使用方式)
  - [15.10 配置参数参考](#1510-配置参数参考)
  - [15.11 文档与实现：开发者引用须知](#1511-文档与实现开发者引用须知)

---

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

## 3. Agent 详细设计

### 3.1 Planner Agent

**职责**：将用户 1-4 句话的简短 Prompt 扩展为完整的产品规格文档。

**设计原则（来自原文实验）**：

1. **对 scope 保持雄心**——主动超越用户提示的字面意义，做比 solo agent 更丰富的产品设计
2. **聚焦产品上下文和高层技术设计**，不写粒度过细的技术实现细节
3. **原因**：如果 Planner 在前期就指定了具体的技术细节且有错误，这些错误会级联放大到下游实现中。更明智的做法是约束"交付物"而非"路径"
4. **主动寻找嵌入 AI 功能的机会**——让生成的应用包含 AI 辅助特性
5. **包含视觉设计方向**——颜色、字体、布局原则、整体风格调性

**System Prompt 模板**：

```text
You are a senior product manager and technical architect.

Given a brief user prompt (1-4 sentences), produce a comprehensive product
specification document.

## RULES

1. Be AMBITIOUS about scope — push well beyond the obvious interpretation
   of the user's request. The spec should describe a product significantly
   richer than what a single-pass coding agent would attempt.

2. Focus on PRODUCT CONTEXT and HIGH-LEVEL TECHNICAL DESIGN. Define what
   the product does, who it's for, how features relate to each other, and
   the overall data model / API surface.

3. Do NOT specify granular implementation details (specific function names,
   exact file structures, line-level code patterns). If you get these wrong,
   the errors cascade into downstream implementation.

4. Actively find opportunities to weave AI-powered features into the product.
   Think: AI-assisted content generation, intelligent suggestions, natural
   language interactions within the app.

5. Include a VISUAL DESIGN DIRECTION section describing color palette,
   typography choices, layout principles, and overall mood/identity.

6. Organize features into logical sprints (5-15 depending on scope). Each
   sprint should be independently deliverable and testable.

## OUTPUT FORMAT

# {Project Name}

## Overview
[2-3 paragraph product vision — what it is, who it's for, why it matters]

## Design Language
[Color palette, typography, layout principles, mood, visual identity]

## Features

### Feature N: {Feature Name}
**Sprint:** {Sprint Number}
**Description:** [What this feature does and why it matters]
**User Stories:**
- As a user, I want to ... so that ...
**Acceptance Criteria:**
- [ ] Criterion 1 (concrete, testable)
- [ ] Criterion 2

## Technical Architecture
[High-level: stack choices, data model overview, API surface, key integrations]
```

**Planner 的实际效果（原文案例）**：

用户仅输入 "Create a 2D retro game maker with features including a level editor, sprite editor, entity behaviors, and a playable test mode." 一句话，Planner 扩展为 16 个 Feature、10 个 Sprint 的完整规格，额外包含了精灵动画系统、行为模板、声效与音乐、AI 辅助精灵生成器、AI 关卡设计器、游戏导出与分享链接等特性。

---

### 3.2 Generator Agent

**职责**：按照 Spec 和 Sprint Contract 逐步实现应用功能。

**设计原则**：

1. **一次一个 Feature / Sprint**——聚焦当前范围，避免并行切换导致混乱
2. **每次有意义的变更都 commit 到 git**——便于回滚和审计
3. **完成后做自我检查**——在交给 Evaluator 之前先自行运行并验证
4. **不允许 Stub（桩函数）**——必须真正实现功能，不能留空壳
5. **遵循 Spec 中的 Design Language**——保持视觉一致性
6. **在每次 Evaluator 反馈后做策略性决策**——如果分数趋势向好，继续当前方向优化；如果当前方向不行，彻底换一种方案

**System Prompt 模板**：

```text
You are a senior full-stack engineer building a production-quality application.

## CONTEXT
- Product Spec: Read from {artifacts_dir}/spec.md
- Sprint Contract: Read from {artifacts_dir}/sprint-{n}-contract-final.md
- Previous QA Feedback (if any): Read from {artifacts_dir}/sprint-{n}-qa-round-{r}.md

## TECH STACK
- Frontend: React + Vite + TypeScript
- Backend: FastAPI (Python) + SQLite (or PostgreSQL for production)
- All code lives in {project_dir}/

## WORKFLOW
1. Read the sprint contract carefully — understand every acceptance criterion
2. Plan your implementation approach before writing code
3. Implement features one at a time, testing each before moving to the next
4. After each significant feature, run the app and verify it works end-to-end
5. Commit each meaningful change to git with a descriptive message
6. When all contract criteria are met, self-evaluate your work:
   - Walk through every acceptance criterion
   - Actually run the app and click through the feature
   - Check for edge cases
7. Write a handoff summary to {artifacts_dir}/sprint-{n}-handoff.md

## PRINCIPLES
- Working software over perfect code
- NEVER stub features — implement them fully or explicitly descope in the contract
- Follow the design language from the spec (colors, typography, layout, mood)
- If you hit a dead end after 3 attempts, step back and try a fundamentally
  different approach rather than continuing to iterate on a broken path
- If fixing an Evaluator-reported bug, focus on the root cause, not the symptom

## HANDOFF SUMMARY FORMAT
# Sprint {N} Handoff

## What Was Built
[Bullet list of implemented features]

## Known Limitations
[Honest assessment of what's not perfect]

## How to Test
[Steps for the Evaluator to verify the work]

## Files Changed
[Key files modified in this sprint]
```

---

### 3.3 Evaluator Agent

**职责**：以 QA 工程师的身份，使用 Playwright MCP 实际操作运行中的应用，针对 Sprint Contract 逐条验证，打分并提供具体的 bug 反馈。

**这是整个 Harness 中最关键也最难调优的组件。**

**核心挑战（原文原话）**：

> "Out of the box, Claude is a poor QA agent. In early runs, I watched it identify legitimate issues, then talk itself into deciding they weren't a big deal and approve the work anyway. It also tended to test superficially, rather than probing edge cases."

**调优方法**：

1. 跑一次完整的 Evaluator → 阅读其日志
2. 找出 Evaluator 判断与人类判断不一致的地方
3. 更新 Evaluator 的 Prompt 来纠正这些分歧
4. 重复 3-5 轮，直到 Evaluator 的评分与你的预期基本一致

**System Prompt 模板**：

```text
You are a STRICT, SKEPTICAL QA engineer and code reviewer.

## CRITICAL BEHAVIORAL RULES

1. You have a natural tendency to be lenient toward LLM-generated output.
   ACTIVELY FIGHT THIS TENDENCY. Your job is to find problems, not to
   praise the work.

2. If something looks "almost right" — it is WRONG. Partial implementations
   FAIL. Features that exist visually but don't function score ZERO.

3. Do NOT talk yourself into approving work that has issues. If you identify
   a problem, it IS a problem. Do not rationalize it away.

4. Test EVERY interactive element, not just the happy path. Click every
   button. Submit every form. Try edge cases. Try unexpected inputs.

5. A feature that "looks impressive" but breaks when actually used is a
   FAILURE, not a partial success.

6. Your feedback must be specific enough that a developer can fix the issue
   without additional investigation. Include: file names, line numbers,
   expected vs actual behavior, root cause analysis when possible.

## WORKFLOW

1. Read the sprint contract from {artifacts_dir}/sprint-{n}-contract-final.md
2. Read the generator's handoff from {artifacts_dir}/sprint-{n}-handoff.md
3. Launch the running application via Playwright MCP
4. For EACH contract criterion:
   a. Navigate to the relevant page/feature
   b. Interact with it exactly as a real user would
   c. Take screenshots as evidence
   d. Grade as PASS or FAIL with specific, factual evidence
5. Score each evaluation dimension (1-10) against the criteria below
6. If ANY dimension score falls below its threshold → SPRINT FAILS
7. Write detailed, actionable feedback for the Generator

## FEW-SHOT CALIBRATION EXAMPLES

### Example: Overly Lenient (BAD — do NOT do this)
"The form submission mostly works. There's a minor issue where the success
message doesn't show, but the data is saved. Score: 8/10"

→ CORRECT assessment: "Form submission fails silently — no success/error
feedback to the user. User has no way to know if their action succeeded.
This is a fundamental UX failure. Score: 4/10. FAIL."

### Example: Properly Strict (GOOD — do this)
"Rectangle fill tool: click-drag only places tiles at start/end points
instead of filling the rectangular region. fillRectangle() exists at
LevelEditor.tsx:245 but mouseUp handler doesn't trigger it properly.
FAIL."

### Example: Properly Strict (GOOD — do this)
"DELETE key handler at LevelEditor.tsx:892 requires both `selection` AND
`selectedEntityId` to be set, but clicking an entity only sets
selectedEntityId. Condition should be:
selection || (selectedEntityId && activeLayer === 'entity'). FAIL."

### Example: Properly Strict (GOOD — do this)
"PUT /frames/reorder route defined after /{frame_id} routes. FastAPI
matches 'reorder' as a frame_id integer parameter and returns 422:
'unable to parse string as an integer.' Route ordering must be fixed.
FAIL."

## OUTPUT FORMAT

# Sprint {N} QA Report — Round {R}

## Contract Criteria Verification

| # | Criterion | Result | Evidence |
|---|-----------|--------|----------|
| 1 | [criterion text] | PASS/FAIL | [specific observation with file/line refs] |
| 2 | ... | ... | ... |

## Dimension Scores

| Dimension        | Score (1-10) | Threshold | Pass? |
|------------------|-------------|-----------|-------|
| Product Depth    | X           | 6         | Y/N   |
| Functionality    | X           | 7         | Y/N   |
| Visual Design    | X           | 5         | Y/N   |
| Code Quality     | X           | 5         | Y/N   |

## Bugs Found

1. **[BUG-001]** [Description]
   - Location: [File:Line]
   - Expected: [behavior]
   - Actual: [behavior]
   - Root Cause: [analysis, if determinable]
   - Severity: Critical / Major / Minor

2. **[BUG-002]** ...

## Overall Verdict: PASS / FAIL

## Actionable Feedback for Generator
[Specific, prioritized list of what to fix. Each item must be concrete
enough to act on without further investigation.]
```

---

## 4. Sprint Contract 协商机制

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

            if "APPROVED" in review:
                final_path = self.state.artifacts_dir / f"sprint-{n}-contract-final.md"
                final_path.write_text(draft_path.read_text())
                return final_path.read_text()

        # After 3 attempts, use latest draft as final
        final_path = self.state.artifacts_dir / f"sprint-{n}-contract-final.md"
        final_path.write_text(draft_path.read_text())
        return final_path.read_text()

    async def _run_generator(self, contract: str):
        """Run Generator to implement the sprint."""
        raise NotImplementedError("Implement with Claude Agent SDK")

    async def _run_evaluator(self, contract: str) -> dict:
        """Run Evaluator with Playwright MCP to test the sprint."""
        # Returns {"passed": bool, "feedback": str}
        raise NotImplementedError("Implement with Claude Agent SDK")

    async def _run_generator_fix(self, feedback: str):
        """Run Generator to fix issues identified by Evaluator."""
        raise NotImplementedError("Implement with Claude Agent SDK")

    def _print_summary(self):
        print(f"\n{'='*60}")
        print(f"  HARNESS COMPLETE")
        print(f"  Sprints: {self.state.current_sprint}/{self.state.total_sprints}")
        print(f"  Total Cost: ${self.cost_tracker.spent:.2f}")
        print(f"  Breakdown: {json.dumps(self.cost_tracker.breakdown, indent=2)}")
        print(f"{'='*60}\n")
```

### 9.2 Planner 实现

```python
from claude_agent_sdk import Agent, Message


async def run_planner(user_prompt: str, artifacts_dir: Path) -> str:
    """Expand a short user prompt into a full product spec."""
    planner = Agent(
        model="claude-opus-4-5-20250901",  # 或最新可用模型
        system=PLANNER_SYSTEM_PROMPT,
        tools=[],  # Planner 不需要工具
    )

    response = await planner.run(
        messages=[
            Message(
                role="user",
                content=f"Create a comprehensive product spec for:\n\n{user_prompt}",
            )
        ]
    )

    spec_content = response.content
    spec_path = artifacts_dir / "spec.md"
    spec_path.write_text(spec_content)

    return spec_content
```

### 9.3 Generator 实现

```python
async def run_generator(
    contract: str,
    project_dir: Path,
    artifacts_dir: Path,
    sprint_num: int,
    qa_feedback: Optional[str] = None,
) -> str:
    """Run the Generator agent to implement a sprint."""

    context_parts = [f"Sprint Contract:\n{contract}"]
    if qa_feedback:
        context_parts.append(f"QA Feedback to Address:\n{qa_feedback}")

    generator = Agent(
        model="claude-opus-4-5-20250901",
        system=GENERATOR_SYSTEM_PROMPT.format(
            artifacts_dir=artifacts_dir,
            project_dir=project_dir,
        ),
        tools=[
            "file_read",
            "file_write",
            "shell",  # for running the app, git, npm, pip, etc.
        ],
        working_directory=str(project_dir),
    )

    response = await generator.run(
        messages=[
            Message(
                role="user",
                content="\n\n".join(context_parts),
            )
        ]
    )

    handoff_path = artifacts_dir / f"sprint-{sprint_num}-handoff.md"
    # Generator should have written handoff file via its tools
    return handoff_path.read_text() if handoff_path.exists() else response.content
```

### 9.4 Evaluator 实现

```python
async def run_evaluator(
    contract: str,
    handoff: str,
    artifacts_dir: Path,
    sprint_num: int,
    qa_round: int,
) -> dict:
    """Run the Evaluator agent with Playwright MCP."""

    evaluator = Agent(
        model="claude-opus-4-5-20250901",
        system=EVALUATOR_SYSTEM_PROMPT.format(
            artifacts_dir=artifacts_dir,
        ),
        tools=[
            "file_read",
            "playwright_mcp",  # Playwright MCP for browser interaction
        ],
        mcps=["playwright"],
    )

    response = await evaluator.run(
        messages=[
            Message(
                role="user",
                content=(
                    f"Sprint Contract:\n{contract}\n\n"
                    f"Generator Handoff:\n{handoff}\n\n"
                    "The application is running at http://localhost:5173 (frontend) "
                    "and http://localhost:8000 (backend API).\n\n"
                    "Please test every contract criterion using Playwright. "
                    "Be strict. Output your full QA report."
                ),
            )
        ]
    )

    qa_report = response.content
    report_path = artifacts_dir / f"sprint-{sprint_num}-qa-round-{qa_round}.md"
    report_path.write_text(qa_report)

    passed = "PASS" in qa_report.split("Overall Verdict:")[-1].upper()

    return {
        "passed": passed,
        "feedback": qa_report,
        "report_path": str(report_path),
    }
```

### 9.5 CostTracker 实现

```python
@dataclass
class CostTracker:
    budget: float = 200.0
    spent: float = 0.0
    breakdown: dict = field(default_factory=dict)
    start_time: float = field(default_factory=time.time)

    def record(self, phase: str, input_tokens: int, output_tokens: int,
               model: str = "opus"):
        pricing = {
            "opus": {"input": 15.0, "output": 75.0},
            "sonnet": {"input": 3.0, "output": 15.0},
        }
        rates = pricing.get(model, pricing["opus"])
        cost = (input_tokens * rates["input"]
                + output_tokens * rates["output"]) / 1_000_000

        self.spent += cost
        self.breakdown.setdefault(phase, {"cost": 0.0, "calls": 0})
        self.breakdown[phase]["cost"] += cost
        self.breakdown[phase]["calls"] += 1

    @property
    def remaining(self) -> float:
        return self.budget - self.spent

    @property
    def elapsed_minutes(self) -> float:
        return (time.time() - self.start_time) / 60

    def over_budget(self) -> bool:
        if self.spent >= self.budget * 0.9:
            print(f"  WARNING: {self.spent/self.budget*100:.0f}% budget consumed "
                  f"(${self.spent:.2f}/${self.budget:.2f})")
        return self.spent >= self.budget
```

---

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

### 10.3 完整可运行代码

以下为四个文件的完整代码，可以直接复制到对应路径运行。

#### 10.3.1 `prompts.py` — Agent System Prompts

```python
"""All Agent system prompts for the Harness."""

PLANNER_PROMPT = """\
You are a senior product manager and technical architect.

Given a brief user prompt, produce a comprehensive product specification.

## RULES
1. Be AMBITIOUS about scope — push beyond the obvious interpretation.
2. Focus on PRODUCT CONTEXT and HIGH-LEVEL TECHNICAL DESIGN.
   Do NOT specify granular implementation details.
3. Weave AI-powered features into the product where natural.
4. Include a VISUAL DESIGN DIRECTION section.
5. Organize features into logical sprints (3-8 depending on scope).
   Each sprint must be independently deliverable and testable.

## OUTPUT FORMAT (strict Markdown)

# {Project Name}

## Overview
[2-3 paragraph product vision]

## Design Language
[Color palette, typography, layout, mood]

## Features

### Sprint 1: {Sprint Title}
#### Feature 1.1: {Name}
**User Stories:**
- As a user, I want to ... so that ...
**Acceptance Criteria:**
- [ ] Criterion (concrete, binary pass/fail)

### Sprint 2: {Sprint Title}
...

## Technical Architecture
[Stack, data model, API surface]
"""

GENERATOR_PROMPT = """\
You are a senior full-stack engineer building a production-quality application.

## CONTEXT
- Product Spec: {artifacts_dir}/spec.md
- Sprint Contract: {artifacts_dir}/sprint-{sprint_num}-contract-final.md
{qa_feedback_section}

## TECH STACK
- Frontend: React + Vite + TypeScript
- Backend: FastAPI (Python) + SQLite
- Project root: {project_dir}

## WORKFLOW
1. Read the sprint contract — understand every acceptance criterion.
2. Implement features one at a time, verifying each works before moving on.
3. Commit each meaningful change to git.
4. When done, self-evaluate against every criterion.
5. Write a handoff summary to {artifacts_dir}/sprint-{sprint_num}-handoff.md

## PRINCIPLES
- NEVER stub features — implement them fully.
- Follow the design language from the spec.
- If stuck after 3 attempts, try a fundamentally different approach.

## HANDOFF FORMAT
# Sprint {sprint_num} Handoff
## What Was Built
[bullet list]
## Known Limitations
[honest assessment]
## How to Test
[steps for QA]
"""

EVALUATOR_PROMPT = """\
You are a STRICT, SKEPTICAL QA engineer.

## CRITICAL RULES
1. FIGHT your natural leniency. Your job is to find problems.
2. "Almost right" means WRONG. Partial implementations FAIL.
3. Do NOT rationalize away problems you find.
4. Test EVERY interactive element, not just the happy path.
5. Feedback must include file names, expected vs actual, root cause.

## WORKFLOW
1. Read contract: {artifacts_dir}/sprint-{sprint_num}-contract-final.md
2. Read handoff: {artifacts_dir}/sprint-{sprint_num}-handoff.md
3. The app runs at http://localhost:5173 (frontend), http://localhost:8000 (API).
4. Use Playwright to navigate and test every contract criterion.
5. Score each dimension. If ANY is below threshold, the sprint FAILS.

## SCORING DIMENSIONS
| Dimension      | Threshold |
|----------------|-----------|
| Product Depth  | 6/10      |
| Functionality  | 7/10      |
| Visual Design  | 5/10      |
| Code Quality   | 5/10      |

## OUTPUT FORMAT
# Sprint {sprint_num} QA Report — Round {qa_round}

## Contract Criteria
| # | Criterion | Result | Evidence |
|---|-----------|--------|----------|

## Dimension Scores
| Dimension | Score | Threshold | Pass? |

## Bugs Found
1. **[BUG-001]** ...

## Overall Verdict: PASS / FAIL

## Feedback for Generator
[specific, actionable items]
"""

CONTRACT_PROPOSAL_PROMPT = """\
You are a senior engineer. Based on this sprint spec from the product
specification, propose a sprint contract.

Sprint Spec:
{sprint_spec}

Full Product Spec is at: {artifacts_dir}/spec.md

Write a contract with:
1. WHAT you will build (specific components, pages, APIs)
2. Testable acceptance criteria (binary PASS/FAIL, concrete)
3. Out of scope items
4. Dependencies on previous sprints

Output the contract as Markdown.
"""

CONTRACT_REVIEW_PROMPT = """\
You are a strict QA lead reviewing a sprint contract.

Read the contract draft below. Check:
- Are criteria specific and testable (binary pass/fail)?
- Are there gaps vs the product spec?
- Are any criteria too vague?

If acceptable, start your response with: APPROVED
If not, start with: NEEDS_REVISION and list required changes.

Contract Draft:
{contract_draft}
"""
```

#### 10.3.2 `cost_tracker.py` — 成本追踪

```python
"""Cost tracking for Harness runs."""

import time
from dataclasses import dataclass, field


@dataclass
class CostTracker:
    budget: float = 100.0
    spent: float = 0.0
    breakdown: dict = field(default_factory=dict)
    start_time: float = field(default_factory=time.time)

    def record(self, phase: str, input_tokens: int, output_tokens: int,
               model: str = "opus"):
        pricing = {
            "opus": {"input": 15.0, "output": 75.0},
            "sonnet": {"input": 3.0, "output": 15.0},
        }
        rates = pricing.get(model, pricing["opus"])
        cost = (input_tokens * rates["input"]
                + output_tokens * rates["output"]) / 1_000_000
        self.spent += cost
        self.breakdown.setdefault(phase, {"cost": 0.0, "calls": 0})
        self.breakdown[phase]["cost"] += cost
        self.breakdown[phase]["calls"] += 1

    @property
    def remaining(self) -> float:
        return self.budget - self.spent

    @property
    def elapsed_minutes(self) -> float:
        return (time.time() - self.start_time) / 60

    def over_budget(self) -> bool:
        if self.spent >= self.budget * 0.9:
            print(f"  [COST] {self.spent/self.budget*100:.0f}% budget used "
                  f"(${self.spent:.2f}/${self.budget:.2f})")
        return self.spent >= self.budget

    def summary(self) -> str:
        lines = [
            f"Total Cost: ${self.spent:.2f} / ${self.budget:.2f}",
            f"Elapsed: {self.elapsed_minutes:.1f} min",
            "Breakdown:",
        ]
        for phase, data in self.breakdown.items():
            lines.append(f"  {phase}: ${data['cost']:.2f} ({data['calls']} calls)")
        return "\n".join(lines)
```

#### 10.3.3 `agents.py` — Agent 调用封装

```python
"""Agent invocation wrappers using claude-agent-sdk."""

import asyncio
import re
from pathlib import Path
from typing import Optional

from claude_agent_sdk import query, ClaudeAgentOptions

from prompts import (
    PLANNER_PROMPT,
    GENERATOR_PROMPT,
    EVALUATOR_PROMPT,
    CONTRACT_PROPOSAL_PROMPT,
    CONTRACT_REVIEW_PROMPT,
)


async def _collect_response(prompt: str, options: ClaudeAgentOptions) -> str:
    """Run a query and collect the full text response."""
    parts = []
    async for message in query(prompt=prompt, options=options):
        if hasattr(message, "content"):
            for block in message.content:
                if hasattr(block, "text"):
                    parts.append(block.text)
    return "\n".join(parts)


async def run_planner(user_prompt: str, artifacts_dir: Path) -> str:
    """Expand a short user prompt into a full product spec."""
    print("\n[PLANNER] Generating product specification...")

    response = await _collect_response(
        prompt=f"Create a comprehensive product spec for:\n\n{user_prompt}",
        options=ClaudeAgentOptions(
            system_prompt=PLANNER_PROMPT,
            allowed_tools=["Read"],
            max_turns=10,
        ),
    )

    spec_path = artifacts_dir / "spec.md"
    spec_path.write_text(response)
    print(f"[PLANNER] Spec written to {spec_path} ({len(response)} chars)")
    return response


def parse_sprints(spec: str) -> list[str]:
    """Extract individual sprint sections from the spec."""
    sprint_pattern = re.compile(
        r"(### Sprint \d+.*?)(?=### Sprint \d+|## Technical Architecture|$)",
        re.DOTALL,
    )
    sprints = sprint_pattern.findall(spec)
    if not sprints:
        return [spec]
    return [s.strip() for s in sprints if s.strip()]


async def negotiate_contract(
    sprint_spec: str,
    sprint_num: int,
    artifacts_dir: Path,
    max_rounds: int = 3,
) -> str:
    """Generator proposes a contract, Evaluator reviews, iterate until agreed."""
    print(f"\n[CONTRACT] Negotiating Sprint {sprint_num} contract...")

    for attempt in range(1, max_rounds + 1):
        # Generator proposes
        draft = await _collect_response(
            prompt=CONTRACT_PROPOSAL_PROMPT.format(
                sprint_spec=sprint_spec,
                artifacts_dir=artifacts_dir,
            ),
            options=ClaudeAgentOptions(
                allowed_tools=["Read"],
                max_turns=5,
            ),
        )

        draft_path = artifacts_dir / f"sprint-{sprint_num}-contract-draft.md"
        draft_path.write_text(draft)

        # Evaluator reviews
        review = await _collect_response(
            prompt=CONTRACT_REVIEW_PROMPT.format(contract_draft=draft),
            options=ClaudeAgentOptions(
                allowed_tools=[],
                max_turns=3,
            ),
        )

        review_path = artifacts_dir / f"sprint-{sprint_num}-contract-review.md"
        review_path.write_text(review)

        if "APPROVED" in review[:200].upper():
            print(f"[CONTRACT] Approved on round {attempt}")
            break
        else:
            print(f"[CONTRACT] Needs revision (round {attempt}/{max_rounds})")

    final_path = artifacts_dir / f"sprint-{sprint_num}-contract-final.md"
    final_path.write_text(draft)
    return draft


async def run_generator(
    contract: str,
    sprint_num: int,
    artifacts_dir: Path,
    project_dir: Path,
    qa_feedback: Optional[str] = None,
) -> str:
    """Run the Generator to implement a sprint (or fix QA issues)."""
    phase = "fix" if qa_feedback else "build"
    print(f"\n[GENERATOR] Sprint {sprint_num} — {phase}...")

    qa_section = ""
    if qa_feedback:
        qa_section = f"- QA Feedback to fix: {artifacts_dir}/sprint-{sprint_num}-qa-round-latest.md"

    system = GENERATOR_PROMPT.format(
        artifacts_dir=artifacts_dir,
        project_dir=project_dir,
        sprint_num=sprint_num,
        qa_feedback_section=qa_section,
    )

    user_msg = f"Implement Sprint {sprint_num} per the contract."
    if qa_feedback:
        user_msg = (
            f"Fix the issues from QA for Sprint {sprint_num}.\n\n"
            f"QA Feedback:\n{qa_feedback}"
        )

    response = await _collect_response(
        prompt=user_msg,
        options=ClaudeAgentOptions(
            system_prompt=system,
            allowed_tools=["Read", "Write", "Edit", "Bash"],
            cwd=str(project_dir),
            max_turns=80,
        ),
    )

    handoff_path = artifacts_dir / f"sprint-{sprint_num}-handoff.md"
    if not handoff_path.exists():
        handoff_path.write_text(response)

    print(f"[GENERATOR] Sprint {sprint_num} {phase} complete")
    return handoff_path.read_text() if handoff_path.exists() else response


async def run_evaluator(
    contract: str,
    handoff: str,
    sprint_num: int,
    qa_round: int,
    artifacts_dir: Path,
) -> dict:
    """Run the Evaluator with Playwright to test the sprint."""
    print(f"\n[EVALUATOR] Sprint {sprint_num}, QA round {qa_round}...")

    system = EVALUATOR_PROMPT.format(
        artifacts_dir=artifacts_dir,
        sprint_num=sprint_num,
        qa_round=qa_round,
    )

    response = await _collect_response(
        prompt=(
            f"Test Sprint {sprint_num} against the contract.\n\n"
            f"Contract:\n{contract}\n\n"
            f"Handoff:\n{handoff}\n\n"
            "The app is at http://localhost:5173 (frontend) and "
            "http://localhost:8000 (backend). Test every criterion."
        ),
        options=ClaudeAgentOptions(
            system_prompt=system,
            allowed_tools=["Read", "Bash", "mcp__playwright__browser_navigate",
                           "mcp__playwright__browser_snapshot",
                           "mcp__playwright__browser_click",
                           "mcp__playwright__browser_type",
                           "mcp__playwright__browser_take_screenshot"],
            max_turns=40,
        ),
    )

    report_path = artifacts_dir / f"sprint-{sprint_num}-qa-round-{qa_round}.md"
    report_path.write_text(response)

    verdict_section = response.split("Overall Verdict:")[-1][:100].upper()
    passed = "PASS" in verdict_section and "FAIL" not in verdict_section

    print(f"[EVALUATOR] Verdict: {'PASS' if passed else 'FAIL'}")
    return {"passed": passed, "feedback": response}
```

#### 10.3.4 `main.py` — 入口文件

```python
"""Harness Orchestrator — entry point."""

import asyncio
import json
import sys
from pathlib import Path

from agents import (
    run_planner,
    parse_sprints,
    negotiate_contract,
    run_generator,
    run_evaluator,
)
from cost_tracker import CostTracker


ARTIFACTS_DIR = Path("./artifacts")
PROJECT_DIR = Path("./project")
MAX_QA_ROUNDS = 3


async def run_harness(user_prompt: str, budget: float = 100.0):
    """Execute the full Planner → Generator → Evaluator harness."""

    ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)
    PROJECT_DIR.mkdir(parents=True, exist_ok=True)

    tracker = CostTracker(budget=budget)

    # ── Phase 1: Planning ──────────────────────────────────────
    print("=" * 60)
    print("  PHASE 1: PLANNING")
    print("=" * 60)

    spec = await run_planner(user_prompt, ARTIFACTS_DIR)
    sprints = parse_sprints(spec)
    total = len(sprints)
    print(f"\n  Planner produced {total} sprints")

    # ── Phase 2: Sprint Loop ───────────────────────────────────
    for i, sprint_spec in enumerate(sprints):
        sprint_num = i + 1
        print(f"\n{'=' * 60}")
        print(f"  SPRINT {sprint_num}/{total}")
        print(f"{'=' * 60}")

        # 2a. Contract Negotiation
        contract = await negotiate_contract(
            sprint_spec, sprint_num, ARTIFACTS_DIR
        )

        # 2b. Build
        handoff = await run_generator(
            contract, sprint_num, ARTIFACTS_DIR, PROJECT_DIR
        )

        # 2c. QA Loop
        passed = False
        for qa_round in range(1, MAX_QA_ROUNDS + 1):
            result = await run_evaluator(
                contract, handoff, sprint_num, qa_round, ARTIFACTS_DIR
            )

            if result["passed"]:
                passed = True
                print(f"\n  Sprint {sprint_num} PASSED (QA round {qa_round})")
                break
            else:
                print(f"\n  Sprint {sprint_num} FAILED (QA round {qa_round})")
                if qa_round < MAX_QA_ROUNDS:
                    handoff = await run_generator(
                        contract, sprint_num, ARTIFACTS_DIR, PROJECT_DIR,
                        qa_feedback=result["feedback"],
                    )

        if not passed:
            print(f"  Sprint {sprint_num} did not pass after {MAX_QA_ROUNDS} rounds, continuing...")

        if tracker.over_budget():
            print(f"\n  BUDGET LIMIT REACHED")
            break

    # ── Phase 3: Summary ──────────────────────────────────────
    print(f"\n{'=' * 60}")
    print("  HARNESS COMPLETE")
    print(f"{'=' * 60}")
    print(f"  Sprints completed: {min(sprint_num, total)}/{total}")
    print(f"  {tracker.summary()}")
    print(f"  Artifacts: {ARTIFACTS_DIR.resolve()}")
    print(f"  Project:   {PROJECT_DIR.resolve()}")
    print(f"{'=' * 60}\n")


def main():
    if len(sys.argv) > 1:
        prompt = " ".join(sys.argv[1:])
    else:
        prompt = (
            "Build a personal bookmark manager with tagging, full-text search, "
            "and a clean modern UI."
        )

    budget = 100.0
    print(f"\n  Harness starting...")
    print(f"  Prompt: {prompt}")
    print(f"  Budget: ${budget:.2f}\n")

    asyncio.run(run_harness(prompt, budget))


if __name__ == "__main__":
    main()
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
        ├── Sprint 1: 项目骨架 + 基础 CRUD
        ├── Sprint 2: 标签系统 + 批量操作
        ├── Sprint 3: 全文搜索 + 过滤器
        ├── Sprint 4: AI 智能分类 + 自动标签建议
        └── Sprint 5: 导入导出 + 浏览器扩展集成

 0:05   Sprint 1 Contract 协商 (Generator ↔ Evaluator)
 0:08   Sprint 1 Build 开始
        Generator: 搭建 Vite + React 前端
        Generator: 搭建 FastAPI 后端 + SQLite
        Generator: 实现书签 CRUD API
        Generator: 实现前端列表/添加/编辑/删除
        Generator: git commit
 0:35   Sprint 1 Build 完成 → handoff.md
 0:35   Sprint 1 QA Round 1
        Evaluator: 用 Playwright 打开 localhost:5173
        Evaluator: 测试添加书签 → PASS
        Evaluator: 测试编辑书签 → FAIL (保存后页面不刷新)
        Evaluator: 测试删除书签 → PASS
        → Verdict: FAIL
 0:42   Sprint 1 Fix (Generator 修复 QA 反馈)
 0:55   Sprint 1 QA Round 2 → PASS

 0:55   Sprint 2 开始...
 ...

 ~2:00  所有 Sprint 完成
─────────────────────────────────────────────────────────
```

**预期成本估算**（以 Opus 级别模型为例）：


| 阶段                                  | 预计时长   | 预计成本    |
| ----------------------------------- | ------ | ------- |
| Planner                             | ~5 min | ~$0.50  |
| 5 Sprints x (Contract + Build + QA) | ~2 hrs | ~$40-80 |
| 总计                                  | ~2 hrs | ~$40-80 |


### 10.6 查看产出物

运行完成后，查看产出：

```bash
# 查看 Planner 产出的产品 Spec
cat artifacts/spec.md

# 查看某个 Sprint 的合同
cat artifacts/sprint-1-contract-final.md

# 查看某个 Sprint 的 QA 报告 (这里最有价值——看 Evaluator 找到了什么 bug)
cat artifacts/sprint-1-qa-round-1.md

# 查看项目代码
ls project/
cd project && git log --oneline  # 查看 Generator 的 commit 历史

# 启动应用查看最终效果
cd project
# 前端
cd frontend && npm install && npm run dev &
# 后端
cd ../backend && pip install -r requirements.txt && uvicorn main:app --reload &

# 打开浏览器访问 http://localhost:5173
```

**关键产出文件一览**：


| 文件                                     | 内容             | 审查重点                          |
| -------------------------------------- | -------------- | ----------------------------- |
| `artifacts/spec.md`                    | 完整产品规格         | Planner 是否足够有野心？Feature 是否合理？ |
| `artifacts/sprint-N-contract-final.md` | Sprint 合同      | 验收标准是否具体、可测？                  |
| `artifacts/sprint-N-handoff.md`        | Generator 交付报告 | 自我评估是否诚实？                     |
| `artifacts/sprint-N-qa-round-R.md`     | QA 报告          | Evaluator 是否足够严格？bug 描述是否具体？  |
| `project/`                             | 应用源码           | 最终产品质量                        |


### 10.7 V2 简化版 Demo

如果使用更强的模型（如 Opus 4.6），可以简化为无 Sprint 分解的版本。只需修改 `main.py`：

```python
async def run_harness_v2(user_prompt: str, budget: float = 150.0):
    """Simplified V2 harness: Planner → Build → QA (no sprint decomposition)."""

    ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)
    PROJECT_DIR.mkdir(parents=True, exist_ok=True)

    tracker = CostTracker(budget=budget)

    # Phase 1: Planning (same as V1)
    print("=" * 60)
    print("  V2 HARNESS — PLANNING")
    print("=" * 60)
    spec = await run_planner(user_prompt, ARTIFACTS_DIR)

    # Phase 2: Build entire app in one pass (no sprint decomposition)
    print(f"\n{'=' * 60}")
    print("  V2 HARNESS — BUILDING (full app, single pass)")
    print(f"{'=' * 60}")

    build_response = await _collect_response(
        prompt=(
            f"Build the complete application described in {ARTIFACTS_DIR}/spec.md. "
            "Implement ALL features. Work through them systematically. "
            "Commit each feature to git. Do not stub anything."
        ),
        options=ClaudeAgentOptions(
            system_prompt=GENERATOR_PROMPT.format(
                artifacts_dir=ARTIFACTS_DIR,
                project_dir=PROJECT_DIR,
                sprint_num="all",
                qa_feedback_section="",
            ),
            allowed_tools=["Read", "Write", "Edit", "Bash"],
            cwd=str(PROJECT_DIR),
            max_turns=200,
        ),
    )

    # Phase 3: QA loop on complete app
    for qa_round in range(1, MAX_QA_ROUNDS + 1):
        print(f"\n{'=' * 60}")
        print(f"  V2 HARNESS — QA ROUND {qa_round}")
        print(f"{'=' * 60}")

        result = await run_evaluator(
            contract=spec,
            handoff=build_response,
            sprint_num=0,
            qa_round=qa_round,
            artifacts_dir=ARTIFACTS_DIR,
        )

        if result["passed"]:
            print(f"\n  App PASSED QA (round {qa_round})")
            break
        else:
            print(f"\n  App FAILED QA (round {qa_round}), fixing...")
            build_response = await run_generator(
                contract=spec,
                sprint_num=0,
                artifacts_dir=ARTIFACTS_DIR,
                project_dir=PROJECT_DIR,
                qa_feedback=result["feedback"],
            )

    print(f"\n{'=' * 60}")
    print("  V2 HARNESS COMPLETE")
    print(f"  {tracker.summary()}")
    print(f"{'=' * 60}\n")
```

**V1 vs V2 选择指南**：


| 维度    | V1 (Sprint 分解)  | V2 (单 Pass)                   |
| ----- | --------------- | ----------------------------- |
| 适用模型  | 所有模型            | Opus 4.5+ (无 context anxiety) |
| 任务复杂度 | 高（>10 Feature）  | 中低（<10 Feature）               |
| 总成本   | 较高（合同协商开销）      | 较低                            |
| 过程可控性 | 高（逐 Sprint 可审计） | 低（一次性产出）                      |
| 推荐场景  | 首次使用 / 复杂应用     | 快速原型 / 简单应用                   |




### 10.8 Kimi Code CLI（Kimi Coding）运行方式

本节说明如何用 **Moonshot 的 Kimi Code CLI**（终端里常说的 **Kimi Coding**）跑同一套 Harness：**目录与 `artifacts/` 文件协议不变**，只是把「Python + Claude Agent SDK」换成 `**kimi` 命令** 分阶段执行（或一条长 Prompt + Ralph Loop）。

官方文档：[Kimi Code CLI — Getting Started](https://moonshotai.github.io/kimi-cli/en/guides/getting-started.html)、[kimi Command 参考](https://moonshotai.github.io/kimi-cli/en/reference/kimi-command.html)。

#### 10.8.1 与 Claude Agent SDK 版的关系


| 维度              | Claude Agent SDK（上文 10.3–10.4） | Kimi Code CLI（本节）                           |
| --------------- | ------------------------------ | ------------------------------------------- |
| 运行时             | `python main.py`               | `kimi` / `kimi --print`                     |
| 鉴权              | `ANTHROPIC_API_KEY`            | `kimi login`（OAuth）或配置中的 API Key            |
| 长任务             | Orchestrator 循环                | 分阶段 `--print` 调用，或 `--max-ralph-iterations` |
| MCP（Playwright） | `ClaudeAgentOptions` 里配工具名     | `~/.kimi/mcp.json` 或 `--mcp-config-file`    |
| 工作目录            | `cwd` 指向 `project/`            | `-w` / `--work-dir` 指向 harness 根目录          |


**不变的部分**：`artifacts/spec.md`、`sprint-*-contract-*.md`、`sprint-*-handoff.md`、`sprint-*-qa-*.md`、`project/` 下的代码与 git；Planner / Generator / Evaluator 的**角色与 Prompt 语义**与上文一致，只是由 Kimi 单次会话或多次 `--print` 执行。

#### 10.8.2 安装与登录

```bash
# 推荐：官方一键安装（会装 uv，再装 kimi-cli）
curl -LsSf https://code.kimi.com/install.sh | bash

# 或已有 uv 时
uv tool install --python 3.13 kimi-cli

kimi --version
```

首次使用需登录（与文档中 `/login` 等价）：

```bash
kimi login
```

浏览器完成 OAuth 后，配置会写入默认配置文件（通常为 `~/.kimi/config.toml`，以你本机为准）。也可在交互式会话里执行 `/login` 选择平台与模型。

#### 10.8.3 三种使用形态（按自动化程度）

**形态 A — 交互式（适合调试 Prompt）**

```bash
cd ~/harness-kimi-demo
kimi
```

在会话中按阶段粘贴下文「分阶段 Prompt」，或让模型读取 `artifacts/` 里已有文件。可用 `/add-dir` 扩大工作区。项目若无 `AGENTS.md`，可先执行 `/init` 生成约定说明。

**形态 B — Print 模式（适合脚本化，对应 Python 版的分步调用）**

[Print Mode](https://moonshotai.github.io/kimi-cli/en/customization/print-mode.html)：`--print` 为非交互，并隐式开启自动批准（类似 `--yolo`），适合 CI 或本地 shell 串联。

```bash
cd ~/harness-kimi-demo

kimi --print -w "$(pwd)" -p "$(cat prompts/01-planner.txt)"
# 检查 artifacts/spec.md 后再执行下一阶段，例如：
kimi --print -w "$(pwd)" -p "$(cat prompts/02-sprint1-contract.txt)"
```

将各阶段指令写在 `prompts/*.txt` 中，内容可直接复用本文 **§3** 的 Planner / Generator / Evaluator 模板，并写明「必须写入的路径」：`artifacts/spec.md`、`project/` 等。（若你的 Kimi 版本支持从文件读入 prompt，也可用其文档中的等价写法替代 `cat`。）

**形态 C — Ralph Loop（长任务单条 Prompt 反复迭代）**

Kimi CLI 支持 [Ralph Loop](https://moonshotai.github.io/kimi-cli/en/reference/kimi-command.html#loop-control)：当 `--max-ralph-iterations` 非 0 时，同一任务会多轮执行，直到模型输出 `**STOP`**（含空格）或达到次数上限。可把「按 spec 实现 + 自测 + 修 bug」写进一条系统级说明，用于简化版 Harness（接近上文 V2）。

```bash
kimi --print -w ~/harness-kimi-demo \
  --max-ralph-iterations 20 \
  -p "Read artifacts/spec.md. Implement the app under project/ per spec. Run tests. Output STOP when all acceptance criteria pass or you cannot improve further."
```

注意：Ralph 适合**目标清晰、可自检**的闭环；完整三 Agent + 合同协商仍建议用形态 B 分文件执行，便于审计。

#### 10.8.4 MCP：为 Evaluator 接入 Playwright

Evaluator 需要浏览器工具时，在 Kimi 侧通过 MCP 配置（默认可放在 `~/.kimi/mcp.json`，或用 `--mcp-config-file` 指向专用文件）。示例（与常见 Playwright MCP 启动方式一致，具体以你安装的包为准）：

```json
{
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": ["-y", "@playwright/mcp@latest"]
    }
  }
}
```

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

---

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

---

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

#### 使用方式

```bash
# 全新开始（自动经历 Build → Review → Polish → 完成）
./run-harness-full.sh "Build a personal bookmark manager"

# 从中断恢复
./run-harness-full.sh --resume

# 注入新目标（可在运行中执行，Harness 会在当前 Epoch 结束后自动处理）
./run-harness-full.sh --add-goal "Add dark mode support"
./run-harness-full.sh --add-goal "Add keyboard shortcuts"

# 注入后让 Harness 继续运行
./run-harness-full.sh --resume

# 自定义配置
QUALITY_THRESHOLD=8 MAX_POLISH_ROUNDS=5 MAX_EPOCHS=20 \
  ./run-harness-full.sh "Build a task manager"

# 严格模式（Sprint 失败立即停止）
STRICT_MODE=true ./run-harness-full.sh "Build a ..."
```

### 15.10 配置参数参考


| 参数                  | 默认值   | 说明                           |
| ------------------- | ----- | ---------------------------- |
| `MAX_QA_ROUNDS`     | 3     | 每 Sprint 最大 QA 轮数            |
| `QUALITY_THRESHOLD` | 7.0   | Product Review 质量分达标阈值（1-10） |
| `MAX_POLISH_ROUNDS` | 3     | 每 Epoch 最大打磨轮数               |
| `MAX_EPOCHS`        | 10    | 最大 Epoch 数（防止无限循环）           |
| `STRICT_MODE`       | false | 是否在 Sprint FAIL 后立即停止        |
| `START_FROM_SPRINT` | 1     | 从第几个 Sprint 开始（用于 resume）    |
| `KIMI_EXTRA_ARGS`   | (空)   | 传给 Kimi CLI 的额外参数            |


**阈值建议**：


| 质量分区间 | 含义      | 建议                  |
| ----- | ------- | ------------------- |
| 1-3   | 基本不可用   | 检查 Sprint 是否有严重构建失败 |
| 4-5   | 功能初具但粗糙 | 需要 2-3 轮 Polish     |
| 6-7   | 可用但缺乏打磨 | 需要 1-2 轮 Polish     |
| 7-8   | 质量良好    | 可投入使用，按需 Polish     |
| 8-10  | 惊艳      | 达标，进入 Evolution     |


### 15.11 文档与实现：开发者引用须知

本文档 **可以**作为方法论与落地 Checklist 直接引用，但请区分三层含义，避免「抄文档却跑不通」：


| 层级                               | 内容                                                            | 引用方式                                               |
| -------------------------------- | ------------------------------------------------------------- | -------------------------------------------------- |
| **A. 方法论**                       | §1–§8、§11–§14（Context、对抗式 QA、文件协议等）                           | 与具体语言/运行时无关；可独立用于评审架构与 Prompt 设计                   |
| **B. 参考实现（Python / Claude SDK）** | §9–§10.7 中的 Orchestrator、伪代码                                  | 说明 Anthropic 原文思路；**不等同于**本仓库默认入口                  |
| **C. 本仓库可运行 Harness**            | `harness-kimi-demo/run-harness-full.sh` + §10.8 Kimi、`§15` V2 | **以脚本与 `prompts/templates/` 为准**；文档若与脚本不一致，以脚本行为为准 |


**已知易错点（已在上文部分修正）**：

1. **§15 与 §9**：§9 描述 Python Agent SDK 编排；实际 Kimi 路径为 **Shell + `kimi --print`**（§10.8、§15.9）。新开发者应优先阅读 `harness-kimi-demo/run-harness-full.sh` 头部注释与 `prompts/templates/` 内模板。
2. **质量分**：加权逻辑在 **Reviewer 输出**中体现；`quality-gate.sh` 只解析 `Overall Quality Score` 一行。
3. **退出条件**：默认 **质量未达标也会结束本次运行**（除非继续 `--resume` 或改阈值/清 artifact 重跑），与「必须刷到 7 分才结束」不同。
4. **目录锚点**：部分 Markdown 渲染器对中文标题生成的锚点与 GitHub 不完全一致；若目录链接失效，请用编辑器大纲或全文搜索章节号。

**结论**：适合给开发者作 **设计与评审基准**；落地 **命令行与文件路径**请以 `harness-kimi-demo/` 仓库内实现为准，并把 §15 视为该实现的说明文档而非第二份源码。

---

## 附录 A：Planner 产出示例

以下为原文 Planner 对 "Create a 2D retro game maker" 的产出节选：

```text
RetroForge - 2D Retro Game Maker

Overview
RetroForge is a web-based creative studio for designing and building 2D
retro-style video games. It combines the nostalgic charm of classic 8-bit
and 16-bit game aesthetics with modern, intuitive editing tools — enabling
anyone from hobbyist creators to indie developers to bring their game ideas
to life without writing traditional code.

The platform provides four integrated creative modules: a tile-based Level
Editor for designing game worlds, a pixel-art Sprite Editor for crafting
visual assets, a visual Entity Behavior system for defining game logic,
and an instant Playable Test Mode for real-time gameplay testing. By weaving
AI assistance throughout (powered by Claude), RetroForge accelerates the
creative process — helping users generate sprites, design levels, and
configure behaviors through natural language interaction.

Features
1. Project Dashboard & Management
User Stories: As a user, I want to:
- Create a new game project with a name and description
- See all my existing projects displayed as visual cards
- Open any project to enter the full game editor workspace
- Delete projects I no longer need, with a confirmation dialog
- Duplicate an existing project as a starting point for a new game

Project Data Model: Each project contains:
- Project metadata (name, description, created/modified timestamps)
- Canvas settings (resolution: e.g., 256x224, 320x240, or 160x144)
- Tile size configuration (8x8, 16x16, or 32x32 pixels)
- Color palette selection
- All associated sprites, tilesets, levels, and entity definitions

[... 15 more features organized across 10 sprints ...]
```

---

## 附录 B：Evaluator 发现问题示例

以下为原文 Evaluator 在 Retro Game Maker 项目中的真实发现：


| Contract Criterion                                                                  | Evaluator Finding                                                                                                                                                                                                                                          |
| ----------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Rectangle fill tool allows click-drag to fill a rectangular area with selected tile | **FAIL** — Tool only places tiles at drag start/end points instead of filling the region. `fillRectangle` function exists but isn't triggered properly on `mouseUp`.                                                                                       |
| User can select and delete placed entity spawn points                               | **FAIL** — Delete key handler at `LevelEditor.tsx:892` requires both `selection` and `selectedEntityId` to be set, but clicking an entity only sets `selectedEntityId`. Condition should be `selection || (selectedEntityId && activeLayer === 'entity')`. |
| User can reorder animation frames via API                                           | **FAIL** — PUT `/frames/reorder` route defined after `/{frame_id}` routes. FastAPI matches 'reorder' as a `frame_id` integer and returns 422: "unable to parse string as an integer."                                                                      |


---

## 附录 C：参考资料

1. [Harness design for long-running application development](https://www.anthropic.com/engineering/harness-design-long-running-apps) — Anthropic Engineering, 2026-03-24
2. [Building Effective Agents](https://www.anthropic.com/research/building-effective-agents) — Anthropic
3. [Context Engineering](https://www.anthropic.com/engineering/context-engineering) — Anthropic Engineering
4. [Claude Agent SDK](https://docs.anthropic.com/en/docs/agents) — Anthropic Documentation
5. [Playwright MCP](https://github.com/anthropics/anthropic-tools/tree/main/playwright-mcp) — Anthropic Tools

---

*本文档基于 Anthropic Engineering 公开博客整理，结合实际落地需求形成可执行方案。V2 Multi-Epoch Evolution 架构于 2026-04-19 新增。最后更新：2026-04-19。*