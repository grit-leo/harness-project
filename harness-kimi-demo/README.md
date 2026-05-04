# Kimi CLI Harness

编排脚本与 Prompt 模板位于本目录；运行 Kimi 时**工作目录**为「工作区」`WORK_ROOT`（本目录或历史仓库下的 `.harness`）。

## 脚本入口

- **`run-harness-full.sh`**（推荐）：多 Epoch 编排（构建 → 产品评审 → Polish → 演进队列），支持 `--project` / `--resume` / `--add-goal`。
- **`run-harness-kimi.sh`**：较早的单线流程（Planner → Contract → Generator…），仅在本目录树内使用；新需求优先用 `run-harness-full.sh`。
- **`continue-harness.sh`**：在已有 `spec.md` / 合同基础上，从指定 Sprint 重跑 Generator + QA（见下文）。

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

不传 `--project` / `HARNESS_PROJECT_ROOT` 时，工作区即本 `harness-kimi-demo` 目录：

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

## 高级：显式指定工作区目录

若已自行管理 `.harness` 路径，可设置（一般不必）：

```bash
export HARNESS_WORKSPACE=/path/to/某目录/.harness
./run-harness-full.sh --resume
```

## 依赖

- `kimi` CLI 在 `PATH` 中
- `python3`
- 评测阶段需可加载本目录下 `config/playwright-mcp-isolated.json`（由脚本使用**本目录**的 `config/`，与业务仓库路径无关）

## Windows 说明

`.harness/project` 使用符号链接。若 `ln -s` 不可用，需以管理员身份启用开发者模式或在本机用 WSL 运行上述脚本。
