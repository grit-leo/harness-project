#!/usr/bin/env bash
# lib/restart-servers.sh — Restart backend/frontend so Evaluator tests fresh code

restart_backend() {
  local backend_dir="${ROOT}/project/backend"
  local log_file="/tmp/harness-logs/backend.log"

  if [[ ! -f "${backend_dir}/main.py" ]]; then
    return 0
  fi

  echo "  [restart] Stopping old backend..."
  pkill -f "uvicorn.*main:app" 2>/dev/null || true
  sleep 2

  mkdir -p /tmp/harness-logs
  echo "  [restart] Starting backend (uvicorn)..."
  (
    cd "$backend_dir"
    if [[ -d .venv ]]; then
      source .venv/bin/activate
    fi
    nohup python3 -m uvicorn main:app --host 127.0.0.1 --port 8000 \
      > "$log_file" 2>&1 &
  )
  sleep 3

  if curl -s -o /dev/null -w '' --max-time 5 http://127.0.0.1:8000/docs 2>/dev/null; then
    echo "  [restart] Backend up on :8000"
  else
    echo "  [restart] WARNING: Backend may not be ready (curl failed)"
  fi
}

restart_frontend() {
  local project_dir="${ROOT}/project"
  local log_file="/tmp/harness-logs/frontend.log"

  if [[ ! -f "${project_dir}/package.json" ]]; then
    return 0
  fi

  echo "  [restart] Stopping old frontend..."
  pkill -f "node.*vite" 2>/dev/null || true
  lsof -ti :5173 2>/dev/null | xargs kill -9 2>/dev/null || true
  sleep 2

  mkdir -p /tmp/harness-logs
  echo "  [restart] Starting frontend (vite)..."
  (
    cd "$project_dir"
    nohup npm run dev > "$log_file" 2>&1 &
  )
  sleep 5

  if curl -s -o /dev/null -w '' --max-time 5 http://localhost:5173/ 2>/dev/null; then
    echo "  [restart] Frontend up on :5173"
  else
    echo "  [restart] WARNING: Frontend may not be ready (curl failed)"
  fi
}

count_bugs_in_report() {
  local report_file="$1"
  if [[ ! -f "$report_file" ]]; then
    echo "0"
    return
  fi
  python3 -c "
import re
with open('${report_file}') as f:
    text = f.read()
bugs = re.findall(r'\*\*\[BUG-\d+\]\*\*', text)
print(len(bugs))
"
}
