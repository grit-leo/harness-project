#!/usr/bin/env bash
# lib/state.sh — Harness state persistence (JSON via python3)
# Supports: multi-epoch, goal queue, quality scores, polish tracking

STATE_FILE="${ROOT}/artifacts/harness-state.json"

state_init() {
  local goal="$1"
  local max_qa="${2:-3}"
  local budget="${3:-200}"
  python3 -c "
import json, datetime
state = {
    'phase': 'planning',
    'epoch': 1,
    'epoch_type': 'build',
    'current_sprint': 0,
    'total_sprints': 0,
    'qa_round': 0,
    'max_qa_rounds': int('${max_qa}'),
    'budget': int('${budget}'),
    'user_goal': $(printf '%s' "$goal" | python3 -c 'import sys,json; print(json.dumps(sys.stdin.read()))'),
    'goal_queue': [],
    'quality_scores': [],
    'polish_round': 0,
    'total_polish_rounds': 0,
    'started_at': datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
    'updated_at': datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
}
with open('${STATE_FILE}', 'w') as f:
    json.dump(state, f, indent=2, ensure_ascii=False)
"
}

state_get() {
  local key="$1"
  python3 -c "
import json
with open('${STATE_FILE}') as f:
    d = json.load(f)
val = d.get('${key}', '')
if isinstance(val, (list, dict)):
    print(json.dumps(val))
else:
    print(val)
"
}

state_set() {
  local key="$1"
  local value="$2"
  python3 -c "
import json, datetime
with open('${STATE_FILE}') as f:
    d = json.load(f)
try:
    d['${key}'] = json.loads('${value}')
except (json.JSONDecodeError, ValueError):
    d['${key}'] = '${value}'
d['updated_at'] = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
with open('${STATE_FILE}', 'w') as f:
    json.dump(d, f, indent=2, ensure_ascii=False)
"
}

state_exists() {
  [[ -f "$STATE_FILE" ]]
}

# Append a new goal to the goal_queue
state_push_goal() {
  local new_goal="$1"
  python3 -c "
import json, datetime
with open('${STATE_FILE}') as f:
    d = json.load(f)
if 'goal_queue' not in d:
    d['goal_queue'] = []
d['goal_queue'].append($(printf '%s' "$new_goal" | python3 -c 'import sys,json; print(json.dumps(sys.stdin.read()))'))
d['updated_at'] = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
with open('${STATE_FILE}', 'w') as f:
    json.dump(d, f, indent=2, ensure_ascii=False)
"
}

# Pop the next goal from the queue; prints it (empty string if none)
state_pop_goal() {
  python3 -c "
import json, datetime
with open('${STATE_FILE}') as f:
    d = json.load(f)
q = d.get('goal_queue', [])
if q:
    goal = q.pop(0)
    d['goal_queue'] = q
    d['updated_at'] = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
    with open('${STATE_FILE}', 'w') as f:
        json.dump(d, f, indent=2, ensure_ascii=False)
    print(goal)
else:
    print('')
"
}

# Record a quality score for the current epoch (epoch may be "3" or "3.1" after polish re-review)
state_record_quality() {
  local epoch="$1"
  local score="$2"
  python3 -c "
import json, datetime
with open('${STATE_FILE}') as f:
    d = json.load(f)
if 'quality_scores' not in d:
    d['quality_scores'] = []
label = '''${epoch}'''
try:
    epoch_val = int(label) if '.' not in label else label
except ValueError:
    epoch_val = label
d['quality_scores'].append({'epoch': epoch_val, 'score': float('${score}')})
d['updated_at'] = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
with open('${STATE_FILE}', 'w') as f:
    json.dump(d, f, indent=2, ensure_ascii=False)
"
}

# Helper: log phase with timestamp
log_phase() {
  local title="$1"
  local msg="${2:-}"
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "  [$(date +%H:%M:%S)] ${title}"
  if [[ -n "$msg" ]]; then
    echo "  ${msg}"
  fi
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
}
