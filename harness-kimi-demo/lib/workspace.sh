#!/usr/bin/env bash
# lib/workspace.sh — Create WORK_ROOT layout (in-tree or external .harness/)
# Requires: SCRIPT_DIR, WORK_ROOT. External mode: WORK_ROOT="$LEGACY_PROJECT/.harness".

ensure_harness_workspace() {
  if [[ "$WORK_ROOT" == "$SCRIPT_DIR" ]]; then
    mkdir -p "$WORK_ROOT/artifacts" "$WORK_ROOT/artifacts/screenshots" \
      "$WORK_ROOT/artifacts/visual/prototypes" \
      "$WORK_ROOT/project" "$WORK_ROOT/prompts/templates"
    return 0
  fi

  mkdir -p "$WORK_ROOT/artifacts" "$WORK_ROOT/artifacts/screenshots" \
    "$WORK_ROOT/artifacts/visual/prototypes"

  if [[ -e "$WORK_ROOT/project" && ! -L "$WORK_ROOT/project" ]]; then
    echo "ERROR: $WORK_ROOT/project exists and is not a symlink. Remove it or use another repo." >&2
    return 1
  fi

  ln -sfn .. "$WORK_ROOT/project"
}
