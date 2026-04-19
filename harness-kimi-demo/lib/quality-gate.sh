#!/usr/bin/env bash
# lib/quality-gate.sh — Parse reviewer report and compute quality score

# Extract the overall quality score from a product review file
# Returns the numeric score (e.g., "5.8") or "0" if not found
extract_quality_score() {
  local review_file="$1"
  if [[ ! -f "$review_file" ]]; then
    echo "0"
    return
  fi
  python3 -c "
import re
with open('${review_file}') as f:
    text = f.read()

# Look for 'Overall Quality Score: X.X / 10' or 'X.X/10'
patterns = [
    r'Overall Quality Score:\s*([\d.]+)\s*/\s*10',
    r'Overall Quality Score:\s*([\d.]+)',
    r'\*\*Overall Quality Score\*\*:\s*([\d.]+)',
]
for pat in patterns:
    m = re.search(pat, text, re.IGNORECASE)
    if m:
        print(m.group(1))
        exit()
print('0')
"
}

# Check if quality score meets threshold
# Returns "true" if score >= threshold, "false" otherwise
quality_meets_threshold() {
  local score="$1"
  local threshold="$2"
  python3 -c "
s = float('${score}')
t = float('${threshold}')
print('true' if s >= t else 'false')
"
}

# Count improvement items in a product review's backlog
count_backlog_items() {
  local review_file="$1"
  if [[ ! -f "$review_file" ]]; then
    echo "0"
    return
  fi
  python3 -c "
import re
with open('${review_file}') as f:
    text = f.read()

# Count rows in the Improvement Backlog table (lines starting with | P)
rows = re.findall(r'^\|\s*P\d', text, re.MULTILINE)
print(len(rows))
"
}

# Extract top N backlog items as a summary for the polish contract prompt
extract_top_backlog() {
  local review_file="$1"
  local n="${2:-5}"
  if [[ ! -f "$review_file" ]]; then
    echo "No backlog items found."
    return
  fi
  python3 -c "
import re
with open('${review_file}') as f:
    text = f.read()

# Find the Improvement Backlog section
start = text.find('## Improvement Backlog')
if start == -1:
    start = text.find('## Top 3 Quick Wins')
if start == -1:
    print('No backlog found in review.')
    exit()

section = text[start:]
rows = re.findall(r'^\|.+\|$', section, re.MULTILINE)
# Skip header rows
data_rows = [r for r in rows if not re.match(r'^\|\s*-+', r) and 'Priority' not in r and 'Issue' not in r]
n = int('${n}')
for row in data_rows[:n]:
    print(row)
"
}

# Generate core user journeys from the spec for the reviewer prompt
generate_core_journeys() {
  python3 -c "
import os
spec_path = '${ROOT}/artifacts/spec.md'
if not os.path.exists(spec_path):
    print('1. Sign up / Log in / View dashboard')
    print('2. Create, edit, delete a primary resource')
    print('3. Search and filter content')
    exit()

with open(spec_path) as f:
    text = f.read()

import re
stories = re.findall(r'As a user, I want to (.+?) so that', text)
# Deduplicate and pick top 5 most representative journeys
seen = set()
journeys = []
for s in stories:
    key = s.strip().lower()[:40]
    if key not in seen:
        seen.add(key)
        journeys.append(s.strip())
    if len(journeys) >= 5:
        break

if not journeys:
    print('1. Sign up / Log in / View dashboard')
    print('2. Create, edit, delete a primary resource')
    print('3. Search and filter content')
else:
    for i, j in enumerate(journeys, 1):
        print(f'{i}. {j}')
"
}
