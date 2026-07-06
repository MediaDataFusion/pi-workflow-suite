import { existsSync, realpathSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { isAbsolute, resolve, join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { getAgentDir, type ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { loadWorkflowSettings } from "./workflow-model-router.js";
import { loadMissionState, type WorkflowState } from "./workflow-state.js";

export const PLAN_TOOLS = ["read", "grep", "find", "ls"];
export const WORKFLOW_PROGRESS_TOOL = "workflow_progress";
export const WORKFLOW_DIAGRAM_TOOL = "workflow_diagram";
export const WORKFLOW_PLAN_RESULT_TOOL = "workflow_plan_result";
export const WORKFLOW_REVIEW_RESULT_TOOL = "workflow_review_result";
export const WORKFLOW_EXECUTION_RESULT_TOOL = "workflow_execution_result";
export const WORKFLOW_VALIDATION_RESULT_TOOL = "workflow_validation_result";
export const WORKFLOW_REPAIR_RESULT_TOOL = "workflow_repair_result";
export const MISSION_PLAN_RESULT_TOOL = "mission_plan_result";
export const MISSION_MILESTONE_RESULT_TOOL = "mission_milestone_result";
export const STANDARD_HANDOFF_RESULT_TOOL = "standard_handoff_result";
export const PLAN_RESULT_TOOLS = [WORKFLOW_PLAN_RESULT_TOOL, MISSION_PLAN_RESULT_TOOL];
export const REVIEW_RESULT_TOOLS = [WORKFLOW_REVIEW_RESULT_TOOL];
export const EXECUTION_RESULT_TOOLS = [WORKFLOW_EXECUTION_RESULT_TOOL, MISSION_MILESTONE_RESULT_TOOL];
export const VALIDATION_RESULT_TOOLS = [WORKFLOW_VALIDATION_RESULT_TOOL];
export const REPAIR_RESULT_TOOLS = [WORKFLOW_REPAIR_RESULT_TOOL];
export const STANDARD_RESULT_TOOLS = [STANDARD_HANDOFF_RESULT_TOOL];
export const BASE_EXECUTE_TOOLS = ["read", "grep", "find", "ls", "edit", "write", "bash", WORKFLOW_DIAGRAM_TOOL];
export const EXECUTE_TOOLS = [...BASE_EXECUTE_TOOLS, WORKFLOW_PROGRESS_TOOL, ...EXECUTION_RESULT_TOOLS, ...REPAIR_RESULT_TOOLS];
export const REVIEW_TOOLS = ["read", "grep", "find", "ls", WORKFLOW_DIAGRAM_TOOL, ...REVIEW_RESULT_TOOLS];
export const VALIDATOR_TOOLS = ["read", "grep", "find", "ls", "bash", WORKFLOW_DIAGRAM_TOOL, ...VALIDATION_RESULT_TOOLS];


const PATH_SCOPED_TOOLS = new Set(["read", "grep", "find", "ls", "edit", "write"]);

function safeRealpath(path: string): string {
  try {
    return realpathSync(path);
  } catch {
    return path;
  }
}

function repoRootForCwd(cwd: string): string {
  try {
    const root = execFileSync("git", ["rev-parse", "--show-toplevel"], { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
    return safeRealpath(root || cwd);
  } catch {
    return safeRealpath(cwd);
  }
}

function resolveCandidatePath(pathValue: string, cwd: string): string {
  const expanded = pathValue === "~" || pathValue.startsWith("~/") ? resolve(process.env.HOME || cwd, pathValue.slice(2)) : pathValue;
  const resolved = isAbsolute(expanded) ? resolve(expanded) : resolve(cwd, expanded || ".");
  if (existsSync(resolved)) return safeRealpath(resolved);
  const existingParent = safeRealpath(resolve(resolved, ".."));
  return resolve(existingParent, resolved.split(/[\\/]/).pop() || "");
}

function pathInsideRoot(candidate: string, root: string): boolean {
  return candidate === root || candidate.startsWith(`${root}/`);
}

function repoLockRoot(cwd: string): string {
  return process.env.PI_WORKFLOW_REPO_LOCK_ENABLED === "1" && process.env.PI_WORKFLOW_REPO_LOCK_ROOT
    ? safeRealpath(process.env.PI_WORKFLOW_REPO_LOCK_ROOT)
    : repoRootForCwd(cwd);
}

function protectedRepoPath(candidate: string, root: string): boolean {
  const rel = candidate === root ? "" : candidate.slice(root.length + 1);
  return rel === ".pi" || rel.startsWith(".pi/");
}

function piRuntimeInstructionPath(candidate: string): boolean {
  const root = safeRealpath(getAgentDir());
  if (!pathInsideRoot(candidate, root)) return false;
  const rel = candidate === root ? "" : candidate.slice(root.length + 1);
  return rel === "skills" || rel.startsWith("skills/")
    || rel === "agents" || rel.startsWith("agents/")
    || rel === "config/prompts" || rel.startsWith("config/prompts/")
    || rel === "prompts" || rel.startsWith("prompts/")
    || rel === "themes" || rel.startsWith("themes/");
}

function packageInstructionPath(candidate: string): boolean {
  const root = safeRealpath(join(dirname(fileURLToPath(import.meta.url)), ".."));
  if (!pathInsideRoot(candidate, root)) return false;
  const rel = candidate === root ? "" : candidate.slice(root.length + 1);
  return rel === "skills" || rel.startsWith("skills/")
    || rel === "agents" || rel.startsWith("agents/")
    || rel === "config/prompts" || rel.startsWith("config/prompts/")
    || rel === "prompts" || rel.startsWith("prompts/")
    || rel === "themes" || rel.startsWith("themes/");
}

function piClipboardImageTempFile(candidate: string): boolean {
  const base = candidate.split(/[\\/]/).pop() ?? "";
  return /^pi-clipboard-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(?:png|jpg|jpeg|gif|webp|bmp|tiff|heic)$/i.test(base);
}

function piCodingAgentPackageRoot(): string | undefined {
  try {
    const resolver = (import.meta as ImportMeta & { resolve?: (specifier: string) => string }).resolve;
    if (!resolver) return undefined;
    const entry = fileURLToPath(resolver("@earendil-works/pi-coding-agent"));
    return safeRealpath(resolve(dirname(entry), ".."));
  } catch {
    return undefined;
  }
}

function piCodingAgentDocsPath(candidate: string): boolean {
  const root = piCodingAgentPackageRoot();
  if (!root || !pathInsideRoot(candidate, root)) return false;
  const rel = candidate === root ? "" : candidate.slice(root.length + 1);
  return rel === "docs" || rel.startsWith("docs/");
}

function userInstalledSkillPath(candidate: string): boolean {
  const home = process.env.HOME;
  if (!home) return false;
  const root = safeRealpath(join(home, ".agents", "skills"));
  if (!pathInsideRoot(candidate, root)) return false;
  const rel = candidate === root ? "" : candidate.slice(root.length + 1);
  const skillName = rel.split(/[\\/]/)[0];
  return Boolean(skillName && skillName !== "." && skillName !== ".." && !skillName.startsWith("."));
}

function workflowStateReadPath(candidate: string): boolean {
  const root = safeRealpath(getAgentDir());
  if (!pathInsideRoot(candidate, root)) return false;
  const rel = candidate === root ? "" : candidate.slice(root.length + 1);
  return rel === "workflows/active.json"
    || rel === "workflows/plans/latest.json"
    || rel === "workflows/missions/latest.json";
}

function repoLockPathBlock(pathValue: unknown, cwd: string, tool: string): string | undefined {
  const root = repoLockRoot(cwd);
  const candidate = resolveCandidatePath(typeof pathValue === "string" && pathValue.trim() ? pathValue.trim() : ".", cwd);
  if (!pathInsideRoot(candidate, root)) {
    if ((tool === "read" || tool === "grep" || tool === "find" || tool === "ls") && (piRuntimeInstructionPath(candidate) || packageInstructionPath(candidate) || piCodingAgentDocsPath(candidate) || userInstalledSkillPath(candidate) || workflowStateReadPath(candidate) || piClipboardImageTempFile(candidate))) return undefined;
    if (candidate.startsWith("/private/tmp/") || candidate.startsWith("/tmp/") || candidate.startsWith("/var/tmp/")) return undefined;
    return "Path outside repository";
  }
  if ((tool === "edit" || tool === "write") && protectedRepoPath(candidate, root)) return "Protected path — use settings to disable Repo Lock";
  return undefined;
}

function stripQuotedSlashes(command: string): string {
  return command
    .replace(/'([^']*)'/g, (_full, content: string) => {
      // If content starts with /regex/ or /regex/flags (awk/sed address pattern), mask slashes
      if (/^\/[^/]+\/(?:[gimp]*$|\s)/.test(content)) return "'" + content.replace(/\//g, " ") + "'";
      // If content starts with /, it's a quoted absolute path — preserve
      if (content.startsWith('/')) return _full;
      // Content contains / but is not a path — mask (sed expression, prose, etc.)
      if (content.includes('/')) return "'" + content.replace(/\//g, " ") + "'";
      return _full;
    })
    .replace(/"([^"]*)"/g, (_full, content: string) => {
      if (/^\/[^/]+\/(?:[gimp]*$|\s)/.test(content)) return '"' + content.replace(/\//g, " ") + '"';
      if (content.startsWith('/')) return _full;
      if (content.includes('/')) return '"' + content.replace(/\//g, " ") + '"';
      return _full;
    });
}

function stripHereDocBodies(command: string): string {
  const lines = command.split("\n");
  const kept: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    kept.push(line);
    const match = line.match(/<<[-]?\s*['\"]?([A-Za-z_][A-Za-z0-9_]*)['\"]?/);
    if (!match) continue;
    const marker = match[1];
    i++;
    while (i < lines.length && lines[i].trim() !== marker) i++;
  }
  return kept.join("\n");
}

function stripUriTokens(command: string): string {
  return command.replace(/\b[A-Za-z][A-Za-z0-9+.-]*:\/\/[^\s'"`;&|)]*/g, " ");
}

function bashPathCandidates(command: string): string[] {
  const trimmed = stripUriTokens(stripHereDocBodies(stripQuotedSlashes(command))).trim();
  if (!trimmed) return [];
  return Array.from(trimmed.matchAll(/(?:^|[\s=:'"`])((?:\.{1,2}|~|\/)[^\s'"`;&|)]*)/g)).map((match) => match[1]).filter(Boolean);
}

function hasShellControlOperator(command: string): boolean {
  let quote: "'" | '"' | undefined;
  for (let i = 0; i < command.length; i += 1) {
    const char = command[i];
    if (char === "\\") { i += 1; continue; }
    if (quote) {
      if (char === quote) quote = undefined;
      continue;
    }
    if (char === "'" || char === '"') { quote = char; continue; }
    if (char === ";" || char === "|" || char === "&" || char === "<" || char === ">" || char === "\n") return true;
  }
  return quote !== undefined;
}

function shellWords(command: string): string[] | undefined {
  const words: string[] = [];
  let current = "";
  let quote: "'" | '"' | undefined;
  for (let i = 0; i < command.length; i += 1) {
    const char = command[i];
    if (char === "\\") {
      i += 1;
      current += command[i] ?? "";
      continue;
    }
    if (quote) {
      if (char === quote) quote = undefined;
      else current += char;
      continue;
    }
    if (char === "'" || char === '"') { quote = char; continue; }
    if (/\s/.test(char)) {
      if (current) { words.push(current); current = ""; }
      continue;
    }
    current += char;
  }
  if (quote) return undefined;
  if (current) words.push(current);
  return words;
}

function simpleCpSourceOperands(command: string): Set<string> | undefined {
  if (hasShellControlOperator(command)) return undefined;
  const words = shellWords(command);
  if (!words || words.length < 3) return undefined;
  const commandName = words[0].split(/[\\/]/).pop();
  if (commandName !== "cp") return undefined;
  const operands: string[] = [];
  let endOfOptions = false;
  for (const word of words.slice(1)) {
    if (!endOfOptions && word === "--") { endOfOptions = true; continue; }
    if (!endOfOptions && word.startsWith("-")) continue;
    operands.push(word);
  }
  if (operands.length < 2) return undefined;
  return new Set(operands.slice(0, -1));
}

function simpleReadOnlyBashAllowed(command: string): boolean {
  if (hasShellControlOperator(command)) return false;
  const words = shellWords(command);
  if (!words?.length) return false;
  const commandName = words[0].split(/[\\/]/).pop();
  if (commandName === "cat" || commandName === "ls" || commandName === "grep" || commandName === "rg") return true;
  if (commandName !== "find") return false;
  return !words.some((word) => word === "-delete" || word === "-exec" || word === "-execdir" || word === "-ok" || word === "-okdir" || word === "-fprint" || word === "-fprintf");
}

function piCodingAgentDocsBashReadAllowed(command: string): boolean {
  return simpleReadOnlyBashAllowed(command);
}

function repoLockBashBlock(command: string, cwd: string): string | undefined {
  const root = repoLockRoot(cwd);
  const pathCandidates = bashPathCandidates(command);
  const cpSourceOperands = simpleCpSourceOperands(command);
  for (const raw of pathCandidates) {
    if (raw === "." || raw === "./" || raw === "/") continue;
    const cleaned = raw.replace(/[),]+$/, "");
    if (!cleaned || cleaned.startsWith("./node_modules/.bin")) continue;
    if (cleaned.startsWith("/dev/")) continue;
    if (cleaned.startsWith("/tmp/") || cleaned.startsWith("/private/tmp/") || cleaned.startsWith("/var/tmp/")) continue;
    const candidate = resolveCandidatePath(cleaned, cwd);
    if (!pathInsideRoot(candidate, root)) {
      if (piCodingAgentDocsPath(candidate) && piCodingAgentDocsBashReadAllowed(command)) continue;
      if (userInstalledSkillPath(candidate) && simpleReadOnlyBashAllowed(command)) continue;
      if (workflowStateReadPath(candidate) && simpleReadOnlyBashAllowed(command)) continue;
      if (piClipboardImageTempFile(candidate) && cpSourceOperands?.has(cleaned)) continue;
      return "Path outside repository";
    }
  }
  return undefined;
}

function repoLockEnabled(settings: ReturnType<typeof loadWorkflowSettings>): boolean {
  return settings.safety.repoLockEnabled === true;
}

const BLOCKED_EXECUTE_BASH: RegExp[] = [
  /\brm\s+-[^\n;|&]*r[^\n;|&]*f\b/i,
  /\bsudo\b/i,
  /\bchmod\s+-R\b/i,
  /\bchown\s+-R\b/i,
  /\bgit\s+reset\b/i,
  /\bgit\s+clean\b/i,
  /\bgit\s+push\b/i,
  /\bgit\s+checkout\b/i,
  /\bgit\s+switch\b/i,
  /\bnpm\s+install\b/i,
  /\bpnpm\s+add\b/i,
  /\byarn\s+add\b/i,
  /\bpip\s+install\b/i,
  /\bpip3?\s+install\b/i,
  /\bbundle\s+install\b/i,
  /\bgem\s+install\b/i,
  /\bcargo\s+install\b/i,
  /\bgo\s+(?:get|install)\b/i,
  /\bdeno\s+(?:install|add|cache)\b/i,
  /\bcomposer\s+(?:install|require|update)\b/i,
  /\bmix\s+(?:deps\.get|deps\.compile)\b/i,
  /\bbrew\s+install\b/i,
  /\bapt\s+(?:install|get\s+install)\b/i,
  /\byum\s+install\b/i,
  /\bdnf\s+install\b/i,
  /\bapk\s+add\b/i,
  /\bnuget\s+install\b/i,
  /\bdotnet\s+(?:add\s+package|tool\s+install|restore)\b/i,
  /\bcabal\s+(?:install|update)\b/i,
  /\bstack\s+(?:install|update)\b/i,
  /\bconan\s+install\b/i,
  /\bvcpkg\s+install\b/i,
  /\bcoursier\s+(?:install|fetch)\b/i,
  /\bcurl\b[^\n]*\|\s*sh\b/i,
  /\bwget\b[^\n]*\|\s*sh\b/i,
  /\bvercel\s+deploy\b/i,
  /\bdeploy\b/i,
  /\bsupabase\s+db\s+push\b/i,
  /\bsupabase\s+migration\s+up\b/i,
  /\bmigration\b[^\n]*(run|up|execute)/i,
];

export function isBlockedExecuteCommand(command: string): boolean {
  return BLOCKED_EXECUTE_BASH.some((pattern) => pattern.test(command));
}

function isPlanMode(mode: WorkflowState["mode"]): boolean {
  return mode === "awaiting_plan_input" || mode === "awaiting_clarification" || mode === "planning" || mode === "plan_draft" || mode === "plan_approved";
}

function isReviewMode(mode: WorkflowState["mode"]): boolean {
  return mode === "reviewing" || mode === "reviewed";
}

function missionReviewActive(state: WorkflowState): boolean {
  if (state.mode !== "mission_plan_ready") return false;
  const mission = state.activeMissionId ? loadMissionState(state.activeMissionId) : loadMissionState();
  return mission?.currentStep === "reviewer" && mission.reviewRepairInProgress !== true && mission.lastReviewRepairStatus !== "running";
}

function missionReviewAlreadyAccepted(state: WorkflowState): boolean {
  if (state.mode !== "mission_plan_ready" || state.lastWorkflowHandoff?.type !== WORKFLOW_REVIEW_RESULT_TOOL) return false;
  const mission = state.activeMissionId ? loadMissionState(state.activeMissionId) : loadMissionState();
  return mission?.currentStep !== "reviewer" && (mission?.reviewerVerdict === "PASS" || mission?.reviewerVerdict === "NOTES");
}

function initialPlanHandoffAlreadyAccepted(state: WorkflowState): boolean {
  return state.mode === "plan_draft"
    && state.reviewHandoffSuppression?.kind === "plan_typed_initial_to_approval"
    && state.lastWorkflowHandoff?.type === WORKFLOW_PLAN_RESULT_TOOL;
}

function reviewPhaseSubagentCall(input: unknown): boolean {
  if (!input || typeof input !== "object") return false;
  const workflowPhase = String((input as { workflowPhase?: unknown }).workflowPhase ?? "").toLowerCase();
  return workflowPhase === "review";
}

function isValidatorMode(mode: WorkflowState["mode"]): boolean {
  return mode === "validating" || mode === "revalidating" || mode === "mission_validating" || mode === "mission_revalidating" || mode === "mission_final_validating";
}

function isValidationResultMode(mode: WorkflowState["mode"]): boolean {
  return mode === "validating" || mode === "revalidating" || mode === "mission_validating" || mode === "mission_revalidating" || mode === "mission_final_validating";
}

function isExecutionMode(mode: WorkflowState["mode"]): boolean {
  return mode === "executing" || mode === "repairing" || mode === "mission_running" || mode === "mission_repairing";
}

function workflowHandoffTool(tool: string): boolean {
  return tool === WORKFLOW_PLAN_RESULT_TOOL
    || tool === WORKFLOW_REVIEW_RESULT_TOOL
    || tool === WORKFLOW_EXECUTION_RESULT_TOOL
    || tool === WORKFLOW_VALIDATION_RESULT_TOOL
    || tool === WORKFLOW_REPAIR_RESULT_TOOL
    || tool === MISSION_PLAN_RESULT_TOOL
    || tool === MISSION_MILESTONE_RESULT_TOOL
    || tool === STANDARD_HANDOFF_RESULT_TOOL;
}

const WORKFLOW_COMMAND_LOCK_MAX_AGE_MS = 10 * 60 * 1000;

function workflowCommandLockActive(lock: WorkflowState["workflowCommandLock"]): lock is NonNullable<WorkflowState["workflowCommandLock"]> {
  if (!lock) return false;
  const startedAt = Date.parse(lock.startedAt);
  return Number.isFinite(startedAt) && Date.now() - startedAt <= WORKFLOW_COMMAND_LOCK_MAX_AGE_MS;
}

function isSubagentWorker(): boolean {
  return process.env.PI_SUBAGENT_WORKER === "1";
}

const PACKAGE_INSTALL_RE = /\b(?:npm\s+install|pnpm\s+add|yarn\s+add|pip3?\s+install|bundle\s+install|gem\s+install|cargo\s+install|go\s+(?:get|install)|deno\s+(?:install|add|cache)|composer\s+(?:install|require|update)|mix\s+deps\.(?:get|compile)|brew\s+install|apt(?:-get)?\s+install|yum\s+install|dnf\s+install|apk\s+add|nuget\s+install|dotnet\s+(?:add\s+package|tool\s+install|restore)|cabal\s+(?:install|update)|stack\s+(?:install|update)|conan\s+install|vcpkg\s+install|coursier\s+(?:install|fetch))\b/i;

function isPackageInstallCommand(command: string): boolean {
  return PACKAGE_INSTALL_RE.test(command);
}

function commandBlocked(command: string, cwd?: string): boolean {
  const settings = loadWorkflowSettings(cwd);
  if (settings.safety.blockDestructiveCommands === false) return false;
  if (isPackageInstallCommand(command) && settings.safety.allowPackageInstallInExecution !== false) return false;
  return isBlockedExecuteCommand(command);
}

function standardTodoMode(settings: ReturnType<typeof loadWorkflowSettings>): "off" | "manual" | "auto" | "required" {
  return settings.standard.autoTodoEnabled === false || settings.standard.todoTriggerMode === "off"
    ? "off"
    : settings.standard.todoTriggerMode === "manual"
      ? "manual"
      : settings.standard.todoTriggerMode === "required"
        ? "required"
        : "auto";
}

function standardTaskLooksSubstantive(task: string | undefined): boolean {
  const text = task?.trim() ?? "";
  if (!text || text.startsWith("/")) return false;
  if (/^(?:hi|hello|hey|thanks|thank you|ok|okay|yes|no|status|help)$/i.test(text)) return false;
  return text.length >= 8 || text.split(/\s+/).filter(Boolean).length >= 2;
}

function stripTimeoutPrefix(command: string): string {
  return command.replace(/^timeout\s+\d+[smhd]?\s+/, "").trim() || command;
}

const DESTRUCTIVE_WORD_RE = /\b(?:install|add|update|upgrade|publish|deploy|push|checkout|switch|commit|merge|rebase|stash|tag|apply|am|restore|sed\s+-i|perl\s+-pi|chmod|chown|curl\s.*\|\s*(?:sh|bash)|wget\s.*\|\s*(?:sh|bash))\b/i;

const SAFE_READ_ONLY_COMMANDS_RE = /^(?:git\s+(?:status|log|diff|show|branch|rev-parse|ls-files|describe|remote|tag|shortlog|count-objects|blame|name-rev)\b|cat\b|head\b|tail\b|less\b|more\b|wc\b|file\b|stat\b|which\b|where\b|command\s+-v\b|type\b|echo\b|printf\b|printenv\b|env\b|uname\b|date\b|id\b|whoami\b|hostname\b|pwd\b|ls\b|du\b|df\b|diff\b|comm\b|sort\b|uniq\b|cut\b|tr\b|awk\b|jq\b|yq\b|xq\b|(?:npm|pnpm|yarn|bun)\s+(?:run\s+)?(?:build|test|lint|typecheck|type-check|check[\s:]?\w*|dev|start|preview|serve|watch|format|analyze|compile|ci|validate|verify|coverage|bench|benchmark|bundle|pack|dist|static|docs|doc|stylelint|e2e|integration|unit)\b|(?:npm|pnpm|yarn|bun)\s+(?:exec|info|ls|list|query|outdated|why|view|pack\s+--dry-run)\b|npx\s+(?:serve|http-server|lite-server|tsc|vite|eslint|prettier|vitest|jest|mocha|cypress|playwright|webpack|rollup|parcel|turbo|nx|ts-node|tsx|esbuild|swc|babel|stylelint|biome|rome|knip|typedoc|compodoc|angular-cli|react-scripts|next|nuxt|remix|astro|svelte-kit)\b|pnpm\s+(?:exec|dlx)\s+\w+\b|bun\s+(?:test|check|build|run)\b|deno\s+(?:check|test|build|lint|task|info|doc|compile|fmt|eval|cache)\b|cargo\s+(?:build|test|check|clippy|doc|bench|run|metadata|locate-project|tree|version)\b|(?:rustc|rustup)\s+(?:--version|--print|which)\b|go\s+(?:build|test|vet|run|doc|list|mod\s+(?:verify|tidy|graph|download|why))\b|python3?\s+(?:--version|-V|-c\b|-m\s+(?:pytest|unittest|mypy|pylint|flake8|black|isort|ruff|json\.tool|compileall|bandit|pyright|http\.server|html\.parser|html))\b|pip3?\s+(?:list|show|check|debug|index\s+versions)\b|tsc\b|node\s+(?:--version|-v|--check|-c|-e|--eval)\b|make\s+(?:build|test|check|lint|all|verify|docs|format|static|analyze)\b|cmake\s+(?:--build|--version)\b|(?:dotnet|msbuild)\s+(?:build|test|restore|check|format|lint|pack)\b|(?:gradle|\.\/gradlew|gradlew\.bat)\s+(?:build|test|check|compile|lint|dependencies|projects|tasks)\b|mvn\s+(?:compile|test|verify|checkstyle|pmd|versions:display|dependency:tree|dependency:list)\b|(?:swift|swiftc)\s+(?:build|test|package\s+(?:describe|dump-package))\b|(?:bundle|gem)\s+(?:exec|list|check|info|query)\b|rake\s+(?:test|spec|lint|check|notes|stats|about)\b|php\s+(?:--version|-v|-l)\b|(?:php\s+)?artisan\s+(?:--version|route:list|config:show|env)\b|composer\s+(?:validate|check|show|outdated|info|diagnose)\b|mix\s+(?:test|compile|lint|format|docs)\b|bazel\s+(?:build|test|query|cquery|info|version)\b|buck\s+(?:build|test|query|audit)\b|curl\s+(?:-[^\s]*[sSfIv][^\s]*\s+)+(?:https?:\/\/|localhost|\$)|kill\s+\$!\b|kill\s+-0\s+\$\w+\b|wait\s+\$!\b|wait\s+\$\w+\b|sleep\s+[0-9.]+[smhd]?\b|ps\s+(?:aux?|-[a-z]*[eE][a-z]*|-[a-z]*[pP][a-z]*)\b|pgrep\s+-\w+\s+\w+|true\b|false\b|\.\s*\/node_modules\/\.bin\/\S+\b)/i;

export function standardSafeReadOnlyBash(command: string): boolean {
  const trimmed = command.trim();
  if (!trimmed || isBlockedExecuteCommand(trimmed)) return false;
  const cmd = stripTimeoutPrefix(trimmed);
  return SAFE_READ_ONLY_COMMANDS_RE.test(cmd);
}

function stripSafePreamble(command: string): string {
  return command.replace(/^(?:set\s+[-+][euxo]+(?:\s+[^\n]*)?|export\s+\w+=["']?[^\n"']*["']?|\w+=\S+)\s*\n+/gm, "").trim() || command;
}

function stripBenignValidationRedirections(command: string): string {
  return command
    .replace(/\s+\d?>&\d\b/g, "")
    .replace(/\s+\d?>\s*(?:\/tmp|\/private\/tmp|\/dev\/null)\/?\S*/g, "")
    .replace(/\s+\d?>>\s*(?:\/tmp|\/private\/tmp|\/dev\/null)\/?\S*/g, "")
    .replace(/\s+&\s*$/g, "")
    .trim();
}

function validationWriteVectorBlocked(command: string): boolean {
  if (/<<[-~]?\s*['"]?\w+/i.test(command)) return true;
  if (/(?:\btee\b|\bsed\s+-i\b|\bperl\s+-pi\b|\bcat\s*>)/i.test(command)) return true;
  if (/(?:^|\s)(?:>|>>)\s*(?!\/tmp\/|\/private\/tmp\/|\/dev\/null\b|&\d\b)\S+/i.test(command)) return true;
  if (/\b(?:python3?|node|perl|ruby|bash|sh)\s+(?:\/tmp|\/private\/tmp)\/\S+/i.test(command)) return true;
  if (/\bpython3?\s+-c\b[\s\S]*(?:open\s*\([^)]*,\s*['"][wa+]|write\s*\()/i.test(command)) return true;
  if (/\bnode\s+(?:-e|--eval)\b[\s\S]*(?:writeFile|appendFile|rmSync|mkdirSync|renameSync|copyFileSync)/i.test(command)) return true;
  if (/\bperl\s+-e\b[\s\S]*(?:open\s*\([^)]*[>]|print\s+\w+\s+)/i.test(command)) return true;
  if (/\bruby\s+-e\b[\s\S]*(?:File\.(?:write|open|delete|rename)|IO\.write)/i.test(command)) return true;
  return false;
}

function validatorSafeReadOnlySegment(segment: string): boolean {
  const cleaned = stripBenignValidationRedirections(stripTimeoutPrefix(segment.trim()));
  return Boolean(cleaned) && standardSafeReadOnlyBash(cleaned);
}

function validatorSafeReadOnlyPipeline(command: string): boolean {
  const parts = command.split("|").map((part) => part.trim()).filter(Boolean);
  return parts.length > 1 && parts.every(validatorSafeReadOnlySegment);
}

function validatorSafeDevServerComposite(command: string): boolean {
  const lines = command.split(/\n+/).map((line) => line.trim()).filter(Boolean);
  if (lines.length < 2) return false;
  const first = lines[0];
  const serverStart = /^(?:(?:npm|pnpm|yarn|bun)\s+(?:run\s+)?(?:dev|start|preview|serve)\b|npx\s+(?:vite|next|serve|http-server|lite-server)\b|python3?\s+-m\s+http\.server\b)/i.test(first);
  const safeOutput = /\s(?:>|>>)\s*(?:\/tmp\/|\/private\/tmp\/|\/dev\/null\b)/.test(first) || /(?:^|\s)&\s*$/.test(first);
  if (!serverStart || !safeOutput || !/(?:^|\s)&\s*$/.test(first)) return false;
  return lines.slice(1).every((line) => line.split("&&").map((part) => part.trim()).filter(Boolean).every(validatorSafeReadOnlySegment));
}

function validatorSafeEvidenceBash(command: string): boolean {
  const trimmed = command.trim();
  if (!trimmed) return false;
  const cmd = stripSafePreamble(stripTimeoutPrefix(trimmed));
  if (isBlockedExecuteCommand(cmd)) return false;
  if (DESTRUCTIVE_WORD_RE.test(cmd)) return false;
  if (validationWriteVectorBlocked(cmd)) return false;
  if (standardSafeReadOnlyBash(stripBenignValidationRedirections(cmd))) return true;
  if (validatorSafeReadOnlyPipeline(cmd)) return true;
  if (validatorSafeDevServerComposite(cmd)) return true;
  return false;
}

function standardTodoTitleLooksGeneric(title: string): boolean {
  const text = title.trim().toLowerCase();
  if (!text) return true;
  return /^(?:understand|analy[sz]e|clarify|assess|inspect)\s+(?:the\s+)?(?:request|task|requirements?|assumptions?|context)$/.test(text)
    || /^summari[sz]e\s+(?:the\s+)?(?:outcome|result|work)(?:\s+and\s+(?:the\s+)?(?:next\s+)?actions?)?$/.test(text)
    || /^(?:finish|complete|finali[sz]e)$/.test(text);
}

function standardTodoLooksGeneric(todo: WorkflowState["standardTodo"]): boolean {
  if (!todo?.items.length) return false;
  return todo.items.length <= 3 && todo.items.every((item) => standardTodoTitleLooksGeneric(item.title));
}

function standardRequiredTodoMissing(state: WorkflowState, settings: ReturnType<typeof loadWorkflowSettings>): boolean {
  const task = state.task ?? state.originalTask;
  return standardTodoMode(settings) === "required"
    && (!state.standardTodo?.items.length || standardTodoLooksGeneric(state.standardTodo))
    && !state.standardClarificationPending
    && state.standardClarificationStage !== "drafting"
    && state.standardClarificationStage !== "awaiting_answer"
    && standardTaskLooksSubstantive(task);
}

function planProgressRelevantWorkTool(tool: string, input: unknown): boolean {
  if (tool === "read" || tool === "grep" || tool === "find" || tool === "ls" || tool === "edit" || tool === "write" || tool === "subagent") return true;
  if (tool !== "bash") return false;
  const command = String((input as { command?: unknown } | undefined)?.command ?? "");
  return Boolean(command.trim()) && !standardSafeReadOnlyBash(command);
}

function currentPlanProgressStepNumber(state: WorkflowState): number | undefined {
  const steps = state.planProgress?.steps ?? [];
  if (!steps.length) return undefined;
  if (steps.every((step) => step.status === "completed" || step.status === "skipped")) return undefined;
  const activeIndex = steps.findIndex((step) => step.status === "active");
  const fallbackIndex = Math.max(0, Math.min(steps.length - 1, Math.floor(state.planProgress?.currentStepIndex ?? 0)));
  return (activeIndex >= 0 ? activeIndex : fallbackIndex) + 1;
}

function planProgressToolRequiredBlock(state: WorkflowState, tool: string, input: unknown): string | undefined {
  if (!planProgressRelevantWorkTool(tool, input)) return undefined;
  const stalePlanExecutionWait =
    (state.mode === "reviewed" || state.mode === "plan_approved" || state.mode === "validated")
    && Boolean(state.approvedPlan)
    && Boolean(state.planProgress?.steps?.length)
    && state.planProgress?.lifecycleStatus !== "completed";
  if (stalePlanExecutionWait) {
    const stepNumber = currentPlanProgressStepNumber(state);
    if (!stepNumber) return `Plan ${tool} is blocked while the approved Plan is in ${state.mode} with lifecycleStatus=${state.planProgress?.lifecycleStatus ?? "unknown"}. Use the appropriate Plan command to arm a fresh workflow phase before running work tools.`;
    return `Plan execution ${tool} is blocked until the workflow re-enters execution and workflow_progress({ step: ${stepNumber}, status: "active" }) is called for the current approved Plan step. Run /plan continue to arm a fresh executor turn.`;
  }
  const stepNumber = currentPlanProgressStepNumber(state);
  if (!stepNumber) return undefined;
  if (state.mode !== "executing" && state.mode !== "repairing") return undefined;
  // Only the explicit workflow_progress tool call can satisfy this gate.
  // Display/fallback active steps are widget state, not execution proof.
  if (state.planProgressLastToolStatus === "active" && state.planProgressLastToolStep === stepNumber) return undefined;
  return `Plan execution ${tool} is blocked until workflow_progress({ step: ${stepNumber}, status: "active" }) is called for the current approved Plan step.`;
}

export function registerToolGuard(pi: ExtensionAPI, getState: () => WorkflowState): void {
  pi.on("tool_call", async (event, ctx) => {
    const state = getState();
    const tool = event.toolName;
    const settings = loadWorkflowSettings(ctx.cwd);

    const effectiveRepoLockEnabled = repoLockEnabled(settings) || process.env.PI_WORKFLOW_REPO_LOCK_ENABLED === "1";
    if (effectiveRepoLockEnabled) {
      if (PATH_SCOPED_TOOLS.has(tool)) {
        const input = event.input as { path?: unknown; file_path?: unknown };
        const reason = repoLockPathBlock(input.path ?? input.file_path, ctx.cwd, tool);
        if (reason) return { block: true, reason };
      }
      if (tool === "bash") {
        const command = String((event.input as { command?: unknown }).command ?? "");
        const reason = repoLockBashBlock(command, ctx.cwd);
        if (reason) return { block: true, reason };
      }
      if (tool === "subagent") {
        const reason = repoLockPathBlock(".", ctx.cwd, tool);
        if (reason) return { block: true, reason };
      }
    }

    if (isSubagentWorker()) {
      const workerPhase = String(process.env.PI_WORKFLOW_SUBAGENT_PHASE ?? "").toLowerCase();
      const workerReadOnlyPhase = workerPhase === "validation" || workerPhase === "review";
      if (workerReadOnlyPhase && (tool === "edit" || tool === "write")) {
        return { block: true, reason: `${tool} blocked — ${workerPhase} sub-agent workers are read-only` };
      }
      if (tool === "bash") {
        const command = String((event.input as { command?: unknown }).command ?? "");
        if (workerReadOnlyPhase && !validatorSafeEvidenceBash(command)) return { block: true, reason: `Bash blocked — unsafe command in ${workerPhase} sub-agent worker` };
        if (commandBlocked(command, ctx.cwd)) return { block: true, reason: "Destructive command blocked" };
      }
      return;
    }

    if (tool === STANDARD_HANDOFF_RESULT_TOOL && state.mode !== "standard") return { block: true, reason: "Standard handoff unavailable outside Standard Mode" };

    const commandLock = state.workflowCommandLock;
    if (workflowCommandLockActive(commandLock) && workflowHandoffTool(tool)) {
      return { block: true, reason: `Workflow handoff blocked while /${commandLock.family} ${commandLock.action} is collecting user input. Submit the requested input or cancel before handing off.` };
    }

    if (tool === WORKFLOW_PLAN_RESULT_TOOL && state.mode !== "planning" && state.mode !== "executing" && state.mode !== "repairing") return { block: true, reason: `${tool} unavailable outside planning phase` };
    if (tool === MISSION_PLAN_RESULT_TOOL && state.mode !== "mission_planning") return { block: true, reason: "mission_plan_result is only for mission planning. Use mission_milestone_result to submit milestone execution checkpoints." };
    const staleAcceptedPlanReviewResult = tool === WORKFLOW_REVIEW_RESULT_TOOL
      && state.mode !== "reviewing"
      && !missionReviewActive(state)
      && (
        state.reviewHandoffSuppression?.kind === "plan_typed_review_to_execution"
        || (state.lastWorkflowHandoff?.type === WORKFLOW_REVIEW_RESULT_TOOL && (state.mode === "reviewed" || state.reviewRepairInProgress === true || state.lastReviewRepairStatus === "running"))
      );
    const staleAcceptedMissionReviewResult = tool === WORKFLOW_REVIEW_RESULT_TOOL && missionReviewAlreadyAccepted(state);
    if (tool === WORKFLOW_REVIEW_RESULT_TOOL && !staleAcceptedPlanReviewResult && !staleAcceptedMissionReviewResult && state.mode !== "reviewing" && !missionReviewActive(state)) return { block: true, reason: "Review handoff unavailable outside review phase" };
    if (tool === WORKFLOW_EXECUTION_RESULT_TOOL && state.mode !== "executing") return { block: true, reason: "Execution handoff unavailable outside execution phase" };
    if (tool === MISSION_MILESTONE_RESULT_TOOL && state.mode !== "mission_running") return { block: true, reason: "Milestone handoff unavailable outside Mission execution" };
    if (tool === WORKFLOW_VALIDATION_RESULT_TOOL && !isValidationResultMode(state.mode)) return { block: true, reason: "Validation handoff unavailable outside validation phase" };
    if (tool === WORKFLOW_REPAIR_RESULT_TOOL && state.mode !== "repairing" && state.mode !== "mission_repairing") return { block: true, reason: "Repair handoff unavailable outside repair phase" };

    if (tool === WORKFLOW_PROGRESS_TOOL && state.mode !== "executing" && state.mode !== "repairing") return { block: true, reason: "Progress tracking unavailable outside Plan execution" };

    if (initialPlanHandoffAlreadyAccepted(state) && planProgressRelevantWorkTool(tool, event.input)) {
      return { block: true, reason: "Plan already accepted; execution must start from the queued executor or approval path." };
    }

    if (tool === "subagent" && state.reviewHandoffSuppression?.kind === "plan_typed_review_to_execution" && reviewPhaseSubagentCall(event.input)) {
      return { block: true, reason: "Plan review already accepted; stale Review-phase sub-agent call ignored. Execution has started." };
    }
    if (tool === "subagent" && state.mode === "reviewed" && state.lastWorkflowHandoff?.type === WORKFLOW_REVIEW_RESULT_TOOL) {
      return { block: true, reason: "Plan review already accepted; stale review sub-agent call ignored. Execution remains queued." };
    }
    if (tool === "subagent" && state.reviewRepairInProgress === true && state.lastWorkflowHandoff?.type === WORKFLOW_REVIEW_RESULT_TOOL) {
      return { block: true, reason: "Plan review handoff is already accepted; do not launch more review sub-agents. Workflow Suite will continue from the accepted review state." };
    }
    if (tool === "subagent" && missionReviewAlreadyAccepted(state)) {
      return { block: true, reason: "Mission review already accepted; stale review sub-agent call ignored. Mission approval remains queued." };
    }
    if (tool === "subagent" && state.mode === "mission_plan_ready" && !missionReviewActive(state)) {
      return { block: true, reason: "Mission review is not active; start the reviewer with /mission review or the Mission review menu before launching review sub-agents." };
    }

    if (tool === "standard_todo") {
      if (state.mode !== "standard") return { block: true, reason: "To Do unavailable outside Standard Mode" };
    }

    if (state.mode === "standard" && tool !== "standard_todo" && standardRequiredTodoMissing(state, settings)) {
      if (tool === "edit" || tool === "write") return { block: true, reason: `${tool} blocked — To Do required` };
      if (tool === "bash") {
        const command = String((event.input as { command?: unknown }).command ?? "");
        if (!standardSafeReadOnlyBash(command)) return { block: true, reason: "Bash blocked — To Do required" };
      }
    }

    if (state.mode === "standard" && state.standardClarificationPending) {
      if (tool === "edit" || tool === "write")
        return { block: true, reason: `${tool} blocked — Standard Mode clarification is pending. Answer the clarification questions first.` };
      if (tool === "bash") {
        const command = String((event.input as { command?: unknown }).command ?? "");
        if (!standardSafeReadOnlyBash(command))
          return { block: true, reason: "Bash blocked — Standard Mode clarification is pending. Answer the clarification questions first." };
      }
    }

    const planProgressBlock = planProgressToolRequiredBlock(state, tool, event.input);
    if (planProgressBlock) return { block: true, reason: planProgressBlock };

    if (isPlanMode(state.mode)) {
      if (state.mode === "plan_approved" && state.approvedPlan) return;
      if (tool === "edit" || tool === "write") return { block: true, reason: `${tool} not available in Plan mode` };
      if (tool === "bash" && settings.safety.disableBashInPlanMode !== false) return { block: true, reason: "Bash not available in Plan mode" };
    }

    if (isReviewMode(state.mode)) {
      if (tool === "edit" || tool === "write") return { block: true, reason: `${tool} not available in review mode` };
      if (tool === "bash") return { block: true, reason: "Bash not available in review mode" };
    }

    if (state.mode === "mission_plan_ready") {
      if (tool === "edit" || tool === "write") return { block: true, reason: `${tool} not available during mission plan review` };
      if (tool === "bash") return { block: true, reason: "Bash not available during mission plan review" };
    }

    if (isValidatorMode(state.mode)) {
      if (tool === "edit" || tool === "write") return { block: true, reason: `${tool} not available in validation mode` };
      if (tool === "bash" && settings.safety.disableBashInValidatorMode !== false) {
        const command = String((event.input as { command?: unknown }).command ?? "");
        if (!validatorSafeEvidenceBash(command)) return { block: true, reason: "Bash blocked — unsafe command in validation mode" };
      }
    }

    if ((isExecutionMode(state.mode) || isPlanMode(state.mode) || isValidatorMode(state.mode) || isReviewMode(state.mode)) && tool === "bash") {
      const command = String((event.input as { command?: unknown }).command ?? "");
      if (commandBlocked(command, ctx.cwd)) return { block: true, reason: "Destructive or out-of-scope command blocked" };
    }
  });

  pi.on("user_bash", (event, ctx) => {
    const state = getState();
    const settings = loadWorkflowSettings(ctx.cwd);

    if (isSubagentWorker()) {
      const workerPhase = String(process.env.PI_WORKFLOW_SUBAGENT_PHASE ?? "").toLowerCase();
      if ((workerPhase === "validation" || workerPhase === "review") && !validatorSafeEvidenceBash(event.command)) {
        return { result: { output: `Workflow ${workerPhase} sub-agent blocks unsafe user bash: ${event.command}`, exitCode: 1, cancelled: false, truncated: false } };
      }
      if (commandBlocked(event.command, ctx.cwd)) return { result: { output: "Destructive command blocked", exitCode: 1, cancelled: false, truncated: false } };
      return;
    }

    if (repoLockEnabled(settings) || process.env.PI_WORKFLOW_REPO_LOCK_ENABLED === "1") {
      const reason = repoLockBashBlock(event.command, ctx.cwd);
      if (reason) return { result: { output: reason, exitCode: 1, cancelled: false, truncated: false } };
    }

    if (isPlanMode(state.mode) && settings.safety.disableBashInPlanMode !== false) {
      return { result: { output: `Workflow ${state.mode} blocks user bash: ${event.command}`, exitCode: 1, cancelled: false, truncated: false } };
    }
    if (isReviewMode(state.mode)) {
      return { result: { output: `Workflow ${state.mode} blocks user bash during read-only review: ${event.command}`, exitCode: 1, cancelled: false, truncated: false } };
    }
    if (state.mode === "mission_plan_ready") {
      return { result: { output: `Workflow ${state.mode} blocks user bash during mission plan review: ${event.command}`, exitCode: 1, cancelled: false, truncated: false } };
    }
    if (isValidatorMode(state.mode) && !validatorSafeEvidenceBash(event.command)) {
      return { result: { output: `Workflow ${state.mode} blocks unsafe user bash: ${event.command}`, exitCode: 1, cancelled: false, truncated: false } };
    }
    if ((isExecutionMode(state.mode) || isPlanMode(state.mode) || isValidatorMode(state.mode) || isReviewMode(state.mode)) && commandBlocked(event.command, ctx.cwd)) {
      return { result: { output: "Destructive command blocked", exitCode: 1, cancelled: false, truncated: false } };
    }
  });
}

// No-op default export so this helper module can be safely auto-discovered as a Pi extension.
export default function workflowSuiteNoopExtension(): void {}
