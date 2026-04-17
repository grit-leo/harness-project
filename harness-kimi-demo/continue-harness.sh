#!/usr/bin/env bash
# continue-harness.sh — 在已有 spec/合同 基础上，从指定 Sprint 重新跑 Generator + QA
#
# 用法:
#   ./continue-harness.sh              # 默认从 Sprint 5 再跑一轮（修最后一段）
#   ./continue-harness.sh 2            # 只重跑 Sprint 2
#   ./continue-harness.sh 2 5          # 重跑 Sprint 2～5（耗时长）
#
# 环境变量:
#   MAX_QA_ROUNDS=5 ./continue-harness.sh 2
#
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

FROM="${1:-5}"
TO="${2:-$FROM}"
TOTAL="$(python3 -c "
import re
from pathlib import Path
t = Path('artifacts/spec.md').read_text()
m = re.findall(r'### Sprint (\d+)', t)
print(max(int(x) for x in m) if m else 0)
")"

if (( FROM < 1 || TO < FROM || TO > TOTAL )); then
  echo "Usage: $0 [from_sprint] [to_sprint]  (spec has ${TOTAL} sprints)" >&2
  exit 1
fi

echo "Removing handoff + QA reports for sprints ${FROM}–${TO} (Generator will re-run)..."
for ((i = FROM; i <= TO; i++)); do
  rm -f "artifacts/sprint-${i}-handoff.md"
  rm -f "artifacts/sprint-${i}-qa-round-"*.md
done

python3 <<PY
import json
from datetime import datetime, timezone
from pathlib import Path
p = Path("artifacts/harness-state.json")
d = json.loads(p.read_text()) if p.exists() else {}
d["phase"] = "building"
d["current_sprint"] = $FROM
d["total_sprints"] = $TOTAL
d["qa_round"] = 0
d["updated_at"] = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
if "user_goal" not in d:
    d["user_goal"] = "Build a personal bookmark manager with tagging and search."
if "max_qa_rounds" not in d:
    d["max_qa_rounds"] = int("${MAX_QA_ROUNDS:-3}")
p.write_text(json.dumps(d, indent=2, ensure_ascii=False) + "\n")
PY

export CONTINUE_SPRINT="$FROM"
echo ""
echo "Starting harness from sprint $FROM → $TOTAL (QA rounds: ${MAX_QA_ROUNDS:-3})..."
exec ./run-harness-full.sh --resume
