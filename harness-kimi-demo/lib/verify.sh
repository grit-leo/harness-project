#!/usr/bin/env bash
# lib/verify.sh — Deterministic checks that run before agent browser exploration.

detect_project_dir() {
  local pkg
  if [[ -f "${ROOT}/project/package.json" ]]; then
    printf '%s\n' "${ROOT}/project"
    return
  fi
  pkg="$(find -L "${ROOT}/project" -maxdepth 3 -name package.json \
    ! -path '*/node_modules/*' ! -path '*/extension/*' -print -quit 2>/dev/null || true)"
  if [[ -n "$pkg" ]]; then
    dirname "$pkg"
  else
    printf '%s\n' "${ROOT}/project"
  fi
}

run_deterministic_checks() {
  local sprint="$1"
  local round="$2"
  local log_file="${ROOT}/artifacts/sprint-${sprint}-checks-round-${round}.log"
  local project_dir
  local failed=0
  local check_status=0

  project_dir="$(detect_project_dir)"
  : > "$log_file"

  _run_check_body() {
    echo "Deterministic checks for Sprint ${sprint}, round ${round}"
    echo "Project directory: ${project_dir}"
    echo

    if [[ -f "${project_dir}/package.json" ]]; then
      if [[ -f "${project_dir}/package-lock.json" && ! -d "${project_dir}/node_modules" ]]; then
        echo "== npm ci =="
        (cd "$project_dir" && npm ci) || failed=1
      fi

      if (cd "$project_dir" && npm run 2>/dev/null | grep -qE '^[[:space:]]+lint$'); then
        echo "== npm run lint =="
        (cd "$project_dir" && npm run lint) || failed=1
      fi

      if (cd "$project_dir" && npm run 2>/dev/null | grep -qE '^[[:space:]]+test(:|$)'); then
        echo "== npm test =="
        (cd "$project_dir" && CI=true npm test) || failed=1
      fi

      if (cd "$project_dir" && npm run 2>/dev/null | grep -qE '^[[:space:]]+test:e2e$'); then
        echo "== npm run test:e2e =="
        (cd "$project_dir" && CI=true npm run test:e2e) || failed=1
      fi

      if (cd "$project_dir" && npm run 2>/dev/null | grep -qE '^[[:space:]]+build$'); then
        echo "== npm run build =="
        (cd "$project_dir" && npm run build) || failed=1
      fi
    fi

    if [[ -f "${ROOT}/project/backend/requirements.txt" || -f "${ROOT}/project/backend/pyproject.toml" ]]; then
      if command -v pytest >/dev/null 2>&1 && find "${ROOT}/project/backend" -maxdepth 2 -type f -name 'test_*.py' -print -quit | grep -q .; then
        echo "== pytest =="
        (cd "${ROOT}/project/backend" && pytest -q) || failed=1
      fi
    fi

    if [[ -f "${ROOT}/project/pom.xml" ]]; then
      echo "== Maven tests =="
      (cd "${ROOT}/project" && mvn test) || failed=1
    elif [[ -f "${ROOT}/project/build.gradle" || -f "${ROOT}/project/build.gradle.kts" ]]; then
      echo "== Gradle tests =="
      (cd "${ROOT}/project" && ./gradlew test) || failed=1
    fi
    return "$failed"
  }

  _run_check_body 2>&1 | tee "$log_file"
  check_status="${PIPESTATUS[0]}"
  unset -f _run_check_body
  return "$check_status"
}

write_check_failure_report() {
  local sprint="$1"
  local round="$2"
  local report="${ROOT}/artifacts/sprint-${sprint}-qa-round-${round}.md"
  cat > "$report" <<EOF
# Sprint ${sprint} QA Report — Round ${round}

## Test Environment
- Deterministic checks: fail
- Browser exploration: skipped because deterministic checks failed
- Log: artifacts/sprint-${sprint}-checks-round-${round}.log

## Bugs Found
1. **[BUG-001]** Deterministic build, lint, or test command failed. Inspect the check log and fix the root cause before browser verification.

## Overall Verdict: FAIL

## Feedback for Generator
Read \`artifacts/sprint-${sprint}-checks-round-${round}.log\`, fix every failing command, and rerun the same checks.
EOF
}
