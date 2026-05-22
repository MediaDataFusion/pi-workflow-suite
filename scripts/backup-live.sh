#!/usr/bin/env bash
set -euo pipefail

LIVE_DIR="${PI_AGENT_DIR:-$HOME/.pi/agent}"
BACKUP_ROOT="${PI_AGENT_BACKUP_DIR:-$HOME/.pi/agent-backups}"
STAMP="$(date +%Y%m%d-%H%M%S)"
DEST="$BACKUP_ROOT/pi-workflow-suite-$STAMP"

printf 'Creating timestamped backup of safe Pi workflow suite areas.\n'
printf 'Live runtime: %s\n' "$LIVE_DIR"
printf 'Backup destination: %s\n' "$DEST"
printf 'Included: package manifests, agents, skills, extensions, config, and config/prompts.\n'
printf 'Excluded: auth.json, settings.json, workflow-settings.json, workflows, missions, plans, sessions, logs, backups, and runtime state.\n'

mkdir -p "$DEST"

backup_file() {
  local rel="$1"
  if [[ -f "$LIVE_DIR/$rel" ]]; then
    mkdir -p "$(dirname "$DEST/$rel")"
    cp -p "$LIVE_DIR/$rel" "$DEST/$rel"
    printf 'backed up file: %s -> %s\n' "$LIVE_DIR/$rel" "$DEST/$rel"
  fi
}

backup_dir() {
  local rel="$1"
  local src="$LIVE_DIR/$rel/"
  local dst="$DEST/$rel/"
  if [[ -d "$LIVE_DIR/$rel" ]]; then
    mkdir -p "$dst"
    rsync -avL \
      --exclude '.DS_Store' \
      --exclude '*.log' \
      --exclude '*.tmp' \
      --exclude '*.backup.*' \
      --exclude '*.broken.*' \
      --exclude 'auth.json' \
      --exclude 'settings.json' \
      --exclude 'workflow-settings.json' \
      --exclude 'active.json' \
      --exclude 'workflows/' \
      --exclude 'missions/' \
      --exclude 'plans/' \
      --exclude 'sessions/' \
      --exclude 'logs/' \
      --exclude '.env' \
      --exclude '.env.*' \
      --exclude '.factory/' \
      --exclude '.cursor/' \
      "$src" "$dst"
    printf 'backed up directory: %s -> %s\n' "$src" "$dst"
  fi
}

backup_file "package.json"
backup_file "package-lock.json"
backup_dir "agents"
backup_dir "skills"
backup_dir "extensions"
backup_dir "config"

printf 'backup complete: %s\n' "$DEST"
