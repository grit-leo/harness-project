#!/usr/bin/env bash
# lib/render-prompt.sh — Render a prompt template with variable substitution

render_prompt() {
  local template_file="$1"
  shift

  local content
  content="$(cat "$template_file")"

  while [[ $# -gt 0 ]]; do
    local key="$1"
    local val="$2"
    content="${content//$key/$val}"
    shift 2
  done

  echo "$content"
}

render_planner_prompt() {
  local user_goal="$1"
  render_prompt "${ROOT}/prompts/templates/planner.txt" \
    "__USER_GOAL__" "$user_goal"
}

render_contract_prompt() {
  local sprint_num="$1"
  local sprint_section="$2"
  render_prompt "${ROOT}/prompts/templates/contract.txt" \
    "__SPRINT_NUM__" "$sprint_num" \
    "__SPRINT_SECTION__" "$sprint_section"
}

collect_unresolved_bugs() {
  local current_sprint="$1"
  python3 -c "
import re, os, glob

current = int('${current_sprint}')
bugs_section = []

for s in range(1, current):
    rounds = sorted(glob.glob(f'${ROOT}/artifacts/sprint-{s}-qa-round-*.md'))
    if not rounds:
        continue
    last_report = rounds[-1]
    with open(last_report) as f:
        text = f.read()

    # Only include bugs from sprints whose final verdict was FAIL
    vpos = text.find('Overall Verdict:')
    if vpos == -1:
        continue
    snippet = text[vpos:vpos+100].upper()
    if 'FAIL' not in snippet:
        continue

    # Extract bug entries (lines starting with N. **[BUG-...)
    bug_lines = re.findall(r'^\d+\.\s+\*\*\[BUG-\d+\]\*\*.*', text, re.MULTILINE)
    if bug_lines:
        rname = os.path.basename(last_report)
        bugs_section.append(f'### From {rname} (Sprint {s} — FAIL)')
        for bl in bug_lines:
            bugs_section.append(bl)
        bugs_section.append('')

if bugs_section:
    print('## UNRESOLVED BUGS FROM PREVIOUS SPRINTS (MUST FIX FIRST)')
    print()
    print('\n'.join(bugs_section))
else:
    print('')
"
}

render_generator_prompt() {
  local sprint_num="$1"
  local qa_feedback_line="${2:-}"

  if [[ -n "$qa_feedback_line" ]]; then
    qa_feedback_line="- QA Feedback to fix: ${qa_feedback_line}"
  fi

  local unresolved_bugs
  unresolved_bugs="$(collect_unresolved_bugs "$sprint_num")"

  render_prompt "${ROOT}/prompts/templates/generator.txt" \
    "__SPRINT_NUM__" "$sprint_num" \
    "__QA_FEEDBACK_LINE__" "$qa_feedback_line" \
    "__UNRESOLVED_BUGS__" "$unresolved_bugs"
}

render_generator_fix_prompt() {
  local sprint_num="$1"
  local qa_round="$2"

  # Build list of all prior QA report references for this sprint
  local all_reports_line=""
  local read_prior_line=""
  if (( qa_round > 1 )); then
    local refs=""
    for (( r=1; r<qa_round; r++ )); do
      local rfile="artifacts/sprint-${sprint_num}-qa-round-${r}.md"
      if [[ -f "${ROOT}/${rfile}" ]]; then
        refs="${refs}\n- Prior QA Report (Round ${r}): ${rfile}"
      fi
    done
    if [[ -n "$refs" ]]; then
      all_reports_line="$(echo -e "$refs")"
      read_prior_line="   Also read the prior QA reports listed above — any bug still open from earlier rounds MUST be fixed in this pass."
    fi
  fi

  render_prompt "${ROOT}/prompts/templates/generator-fix.txt" \
    "__SPRINT_NUM__" "$sprint_num" \
    "__QA_ROUND__" "$qa_round" \
    "__ALL_QA_REPORTS_LINE__" "$all_reports_line" \
    "__READ_PRIOR_ROUNDS_LINE__" "$read_prior_line"
}

collect_regression_criteria() {
  local current_sprint="$1"
  python3 -c "
import os, re, glob

current = int('${current_sprint}')
if current <= 1:
    print('No prior sprints to regress.')
    exit()

lines = []
lines.append('Spot-check the following key flows from prior sprints:')
for s in range(1, current):
    contract = '${ROOT}/artifacts/sprint-{}-contract-final.md'.format(s)
    if not os.path.exists(contract):
        continue
    with open(contract) as f:
        text = f.read()
    # Extract first 3 acceptance criteria lines (| N | ... |)
    rows = re.findall(r'^\|\s*\d+\s*\|(.+?)\|', text, re.MULTILINE)
    picks = rows[:3]
    if picks:
        lines.append(f'   - **Sprint {s}**: ' + '; '.join(c.strip() for c in picks))

if len(lines) <= 1:
    print('No prior contracts found for regression.')
else:
    print('\n'.join(lines))
"
}

render_evaluator_prompt() {
  local sprint_num="$1"
  local qa_round="$2"
  local prev_qa_round=$(( qa_round - 1 ))

  local prev_qa_line=""
  local prev_bug_section=""
  if (( prev_qa_round > 0 )); then
    local prev_report="${ROOT}/artifacts/sprint-${sprint_num}-qa-round-${prev_qa_round}.md"
    if [[ -f "$prev_report" ]]; then
      prev_qa_line="- Previous QA report: artifacts/sprint-${sprint_num}-qa-round-${prev_qa_round}.md — verify all previous bugs are FIXED."
      prev_bug_section="## Round ${prev_qa_round} Bug Status
| Bug | Description | Fixed? | Evidence |
|-----|-------------|--------|----------|
(Fill in by checking each bug from the previous QA report)"
    fi
  fi

  local regression_criteria
  regression_criteria="$(collect_regression_criteria "$sprint_num")"

  render_prompt "${ROOT}/prompts/templates/evaluator.txt" \
    "__SPRINT_NUM__" "$sprint_num" \
    "__QA_ROUND__" "$qa_round" \
    "__PREV_QA_LINE__" "$prev_qa_line" \
    "__PREV_BUG_STATUS_SECTION__" "$prev_bug_section" \
    "__REGRESSION_CRITERIA__" "$regression_criteria"
}
