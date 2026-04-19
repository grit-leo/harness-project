#!/usr/bin/env bash
# lib/check-verdict.sh — Parse QA report verdict

check_qa_passed() {
  local report_file="$1"
  if [[ ! -f "$report_file" ]]; then
    echo "false"
    return
  fi
  python3 -c "
with open('${report_file}') as f:
    text = f.read()
verdict_pos = text.find('Overall Verdict:')
if verdict_pos == -1:
    print('false')
else:
    snippet = text[verdict_pos:verdict_pos+100].upper()
    if 'PASS' in snippet and 'FAIL' not in snippet:
        print('true')
    else:
        print('false')
"
}

