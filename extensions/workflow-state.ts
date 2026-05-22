import { existsSync, mkdirSync, readFileSync, readdirSync, unlinkSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { getAgentDir } from "@earendil-works/pi-coding-agent";

export type WorkflowMode = "idle" | "standard" | "awaiting_plan_input" | "awaiting_mission_input" | "awaiting_clarification" | "planning" | "plan_draft" | "plan_approved" | "reviewing" | "reviewed" | "executing" | "executed" | "validating" | "validated" | "repairing" | "revalidating" | "mission_draft" | "mission_awaiting_clarification" | "mission_planning" | "mission_plan_ready" | "mission_approved" | "mission_running" | "mission_paused" | "mission_checkpointing" | "mission_validating" | "mission_repairing" | "mission_revalidating" | "mission_final_validating" | "mission_completed" | "mission_failed" | "mission_blocked" | "mission_stopped" | "cancelled";

export interface ClarificationQuestion {
  index: number;
  question: string;
  options: string[];        // e.g. ["A. Local dev server", "B. Vercel preview", ...]
}

export interface ClarificationAnswer {
  index: number;
  letter: string;          // "A", "B", "C", "D", or "S" for skip
  custom?: string;         // non-empty when letter is "D" (Other)
  skipped?: boolean;
}

export type WorkflowTypedHandoffType =
  | "workflow_plan_result"
  | "workflow_review_result"
  | "workflow_execution_result"
  | "workflow_validation_result"
  | "workflow_repair_result"
  | "mission_plan_result"
  | "mission_milestone_result"
  | "standard_handoff_result";

export interface WorkflowTypedHandoff {
  type: WorkflowTypedHandoffType;
  createdAt: string;
  sourceMode?: WorkflowMode;
  activePlanId?: string;
  activeMissionId?: string;
  payload: Record<string, unknown>;
}

export interface WorkflowRepairHistoryEntry {
  timestamp: string;
  retry: number;
  status: "running" | "completed" | "failed" | "blocked";
  validationFailure?: string;
  repairSummary?: string;
  nextAction: string;
}

export type RepairRetryGateName = "review" | "validation" | "missionValidation" | "missionFinalValidation";

export interface RepairRetryHistoryEntry {
  timestamp: string;
  retry: number;
  status: "running" | "completed" | "failed" | "blocked";
  failure?: string;
  repairSummary?: string;
  nextAction: string;
}

export interface RepairRetryGateState {
  currentRetry: number;
  workflowRetryCount: number;
  maxRetriesPerItem: number;
  maxRetriesPerWorkflow: number;
  lastFailure?: string;
  lastAttempt?: string;
  status: "none" | "running" | "completed" | "failed" | "blocked";
  inProgress?: boolean;
  history?: RepairRetryHistoryEntry[];
}

export type WorkflowReviewHistoryEntry = RepairRetryHistoryEntry & {
  reviewFailure?: string;
  revisedPlanSummary?: string;
};

export interface PlanRuntimeState {
  createdAt: string;
  activeRuntimeMs: number;
  activeRunStartedAt: string | null;
  lastProgressAt: string;
  runtimeCounter: "running" | "paused" | "stopped";
}

export interface StandardRuntimeState {
  id: string;
  createdAt: string;
  active: boolean;
  activeRuntimeMs: number;
  activeRunStartedAt: string | null;
  lastProgressAt: string;
  runtimeCounter: "running" | "paused" | "stopped";
}

export type PlanLifecycleStatus = "planning" | "awaiting_clarification" | "plan_ready" | "approved" | "reviewing" | "executing" | "validating" | "repairing" | "revalidating" | "completed" | "blocked";
export type PlanStepStatus = "pending" | "active" | "completed" | "failed" | "blocked" | "skipped";
export type PlanValidationStatus = "pending" | "running" | "pass" | "fail" | "unknown";

export interface PlanProgressStep {
  id: string;
  title: string;
  status: PlanStepStatus;
}

export interface PlanProgressState {
  createdAt: string;
  lifecycleStatus: PlanLifecycleStatus;
  currentStepIndex: number;
  steps: PlanProgressStep[];
  validationStatus: PlanValidationStatus;
  lastValidationStatus?: PlanValidationStatus;
  repairRetry: number;
  maxRepairRetries: number;
  repairStatus?: "none" | "running" | "completed" | "failed" | "blocked";
  nextAction: string;
}

export type StandardTodoStatus = "none" | "active" | "completed" | "paused" | "blocked";
export type StandardTodoItemStatus = "pending" | "active" | "completed" | "skipped" | "blocked";

export interface StandardTodoItem {
  id: string;
  title: string;
  status: StandardTodoItemStatus;
}

export interface StandardTodoState {
  createdAt: string;
  updatedAt: string;
  status: StandardTodoStatus;
  task?: string;
  currentItemIndex: number;
  items: StandardTodoItem[];
}

export type StandardClarificationStage = "drafting" | "awaiting_answer" | "answered";
export type WorkflowSubagentPhase = "Planning" | "Execution" | "Repair" | "Review" | "Validation";

export interface StandardSubagentPreflightRecord {
  task?: string;
  required: number;
  observed: number;
  agents: string[];
  satisfiedAt: string;
}

export interface CompletedPlanSummary {
  completedAt: string;
  planHistoryId?: string;
  status: "completed";
  stepsCompleted: number;
  stepsTotal: number;
  validationResult: "PASS" | "PARTIAL PASS" | "FAIL" | "UNKNOWN";
  repairRetries: number;
  maxRepairRetries: number;
  repairStatus?: "none" | "running" | "completed" | "failed" | "blocked";
  activeRuntimeMs: number;
  elapsedMs: number;
  nextAction: string;
  executionSummary?: string;
  validationReport?: string;
  repairSummary?: string;
  reviewerSummary?: string;
  finalReport?: string;
}

export interface WorkflowFinalStopSummary {
  stoppedAt: string;
  kind: "plan" | "mission";
  status: "completed" | "blocked";
  title: string;
  summary: string;
}

export interface CompletedMissionSummary {
  completedAt: string;
  missionId?: string;
  status: "completed";
  milestonesCompleted: number;
  milestonesTotal: number;
  validationResult: string;
  repairRetries: number;
  maxRepairRetries: number;
  repairStatus?: "none" | "running" | "completed" | "failed" | "blocked";
  activeRuntimeMs: number;
  elapsedMs: number;
  nextAction: string;
  executionSummary?: string;
  validationReport?: string;
  repairSummary?: string;
  finalReport?: string;
}

export interface WorkflowState {
  version: 1;
  mode: WorkflowMode;
  task?: string;
  originalTask?: string;
  draftPlan?: string;
  clarifyingQuestions?: ClarificationQuestion[];
  clarifyingAnswers?: ClarificationAnswer[];
  lastWorkflowHandoff?: WorkflowTypedHandoff;
  clarificationAlreadyAsked?: boolean;
  clarificationRequiredBeforePlan?: boolean;
  clarificationRequirementReason?: string;
  clarificationSkipReason?: string;
  clarificationQualityRetryCount?: number;
  planningDepth?: string;
  clarificationMode?: string;
  approvedPlan?: string;
  activePlanId?: string;
  planHistoryId?: string;
  approvedPlanHistoryId?: string;
  activeMissionId?: string;
  reviewerReport?: string;
  reviewerVerdict?: "PASS" | "NOTES" | "NEEDS REPAIR" | "FAIL" | "BLOCKED" | "UNKNOWN";
  currentReviewRetry?: number;
  workflowReviewRetryCount?: number;
  maxReviewRetriesPerPlan?: number;
  maxReviewRetriesPerWorkflow?: number;
  lastReviewFailure?: string;
  lastReviewAttempt?: string;
  lastReviewRepairStatus?: "none" | "running" | "completed" | "failed" | "blocked";
  reviewHistory?: WorkflowReviewHistoryEntry[];
  reviewRepairInProgress?: boolean;
  repairRetryState?: Partial<Record<RepairRetryGateName, RepairRetryGateState>>;
  executionSummary?: string;
  validationReport?: string;
  validationVerdict?: "PASS" | "PARTIAL PASS" | "FAIL" | "UNKNOWN";
  currentValidationRetry?: number;
  workflowValidationRetryCount?: number;
  maxValidationRetriesPerPlan?: number;
  maxValidationRetriesPerWorkflow?: number;
  lastValidationFailure?: string;
  lastRepairAttempt?: string;
  repairHistory?: WorkflowRepairHistoryEntry[];
  lastRepairStatus?: "none" | "running" | "completed" | "failed" | "blocked";
  planStepValidationIndex?: number;
  planRuntime?: PlanRuntimeState;
  planProgress?: PlanProgressState;
  standardRuntime?: StandardRuntimeState;
  standardTodo?: StandardTodoState;
  standardLastAutoCheckAt?: string;
  standardLastClarificationDecision?: string;
  standardLastClarificationReason?: string;
  standardClarificationPending?: boolean;
  standardClarificationStage?: StandardClarificationStage;
  standardActivePhase?: WorkflowSubagentPhase;
  standardWorkKind?: "read_only" | "mutation" | "validation" | "repair" | "review";
  standardClarificationTask?: string;
  standardClarificationAnswer?: string;
  standardClarificationRequirementReason?: string;
  standardClarifyingQuestions?: ClarificationQuestion[];
  standardClarifyingAnswers?: ClarificationAnswer[];
  standardSubagentPreflight?: Partial<Record<WorkflowSubagentPhase, StandardSubagentPreflightRecord>>;
  standardLastTodoDecision?: string;
  standardLastTodoReason?: string;
  lastCompletedPlanSummary?: CompletedPlanSummary;
  lastCompletedMissionSummary?: CompletedMissionSummary;
  lastPlanStopSummary?: WorkflowFinalStopSummary;
  lastMissionStopSummary?: WorkflowFinalStopSummary;
  modelsUsed?: {
    planner?: string;
    executor?: string;
    validator?: string;
    reviewer?: string;
  };
  updatedAt: string;
}

export interface SavedWorkflowPlan {
  id: string;
  timestamp: string;
  projectPath: string;
  projectLabel: string;
  planningMode: WorkflowMode;
  planningDepth?: string;
  clarificationMode?: string;
  originalTask?: string;
  clarificationQuestions?: ClarificationQuestion[];
  clarificationAnswers?: ClarificationAnswer[];
  finalPlan: string;
  approvalStatus: "draft" | "approved" | "revised" | "completed" | "archived";
  saveReason: string;
  validationVerdict?: WorkflowState["validationVerdict"];
  validationReport?: string;
  executionSummary?: string;
  reviewerReport?: string;
  repairStatus?: WorkflowState["lastRepairStatus"];
  repairAttempt?: string;
  finalReport?: string;
  modelsUsed?: WorkflowState["modelsUsed"];
  subagents?: Record<string, unknown>;
}

export interface PlanSavingOptions {
  cwd: string;
  approvalStatus: SavedWorkflowPlan["approvalStatus"];
  saveReason: string;
  planningDepth?: string;
  clarificationMode?: string;
  subagents?: Record<string, unknown>;
  executionSummary?: string;
  reviewerReport?: string;
  validationReport?: string;
  repairAttempt?: string;
  finalReport?: string;
  savePlanHistory?: boolean;
  planHistoryLimit?: number;
}

export type MissionStatus = "draft" | "planning" | "awaiting_clarification" | "planned" | "approved" | "running" | "paused" | "checkpointing" | "validating" | "repairing" | "revalidating" | "completed" | "failed" | "blocked" | "stopped";
export type MissionAutonomy = "manual" | "approval_gated" | "supervised_auto" | "full_auto";
export type MissionMilestoneStatus = "pending" | "active" | "completed" | "failed" | "skipped";

export interface MissionMilestone {
  id: string;
  title: string;
  objective: string;
  status: MissionMilestoneStatus;
  steps: string[];
  validation: string[];
  risks: string[];
  checkpointIds: string[];
}

export interface MissionCheckpoint {
  id: string;
  timestamp: string;
  status: MissionStatus;
  milestoneId?: string;
  summary: string;
  nextAction: string;
  filesChanged?: string[];
  validationResult?: string;
  errors?: string[];
}

export interface MissionRepairHistoryEntry {
  timestamp: string;
  milestoneId?: string;
  retry: number;
  status: "running" | "completed" | "failed" | "blocked";
  validationFailure?: string;
  repairSummary?: string;
  nextAction: string;
}

export interface MissionRuntimeSegment {
  startedAt: string;
  endedAt: string;
  durationMs: number;
  reasonEnded: "paused" | "blocked" | "stopped" | "completed" | "failed" | "waiting" | "status_change";
}

export interface MissionState {
  version: 1;
  id: string;
  status: MissionStatus;
  goal: string;
  createdAt: string;
  updatedAt: string;
  cwd?: string;
  projectLabel?: string;
  autonomy: MissionAutonomy;
  autonomySource?: "settings at mission creation" | "user override";
  allowFullAutoAtCreation?: boolean;
  continueAcrossMilestones?: boolean;
  pauseBetweenMilestones?: boolean;
  currentMilestoneIndex: number;
  milestones: MissionMilestone[];
  checkpoints: MissionCheckpoint[];
  clarificationQuestions?: ClarificationQuestion[];
  clarificationAnswers?: ClarificationAnswer[];
  planText?: string;
  currentStep?: string;
  reviewerReport?: string;
  reviewerVerdict?: "PASS" | "NOTES" | "NEEDS REPAIR" | "FAIL" | "BLOCKED" | "UNKNOWN";
  currentReviewRetry?: number;
  missionReviewRetryCount?: number;
  maxReviewRetriesPerMission?: number;
  lastReviewFailure?: string;
  lastReviewAttempt?: string;
  lastReviewRepairStatus?: "none" | "running" | "completed" | "failed" | "blocked";
  reviewHistory?: WorkflowReviewHistoryEntry[];
  reviewRepairInProgress?: boolean;
  lastValidationResult?: string;
  modelsUsed: Record<string, string>;
  subagentsUsed: string[];
  approvalRequired: boolean;
  lastSummary: string;
  lastStopReason?: string;
  lastBlockReason?: string;
  nextAction?: string;
  lastHeartbeatAt?: string;
  lastProgressAt?: string;
  heartbeatCount?: number;
  activeRuntimeMs?: number;
  activeRunStartedAt?: string | null;
  lastPausedAt?: string;
  lastResumedAt?: string;
  lastStoppedAt?: string;
  completedAt?: string;
  runtimeSegments?: MissionRuntimeSegment[];
  currentValidationRetry?: number;
  missionValidationRetryCount?: number;
  maxValidationRetriesPerMilestone?: number;
  maxValidationRetriesPerMission?: number;
  lastValidationFailure?: string;
  lastRepairAttempt?: string;
  repairHistory?: MissionRepairHistoryEntry[];
  lastRepairStatus?: "none" | "running" | "completed" | "failed" | "blocked";
  finalValidationRetryCount?: number;
  maxFinalValidationRetries?: number;
  lastFinalValidationResult?: string;
  lastFinalValidationFailure?: string;
}

export const WORKFLOW_DIR = join(getAgentDir(), "workflows");
export const ACTIVE_STATE_FILE = join(WORKFLOW_DIR, "active.json");
export const PLAN_HISTORY_DIR = join(WORKFLOW_DIR, "plans");
export const LATEST_PLAN_FILE = join(PLAN_HISTORY_DIR, "latest.json");
export const MISSION_HISTORY_DIR = join(WORKFLOW_DIR, "missions");
export const LATEST_MISSION_FILE = join(MISSION_HISTORY_DIR, "latest.json");

export function emptyState(): WorkflowState {
  return { version: 1, mode: "idle", updatedAt: new Date().toISOString() };
}

export function loadState(): WorkflowState {
  try {
    if (!existsSync(ACTIVE_STATE_FILE)) return emptyState();
    const parsed = JSON.parse(readFileSync(ACTIVE_STATE_FILE, "utf8")) as WorkflowState;
    return { ...emptyState(), ...parsed, version: 1 };
  } catch {
    return emptyState();
  }
}

export function saveState(state: WorkflowState, options: { alreadyAccounted?: boolean } = {}): WorkflowState {
  mkdirSync(WORKFLOW_DIR, { recursive: true });
  const savedAt = new Date();
  const previous = readExistingWorkflowState();
  const accounted = options.alreadyAccounted ? state : applyStandardRuntimeAccounting(previous, applyPlanRuntimeAccounting(previous, state, savedAt), savedAt);
  const next = { ...accounted, version: 1 as const, updatedAt: savedAt.toISOString() };
  writeFileSync(ACTIVE_STATE_FILE, JSON.stringify(next, null, 2) + "\n", "utf8");
  return next;
}

export function resetState(): WorkflowState {
  return saveState(emptyState());
}

function redactSecrets(text: string | undefined): string | undefined {
  if (!text) return text;
  return text
    .replace(/\b([A-Za-z0-9_]*?(?:API|TOKEN|SECRET|KEY|PASSWORD)[A-Za-z0-9_]*?\s*[:=]\s*)([^\s'\"]+)/gi, "$1[REDACTED]")
    .replace(/\b(sk-[A-Za-z0-9_-]{12,})\b/g, "[REDACTED]")
    .replace(/\b(xox[baprs]-[A-Za-z0-9-]{12,})\b/g, "[REDACTED]")
    .replace(/\b(gh[pousr]_[A-Za-z0-9_]{12,})\b/g, "[REDACTED]");
}

function redactQuestion(q: ClarificationQuestion): ClarificationQuestion {
  return {
    ...q,
    question: redactSecrets(q.question) ?? q.question,
    options: q.options.map((option) => redactSecrets(option) ?? option),
  };
}

function redactAnswer(a: ClarificationAnswer): ClarificationAnswer {
  return { ...a, custom: redactSecrets(a.custom) };
}

function workflowProjectSlug(cwd: string): string {
  return basename(cwd).replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "project";
}

function safePlanId(timestamp: string, cwd: string): string {
  return `${timestamp.replace(/[:.]/g, "").replace(/[^0-9TZ-]/g, "")}-${workflowProjectSlug(cwd)}`;
}

function planTimestampId(date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `plan-${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

function standardTimestampId(date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `standard-${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

export function createStandardRuntimeId(cwd: string): string {
  return `${standardTimestampId()}-${workflowProjectSlug(cwd)}`;
}

export function createWorkflowPlanId(cwd: string): string {
  mkdirSync(PLAN_HISTORY_DIR, { recursive: true });
  const timestamp = planTimestampId();
  const project = workflowProjectSlug(cwd);
  let id = `${timestamp}-${project}`;
  let suffix = 1;
  while (existsSync(join(PLAN_HISTORY_DIR, `${id}.json`))) {
    id = `${timestamp}-${project}-${suffix++}`;
  }
  return id;
}

export function saveWorkflowPlan(state: WorkflowState, options: PlanSavingOptions): SavedWorkflowPlan | undefined {
  const finalPlan = state.approvedPlan ?? state.draftPlan;
  if (!finalPlan?.trim()) return undefined;

  mkdirSync(PLAN_HISTORY_DIR, { recursive: true });
  const timestamp = new Date().toISOString();
  const record: SavedWorkflowPlan = {
    id: state.activePlanId ?? safePlanId(timestamp, options.cwd),
    timestamp,
    projectPath: options.cwd,
    projectLabel: basename(options.cwd) || options.cwd,
    planningMode: state.mode,
    planningDepth: options.planningDepth ?? state.planningDepth,
    clarificationMode: options.clarificationMode ?? state.clarificationMode,
    originalTask: redactSecrets(state.originalTask ?? state.task),
    clarificationQuestions: state.clarifyingQuestions?.map(redactQuestion),
    clarificationAnswers: state.clarifyingAnswers?.map(redactAnswer),
    finalPlan: redactSecrets(finalPlan) ?? finalPlan,
    approvalStatus: options.approvalStatus,
    saveReason: options.saveReason,
    validationVerdict: state.validationVerdict,
    validationReport: redactSecrets(compact(options.validationReport ?? state.validationReport, 2400)) ?? compact(options.validationReport ?? state.validationReport, 2400),
    executionSummary: redactSecrets(compact(options.executionSummary ?? state.executionSummary, 2400)) ?? compact(options.executionSummary ?? state.executionSummary, 2400),
    reviewerReport: redactSecrets(compact(options.reviewerReport ?? state.reviewerReport, 1600)) ?? compact(options.reviewerReport ?? state.reviewerReport, 1600),
    repairStatus: state.lastRepairStatus,
    repairAttempt: redactSecrets(compact(options.repairAttempt ?? state.lastRepairAttempt, 1800)) ?? compact(options.repairAttempt ?? state.lastRepairAttempt, 1800),
    finalReport: options.finalReport?.trim() ? (redactSecrets(compact(options.finalReport, 5000)) ?? compact(options.finalReport, 5000)) : undefined,
    modelsUsed: state.modelsUsed,
    subagents: options.subagents,
  };

  writeFileSync(LATEST_PLAN_FILE, JSON.stringify(record, null, 2) + "\n", { encoding: "utf8", mode: 0o600 });
  if (options.savePlanHistory !== false) {
    writeFileSync(join(PLAN_HISTORY_DIR, `${record.id}.json`), JSON.stringify(record, null, 2) + "\n", { encoding: "utf8", mode: 0o600 });
    clearOldWorkflowPlans(options.planHistoryLimit ?? 50);
  }
  return record;
}

export function listWorkflowPlans(): SavedWorkflowPlan[] {
  if (!existsSync(PLAN_HISTORY_DIR)) return [];
  const plans: SavedWorkflowPlan[] = [];
  for (const entry of readdirSync(PLAN_HISTORY_DIR, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith(".json") || entry.name === "latest.json") continue;
    try {
      plans.push(JSON.parse(readFileSync(join(PLAN_HISTORY_DIR, entry.name), "utf8")) as SavedWorkflowPlan);
    } catch { /* skip unreadable plan */ }
  }
  return plans.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

export function loadWorkflowPlan(id: string): SavedWorkflowPlan | undefined {
  const file = id === "latest" ? LATEST_PLAN_FILE : join(PLAN_HISTORY_DIR, `${id.replace(/\.json$/i, "")}.json`);
  try {
    if (!existsSync(file)) return undefined;
    return JSON.parse(readFileSync(file, "utf8")) as SavedWorkflowPlan;
  } catch {
    return undefined;
  }
}

export function clearOldWorkflowPlans(limit = 50): number {
  const safeLimit = Math.max(1, Math.min(500, Math.floor(limit)));
  const plans = listWorkflowPlans();
  let removed = 0;
  for (const plan of plans.slice(safeLimit)) {
    try {
      unlinkSync(join(PLAN_HISTORY_DIR, `${plan.id}.json`));
      removed++;
    } catch { /* ignore */ }
  }
  return removed;
}

function missionTimestampId(date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `mission-${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

export function createMissionState(goal: string, options: { cwd: string; autonomy: MissionAutonomy; autonomySource?: MissionState["autonomySource"]; allowFullAutoAtCreation?: boolean; continueAcrossMilestones?: boolean; pauseBetweenMilestones?: boolean; maxValidationRetriesPerMilestone?: number; maxValidationRetriesPerMission?: number }): MissionState {
  mkdirSync(MISSION_HISTORY_DIR, { recursive: true });
  const missionIdBase = `${missionTimestampId()}-${workflowProjectSlug(options.cwd)}`;
  let id = missionIdBase;
  let suffix = 1;
  while (existsSync(join(MISSION_HISTORY_DIR, `${id}.json`))) {
    id = `${missionIdBase}-${suffix++}`;
  }
  const timestamp = new Date().toISOString();
  return {
    version: 1,
    id,
    status: "draft",
    goal: redactSecrets(goal) ?? goal,
    createdAt: timestamp,
    updatedAt: timestamp,
    cwd: options.cwd,
    projectLabel: basename(options.cwd) || options.cwd,
    autonomy: options.autonomy,
    autonomySource: options.autonomySource ?? "settings at mission creation",
    allowFullAutoAtCreation: options.allowFullAutoAtCreation === true,
    continueAcrossMilestones: options.continueAcrossMilestones !== false,
    pauseBetweenMilestones: options.pauseBetweenMilestones === true,
    currentMilestoneIndex: 0,
    milestones: [],
    checkpoints: [],
    clarificationQuestions: [],
    clarificationAnswers: [],
    modelsUsed: {},
    subagentsUsed: [],
    currentReviewRetry: 0,
    missionReviewRetryCount: 0,
    lastReviewFailure: "",
    lastReviewAttempt: "",
    lastReviewRepairStatus: "none",
    reviewHistory: [],
    reviewRepairInProgress: false,
    approvalRequired: true,
    lastSummary: "Mission created. Generate or approve a milestone plan before running.",
    lastStopReason: "",
    lastBlockReason: "",
    nextAction: "Generate milestone plan, then approve before running.",
    lastHeartbeatAt: timestamp,
    lastProgressAt: timestamp,
    heartbeatCount: 0,
    activeRuntimeMs: 0,
    activeRunStartedAt: null,
    runtimeSegments: [],
    currentValidationRetry: 0,
    missionValidationRetryCount: 0,
    maxValidationRetriesPerMilestone: options.maxValidationRetriesPerMilestone ?? 2,
    maxValidationRetriesPerMission: options.maxValidationRetriesPerMission ?? 8,
    lastValidationFailure: "",
    lastRepairAttempt: "",
    repairHistory: [],
    lastRepairStatus: "none",
  };
}

function readExistingMissionState(id: string): MissionState | undefined {
  const safeId = id.replace(/\.json$/i, "").replace(/[^A-Za-z0-9._-]/g, "");
  const file = join(MISSION_HISTORY_DIR, `${safeId}.json`);
  try {
    if (!existsSync(file)) return undefined;
    return JSON.parse(readFileSync(file, "utf8")) as MissionState;
  } catch {
    return undefined;
  }
}

export function isMissionRuntimeActiveStatus(status?: MissionStatus): boolean {
  return status === "planning" || status === "running" || status === "validating" || status === "repairing" || status === "revalidating" || status === "checkpointing";
}

function runtimeEndReason(status: MissionStatus): MissionRuntimeSegment["reasonEnded"] {
  if (status === "paused") return "paused";
  if (status === "blocked") return "blocked";
  if (status === "stopped") return "stopped";
  if (status === "completed") return "completed";
  if (status === "failed") return "failed";
  if (status === "draft" || status === "awaiting_clarification" || status === "planned" || status === "approved") return "waiting";
  return "status_change";
}

function safeRuntimeMs(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

function readExistingWorkflowState(): WorkflowState | undefined {
  try {
    if (!existsSync(ACTIVE_STATE_FILE)) return undefined;
    return JSON.parse(readFileSync(ACTIVE_STATE_FILE, "utf8")) as WorkflowState;
  } catch {
    return undefined;
  }
}

export function isPlanRuntimeActiveMode(mode?: WorkflowMode): boolean {
  return mode === "planning" || mode === "reviewing" || mode === "executing" || mode === "validating" || mode === "repairing" || mode === "revalidating";
}

export function planRuntimeCounterState(state: WorkflowState): "running" | "paused" | "stopped" {
  if (state.mode === "idle" || state.mode === "cancelled") return "stopped";
  if (isPlanRuntimeActiveMode(state.mode)) return "running";
  return "paused";
}

export function isStandardRuntimeActive(state?: WorkflowState): boolean {
  return state?.mode === "standard" && state.standardRuntime?.active === true;
}

export function standardRuntimeCounterState(state: WorkflowState): "running" | "paused" | "stopped" {
  if (state.mode === "idle" || state.mode === "cancelled") return "stopped";
  if (isStandardRuntimeActive(state)) return "running";
  if (state.standardRuntime) return "paused";
  return "stopped";
}

const RUNTIME_SESSION_STARTED_AT_MS = Date.now();

function elapsedMs(startedAt: string | null | undefined, endedAtMs: number): number {
  const parsed = Date.parse(startedAt ?? "");
  return Number.isFinite(parsed) ? Math.max(0, endedAtMs - parsed) : 0;
}

function activeElapsedMs(startedAt: string | null | undefined, nowMs: number, lastUpdatedAt?: string): number {
  const parsed = Date.parse(startedAt ?? "");
  if (!Number.isFinite(parsed)) return 0;
  const updated = Date.parse(lastUpdatedAt ?? "");
  const end = parsed < RUNTIME_SESSION_STARTED_AT_MS && Number.isFinite(updated) && updated < RUNTIME_SESSION_STARTED_AT_MS
    ? Math.max(parsed, updated)
    : nowMs;
  return Math.max(0, end - parsed);
}

export function applyPlanRuntimeAccounting(previous: WorkflowState | undefined, state: WorkflowState, now = new Date()): WorkflowState {
  const counter = planRuntimeCounterState(state);
  if (counter === "stopped" && !state.planRuntime) return state;

  const nowIso = now.toISOString();
  const nowMs = now.getTime();
  const currentRuntime = state.planRuntime;
  const previousRuntime = currentRuntime ? previous?.planRuntime : undefined;
  const createdAt = currentRuntime?.createdAt ?? previousRuntime?.createdAt ?? nowIso;
  const baseRuntimeMs = safeRuntimeMs(currentRuntime?.activeRuntimeMs ?? previousRuntime?.activeRuntimeMs);
  const previousStartedAt = previousRuntime?.activeRunStartedAt ?? currentRuntime?.activeRunStartedAt ?? null;
  const previousActive = isPlanRuntimeActiveMode(previous?.mode);
  const nextActive = isPlanRuntimeActiveMode(state.mode);

  let activeRuntimeMs = baseRuntimeMs;
  let activeRunStartedAt = currentRuntime?.activeRunStartedAt ?? previousStartedAt ?? null;

  if (previousActive && !nextActive && previousStartedAt) {
    activeRuntimeMs = baseRuntimeMs + activeElapsedMs(previousStartedAt, nowMs, previous?.updatedAt);
    activeRunStartedAt = null;
  } else if (nextActive && !previousStartedAt) {
    activeRunStartedAt = nowIso;
  } else if (nextActive && previousStartedAt) {
    activeRunStartedAt = previousStartedAt;
  } else if (!nextActive) {
    activeRunStartedAt = null;
  }

  return {
    ...state,
    planRuntime: {
      createdAt,
      activeRuntimeMs,
      activeRunStartedAt,
      lastProgressAt: nextActive ? nowIso : (currentRuntime?.lastProgressAt ?? previousRuntime?.lastProgressAt ?? nowIso),
      runtimeCounter: counter,
    },
  };
}

export function planActiveRuntimeMs(state: WorkflowState, now = new Date()): number {
  const runtime = state.planRuntime;
  const base = safeRuntimeMs(runtime?.activeRuntimeMs);
  if (!runtime || !isPlanRuntimeActiveMode(state.mode)) return base;
  return base + activeElapsedMs(runtime.activeRunStartedAt, now.getTime(), state.updatedAt);
}

export function planWallClockAgeMs(state: WorkflowState, now = new Date()): number {
  const start = Date.parse(state.planRuntime?.createdAt ?? "");
  if (!Number.isFinite(start)) return 0;
  return Math.max(0, now.getTime() - start);
}

export function applyStandardRuntimeAccounting(previous: WorkflowState | undefined, state: WorkflowState, now = new Date()): WorkflowState {
  const counter = standardRuntimeCounterState(state);
  if (counter === "stopped" && !state.standardRuntime) return state;

  const nowIso = now.toISOString();
  const nowMs = now.getTime();
  const currentRuntime = state.standardRuntime;
  const previousRuntime = currentRuntime ? previous?.standardRuntime : undefined;
  const id = currentRuntime?.id ?? previousRuntime?.id ?? createStandardRuntimeId(process.cwd());
  const createdAt = currentRuntime?.createdAt ?? previousRuntime?.createdAt ?? nowIso;
  const baseRuntimeMs = safeRuntimeMs(currentRuntime?.activeRuntimeMs ?? previousRuntime?.activeRuntimeMs);
  const previousStartedAt = previousRuntime?.activeRunStartedAt ?? currentRuntime?.activeRunStartedAt ?? null;
  const previousActive = isStandardRuntimeActive(previous);
  const nextActive = isStandardRuntimeActive(state);

  let activeRuntimeMs = baseRuntimeMs;
  let activeRunStartedAt = currentRuntime?.activeRunStartedAt ?? previousStartedAt ?? null;

  if (previousActive && !nextActive && previousStartedAt) {
    activeRuntimeMs = baseRuntimeMs + activeElapsedMs(previousStartedAt, nowMs, previous?.updatedAt);
    activeRunStartedAt = null;
  } else if (nextActive && !previousStartedAt) {
    activeRunStartedAt = nowIso;
  } else if (nextActive && previousStartedAt) {
    activeRunStartedAt = previousStartedAt;
  } else if (!nextActive) {
    activeRunStartedAt = null;
  }

  return {
    ...state,
    standardRuntime: {
      id,
      createdAt,
      active: nextActive,
      activeRuntimeMs,
      activeRunStartedAt,
      lastProgressAt: nextActive ? nowIso : (currentRuntime?.lastProgressAt ?? previousRuntime?.lastProgressAt ?? nowIso),
      runtimeCounter: counter,
    },
  };
}

export function standardActiveRuntimeMs(state: WorkflowState, now = new Date()): number {
  const runtime = state.standardRuntime;
  const base = safeRuntimeMs(runtime?.activeRuntimeMs);
  if (!runtime || !isStandardRuntimeActive(state)) return base;
  return base + activeElapsedMs(runtime.activeRunStartedAt, now.getTime(), state.updatedAt);
}

export function standardWallClockAgeMs(state: WorkflowState, now = new Date()): number {
  const start = Date.parse(state.standardRuntime?.createdAt ?? "");
  if (!Number.isFinite(start)) return 0;
  return Math.max(0, now.getTime() - start);
}

export function applyMissionRuntimeAccounting(previous: MissionState | undefined, mission: MissionState, now = new Date()): MissionState {
  const nowIso = now.toISOString();
  const nowMs = now.getTime();
  const previousActive = isMissionRuntimeActiveStatus(previous?.status);
  const nextActive = isMissionRuntimeActiveStatus(mission.status);
  const previousStartedAt = previous?.activeRunStartedAt ?? mission.activeRunStartedAt ?? null;
  const baseRuntimeMs = safeRuntimeMs(mission.activeRuntimeMs ?? previous?.activeRuntimeMs);
  const baseSegments = mission.runtimeSegments ?? previous?.runtimeSegments ?? [];
  let next: MissionState = {
    ...mission,
    activeRuntimeMs: baseRuntimeMs,
    activeRunStartedAt: mission.activeRunStartedAt ?? previousStartedAt ?? null,
    runtimeSegments: baseSegments,
  };

  if (previousActive && !nextActive && previousStartedAt) {
    const durationMs = activeElapsedMs(previousStartedAt, nowMs, previous?.updatedAt);
    next = {
      ...next,
      activeRuntimeMs: baseRuntimeMs + durationMs,
      activeRunStartedAt: null,
      runtimeSegments: [...baseSegments, { startedAt: previousStartedAt, endedAt: nowIso, durationMs, reasonEnded: runtimeEndReason(mission.status) }].slice(-100),
    };
  } else if (nextActive && !previousStartedAt) {
    next = {
      ...next,
      activeRunStartedAt: nowIso,
      lastResumedAt: mission.lastResumedAt ?? nowIso,
    };
  } else if (nextActive && previousStartedAt) {
    next = { ...next, activeRunStartedAt: previousStartedAt };
  } else if (!nextActive) {
    next = { ...next, activeRunStartedAt: null };
  }

  if (mission.status === "paused" && previous?.status !== "paused") next.lastPausedAt = mission.lastPausedAt ?? nowIso;
  if (mission.status === "stopped" && previous?.status !== "stopped") next.lastStoppedAt = mission.lastStoppedAt ?? nowIso;
  if (mission.status === "completed") next.completedAt = mission.completedAt ?? next.completedAt ?? mission.updatedAt ?? nowIso;
  return next;
}

export function missionActiveRuntimeMs(mission: MissionState, now = new Date()): number {
  const base = safeRuntimeMs(mission.activeRuntimeMs);
  if (!isMissionRuntimeActiveStatus(mission.status)) return base;
  return base + activeElapsedMs(mission.activeRunStartedAt, now.getTime(), mission.updatedAt);
}

export function missionWallClockAgeMs(mission: MissionState, now = new Date()): number {
  const start = Date.parse(mission.createdAt ?? "");
  if (!Number.isFinite(start)) return 0;
  const terminalTimestamp = mission.completedAt ?? (mission.status === "completed" ? mission.updatedAt : undefined);
  const end = terminalTimestamp ? Date.parse(terminalTimestamp) : now.getTime();
  return Math.max(0, (Number.isFinite(end) ? end : now.getTime()) - start);
}

export function missionRuntimeCounterState(mission: MissionState): "running" | "paused" | "blocked" | "stopped" | "completed" | "failed" | "waiting" {
  if (isMissionRuntimeActiveStatus(mission.status)) return "running";
  if (mission.status === "paused") return "paused";
  if (mission.status === "blocked") return "blocked";
  if (mission.status === "stopped") return "stopped";
  if (mission.status === "completed") return "completed";
  if (mission.status === "failed") return "failed";
  return "waiting";
}

export function saveMissionState(mission: MissionState): MissionState {
  mkdirSync(MISSION_HISTORY_DIR, { recursive: true });
  const savedAt = new Date();
  const accounted = applyMissionRuntimeAccounting(readExistingMissionState(mission.id), mission, savedAt);
  const next = { ...accounted, version: 1 as const, updatedAt: savedAt.toISOString() };
  const content = JSON.stringify(next, null, 2) + "\n";
  writeFileSync(join(MISSION_HISTORY_DIR, `${next.id}.json`), content, { encoding: "utf8", mode: 0o600 });
  writeFileSync(LATEST_MISSION_FILE, content, { encoding: "utf8", mode: 0o600 });
  return next;
}

export function loadMissionState(id = "latest"): MissionState | undefined {
  const safeId = id === "latest" ? "latest" : id.replace(/\.json$/i, "").replace(/[^A-Za-z0-9._-]/g, "");
  const file = safeId === "latest" ? LATEST_MISSION_FILE : join(MISSION_HISTORY_DIR, `${safeId}.json`);
  try {
    if (!existsSync(file)) return undefined;
    const parsed = JSON.parse(readFileSync(file, "utf8")) as MissionState;
    return { ...parsed, version: 1 };
  } catch {
    return undefined;
  }
}

export function listMissionStates(): MissionState[] {
  if (!existsSync(MISSION_HISTORY_DIR)) return [];
  const missions: MissionState[] = [];
  for (const entry of readdirSync(MISSION_HISTORY_DIR, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith(".json") || entry.name === "latest.json") continue;
    try {
      missions.push(JSON.parse(readFileSync(join(MISSION_HISTORY_DIR, entry.name), "utf8")) as MissionState);
    } catch { /* skip unreadable mission */ }
  }
  return missions.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function addMissionCheckpoint(mission: MissionState, summary: string, nextAction: string, milestoneId?: string, details: { filesChanged?: string[]; validationResult?: string; errors?: string[] } = {}): MissionState {
  const id = `C${String((mission.checkpoints?.length ?? 0) + 1).padStart(4, "0")}`;
  const checkpoint: MissionCheckpoint = {
    id,
    timestamp: new Date().toISOString(),
    status: mission.status,
    milestoneId,
    summary: redactSecrets(summary) ?? summary,
    nextAction: redactSecrets(nextAction) ?? nextAction,
    filesChanged: details.filesChanged?.map((file) => redactSecrets(file) ?? file),
    validationResult: redactSecrets(details.validationResult) ?? details.validationResult,
    errors: details.errors?.map((error) => redactSecrets(error) ?? error),
  };
  const milestones = mission.milestones.map((milestone) => milestone.id === milestoneId
    ? { ...milestone, checkpointIds: [...(milestone.checkpointIds ?? []), id] }
    : milestone);
  return saveMissionState({ ...mission, milestones, checkpoints: [...(mission.checkpoints ?? []), checkpoint], lastSummary: checkpoint.summary });
}

export function compact(text: string | undefined, max = 1400): string {
  if (!text) return "(none)";
  const trimmed = text.trim();
  return trimmed.length <= max ? trimmed : `${trimmed.slice(0, max)}\n...`;
}

export function extractVerdict(report: string): WorkflowState["validationVerdict"] {
  const verdictPatterns = [
    /#{1,6}\s*(?:Final\s+)?Verdict\s*\n\s*(?:\*\*)?\s*(PARTIAL PASS|PASS|FAIL)\b/gi,
    /\b(?:Final\s+)?Verdict\s*:\s*(PARTIAL PASS|PASS|FAIL)\b/gi,
    /\bMilestone\s+Revalidation\b[\s\S]{0,400}?\bVerdict\s*:\s*(PARTIAL PASS|PASS|FAIL)\b/gi,
  ];
  const matches: Array<{ index: number; verdict: WorkflowState["validationVerdict"] }> = [];
  for (const pattern of verdictPatterns) {
    for (const match of report.matchAll(pattern)) {
      if (match.index === undefined || !match[1]) continue;
      matches.push({ index: match.index, verdict: match[1].toUpperCase() as WorkflowState["validationVerdict"] });
    }
  }
  if (matches.length > 0) return matches.sort((a, b) => b.index - a.index)[0].verdict;
  const upper = report.toUpperCase();
  if (/\bPARTIAL PASS\b/.test(upper)) return "PARTIAL PASS";
  if (/\bFAIL\b/.test(upper)) return "FAIL";
  if (/\bPASS\b/.test(upper)) return "PASS";
  return "UNKNOWN";
}

// No-op default export so this helper module can be safely auto-discovered as a Pi extension.
export default function workflowSuiteNoopExtension(): void {}
