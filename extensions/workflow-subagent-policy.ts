/**
 * Sub-agent policy calculation helpers for Pi Workflow Suite.
 *
 * Extracted from workflow-modes.ts for independent testability.
 * These are pure policy calculations that depend only on the WorkflowSettings
 * type, not on Pi runtime, tool arrays, or extension state.
 */

import { type WorkflowSettings } from "./workflow-model-router.js";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { getAgentDir } from "@earendil-works/pi-coding-agent";

export type SubagentPhase = "Planning" | "Execution" | "Repair" | "Review" | "Validation";
export type SubagentPolicyValue = "off" | "auto" | "deep" | "maximum" | "forced";
export type SubagentPolicyDecisionOutcome =
  | "required"
  | "exempt_trivial"
  | "allow_probe"
  | "allow_mechanical"
  | "allow_user_explicit_finalization"
  | "auto_delegate"
  | "auto_skip_trivial"
  | "auto_skip_no_useful_parallel_work"
  | "unavailable";

export interface SubagentPolicyDecision {
  phase: SubagentPhase;
  policy: SubagentPolicyValue;
  outcome: SubagentPolicyDecisionOutcome;
  reason: string;
  task?: string;
  required?: number;
  observed?: number;
  background?: boolean;
  createdAt: string;
}

export interface SubagentToolProfile {
  name: string;
  tools?: string[];
  source?: string;
}

const MUTATING_SUBAGENT_TOOLS = new Set(["edit"]);
const ORCHESTRATOR_AGENT_NAME = "workflow-orchestrator";

export function subagentToolsAllowMutation(tools?: string[]): boolean {
  return (tools ?? []).some((tool) => MUTATING_SUBAGENT_TOOLS.has(tool.trim().toLowerCase()));
}

export function subagentPhaseAllowsOrchestratorFallback(phase: SubagentPhase, label: string): boolean {
  return phase === "Planning" && /mission|orchestrat/i.test(label);
}

export function subagentSuitableForForcedPhase(agent: SubagentToolProfile, phase: SubagentPhase, label: string): boolean {
  if (subagentToolsAllowMutation(agent.tools)) return false;
  if (agent.name === ORCHESTRATOR_AGENT_NAME && !subagentPhaseAllowsOrchestratorFallback(phase, label)) return false;
  return true;
}

export function subagentToolProfileLabel(agent: SubagentToolProfile): string {
  const source = agent.source ?? "unknown";
  const tools = agent.tools?.length ? agent.tools.join(",") : "default";
  return `${agent.name} (${source}; tools=${tools})`;
}

const EXTENSION_DIR = dirname(fileURLToPath(import.meta.url));
const AGENT_DIR = getAgentDir();
const USER_SUBAGENT_EXTENSION_FILE = join(AGENT_DIR, "extensions", "subagent", "index.ts");
const PACKAGE_SUBAGENT_EXTENSION_FILE = join(EXTENSION_DIR, "subagent", "index.ts");

export function subagentPhaseSettingKeys(phase: SubagentPhase): { policyKey: string; deepKey: string; maximumKey: string; autoUseKey: string; parallelKey: string } {
  if (phase === "Planning") return { policyKey: "planningPolicy", deepKey: "minPlanningWorkersForDeep", maximumKey: "minPlanningWorkersForMaximum", autoUseKey: "autoUseDuringPlanning", parallelKey: "allowParallelPlanning" };
  if (phase === "Execution") return { policyKey: "executionPolicy", deepKey: "minExecutionWorkersForDeep", maximumKey: "minExecutionWorkersForMaximum", autoUseKey: "autoUseDuringExecution", parallelKey: "allowParallelExecution" };
  if (phase === "Repair") return { policyKey: "repairPolicy", deepKey: "minRepairWorkersForDeep", maximumKey: "minRepairWorkersForMaximum", autoUseKey: "autoUseDuringRepair", parallelKey: "allowParallelRepair" };
  if (phase === "Review") return { policyKey: "reviewPolicy", deepKey: "minReviewWorkersForDeep", maximumKey: "minReviewWorkersForMaximum", autoUseKey: "autoUseDuringReview", parallelKey: "allowParallelReview" };
  return { policyKey: "validationPolicy", deepKey: "minValidationWorkersForDeep", maximumKey: "minValidationWorkersForMaximum", autoUseKey: "autoUseDuringValidation", parallelKey: "allowParallelValidation" };
}

export function phasePolicy(settings: WorkflowSettings, phase: SubagentPhase): SubagentPolicyValue {
  const sub = settings.subagents as typeof settings.subagents & { repairPolicy?: SubagentPolicyValue };
  if (phase === "Planning") return settings.subagents.planningPolicy ?? "auto";
  if (phase === "Execution") return settings.subagents.executionPolicy ?? "auto";
  if (phase === "Repair") return sub.repairPolicy ?? settings.subagents.executionPolicy ?? "auto";
  if (phase === "Review") return settings.subagents.reviewPolicy ?? "auto";
  return settings.subagents.validationPolicy ?? "auto";
}

export function phaseAutoUseAllowed(settings: WorkflowSettings, phase: SubagentPhase): boolean {
  const sub = settings.subagents as typeof settings.subagents & { autoUseDuringRepair?: boolean };
  if (phase === "Planning") return settings.subagents.autoUseDuringPlanning !== false;
  if (phase === "Execution") return settings.subagents.autoUseDuringExecution !== false;
  if (phase === "Repair") return sub.autoUseDuringRepair ?? (settings.subagents.autoUseDuringExecution !== false);
  if (phase === "Review") return settings.subagents.autoUseDuringReview !== false;
  return settings.subagents.autoUseDuringValidation !== false;
}

export function phaseParallelAllowed(settings: WorkflowSettings, phase: SubagentPhase): boolean {
  const sub = settings.subagents as typeof settings.subagents & { allowParallelRepair?: boolean };
  if (phase === "Planning") return settings.subagents.allowParallelPlanning !== false;
  if (phase === "Execution") return settings.subagents.allowParallelExecution !== false;
  if (phase === "Repair") return sub.allowParallelRepair ?? (settings.subagents.allowParallelExecution !== false);
  if (phase === "Review") return settings.subagents.allowParallelReview !== false;
  return settings.subagents.allowParallelValidation !== false;
}

export function workerCount(settings: WorkflowSettings, phase: SubagentPhase): { deep: number; maximum: number } {
  const sub = settings.subagents as typeof settings.subagents & Record<string, number | undefined>;
  if (phase === "Repair") {
    return {
      deep: sub.minRepairWorkersForDeep ?? sub.minExecutionWorkersForDeep ?? 1,
      maximum: sub.minRepairWorkersForMaximum ?? sub.minExecutionWorkersForMaximum ?? 2,
    };
  }
  return {
    deep: sub[`min${phase}WorkersForDeep`] ?? 1,
    maximum: sub[`min${phase}WorkersForMaximum`] ?? 2,
  };
}

export function workerTargetForPolicy(policy: SubagentPolicyValue | undefined, workers: { deep: number; maximum: number }): number {
  const effectivePolicy = policy ?? "auto";
  if (effectivePolicy === "deep") return Math.max(1, workers.deep);
  if (effectivePolicy === "maximum") return Math.max(1, workers.maximum);
  if (effectivePolicy === "forced") return Math.max(1, workers.maximum);
  return 0;
}

export function subagentPolicyRequiresRequiredEvidence(policy: SubagentPolicyValue | undefined): boolean {
  return policy === "forced";
}

export function subagentPolicyNeedsInternalDecision(policy: SubagentPolicyValue | undefined): boolean {
  return policy === "auto" || policy === "deep" || policy === "maximum";
}

export function formatSubagentPolicyDecision(decision: SubagentPolicyDecision): string {
  return [
    `Policy decision: ${decision.outcome}`,
    `Phase: ${decision.phase}`,
    `Policy: ${decision.policy}`,
    decision.required !== undefined ? `Required workers: ${decision.required}` : undefined,
    decision.observed !== undefined ? `Observed workers: ${decision.observed}` : undefined,
    decision.background !== undefined ? `Background: ${decision.background ? "yes" : "no"}` : undefined,
    `Reason: ${decision.reason}`,
  ].filter((line): line is string => Boolean(line)).join("\n");
}

export type ForcedSubagentActionTool =
  | "read"
  | "grep"
  | "find"
  | "ls"
  | "bash"
  | "edit"
  | "write"
  | "subagent"
  | "workflow_progress"
  | "workflow_execution_result"
  | "workflow_validation_result"
  | "workflow_repair_result"
  | "workflow_review_result"
  | "mission_milestone_result"
  | "standard_handoff_result"
  | "standard_todo"
  | string;

export interface ForcedSubagentActionInput {
  phase: SubagentPhase;
  policy: SubagentPolicyValue;
  task?: string;
  kind?: string;
  toolName?: ForcedSubagentActionTool;
  command?: string;
}

export interface ForcedSubagentActionDecision {
  outcome: Extract<SubagentPolicyDecisionOutcome, "required" | "exempt_trivial" | "allow_probe" | "allow_mechanical" | "allow_user_explicit_finalization">;
  reason: string;
  allowBeforeEvidence: boolean;
}

export interface AdvisorySubagentActionDecision {
  outcome: SubagentPolicyDecisionOutcome;
  reason: string;
  allowBeforeEvidence: boolean;
}

const WORK_MUTATION_RE = /\b(?:edit|write|modify|change|implement|add|remove|delete|refactor|migrate|apply|create files?|update files?|repair|fix)\b/i;
const EVIDENCE_WORK_RE = /\b(?:validate|validation|verify|test|lint|build|typecheck|quality review|review)\b/i;
const FINALIZATION_WORK_RE = /\b(?:commit|push|sync(?:\s+to)?\s+live|install(?:\s+to)?\s+live)\b/i;
const TRIVIAL_REQUEST_RE = /^(?:hi|hello|hey|thanks|thank you|ok|okay|yes|no|help|status)$/i;
const SMALL_LOOKUP_RE = /\b(?:what|where|when|who|which|explain|summari[sz]e)\b/i;
const SIMPLE_READ_RE = /\b(?:status|list|show|summari[sz]e|inspect|scan|read.?only|docs? only|no code|do not edit|without editing)\b/i;
const COMPLEX_CONTEXT_RE = /\b(?:codebase|architecture|multi-file|implementation|workflow|release|runtime|regression)\b/i;
const SAFE_PROBE_COMMAND_RE = /^(?:pwd|date|whoami|id|hostname|uname\b.*|git\s+(?:status|diff|log|show|branch|rev-parse|ls-files|describe|remote)\b.*|(?:node|npm|pnpm|yarn|bun|python3?|pip3?|cargo|go|rustc|tsc)\s+(?:--version|-v|-V)\b.*)$/i;
const EXACT_USER_FINALIZATION_COMMAND_RE = /^(?:git\s+add\b.+|git\s+commit\b.+|git\s+push(?:\s+\S+){0,2}|scripts\/install-to-live\.sh|scripts\/verify-live\.sh)$/i;

function normalizedWords(text: string | undefined): string[] {
  return (text ?? "").trim().toLowerCase().split(/\s+/).filter(Boolean);
}

function forcedTrivialTaskReason(phase: SubagentPhase, task: string | undefined, kind?: string): string | undefined {
  const text = task?.trim() ?? "";
  if (!text) return "empty/no-op request";
  const normalized = text.toLowerCase();
  const words = normalizedWords(text);
  if (TRIVIAL_REQUEST_RE.test(normalized)) return "trivial conversational/status request";
  if (WORK_MUTATION_RE.test(normalized) || EVIDENCE_WORK_RE.test(normalized) || FINALIZATION_WORK_RE.test(normalized)) return undefined;
  if (kind && kind !== "read_only") return undefined;
  if (SIMPLE_READ_RE.test(normalized) && words.length <= 14) return `trivial ${phase.toLowerCase()} read-only/status request`;
  if (normalized.length <= 80 && SMALL_LOOKUP_RE.test(normalized) && !COMPLEX_CONTEXT_RE.test(normalized)) return `small ${phase.toLowerCase()} lookup/explanation request`;
  return undefined;
}

function commandWithoutTimeout(command: string | undefined): string {
  return (command ?? "").trim().replace(/^timeout\s+\d+[smhd]?\s+/, "").trim();
}

export function forcedSubagentActionDecision(input: ForcedSubagentActionInput): ForcedSubagentActionDecision {
  const toolName = input.toolName;
  if (!subagentPolicyRequiresRequiredEvidence(input.policy)) {
    return { outcome: "allow_mechanical", reason: "sub-agent policy is not forced", allowBeforeEvidence: true };
  }

  if (!toolName) {
    const reason = forcedTrivialTaskReason(input.phase, input.task, input.kind);
    if (reason) return { outcome: "exempt_trivial", reason, allowBeforeEvidence: true };
    return { outcome: "required", reason: "non-trivial phase requires forced sub-agent evidence", allowBeforeEvidence: false };
  }

  if (toolName === "subagent") {
    return { outcome: "allow_mechanical", reason: "visible sub-agent call is the required evidence path", allowBeforeEvidence: true };
  }

  if (toolName === "workflow_progress") {
    return { outcome: "allow_mechanical", reason: "workflow_progress only marks the current execution step active", allowBeforeEvidence: true };
  }

  if (toolName === "standard_todo") {
    return { outcome: "allow_mechanical", reason: "standard_todo only initializes or updates required Standard Mode task tracking", allowBeforeEvidence: true };
  }

  if (toolName === "read" || toolName === "grep" || toolName === "find" || toolName === "ls") {
    return { outcome: "allow_probe", reason: "local read/search/list probe can run before forced worker evidence", allowBeforeEvidence: true };
  }

  if (
    toolName === "workflow_execution_result"
    || toolName === "workflow_validation_result"
    || toolName === "workflow_repair_result"
    || toolName === "workflow_review_result"
    || toolName === "mission_milestone_result"
  ) {
    return { outcome: "required", reason: "typed phase handoff requires forced sub-agent evidence", allowBeforeEvidence: false };
  }

  if (toolName === "edit" || toolName === "write") {
    return { outcome: "required", reason: "file mutation requires forced sub-agent evidence", allowBeforeEvidence: false };
  }

  if (toolName === "bash") {
    const command = commandWithoutTimeout(input.command);
    if (SAFE_PROBE_COMMAND_RE.test(command)) {
      return { outcome: "allow_probe", reason: "safe shell probe can run before forced worker evidence", allowBeforeEvidence: true };
    }
    const task = input.task?.toLowerCase() ?? "";
    if (FINALIZATION_WORK_RE.test(task) && EXACT_USER_FINALIZATION_COMMAND_RE.test(command)) {
      return { outcome: "allow_user_explicit_finalization", reason: "exact user-requested finalization command is not useful worker fanout", allowBeforeEvidence: true };
    }
    return { outcome: "required", reason: "shell command is meaningful work and requires forced sub-agent evidence", allowBeforeEvidence: false };
  }

  const phaseReason = forcedTrivialTaskReason(input.phase, input.task, input.kind);
  if (phaseReason) return { outcome: "exempt_trivial", reason: phaseReason, allowBeforeEvidence: true };
  return { outcome: "required", reason: "tool use requires forced sub-agent evidence", allowBeforeEvidence: false };
}

export function advisorySubagentPolicyDecision(phase: SubagentPhase, policy: SubagentPolicyValue, task?: string, kind?: string): { outcome: Extract<SubagentPolicyDecisionOutcome, "auto_delegate" | "auto_skip_trivial" | "auto_skip_no_useful_parallel_work">; reason: string } {
  const trivialReason = forcedTrivialTaskReason(phase, task, kind);
  if (trivialReason) return { outcome: "auto_skip_trivial", reason: trivialReason };
  if (policy === "auto") return { outcome: "auto_delegate", reason: `auto policy must actively consider worker delegation for non-trivial ${phase.toLowerCase()} work` };
  return { outcome: "auto_delegate", reason: `${policy} policy expects worker delegation for non-trivial ${phase.toLowerCase()} work` };
}

export function advisorySubagentActionDecision(input: ForcedSubagentActionInput): AdvisorySubagentActionDecision {
  const toolName = input.toolName;
  if (!subagentPolicyNeedsInternalDecision(input.policy)) {
    return { outcome: "allow_mechanical", reason: "sub-agent policy does not require advisory consideration", allowBeforeEvidence: true };
  }

  if (!toolName) {
    const reason = forcedTrivialTaskReason(input.phase, input.task, input.kind);
    if (reason) return { outcome: "auto_skip_trivial", reason, allowBeforeEvidence: true };
    return { outcome: "auto_delegate", reason: `non-trivial ${input.phase.toLowerCase()} work must actively consider sub-agent delegation`, allowBeforeEvidence: false };
  }

  if (toolName === "subagent") {
    return { outcome: "auto_delegate", reason: "visible parent sub-agent call satisfies advisory consideration", allowBeforeEvidence: true };
  }

  if (toolName === "workflow_progress") {
    return { outcome: "allow_mechanical", reason: "workflow_progress only marks workflow bookkeeping", allowBeforeEvidence: true };
  }

  if (toolName === "standard_todo") {
    return { outcome: "allow_mechanical", reason: "standard_todo only initializes or updates required Standard Mode task tracking", allowBeforeEvidence: true };
  }

  if (
    toolName === "workflow_execution_result"
    || toolName === "workflow_validation_result"
    || toolName === "workflow_repair_result"
    || toolName === "workflow_review_result"
    || toolName === "mission_milestone_result"
    || toolName === "standard_handoff_result"
  ) {
    return { outcome: "allow_user_explicit_finalization", reason: "typed phase handoff is finalization; advisory sub-agent consideration must happen before substantive work", allowBeforeEvidence: true };
  }

  if (toolName === "bash") {
    const command = commandWithoutTimeout(input.command);
    if (SAFE_PROBE_COMMAND_RE.test(command)) {
      return { outcome: "allow_probe", reason: "safe shell probe can run before advisory worker evidence", allowBeforeEvidence: true };
    }
    const task = input.task?.toLowerCase() ?? "";
    if (FINALIZATION_WORK_RE.test(task) && EXACT_USER_FINALIZATION_COMMAND_RE.test(command)) {
      return { outcome: "allow_user_explicit_finalization", reason: "exact user-requested finalization command is not useful worker fanout", allowBeforeEvidence: true };
    }
  }

  const trivialReason = forcedTrivialTaskReason(input.phase, input.task, input.kind);
  if (trivialReason) return { outcome: "auto_skip_trivial", reason: trivialReason, allowBeforeEvidence: true };
  return { outcome: "auto_delegate", reason: `non-trivial ${input.phase.toLowerCase()} ${toolName} use must actively consider sub-agent delegation`, allowBeforeEvidence: false };
}

export function activeWorkerTargetLabel(policy: SubagentPolicyValue | undefined, workers: { deep: number; maximum: number }): string {
  const effectivePolicy = policy ?? "auto";
  if (effectivePolicy === "off") return "off (sub-agents disabled for this phase)";
  if (effectivePolicy === "auto") return `actively considered; prefer up to ${Math.max(1, workers.deep)} target worker${Math.max(1, workers.deep) === 1 ? "" : "s"} for non-trivial work`;
  if (effectivePolicy === "deep") return `${workers.deep} target worker${workers.deep === 1 ? "" : "s"} (deep policy; expected for non-trivial work)`;
  if (effectivePolicy === "maximum") return `${workers.maximum} target worker${workers.maximum === 1 ? "" : "s"} (maximum policy; skip only if trivial/unavailable)`;
  return `${Math.max(1, workers.maximum)} required worker${Math.max(1, workers.maximum) === 1 ? "" : "s"} (forced policy; hard requirement)`;
}

export function planningSubagentsAllowed(settings: WorkflowSettings): boolean {
  return settings.subagents.enabled !== false && settings.subagents.autoUseDuringPlanning !== false && settings.subagents.planningPolicy !== "off" && settings.subagents.allowParallelPlanning !== false;
}

export function executionSubagentsAllowed(settings: WorkflowSettings): boolean {
  return settings.subagents.enabled !== false && settings.subagents.autoUseDuringExecution !== false && settings.subagents.executionPolicy !== "off" && settings.subagents.allowParallelExecution !== false;
}

export function reviewSubagentsAllowed(settings: WorkflowSettings): boolean {
  return settings.subagents.enabled !== false && settings.subagents.autoUseDuringReview !== false && settings.subagents.reviewPolicy !== "off" && settings.subagents.allowParallelReview !== false;
}

export function validationSubagentsAllowed(settings: WorkflowSettings): boolean {
  return settings.subagents.enabled !== false && settings.subagents.autoUseDuringValidation !== false && settings.subagents.validationPolicy !== "off" && settings.subagents.allowParallelValidation !== false;
}

export function repairPolicySource(settings: WorkflowSettings): "configured/default" | "inherited from execution" {
  return (settings.subagents as typeof settings.subagents & { repairPolicy?: SubagentPolicyValue }).repairPolicy ? "configured/default" : "inherited from execution";
}

export function forcedSubagentUnavailableReason(settings: WorkflowSettings, phase: SubagentPhase, cwd: string, policy = phasePolicy(settings, phase), workers = workerCount(settings, phase)): string | undefined {
  if (!subagentPolicyRequiresRequiredEvidence(policy)) return undefined;
  if (settings.subagents.enabled === false) return "subagents.enabled=false";
  if (!phaseAutoUseAllowed(settings, phase)) return `subagents.autoUseDuring${phase}=false`;
  if (!phaseParallelAllowed(settings, phase)) return `subagents.allowParallel${phase}=false`;
  if (phase !== "Execution" && settings.subagents.allowParallelReadOnly === false) return "subagents.allowParallelReadOnly=false";
  const subagentInstalled = existsSync(USER_SUBAGENT_EXTENSION_FILE) || existsSync(PACKAGE_SUBAGENT_EXTENSION_FILE);
  if (!subagentInstalled) return `the subagent extension is not installed at ${USER_SUBAGENT_EXTENSION_FILE} or bundled at ${PACKAGE_SUBAGENT_EXTENSION_FILE}`;
  const target = workerTargetForPolicy(policy, workers);
  if (target > 8) return `required worker target ${target} exceeds subagent maximum of 8`;
  return undefined;
}

export function forcedSubagentMessage(phase: SubagentPhase, reason: string, label?: string): string {
  return `Sub-agent policy is forced, but sub-agent execution is unavailable because ${reason}.\n\nPhase: ${label ?? phase}`;
}

export function fileWriteModeLabel(settings: WorkflowSettings): string {
  if (settings.subagents.allowParallelEdits === true && settings.subagents.editConcurrencyMode === "scoped") return "scoped parallel with conflict protection required";
  if (settings.subagents.allowParallelEdits === true && settings.subagents.editConcurrencyMode !== "sequential") return `${settings.subagents.editConcurrencyMode ?? "blocked"} with conflict protection required`;
  return "sequential";
}

export function hasRequiredSubagentPreflight(preflightBlock?: string): boolean {
  return Boolean(preflightBlock?.trim());
}

export function requiredSubagentPreflightSection(preflightBlock?: string): string {
  if (!preflightBlock?.trim()) return "";
  if (/^Policy decision:\s*exempt_trivial\b/im.test(preflightBlock)) {
    return `\n\n## Required Sub-Agent Policy Decision\n${preflightBlock.trim()}\n\nWorkflow Suite internally classified this forced-policy request as deterministic trivial/read-only or no-op work. Do not call the visible subagent tool solely for policy compliance, and do not print policy deliberation to the user.`;
  }
  return `\n\n## Required Sub-Agent Preflight\n${preflightBlock.trim()}\n\nThe workflow already ran the required forced-policy sub-agents for this phase. Use these findings as input. Do not rerun required workers just to satisfy policy; call more sub-agents only if additional targeted work is genuinely useful.`;
}

export function forcedSubagentPolicySatisfiedGuidance(label: string): string {
  return `FORCED SUB-AGENT POLICY SATISFIED: Workflow Suite already ran the required ${label} forced-policy sub-agents in preflight. Use the Required Sub-Agent Preflight findings. Do not call the visible subagent tool just to satisfy forced policy; call additional sub-agents only for genuinely new targeted work.`;
}

export function planningNeedsOrchestrator(settings: WorkflowSettings, _mode: "plan" | "mission"): boolean {
  const orchestrationPolicy = (settings.subagents as typeof settings.subagents & { planningOrchestrationPolicy?: string }).planningOrchestrationPolicy ?? "orchestrator_first";
  return orchestrationPolicy === "orchestrator_first" || orchestrationPolicy === "forced_orchestrated";
}

// ── Uniform error classification (#9) ──────────────────────────
export type SubagentErrorClass = "transient" | "permanent" | "policy";

export function classifySubagentError(result: { exitCode: number; stopReason?: string; errorMessage?: string; stderr?: string }): SubagentErrorClass {
  const reason = (result.errorMessage ?? result.stderr ?? "").toLowerCase();
  if (/timed out|stale watchdog|aborted/i.test(reason) || (result.stopReason === "aborted" && /time/i.test(reason))) return "transient";
  if (/repo lock|outside current repository/i.test(reason)) return "policy";
  if (/unknown agent|not installed|not found/i.test(reason)) return "permanent";
  if (result.exitCode === 0) return "transient"; // success
  return "permanent";
}

// No-op default export so this helper module can be safely auto-discovered as a Pi extension.
export default function workflowSuiteNoopExtension(): void {}
