# Kimi CLI Harness

编排脚本与 Prompt 模板位于本目录；运行 Kimi 时**工作目录**为「工作区」`WORK_ROOT`（本目录或历史仓库下的 `.harness`）。

## 脚本入口

- **`run-harness-full.sh`**（推荐）：多 Epoch 编排（构建 → 产品评审 → Polish → 演进队列），支持 `--project` / `--resume` / `--add-goal`。
- **`run-harness-kimi.sh`**：较早的单线流程（Planner → Contract → Generator…），仅在本目录树内使用；新需求优先用 `run-harness-full.sh`。
- **`continue-harness.sh`**：在已有 `spec.md` / 合同基础上，从指定 Sprint 重跑 Generator + QA（见下文）。

## 架构与能力

### `SCRIPT_DIR` 与 `WORK_ROOT`

| 变量含义 | 路径 | 用途 |
|----------|------|------|
| `SCRIPT_DIR` | 本脚本所在目录（即 `harness-kimi/`） | 读取 [`prompts/templates/`](prompts/templates)、[`config/playwright-mcp-isolated.json`](config/playwright-mcp-isolated.json)；**始终不变**，与外仓无关。 |
| `WORK_ROOT` / `ROOT` | 未指定外仓时为 `SCRIPT_DIR`；外仓时为 `$REPO/.harness` | Kimi `-w`、当前目录、`artifacts/`、`project`（代码树）所在根。 |

评测阶段传给 Kimi 的 MCP 配置路径为 **`${SCRIPT_DIR}/config/playwright-mcp-isolated.json`**，确保 Playwright 设置来自 harness 包，而非业务仓库。

### Epoch、状态与断点

- 编排逻辑见 [`run-harness-full.sh`](run-harness-full.sh) 顶部注释：Build（Planner → Sprint 循环与 QA）→ Product Review → Polish → 演进队列；可通过 `QUALITY_THRESHOLD`、`MAX_POLISH_ROUNDS`、`MAX_EPOCHS` 等约束循环。
- 运行时状态写在 **`artifacts/harness-state.json`**（`phase`、`epoch`、`current_sprint`、`goal_queue` 等），支持 **`--resume`**。追加需求用 **`--add-goal`**（需与此前相同的 `--project`，否则会指错工作区）。
- **`continue-harness.sh`** 仅重置指定区间的 handoff/QA，并 **`exec`** 本目录下的 **`run-harness-full.sh --resume`**（若传入 `--project` 则一并传递给主脚本），不改变上述整体设计。

### 外仓模式下的「现有栈」提示

使用 `--project` / `HARNESS_PROJECT_ROOT` 时，[`lib/render-prompt.sh`](lib/render-prompt.sh) 会对**业务仓库根目录**做轻量扫描（如 `package.json`、Maven/Gradle、`requirements.txt` / `pyproject.toml`、`go.mod`、`Cargo.toml`、`.sql`、`Dockerfile` 等），生成摘要注入 Planner（[`planner.txt`](prompts/templates/planner.txt)），引导在既有技术栈上迭代。**Planner 侧探测到的栈若未有对应的自动重启分支（如下文），你需要自行保证 dev server 可用。**

### Evaluator：构建命令与浏览器

- `detect_build_command`（见 [`lib/render-prompt.sh`](lib/render-prompt.sh)）根据 `project/` 下出现的 `pom.xml`、`build.gradle*` 或 `package.json` 生成 **`__BUILD_CMD__`**（如 `mvn clean compile`、`./gradlew build`、`npm run build`），写入 [`evaluator.txt`](prompts/templates/evaluator.txt)。
- QA 使用 Playwright MCP（浏览器实操）。Prompt 中的示例 URL（如 `localhost:5173`、`localhost:8000`）仅为典型值；**实际端口与路由以你的项目配置为准**，模板亦会提示核对 `vite.config`、`package.json`、Spring 端口等。

### `restart-servers`（`lib/restart-servers.sh`）

QA 前可调用 **重启后端 + 前端**，便于测到最新代码：

| 类型 | 探测方式 | 行为摘要 |
|------|-----------|----------|
| Python / FastAPI | `project/backend/main.py` 或 `project/main.py` | `uvicorn`，默认监听 **`127.0.0.1:8000`**，`/docs` 就绪探测 |
| Java Maven | `project/` 下最多两层 `pom.xml` | `mvn spring-boot:run`，端口 **`8080`**，`/actuator/health` 或 `/health` |
| Java Gradle | 同上 `build.gradle*` | `./gradlew bootRun`，端口 **`8080`**，健康检查同上 |
| 前端 | `project/` 下最多两层 **`package.json`** | `npm run dev`，停止旧进程并释放 **5173 / 3000 / 4200 / 8081**，启动后依次探测 **5173 → 3000 → 8081** |

若以上均未匹配，脚本会跳过对应一侧并打印提示；**Go/Rust 等仅在 Planner 探测中出现时**，不会由此脚本自动拉起，需你自己启动服务后再跑 Harness。

此外，评测前会 **`kill_playwright`**：结束遗留 Playwright MCP / headless Chromium 并尝试释放 CDP 端口 **9222**，降低 MCP 会话死锁概率。

### Kimi 调用重试

`run_kimi` / `run_kimi_with_browser` 在失败时会按 **`KIMI_MAX_RETRIES`**、**`KIMI_RETRY_DELAY`** 重试（应对网络或 CLI 偶发错误），见下表。

## 对本地 Git 仓库做迭代（历史项目无 harness 树）

在**本目录**执行（不要 `cd` 进业务仓库再跑）：

```bash
./run-harness-full.sh --project /绝对路径/你的git仓库 "本轮要迭代的功能或需求描述"
```

等价方式：

```bash
export HARNESS_PROJECT_ROOT=/绝对路径/你的git仓库
./run-harness-full.sh "需求描述…"
```

会在该仓库下创建 **`.harness/`**（含 `artifacts/` 与指向仓库根的 `project` 符号链接），Kimi 的 `-w` 与状态文件均在此目录下。建议将 `.harness/` 或其中 `artifacts/` 加入该仓库的 `.gitignore`。

断点续跑、追加目标与工具包内运行方式相同，**续跑时必须带上同一 `--project`**，否则状态会指错目录：

```bash
./run-harness-full.sh --project /path/to/repo --resume
./run-harness-full.sh --project /path/to/repo --add-goal "下一个需求"
./run-harness-full.sh --project /path/to/repo --resume
```

## 仅在本 demo 内运行（与旧版一致）

不传 `--project` / `HARNESS_PROJECT_ROOT` 时，工作区即本 `harness-kimi` 目录：

```bash
./run-harness-full.sh "Build a …"
./run-harness-full.sh --resume
```

## 从指定 Sprint 重跑（continue-harness）

不传 Sprint 参数时，**默认从 Sprint 5** 再跑一轮（适合修最后几段）；也可指定区间：

```bash
./continue-harness.sh --project /path/to/git/repo        # 默认仅 Sprint 5
./continue-harness.sh --project /path/to/git/repo 2        # 仅 Sprint 2
./continue-harness.sh --project /path/to/git/repo 2 5      # Sprint 2～5
```

等价方式：`export HARNESS_PROJECT_ROOT=/path/to/git/repo` 后省略 `--project`。

可选：`MAX_QA_ROUNDS=5 ./continue-harness.sh 2` 等。

## Prompt 模板（`prompts/templates/`）

与 [`lib/render-prompt.sh`](lib/render-prompt.sh) 中的渲染函数一一对应：

| 文件 | 用途 |
|------|------|
| [`planner.txt`](prompts/templates/planner.txt) | 由需求生成 `artifacts/spec.md`；接收现有技术栈摘要。 |
| [`contract.txt`](prompts/templates/contract.txt) | 按 Sprint 从 spec 生成合同草案与 `sprint-N-contract-final.md`。 |
| [`generator.txt`](prompts/templates/generator.txt) | Sprint 代码实现；含 QA 反馈、未解决 bug、截图上下文。 |
| [`generator-fix.txt`](prompts/templates/generator-fix.txt) | QA 未通过时的修复轮次。 |
| [`evaluator.txt`](prompts/templates/evaluator.txt) | Playwright MCP 评测；含 `__BUILD_CMD__`、回归要点。 |
| [`reviewer.txt`](prompts/templates/reviewer.txt) | 全站产品评审与改进清单。 |
| [`polish-contract.txt`](prompts/templates/polish-contract.txt) | Polish 阶段的合同。 |
| [`polish-generator.txt`](prompts/templates/polish-generator.txt) | Polish 阶段的实现与视觉上下文。 |

## 可选环境变量（run-harness-full.sh）

| 变量 | 默认 | 说明 |
|------|------|------|
| `QUALITY_THRESHOLD` | `7.0` | 产品评审达标分数 |
| `STRICT_MODE` | `false` | `true` 时某 Sprint 判 FAIL 即停止 |
| `MAX_POLISH_ROUNDS` | `3` | Polish 最大轮数 |
| `MAX_EPOCHS` | `10` | 外层 Epoch 上限 |
| `MAX_QA_ROUNDS` | `3` | 每 Sprint QA 循环上限 |
| `START_FROM_SPRINT` | `1` | 构建循环起始 Sprint；`--resume` 或 `continue-harness.sh` 会以状态文件 / `CONTINUE_SPRINT` 为准 |
| `KIMI_EXTRA_ARGS` | 空 | 附加传给 `kimi` 的参数 |
| `KIMI_MAX_RETRIES` | `3` | `kimi` 调用失败（含未产出约定产物）时的最大重试次数 |
| `KIMI_RETRY_DELAY` | `10` | 两次重试之间的等待秒数 |

## 高级：显式指定工作区目录

若已自行管理 `.harness` 路径，可设置（一般不必）：

```bash
export HARNESS_WORKSPACE=/path/to/某目录/.harness
./run-harness-full.sh --resume
```

## 运行产物

本仓库中的 `artifacts/`（`spec.md`、合同与 QA 报告、截图、`harness-state.json` 等）由每次运行生成，已在仓库根目录 `.gitignore` 中忽略，**不会提交到 Git**；目录内仅保留 `.gitkeep` 占位。外仓模式下的 `.harness/artifacts/` 请自行在业务仓库中忽略。

## 依赖

- `kimi` CLI 在 `PATH` 中
- `python3`
- 评测阶段需可加载本目录下 `config/playwright-mcp-isolated.json`（由脚本使用**本目录**的 `config/`，与业务仓库路径无关）
- 后端自动重启路径依赖：Maven / Gradle 或本地 `python3`；Java 场景可选 `jps`（用于清理旧 Spring 进程）

## Windows 说明

`.harness/project` 使用符号链接。若 `ln -s` 不可用，需以管理员身份启用开发者模式或在本机用 WSL 运行上述脚本。
