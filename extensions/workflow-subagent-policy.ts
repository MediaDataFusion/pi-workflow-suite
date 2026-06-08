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

export function activeWorkerTargetLabel(policy: SubagentPolicyValue | undefined, workers: { deep: number; maximum: number }): string {
  const effectivePolicy = policy ?? "auto";
  if (effectivePolicy === "off") return "off (sub-agents disabled for this phase)";
  if (effectivePolicy === "auto") return "strongly encouraged (model must give a skip reason if no worker is useful)";
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
  if (policy !== "forced") return undefined;
  if (settings.subagents.enabled === false) return "subagents.enabled=false";
  if (!phaseAutoUseAllowed(settings, phase)) return `subagents.autoUseDuring${phase}=false`;
  if (!phaseParallelAllowed(settings, phase)) return `subagents.allowParallel${phase}=false`;
  if (phase !== "Execution" && settings.subagents.allowParallelReadOnly === false) return "subagents.allowParallelReadOnly=false";
  const subagentInstalled = existsSync(USER_SUBAGENT_EXTENSION_FILE) || existsSync(PACKAGE_SUBAGENT_EXTENSION_FILE);
  if (!subagentInstalled) return `the subagent extension is not installed at ${USER_SUBAGENT_EXTENSION_FILE} or bundled at ${PACKAGE_SUBAGENT_EXTENSION_FILE}`;
  const target = workerTargetForPolicy("forced", workers);
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
