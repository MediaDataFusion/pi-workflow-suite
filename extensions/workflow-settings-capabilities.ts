import type { WorkflowSettings } from "./workflow-model-router.js";

export type WorkflowSettingCapabilityStatus = "wired" | "partial" | "conflict" | "future" | "unclear";

export interface WorkflowSettingCapability {
  path: string;
  domain: "models" | "workflow" | "standard" | "missions" | "safety" | "ui" | "subagents" | "planning" | "context" | "presets";
  intent: string;
  owner: string;
  status: WorkflowSettingCapabilityStatus;
  related: string[];
  risk: string;
  action: string;
}

type CapabilityFactory = (settings: WorkflowSettings) => WorkflowSettingCapability;

function capability(entry: WorkflowSettingCapability): WorkflowSettingCapability {
  return entry;
}

function conflictWhen(condition: boolean, entry: WorkflowSettingCapability, conflictAction: string): WorkflowSettingCapability {
  return condition ? { ...entry, status: "conflict", action: conflictAction } : entry;
}

const PLAN_MODE_CAPABILITIES: CapabilityFactory[] = [
  (settings) => conflictWhen(
    settings.workflow.requireApprovalBeforeExecution !== undefined && settings.workflow.requireApprovalBeforeExecution !== settings.workflow.requirePlanApprovalBeforeExecute,
    capability({
      path: "workflow.requirePlanApprovalBeforeExecute",
      domain: "workflow",
      intent: "Require an explicit user approval gate before Plan Mode execution can begin.",
      owner: "beginExecution / approveCurrentPlan",
      status: "wired",
      related: ["workflow.requireApprovalBeforeExecution"],
      risk: "If aliases diverge, health and runtime may appear to disagree about the approval gate.",
      action: "Preserve both fields; use effective approval diagnostics before changing runtime behavior.",
    }),
    "Resolve alias precedence between requirePlanApprovalBeforeExecute and requireApprovalBeforeExecution before changing Plan execution gates.",
  ),
  (settings) => conflictWhen(
    settings.workflow.validateAfterExecution !== undefined && settings.workflow.validateAfterExecution !== settings.workflow.autoRunValidationAfterExecute,
    capability({
      path: "workflow.autoRunValidationAfterExecute",
      domain: "workflow",
      intent: "Automatically start validator after approved Plan execution completes.",
      owner: "beginExecution / beginValidation / showPostExecutionMenu",
      status: "wired",
      related: ["workflow.validateAfterExecution", "workflow.offerValidationAfterExecute"],
      risk: "If aliases diverge, validation may be described as automatic while effective behavior says disabled or optional.",
      action: "Preserve both fields; define canonical effective validation behavior before changing runtime branches.",
    }),
    "Resolve validation alias precedence between autoRunValidationAfterExecute and validateAfterExecution before changing validation flow.",
  ),
  () => capability({
    path: "workflow.offerReviewerBeforeExecute",
    domain: "workflow",
    intent: "Offer a manual reviewer gate before Plan execution when automatic review is not enabled.",
    owner: "approveCurrentPlan / continueAfterPlanApproval / beginReview",
    status: "wired",
    related: ["workflow.autoRunReviewerBeforeExecute", "models.reviewer", "subagents.reviewPolicy"],
    risk: "Reviewer can feel inconsistent if model routing or review sub-agent policy is unavailable.",
    action: "Keep; test manual and automatic reviewer paths separately.",
  }),
  () => capability({
    path: "workflow.autoRunReviewerBeforeExecute",
    domain: "workflow",
    intent: "Automatically run reviewer before Plan execution when configured.",
    owner: "continueAfterPlanApproval / beginReview",
    status: "wired",
    related: ["workflow.offerReviewerBeforeExecute", "models.reviewer", "subagents.reviewPolicy"],
    risk: "Can add latency when enabled with forced review sub-agents.",
    action: "Keep; expose latency expectations in health when auto reviewer and forced review workers are both enabled.",
  }),
  (settings) => conflictWhen(
    settings.workflow.repairRetry?.gates?.validation?.autoRepairFailures !== undefined && settings.workflow.repairRetry.gates.validation.autoRepairFailures !== settings.workflow.autoRepairValidationFailures,
    capability({
      path: "workflow.repairRetry.gates.validation.autoRepairFailures",
      domain: "workflow",
      intent: "Control whether validation failures can trigger safe automatic repair and revalidation.",
      owner: "handleWorkflowRetryCommand / startWorkflowRepair / final validation menu",
      status: "wired",
      related: ["workflow.autoRepairValidationFailures", "workflow.validationRetryMode", "workflow.maxValidationRetriesPerPlan", "workflow.maxValidationRetriesPerWorkflow"],
      risk: "Alias mismatch can make repair look enabled while effective gate blocks or vice versa.",
      action: "Preserve nested and legacy fields; align effective gate resolution before changing repair behavior.",
    }),
    "Resolve validation repair aliases before changing repair/retry flow.",
  ),
  (settings) => conflictWhen(
    settings.workflow.repairRetry?.gates?.review?.autoRepairFailures !== undefined && settings.workflow.repairRetry.gates.review.autoRepairFailures !== settings.workflow.autoRepairReviewFailures,
    capability({
      path: "workflow.repairRetry.gates.review.autoRepairFailures",
      domain: "workflow",
      intent: "Control whether reviewer failures can trigger safe plan repair/revision before execution.",
      owner: "beginReview / continueAfterPlanApproval / repair retry helpers",
      status: "wired",
      related: ["workflow.autoRepairReviewFailures", "workflow.reviewRetryMode", "workflow.maxReviewRetriesPerPlan"],
      risk: "Alias mismatch can cause unexpected reviewer repair prompts or missing repair opportunities.",
      action: "Preserve nested and legacy fields; align effective gate resolution before reviewer repair changes.",
    }),
    "Resolve review repair aliases before changing reviewer repair flow.",
  ),
  () => capability({
    path: "workflow.requireApprovalPerStep",
    domain: "workflow",
    intent: "Require approval at individual approved-plan steps when step-gated execution is enabled.",
    owner: "executePrompt / workflow progress handling",
    status: "partial",
    related: ["workflow.validateAfterEachStep", "workflow.planProgressEnabled"],
    risk: "May be visible in prompts/settings without a complete interactive approval loop per step.",
    action: "Preserve; audit step-gated execution before advertising as fully wired.",
  }),
  () => capability({
    path: "workflow.validateAfterEachStep",
    domain: "workflow",
    intent: "Validate individual approved-plan steps instead of only validating the full execution.",
    owner: "executePrompt / beginValidation / planStepValidationIndex",
    status: "partial",
    related: ["workflow.requireApprovalPerStep", "workflow.planProgressEnabled"],
    risk: "Partial step validation can confuse full-plan validation if next-action messaging is unclear.",
    action: "Preserve; build targeted Plan Mode tests before expanding step-level validation.",
  }),
  () => capability({
    path: "workflow.planProgressEnabled",
    domain: "workflow",
    intent: "Track approved Plan steps and expose execution/validation progress.",
    owner: "mergePlanProgress / workflow_progress tool / plan progress widget",
    status: "wired",
    related: ["workflow.planRuntimeEnabled", "workflow.validateAfterEachStep"],
    risk: "Progress can drift if plan parser cannot extract implementation steps.",
    action: "Keep; continue parser-safe plan step tests.",
  }),
  () => capability({
    path: "workflow.returnToPlanModeAfterWorkflow",
    domain: "workflow",
    intent: "Return to Plan input after a completed workflow instead of ending in idle.",
    owner: "showFinalMenu / enterPlanModeAwaitingInput",
    status: "wired",
    related: ["workflow.savePlans", "workflow.planHistoryLimit"],
    risk: "Can feel surprising now that new sessions intentionally start idle.",
    action: "Keep; health/status should explain session start and completion return behavior separately.",
  }),
];

const SUBAGENT_CAPABILITIES: CapabilityFactory[] = [
  () => capability({
    path: "subagents.enabled",
    domain: "subagents",
    intent: "Master switch for Workflow Suite use of sub-agents across Plan, Standard, Mission, review, validation, and repair.",
    owner: "planToolsFor / executionToolsFor / phase policy helpers",
    status: "wired",
    related: ["standard.allowSubagents", "missions.subagentPolicy"],
    risk: "If disabled, forced policies cannot be satisfied and workflows should block clearly.",
    action: "Keep; make blockers explicit when disabled conflicts with forced policies.",
  }),
  () => capability({
    path: "subagents.planningPolicy",
    domain: "subagents",
    intent: "Control planning sub-agent aggressiveness for Plan Mode planning.",
    owner: "beginPlanning / beginForcedSubagentPhase / planPrompt",
    status: "wired",
    related: ["subagents.minPlanningWorkersForDeep", "subagents.minPlanningWorkersForMaximum", "planning.useSubagentsBeforeClarification"],
    risk: "Forced planning can add latency or block if workers are unavailable.",
    action: "Keep; redesign agent contracts before changing forced policy behavior.",
  }),
  () => capability({
    path: "subagents.executionPolicy",
    domain: "subagents",
    intent: "Control execution-phase support agents for approved Plan and Mission execution.",
    owner: "beginExecution / beginMissionRun / phasePromptPolicyBlock",
    status: "wired",
    related: ["subagents.allowParallelExecution", "subagents.minExecutionWorkersForMaximum"],
    risk: "Execution support agents may be confused with parallel file edits.",
    action: "Keep; health must distinguish parallel agents from parallel file writes.",
  }),
  () => capability({
    path: "subagents.repairPolicy",
    domain: "subagents",
    intent: "Control repair-phase support agents for validation/review repair loops.",
    owner: "phasePolicy / repairPolicySource / startWorkflowRepair",
    status: "wired",
    related: ["subagents.executionPolicy", "workflow.repairRetry"],
    risk: "Repair inherits execution-like write risk unless prompts and guards keep writes serialized.",
    action: "Keep; preserve serialized writes until scoped edit protection is implemented.",
  }),
  () => capability({
    path: "subagents.allowParallelReadOnly",
    domain: "subagents",
    intent: "Allow multiple read-only/planning/review/validation agents to run concurrently.",
    owner: "workflow-subagent-policy / runner",
    status: "wired",
    related: ["subagents.allowParallelPlanning", "subagents.allowParallelReview", "subagents.allowParallelValidation"],
    risk: "Can increase token/runtime cost but is valuable for quality and speed.",
    action: "Keep; expose cost/latency tradeoff in health rather than disabling it.",
  }),
  () => capability({
    path: "subagents.allowParallelEdits",
    domain: "subagents",
    intent: "Allow simultaneous file-writing agents only when conflict protection exists.",
    owner: "fileWriteModeLabel / prompts / safety diagnostics",
    status: "partial",
    related: ["subagents.editConcurrencyMode", "subagents.requireParallelEditConflictProtection"],
    risk: "Unsafe if treated the same as parallel research agents.",
    action: "Preserve setting; keep main writes serialized until scoped conflict protection is explicitly implemented.",
  }),
];


const SAFETY_CAPABILITIES: CapabilityFactory[] = [
  () => capability({
    path: "safety.repoLockEnabled",
    domain: "safety",
    intent: "Scope built-in file tools to the active repository and reduce cross-repository scanning when enabled.",
    owner: "workflow-tool-guard / Global Safety menu",
    status: "wired",
    related: ["safety.blockDestructiveCommands", "subagents.enabled", "standard.allowSubagents"],
    risk: "Bash is constrained by conservative command inspection, not by an OS-level sandbox; sub-agent child processes run with --no-extensions and need separate hardening for full sandbox parity.",
    action: "Keep visible as Repo Lock; do not describe it as a container or kernel sandbox.",
  }),
];

const STANDARD_MISSION_CONTEXT_CAPABILITIES: CapabilityFactory[] = [
  () => capability({
    path: "standard.todoTriggerMode",
    domain: "standard",
    intent: "Control whether Standard Mode uses no To Do, manual To Do, automatic To Do, or required To Do tracking.",
    owner: "standardPrompt / standard_todo tool / workflow-tool-guard",
    status: "wired",
    related: ["standard.autoTodoEnabled", "standard.todoProgressVisible"],
    risk: "Required mode can feel heavy if task-size detection is poor.",
    action: "Keep; tune Standard prompts only after Plan Mode is stable.",
  }),
  () => capability({
    path: "missions.watchdogEnabled",
    domain: "missions",
    intent: "Expose a user-supervised watchdog/recovery direction for stale missions.",
    owner: "mission settings diagnostics / future recovery actions",
    status: "future",
    related: ["missions.watchdogStaleMinutes", "missions.heartbeatEnabled"],
    risk: "Can look fully enforced when current design keeps recovery supervised.",
    action: "Preserve; label as planned/partial until user-supervised recovery actions are implemented.",
  }),
  () => capability({
    path: "context.compactionMode",
    domain: "context",
    intent: "Select Pi default, custom model, custom agent, or disabled compaction behavior.",
    owner: "compaction hook / maybeRunWorkflowAutoCompaction",
    status: "partial",
    related: ["context.customCompactionEnabled", "context.compactionModelProvider", "context.compactionAgent"],
    risk: "custom_agent mode is reserved/planned and custom_model needs provider/model routing.",
    action: "Preserve; keep fallback diagnostics clear.",
  }),
];

export function workflowSettingsCapabilities(settings: WorkflowSettings): WorkflowSettingCapability[] {
  return [
    ...PLAN_MODE_CAPABILITIES,
    ...SUBAGENT_CAPABILITIES,
    ...SAFETY_CAPABILITIES,
    ...STANDARD_MISSION_CONTEXT_CAPABILITIES,
  ].map((factory) => factory(settings));
}

export function workflowSettingsCapabilitiesByStatus(settings: WorkflowSettings): Record<WorkflowSettingCapabilityStatus, WorkflowSettingCapability[]> {
  const groups: Record<WorkflowSettingCapabilityStatus, WorkflowSettingCapability[]> = {
    wired: [],
    partial: [],
    conflict: [],
    future: [],
    unclear: [],
  };
  for (const item of workflowSettingsCapabilities(settings)) groups[item.status].push(item);
  return groups;
}

export function renderWorkflowSettingsCapabilityMatrix(settings: WorkflowSettings): string {
  const items = workflowSettingsCapabilities(settings);
  const rows = items.map((item) => `- ${item.path} [${item.status}] — ${item.intent} Owner: ${item.owner}. Action: ${item.action}`);
  return rows.join("\n");
}

export default function workflowSettingsCapabilitiesNoopExtension(): void {}
