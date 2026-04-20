#!/usr/bin/env bash
# lib/restart-servers.sh — Restart backend/frontend so Evaluator tests fresh code

# Kill any leftover Playwright / Chromium processes from a previous MCP session.
# This prevents CDP port conflicts and user-data-dir locks that cause deadlocks
# when the next Kimi + Playwright MCP session starts.
kill_playwright() {
  local killed=0 pids_to_kill=()

  # Collect PIDs: Playwright MCP node processes + headless Chromium instances.
  # Case-insensitive match (-i) catches both Chromium and chromium.
  while IFS= read -r pid; do
    pids_to_kill+=("$pid")
  done < <(pgrep -if '@playwright/mcp|playwright.*mcp' 2>/dev/null || true)

  while IFS= read -r pid; do
    pids_to_kill+=("$pid")
  done < <(pgrep -if 'chromium.*--remote-debugging|chrome.*--headless.*--remote-debugging' 2>/dev/null || true)

  if (( ${#pids_to_kill[@]} == 0 )); then
    return 0
  fi

  # SIGTERM first
  for pid in "${pids_to_kill[@]}"; do
    kill "$pid" 2>/dev/null && killed=$(( killed + 1 ))
  done

  echo "  [cleanup] Sent SIGTERM to ${killed} Playwright/Chromium process(es)."
  sleep 2

  # SIGKILL any survivors
  local still_alive=0
  for pid in "${pids_to_kill[@]}"; do
    if kill -0 "$pid" 2>/dev/null; then
      kill -9 "$pid" 2>/dev/null || true
      still_alive=$(( still_alive + 1 ))
    fi
  done
  if (( still_alive > 0 )); then
    echo "  [cleanup] Force-killed ${still_alive} stubborn process(es)."
    sleep 1
  fi

  # Verify CDP port 9222 is free (common Playwright debug port)
  if lsof -ti :9222 >/dev/null 2>&1; then
    echo "  [cleanup] WARNING: Port 9222 still occupied after cleanup."
    lsof -ti :9222 2>/dev/null | xargs kill -9 2>/dev/null || true
    sleep 1
  fi
}

# Wait for a URL to become reachable (up to max_attempts * 2 seconds).
wait_for_url() {
  local url="$1" label="$2" max_attempts="${3:-5}"
  local attempt=0
  while (( attempt < max_attempts )); do
    attempt=$(( attempt + 1 ))
    if curl -s -o /dev/null -w '' --max-time 3 "$url" 2>/dev/null; then
      echo "  [restart] ${label} up (attempt ${attempt})"
      return 0
    fi
    sleep 2
  done
  echo "  [restart] WARNING: ${label} not reachable after ${max_attempts} attempts"
  return 1
}

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

  wait_for_url "http://127.0.0.1:8000/docs" "Backend :8000" 5 || true
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

  wait_for_url "http://localhost:5173/" "Frontend :5173" 8 || true
}

# Ensure both backend and frontend are running with fresh code.
restart_all() {
  restart_backend
  restart_frontend
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
