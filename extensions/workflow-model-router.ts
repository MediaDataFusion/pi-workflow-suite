import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { getAgentDir, type ExtensionAPI, type ExtensionContext } from "@earendil-works/pi-coding-agent";

export type WorkflowRole = "planner" | "executor" | "validator" | "reviewer";
export type MissionModelRole = WorkflowRole;
export type ThinkingLevel = "off" | "minimal" | "low" | "medium" | "high" | "xhigh";
export type WorkflowSettingsScope = "global" | "project";

export interface RoleModelSettings {
  enabled: boolean;
  provider: string | null;
  model: string | null;
  thinkingLevel: ThinkingLevel;
  askBeforeRun?: boolean;
}

export type PlanningClarificationMode = "auto" | "always_for_nontrivial" | "never";
export type PlanningDepth = "fast" | "standard" | "deep" | "maximum";
export type ClarificationTiming = "immediate" | "after_initial_analysis";
export type SubagentPolicy = "off" | "auto" | "deep" | "maximum" | "forced";
export type SubagentPlanningPolicy = SubagentPolicy;
export type EditConcurrencyMode = "sequential" | "scoped" | "blocked";
export type PlanningOrchestrationPolicy = "off" | "auto" | "orchestrator_first" | "forced_orchestrated";
export type CompactionMode = "pi_default" | "custom_model" | "custom_agent" | "disabled";
export type WorkflowCompactionCheckMode = "boundary" | "in_session";
export type StandardTodoTriggerMode = "off" | "manual" | "auto" | "required";
export type StandardClarificationMode = PlanningClarificationMode | "off" | "minimal";
export type StandardModelRole = "current" | WorkflowRole;
export type StandardModelSource = "current" | "shared" | "standard_specific";
export type WorkflowAgentScope = "user" | "project" | "both";
export type MissionAutonomy = "manual" | "approval_gated" | "supervised_auto" | "full_auto";
export type ValidationRetryMode = "off" | "safe_only" | "aggressive_within_scope";
export type WorkflowStartupVisual = "none" | "minimal" | "diagnostic_center" | "workflow_duo" | "mission_control" | "data_stream" | "neural_grid" | "custom_brand";
export type WorkflowStartupLogo = "none" | "pi" | "custom";
export type WorkflowStartupLogoFont = "block" | "shadow" | "outline" | "wide" | "double" | "three_d" | "solid";
export type WorkflowStartupLogoShadowDirection = "down_right" | "down" | "up" | "left" | "right";
export type WorkflowStartupLogoColorStyle = "theme" | "primary" | "split";
export type WorkflowWidgetTextPreset = "normal" | "bold" | "light" | "rich" | "italic" | "underline" | "terminal" | "smallcaps" | "typewriter";
export type CustomBrandBaseVisual = "minimal" | "diagnostic_center" | "workflow_duo" | "mission_control" | "data_stream" | "neural_grid";
export type RepairRetryGateName = "review" | "validation" | "missionValidation" | "missionFinalValidation";

export interface RepairRetryGateSettings {
  autoRepairFailures?: boolean;
  retryMode?: ValidationRetryMode;
  maxRetriesPerItem?: number;
  maxRetriesPerWorkflow?: number;
  pauseAfterFailure?: boolean;
  requireApprovalForOutOfScopeRepair?: boolean;
  requireApprovalForDestructiveRepair?: boolean;
}

export interface RepairRetrySettings {
  enabled?: boolean;
  maxTotalRetries?: number;
  defaults?: RepairRetryGateSettings;
  gates?: Partial<Record<RepairRetryGateName, RepairRetryGateSettings>>;
}

export interface WorkflowSubagentSettings {
  enabled: boolean;
  requireApprovalBeforeRun: boolean;
  activityIndicatorEnabled?: boolean;
  autoUseDuringPlanning?: boolean;
  autoUseDuringExecution?: boolean;
  autoUseDuringRepair?: boolean;
  autoUseDuringReview?: boolean;
  autoUseDuringValidation?: boolean;
  planningPolicy?: SubagentPolicy;
  executionPolicy?: SubagentPolicy;
  repairPolicy?: SubagentPolicy;
  reviewPolicy?: SubagentPolicy;
  validationPolicy?: SubagentPolicy;
  minPlanningWorkersForDeep?: number;
  minPlanningWorkersForMaximum?: number;
  minExecutionWorkersForDeep?: number;
  minExecutionWorkersForMaximum?: number;
  minRepairWorkersForDeep?: number;
  minRepairWorkersForMaximum?: number;
  minReviewWorkersForDeep?: number;
  minReviewWorkersForMaximum?: number;
  minValidationWorkersForDeep?: number;
  minValidationWorkersForMaximum?: number;
  allowParallelReadOnly?: boolean;
  allowParallelPlanning?: boolean;
  allowParallelExecution?: boolean;
  allowParallelRepair?: boolean;
  allowParallelReview?: boolean;
  allowParallelValidation?: boolean;
  allowParallelEdits?: boolean;
  editConcurrencyMode?: EditConcurrencyMode;
  requireParallelEditConflictProtection?: boolean;
  planningOrchestrationPolicy?: PlanningOrchestrationPolicy;
  subagentTimeoutMinutes?: number;
  subagentStaleMinutes?: number;
  allowBackgroundSubagents?: boolean;
}

export interface WorkflowSettings {
  models: Record<WorkflowRole, RoleModelSettings>;
  planning: {
    clarificationMode: PlanningClarificationMode;
    maxClarificationQuestions: number;
    interactiveClarificationEnabled: boolean;
    depth: PlanningDepth;
    clarificationTiming?: ClarificationTiming;
    clarificationQualityGate?: boolean;
    allowClarificationWithoutAnalysis?: boolean;
    useSubagentsBeforeClarification?: boolean;
    maxTokens?: number;
    maxRuntimeHours?: number;
  };
  workflow: {
    requirePlanApprovalBeforeExecute: boolean;
    requireApprovalBeforeExecution?: boolean;
    requireApprovalPerStep?: boolean;
    offerValidationAfterExecute: boolean;
    autoRunValidationAfterExecute: boolean;
    validateAfterExecution?: boolean;
    validateAfterEachStep?: boolean;
    offerReviewerBeforeExecute: boolean;
    autoRunReviewerBeforeExecute: boolean;
    allowPlanRevisionBeforeExecute: boolean;
    autoRepairReviewFailures?: boolean;
    maxReviewRetriesPerPlan?: number;
    maxReviewRetriesPerWorkflow?: number;
    reviewRetryMode?: ValidationRetryMode;
    pauseAfterReviewFailure?: boolean;
    executionChecklistEnabled?: boolean;
    returnToPlanModeAfterWorkflow?: boolean;
    autoRepairValidationFailures?: boolean;
    validationRetryMode?: ValidationRetryMode;
    maxValidationRetriesPerPlan?: number;
    maxValidationRetriesPerWorkflow?: number;
    pauseAfterValidationFailure?: boolean;
    requireApprovalForOutOfScopeRepair?: boolean;
    requireApprovalForDestructiveRepair?: boolean;
    repairRetry?: RepairRetrySettings;
    savePlans?: boolean;
    savePlanHistory?: boolean;
    planHistoryLimit?: number;
    planProgressEnabled?: boolean;
    planRuntimeEnabled?: boolean;
    planShowProgressBar?: boolean;
  };
  standard: {
    enabled: boolean;
    autoTodoEnabled?: boolean;
    todoProgressVisible?: boolean;
    todoTriggerMode?: StandardTodoTriggerMode;
    clarificationEnabled?: boolean;
    clarificationMode?: StandardClarificationMode;
    maxClarificationQuestions?: number;
    interactiveClarificationEnabled?: boolean;
    clarificationTiming?: ClarificationTiming;
    clarificationQualityGate?: boolean;
    allowClarificationWithoutAnalysis?: boolean;
    useSubagentsBeforeClarification?: boolean;
    allowSubagents?: boolean;
    subagentScope?: WorkflowAgentScope;
    subagents?: Partial<WorkflowSubagentSettings>;
    statusWidgetVisible?: boolean;
    useSharedExecutorModel?: boolean;
    useStandardSpecificModels?: boolean;
    modelRole?: StandardModelRole;
    models?: Record<WorkflowRole, RoleModelSettings>;
    maxTokens?: number;
  };
  missions: {
    enabled: boolean;
    defaultAutonomy: MissionAutonomy;
    maxRuntimeHours: number;
    maxTokens?: number;
    checkpointIntervalMinutes: number;
    requireApprovalForDestructiveActions: boolean;
    requireValidationPerMilestone: boolean;
    autoResume: boolean;
    allowFullAuto: boolean;
    autoRunAfterApproval?: boolean;
    offerReviewerBeforeApprove?: boolean;
    autoRunReviewerBeforeApprove?: boolean;
    autoRepairReviewFailures?: boolean;
    reviewRetryMode?: ValidationRetryMode;
    maxReviewRetriesPerMission?: number;
    continueAcrossMilestones?: boolean;
    pauseBetweenMilestones?: boolean;
    progressWidgetEnabled?: boolean;
    progressOutputMode?: "compact" | "detailed";
    showProgressBar?: boolean;
    missionHistoryLimit?: number;
    heartbeatEnabled?: boolean;
    watchdogEnabled?: boolean;
    watchdogStaleMinutes?: number;
    autoRepairValidationFailures?: boolean;
    maxValidationRetriesPerMilestone?: number;
    maxValidationRetriesPerMission?: number;
    validationRetryMode?: ValidationRetryMode;
    pauseAfterValidationFailure?: boolean;
    requireApprovalForOutOfScopeRepair?: boolean;
    requireApprovalForDestructiveRepair?: boolean;
    finalValidationEnabled?: boolean;
    finalValidationRequiresPass?: boolean;
    autoRepairFinalValidationFailures?: boolean;
    maxFinalValidationRetries?: number;
    clarificationMode?: PlanningClarificationMode;
    interactiveClarificationEnabled?: boolean;
    maxClarificationQuestions?: number;
    planningDepth?: PlanningDepth;
    clarificationTiming?: ClarificationTiming;
    clarificationQualityGate?: boolean;
    allowClarificationWithoutAnalysis?: boolean;
    useSubagentsBeforeClarification?: boolean;
    subagentPolicy?: SubagentPolicy;
    minWorkersForDeep?: number;
    minWorkersForMaximum?: number;
    useMissionSpecificModels?: boolean;
    models?: Record<MissionModelRole, RoleModelSettings>;
  };
  safety: {
    repoLockEnabled?: boolean;
    disableBashInPlanMode: boolean;
    disableBashInValidatorMode: boolean;
    blockDestructiveCommands: boolean;
    allowPackageInstallInExecution: boolean;
  };
  ui: {
    showWorkflowStatus: boolean;
    showPlanModeIndicator?: boolean;
    planModeIndicatorText?: string;
    enableHotkeys: boolean;
    planTopWidgetVisible?: boolean;
    planBottomWidgetVisible?: boolean;
    missionTopWidgetVisible?: boolean;
    missionBottomWidgetVisible?: boolean;
    rememberWidgetVisibility?: boolean;
    enableWidgetShortcuts?: boolean;
    showIdleWorkflowEntryHint?: boolean;
    showActiveWorkflowSwitchHint?: boolean;
    showWidgetShortcutHint?: boolean;
    showPresetShortcutHint?: boolean;
    workflowTheme?: string;
    workflowThemeOverrides?: Record<string, string>;
    widgetTextStyle?: WorkflowWidgetTextPreset;
    startupTextStyle?: WorkflowWidgetTextPreset;
    startupVisual?: WorkflowStartupVisual;
    startupLogo?: WorkflowStartupLogo;
    startupLogoText?: string;
    startupLogoFont?: WorkflowStartupLogoFont;
    startupLogoShadowDirection?: WorkflowStartupLogoShadowDirection;
    startupLogoColorStyle?: WorkflowStartupLogoColorStyle;
    startupVisualOnSessionStart?: boolean;
    customBrandEnabled?: boolean;
    customBrandText?: string;
    customBrandBaseVisual?: CustomBrandBaseVisual;
    debugPlanStepTracking?: boolean;
  };
  subagents: WorkflowSubagentSettings;
  context: {
    compactionMode: CompactionMode;
    compactionModelProvider: string;
    compactionModel: string;
    compactionAgent: string;
    customCompactionEnabled?: boolean;
    autoCompactionEnabled?: boolean;
    compactionTriggerPercent?: number;
    compactionCooldownMinutes?: number;
    customCompactionReserveTokens?: number;
    customCompactionKeepRecentTokens?: number;
    workflowCompactionCheckMode?: WorkflowCompactionCheckMode;
  };
  presets?: {
    activePreset?: string;
    items?: Record<string, WorkflowPresetBundle>;
  };
}

export interface WorkflowPresetBundle {
  displayName?: string;
  description?: string;
  planning?: Partial<WorkflowSettings["planning"]>;
  workflow?: Partial<WorkflowSettings["workflow"]>;
  standard?: Partial<Omit<WorkflowSettings["standard"], "models">> & { models?: Partial<Record<WorkflowRole, RoleModelSettings>> };
  missions?: Partial<Omit<WorkflowSettings["missions"], "models">>;
  subagents?: Partial<WorkflowSettings["subagents"]>;
  ui?: Partial<WorkflowSettings["ui"]>;
}

export const WORKFLOW_SETTINGS_FILE = join(getAgentDir(), "workflow-settings.json");
const EXTENSION_DIR = dirname(fileURLToPath(import.meta.url));
const EXAMPLE_SETTINGS_FILE = join(EXTENSION_DIR, "..", "config", "workflow-settings.example.json");

const BUILTIN_DEFAULT_WORKFLOW_SETTINGS = {
  "models": {
    "planner": {
      "enabled": true,
      "provider": null,
      "model": null,
      "thinkingLevel": "high"
    },
    "executor": {
      "enabled": true,
      "provider": null,
      "model": null,
      "thinkingLevel": "high"
    },
    "validator": {
      "enabled": true,
      "provider": null,
      "model": null,
      "thinkingLevel": "xhigh",
      "askBeforeRun": false
    },
    "reviewer": {
      "enabled": true,
      "provider": null,
      "model": null,
      "thinkingLevel": "xhigh",
      "askBeforeRun": false
    }
  },
  "workflow": {
    "requirePlanApprovalBeforeExecute": true,
    "offerValidationAfterExecute": true,
    "autoRunValidationAfterExecute": true,
    "offerReviewerBeforeExecute": false,
    "autoRunReviewerBeforeExecute": false,
    "allowPlanRevisionBeforeExecute": true,
    "autoRepairReviewFailures": true,
    "maxReviewRetriesPerPlan": 2,
    "reviewRetryMode": "safe_only",
    "pauseAfterReviewFailure": false,
    "autoRepairValidationFailures": true,
    "validationRetryMode": "safe_only",
    "maxValidationRetriesPerPlan": 2,
    "maxValidationRetriesPerWorkflow": 4,
    "pauseAfterValidationFailure": false,
    "requireApprovalForOutOfScopeRepair": true,
    "requireApprovalForDestructiveRepair": true,
    "repairRetry": {
      "enabled": true,
      "maxTotalRetries": 6,
      "defaults": {
        "autoRepairFailures": true,
        "retryMode": "safe_only",
        "maxRetriesPerItem": 2,
        "maxRetriesPerWorkflow": 4,
        "pauseAfterFailure": false,
        "requireApprovalForOutOfScopeRepair": true,
        "requireApprovalForDestructiveRepair": true
      },
      "gates": {
        "review": {
          "autoRepairFailures": true,
          "retryMode": "safe_only",
          "maxRetriesPerItem": 2,
          "maxRetriesPerWorkflow": 4,
          "pauseAfterFailure": false,
          "requireApprovalForOutOfScopeRepair": true,
          "requireApprovalForDestructiveRepair": true
        },
        "validation": {
          "autoRepairFailures": true,
          "retryMode": "safe_only",
          "maxRetriesPerItem": 2,
          "maxRetriesPerWorkflow": 4,
          "pauseAfterFailure": false,
          "requireApprovalForOutOfScopeRepair": true,
          "requireApprovalForDestructiveRepair": true
        }
      }
    },
    "executionChecklistEnabled": true,
    "returnToPlanModeAfterWorkflow": true,
    "savePlans": true,
    "savePlanHistory": true,
    "planHistoryLimit": 50,
    "planProgressEnabled": true,
    "planRuntimeEnabled": true,
    "planShowProgressBar": true,
    "requireApprovalBeforeExecution": true,
    "requireApprovalPerStep": false,
    "validateAfterEachStep": false,
    "validateAfterExecution": true
  },
  "standard": {
    "enabled": true,
    "autoTodoEnabled": true,
    "todoProgressVisible": true,
    "todoTriggerMode": "auto",
    "clarificationEnabled": true,
    "clarificationMode": "auto",
    "maxClarificationQuestions": 1,
    "interactiveClarificationEnabled": true,
    "clarificationTiming": "after_initial_analysis",
    "clarificationQualityGate": true,
    "allowClarificationWithoutAnalysis": false,
    "useSubagentsBeforeClarification": false,
    "allowSubagents": true,
    "subagentScope": "user",
    "subagents": {},
    "statusWidgetVisible": true,
    "useSharedExecutorModel": true,
    "useStandardSpecificModels": false,
    "modelRole": "executor",
    "models": {
      "planner": {
        "enabled": true,
        "provider": null,
        "model": null,
        "thinkingLevel": "medium"
      },
      "executor": {
        "enabled": true,
        "provider": null,
        "model": null,
        "thinkingLevel": "medium"
      },
      "reviewer": {
        "enabled": true,
        "provider": null,
        "model": null,
        "thinkingLevel": "xhigh"
      },
      "validator": {
        "enabled": true,
        "provider": null,
        "model": null,
        "thinkingLevel": "xhigh"
      }
    },
    "maxTokens": 0
  },
  "missions": {
    "enabled": true,
    "defaultAutonomy": "approval_gated",
    "maxRuntimeHours": 13,
    "checkpointIntervalMinutes": 30,
    "requireApprovalForDestructiveActions": true,
    "requireValidationPerMilestone": true,
    "autoResume": false,
    "allowFullAuto": false,
    "autoRunAfterApproval": true,
    "offerReviewerBeforeApprove": false,
    "autoRunReviewerBeforeApprove": false,
    "autoRepairReviewFailures": true,
    "reviewRetryMode": "safe_only",
    "maxReviewRetriesPerMission": 2,
    "continueAcrossMilestones": true,
    "pauseBetweenMilestones": false,
    "progressWidgetEnabled": true,
    "progressOutputMode": "compact",
    "showProgressBar": true,
    "missionHistoryLimit": 50,
    "heartbeatEnabled": true,
    "watchdogEnabled": false,
    "watchdogStaleMinutes": 30,
    "autoRepairValidationFailures": true,
    "maxValidationRetriesPerMilestone": 2,
    "maxValidationRetriesPerMission": 8,
    "validationRetryMode": "safe_only",
    "pauseAfterValidationFailure": false,
    "requireApprovalForOutOfScopeRepair": true,
    "requireApprovalForDestructiveRepair": true,
    "finalValidationEnabled": false,
    "finalValidationRequiresPass": true,
    "autoRepairFinalValidationFailures": false,
    "maxFinalValidationRetries": 1,
    "clarificationMode": "always_for_nontrivial",
    "interactiveClarificationEnabled": true,
    "maxClarificationQuestions": 4,
    "planningDepth": "deep",
    "subagentPolicy": "forced",
    "minWorkersForDeep": 1,
    "minWorkersForMaximum": 1,
    "useMissionSpecificModels": false,
    "models": {
      "planner": {
        "enabled": true,
        "provider": null,
        "model": null,
        "thinkingLevel": "medium"
      },
      "executor": {
        "enabled": true,
        "provider": null,
        "model": null,
        "thinkingLevel": "medium"
      },
      "reviewer": {
        "enabled": true,
        "provider": null,
        "model": null,
        "thinkingLevel": "xhigh"
      },
      "validator": {
        "enabled": true,
        "provider": null,
        "model": null,
        "thinkingLevel": "xhigh"
      }
    },
    "clarificationTiming": "after_initial_analysis",
    "clarificationQualityGate": true,
    "allowClarificationWithoutAnalysis": false,
    "useSubagentsBeforeClarification": true,
    "maxTokens": 0
  },
  "safety": {
    "repoLockEnabled": true,
    "disableBashInPlanMode": false,
    "disableBashInValidatorMode": true,
    "blockDestructiveCommands": true,
    "allowPackageInstallInExecution": true
  },
  "ui": {
    "showWorkflowStatus": true,
    "showPlanModeIndicator": true,
    "planModeIndicatorText": "PLAN MODE ACTIVE - enter your planning request, or use /plan cancel to exit",
    "enableHotkeys": false,
    "planTopWidgetVisible": true,
    "planBottomWidgetVisible": true,
    "missionTopWidgetVisible": true,
    "missionBottomWidgetVisible": true,
    "rememberWidgetVisibility": true,
    "enableWidgetShortcuts": true,
    "showIdleWorkflowEntryHint": true,
    "showActiveWorkflowSwitchHint": true,
    "showWidgetShortcutHint": true,
    "showPresetShortcutHint": true,
    "workflowTheme": "aurora",
    "workflowThemeOverrides": {},
    "widgetTextStyle": undefined,
    "startupTextStyle": undefined,
    "startupVisual": "mission_control",
    "startupLogo": "pi",
    "startupLogoText": "",
    "startupLogoFont": "block",
    "startupLogoShadowDirection": "down_right",
    "startupLogoColorStyle": "theme",
    "startupVisualOnSessionStart": true,
    "customBrandEnabled": false,
    "customBrandText": "",
    "customBrandBaseVisual": "mission_control",
    "debugPlanStepTracking": false
  },
  "shortcuts": {
    "planMode": null
  },
  "subagents": {
    "enabled": true,
    "activityIndicatorEnabled": true,
    "requireApprovalBeforeRun": false,
    "autoUseDuringPlanning": true,
    "autoUseDuringExecution": true,
    "autoUseDuringRepair": true,
    "autoUseDuringReview": true,
    "autoUseDuringValidation": true,
    "planningPolicy": "forced",
    "executionPolicy": "forced",
    "repairPolicy": "forced",
    "reviewPolicy": "forced",
    "validationPolicy": "forced",
    "minPlanningWorkersForDeep": 1,
    "minPlanningWorkersForMaximum": 1,
    "minExecutionWorkersForDeep": 2,
    "minExecutionWorkersForMaximum": 2,
    "minRepairWorkersForDeep": 2,
    "minRepairWorkersForMaximum": 2,
    "minReviewWorkersForDeep": 2,
    "minReviewWorkersForMaximum": 2,
    "minValidationWorkersForDeep": 2,
    "minValidationWorkersForMaximum": 2,
    "allowParallelReadOnly": true,
    "allowParallelPlanning": true,
    "allowParallelExecution": true,
    "allowParallelRepair": true,
    "allowParallelReview": true,
    "allowParallelValidation": true,
    "allowParallelEdits": false,
    "editConcurrencyMode": "sequential",
    "requireParallelEditConflictProtection": true,
    "planningOrchestrationPolicy": "orchestrator_first",
    "subagentTimeoutMinutes": 20,
    "subagentStaleMinutes": 8,
    "allowBackgroundSubagents": true
  },
  "planning": {
    "clarificationMode": "auto",
    "maxClarificationQuestions": 3,
    "interactiveClarificationEnabled": true,
    "depth": "standard",
    "clarificationTiming": "after_initial_analysis",
    "clarificationQualityGate": true,
    "allowClarificationWithoutAnalysis": false,
    "useSubagentsBeforeClarification": true,
    "maxTokens": 0,
    "maxRuntimeHours": 0
  },
  "context": {
    "compactionMode": "pi_default",
    "compactionModelProvider": "",
    "compactionModel": "",
    "compactionAgent": "",
    "customCompactionEnabled": false,
    "compactionCooldownMinutes": 5,
    "customCompactionReserveTokens": 16384,
    "customCompactionKeepRecentTokens": 20000,
    "workflowCompactionCheckMode": "boundary"
  },
  "presets": {
    "activePreset": "custom",
    "items": {}
  }
} as WorkflowSettings;
const workflowSettingsWarnings = new Set<string>();

function cloneWorkflowSettings(settings: WorkflowSettings): WorkflowSettings {
  return JSON.parse(JSON.stringify(settings)) as WorkflowSettings;
}

function rememberWorkflowSettingsWarning(message: string): void {
  workflowSettingsWarnings.add(message);
}

function parseWorkflowSettingsFile(file: string, fallback: WorkflowSettings, label: string): Partial<WorkflowSettings> | WorkflowSettings {
  try {
    return JSON.parse(readFileSync(file, "utf8")) as Partial<WorkflowSettings>;
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    rememberWorkflowSettingsWarning(`${label} unreadable; using safe defaults (${detail})`);
    return cloneWorkflowSettings(fallback);
  }
}

export function workflowSettingsDiagnostics(): string[] {
  return Array.from(workflowSettingsWarnings);
}

export function clearWorkflowSettingsDiagnostics(): void {
  workflowSettingsWarnings.clear();
}

export function defaultWorkflowSettings(): WorkflowSettings {
  const defaults = cloneWorkflowSettings(BUILTIN_DEFAULT_WORKFLOW_SETTINGS);
  if (!existsSync(EXAMPLE_SETTINGS_FILE)) {
    rememberWorkflowSettingsWarning(`example settings missing at ${EXAMPLE_SETTINGS_FILE}; using built-in defaults`);
    return defaults;
  }
  const parsed = parseWorkflowSettingsFile(EXAMPLE_SETTINGS_FILE, defaults, "example workflow settings") as Partial<WorkflowSettings>;
  return {
    ...defaults,
    ...parsed,
    models: {
      planner: normalizeRole(defaults.models.planner, parsed.models?.planner),
      executor: normalizeRole(defaults.models.executor, parsed.models?.executor),
      validator: normalizeRole(defaults.models.validator, parsed.models?.validator),
      reviewer: normalizeRole(defaults.models.reviewer, parsed.models?.reviewer),
    },
    planning: { ...defaults.planning, ...(parsed.planning ?? {}) },
    workflow: { ...defaults.workflow, ...(parsed.workflow ?? {}) },
    standard: normalizeStandardSettings(defaults, parsed.standard),
    missions: { ...defaults.missions, ...(parsed.missions ?? {}), models: normalizeMissionModels(defaults, parsed.missions) },
    safety: { ...defaults.safety, ...(parsed.safety ?? {}) },
    ui: normalizeUiSettings({ ...defaults.ui, ...(parsed.ui ?? {}) }),
    subagents: { ...defaults.subagents, ...(parsed.subagents ?? {}) },
    context: { ...defaults.context, ...(parsed.context ?? {}) },
    presets: { ...(defaults.presets ?? {}), ...(parsed.presets ?? {}), items: { ...(defaults.presets?.items ?? {}), ...(parsed.presets?.items ?? {}) } },
  };
}

function normalizeRole(defaultRole: RoleModelSettings, parsedRole?: Partial<RoleModelSettings>): RoleModelSettings {
  return { ...defaultRole, ...(parsedRole ?? {}) };
}

function normalizeUiSettings(ui: WorkflowSettings["ui"]): WorkflowSettings["ui"] {
  const { startupVisualAnimation: _legacyStartupVisualAnimation, ...rest } = ui as WorkflowSettings["ui"] & { startupVisualAnimation?: boolean };
  return rest;
}

function normalizeStandardClarificationMode(value: unknown, fallback: StandardClarificationMode = "auto"): StandardClarificationMode {
  if (value === "never" || value === "off") return "never";
  if (value === "always_for_nontrivial") return "always_for_nontrivial";
  if (value === "auto" || value === "minimal") return "auto";
  return fallback;
}

function normalizeStandardSettings(defaults: WorkflowSettings, base?: Partial<WorkflowSettings>["standard"], override?: Partial<WorkflowSettings>["standard"]): WorkflowSettings["standard"] {
  const merged = {
    ...defaults.standard,
    ...(base ?? {}),
    ...(override ?? {}),
    subagents: {
      ...(defaults.standard.subagents ?? {}),
      ...(base?.subagents ?? {}),
      ...(override?.subagents ?? {}),
    },
    models: normalizeStandardModels(defaults, base, override),
  };
  return {
    ...merged,
    clarificationMode: normalizeStandardClarificationMode(merged.clarificationMode, defaults.standard.clarificationMode ?? "auto"),
  };
}

function normalizeStandardModels(defaults: WorkflowSettings, base?: Partial<WorkflowSettings>["standard"], override?: Partial<WorkflowSettings>["standard"]): Record<WorkflowRole, RoleModelSettings> {
  const defaultModels = defaults.standard.models ?? {
    planner: { enabled: true, provider: null, model: null, thinkingLevel: defaults.models.planner.thinkingLevel },
    executor: { enabled: true, provider: null, model: null, thinkingLevel: defaults.models.executor.thinkingLevel },
    reviewer: { enabled: true, provider: null, model: null, thinkingLevel: defaults.models.reviewer.thinkingLevel },
    validator: { enabled: true, provider: null, model: null, thinkingLevel: defaults.models.validator.thinkingLevel },
  };
  const baseModels: Partial<Record<WorkflowRole, RoleModelSettings>> = base?.models ?? {};
  const overrideModels: Partial<Record<WorkflowRole, RoleModelSettings>> = override?.models ?? {};
  return {
    planner: normalizeRole(defaultModels.planner, { ...(baseModels.planner ?? {}), ...(overrideModels.planner ?? {}) }),
    executor: normalizeRole(defaultModels.executor, { ...(baseModels.executor ?? {}), ...(overrideModels.executor ?? {}) }),
    reviewer: normalizeRole(defaultModels.reviewer, { ...(baseModels.reviewer ?? {}), ...(overrideModels.reviewer ?? {}) }),
    validator: normalizeRole(defaultModels.validator, { ...(baseModels.validator ?? {}), ...(overrideModels.validator ?? {}) }),
  };
}

function normalizeMissionModels(defaults: WorkflowSettings, base?: Partial<WorkflowSettings>["missions"], override?: Partial<WorkflowSettings>["missions"]): Record<MissionModelRole, RoleModelSettings> {
  const defaultModels = defaults.missions.models ?? {
    planner: { enabled: true, provider: null, model: null, thinkingLevel: defaults.models.planner.thinkingLevel },
    executor: { enabled: true, provider: null, model: null, thinkingLevel: defaults.models.executor.thinkingLevel },
    reviewer: { enabled: true, provider: null, model: null, thinkingLevel: defaults.models.reviewer.thinkingLevel },
    validator: { enabled: true, provider: null, model: null, thinkingLevel: defaults.models.validator.thinkingLevel },
  };
  const baseModels: Partial<Record<MissionModelRole, RoleModelSettings>> = base?.models ?? {};
  const overrideModels: Partial<Record<MissionModelRole, RoleModelSettings>> = override?.models ?? {};
  return {
    planner: normalizeRole(defaultModels.planner, { ...(baseModels.planner ?? {}), ...(overrideModels.planner ?? {}) }),
    executor: normalizeRole(defaultModels.executor, { ...(baseModels.executor ?? {}), ...(overrideModels.executor ?? {}) }),
    reviewer: normalizeRole(defaultModels.reviewer, { ...(baseModels.reviewer ?? {}), ...(overrideModels.reviewer ?? {}) }),
    validator: normalizeRole(defaultModels.validator, { ...(baseModels.validator ?? {}), ...(overrideModels.validator ?? {}) }),
  };
}

/** Walk up from cwd looking for .pi/workflow-settings.json. Returns path or undefined. */
export function findProjectSettings(cwd: string): string | undefined {
  let dir = cwd;
  for (let i = 0; i < 40; i++) {
    const candidate = join(dir, ".pi", "workflow-settings.json");
    if (existsSync(candidate)) return candidate;
    const parent = dirname(dir);
    if (parent === dir) break; // filesystem root
    dir = parent;
  }
  return undefined;
}

/** Resolve the git repo root by walking up looking for .git. Returns root or undefined. */
function findRepoRoot(cwd: string): string | undefined {
  let dir = cwd;
  for (let i = 0; i < 40; i++) {
    if (existsSync(join(dir, ".git"))) return dir;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return undefined;
}

/** Deep merge project overrides into global settings. Project wins on conflicts. */
function mergeSettings(global: WorkflowSettings, project: Partial<WorkflowSettings>): WorkflowSettings {
  const defaults = defaultWorkflowSettings();
  return {
    ...global,
    ...project,
    models: {
      planner: normalizeRole(global.models.planner, project.models?.planner),
      executor: normalizeRole(global.models.executor, project.models?.executor),
      validator: normalizeRole(global.models.validator, project.models?.validator),
      reviewer: normalizeRole(global.models.reviewer, project.models?.reviewer),
    },
    planning: { ...defaults.planning, ...global.planning, ...(project.planning ?? {}) },
    workflow: { ...defaults.workflow, ...global.workflow, ...(project.workflow ?? {}) },
    standard: normalizeStandardSettings(defaults, global.standard, project.standard),
    missions: { ...defaults.missions, ...global.missions, ...(project.missions ?? {}), models: normalizeMissionModels(defaults, global.missions, project.missions) },
    safety: { ...defaults.safety, ...global.safety, ...(project.safety ?? {}) },
    ui: normalizeUiSettings({ ...defaults.ui, ...global.ui, ...(project.ui ?? {}) }),
    subagents: { ...defaults.subagents, ...global.subagents, ...(project.subagents ?? {}) },
    context: { ...defaults.context, ...global.context, ...(project.context ?? {}) },
    presets: { ...(defaults.presets ?? {}), ...(global.presets ?? {}), ...(project.presets ?? {}), items: { ...(defaults.presets?.items ?? {}), ...(global.presets?.items ?? {}), ...(project.presets?.items ?? {}) } },
  };
}

export interface EffectiveSettings {
  settings: WorkflowSettings;
  projectOverridePath: string | undefined;
}

export interface SettingsWriteResult {
  settings: WorkflowSettings;
  scope: WorkflowSettingsScope;
  file: string;
}

interface UpdateSettingsOptions {
  preserveActivePreset?: boolean;
}

export const WORKFLOW_MANUAL_PRESET = "custom";

function presetOwnedSettingsSignature(settings: WorkflowSettings): string {
  const { models: _ignoredStandardModels, ...standardWithoutModels } = settings.standard;
  const { models: _ignoredMissionModels, ...missionsWithoutModels } = settings.missions;
  return JSON.stringify({
    planning: settings.planning,
    workflow: settings.workflow,
    standard: standardWithoutModels,
    missions: missionsWithoutModels,
    subagents: settings.subagents,
  });
}

function applyActivePresetOverlay(settings: WorkflowSettings): WorkflowSettings {
  const active = settings.presets?.activePreset ?? WORKFLOW_MANUAL_PRESET;
  if (active === WORKFLOW_MANUAL_PRESET) return settings;
  const preset = workflowPresetCatalog(settings)[active];
  if (!preset) return settings;
  const defaults = defaultWorkflowSettings();
  const normalized = normalizeWorkflowPresetBundle(preset);
  const currentStandardModels = settings.standard.models;
  const currentMissionModels = settings.missions.models;
  return {
    ...settings,
    planning: normalized.planning ? { ...settings.planning, ...normalized.planning } : settings.planning,
    workflow: normalized.workflow ? { ...settings.workflow, ...normalized.workflow } : settings.workflow,
    standard: {
      ...defaults.standard,
      ...settings.standard,
      ...normalized.standard,
      subagents: { ...(defaults.standard.subagents ?? {}), ...(settings.standard.subagents ?? {}), ...(normalized.standard.subagents ?? {}) },
      models: currentStandardModels,
    },
    missions: normalized.missions ? { ...settings.missions, ...normalized.missions, models: currentMissionModels } : settings.missions,
    subagents: normalized.subagents ? { ...settings.subagents, ...normalized.subagents } : settings.subagents,
    presets: settings.presets,
  };
}

/** Load effective settings: project overrides merged over global. */
export function loadEffectiveSettings(cwd: string): EffectiveSettings {
  const global = loadGlobalSettings();
  const projectPath = findProjectSettings(cwd);
  if (!projectPath) return { settings: global, projectOverridePath: undefined };
  try {
    const project = JSON.parse(readFileSync(projectPath, "utf8")) as Partial<WorkflowSettings>;
    return { settings: applyActivePresetOverlay(mergeSettings(global, project)), projectOverridePath: projectPath };
  } catch {
    return { settings: global, projectOverridePath: projectPath };
  }
}

/** Load global settings only (no project override). */
export function loadGlobalSettings(): WorkflowSettings {
  const defaults = defaultWorkflowSettings();
  if (!existsSync(WORKFLOW_SETTINGS_FILE)) {
    saveWorkflowSettings(defaults);
    return defaults;
  }
  const parsed = parseWorkflowSettingsFile(WORKFLOW_SETTINGS_FILE, defaults, "global workflow settings") as Partial<WorkflowSettings>;
  return applyActivePresetOverlay(mergeSettings(defaults, parsed));
}

/** Backwards-compatible: loads effective settings for a given cwd. */
export function loadWorkflowSettings(cwd?: string): WorkflowSettings {
  if (cwd) return loadEffectiveSettings(cwd).settings;
  return loadGlobalSettings();
}

/** Get the project root for creating overrides. Prefers git root, falls back to cwd. */
export function getProjectRoot(cwd: string): string {
  return findRepoRoot(cwd) ?? cwd;
}

export function saveWorkflowSettings(settings: WorkflowSettings): void {
  saveSettingsFile(WORKFLOW_SETTINGS_FILE, settings);
}

function saveSettingsFile(file: string, settings: WorkflowSettings): void {
  mkdirSync(dirname(file), { recursive: true });
  const content = JSON.stringify(settings, null, 2) + "\n";
  JSON.parse(content);
  const tmp = `${file}.tmp-${process.pid}-${Date.now()}`;
  writeFileSync(tmp, content, "utf8");
  JSON.parse(readFileSync(tmp, "utf8"));
  renameSync(tmp, file);
}

function loadSettingsFile(file: string): WorkflowSettings {
  const defaults = defaultWorkflowSettings();
  if (!existsSync(file)) return defaults;
  const parsed = parseWorkflowSettingsFile(file, defaults, `workflow settings ${file}`) as Partial<WorkflowSettings>;
  return mergeSettings(defaults, parsed);
}

export function getProjectSettingsFile(cwd: string): string {
  return join(getProjectRoot(cwd), ".pi", "workflow-settings.json");
}

export function getDefaultWriteTarget(cwd: string): { scope: WorkflowSettingsScope; file: string } {
  const project = findProjectSettings(cwd);
  if (project) return { scope: "project", file: project };
  return { scope: "global", file: WORKFLOW_SETTINGS_FILE };
}

export function getWriteTarget(cwd: string, requestedScope?: WorkflowSettingsScope): { scope: WorkflowSettingsScope; file: string } {
  if (requestedScope === "global") return { scope: "global", file: WORKFLOW_SETTINGS_FILE };
  if (requestedScope === "project") return { scope: "project", file: getProjectSettingsFile(cwd) };
  return getDefaultWriteTarget(cwd);
}

export function createProjectSettingsOverride(cwd: string): SettingsWriteResult {
  const file = getProjectSettingsFile(cwd);
  const settings = loadEffectiveSettings(cwd).settings;
  saveSettingsFile(file, settings);
  return { settings, scope: "project", file };
}

export function updateSettings(cwd: string, requestedScope: WorkflowSettingsScope | undefined, updater: (settings: WorkflowSettings) => void, options: UpdateSettingsOptions = {}): SettingsWriteResult {
  const target = getWriteTarget(cwd, requestedScope);
  const settings = target.scope === "global" ? loadGlobalSettings() : loadEffectiveSettings(cwd).settings;
  const beforePreset = settings.presets?.activePreset ?? WORKFLOW_MANUAL_PRESET;
  const beforePresetOwned = presetOwnedSettingsSignature(settings);
  updater(settings);
  const afterPresetOwned = presetOwnedSettingsSignature(settings);
  if (!options.preserveActivePreset && beforePreset !== WORKFLOW_MANUAL_PRESET && settings.presets?.activePreset === beforePreset && beforePresetOwned !== afterPresetOwned) {
    settings.presets = { ...(settings.presets ?? {}), activePreset: WORKFLOW_MANUAL_PRESET, items: { ...(settings.presets?.items ?? {}) } };
  }
  saveSettingsFile(target.file, settings);
  return { settings, scope: target.scope, file: target.file };
}

export function builtInWorkflowPresets(): Record<string, WorkflowPresetBundle> {
  return {
    simple: {
      displayName: "Simple",
      description: "Fast end-to-end Plan/Mission/Standard workflow with minimal ceremony, automatic validation when work runs, low safe repair retries, and one-worker sub-agent support.",
      planning: { depth: "fast", clarificationMode: "auto", maxClarificationQuestions: 2, interactiveClarificationEnabled: true, clarificationQualityGate: false, useSubagentsBeforeClarification: true },
      workflow: { offerReviewerBeforeExecute: false, autoRunReviewerBeforeExecute: false, offerValidationAfterExecute: true, autoRunValidationAfterExecute: true, validateAfterExecution: true, requirePlanApprovalBeforeExecute: false, requireApprovalBeforeExecution: false, autoRepairReviewFailures: false, autoRepairValidationFailures: true, reviewRetryMode: "off", validationRetryMode: "safe_only", maxReviewRetriesPerPlan: 0, maxReviewRetriesPerWorkflow: 0, maxValidationRetriesPerPlan: 1, maxValidationRetriesPerWorkflow: 2, pauseAfterReviewFailure: true, pauseAfterValidationFailure: false, planProgressEnabled: true, planRuntimeEnabled: true, planShowProgressBar: true },
      standard: { enabled: true, autoTodoEnabled: true, todoProgressVisible: true, todoTriggerMode: "auto", clarificationEnabled: true, clarificationMode: "auto", maxClarificationQuestions: 1, interactiveClarificationEnabled: true, clarificationTiming: "after_initial_analysis", clarificationQualityGate: false, allowClarificationWithoutAnalysis: false, useSubagentsBeforeClarification: false, allowSubagents: true, subagentScope: "user", subagents: { planningPolicy: "forced", executionPolicy: "forced", repairPolicy: "forced", reviewPolicy: "auto", validationPolicy: "forced", autoUseDuringPlanning: true, autoUseDuringExecution: true, autoUseDuringRepair: true, autoUseDuringReview: true, autoUseDuringValidation: true, minPlanningWorkersForDeep: 1, minPlanningWorkersForMaximum: 1, minExecutionWorkersForDeep: 1, minExecutionWorkersForMaximum: 1, minRepairWorkersForDeep: 1, minRepairWorkersForMaximum: 1, minReviewWorkersForDeep: 1, minReviewWorkersForMaximum: 1, minValidationWorkersForDeep: 1, minValidationWorkersForMaximum: 1 }, statusWidgetVisible: true, useSharedExecutorModel: true, useStandardSpecificModels: false, modelRole: "executor" },
      missions: { defaultAutonomy: "approval_gated", requireValidationPerMilestone: true, autoRunAfterApproval: true, continueAcrossMilestones: true, pauseBetweenMilestones: false, clarificationMode: "auto", maxClarificationQuestions: 2, planningDepth: "fast", useSubagentsBeforeClarification: true, autoRepairReviewFailures: false, reviewRetryMode: "off", maxReviewRetriesPerMission: 0, autoRepairValidationFailures: true, validationRetryMode: "safe_only", maxValidationRetriesPerMilestone: 1, maxValidationRetriesPerMission: 2, finalValidationEnabled: false, autoRepairFinalValidationFailures: false, maxFinalValidationRetries: 0, subagentPolicy: "forced", minWorkersForDeep: 1, minWorkersForMaximum: 1 },
      subagents: { planningPolicy: "forced", executionPolicy: "forced", repairPolicy: "forced", reviewPolicy: "auto", validationPolicy: "forced", autoUseDuringPlanning: true, autoUseDuringExecution: true, autoUseDuringRepair: true, autoUseDuringReview: true, autoUseDuringValidation: true, minPlanningWorkersForDeep: 1, minPlanningWorkersForMaximum: 1, minExecutionWorkersForDeep: 1, minExecutionWorkersForMaximum: 1, minRepairWorkersForDeep: 1, minRepairWorkersForMaximum: 1, minReviewWorkersForDeep: 1, minReviewWorkersForMaximum: 1, minValidationWorkersForDeep: 1, minValidationWorkersForMaximum: 1, allowBackgroundSubagents: false },
    },
    standard: {
      displayName: "Standard",
      description: "Default end-to-end workflow with useful clarification, automatic execution/validation after approval, safe repair retries, and balanced worker support.",
      planning: { depth: "standard", clarificationMode: "auto", maxClarificationQuestions: 3, interactiveClarificationEnabled: true, clarificationQualityGate: true, useSubagentsBeforeClarification: true },
      workflow: { offerReviewerBeforeExecute: false, autoRunReviewerBeforeExecute: false, offerValidationAfterExecute: true, autoRunValidationAfterExecute: true, validateAfterExecution: true, requirePlanApprovalBeforeExecute: false, requireApprovalBeforeExecution: false, autoRepairReviewFailures: true, autoRepairValidationFailures: true, reviewRetryMode: "safe_only", validationRetryMode: "safe_only", maxReviewRetriesPerPlan: 2, maxReviewRetriesPerWorkflow: 4, maxValidationRetriesPerPlan: 2, maxValidationRetriesPerWorkflow: 4, pauseAfterReviewFailure: false, pauseAfterValidationFailure: false, planProgressEnabled: true, planRuntimeEnabled: true, planShowProgressBar: true },
      standard: { enabled: true, autoTodoEnabled: true, todoProgressVisible: true, todoTriggerMode: "auto", clarificationEnabled: true, clarificationMode: "auto", maxClarificationQuestions: 1, interactiveClarificationEnabled: true, clarificationTiming: "after_initial_analysis", clarificationQualityGate: true, allowClarificationWithoutAnalysis: false, useSubagentsBeforeClarification: false, allowSubagents: true, subagentScope: "user", subagents: { planningPolicy: "forced", executionPolicy: "forced", repairPolicy: "forced", reviewPolicy: "forced", validationPolicy: "forced", autoUseDuringPlanning: true, autoUseDuringExecution: true, autoUseDuringRepair: true, autoUseDuringReview: true, autoUseDuringValidation: true, minPlanningWorkersForDeep: 1, minPlanningWorkersForMaximum: 1, minExecutionWorkersForDeep: 2, minExecutionWorkersForMaximum: 2, minRepairWorkersForDeep: 2, minRepairWorkersForMaximum: 2, minReviewWorkersForDeep: 2, minReviewWorkersForMaximum: 2, minValidationWorkersForDeep: 2, minValidationWorkersForMaximum: 2 }, statusWidgetVisible: true, useSharedExecutorModel: true, useStandardSpecificModels: false, modelRole: "executor" },
      missions: { defaultAutonomy: "approval_gated", requireValidationPerMilestone: true, autoRunAfterApproval: true, continueAcrossMilestones: true, pauseBetweenMilestones: false, clarificationMode: "auto", maxClarificationQuestions: 3, planningDepth: "standard", useSubagentsBeforeClarification: true, autoRepairReviewFailures: true, reviewRetryMode: "safe_only", maxReviewRetriesPerMission: 2, autoRepairValidationFailures: true, validationRetryMode: "safe_only", maxValidationRetriesPerMilestone: 2, maxValidationRetriesPerMission: 6, finalValidationEnabled: false, autoRepairFinalValidationFailures: false, maxFinalValidationRetries: 1, subagentPolicy: "forced", minWorkersForDeep: 1, minWorkersForMaximum: 1 },
      subagents: { planningPolicy: "forced", executionPolicy: "forced", repairPolicy: "forced", reviewPolicy: "forced", validationPolicy: "forced", autoUseDuringPlanning: true, autoUseDuringExecution: true, autoUseDuringRepair: true, autoUseDuringReview: true, autoUseDuringValidation: true, minPlanningWorkersForDeep: 1, minPlanningWorkersForMaximum: 1, minExecutionWorkersForDeep: 2, minExecutionWorkersForMaximum: 2, minRepairWorkersForDeep: 2, minRepairWorkersForMaximum: 2, minReviewWorkersForDeep: 2, minReviewWorkersForMaximum: 2, minValidationWorkersForDeep: 2, minValidationWorkersForMaximum: 2, allowBackgroundSubagents: false },
    },
    deep: {
      displayName: "Deep",
      description: "Careful end-to-end workflow for risky or codebase-heavy work with stronger clarification, automatic review/validation, final mission validation, and larger worker teams.",
      planning: { depth: "deep", clarificationMode: "always_for_nontrivial", maxClarificationQuestions: 5, interactiveClarificationEnabled: true, clarificationQualityGate: true, useSubagentsBeforeClarification: true },
      workflow: { offerReviewerBeforeExecute: false, autoRunReviewerBeforeExecute: true, offerValidationAfterExecute: true, autoRunValidationAfterExecute: true, validateAfterExecution: true, requirePlanApprovalBeforeExecute: false, requireApprovalBeforeExecution: false, autoRepairReviewFailures: true, autoRepairValidationFailures: true, reviewRetryMode: "safe_only", validationRetryMode: "safe_only", maxReviewRetriesPerPlan: 3, maxReviewRetriesPerWorkflow: 6, maxValidationRetriesPerPlan: 3, maxValidationRetriesPerWorkflow: 6, pauseAfterReviewFailure: false, pauseAfterValidationFailure: false, planProgressEnabled: true, planRuntimeEnabled: true, planShowProgressBar: true },
      standard: { enabled: true, autoTodoEnabled: true, todoProgressVisible: true, todoTriggerMode: "auto", clarificationEnabled: true, clarificationMode: "auto", maxClarificationQuestions: 2, interactiveClarificationEnabled: true, clarificationTiming: "after_initial_analysis", clarificationQualityGate: true, allowClarificationWithoutAnalysis: false, useSubagentsBeforeClarification: true, allowSubagents: true, subagentScope: "user", subagents: { planningPolicy: "forced", executionPolicy: "forced", repairPolicy: "forced", reviewPolicy: "forced", validationPolicy: "forced", autoUseDuringPlanning: true, autoUseDuringExecution: true, autoUseDuringRepair: true, autoUseDuringReview: true, autoUseDuringValidation: true, minPlanningWorkersForDeep: 2, minPlanningWorkersForMaximum: 2, minExecutionWorkersForDeep: 3, minExecutionWorkersForMaximum: 3, minRepairWorkersForDeep: 2, minRepairWorkersForMaximum: 2, minReviewWorkersForDeep: 3, minReviewWorkersForMaximum: 3, minValidationWorkersForDeep: 3, minValidationWorkersForMaximum: 3 }, statusWidgetVisible: true, useSharedExecutorModel: true, useStandardSpecificModels: false, modelRole: "executor" },
      missions: { defaultAutonomy: "approval_gated", requireValidationPerMilestone: true, autoRunAfterApproval: true, continueAcrossMilestones: true, pauseBetweenMilestones: false, clarificationMode: "always_for_nontrivial", maxClarificationQuestions: 5, planningDepth: "deep", useSubagentsBeforeClarification: true, autoRepairReviewFailures: true, reviewRetryMode: "safe_only", maxReviewRetriesPerMission: 3, autoRepairValidationFailures: true, validationRetryMode: "safe_only", maxValidationRetriesPerMilestone: 3, maxValidationRetriesPerMission: 8, finalValidationEnabled: true, autoRepairFinalValidationFailures: true, maxFinalValidationRetries: 2, subagentPolicy: "forced", minWorkersForDeep: 3, minWorkersForMaximum: 3 },
      subagents: { planningPolicy: "forced", executionPolicy: "forced", repairPolicy: "forced", reviewPolicy: "forced", validationPolicy: "forced", autoUseDuringPlanning: true, autoUseDuringExecution: true, autoUseDuringRepair: true, autoUseDuringReview: true, autoUseDuringValidation: true, minPlanningWorkersForDeep: 3, minPlanningWorkersForMaximum: 3, minExecutionWorkersForDeep: 3, minExecutionWorkersForMaximum: 3, minRepairWorkersForDeep: 2, minRepairWorkersForMaximum: 2, minReviewWorkersForDeep: 3, minReviewWorkersForMaximum: 3, minValidationWorkersForDeep: 3, minValidationWorkersForMaximum: 3, allowBackgroundSubagents: true },
    },
    maximum: {
      displayName: "Maximum",
      description: "Highest-rigor end-to-end workflow with strongest clarification, automatic review/validation, final mission validation, aggressive in-scope repair, and maximum worker teams.",
      planning: { depth: "maximum", clarificationMode: "always_for_nontrivial", maxClarificationQuestions: 5, interactiveClarificationEnabled: true, clarificationQualityGate: true, useSubagentsBeforeClarification: true },
      workflow: { offerReviewerBeforeExecute: false, autoRunReviewerBeforeExecute: true, offerValidationAfterExecute: true, autoRunValidationAfterExecute: true, validateAfterExecution: true, requirePlanApprovalBeforeExecute: false, requireApprovalBeforeExecution: false, autoRepairReviewFailures: true, autoRepairValidationFailures: true, reviewRetryMode: "aggressive_within_scope", validationRetryMode: "aggressive_within_scope", maxReviewRetriesPerPlan: 5, maxReviewRetriesPerWorkflow: 8, maxValidationRetriesPerPlan: 5, maxValidationRetriesPerWorkflow: 8, pauseAfterReviewFailure: false, pauseAfterValidationFailure: false, planProgressEnabled: true, planRuntimeEnabled: true, planShowProgressBar: true },
      standard: { enabled: true, autoTodoEnabled: true, todoProgressVisible: true, todoTriggerMode: "auto", clarificationEnabled: true, clarificationMode: "auto", maxClarificationQuestions: 2, interactiveClarificationEnabled: true, clarificationTiming: "after_initial_analysis", clarificationQualityGate: true, allowClarificationWithoutAnalysis: false, useSubagentsBeforeClarification: true, allowSubagents: true, subagentScope: "user", subagents: { planningPolicy: "forced", executionPolicy: "forced", repairPolicy: "forced", reviewPolicy: "forced", validationPolicy: "forced", autoUseDuringPlanning: true, autoUseDuringExecution: true, autoUseDuringRepair: true, autoUseDuringReview: true, autoUseDuringValidation: true, minPlanningWorkersForDeep: 3, minPlanningWorkersForMaximum: 3, minExecutionWorkersForDeep: 4, minExecutionWorkersForMaximum: 4, minRepairWorkersForDeep: 3, minRepairWorkersForMaximum: 3, minReviewWorkersForDeep: 4, minReviewWorkersForMaximum: 4, minValidationWorkersForDeep: 4, minValidationWorkersForMaximum: 4 }, statusWidgetVisible: true, useSharedExecutorModel: true, useStandardSpecificModels: false, modelRole: "executor" },
      missions: { defaultAutonomy: "supervised_auto", requireValidationPerMilestone: true, autoRunAfterApproval: true, continueAcrossMilestones: true, pauseBetweenMilestones: false, clarificationMode: "always_for_nontrivial", maxClarificationQuestions: 6, planningDepth: "maximum", useSubagentsBeforeClarification: true, autoRepairReviewFailures: true, reviewRetryMode: "aggressive_within_scope", maxReviewRetriesPerMission: 5, autoRepairValidationFailures: true, validationRetryMode: "aggressive_within_scope", maxValidationRetriesPerMilestone: 4, maxValidationRetriesPerMission: 12, finalValidationEnabled: true, autoRepairFinalValidationFailures: true, maxFinalValidationRetries: 4, subagentPolicy: "forced", minWorkersForDeep: 4, minWorkersForMaximum: 4 },
      subagents: { planningPolicy: "forced", executionPolicy: "forced", repairPolicy: "forced", reviewPolicy: "forced", validationPolicy: "forced", autoUseDuringPlanning: true, autoUseDuringExecution: true, autoUseDuringRepair: true, autoUseDuringReview: true, autoUseDuringValidation: true, minPlanningWorkersForDeep: 4, minPlanningWorkersForMaximum: 4, minExecutionWorkersForDeep: 4, minExecutionWorkersForMaximum: 4, minRepairWorkersForDeep: 3, minRepairWorkersForMaximum: 3, minReviewWorkersForDeep: 4, minReviewWorkersForMaximum: 4, minValidationWorkersForDeep: 4, minValidationWorkersForMaximum: 4, allowBackgroundSubagents: true },
    },
  };
}

function normalizeWorkflowPresetBundle(preset: WorkflowPresetBundle): WorkflowPresetBundle & { standard: WorkflowSettings["standard"] } {
  const defaults = defaultWorkflowSettings();
  const { models: _ignoredPresetStandardModels, ...standardWithoutModels } = (preset.standard ?? {}) as Partial<WorkflowSettings["standard"]>;
  return {
    ...preset,
    // Legacy custom presets saved before Standard Mode do not contain a
    // standard section. Hydrate it from safe defaults during apply so stale
    // Standard settings from the previously active preset cannot leak forward.
    standard: normalizeStandardSettings(defaults, defaults.standard, standardWithoutModels as Partial<WorkflowSettings>["standard"] | undefined),
  };
}

function workflowPresetBundleWithoutUserOwnedSettings(preset: WorkflowPresetBundle): WorkflowPresetBundle {
  const { context: _ignoredContext, ...presetWithoutContext } = preset as WorkflowPresetBundle & { context?: unknown };
  const { models: _ignoredStandardModels, ...standardWithoutModels } = (preset.standard ?? {}) as Partial<WorkflowSettings["standard"]>;
  const { models: _ignoredMissionModels, ...missionsWithoutModels } = (preset.missions ?? {}) as Partial<WorkflowSettings["missions"]>;
  return {
    ...presetWithoutContext,
    standard: { ...standardWithoutModels },
    missions: { ...missionsWithoutModels },
  };
}

function applyPresetBundle(settings: WorkflowSettings, preset: WorkflowPresetBundle, name: string): void {
  const defaults = defaultWorkflowSettings();
  const normalized = normalizeWorkflowPresetBundle(preset);
  const currentStandardModels = settings.standard.models;
  if (normalized.planning) settings.planning = { ...settings.planning, ...normalized.planning };
  if (normalized.workflow) settings.workflow = { ...settings.workflow, ...normalized.workflow };
  settings.standard = { ...defaults.standard, ...normalized.standard, subagents: { ...(defaults.standard.subagents ?? {}), ...(normalized.standard?.subagents ?? {}) }, models: currentStandardModels };
  if (normalized.missions) settings.missions = { ...settings.missions, ...normalized.missions, models: settings.missions.models };
  if (normalized.subagents) settings.subagents = { ...settings.subagents, ...normalized.subagents };
  if (normalized.ui) settings.ui = { ...settings.ui, ...normalized.ui };
  settings.presets = { ...(settings.presets ?? {}), activePreset: name, items: { ...(settings.presets?.items ?? {}) } };
}

export function normalizeWorkflowPresetName(name: string): string {
  return name.trim().toLowerCase().replace(/[^A-Za-z0-9._-]+/g, "-").replace(/-+/g, "-").replace(/^-+|-+$/g, "");
}

export function workflowPresetCatalog(settings: WorkflowSettings = loadGlobalSettings()): Record<string, WorkflowPresetBundle> {
  const items = { ...(settings.presets?.items ?? {}) };
  delete items[WORKFLOW_MANUAL_PRESET];
  return { ...builtInWorkflowPresets(), ...items };
}

export function workflowPresetNames(settings: WorkflowSettings = loadGlobalSettings()): string[] {
  const builtIns = ["simple", "standard", "deep", "maximum"];
  const custom = Object.keys(settings.presets?.items ?? {}).sort((a, b) => a.localeCompare(b));
  return [...builtIns, ...custom.filter((name) => name !== WORKFLOW_MANUAL_PRESET && !builtIns.includes(name))];
}

export function workflowPresetLabel(name: string, preset?: WorkflowPresetBundle): string {
  if (name === WORKFLOW_MANUAL_PRESET) return "Manual settings";
  return preset?.displayName?.trim() || name;
}

export function workflowPresetTitle(name: string, preset?: WorkflowPresetBundle): string {
  if (name === WORKFLOW_MANUAL_PRESET) return "Manual settings — no saved preset active";
  return preset?.displayName?.trim() || name;
}

export function activeWorkflowPresetLabel(settings: WorkflowSettings): string {
  const active = settings.presets?.activePreset ?? WORKFLOW_MANUAL_PRESET;
  if (active === WORKFLOW_MANUAL_PRESET) return "Manual settings";
  return workflowPresetLabel(active, workflowPresetCatalog(settings)[active]);
}

function assertValidCustomPresetName(name: string, safe: string): void {
  if (safe === WORKFLOW_MANUAL_PRESET) throw new Error(`Reserved workflow preset name: ${name}. Use a specific preset name instead of custom.`);
}

function sectionCoverage(section: unknown): "configured" | "missing" {
  return section && typeof section === "object" && Object.keys(section as Record<string, unknown>).length > 0 ? "configured" : "missing";
}

export function workflowPresetDiagnostics(name: string, preset?: WorkflowPresetBundle): string[] {
  if (name === WORKFLOW_MANUAL_PRESET) return ["Diagnostic: manual settings marker; no saved preset bundle is active."];
  const lines: string[] = [];
  if (normalizeWorkflowPresetName(name) === WORKFLOW_MANUAL_PRESET) lines.push("Diagnostic: reserved-name collision; rename this preset before use.");
  const standard = sectionCoverage(preset?.standard);
  const planning = sectionCoverage(preset?.planning);
  const workflow = sectionCoverage(preset?.workflow);
  const missions = sectionCoverage(preset?.missions);
  const subagents = sectionCoverage(preset?.subagents);
  lines.push(`Coverage: Standard ${standard}; Plan ${planning === "configured" || workflow === "configured" ? "configured" : "missing"}; Mission ${missions}; Shared sub-agents ${subagents}.`);
  if (missions === "configured" && standard === "missing") lines.push("Warning: Mission settings are configured but Standard Mode is missing; safe Standard defaults apply when used.");
  if (missions === "configured" && planning === "missing" && workflow === "missing") lines.push("Warning: Mission settings are configured but Plan Mode is missing; current/default Plan settings may not match this preset's Mission rigor.");
  const missionHigh = preset?.missions?.planningDepth === "maximum" || preset?.missions?.subagentPolicy === "forced" || preset?.missions?.defaultAutonomy === "supervised_auto" || preset?.missions?.defaultAutonomy === "full_auto";
  const planLight = preset?.planning?.depth === "fast" || preset?.workflow?.validateAfterExecution === false || preset?.workflow?.autoRunValidationAfterExecute === false;
  if (missionHigh && planLight) lines.push("Warning: Mission rigor is high while Plan Mode appears lightweight or validation-light.");
  const sharedForced = preset?.subagents?.planningPolicy === "forced" || preset?.subagents?.executionPolicy === "forced" || preset?.subagents?.validationPolicy === "forced";
  const standardLight = preset?.standard?.todoTriggerMode === "off" || preset?.standard?.allowSubagents === false;
  if (sharedForced && standardLight) lines.push("Warning: shared sub-agents are forced while Standard Mode appears lightweight or sub-agent disabled.");
  return lines;
}

export function workflowPresetPickerLabel(name: string, preset?: WorkflowPresetBundle): string {
  const title = workflowPresetTitle(name, preset);
  const summaries: Record<string, string> = {
    simple: "fast autonomous validation, low repair retries, 1-worker phases",
    standard: "balanced autonomous validation and safe repair",
    deep: "careful autonomous review, validation, and final mission validation",
    maximum: "maximum autonomous rigor with bounded aggressive repair",
  };
  return summaries[name] ? `${title} — ${summaries[name]}` : title;
}

export function workflowPresetMeaningLines(name: string, preset?: WorkflowPresetBundle): string[] {
  if (name === WORKFLOW_MANUAL_PRESET) return [
    "Name: Manual settings — no saved preset active",
    "Purpose: uses the current workflow settings exactly as saved; this is not a built-in speed or rigor profile.",
    "Applies to: the Standard, Plan, Mission, and shared sub-agent settings currently saved in workflow-settings.json.",
    "Standard Mode: uses the saved Standard Mode To Do, clarification, continuation, and sub-agent settings.",
    "Plan Mode: uses the saved planning depth, clarification, approval, review, validation, and repair settings.",
    "Mission Mode: uses the saved mission autonomy, approval, milestone continuation, validation, and retry settings.",
    "Shared sub-agents: uses the saved planning, execution, repair, review, and validation worker policies.",
    "Custom preset source: user workflow-settings.json, not package source.",
    "Extension updates preserve workflow-settings.json and do not overwrite custom presets.",
    "Does not change: models/providers/API keys/auth/session/runtime state/shared compaction settings.",
  ];
  const builtIn: Record<string, string[]> = {
    simple: [
      "Name: Simple — Fast Autonomous",
      "Purpose: fastest built-in profile for small or familiar work that should still validate before finishing.",
      "Applies to: Standard Mode, Plan Mode, Mission Mode, and shared sub-agent intensity.",
      "Standard Mode: creates a To Do only when useful, asks clarification only when useful, resumes automatically after answers, and uses one-worker phase support.",
      "Plan Mode: uses fast planning, avoids a second execution-approval stop after the initial approval, skips automatic review, runs lightweight validation, and allows a small safe repair retry budget.",
      "Mission Mode: starts after approval, auto-runs after approval, continues milestones without pause, keeps milestone validation on, and leaves final comprehensive validation off by default.",
      "Shared sub-agents: keeps planning, execution, repair, and validation lean with one-worker support; review remains available but is not forced automatically.",
      "Does not change: models/providers/API keys/auth/session/runtime state/shared compaction settings.",
    ],
    standard: [
      "Name: Standard — Balanced Autonomous",
      "Purpose: default built-in profile for normal work that should proceed end-to-end with balanced validation and repair.",
      "Applies to: Standard Mode, Plan Mode, Mission Mode, and shared sub-agent intensity.",
      "Standard Mode: creates a To Do for normal substantive work, asks useful clarification, resumes automatically after answers, and uses balanced Standard workers.",
      "Plan Mode: uses standard planning, avoids a second execution-approval stop after the initial approval, leaves review manual/optional, runs validation automatically, and performs safe repair/revalidation.",
      "Mission Mode: starts after approval, auto-runs after approval, continues milestones without pause, keeps milestone validation on, and leaves final comprehensive validation off by default.",
      "Shared sub-agents: uses one-worker planning and two-worker execution, repair, review, and validation when those phases run.",
      "Does not change: models/providers/API keys/auth/session/runtime state/shared compaction settings.",
    ],
    deep: [
      "Name: Deep — Careful Autonomous",
      "Purpose: higher-rigor built-in profile for broad, risky, or codebase-heavy work that still should not stall unnecessarily.",
      "Applies to: Standard Mode, Plan Mode, Mission Mode, and shared sub-agent intensity.",
      "Standard Mode: requires a To Do for substantive work, uses stronger clarification, resumes automatically after answers, and uses deeper Standard worker coverage.",
      "Plan Mode: uses deep planning, clarifies non-trivial work, avoids a second execution-approval stop after the initial approval, runs automatic review and validation, and retries safe repairs.",
      "Mission Mode: starts after approval, auto-runs after approval, continues milestones without pause, keeps milestone validation on, and enables final comprehensive validation.",
      "Shared sub-agents: forces larger teams across planning, execution, repair, review, and validation.",
      "Does not change: models/providers/API keys/auth/session/runtime state/shared compaction settings.",
    ],
    maximum: [
      "Name: Maximum — Thorough Autonomous",
      "Purpose: highest-rigor built-in profile for complex or high-risk work within bounded safety limits.",
      "Applies to: Standard Mode, Plan Mode, Mission Mode, and shared sub-agent intensity.",
      "Standard Mode: requires a To Do, uses the strongest clarification behavior, resumes automatically after answers, and uses maximum Standard worker coverage.",
      "Plan Mode: uses maximum planning, avoids a second execution-approval stop after the initial approval, runs automatic review and validation, and uses the largest bounded in-scope repair budget.",
      "Mission Mode: uses supervised-auto mission autonomy, auto-runs after approval, continues milestones without pause, keeps milestone and final validation on, and uses the highest bounded retry budget.",
      "Shared sub-agents: forces maximum teams across planning, execution, repair, review, and validation.",
      "Does not change: models/providers/API keys/auth/session/runtime state/shared compaction settings.",
    ],
  };
  if (builtIn[name]) return builtIn[name];
  return [
    `Name: ${workflowPresetTitle(name, preset)}`,
    `Purpose: ${preset?.description ?? "custom saved workflow preset."}`,
    "Applies to: the Standard, Plan, Mission, and shared sub-agent sections stored in this custom preset.",
    "Custom preset source: user workflow-settings.json, not package source.",
    "Extension updates preserve workflow-settings.json and do not overwrite custom presets.",
    ...(!preset?.standard ? ["Legacy/Incomplete: missing Standard Mode section; safe Standard defaults are applied when this preset is used."] : []),
    `Standard Mode: To Do ${preset?.standard?.todoTriggerMode ? standardTodoTriggerModeLabel(preset.standard.todoTriggerMode) : "safe defaults"}; clarification ${preset?.standard?.clarificationMode ?? "safe defaults"}; sub-agents ${preset?.standard?.allowSubagents === true ? "enabled" : preset?.standard?.allowSubagents === false ? "disabled" : "safe defaults"}.`,
    `Plan Mode: ${preset?.planning?.depth ?? "uses current"} planning; clarification ${preset?.planning?.clarificationMode ?? "uses current"}; max questions ${preset?.planning?.maxClarificationQuestions ?? "uses current"}; validation ${(preset?.workflow?.validateAfterExecution ?? preset?.workflow?.autoRunValidationAfterExecute) === true ? "automatic" : (preset?.workflow?.validateAfterExecution ?? preset?.workflow?.autoRunValidationAfterExecute) === false ? "manual/optional" : "uses current setting"}.`,
    `Mission Mode: autonomy ${preset?.missions?.defaultAutonomy ?? "uses current"}; auto-run after approval ${preset?.missions?.autoRunAfterApproval === true ? "enabled" : preset?.missions?.autoRunAfterApproval === false ? "disabled" : "uses current"}; milestone validation ${preset?.missions?.requireValidationPerMilestone === true ? "on" : preset?.missions?.requireValidationPerMilestone === false ? "off" : "uses current"}; final validation ${preset?.missions?.finalValidationEnabled === true ? "on" : preset?.missions?.finalValidationEnabled === false ? "off" : "uses current"}.`,
    `Shared sub-agents: planning ${preset?.subagents?.planningPolicy ?? "uses current"}; execution ${preset?.subagents?.executionPolicy ?? "uses current"}; repair ${preset?.subagents?.repairPolicy ?? "uses current"}; review ${preset?.subagents?.reviewPolicy ?? "uses current"}; validation ${preset?.subagents?.validationPolicy ?? "uses current"}.`,
    ...workflowPresetDiagnostics(name, preset),
    "Does not change: models/providers/API keys/auth/session/runtime state/shared compaction settings.",
  ];
}

export function renderWorkflowPresetCard(name: string, preset?: WorkflowPresetBundle, active = false): string {
  return `${active ? "* " : ""}${workflowPresetTitle(name, preset)}${active ? " (active)" : ""}\n${workflowPresetMeaningLines(name, preset).map((line) => `  ${line}`).join("\n")}`;
}

export function renderActiveWorkflowPresetSummary(settings: WorkflowSettings): string {
  const active = settings.presets?.activePreset ?? WORKFLOW_MANUAL_PRESET;
  const preset = active === WORKFLOW_MANUAL_PRESET ? undefined : workflowPresetCatalog(settings)[active];
  const lines = workflowPresetMeaningLines(active, preset);
  lines.push("Effective Settings: detailed current values are listed below.");
  if (active !== WORKFLOW_MANUAL_PRESET) lines.push(`Reapply Command: /workflow presets apply ${active}`);
  return lines.join("\n");
}

export function resolveWorkflowPresetName(settings: WorkflowSettings, input: string): string | undefined {
  const raw = input.trim();
  if (!raw) return undefined;
  const catalog = workflowPresetCatalog(settings);
  if (catalog[raw]) return raw;
  const lower = raw.toLowerCase();
  const exactLower = Object.keys(catalog).find((name) => name.toLowerCase() === lower || catalog[name]?.displayName?.toLowerCase() === lower);
  if (exactLower) return exactLower;
  const normalized = normalizeWorkflowPresetName(raw);
  const normalizedMatches = Object.keys(catalog).filter((name) => normalizeWorkflowPresetName(name) === normalized || normalizeWorkflowPresetName(catalog[name]?.displayName ?? "") === normalized);
  if (normalizedMatches.length === 1) return normalizedMatches[0];
  return undefined;
}

export function renderWorkflowPresets(settings: WorkflowSettings = loadGlobalSettings()): string {
  const catalog = workflowPresetCatalog(settings);
  const active = settings.presets?.activePreset ?? WORKFLOW_MANUAL_PRESET;
  const names = workflowPresetNames(settings);
  const cards = [renderWorkflowPresetCard(WORKFLOW_MANUAL_PRESET, undefined, active === WORKFLOW_MANUAL_PRESET), ...names.map((name) => renderWorkflowPresetCard(name, catalog[name], name === active))];
  return `# Workflow Presets\n\nActive Preset: ${activeWorkflowPresetLabel(settings)}\nShortcut: Ctrl+Shift+U cycles saved presets while Plan/Mission/Standard Mode is active\nSelector: /workflow presets\n\n${cards.join("\n\n") || "No presets available."}\n\nQuick commands:\n- /workflow presets list\n- /workflow presets apply <name>\n- /workflow presets next\n- /workflow presets prev\n- /workflow presets manual\n- /workflow presets save <name>\n- /workflow presets create <name> from simple|standard|deep|maximum\n- /workflow presets edit <name>\n- /workflow presets rename <old> to <new>\n- /workflow presets delete <name>\n\nBuilt-in presets are package-defined and sync with the extension. User-named custom presets are saved entries in workflow-settings.json and stay in hotkey cycling. Manual settings is only the no-saved-preset-active marker; extension updates preserve workflow-settings.json and do not overwrite custom presets. Presets adjust workflow behavior only and preserve model/provider choices, API keys, auth/session files, runtime workflow state, and shared compaction settings.`;
}

export function applyWorkflowPreset(cwd: string, requestedScope: WorkflowSettingsScope | undefined, name: string): SettingsWriteResult {
  return updateSettings(cwd, requestedScope, (settings) => {
    const resolved = resolveWorkflowPresetName(settings, name);
    const preset = resolved ? workflowPresetCatalog(settings)[resolved] : undefined;
    if (!resolved || !preset) throw new Error(`Unknown workflow preset: ${name}`);
    applyPresetBundle(settings, preset, resolved);
  }, { preserveActivePreset: true });
}

export function saveCurrentWorkflowPreset(cwd: string, requestedScope: WorkflowSettingsScope | undefined, name: string): SettingsWriteResult {
  const safe = normalizeWorkflowPresetName(name);
  if (!safe) throw new Error("Preset name is required.");
  assertValidCustomPresetName(name, safe);
  return updateSettings(cwd, requestedScope, (settings) => {
    settings.presets = { ...(settings.presets ?? {}), activePreset: safe, items: { ...(settings.presets?.items ?? {}) } };
    const { models: _ignoredStandardModels, ...standardPreset } = settings.standard;
    settings.presets.items![safe] = {
      displayName: name.trim(),
      description: "Custom saved workflow preset.",
      planning: { ...settings.planning },
      workflow: { ...settings.workflow },
      standard: { ...standardPreset },
      missions: { ...settings.missions, models: undefined } as WorkflowPresetBundle["missions"],
      subagents: { ...settings.subagents },
      ui: { showWorkflowStatus: settings.ui.showWorkflowStatus, showPlanModeIndicator: settings.ui.showPlanModeIndicator, planTopWidgetVisible: settings.ui.planTopWidgetVisible, planBottomWidgetVisible: settings.ui.planBottomWidgetVisible, missionTopWidgetVisible: settings.ui.missionTopWidgetVisible, missionBottomWidgetVisible: settings.ui.missionBottomWidgetVisible, workflowTheme: settings.ui.workflowTheme, workflowThemeOverrides: settings.ui.workflowThemeOverrides, startupVisual: settings.ui.startupVisual, startupVisualOnSessionStart: settings.ui.startupVisualOnSessionStart, customBrandEnabled: settings.ui.customBrandEnabled, customBrandText: settings.ui.customBrandText },
    };
  }, { preserveActivePreset: true });
}

export function createWorkflowPreset(cwd: string, requestedScope: WorkflowSettingsScope | undefined, name: string, templateName?: string): SettingsWriteResult {
  const safe = normalizeWorkflowPresetName(name);
  if (!safe) throw new Error("Preset name is required.");
  assertValidCustomPresetName(name, safe);
  return updateSettings(cwd, requestedScope, (settings) => {
    const resolvedTemplate = templateName ? resolveWorkflowPresetName(settings, templateName) : undefined;
    const template = resolvedTemplate ? workflowPresetCatalog(settings)[resolvedTemplate] : undefined;
    if (templateName && !template) throw new Error(`Unknown workflow preset template: ${templateName}`);
    settings.presets = { ...(settings.presets ?? {}), items: { ...(settings.presets?.items ?? {}) } };
    settings.presets.items![safe] = template ? { ...workflowPresetBundleWithoutUserOwnedSettings(template), displayName: name.trim(), description: `Custom preset created from ${resolvedTemplate}.` } : { displayName: name.trim(), description: "Custom workflow preset.", planning: {}, workflow: {}, standard: {}, missions: {}, subagents: {}, ui: {} };
  }, { preserveActivePreset: true });
}

export function renameWorkflowPreset(cwd: string, requestedScope: WorkflowSettingsScope | undefined, oldName: string, newName: string): SettingsWriteResult {
  const safe = normalizeWorkflowPresetName(newName);
  if (!safe) throw new Error("New preset name is required.");
  assertValidCustomPresetName(newName, safe);
  if (builtInWorkflowPresets()[oldName]) throw new Error(`Cannot rename built-in workflow preset: ${oldName}`);
  return updateSettings(cwd, requestedScope, (settings) => {
    const resolved = resolveWorkflowPresetName(settings, oldName);
    if (!resolved || builtInWorkflowPresets()[resolved]) throw new Error(`Cannot rename unknown or built-in workflow preset: ${oldName}`);
    const items = { ...(settings.presets?.items ?? {}) };
    const existing = items[resolved];
    if (!existing) throw new Error(`Unknown workflow preset: ${oldName}`);
    delete items[resolved];
    items[safe] = { ...existing, displayName: newName.trim() };
    settings.presets = { ...(settings.presets ?? {}), activePreset: settings.presets?.activePreset === resolved ? safe : settings.presets?.activePreset, items };
  }, { preserveActivePreset: true });
}

export function deleteWorkflowPreset(cwd: string, requestedScope: WorkflowSettingsScope | undefined, name: string): SettingsWriteResult {
  if (builtInWorkflowPresets()[name]) throw new Error(`Cannot delete built-in workflow preset: ${name}`);
  return updateSettings(cwd, requestedScope, (settings) => {
    const resolved = resolveWorkflowPresetName(settings, name);
    if (!resolved || builtInWorkflowPresets()[resolved]) throw new Error(`Cannot delete unknown or built-in workflow preset: ${name}`);
    const items = { ...(settings.presets?.items ?? {}) };
    delete items[resolved];
    settings.presets = { ...(settings.presets ?? {}), activePreset: settings.presets?.activePreset === resolved ? "custom" : settings.presets?.activePreset, items };
  }, { preserveActivePreset: true });
}

export function getModelForRole(role: WorkflowRole): RoleModelSettings {
  return loadWorkflowSettings().models[role];
}

export function setModelForRole(role: WorkflowRole, provider: string, model: string, cwd?: string, scope?: WorkflowSettingsScope): SettingsWriteResult {
  return updateSettings(cwd ?? process.cwd(), scope, (settings) => {
    settings.models[role] = { ...settings.models[role], provider, model };
  });
}

export function setRoleEnabled(role: WorkflowRole, enabled: boolean, cwd?: string, scope?: WorkflowSettingsScope): SettingsWriteResult {
  return updateSettings(cwd ?? process.cwd(), scope, (settings) => {
    settings.models[role] = { ...settings.models[role], enabled };
  });
}

export function setThinkingForRole(role: WorkflowRole, thinkingLevel: ThinkingLevel, cwd?: string, scope?: WorkflowSettingsScope): SettingsWriteResult {
  return updateSettings(cwd ?? process.cwd(), scope, (settings) => {
    settings.models[role] = { ...settings.models[role], thinkingLevel };
  });
}

export function setStandardModelForRole(role: WorkflowRole, provider: string, model: string, cwd?: string, scope?: WorkflowSettingsScope): SettingsWriteResult {
  return updateSettings(cwd ?? process.cwd(), scope, (settings) => {
    const models = settings.standard.models ?? normalizeStandardModels(defaultWorkflowSettings(), settings.standard);
    models[role] = { ...models[role], enabled: true, provider, model };
    settings.standard.models = models;
    settings.standard.useSharedExecutorModel = true;
    settings.standard.useStandardSpecificModels = true;
    if (!settings.standard.modelRole || settings.standard.modelRole === "current") settings.standard.modelRole = role;
  });
}

export function setStandardThinkingForRole(role: WorkflowRole, thinkingLevel: ThinkingLevel, cwd?: string, scope?: WorkflowSettingsScope): SettingsWriteResult {
  return updateSettings(cwd ?? process.cwd(), scope, (settings) => {
    const models = settings.standard.models ?? normalizeStandardModels(defaultWorkflowSettings(), settings.standard);
    models[role] = { ...models[role], thinkingLevel };
    settings.standard.models = models;
    settings.standard.useSharedExecutorModel = true;
    settings.standard.useStandardSpecificModels = true;
    if (!settings.standard.modelRole || settings.standard.modelRole === "current") settings.standard.modelRole = role;
  });
}

export function setMissionModelForRole(role: MissionModelRole, provider: string, model: string, cwd?: string, scope?: WorkflowSettingsScope): SettingsWriteResult {
  return updateSettings(cwd ?? process.cwd(), scope, (settings) => {
    const models = settings.missions.models ?? normalizeMissionModels(defaultWorkflowSettings(), settings.missions);
    models[role] = { ...models[role], enabled: true, provider, model };
    settings.missions.models = models;
  });
}

export function setMissionThinkingForRole(role: MissionModelRole, thinkingLevel: ThinkingLevel, cwd?: string, scope?: WorkflowSettingsScope): SettingsWriteResult {
  return updateSettings(cwd ?? process.cwd(), scope, (settings) => {
    const models = settings.missions.models ?? normalizeMissionModels(defaultWorkflowSettings(), settings.missions);
    models[role] = { ...models[role], thinkingLevel };
    settings.missions.models = models;
  });
}

export function parseRole(value: string): WorkflowRole | undefined {
  return ["planner", "executor", "validator", "reviewer"].includes(value) ? (value as WorkflowRole) : undefined;
}

export function parseMissionModelRole(value: string): MissionModelRole | undefined {
  return ["planner", "executor", "validator", "reviewer"].includes(value) ? (value as MissionModelRole) : undefined;
}

export function parseThinkingLevel(value: string): ThinkingLevel | undefined {
  return ["off", "minimal", "low", "medium", "high", "xhigh"].includes(value) ? (value as ThinkingLevel) : undefined;
}

export function roleIsConfigured(role: RoleModelSettings): boolean {
  return Boolean(role.provider && role.model);
}

export function effectivePlanApprovalRequired(settings: WorkflowSettings): boolean {
  return (settings.workflow.requirePlanApprovalBeforeExecute ?? settings.workflow.requireApprovalBeforeExecution) !== false;
}

export function effectiveValidateAfterExecution(settings: WorkflowSettings): boolean {
  return (settings.workflow.validateAfterExecution ?? settings.workflow.autoRunValidationAfterExecute) !== false;
}

export function effectiveReviewAutoRun(settings: WorkflowSettings): boolean {
  return settings.workflow.autoRunReviewerBeforeExecute === true;
}

export function effectiveValidationAutoRun(settings: WorkflowSettings): boolean {
  return settings.workflow.autoRunValidationAfterExecute === true && effectiveValidateAfterExecution(settings);
}

export function effectiveRepairGate(settings: WorkflowSettings, gate: RepairRetryGateName): RepairRetryGateSettings {
  const defaults = settings.workflow.repairRetry?.defaults ?? {};
  const configured = settings.workflow.repairRetry?.gates?.[gate] ?? {};
  const fallback: RepairRetryGateSettings = gate === "review"
    ? {
        autoRepairFailures: settings.workflow.autoRepairReviewFailures,
        retryMode: settings.workflow.reviewRetryMode,
        maxRetriesPerItem: settings.workflow.maxReviewRetriesPerPlan,
        maxRetriesPerWorkflow: settings.workflow.maxReviewRetriesPerWorkflow,
        pauseAfterFailure: settings.workflow.pauseAfterReviewFailure,
      }
    : gate === "validation"
      ? {
          autoRepairFailures: settings.workflow.autoRepairValidationFailures,
          retryMode: settings.workflow.validationRetryMode,
          maxRetriesPerItem: settings.workflow.maxValidationRetriesPerPlan,
          maxRetriesPerWorkflow: settings.workflow.maxValidationRetriesPerWorkflow,
          pauseAfterFailure: settings.workflow.pauseAfterValidationFailure,
          requireApprovalForOutOfScopeRepair: settings.workflow.requireApprovalForOutOfScopeRepair,
          requireApprovalForDestructiveRepair: settings.workflow.requireApprovalForDestructiveRepair,
        }
      : {};
  return { ...defaults, ...fallback, ...configured };
}

export function workflowSettingsConsistencyDiagnostics(settings: WorkflowSettings): string[] {
  const diagnostics: string[] = [];
  const workflow = settings.workflow;
  if (workflow.validateAfterExecution !== undefined && workflow.validateAfterExecution !== workflow.autoRunValidationAfterExecute) {
    diagnostics.push(`validation alias mismatch: validateAfterExecution=${workflow.validateAfterExecution} but autoRunValidationAfterExecute=${workflow.autoRunValidationAfterExecute}`);
  }
  if (workflow.requireApprovalBeforeExecution !== undefined && workflow.requireApprovalBeforeExecution !== workflow.requirePlanApprovalBeforeExecute) {
    diagnostics.push(`approval alias mismatch: requireApprovalBeforeExecution=${workflow.requireApprovalBeforeExecution} but requirePlanApprovalBeforeExecute=${workflow.requirePlanApprovalBeforeExecute}`);
  }
  const repair = workflow.repairRetry;
  const validationGate = repair?.gates?.validation;
  if (validationGate?.autoRepairFailures !== undefined && validationGate.autoRepairFailures !== workflow.autoRepairValidationFailures) {
    diagnostics.push(`validation repair alias mismatch: repairRetry.gates.validation.autoRepairFailures=${validationGate.autoRepairFailures} but autoRepairValidationFailures=${workflow.autoRepairValidationFailures}`);
  }
  const reviewGate = repair?.gates?.review;
  if (reviewGate?.autoRepairFailures !== undefined && reviewGate.autoRepairFailures !== workflow.autoRepairReviewFailures) {
    diagnostics.push(`review repair alias mismatch: repairRetry.gates.review.autoRepairFailures=${reviewGate.autoRepairFailures} but autoRepairReviewFailures=${workflow.autoRepairReviewFailures}`);
  }
  if (settings.missions.defaultAutonomy === "full_auto" && settings.missions.allowFullAuto !== true) {
    diagnostics.push("mission autonomy mismatch: defaultAutonomy=full_auto but allowFullAuto=false, so full auto will be blocked");
  }
  if (settings.missions.finalValidationEnabled === true && (!settings.models.validator.enabled || !roleIsConfigured(settings.models.validator))) {
    diagnostics.push("mission final validation is enabled but the shared validator model is disabled or unconfigured");
  }
  if (settings.context.compactionMode === "custom_model" && (!settings.context.compactionModelProvider || !settings.context.compactionModel)) {
    diagnostics.push("custom compaction model mode is selected but compaction provider/model is incomplete");
  }
  if (settings.context.compactionMode === "custom_model" && settings.context.customCompactionEnabled !== true) {
    diagnostics.push("custom compaction mode is selected but customCompactionEnabled is not set — custom compaction will not activate");
  }
  if (settings.context.customCompactionEnabled === true && settings.context.compactionMode !== "custom_model") {
    diagnostics.push(`customCompactionEnabled=true but compactionMode=${settings.context.compactionMode}`);
  }
  if (settings.missions.autoRepairReviewFailures !== false && settings.missions.reviewRetryMode === "off") {
    diagnostics.push("mission review auto-repair is enabled but reviewRetryMode is off — override to safe_only will be applied at runtime; set reviewRetryMode explicitly to avoid confusion");
  }
  const activePreset = settings.presets?.activePreset ?? WORKFLOW_MANUAL_PRESET;
  if ((activePreset === "standard" || activePreset === "deep" || activePreset === "maximum")
    && (settings.missions.autoRepairReviewFailures === false || settings.missions.reviewRetryMode === "off" || (settings.missions.maxReviewRetriesPerMission ?? 0) <= 0)) {
    diagnostics.push(`active preset ${activePreset} expects Mission review repair to be available, but effective Mission review repair is disabled/off/zero; reapply the preset or update missions.autoRepairReviewFailures, missions.reviewRetryMode, and missions.maxReviewRetriesPerMission`);
  }
  if (settings.missions.autoRepairValidationFailures !== false && settings.missions.validationRetryMode === "off") {
    diagnostics.push("mission validation auto-repair is enabled but validationRetryMode is off — override to safe_only will be applied at runtime; set validationRetryMode explicitly to avoid confusion");
  }
  if (settings.missions.watchdogEnabled === true) {
    diagnostics.push("mission watchdog is enabled but interval/watchdog enforcement is partial in the current MVP");
  }
  if (settings.subagents.allowParallelEdits === true || settings.subagents.editConcurrencyMode === "scoped") {
    diagnostics.push("parallel edit settings are advanced/partial; main workflow writes remain serialized unless scoped conflict protection is implemented");
  }
  return diagnostics;
}

export function formatRole(role: WorkflowRole, settings = loadWorkflowSettings()): string {
  const model = settings.models[role];
  const label = role.charAt(0).toUpperCase() + role.slice(1);
  if (!model.enabled) return `${label}: disabled`;
  if (!roleIsConfigured(model)) return `${label}: enabled, not configured`;
  return `${label}: enabled, ${model.provider}/${model.model}, thinking: ${model.thinkingLevel}`;
}

export function renderWorkflowModels(settings: WorkflowSettings): string {
  return `${formatRole("planner", settings)}\n${formatRole("executor", settings)}\n${formatRole("validator", settings)}\n${formatRole("reviewer", settings)}`;
}

export function standardModelSource(settings: WorkflowSettings): StandardModelSource {
  if (settings.standard.useSharedExecutorModel === false || settings.standard.modelRole === "current") return "current";
  return settings.standard.useStandardSpecificModels === true ? "standard_specific" : "shared";
}

export function workflowRoleLabel(role: WorkflowRole | StandardModelRole): string {
  if (role === "current") return "Current Pi model";
  return role.charAt(0).toUpperCase() + role.slice(1);
}

export function standardModelSourceLabel(source: StandardModelSource): string {
  if (source === "standard_specific") return "Standard-specific";
  if (source === "shared") return "Shared";
  return "Current Pi model";
}

export function compactionModeLabel(mode: CompactionMode): string {
  if (mode === "pi_default") return "Pi default";
  if (mode === "custom_model") return "Custom model";
  if (mode === "custom_agent") return "Custom agent";
  return "Disabled";
}

export function workflowCompactionCheckModeLabel(mode: WorkflowCompactionCheckMode | undefined): string {
  return mode === "in_session" ? "In-session" : "Boundary only";
}

export function standardTodoTriggerModeLabel(value?: StandardTodoTriggerMode): string {
  if (value === "off") return "Disabled";
  if (value === "manual") return "On request";
  if (value === "required") return "Required";
  return "Automatic when useful";
}

function standardRoleRoute(settings: WorkflowSettings, role: WorkflowRole): { source: StandardModelSource; route: RoleModelSettings } {
  const source = standardModelSource(settings);
  const standardRoute = settings.standard.models?.[role];
  if (source === "standard_specific" && standardRoute?.provider && standardRoute?.model) return { source, route: standardRoute };
  if (source === "standard_specific") return { source: "shared", route: settings.models[role] };
  if (source === "current") return { source, route: settings.models[role] };
  return { source: "shared", route: settings.models[role] };
}

export function renderStandardModelStrategy(settings: WorkflowSettings): string {
  const source = standardModelSource(settings);
  const role = settings.standard.modelRole ?? "executor";
  const effectiveRole = role === "current" ? "current" : role;
  const lines = [`Standard Model Source: ${standardModelSourceLabel(source)}`, `Standard Model Role: ${workflowRoleLabel(effectiveRole)}`];
  if (effectiveRole === "current" || source === "current") lines.push("Effective Standard Model: Current active Pi model");
  else {
    const route = standardRoleRoute(settings, effectiveRole as WorkflowRole);
    const fallback = source === "standard_specific" && route.source === "shared" ? " (Standard-specific route not configured; falling back to Shared)" : "";
    lines.push(`Effective Standard Model: ${standardModelSourceLabel(route.source)} ${workflowRoleLabel(effectiveRole as WorkflowRole)} — ${modelLabelForRoute(route.route)}${fallback}`);
  }
  lines.push("", "## Standard-Specific Models");
  const standardModels = settings.standard.models ?? normalizeStandardModels(defaultWorkflowSettings(), settings.standard);
  lines.push(`Planner: ${modelLabelForRoute(standardModels.planner)}`);
  lines.push(`Executor: ${modelLabelForRoute(standardModels.executor)}`);
  lines.push(`Validator: ${modelLabelForRoute(standardModels.validator)}`);
  lines.push(`Reviewer: ${modelLabelForRoute(standardModels.reviewer)}`);
  lines.push("", "## Shared Workflow Models", renderWorkflowModels(settings));
  return lines.join("\n");
}

function modelLabelForRoute(model: RoleModelSettings): string {
  return roleIsConfigured(model) ? `${model.provider}/${model.model}, thinking: ${model.thinkingLevel}` : `not configured, thinking: ${model.thinkingLevel}`;
}

async function applySpecificModel(pi: ExtensionAPI, ctx: ExtensionContext, label: string, route: RoleModelSettings, requireEnabled: boolean): Promise<RoleModelSettings | undefined> {
  if (requireEnabled && !route.enabled) {
    ctx.ui.notify(`Workflow: ${label} is disabled. Enable/configure it in /workflow-settings.`, "warning");
    return undefined;
  }
  if (!roleIsConfigured(route)) {
    ctx.ui.notify(`Workflow: ${label} model is not configured. Use /workflow-settings or /workflow models list.`, "error");
    return undefined;
  }
  if (route.askBeforeRun === true) {
    if (!ctx.hasUI) {
      ctx.ui.notify(`Workflow: ${label} askBeforeRun=true but no UI is available to approve the run.`, "warning");
      return undefined;
    }
    const approved = await ctx.ui.confirm(
      `Run ${label}?`,
      `Configured model: ${route.provider}/${route.model}\nThinking: ${route.thinkingLevel}\n\nThis role has askBeforeRun=true.`,
    );
    if (!approved) {
      ctx.ui.notify(`Workflow: ${label} run cancelled by askBeforeRun gate.`, "info");
      return undefined;
    }
  }

  const model = ctx.modelRegistry.find(route.provider!, route.model!);
  if (!model) {
    const available = ctx.modelRegistry.getAll().slice(0, 40).map((m) => `${m.provider}/${m.id}`).join("\n");
    ctx.ui.notify(`Workflow: configured ${label} model not found: ${route.provider}/${route.model}. Use /workflow-settings. Available examples:\n${available}`, "error");
    return undefined;
  }

  const ok = await pi.setModel(model);
  if (!ok) {
    ctx.ui.notify(`Workflow: no API key for configured ${label} model: ${route.provider}/${route.model}.`, "error");
    return undefined;
  }

  pi.setThinkingLevel(route.thinkingLevel);
  const appliedThinking = pi.getThinkingLevel();
  if (appliedThinking !== route.thinkingLevel) {
    ctx.ui.notify(`Workflow: configured ${label} thinking ${route.thinkingLevel} was applied as ${appliedThinking}. Pi may have clamped the level for ${route.provider}/${route.model}.`, "warning");
  }
  return route;
}

export async function applyModelForRole(pi: ExtensionAPI, ctx: ExtensionContext, role: WorkflowRole, options: { requireEnabled?: boolean; cwd?: string } = {}): Promise<RoleModelSettings | undefined> {
  const settings = loadWorkflowSettings(options.cwd);
  return applySpecificModel(pi, ctx, role, settings.models[role], options.requireEnabled !== false);
}

export async function applyStandardModelForRole(pi: ExtensionAPI, ctx: ExtensionContext, role: WorkflowRole, options: { requireEnabled?: boolean; cwd?: string } = {}): Promise<RoleModelSettings | undefined> {
  const settings = loadWorkflowSettings(options.cwd);
  const source = standardModelSource(settings);
  if (source === "current") return undefined;
  const route = standardRoleRoute(settings, role);
  return applySpecificModel(pi, ctx, route.source === "standard_specific" ? `standard ${role}` : role, route.route, options.requireEnabled !== false);
}

export async function applyMissionModelForRole(pi: ExtensionAPI, ctx: ExtensionContext, role: WorkflowRole, options: { requireEnabled?: boolean; cwd?: string } = {}): Promise<RoleModelSettings | undefined> {
  const settings = loadWorkflowSettings(options.cwd);
  const missionModels = settings.missions.models;
  const missionRoute = missionModels?.[role];
  if (settings.missions.useMissionSpecificModels && missionRoute?.provider && missionRoute?.model) {
    return applySpecificModel(pi, ctx, `mission ${role}`, missionRoute, options.requireEnabled !== false);
  }
  return applyModelForRole(pi, ctx, role, options);
}

// No-op default export so this helper module can be safely auto-discovered as a Pi extension.
export default function workflowSuiteNoopExtension(): void {}
