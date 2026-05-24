#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LIVE_DIR="${PI_AGENT_DIR:-$HOME/.pi/agent}"

printf 'Installing from repo mirror into live Pi runtime ~/.pi/agent.\n'
printf 'Repo mirror: %s\n' "$REPO_DIR"
printf 'Live runtime: %s\n' "$LIVE_DIR"
printf 'A live backup will be created before installing files.\n'

"$REPO_DIR/scripts/backup-live.sh"

is_forbidden_path() {
  local rel="$1"
  case "$rel" in
    auth.json|settings.json|workflow-settings.json|active.json|workflows/*|missions/*|plans/*|sessions/*|logs/*|*.log|*.backup.*|*.broken.*|.env|.env.*|.factory/*|.cursor/*|.kilo/*|node_modules/*|*.DS_Store|*.tmp)
      return 0
      ;;
  esac
  return 1
}

validate_source_file() {
  local file="$1"
  case "$file" in
    *.json) python3 -m json.tool "$file" >/dev/null ;;
    *.ts|*.md|*.sh) test -s "$file" ;;
    *) test -f "$file" ;;
  esac
}

atomic_install_file() {
  local rel="$1"
  if is_forbidden_path "$rel"; then
    printf 'refusing forbidden install path: %s\n' "$rel" >&2
    exit 1
  fi
  local src="$REPO_DIR/$rel"
  local dst="$LIVE_DIR/$rel"
  if [[ ! -f "$src" ]]; then
    printf 'missing repo file: %s\n' "$src" >&2
    exit 1
  fi
  validate_source_file "$src"
  mkdir -p "$(dirname "$dst")"
  local tmp="$dst.tmp-$$-$(date +%s%N)"
  install -m 0644 "$src" "$tmp"
  validate_source_file "$tmp"
  mv -f "$tmp" "$dst"
  printf 'installed atomically: %s -> %s\n' "$src" "$dst"
}

install_dir() {
  local rel="$1"
  local src_root="$REPO_DIR/$rel"
  if [[ ! -d "$src_root" ]]; then
    printf 'skipping missing optional repo directory: %s\n' "$src_root"
    return 0
  fi
  if find "$src_root" -type l | grep -q .; then
    printf 'refusing to install symlinks from repo directory: %s\n' "$src_root" >&2
    exit 1
  fi
  while IFS= read -r -d '' file; do
    local sub="${file#$REPO_DIR/}"
    if is_forbidden_path "$sub"; then
      continue
    fi
    atomic_install_file "$sub"
  done < <(find "$src_root" -type f \
    ! -name '.DS_Store' \
    ! -name '*.log' \
    ! -name '*.tmp' \
    ! -name '*.backup.*' \
    ! -name '*.broken.*' \
    -print0)
}

atomic_install_file "package.json"
atomic_install_file "package-lock.json"
install_dir "extensions"
install_dir "agents"
install_dir "skills"
install_dir "config"
install_dir "themes"

printf 'install complete; auth, settings, and workflow state were not touched\n'
