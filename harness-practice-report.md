# Multi-Agent Harness 工程实践：从 Prompt 到全栈应用的自动化编排框架

> **摘要**：本文深入拆解了一个基于 Anthropic Harness 设计思想实现的自动化 AI 编码编排框架。核心贡献不是某个具体应用，而是**可复用的工程化方案**：三 Agent 架构（Planner + Generator + Evaluator）+ 文件通信协议 + 状态机编排 + 四层 Prompt 渲染系统。文章包含完整的 Prompt 模板、状态流转设计、踩坑实录和性能优化方案，为希望落地长时间 AI 编码的开发者提供可直接参考的工程实现。

---

## 1. 核心问题：为什么需要 Harness 框架

让大模型完成一个复杂的全栈应用，真正的瓶颈不是"生成代码的速度"，而是**两个系统性失败模式**：

**Context Anxiety（上下文焦虑）**：当对话历史逐渐填满上下文窗口时，模型会丧失连贯性。部分模型甚至在接近上限时就过早收尾——即便实际任务远未完成。

**Self-Evaluation Bias（自我评估偏差）**：模型评估自己产出时倾向于自信地给出好评。Anthropic 的实验发现，即使代码在人类看来明显平庸，模型也会给自己打高分。这个偏差在前端设计等主观任务上尤为突出。

**核心洞察**："做事的 Agent"和"评判的 Agent"必须物理分离。受 GAN 启发，Harness 架构采用 **Planner → Generator ↔ Evaluator** 的对抗循环，通过 Orchestrator 状态机编排整个流程。

为了验证这个架构的工程可行性，我们构建了一个**自动化 Harness 框架**，并以"个人书签管理器"作为验证场景。本文的核心是框架本身的实现，书签应用仅是运行实例。

---

## 2. 架构设计：三 Agent + Orchestrator + 文件通信

### 2.1 系统架构

```
┌───────────────────────────────────────────────────────────┐
│                      Orchestrator                         │
│         状态机 + Agent 调度 + Prompt 渲染 + 成本控制        │
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

### 2.2 文件通信协议

Agent 之间**不通过内存或 API 传递状态**，而是通过文件系统通信。这是整个框架最稳健的设计决策：

| 文件 | 生产者 | 消费者 | 作用 |
|------|--------|--------|------|
| `spec.md` | Planner | Generator, Evaluator | 产品规格总纲 |
| `sprint-N-contract-final.md` | Contract Agent | Generator | Sprint 边界与验收标准 |
| `sprint-N-handoff.md` | Generator | Orchestrator | 交付物清单与自检报告 |
| `sprint-N-qa-round-M.md` | Evaluator | Generator | QA 报告与 Bug 清单 |
| `product-review-epoch-N.md` | Reviewer | Polish Generator | 全站质量评估与改进清单 |
| `harness-state.json` | Orchestrator | 所有 Agent | 运行时状态机 |

**优势**：
- **断点续跑**：进程崩溃后重新 resume，Agent 从文件读取上下文继续
- **人工干预**：开发者可直接修改 contract 或 QA 报告，引导 Agent 行为
- **事后审计**：完整的文件历史记录了整个开发过程

### 2.3 Agent 职责边界

**Planner**：将用户的一句话需求扩展为完整的产品规格。关键设计是**"约束交付物而非路径"**——只定义产品做什么、数据模型是什么、视觉风格如何，不指定具体函数名和文件结构。

**Generator**：按 Contract 实现代码。每轮 Sprint 前必须与 Evaluator 协商合同，明确"做什么"和"不做什么"。

**Evaluator**：通过 **Playwright MCP** 实际操作页面进行端到端测试。它不是静态代码审查，而是**运行时验证**——点击按钮、填写表单、检查网络请求、截图留证。

---

## 3. Prompt 工程：四层 Prompt 渲染系统

Prompt 不是静态文本，而是**动态渲染模板**。框架的核心工程工作之一是构建了一个完整的 Prompt 渲染系统（`lib/render-prompt.sh`），支持变量替换、上下文收集和跨 Sprint 状态注入。

### 3.1 渲染引擎

```bash
render_prompt() {
  local template_file="$1"
  shift
  local content
  content="$(cat "$template_file")"
  while [[ $# -gt 0 ]]; do
    local key="$1" val="$2"
    content="${content//$key/$val}"   # bash 字符串替换
    shift 2
  done
  echo "$content"
}
```

所有 Agent 的 Prompt 都通过此引擎渲染，支持以下变量注入：

### 3.2 Planner Prompt：从一句话到产品规格

```text
You are a senior product manager and technical architect.

## RULES
1. Be AMBITIOUS about the VISION, but DISCIPLINED about Sprint scope.
2. Focus on PRODUCT CONTEXT and HIGH-LEVEL TECHNICAL DESIGN.
   Do NOT specify granular implementation details.
3. Weave AI-powered features into the product where natural.
4. Include a VISUAL DESIGN DIRECTION section.
5. Organize features into exactly 3 CORE sprints.
6. Quality over Quantity: 3 polished sprints > 5 shallow ones.

## OUTPUT FORMAT (strict Markdown, written to artifacts/spec.md)

# {Project Name}
## Overview
## Design Language
## Features
### Sprint 1: {Title}
*Goal: [one-line goal]*
#### Feature 1.1: {Name}
**User Stories:**
- As a user, I want to ... so that ...
**Acceptance Criteria:**
- [ ] Criterion (concrete, binary pass/fail)
**Polish Criteria:**
- [ ] Loading skeleton while data loads
- [ ] Empty state with illustration and CTA
- [ ] Smooth CSS transitions
- [ ] Responsive: works on 375px, 768px, 1440px
```

**设计要点**：
- 强制"3 个核心 Sprint"，避免范围蔓延
- 每个 Sprint 包含 **Polish Criteria**（加载状态、空状态、动画、响应式），在编码前就把质量要求写入规格
- 不指定实现细节，让 Generator 有决策空间

### 3.3 Generator Prompt：编码上下文的三维注入

Generator 的 Prompt 不是静态模板，而是**动态组装的三维上下文**：

```text
You are a senior full-stack engineer building a production-quality application.

## CONTEXT
- Product Spec: artifacts/spec.md
- Sprint Contract: artifacts/sprint-__SPRINT_NUM__-contract-final.md
__QA_FEEDBACK_LINE__          ← 动态：仅 Fix 轮次注入
__UNRESOLVED_BUGS__           ← 动态：跨 Sprint 缺陷收集
__VISUAL_CONTEXT__            ← 动态：截图路径列表

## TECH STACK
- Frontend: React 18 + Vite + TypeScript + Tailwind CSS
- Backend: FastAPI + SQLite

## WORKFLOW
1. Read spec.md AND contract — understand every acceptance criterion.
2. **If UNRESOLVED BUGS exist, fix ALL of them FIRST.**
3. Build on existing code (Sprint 2+).
4. Follow the Design Language EXACTLY.
5. Run build/test to verify no errors.
6. Commit changes to git.
7. Write handoff to artifacts/sprint-N-handoff.md.

## PRINCIPLES
- NEVER stub features — implement them fully.
- Working software over perfect code.
- If fixing QA bugs, focus on root cause, not symptom.
```

**三维注入详解**：

**维度 1：QA Feedback Line**
仅在 Generator Fix 时注入：
```text
- QA Feedback to fix: artifacts/sprint-3-qa-round-1.md
```

**维度 2：Unresolved Bugs（跨 Sprint 缺陷收集）**
通过 `collect_unresolved_bugs()` 函数，自动扫描之前所有 Sprint 的 QA 报告，提取仍未修复的 Bug：

```bash
collect_unresolved_bugs() {
  # 遍历 sprint-1 到 sprint-(current-1) 的所有 QA 报告
  # 只提取 Overall Verdict = FAIL 的报告中的 Bug 列表
  # 注入到 Generator Prompt 中作为前置修复任务
}
```

这是防止"技术债务累积"的关键机制。如果 Sprint 2 的某个 Bug 一直未修复，Sprint 5 的 Generator 会在 Prompt 中看到它并被要求优先处理。

**维度 3：Visual Context（截图上下文）**
通过 `collect_visual_context()` 函数，收集最近 10 张截图路径注入 Prompt：

```bash
collect_visual_context() {
  screenshots="$(ls -t artifacts/screenshots/*.png | head -10)"
  # 注入为 Markdown 列表，让 Generator 了解当前视觉状态
}
```

这让 Generator 在修改代码前"看到"当前应用的样子，避免视觉风格漂移。

### 3.4 Evaluator Prompt：运行时验证的严格纪律

Evaluator 是框架中最复杂的 Prompt，因为它需要操作真实浏览器：

```text
You are a STRICT, SKEPTICAL QA engineer with live browser testing powers.

## CRITICAL RULES
1. FIGHT your natural leniency. "Almost right" means WRONG.
2. Do NOT rationalize away problems.
3. Test EVERY interactive element, not just the happy path.
4. You MUST use Playwright MCP tools for UI verification.
   Pure code review without browser evidence is NOT acceptable.

## WORKFLOW (MANDATORY ORDER)
1. Read sprint contract (acceptance criteria).
2. Read generator handoff (self-report).
3. Read source code to verify implementation claims.
4. Build / typecheck: cd project && npm run build.
5. LIVE BROWSER TESTING with Playwright MCP:
   a. browser_navigate to http://localhost:5173
   b. browser_snapshot for DOM/accessibility tree
   c. For EACH criterion: click, fill, submit, navigate
   d. browser_console_messages — red errors = FAIL
   e. browser_network_requests — verify API 2xx
   f. browser_take_screenshot as evidence
6. Backend API tests with browser_evaluate + fetch.
7. Score each criterion PASS/FAIL with CONCRETE evidence.
8. REGRESSION CHECK (Sprint 2+):
   Spot-check key flows from prior sprints.
   If ANY previously-passing criterion fails → [REGRESSION] bug.
9. browser_close when done.

## HARD FAILURE RULES
- Server unreachable → overall verdict = FAIL
- Uncaught JS error in console → that criterion FAILs
- UI criterion verified ONLY by reading code (no browser evidence) → FAIL

## SCORING DIMENSIONS
| Dimension      | Threshold |
|----------------|-----------|
| Product Depth  | 6/10      |
| Functionality  | 7/10      |
| Visual Design  | 5/10      |
| Code Quality   | 5/10      |
```

**设计要点**：
- **强制浏览器验证**：不允许纯代码审查，必须有 Playwright 截图/网络请求证据
- **回归检查**：Sprint 2+ 必须验证之前 Sprint 的核心流程未被破坏
- **四级阈值评分**：Product Depth 6/10、Functionality 7/10、Visual Design 5/10、Code Quality 5/10

### 3.5 Reviewer Prompt：产品级体验评估

Reviewer 与 Evaluator 的区别：Evaluator 检查"是否符合 Contract"，Reviewer 评估"作为真实产品的体验"。

```text
You are a RUTHLESS product critic and UX expert.

## WORKFLOW (MANDATORY)

### Phase 1: Full-Site Walkthrough
1. browser_navigate to every page.
2. browser_snapshot + browser_take_screenshot for each.
3. Try every interactive element.
4. Check responsive: 375px, 768px, 1440px.
5. browser_console_messages + browser_network_requests.

### Phase 2: Core User Journey Testing
Test end-to-end flows as a real user would.

### Phase 3: Score on 10 Dimensions
| Dimension | What to Evaluate |
|-----------|------------------|
| Visual Polish | Color, spacing, typography, dark mode |
| UX Flow | Navigation, CTAs, loading states, errors |
| Feature Completeness | Do promised features actually work? |
| Responsiveness | Mobile/tablet/desktop, no overflow |
| Error Handling | Bad input, network errors, empty states |
| Performance | Page load, interaction responsiveness |
| Data Integrity | CRUD persists, no data loss on refresh |
| Cross-Feature Integration | Search + filter + pagination |
| Design System Consistency | Same components reused |
| "Wow Factor" | Animations, micro-interactions, smart defaults |

### Phase 4: Generate Improvement Backlog
Rank by: impact × feasibility
```

**设计要点**：
- **10 维度评分**，Feature Completeness 和 UX Flow 双倍加权
- **P0/P1/P2 优先级改进清单**，附带具体文件路径和修改建议
- **Top 3 Quick Wins**（30 分钟内可修复）和 **Top 3 Deep Improvements**（需专注 Sprint）

---

## 4. State 状态机：Harness 的编排心脏

状态机存储在 `artifacts/harness-state.json`，由 `lib/state.sh` 管理。

### 4.1 状态结构

```json
{
  "phase": "building",
  "epoch": 3,
  "epoch_type": "polish",
  "current_sprint": 5,
  "total_sprints": 5,
  "qa_round": 2,
  "max_qa_rounds": 3,
  "budget": 200,
  "user_goal": "Build a personal bookmark manager...",
  "goal_queue": ["Add AI tag suggestions..."],
  "quality_scores": [
    {"epoch": 3, "score": 5.0},
    {"epoch": "3.1", "score": 6.2},
    {"epoch": "3.5", "score": 6.3}
  ],
  "polish_round": 3,
  "total_polish_rounds": 3
}
```

### 4.2 Phase 流转

```
planning → planning_done → sprint_contract → building → qa → qa_fix → ...
    ↓
review → review_failed → polishing → polish_build → polish_qa → ...
    ↓
complete / blocked
```

### 4.3 resume 逻辑的关键陷阱

脚本中 `SKIP_BUILD` 的判断直接决定 resume 时是否重新跑 Generator：

```bash
current_phase="$(state_get phase)"
if [[ "$current_phase" == "review" || "$current_phase" == "review_failed" || \
      "$current_phase" == "polishing" || "$current_phase" == "polish_build" || \
      "$current_phase" == "polish_qa" ]]; then
    SKIP_BUILD=true
    echo "  [SKIP] Build phase — resuming from ${current_phase} phase."
fi
```

**严重缺陷**：`complete` 和 `blocked` 不在 `SKIP_BUILD` 列表中！这意味着如果 Harness 正常结束（`phase=complete`）后 resume，会**重新遍历所有 Sprint**，而缺少 `handoff.md` 的 Sprint 会被重新实现，**覆盖已有代码**。

** workaround**：resume 前手动创建缺失的 `handoff.md` placeholder，或修改状态 `phase=review`。

---

## 5. Quality Gate：从 Review 到 Polish 的闭环

`lib/quality-gate.sh` 负责解析 Reviewer 报告、判断质量阈值、驱动 Polish 循环。

### 5.1 分数提取

```bash
extract_quality_score() {
  # 支持多种格式匹配：
  # "Overall Quality Score: 6.3 / 10"
  # "Overall Quality Score: 6.3"
  # "**Overall Quality Score**: 6.3"
  python3 -c "
import re
patterns = [
    r'Overall Quality Score:\s*([\d.]+)\s*/\s*10',
    r'Overall Quality Score:\s*([\d.]+)',
    r'\*\*Overall Quality Score\*\*:\s*([\d.]+)',
]
"
}
```

### 5.2 改进清单解析

```bash
count_backlog_items() {
  # 从 Improvement Backlog 表格中统计 P0/P1/P2 行数
  rows = re.findall(r'^\|\s*P\d', text, re.MULTILINE)
}

extract_top_backlog() {
  # 提取 Top N 改进项，供 Polish Contract 使用
}
```

### 5.3 Polish 闭环

```
Reviewer → Quality Score < Threshold?
    ↓ yes
Polish Contract Generator → extract_top_backlog(review, 5)
    ↓
Polish Generator implements fixes
    ↓
Re-reviewer checks quality
    ↓
Score improved? → repeat up to MAX_POLISH_ROUNDS
```

---

## 6. 执行实录：框架运行过程（以书签项目为例）

以下时间线展示框架如何驱动一个完整项目。书签管理器只是验证场景，重点观察**框架各组件的协作**。

### 6.1 宏观时间线

| 阶段 | 框架行为 | 耗时 |
|------|---------|------|
| Sprint 1-5 Build | Planner → Contract ×5 → Generator ×5 → QA ×5 | ~3-4 天 |
| Polish 1-5 | Reviewer → Polish Contract → Polish Generator → Re-reviewer | ~1.5 天 |
| Evolution | 手动追加 Sprint 6/7 → Generator ×2 → QA ×2 | ~1 天 |
| **总计** | — | **~6 天**（含 21h QA 卡住） |

### 6.2 Sprint 级别数据

| Sprint | Contract | Generator | QA 轮次 | Fix 轮次 | 结果 |
|--------|----------|-----------|---------|----------|------|
| 1 | 3.6 KB | 1 commit | 1 | 0 | ✅ 一次过 |
| 2 | 6.5 KB | 1 commit | 2 | 1 | ⚠️ Fix deprecation |
| 3 | 6.4 KB | 1 commit | 4 | 2 | ❌ 最多轮次 |
| 4 | 6.7 KB | 1 commit | 1 | 0 | ✅ 一次过 |
| 5 | 9.7 KB | 1 commit | 2 | 1 | ⚠️ Fix nav link |
| 6 | 7.2 KB | 1 + 2 Fix | 3 | 2 | ❌ QA 卡住 |
| 7 | 7.0 KB | 1 + 2 Fix | 2+ | 2 | ❌ QA 卡住 |

**规律**：后端/API Sprint（2,3,5,6,7）QA 轮次显著多于纯前端 Sprint（1,4）。Evaluator 对 API 行为的验证更严格。

### 6.3 Polish 质量走势

| 阶段 | Reviewer 分数 | 变化 |
|------|--------------|------|
| Epoch 3 初始 | 5.0 | — |
| Polish 1 | 6.2 | ↑1.2 |
| Polish 3 | 6.0 | ↓0.2 |
| Polish 5 | **6.3** | ↑0.3 |
| **阈值** | **7.0** | ❌ 始终未达标 |

Reviewer 指出的核心短板是**功能完整性**（P0：无缩略图、无 URL 自动抓取）。这恰恰验证了框架的价值——Polish 无法弥补功能缺失，需要 Evolution 新增 Sprint。

---

## 7. 深度踩坑：五大工程挑战

### 7.1 QA Evaluator 超时黑洞（最严重）

**现象**：Sprint 6/7 的 QA Round 3 各卡住 **21 小时以上**。

**日志特征**：
```
StepBegin(n=95)
...
StepBegin(n=99)
58 × waiting for element to be visible, enabled and stable
```

**根因**：
1. Playwright MCP 在元素不可见时进入重试循环
2. `--max-steps-per-turn 100` 限制每轮 turn 步骤，但 Evaluator 会发起多轮 turn
3. 脚本层无 Agent 级超时机制

**解决**：降低 `--max-steps-per-turn` 至 **30-50**，脚本层增加 30 分钟超时 `kill`。

### 7.2 Resume 状态的隐藏陷阱

**现象**：`phase=complete` 时 resume 会重新遍历 Sprint，覆盖已有代码。

**根因代码**：
```bash
# complete 不在 SKIP_BUILD 列表中
if [[ "$current_phase" == "review" || ... ]]; then
    SKIP_BUILD=true
fi
```

**解决**：resume 前创建缺失的 `handoff.md` placeholder，或修改 `phase=review`。

### 7.3 认证波动导致 Evolution 失败

**现象**：Evolution Planner 运行 1 秒后 `401 Invalid Authentication`。

**影响链**：目标从队列弹出 → spec.md 未更新 → Harness 直接结束。

**应急解决**：手动在 `spec.md` 追加 Sprint，修改状态 `current_sprint=6` 后 resume。

### 7.4 Artifact 文件名不一致

**现象**：Reviewer 写 `epoch-3.1.md`，脚本期望 `epoch-3-polish-1.md`。

**日志**：
```
[kimi] Re-review after Polish 1 — attempt 2 failed (exit=0, artifact=MISSING)
[kimi] Re-review after Polish 1 — retry 3/3 after 10s cooldown...
```

**根因**：Prompt 中指定的输出文件名与脚本硬编码的检测文件名不一致。3 次重试浪费 **30-45 分钟**。

**解决**：脚本增加了 `mv` 重命名回退逻辑，但应在 Prompt 中强制要求正确文件名。

### 7.5 Context 膨胀与日志混乱

**现象**：单轮 Evaluator 产生 **30 万行日志**，90% 是 base64 截图数据。

**解决**：Agent 独立日志文件 + 截图外存（非内联 base64）。

---

## 8. 性能优化：三级压缩方案

基于 QA + Fix 占总时间 **55%** 的分析，提出可落地的压缩方案：

### 8.1 轻度压缩（质量有保障）

```bash
MAX_QA_ROUNDS=2 QUALITY_THRESHOLD=6.5 MAX_POLISH_ROUNDS=2
```

**效果**：总时间减少 **30-40%**。

### 8.2 中度压缩（功能优先）

```bash
MAX_QA_ROUNDS=1 QUALITY_THRESHOLD=6.0 MAX_POLISH_ROUNDS=1
```

**效果**：总时间减少 **50-60%**。QA 只跑 1 轮，不通过也不修复。

### 8.3 极限压缩（只 Build，不 Review）

修改脚本 `--max-steps-per-turn 30`：

```bash
MAX_QA_ROUNDS=1 QUALITY_THRESHOLD=5.0 MAX_POLISH_ROUNDS=0
```

**效果**：总时间减少 **70-80%**。

### 8.4 长期脚本优化清单

| 优化项 | 优先级 | 预估收益 |
|--------|--------|---------|
| Evaluator 30 分钟超时 | P0 | 避免 21h 卡住 |
| 修复 `phase=complete` resume 逻辑 | P0 | 避免重复 Build |
| `--max-steps-per-turn` 降至 30-50 | P1 | 减少 30% QA 时间 |
| Agent 独立日志文件 | P1 | 提升可观测性 |
| 截图外存（非 base64） | P2 | 减少 90% 日志体积 |

---

## 9. 总结与展望

### 9.1 核心结论

1. **Harness 架构的工程化是可行的**：文件通信协议 + 状态机 + Prompt 渲染系统构成了可复用的编排框架。

2. **Prompt 设计比模型选择更重要**：Evaluator 的"必须浏览器验证"、Generator 的"先修 Bug 再实现"、Planner 的"Polish Criteria"——这些约束直接决定了产出质量。

3. **Evaluator 是最大瓶颈**：Playwright MCP 的可靠性决定框架可用性。当前缺乏超时控制和步骤限制。

4. **State 管理是最脆弱的环节**：resume 逻辑的一个小遗漏（`complete` 不在 `SKIP_BUILD` 中）就能导致代码被覆盖。

### 9.2 可复用的工程资产

本文对应的完整实现已开源，包含：
- **8 个 Prompt 模板**（Planner / Contract / Generator / Generator-Fix / Evaluator / Reviewer / Polish-Contract / Polish-Generator）
- **6 个 Shell 库**（state / render-prompt / parse-sprints / check-verdict / quality-gate / restart-servers）
- **主编排脚本** `run-harness-full.sh`（~700 行，支持 resume / add-goal / evolution）
- **状态文件协议** `harness-state.json`

### 9.3 未来方向

1. **分层 QA**：单元测试（pytest）→ 集成测试 → E2E（Playwright）。当前过度依赖 E2E。
2. **Evaluator 并行化**：Visual / UX / Feature 多维度并行评估。
3. **Human-in-the-loop**：Contract 协商后、QA 失败后引入人工确认节点。
4. **增量 Spec 更新**：Evolution 模式改为增量补丁，避免重写整个 `spec.md`。

---

> **写在最后**：AI 编码的瓶颈不在"生成速度"，而在"验证可靠性"。Harness 框架提供了一套可落地的验证基础设施，但要在工程中真正可用，还需要在超时控制、日志可观测性、状态恢复等"基础设施"上持续投入。希望本文的 Prompt 模板、状态机设计和踩坑经验能为正在探索长时间 AI 编码的开发者提供参考。
