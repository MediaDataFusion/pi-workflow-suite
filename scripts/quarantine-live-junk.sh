#!/usr/bin/env bash
set -euo pipefail

LIVE_DIR="${PI_AGENT_DIR:-$HOME/.pi/agent}"
BACKUP_BASE="${PI_BACKUP_DIR:-$HOME/.pi/agent-emergency-backups}"
TS="$(date +%Y%m%d-%H%M%S)"
DEST="$BACKUP_BASE/live-junk-quarantine-$TS"
APPLY=0

if [[ "${1:-}" == "--apply" ]]; then
  APPLY=1
elif [[ "${1:-}" == "" ]]; then
  APPLY=0
else
  printf 'usage: %s [--apply]\n' "$0" >&2
  exit 2
fi

printf 'Pi Workflow Suite live junk quarantine\n'
printf 'Live runtime: %s\n' "$LIVE_DIR"
printf 'Quarantine destination: %s\n' "$DEST"
if [[ "$APPLY" -eq 0 ]]; then
  printf 'Mode: dry run. Re-run with --apply to move files.\n'
else
  printf 'Mode: apply. Files will be moved, not deleted.\n'
  mkdir -p "$DEST"
fi

move_rel() {
  local rel="$1"
  local src="$LIVE_DIR/$rel"
  local dst="$DEST/$rel"
  [[ -e "$src" ]] || return 0
  if [[ "$APPLY" -eq 0 ]]; then
    printf 'would quarantine: %s\n' "$rel"
    return 0
  fi
  mkdir -p "$(dirname "$dst")"
  mv "$src" "$dst"
  printf 'quarantined: %s\n' "$rel"
}

# Stale Git metadata in the live runtime is not required by Pi and should not be
# mixed with auth, settings, sessions, or workflow state.
move_rel ".git"

# Only move backup/broken/log/Finder debris. Do not move current auth/settings,
# current workflow state, session JSONL files, mission files, or plan files.
while IFS= read -r -d '' path; do
  rel="${path#$LIVE_DIR/}"
  case "$rel" in
    auth.json|settings.json|workflow-settings.json|sessions/*.jsonl|workflows/missions/*|workflows/plans/*)
      continue
      ;;
  esac
  move_rel "$rel"
done < <(find "$LIVE_DIR" -maxdepth 3 \( -name '*.backup.*' -o -name '*.broken.*' -o -name '.DS_Store' -o -name '*.log' \) -print0 2>/dev/null)

# Known stale/development directories from earlier manual repair flows. These are
# quarantined whole only when present. Review the dry-run output first.
for rel in recovery-snapshots extensions-disabled prompts.disabled docs; do
  move_rel "$rel"
done

if [[ "$APPLY" -eq 0 ]]; then
  printf 'Dry run complete; no files moved.\n'
else
  printf 'Quarantine complete: %s\n' "$DEST"
fi
