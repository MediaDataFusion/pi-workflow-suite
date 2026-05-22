#!/usr/bin/env bash
set -euo pipefail

TARGET_CWD="${1:-$PWD}"
if [[ ! -d "$TARGET_CWD" ]]; then
  printf 'ERROR: target cwd is not a directory: %s\n' "$TARGET_CWD" >&2
  exit 2
fi

TARGET_CWD="$(cd "$TARGET_CWD" && pwd -P)"
AGENT_DIR="${PI_CODING_AGENT_DIR:-${PI_AGENT_DIR:-$HOME/.pi/agent}}"
AGENT_DIR="${AGENT_DIR/#\~/$HOME}"

printf 'Pi Workflow Suite settings audit (read-only)\n'
printf 'Target cwd: %s\n' "$TARGET_CWD"
printf 'Agent dir:  %s\n' "$AGENT_DIR"
if [[ -n "${PI_CODING_AGENT_DIR:-}" ]]; then
  printf 'Agent dir source: PI_CODING_AGENT_DIR\n'
elif [[ -n "${PI_AGENT_DIR:-}" ]]; then
  printf 'Agent dir source: PI_AGENT_DIR script override\n'
else
  printf 'Agent dir source: default ~/.pi/agent\n'
fi
printf '\n'

node - "$TARGET_CWD" "$AGENT_DIR" <<'NODE'
const fs = require('fs');
const path = require('path');

const cwd = process.argv[2];
const agentDir = process.argv[3];
const exists = (p) => fs.existsSync(p);
const bool = (v) => (v ? 'yes' : 'no');

function readJson(file) {
  if (!exists(file)) return { ok: false, missing: true, value: undefined, error: undefined };
  try {
    return { ok: true, missing: false, value: JSON.parse(fs.readFileSync(file, 'utf8')), error: undefined };
  } catch (error) {
    return { ok: false, missing: false, value: undefined, error: error && error.message ? error.message : String(error) };
  }
}

function countArray(value) {
  return Array.isArray(value) ? String(value.length) : '0';
}

function scalar(value) {
  if (value === undefined || value === null || value === '') return '(unset)';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') return String(value);
  if (typeof value === 'string') return value;
  return '(non-scalar)';
}

function printJsonStatus(label, file, result) {
  console.log(`${label}:`);
  console.log(`  path: ${file}`);
  console.log(`  exists: ${bool(!result.missing)}`);
  if (result.error) console.log(`  parse: ERROR (${result.error})`);
  else if (!result.missing) console.log('  parse: ok');
}

function summarizePiSettings(settings) {
  const s = settings || {};
  console.log(`  defaultProvider: ${scalar(s.defaultProvider)}`);
  console.log(`  defaultModel: ${scalar(s.defaultModel)}`);
  console.log(`  defaultThinkingLevel: ${scalar(s.defaultThinkingLevel)}`);
  console.log(`  theme: ${scalar(s.theme)}`);
  console.log(`  quietStartup: ${scalar(s.quietStartup)}`);
  console.log(`  packages count: ${countArray(s.packages)}`);
  console.log(`  extensions count: ${countArray(s.extensions)}`);
  console.log(`  skills count: ${countArray(s.skills)}`);
  console.log(`  prompts count: ${countArray(s.prompts)}`);
  console.log(`  themes count: ${countArray(s.themes)}`);
  console.log(`  sessionDir: ${scalar(s.sessionDir)}`);
}

function summarizeWorkflowSettings(settings) {
  const s = settings || {};
  console.log(`  activePreset: ${scalar(s.presets && s.presets.activePreset)}`);
  console.log(`  workflowTheme: ${scalar(s.ui && s.ui.workflowTheme)}`);
  console.log(`  startupVisual: ${scalar(s.ui && s.ui.startupVisual)}`);
  console.log(`  planning.depth: ${scalar(s.planning && s.planning.depth)}`);
  console.log(`  planning.clarificationMode: ${scalar(s.planning && s.planning.clarificationMode)}`);
  console.log(`  missions.enabled: ${scalar(s.missions && s.missions.enabled)}`);
  console.log(`  missions.defaultAutonomy: ${scalar(s.missions && s.missions.defaultAutonomy)}`);
}

function findWorkflowProjectSettings(start) {
  let dir = start;
  for (let i = 0; i < 40; i++) {
    const candidate = path.join(dir, '.pi', 'workflow-settings.json');
    if (exists(candidate)) return candidate;
    const parent = path.dirname(dir);
    if (parent === dir) return undefined;
    dir = parent;
  }
  return undefined;
}

const globalPi = path.join(agentDir, 'settings.json');
const projectPi = path.join(cwd, '.pi', 'settings.json');
const globalWorkflow = path.join(agentDir, 'workflow-settings.json');
const projectWorkflow = findWorkflowProjectSettings(cwd);
const globalPiResult = readJson(globalPi);
const projectPiResult = readJson(projectPi);
const globalWorkflowResult = readJson(globalWorkflow);
const projectWorkflowResult = projectWorkflow ? readJson(projectWorkflow) : undefined;

console.log('Pi core settings');
console.log('  Note: Pi core project settings are exact-cwd only; Pi does not walk parent directories for .pi/settings.json.');
printJsonStatus('  Global Pi settings', globalPi, globalPiResult);
if (globalPiResult.ok) summarizePiSettings(globalPiResult.value);
printJsonStatus('  Project Pi settings for cwd', projectPi, projectPiResult);
if (projectPiResult.ok) summarizePiSettings(projectPiResult.value);
console.log('');

console.log('Workflow Suite settings');
console.log('  Note: Workflow Suite project settings walk upward from cwd looking for .pi/workflow-settings.json.');
printJsonStatus('  Global Workflow Suite settings', globalWorkflow, globalWorkflowResult);
if (globalWorkflowResult.ok) summarizeWorkflowSettings(globalWorkflowResult.value);
if (projectWorkflow) {
  printJsonStatus('  Project Workflow Suite settings discovered by upward search', projectWorkflow, projectWorkflowResult);
  if (projectWorkflowResult && projectWorkflowResult.ok) summarizeWorkflowSettings(projectWorkflowResult.value);
} else {
  console.log('  Project Workflow Suite settings discovered by upward search: none');
}
console.log('');

console.log('Project resource dirs for exact cwd');
for (const rel of ['extensions', 'skills', 'prompts', 'themes', 'git', 'npm']) {
  const dir = path.join(cwd, '.pi', rel);
  console.log(`  ${rel}: ${exists(dir) ? 'present' : 'absent'} (${dir})`);
}
NODE
