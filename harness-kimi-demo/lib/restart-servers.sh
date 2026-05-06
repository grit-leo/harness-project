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
  local log_file="/tmp/harness-logs/backend.log"
  mkdir -p /tmp/harness-logs

  # Detect backend type and directory
  local backend_dir=""
  local backend_type=""

  if [[ -f "${ROOT}/project/backend/main.py" || -f "${ROOT}/project/main.py" ]]; then
    backend_type="python"
    backend_dir="${ROOT}/project/backend"
    [[ ! -d "$backend_dir" ]] && backend_dir="${ROOT}/project"
  elif find "${ROOT}/project" -maxdepth 2 -name "pom.xml" -print -quit 2>/dev/null | grep -q .; then
    backend_type="java-maven"
    backend_dir="$(dirname "$(find "${ROOT}/project" -maxdepth 2 -name "pom.xml" -print -quit)")"
  elif find "${ROOT}/project" -maxdepth 2 -name "build.gradle*" -print -quit 2>/dev/null | grep -q .; then
    backend_type="java-gradle"
    backend_dir="$(dirname "$(find "${ROOT}/project" -maxdepth 2 -name "build.gradle*" -print -quit)")"
  fi

  if [[ -z "$backend_type" ]]; then
    echo "  [restart] No recognizable backend found. Skipping."
    return 0
  fi

  echo "  [restart] Detected backend: $backend_type at $(realpath --relative-to="${ROOT}" "$backend_dir" 2>/dev/null || echo "$backend_dir")"

  case "$backend_type" in
    python)
      echo "  [restart] Stopping old Python backend..."
      pkill -f "uvicorn.*main:app" 2>/dev/null || true
      sleep 2
      echo "  [restart] Starting Python backend (uvicorn)..."
      (
        cd "$backend_dir"
        if [[ -d .venv ]]; then
          source .venv/bin/activate
        fi
        nohup python3 -m uvicorn main:app --host 127.0.0.1 --port 8000 \
          > "$log_file" 2>&1 &
      )
      wait_for_url "http://127.0.0.1:8000/docs" "Backend :8000" 5 || true
      ;;
    java-maven)
      echo "  [restart] Stopping old Java backend..."
      pkill -f "spring-boot:run" 2>/dev/null || true
      jps -l 2>/dev/null | grep -iE 'spring|boot' | awk '{print $1}' | xargs kill 2>/dev/null || true
      sleep 2
      echo "  [restart] Starting Java backend (Maven Spring Boot)..."
      (
        cd "$backend_dir"
        nohup mvn spring-boot:run -Dspring-boot.run.arguments="--server.port=8080" \
          > "$log_file" 2>&1 &
      )
      wait_for_url "http://127.0.0.1:8080/actuator/health" "Backend :8080" 12 || \
      wait_for_url "http://127.0.0.1:8080/health" "Backend :8080" 5 || true
      ;;
    java-gradle)
      echo "  [restart] Stopping old Java backend..."
      pkill -f "gradle.*bootRun" 2>/dev/null || true
      jps -l 2>/dev/null | grep -iE 'spring|boot|gradle' | awk '{print $1}' | xargs kill 2>/dev/null || true
      sleep 2
      echo "  [restart] Starting Java backend (Gradle Spring Boot)..."
      (
        cd "$backend_dir"
        nohup ./gradlew bootRun --args="--server.port=8080" \
          > "$log_file" 2>&1 &
      )
      wait_for_url "http://127.0.0.1:8080/actuator/health" "Backend :8080" 12 || \
      wait_for_url "http://127.0.0.1:8080/health" "Backend :8080" 5 || true
      ;;
  esac
}

restart_frontend() {
  local log_file="/tmp/harness-logs/frontend.log"
  mkdir -p /tmp/harness-logs

  # Find package.json recursively (up to 2 levels deep)
  local pkg_json
  pkg_json="$(find "${ROOT}/project" -maxdepth 2 -name "package.json" -print -quit 2>/dev/null)"

  if [[ -z "$pkg_json" ]]; then
    echo "  [restart] No frontend (package.json) found. Skipping."
    return 0
  fi

  local project_dir
  project_dir="$(dirname "$pkg_json")"

  echo "  [restart] Detected frontend at $(realpath --relative-to="${ROOT}" "$project_dir" 2>/dev/null || echo "$project_dir")"

  echo "  [restart] Stopping old frontend..."
  pkill -f "node.*vite" 2>/dev/null || true
  for port in 5173 3000 4200 8081; do
    lsof -ti :$port 2>/dev/null | xargs kill -9 2>/dev/null || true
  done
  sleep 1

  # CRITICAL: Kill foreign vite dev servers whose CWD is NOT our project_dir.
  # This prevents other projects (e.g., MemClaw on port 3000) from resurrecting
  # and hijacking the port after we start our dev server.
  echo "  [restart] Purging foreign vite processes..."
  local foreign_killed=0
  while IFS= read -r pid; do
    [[ -z "$pid" ]] && continue
    local cwd
    cwd=$(lsof -p "$pid" +r 0 2>/dev/null | awk '/cwd/{print $NF}' | head -1 || echo "")
    if [[ -n "$cwd" && "$cwd" != "$project_dir"* ]]; then
      kill -9 "$pid" 2>/dev/null && foreign_killed=$(( foreign_killed + 1 ))
    fi
  done < <(pgrep -f "node.*vite" 2>/dev/null || true)
  if (( foreign_killed > 0 )); then
    echo "  [restart] Killed $foreign_killed foreign vite process(es)."
    sleep 1
  fi

  echo "  [restart] Starting frontend dev server..."
  (
    cd "$project_dir"
    nohup npm run dev > "$log_file" 2>&1 &
  )

  # Try common frontend ports and record the one that works
  local frontend_url=""
  if wait_for_url "http://localhost:5173/" "Frontend :5173" 5; then
    frontend_url="http://localhost:5173"
  elif wait_for_url "http://localhost:3000/" "Frontend :3000" 5; then
    frontend_url="http://localhost:3000"
  elif wait_for_url "http://localhost:8081/" "Frontend :8081" 3; then
    frontend_url="http://localhost:8081"
  fi

  if [[ -n "$frontend_url" ]]; then
    mkdir -p "${ROOT}/artifacts"
    python3 -c "import json; json.dump({'frontend_url':'${frontend_url}'}, open('${ROOT}/artifacts/harness-server-ports.json','w'))"
    echo "  [restart] Recorded frontend URL: $frontend_url"
  else
    echo "  [restart] WARNING: Could not detect a reachable frontend URL."
  fi
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
