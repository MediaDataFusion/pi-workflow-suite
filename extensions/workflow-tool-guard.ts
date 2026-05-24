import { existsSync, realpathSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { isAbsolute, resolve } from "node:path";
import { getAgentDir, type ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { loadWorkflowSettings } from "./workflow-model-router.js";
import type { WorkflowState } from "./workflow-state.js";

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
export const BASE_EXECUTE_TOOLS = ["read", "grep", "find", "ls", "edit", "write", "bash", WORKFLOW_PROGRESS_TOOL, WORKFLOW_DIAGRAM_TOOL];
export const EXECUTE_TOOLS = [...BASE_EXECUTE_TOOLS, ...EXECUTION_RESULT_TOOLS, ...REPAIR_RESULT_TOOLS];
export const VALIDATOR_TOOLS = ["read", "grep", "find", "ls", "bash", WORKFLOW_DIAGRAM_TOOL, ...REVIEW_RESULT_TOOLS, ...VALIDATION_RESULT_TOOLS];


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

function repoLockPathBlock(pathValue: unknown, cwd: string, tool: string): string | undefined {
  const root = repoLockRoot(cwd);
  const candidate = resolveCandidatePath(typeof pathValue === "string" && pathValue.trim() ? pathValue.trim() : ".", cwd);
  if (!pathInsideRoot(candidate, root)) {
    if ((tool === "read" || tool === "grep" || tool === "find" || tool === "ls") && piRuntimeInstructionPath(candidate)) return undefined;
    return `Repo Lock blocked path outside current repository: ${candidate} (repo root: ${root})`;
  }
  if ((tool === "edit" || tool === "write") && protectedRepoPath(candidate, root)) return `Repo Lock blocked ${tool} for protected project control path: ${candidate}`;
  return undefined;
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
  const trimmed = stripUriTokens(stripHereDocBodies(command)).trim();
  if (!trimmed) return [];
  return Array.from(trimmed.matchAll(/(?:^|[\s=:'"`])((?:\.{1,2}|~|\/)[^\s'"`;&|)]*)/g)).map((match) => match[1]).filter(Boolean);
}

function repoLockBashBlock(command: string, cwd: string): string | undefined {
  const root = repoLockRoot(cwd);
  const pathCandidates = bashPathCandidates(command);
  for (const raw of pathCandidates) {
    if (raw === "." || raw === "./" || raw === "/") continue;
    const cleaned = raw.replace(/[),]+$/, "");
    if (!cleaned || cleaned.startsWith("./node_modules/.bin")) continue;
    const candidate = resolveCandidatePath(cleaned, cwd);
    if (!pathInsideRoot(candidate, root)) return `Repo Lock blocked bash path outside current repository: ${cleaned} -> ${candidate} (repo root: ${root})`;
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

function isValidatorMode(mode: WorkflowState["mode"]): boolean {
  return mode === "reviewing" || mode === "reviewed" || mode === "validating" || mode === "revalidating" || mode === "validated" || mode === "mission_validating" || mode === "mission_revalidating" || mode === "mission_final_validating";
}

function isValidationResultMode(mode: WorkflowState["mode"]): boolean {
  return mode === "validating" || mode === "revalidating" || mode === "mission_validating" || mode === "mission_revalidating" || mode === "mission_final_validating";
}

function isExecutionMode(mode: WorkflowState["mode"]): boolean {
  return mode === "executing" || mode === "repairing" || mode === "mission_running" || mode === "mission_repairing";
}

function isSubagentWorker(): boolean {
  return process.env.PI_SUBAGENT_WORKER === "1";
}

function commandBlocked(command: string, cwd?: string): boolean {
  const settings = loadWorkflowSettings(cwd);
  return settings.safety.blockDestructiveCommands !== false && isBlockedExecuteCommand(command);
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

function standardSafeReadOnlyBash(command: string): boolean {
  const trimmed = command.trim();
  if (!trimmed || isBlockedExecuteCommand(trimmed)) return false;
  return /^(?:git\s+(?:status|log|diff|show|branch|rev-parse)\b|python3?\s+-m\s+json\.tool\b|npm\s+run\s+(?:lint|test)\b|npx\s+tsc\s+--noEmit\b|tsc\s+--noEmit\b)/i.test(trimmed);
}

function validatorSafeEvidenceBash(command: string): boolean {
  const trimmed = command.trim();
  if (!trimmed || isBlockedExecuteCommand(trimmed)) return false;
  if (/\b(?:install|add|update|upgrade|publish|deploy|push|reset|clean|checkout|switch|commit|merge|rebase|stash|tag|apply|am|restore|rm|mv|cp|mkdir|touch|sed\s+-i|perl\s+-pi|tee|chmod|chown|kill|open)\b/i.test(trimmed)) return false;
  return /^(?:git\s+(?:status|log|diff|show|branch|rev-parse|ls-files)\b|npm\s+run\s+(?:typecheck|check:ts|lint|test|build)\b|npx\s+tsc\s+--noEmit\b|tsc\s+--noEmit\b|python3?\s+-m\s+json\.tool\b)/i.test(trimmed);
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
      if (tool === "bash") {
        const command = String((event.input as { command?: unknown }).command ?? "");
        if (commandBlocked(command, ctx.cwd)) return { block: true, reason: `Workflow safety blocked destructive sub-agent bash command: ${command}` };
      }
      return;
    }

    if (tool === STANDARD_HANDOFF_RESULT_TOOL && state.mode !== "standard") return { block: true, reason: "Standard handoff result is only available while Standard Mode is active." };

    if ((tool === WORKFLOW_PLAN_RESULT_TOOL && state.mode !== "planning") || (tool === MISSION_PLAN_RESULT_TOOL && state.mode !== "mission_planning")) return { block: true, reason: `${tool} is only available during its planning phase.` };
    if (tool === WORKFLOW_REVIEW_RESULT_TOOL && state.mode !== "reviewing" && state.mode !== "mission_plan_ready") return { block: true, reason: "workflow_review_result is only available during review phases." };
    if (tool === WORKFLOW_EXECUTION_RESULT_TOOL && state.mode !== "executing") return { block: true, reason: "workflow_execution_result is only available during Plan execution." };
    if (tool === MISSION_MILESTONE_RESULT_TOOL && state.mode !== "mission_running") return { block: true, reason: "mission_milestone_result is only available during Mission execution." };
    if (tool === WORKFLOW_VALIDATION_RESULT_TOOL && !isValidationResultMode(state.mode)) return { block: true, reason: "workflow_validation_result is only available during validation phases." };
    if (tool === WORKFLOW_REPAIR_RESULT_TOOL && state.mode !== "repairing" && state.mode !== "mission_repairing") return { block: true, reason: "workflow_repair_result is only available during repair phases." };

    if (tool === "standard_todo") {
      if (state.mode !== "standard") return { block: true, reason: "Standard Mode To Do is only available while Standard Mode is active." };
      if (state.standardClarificationPending || state.standardClarificationStage === "drafting" || state.standardClarificationStage === "awaiting_answer") return { block: true, reason: "Standard Mode To Do is blocked until the pending Standard clarification is answered." };
    }

    if (state.mode === "standard" && tool !== "standard_todo" && standardRequiredTodoMissing(state, settings)) {
      if (tool === "edit" || tool === "write" || tool === "subagent") return { block: true, reason: `Standard Mode ${tool} is blocked until required dynamic task-specific To Do tracking is initialized with standard_todo.` };
      if (tool === "bash") {
        const command = String((event.input as { command?: unknown }).command ?? "");
        if (!standardSafeReadOnlyBash(command)) return { block: true, reason: "Standard Mode bash is blocked until required dynamic task-specific To Do tracking is initialized with standard_todo." };
      }
    }

    if (isPlanMode(state.mode)) {
      if (tool === "edit" || tool === "write") return { block: true, reason: `Workflow Plan Mode blocks ${tool}. Allowed tools: ${PLAN_TOOLS.join(", ")}${settings.safety.disableBashInPlanMode === false ? ", bash (safe commands)" : ""}` };
      if (tool === "bash" && settings.safety.disableBashInPlanMode !== false) return { block: true, reason: `Workflow Plan Mode blocks bash. Allowed tools: ${PLAN_TOOLS.join(", ")}` };
    }

    if (isValidatorMode(state.mode)) {
      if (tool === "edit" || tool === "write") return { block: true, reason: `Workflow Review/Validator Mode blocks ${tool}. Allowed tools: ${VALIDATOR_TOOLS.join(", ")}` };
      if (tool === "bash") {
        const command = String((event.input as { command?: unknown }).command ?? "");
        if (!validatorSafeEvidenceBash(command)) return { block: true, reason: `Workflow Review/Validator Mode blocks unsafe bash. Allowed bash is limited to safe read-only evidence commands.` };
      }
    }

    if ((isExecutionMode(state.mode) || isPlanMode(state.mode) || isValidatorMode(state.mode)) && tool === "bash") {
      const command = String((event.input as { command?: unknown }).command ?? "");
      if (commandBlocked(command, ctx.cwd)) return { block: true, reason: `Workflow safety blocked destructive or out-of-scope bash command: ${command}` };
    }
  });

  pi.on("user_bash", (event, ctx) => {
    const state = getState();
    const settings = loadWorkflowSettings(ctx.cwd);

    if (isSubagentWorker()) {
      if (commandBlocked(event.command, ctx.cwd)) return { result: { output: `Workflow safety blocked destructive sub-agent command: ${event.command}`, exitCode: 1, cancelled: false, truncated: false } };
      return;
    }

    if (repoLockEnabled(settings) || process.env.PI_WORKFLOW_REPO_LOCK_ENABLED === "1") {
      const reason = repoLockBashBlock(event.command, ctx.cwd);
      if (reason) return { result: { output: reason, exitCode: 1, cancelled: false, truncated: false } };
    }

    if (isPlanMode(state.mode) && settings.safety.disableBashInPlanMode !== false) {
      return { result: { output: `Workflow ${state.mode} blocks user bash: ${event.command}`, exitCode: 1, cancelled: false, truncated: false } };
    }
    if (isValidatorMode(state.mode) && !validatorSafeEvidenceBash(event.command)) {
      return { result: { output: `Workflow ${state.mode} blocks unsafe user bash: ${event.command}`, exitCode: 1, cancelled: false, truncated: false } };
    }
    if ((isExecutionMode(state.mode) || isPlanMode(state.mode) || isValidatorMode(state.mode)) && commandBlocked(event.command, ctx.cwd)) {
      return { result: { output: `Workflow safety blocked destructive command: ${event.command}`, exitCode: 1, cancelled: false, truncated: false } };
    }
  });
}

// No-op default export so this helper module can be safely auto-discovered as a Pi extension.
export default function workflowSuiteNoopExtension(): void {}
