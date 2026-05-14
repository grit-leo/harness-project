#!/usr/bin/env bash
# lib/parse-sprints.sh — Extract sprint info from artifacts/spec.md

parse_sprint_count() {
  local spec_file="${ROOT}/artifacts/spec.md"
  if [[ ! -f "$spec_file" ]]; then
    echo "0"
    return
  fi
  python3 -c "
import re, sys
with open('${spec_file}') as f:
    text = f.read()
sprints = re.findall(r'### Sprint (\d+)', text)
print(max(int(s) for s in sprints) if sprints else 0)
"
}

extract_sprint_section() {
  local sprint_num="$1"
  local spec_file="${ROOT}/artifacts/spec.md"
  python3 -c "
import re
with open('${spec_file}') as f:
    text = f.read()
pattern = r'(### Sprint ${sprint_num}:.*?)(?=### Sprint \d+:|## Technical Architecture|$)'
m = re.search(pattern, text, re.DOTALL)
if m:
    print(m.group(1).strip())
else:
    print('Sprint ${sprint_num} not found in spec.')
"
}
