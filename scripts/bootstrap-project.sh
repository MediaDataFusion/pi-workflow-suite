#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APPLY=0
ALLOW_HOME=0
CREATE_WORKFLOW_SETTINGS=1
CREATE_APPEND_SYSTEM=1
UPDATE_GITIGNORE=1
PACKAGE_SOURCE=""
PRESET=""
WORKFLOW_THEME=""
TARGET=""

usage() {
  cat <<'USAGE'
Usage: ./scripts/bootstrap-project.sh <project-dir> [options]

Dry-run by default. Creates a project Workflow Suite scaffold only with --apply.
Does not modify the live ~/.pi/agent runtime.

Options:
  --apply                         Write files. Default is dry-run.
  --allow-home                    Allow targeting $HOME explicitly.
  --no-workflow-settings          Do not create .pi/workflow-settings.json.
  --no-append-system              Do not create .pi/APPEND_SYSTEM.md.
  --no-gitignore                  Do not append project .gitignore runtime exclusions.
  --package-source <source>       Also create .pi/settings.json with a Pi package reference.
                                  Example after publish: npm:@mediadatafusion/pi-workflow-suite
  --preset <name>                 Set presets.activePreset in copied workflow settings.
  --workflow-theme <name>         Set ui.workflowTheme in copied workflow settings.
  -h, --help                      Show help.

Current behavior note:
  Workflow Suite settings are global/project scoped, not session-local. Project
  .pi/workflow-settings.json affects sessions launched under that project scope.
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --apply) APPLY=1; shift ;;
    --allow-home) ALLOW_HOME=1; shift ;;
    --no-workflow-settings) CREATE_WORKFLOW_SETTINGS=0; shift ;;
    --no-append-system) CREATE_APPEND_SYSTEM=0; shift ;;
    --no-gitignore) UPDATE_GITIGNORE=0; shift ;;
    --package-source)
      [[ $# -ge 2 ]] || { printf 'ERROR: --package-source needs a value\n' >&2; exit 2; }
      PACKAGE_SOURCE="$2"; shift 2 ;;
    --preset)
      [[ $# -ge 2 ]] || { printf 'ERROR: --preset needs a value\n' >&2; exit 2; }
      PRESET="$2"; shift 2 ;;
    --workflow-theme)
      [[ $# -ge 2 ]] || { printf 'ERROR: --workflow-theme needs a value\n' >&2; exit 2; }
      WORKFLOW_THEME="$2"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    --*) printf 'ERROR: unknown option: %s\n' "$1" >&2; usage >&2; exit 2 ;;
    *)
      if [[ -n "$TARGET" ]]; then
        printf 'ERROR: multiple project directories provided: %s and %s\n' "$TARGET" "$1" >&2
        exit 2
      fi
      TARGET="$1"; shift ;;
  esac
done

if [[ -z "$TARGET" ]]; then
  usage >&2
  exit 2
fi

if [[ ! -d "$TARGET" ]]; then
  printf 'ERROR: project directory does not exist: %s\n' "$TARGET" >&2
  exit 2
fi

TARGET="$(cd "$TARGET" && pwd -P)"
HOME_REAL="$(cd "$HOME" && pwd -P)"
if [[ "$TARGET" == "$HOME_REAL" && "$ALLOW_HOME" -ne 1 ]]; then
  printf 'ERROR: refusing to target HOME without --allow-home: %s\n' "$TARGET" >&2
  printf 'This avoids confusing home-directory project settings with global ~/.pi/agent state.\n' >&2
  exit 2
fi

PI_DIR="$TARGET/.pi"
WORKFLOW_FILE="$PI_DIR/workflow-settings.json"
APPEND_SYSTEM_FILE="$PI_DIR/APPEND_SYSTEM.md"
PROJECT_SETTINGS_FILE="$PI_DIR/settings.json"
GITIGNORE_FILE="$TARGET/.gitignore"
EXAMPLE_WORKFLOW="$REPO_DIR/config/workflow-settings.example.json"

printf 'Pi Workflow Suite project bootstrap\n'
printf 'Mode: %s\n' "$([[ "$APPLY" -eq 1 ]] && printf apply || printf dry-run)"
printf 'Project: %s\n' "$TARGET"
printf '\n'
printf 'Current scope behavior:\n'
printf '  Pi core project settings: exact cwd .pi/settings.json\n'
printf '  Workflow Suite project settings: nearest upward .pi/workflow-settings.json\n'
printf '  Workflow Suite settings are not session-local today.\n'
printf '\n'

planned=0

plan_line() {
  printf '%s\n' "$1"
  planned=1
}

if [[ "$CREATE_WORKFLOW_SETTINGS" -eq 1 ]]; then
  if [[ -e "$WORKFLOW_FILE" ]]; then
    printf 'exists, skip: %s\n' "$WORKFLOW_FILE"
  else
    plan_line "create: $WORKFLOW_FILE"
  fi
fi

if [[ "$CREATE_APPEND_SYSTEM" -eq 1 ]]; then
  if [[ -e "$APPEND_SYSTEM_FILE" ]]; then
    printf 'exists, skip: %s\n' "$APPEND_SYSTEM_FILE"
  else
    plan_line "create: $APPEND_SYSTEM_FILE"
  fi
fi

if [[ "$UPDATE_GITIGNORE" -eq 1 ]]; then
  plan_line "ensure runtime exclusions in: $GITIGNORE_FILE"
fi

if [[ -n "$PACKAGE_SOURCE" ]]; then
  if [[ -e "$PROJECT_SETTINGS_FILE" ]]; then
    printf 'exists, skip package reference: %s\n' "$PROJECT_SETTINGS_FILE"
    printf '  Review and edit existing project Pi settings manually if needed.\n'
  else
    plan_line "create package reference: $PROJECT_SETTINGS_FILE -> $PACKAGE_SOURCE"
  fi
fi

if [[ "$planned" -eq 0 ]]; then
  printf 'No changes needed.\n'
fi

if [[ "$APPLY" -ne 1 ]]; then
  printf '\nDry run only. Re-run with --apply to write files.\n'
  exit 0
fi

mkdir -p "$PI_DIR"

if [[ "$CREATE_WORKFLOW_SETTINGS" -eq 1 && ! -e "$WORKFLOW_FILE" ]]; then
  if [[ ! -f "$EXAMPLE_WORKFLOW" ]]; then
    printf 'ERROR: missing example workflow settings: %s\n' "$EXAMPLE_WORKFLOW" >&2
    exit 1
  fi
  cp "$EXAMPLE_WORKFLOW" "$WORKFLOW_FILE"
  if [[ -n "$PRESET" || -n "$WORKFLOW_THEME" ]]; then
    node - "$WORKFLOW_FILE" "$PRESET" "$WORKFLOW_THEME" <<'NODE'
const fs = require('fs');
const file = process.argv[2];
const preset = process.argv[3];
const workflowTheme = process.argv[4];
const data = JSON.parse(fs.readFileSync(file, 'utf8'));
if (preset) {
  data.presets = data.presets || {};
  data.presets.activePreset = preset;
}
if (workflowTheme) {
  data.ui = data.ui || {};
  data.ui.workflowTheme = workflowTheme;
}
fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
NODE
  fi
  printf 'created: %s\n' "$WORKFLOW_FILE"
fi

if [[ "$CREATE_APPEND_SYSTEM" -eq 1 && ! -e "$APPEND_SYSTEM_FILE" ]]; then
  cat > "$APPEND_SYSTEM_FILE" <<'EOF'
# Project Workflow Guidance

This project may use Pi Workflow Suite for approval-gated planning, execution, validation, and mission workflows.

- Prefer `/p <task>` for scoped implementation work.
- Use `/workflow-settings scope` to verify whether project workflow settings are active.
- Treat project `AGENTS.md` as the main source of project rules and commands.
- Do not assume Workflow Suite settings are session-local; project `.pi/workflow-settings.json` applies to sessions launched under this project scope.
EOF
  printf 'created: %s\n' "$APPEND_SYSTEM_FILE"
fi

if [[ "$UPDATE_GITIGNORE" -eq 1 ]]; then
  touch "$GITIGNORE_FILE"
  if ! grep -qF '# Pi Workflow Suite runtime state' "$GITIGNORE_FILE"; then
    cat >> "$GITIGNORE_FILE" <<'EOF'

# Pi Workflow Suite runtime state
.pi/sessions/
.pi/workflows/
.pi/npm/
.pi/git/
.pi/*.tmp-*
EOF
    printf 'updated: %s\n' "$GITIGNORE_FILE"
  else
    printf 'already has Pi Workflow Suite runtime block: %s\n' "$GITIGNORE_FILE"
  fi
fi

if [[ -n "$PACKAGE_SOURCE" && ! -e "$PROJECT_SETTINGS_FILE" ]]; then
  node - "$PROJECT_SETTINGS_FILE" "$PACKAGE_SOURCE" <<'NODE'
const fs = require('fs');
const file = process.argv[2];
const source = process.argv[3];
const data = { packages: [source] };
fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
NODE
  printf 'created: %s\n' "$PROJECT_SETTINGS_FILE"
fi

printf '\nBootstrap complete. Verify with:\n'
printf '  %s/scripts/audit-settings.sh %s\n' "$REPO_DIR" "$TARGET"
