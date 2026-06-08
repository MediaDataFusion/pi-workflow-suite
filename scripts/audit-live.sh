#!/usr/bin/env bash
set -euo pipefail

LIVE_DIR="${PI_AGENT_DIR:-$HOME/.pi/agent}"
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

printf 'Pi Workflow Suite live runtime audit\n'
printf 'Live runtime: %s\n' "$LIVE_DIR"
printf 'Repo mirror: %s\n' "$REPO_DIR"
printf '\n'

if [[ -d "$LIVE_DIR/.git" ]]; then
  printf 'WARN: top-level live runtime .git exists: %s/.git\n' "$LIVE_DIR"
else
  printf 'OK: no top-level live runtime .git found\n'
fi

printf '\nLoadable extension candidates discovered by Pi rules:\n'
{
  find "$LIVE_DIR/extensions" -maxdepth 1 \( -name '*.ts' -o -name '*.js' \) -type f -print 2>/dev/null || true
  find "$LIVE_DIR/extensions" -mindepth 2 -maxdepth 2 \( -name 'index.ts' -o -name 'index.js' \) -type f -print 2>/dev/null || true
} | sed "s#^$LIVE_DIR/##" | sort

printf '\nRequired managed file check:\n'
missing=0
while IFS= read -r rel; do
  if [[ ! -f "$LIVE_DIR/$rel" ]]; then
    printf 'MISSING: %s\n' "$rel"
    missing=1
  fi
done < <(cd "$REPO_DIR" && find agents skills extensions config -type f ! -name '.DS_Store' ! -name '*.bak' ! -name '*.backup.*' ! -name '*.broken.*' | sort)
if [[ "$missing" -eq 0 ]]; then
  printf 'OK: no missing canonical managed files\n'
fi

printf '\nStale/noisy files in active live runtime paths:\n'
stale_list="$(find "$LIVE_DIR" -maxdepth 3 \( -name '*.backup.*' -o -name '*.broken.*' -o -name '.DS_Store' -o -name '*.log' \) -print 2>/dev/null | sed "s#^$LIVE_DIR/##" | sort || true)"
if [[ -n "$stale_list" ]]; then
  printf '%s\n' "$stale_list"
else
  printf 'OK: none found\n'
fi

printf '\nStale/development directories:\n'
found_dir=0
for rel in recovery-snapshots extensions-disabled prompts.disabled docs; do
  if [[ -e "$LIVE_DIR/$rel" ]]; then
    printf 'FOUND: %s\n' "$rel"
    found_dir=1
  fi
done
if [[ "$found_dir" -eq 0 ]]; then
  printf 'OK: none found\n'
fi

printf '\nProtected runtime state presence (contents not shown):\n'
for rel in auth.json settings.json workflow-settings.json sessions workflows; do
  if [[ -e "$LIVE_DIR/$rel" ]]; then
    printf 'present: %s\n' "$rel"
  else
    printf 'not found: %s\n' "$rel"
  fi
done

printf '\nSettings scope note:\n'
printf 'Pi core project settings are exact-cwd only: <cwd>/.pi/settings.json\n'
printf 'Workflow Suite project settings walk upward from cwd: .pi/workflow-settings.json\n'
printf 'Run read-only settings audit for a target cwd with:\n'
printf '  %s/scripts/audit-settings.sh [target-cwd]\n' "$REPO_DIR"
