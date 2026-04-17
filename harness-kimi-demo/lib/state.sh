#!/usr/bin/env bash
# lib/state.sh — Harness state persistence (JSON via jq-free pure bash)
# Provides: state_init, state_load, state_save, state_get, state_set

STATE_FILE="${ROOT}/artifacts/harness-state.json"

state_init() {
  local goal="$1"
  local max_qa="${2:-3}"
  local budget="${3:-200}"
  cat > "$STATE_FILE" <<EOF
{
  "phase": "planning",
  "current_sprint": 0,
  "total_sprints": 0,
  "qa_round": 0,
  "max_qa_rounds": ${max_qa},
  "budget": ${budget},
  "user_goal": $(printf '%s' "$goal" | python3 -c 'import sys,json; print(json.dumps(sys.stdin.read()))'),
  "started_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "updated_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
EOF
}

state_get() {
  local key="$1"
  python3 -c "
import json, sys
with open('${STATE_FILE}') as f:
    d = json.load(f)
print(d.get('${key}', ''))
"
}

state_set() {
  local key="$1"
  local value="$2"
  python3 -c "
import json
with open('${STATE_FILE}') as f:
    d = json.load(f)
try:
    d['${key}'] = json.loads('${value}')
except (json.JSONDecodeError, ValueError):
    d['${key}'] = '${value}'
import datetime
d['updated_at'] = datetime.datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%SZ')
with open('${STATE_FILE}', 'w') as f:
    json.dump(d, f, indent=2, ensure_ascii=False)
"
}

state_exists() {
  [[ -f "$STATE_FILE" ]]
}
