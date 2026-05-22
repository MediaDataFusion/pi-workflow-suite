#!/usr/bin/env bash
set -euo pipefail

LIVE_DIR="${PI_AGENT_DIR:-$HOME/.pi/agent}"
printf 'This verifies the local live Pi runtime. GitHub Actions cannot perform this check.\n'
printf 'Live runtime: %s\n' "$LIVE_DIR"
missing=0
warning=0

require_file() {
  local rel="$1"
  if [[ -f "$LIVE_DIR/$rel" ]]; then
    printf 'found: %s\n' "$LIVE_DIR/$rel"
  else
    printf 'missing: %s\n' "$LIVE_DIR/$rel" >&2
    missing=1
  fi
}

warn_path() {
  local rel="$1"
  local message="$2"
  if [[ -e "$LIVE_DIR/$rel" ]]; then
    printf 'warning: %s (%s)\n' "$message" "$LIVE_DIR/$rel" >&2
    warning=1
  fi
}

warn_stale_files() {
  local stale
  stale="$(find "$LIVE_DIR" -maxdepth 3 \( -name '*.backup.*' -o -name '*.broken.*' -o -name '.DS_Store' -o -name '*.log' \) -print 2>/dev/null | sort || true)"
  if [[ -n "$stale" ]]; then
    printf 'warning: stale/noisy files found in live runtime; run scripts/audit-live.sh for details\n' >&2
    warning=1
  fi
}

warn_unexpected_loadable_extensions() {
  local expected actual unexpected
  expected="$(cat <<'TEXT'
extensions/subagent/index.ts
extensions/workflow-model-router.ts
extensions/workflow-modes.ts
extensions/workflow-state.ts
extensions/workflow-summary.ts
extensions/workflow-tool-guard.ts
TEXT
)"
  actual="$(
    {
      find "$LIVE_DIR/extensions" -maxdepth 1 \( -name '*.ts' -o -name '*.js' \) -type f -print 2>/dev/null || true
      find "$LIVE_DIR/extensions" -mindepth 2 -maxdepth 2 \( -name 'index.ts' -o -name 'index.js' \) -type f -print 2>/dev/null || true
    } | sed "s#^$LIVE_DIR/##" | sort
  )"
  unexpected="$(comm -13 <(printf '%s\n' "$expected" | sort) <(printf '%s\n' "$actual" | sort) || true)"
  if [[ -n "$unexpected" ]]; then
    printf 'warning: unexpected loadable extension candidates found:\n%s\n' "$unexpected" >&2
    warning=1
  fi
}

require_file "extensions/workflow-modes.ts"
require_file "extensions/workflow-state.ts"
require_file "extensions/workflow-summary.ts"
require_file "extensions/workflow-tool-guard.ts"
require_file "extensions/workflow-model-router.ts"
require_file "extensions/subagent/index.ts"
require_file "extensions/subagent/agents.ts"

require_file "agents/codebase-research.md"
require_file "agents/general-worker.md"
require_file "agents/implementation-planning.md"
require_file "agents/quality-validation.md"
require_file "agents/workflow-orchestrator.md"

require_file "skills/codebase-discovery/SKILL.md"
require_file "skills/find-skills/SKILL.md"
require_file "skills/git-safe-summary/SKILL.md"
require_file "skills/implementation-planning/SKILL.md"
require_file "skills/project-rules-audit/SKILL.md"
require_file "skills/safe-execution/SKILL.md"
require_file "skills/validation-review/SKILL.md"

require_file "config/prompts/execute-approved-plan.md"
require_file "config/prompts/validate-approved-plan.md"
require_file "config/prompts/workflow-plan-prompt.md"
require_file "config/prompts/workflow-summary.md"
require_file "config/prompts/workflow-repair.md"
require_file "config/prompts/mission-plan.md"
require_file "config/prompts/mission-run.md"
require_file "config/prompts/mission-repair.md"
require_file "config/prompts/mission-checkpoint.md"
require_file "config/prompts/mission-final-validation.md"

require_file "config/workflow-settings.example.json"

warn_path ".git" "top-level .git should not be inside the live Pi runtime"
warn_path "recovery-snapshots" "stale recovery snapshot directory should be quarantined outside active runtime"
warn_path "extensions-disabled" "disabled extension directory should be reviewed/quarantined outside active runtime"
warn_path "prompts.disabled" "disabled prompt directory should be reviewed/quarantined outside active runtime"
warn_path "docs" "repo docs should not be mixed into active live runtime unless intentionally used"
warn_stale_files
warn_unexpected_loadable_extensions

if [[ "$missing" -ne 0 ]]; then
  exit 1
fi

if [[ "$warning" -ne 0 ]]; then
  printf 'live runtime warnings detected; required files are present, but cleanup/audit is recommended\n' >&2
fi

printf '\nRunning basic Pi load check: pi --help\n'
pi --help >/dev/null
printf 'basic load check passed\n'

cat <<'TEXT'

Manual runtime tests still required:
- pi
- /workflow status
- /workflow settings Show Current Settings
- /p
- /p <task>
- approval action

Note: pi --help is only a basic load check, not full workflow verification.
TEXT
