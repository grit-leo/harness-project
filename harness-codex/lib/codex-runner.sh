#!/usr/bin/env bash
# lib/codex-runner.sh — Codex CLI invocation wrappers with dynamic MCP toggle
# Uses temporary CODEX_HOME to control MCP configuration per-step without
# polluting the user's global ~/.codex/config.toml.

CODEX_MAX_RETRIES="${CODEX_MAX_RETRIES:-3}"
CODEX_RETRY_DELAY="${CODEX_RETRY_DELAY:-10}"
CODEX_EXTRA_ARGS="${CODEX_EXTRA_ARGS:-}"

# ── Prepare a temporary CODEX_HOME with auth + optional Playwright MCP ──
_prepare_codex_home() {
  local mode="$1"  # "browser" or "no-browser"
  local tmpdir="/tmp/codex-harness-$$-${mode}"
  mkdir -p "$tmpdir"

  # Copy auth so Codex can still authenticate
  if [[ -f "$HOME/.codex/auth.json" ]]; then
    cp "$HOME/.codex/auth.json" "$tmpdir/auth.json"
  fi

  # Read existing config (if any), strip mcp_servers, then optionally inject Playwright
  python3 -c "
import os, sys
config_path = os.path.expanduser('~/.codex/config.toml')
config = {}
if os.path.exists(config_path):
    try:
        import tomllib
        with open(config_path, 'rb') as f:
            config = tomllib.load(f)
    except Exception as e:
        pass

# Remove any existing mcp_servers
config.pop('mcp_servers', None)

if '${mode}' == 'browser':
    config['mcp_servers'] = {
        'playwright': {
            'command': 'npx',
            'args': ['-y', '@playwright/mcp@latest', '--isolated']
        }
    }

# Simple TOML emitter
lines = []
def emit_value(v):
    if isinstance(v, str):
        return f'\"{v}\"'
    elif isinstance(v, bool):
        return 'true' if v else 'false'
    elif isinstance(v, list):
        return '[' + ', '.join(emit_value(x) for x in v) + ']'
    else:
        return str(v)

def quote_key(k):
    import re
    if re.match(r'^[A-Za-z0-9_-]+$', k):
        return k
    return f'"{k}"'

def emit_table(d, prefix=''):
    for k, v in d.items():
        if isinstance(v, dict):
            section = f'{prefix}.{quote_key(k)}' if prefix else quote_key(k)
            lines.append(f'')
            lines.append(f'[{section}]')
            emit_table(v, section)
        else:
            lines.append(f'{quote_key(k)} = {emit_value(v)}')

emit_table(config)

with open('${tmpdir}/config.toml', 'w') as f:
    f.write('\n'.join(lines) + '\n')
" 2>/dev/null || {
    # Fallback: write minimal config
    echo 'model = "gpt-5.5"' > "$tmpdir/config.toml"
    if [[ "$mode" == "browser" ]]; then
      cat >> "$tmpdir/config.toml" <<'EOF'

[mcp_servers.playwright]
command = "npx"
args = ["-y", "@playwright/mcp@latest", "--isolated"]
EOF
    fi
  }

  echo "$tmpdir"
}

# ── Base runner ─────────────────────────────────────────────────────────
run_codex() {
  local label="$1"
  local prompt="$2"
  local expected_file="${3:-}"
  local t_start t_end elapsed attempt=0 exit_code ok
  local codex_home="${CODEX_HOME:-}"

  t_start="$(date +%s)"

  while (( attempt < CODEX_MAX_RETRIES )); do
    attempt=$(( attempt + 1 ))
    if (( attempt > 1 )); then
      echo "  [codex] ${label} — retry ${attempt}/${CODEX_MAX_RETRIES} after ${CODEX_RETRY_DELAY}s cooldown..."
      sleep "$CODEX_RETRY_DELAY"
    fi

    echo "  [codex] ${label} — started at $(date +%H:%M:%S)"

    set +e
    if [[ -n "$codex_home" ]]; then
      CODEX_HOME="$codex_home" codex exec --dangerously-bypass-approvals-and-sandbox -C "$ROOT" $CODEX_EXTRA_ARGS "$prompt"
    else
      codex exec --dangerously-bypass-approvals-and-sandbox -C "$ROOT" $CODEX_EXTRA_ARGS "$prompt"
    fi
    exit_code=$?
    set -e

    ok=true
    if (( exit_code != 0 )); then
      ok=false
    fi
    if [[ -n "$expected_file" && ! -f "$expected_file" ]]; then
      ok=false
    fi

    if $ok; then
      break
    fi

    echo "  [codex] ${label} — attempt ${attempt} failed (exit=${exit_code}, artifact=$(
      [[ -n "$expected_file" ]] && { [[ -f "$expected_file" ]] && echo "exists" || echo "MISSING"; } || echo "n/a"
    ))"
  done

  t_end="$(date +%s)"
  elapsed=$(( t_end - t_start ))
  echo "  [codex] ${label} — done in $(( elapsed / 60 ))m $(( elapsed % 60 ))s"
}

# ── Browser-enabled runner (Playwright MCP) ─────────────────────────────
run_codex_with_browser() {
  local label="$1"
  local prompt="$2"
  local expected_file="${3:-}"
  local t_start t_end elapsed attempt=0 exit_code ok
  local tmpdir

  tmpdir="$(_prepare_codex_home browser)"

  t_start="$(date +%s)"

  while (( attempt < CODEX_MAX_RETRIES )); do
    attempt=$(( attempt + 1 ))
    if (( attempt > 1 )); then
      echo "  [codex] ${label} — retry ${attempt}/${CODEX_MAX_RETRIES} after ${CODEX_RETRY_DELAY}s cooldown..."
      sleep "$CODEX_RETRY_DELAY"
    fi

    kill_playwright

    echo "  [codex] ${label} — started at $(date +%H:%M:%S)"

    set +e
    CODEX_HOME="$tmpdir" codex exec --dangerously-bypass-approvals-and-sandbox -C "$ROOT" $CODEX_EXTRA_ARGS "$prompt"
    exit_code=$?
    set -e

    ok=true
    if (( exit_code != 0 )); then
      ok=false
    fi
    if [[ -n "$expected_file" && ! -f "$expected_file" ]]; then
      ok=false
    fi

    if $ok; then
      break
    fi

    echo "  [codex] ${label} — attempt ${attempt} failed (exit=${exit_code}, artifact=$(
      [[ -n "$expected_file" ]] && { [[ -f "$expected_file" ]] && echo "exists" || echo "MISSING"; } || echo "n/a"
    ))"
  done

  t_end="$(date +%s)"
  elapsed=$(( t_end - t_start ))
  echo "  [codex] ${label} — done in $(( elapsed / 60 ))m $(( elapsed % 60 ))s"

  # Cleanup temp CODEX_HOME
  rm -rf "$tmpdir"
}

# ── No-browser runner (disables MCP entirely) ───────────────────────────
run_codex_no_browser() {
  local label="$1"
  local prompt="$2"
  local expected_file="${3:-}"
  local t_start t_end elapsed attempt=0 exit_code ok
  local tmpdir

  tmpdir="$(_prepare_codex_home no-browser)"

  t_start="$(date +%s)"

  while (( attempt < CODEX_MAX_RETRIES )); do
    attempt=$(( attempt + 1 ))
    if (( attempt > 1 )); then
      echo "  [codex] ${label} — retry ${attempt}/${CODEX_MAX_RETRIES} after ${CODEX_RETRY_DELAY}s cooldown..."
      sleep "$CODEX_RETRY_DELAY"
    fi

    echo "  [codex] ${label} — started at $(date +%H:%M:%S)"

    set +e
    CODEX_HOME="$tmpdir" codex exec --dangerously-bypass-approvals-and-sandbox -C "$ROOT" $CODEX_EXTRA_ARGS "$prompt"
    exit_code=$?
    set -e

    ok=true
    if (( exit_code != 0 )); then
      ok=false
    fi
    if [[ -n "$expected_file" && ! -f "$expected_file" ]]; then
      ok=false
    fi

    if $ok; then
      break
    fi

    echo "  [codex] ${label} — attempt ${attempt} failed (exit=${exit_code}, artifact=$(
      [[ -n "$expected_file" ]] && { [[ -f "$expected_file" ]] && echo "exists" || echo "MISSING"; } || echo "n/a"
    ))"
  done

  t_end="$(date +%s)"
  elapsed=$(( t_end - t_start ))
  echo "  [codex] ${label} — done in $(( elapsed / 60 ))m $(( elapsed % 60 ))s"

  # Cleanup temp CODEX_HOME
  rm -rf "$tmpdir"
}
