#!/usr/bin/env bash
# lib/agent.sh — Provider-neutral agent execution for Codex or Kimi CLI.
# Requires: ROOT, SCRIPT_DIR, LOG_DIR. Optional: LEGACY_PROJECT.

AGENT_PROVIDER="${AGENT_PROVIDER:-codex}"
AGENT_MAX_RETRIES="${AGENT_MAX_RETRIES:-3}"
AGENT_RETRY_DELAY="${AGENT_RETRY_DELAY:-10}"
CODEX_SANDBOX="${CODEX_SANDBOX:-workspace-write}"
CODEX_NETWORK_ACCESS="${CODEX_NETWORK_ACCESS:-true}"
CODEX_MODEL="${CODEX_MODEL:-}"
CODEX_EXTRA_ARGS="${CODEX_EXTRA_ARGS:-}"
KIMI_EXTRA_ARGS="${KIMI_EXTRA_ARGS:-}"

agent_preflight() {
  case "$AGENT_PROVIDER" in
    codex)
      command -v codex >/dev/null 2>&1 || {
        echo "ERROR: codex CLI is not available in PATH." >&2
        return 1
      }
      codex --version
      ;;
    kimi)
      command -v kimi >/dev/null 2>&1 || {
        echo "ERROR: kimi CLI is not available in PATH." >&2
        return 1
      }
      kimi --version
      ;;
    *)
      echo "ERROR: unsupported AGENT_PROVIDER=${AGENT_PROVIDER}; use codex or kimi." >&2
      return 1
      ;;
  esac
}

_agent_slug() {
  printf '%s' "$1" \
    | tr '[:upper:]' '[:lower:]' \
    | tr -cs '[:alnum:]' '-' \
    | sed 's/^-//; s/-$//' \
    | cut -c1-80
}

_run_codex_once() {
  local label="$1"
  local prompt="$2"
  local browser_enabled="${3:-false}"
  local slug log_file last_message
  local codex_status=0
  local -a cmd extra_args

  slug="$(_agent_slug "$label")"
  log_file="${LOG_DIR}/${slug}-$(date +%Y%m%d-%H%M%S).jsonl"
  last_message="${LOG_DIR}/${slug}-last-message.txt"

  cmd=(codex -a never)
  if [[ -n "$CODEX_MODEL" ]]; then
    cmd+=(-m "$CODEX_MODEL")
  fi

  if [[ "$browser_enabled" == "true" ]]; then
    cmd+=(
      -c 'mcp_servers.playwright.command="npx"'
      -c "mcp_servers.playwright.args=[\"-y\",\"@playwright/mcp@latest\",\"--isolated\",\"--headless\",\"--output-dir\",\"${ROOT}/artifacts/screenshots\"]"
      -c 'mcp_servers.playwright.required=true'
      -c 'mcp_servers.playwright.startup_timeout_sec=30'
      -c 'mcp_servers.playwright.tool_timeout_sec=90'
    )
  fi

  if [[ "$CODEX_SANDBOX" == "workspace-write" ]]; then
    cmd+=(-c "sandbox_workspace_write.network_access=${CODEX_NETWORK_ACCESS}")
  fi

  cmd+=(
    exec
    --ephemeral
    --ignore-user-config
    --ignore-rules
    --sandbox "$CODEX_SANDBOX"
    -C "$ROOT"
    --json
    -o "$last_message"
  )

  if [[ -n "${LEGACY_PROJECT:-}" ]]; then
    cmd+=(--add-dir "$LEGACY_PROJECT")
  fi

  if [[ -n "$CODEX_EXTRA_ARGS" ]]; then
    read -r -a extra_args <<< "$CODEX_EXTRA_ARGS"
    cmd+=("${extra_args[@]}")
  fi
  cmd+=(-)

  printf '%s' "$prompt" | "${cmd[@]}" | tee "$log_file"
  codex_status="${PIPESTATUS[1]}"

  if (( codex_status != 0 )); then
    return "$codex_status"
  fi
  if grep -Eq '"type"[[:space:]]*:[[:space:]]*"(turn.failed|error)"' "$log_file"; then
    return 1
  fi
  return 0
}

_run_kimi_once() {
  local prompt="$1"
  local browser_enabled="${2:-false}"
  local -a extra_args

  if [[ -n "$KIMI_EXTRA_ARGS" ]]; then
    read -r -a extra_args <<< "$KIMI_EXTRA_ARGS"
  else
    extra_args=()
  fi

  if [[ "$browser_enabled" == "true" ]]; then
    extra_args+=(--mcp-config-file "${SCRIPT_DIR}/config/playwright-mcp-isolated.json")
  else
    extra_args+=(--mcp-config-file /tmp/empty-mcp.json)
  fi

  kimi --print -w "$ROOT" "${extra_args[@]}" -p "$prompt"
}

run_agent() {
  local label="$1"
  local prompt="$2"
  local expected_file="${3:-}"
  local browser_enabled="${4:-false}"
  local attempt=0 exit_code=0 ok=false
  local t_start t_end elapsed

  t_start="$(date +%s)"
  while (( attempt < AGENT_MAX_RETRIES )); do
    attempt=$(( attempt + 1 ))
    if (( attempt > 1 )); then
      echo "  [${AGENT_PROVIDER}] ${label} — retry ${attempt}/${AGENT_MAX_RETRIES} after ${AGENT_RETRY_DELAY}s..."
      sleep "$AGENT_RETRY_DELAY"
    fi

    echo "  [${AGENT_PROVIDER}] ${label} — started at $(date +%H:%M:%S)"
    if [[ "$browser_enabled" == "true" ]]; then
      kill_playwright
    fi
    set +e
    if [[ "$AGENT_PROVIDER" == "codex" ]]; then
      _run_codex_once "$label" "$prompt" "$browser_enabled"
      exit_code=$?
    else
      _run_kimi_once "$prompt" "$browser_enabled"
      exit_code=$?
    fi
    set -e

    ok=true
    if (( exit_code != 0 )); then
      ok=false
    fi
    if [[ -n "$expected_file" && ! -f "${ROOT}/${expected_file}" && ! -f "$expected_file" ]]; then
      ok=false
    fi

    if $ok; then
      break
    fi

    echo "  [${AGENT_PROVIDER}] ${label} — attempt ${attempt} failed (exit=${exit_code}, artifact=$(
      [[ -n "$expected_file" ]] && {
        [[ -f "${ROOT}/${expected_file}" || -f "$expected_file" ]] && echo "exists" || echo "MISSING"
      } || echo "n/a"
    ))"
  done

  t_end="$(date +%s)"
  elapsed=$(( t_end - t_start ))
  echo "  [${AGENT_PROVIDER}] ${label} — done in $(( elapsed / 60 ))m $(( elapsed % 60 ))s"
  $ok
}

run_agent_no_browser() {
  run_agent "$1" "$2" "${3:-}" false
}

run_agent_with_browser() {
  run_agent "$1" "$2" "${3:-}" true
}
