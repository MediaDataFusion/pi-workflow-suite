#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

fail=0
report() {
  printf 'ERROR: %s\n' "$1" >&2
  fail=1
}

if [[ -e AGENTS.md && -n "$(git ls-files AGENTS.md)" ]]; then report 'AGENTS.md must not be present on clean release main'; fi
if [[ -e .github && -n "$(git ls-files .github)" ]]; then report '.github/ must not be tracked on clean release main'; fi
if [[ -e .factory && -n "$(git ls-files .factory)" ]]; then report '.factory/ must not be tracked on clean release main'; fi
if [[ -e .kilo && -n "$(git ls-files .kilo)" ]]; then report '.kilo/ must not be tracked on clean release main'; fi
if [[ -e .cursor && -n "$(git ls-files .cursor)" ]]; then report '.cursor/ must not be tracked on clean release main'; fi

while IFS= read -r path; do
  case "$path" in
    agents/*|config/*|extensions/*|skills/*|docs/assets/*|themes/*|scripts/install-to-live.sh|scripts/verify-live.sh|scripts/audit-live.sh|scripts/quarantine-live-junk.sh|scripts/backup-live.sh|scripts/audit-settings.sh|scripts/bootstrap-project.sh|scripts/check-clean-release-tree.sh|scripts/build-package-export.mjs|README.md|CHANGELOG.md|CONTRIBUTING.md|LICENSE.md|NOTICE|SECURITY.md|SUPPORT.md|TRADEMARKS.md|VERSION|package.json|package-lock.json|tsconfig.json|.gitignore)
      ;;
    docs/*)
      report "non-asset docs file is not allowed: $path"
      ;;
    scripts/test-*|scripts/sync-from-live.sh)
      report "internal script is not allowed: $path"
      ;;
    .github/*|AGENTS.md|.factory/*|.kilo/*|.cursor/*)
      report "internal path is not allowed: $path"
      ;;
    *auth.json|*settings.json|*workflow-settings.json|*active.json|workflows/*|*sessions/*|*missions/*|*plans/*|*logs/*|*.env|*.env.*|*.DS_Store)
      report "runtime/private path is not allowed: $path"
      ;;
    *)
      report "path is outside clean release allowlist: $path"
      ;;
  esac
done < <(git ls-files | sort)

if [[ "$fail" -ne 0 ]]; then
  exit 1
fi

printf 'OK: clean release tree allowlist passed\n'
