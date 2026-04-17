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

render_generator_prompt() {
  local sprint_num="$1"
  local qa_feedback_line="${2:-}"

  if [[ -n "$qa_feedback_line" ]]; then
    qa_feedback_line="- QA Feedback to fix: ${qa_feedback_line}"
  fi

  render_prompt "${ROOT}/prompts/templates/generator.txt" \
    "__SPRINT_NUM__" "$sprint_num" \
    "__QA_FEEDBACK_LINE__" "$qa_feedback_line"
}

render_generator_fix_prompt() {
  local sprint_num="$1"
  local qa_round="$2"
  render_prompt "${ROOT}/prompts/templates/generator-fix.txt" \
    "__SPRINT_NUM__" "$sprint_num" \
    "__QA_ROUND__" "$qa_round"
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

  render_prompt "${ROOT}/prompts/templates/evaluator.txt" \
    "__SPRINT_NUM__" "$sprint_num" \
    "__QA_ROUND__" "$qa_round" \
    "__PREV_QA_LINE__" "$prev_qa_line" \
    "__PREV_BUG_STATUS_SECTION__" "$prev_bug_section"
}
