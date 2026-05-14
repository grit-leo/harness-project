#!/usr/bin/env bash
# lib/state.sh — Harness state persistence (JSON via python3)
# All data is passed to python via environment variables to avoid shell injection.

STATE_FILE="${ROOT}/artifacts/harness-state.json"

state_init() {
  local goal="$1"
  local max_qa="${2:-3}"
  local budget="${3:-200}"
  _SF="$STATE_FILE" _GOAL="$goal" _MQ="$max_qa" _BUD="$budget" python3 -c "
import json, datetime, os
state = {
    'phase': 'planning',
    'epoch': 1,
    'epoch_type': 'build',
    'current_sprint': 0,
    'total_sprints': 0,
    'qa_round': 0,
    'max_qa_rounds': int(os.environ['_MQ']),
    'budget': int(os.environ['_BUD']),
    'user_goal': os.environ['_GOAL'],
    'goal_queue': [],
    'quality_scores': [],
    'polish_round': 0,
    'total_polish_rounds': 0,
    'started_at': datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
    'updated_at': datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
}
with open(os.environ['_SF'], 'w') as f:
    json.dump(state, f, indent=2, ensure_ascii=False)
"
}

state_get() {
  local key="$1"
  _SF="$STATE_FILE" _KEY="$key" python3 -c "
import json, os
with open(os.environ['_SF']) as f:
    d = json.load(f)
val = d.get(os.environ['_KEY'], '')
if isinstance(val, (list, dict)):
    print(json.dumps(val))
else:
    print(val)
"
}

state_set() {
  local key="$1"
  local value="$2"
  _SF="$STATE_FILE" _KEY="$key" _VAL="$value" python3 -c "
import json, datetime, os
sf = os.environ['_SF']
with open(sf) as f:
    d = json.load(f)
key = os.environ['_KEY']
raw = os.environ['_VAL']
try:
    d[key] = json.loads(raw)
except (json.JSONDecodeError, ValueError):
    d[key] = raw
d['updated_at'] = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
with open(sf, 'w') as f:
    json.dump(d, f, indent=2, ensure_ascii=False)
"
}

state_exists() {
  [[ -f "$STATE_FILE" ]]
}

state_push_goal() {
  local new_goal="$1"
  _SF="$STATE_FILE" _GOAL="$new_goal" python3 -c "
import json, datetime, os
sf = os.environ['_SF']
with open(sf) as f:
    d = json.load(f)
if 'goal_queue' not in d:
    d['goal_queue'] = []
d['goal_queue'].append(os.environ['_GOAL'])
d['updated_at'] = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
with open(sf, 'w') as f:
    json.dump(d, f, indent=2, ensure_ascii=False)
"
}

state_pop_goal() {
  _SF="$STATE_FILE" python3 -c "
import json, datetime, os
sf = os.environ['_SF']
with open(sf) as f:
    d = json.load(f)
q = d.get('goal_queue', [])
if q:
    goal = q.pop(0)
    d['goal_queue'] = q
    d['updated_at'] = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
    with open(sf, 'w') as f:
        json.dump(d, f, indent=2, ensure_ascii=False)
    print(goal)
else:
    print('')
"
}

state_record_quality() {
  local epoch="$1"
  local score="$2"
  _SF="$STATE_FILE" _EPOCH="$epoch" _SCORE="$score" python3 -c "
import json, datetime, os
sf = os.environ['_SF']
with open(sf) as f:
    d = json.load(f)
if 'quality_scores' not in d:
    d['quality_scores'] = []
label = os.environ['_EPOCH']
try:
    epoch_val = int(label) if '.' not in label else label
except ValueError:
    epoch_val = label
d['quality_scores'].append({'epoch': epoch_val, 'score': float(os.environ['_SCORE'])})
d['updated_at'] = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
with open(sf, 'w') as f:
    json.dump(d, f, indent=2, ensure_ascii=False)
"
}

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
