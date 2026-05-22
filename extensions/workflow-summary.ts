import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { WORKFLOW_SETTINGS_FILE, formatRole, loadEffectiveSettings, loadGlobalSettings, loadWorkflowSettings, renderWorkflowModels, roleIsConfigured, workflowSettingsDiagnostics, type WorkflowSettings } from "./workflow-model-router.js";
import { ACTIVE_STATE_FILE, compact, isMissionRuntimeActiveStatus, isPlanRuntimeActiveMode, loadMissionState, missionActiveRuntimeMs, missionRuntimeCounterState, missionWallClockAgeMs, planActiveRuntimeMs, planRuntimeCounterState, planWallClockAgeMs, isStandardRuntimeActive, standardActiveRuntimeMs, standardRuntimeCounterState, standardWallClockAgeMs, type MissionState, type WorkflowState } from "./workflow-state.js";

const WORKFLOW_SUITE_SESSION_STATE_TYPE = "workflow-suite-state";
const WORKFLOW_SUITE_SAFE_MODE_ENV = "PI_WORKFLOW_SUITE_SAFE_MODE";
const LEGACY_WORKFLOW_SAFE_MODE_ENV = "PI_WORKFLOW_KIT_SAFE_MODE";

function safeGit(cwd: string, args: string[]): string | undefined {
  try {
    return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], timeout: 2000 }).trim() || undefined;
  } catch {
    return undefined;
  }
}

function safeReadText(path: string, maxBytes = 80_000): string | undefined {
  try {
    return readFileSync(path, "utf8").slice(0, maxBytes);
  } catch {
    return undefined;
  }
}

function safeReadPackageJson(root: string): Record<string, unknown> | undefined {
  const text = safeReadText(join(root, "package.json"));
  if (!text) return undefined;
  try {
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === "object" ? parsed as Record<string, unknown> : undefined;
  } catch {
    return undefined;
  }
}

function dependencyNames(pkg: Record<string, unknown> | undefined): Set<string> {
  const names = new Set<string>();
  for (const key of ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"]) {
    const deps = pkg?.[key];
    if (deps && typeof deps === "object") Object.keys(deps as Record<string, unknown>).forEach((name) => names.add(name));
  }
  return names;
}

function countFiles(root: string, predicate: (name: string) => boolean, maxDepth = 3): number {
  const ignored = new Set([".git", "node_modules", ".next", "dist", "build", ".cache", ".venv", "venv", "__pycache__"]);
  let count = 0;
  const walk = (dir: string, depth: number): void => {
    if (depth > maxDepth || count >= 200) return;
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (count >= 200) return;
      if (entry.isDirectory()) {
        if (!ignored.has(entry.name)) walk(join(dir, entry.name), depth + 1);
      } else if (entry.isFile() && predicate(entry.name)) {
        count += 1;
      }
    }
  };
  walk(root, 0);
  return count;
}

function detectProjectProfile(root: string, pkg: Record<string, unknown> | undefined): string {
  const deps = dependencyNames(pkg);
  const markers: string[] = [];
  const has = (rel: string): boolean => existsSync(join(root, rel));
  const pyText = `${safeReadText(join(root, "pyproject.toml"), 40_000) ?? ""}\n${safeReadText(join(root, "requirements.txt"), 40_000) ?? ""}`.toLowerCase();
  const pyCount = countFiles(root, (name) => name.endsWith(".py"));

  if (deps.has("next") || has("next.config.js") || has("next.config.mjs") || has("next.config.ts")) markers.push("Next.js");
  if (deps.has("react")) markers.push("React");
  if (has("tsconfig.json") || deps.has("typescript")) markers.push("TypeScript");
  if (pkg && markers.length === 0) markers.push("Node.js package/application");
  if (has("manage.py") || pyText.includes("django")) markers.push("Django/Python");
  else if (pyText.includes("fastapi")) markers.push("FastAPI/Python");
  else if (pyCount > 0 || has("pyproject.toml") || has("requirements.txt") || has("setup.py")) markers.push(`Python application${pyCount > 0 ? ` (${pyCount}${pyCount >= 200 ? "+" : ""} .py files detected)` : ""}`);

  return markers.length ? Array.from(new Set(markers)).join(" + ") : "unknown (no package/application markers detected)";
}

function detectedInstructionFiles(root: string): string[] {
  const files = ["AGENTS.md", "SYSTEM.md", "CLAUDE.md", ".cursor/rules", ".factory/rules", ".factory/memories.md"];
  return files.filter((rel) => existsSync(join(root, rel)));
}

function gitChangedFilesLine(status: string | undefined): string {
  if (status === undefined) return "unknown (not a git repository or git unavailable)";
  const lines = status.split("\n").map((line) => line.trim()).filter(Boolean);
  if (!lines.length) return "clean";
  const files = lines.map((line) => line.length > 3 ? line.slice(3).trim() : line).filter(Boolean);
  const preview = files.slice(0, 16).join(", ");
  return `${files.length} changed/untracked file(s): ${preview}${files.length > 16 ? ", ..." : ""}`;
}

function workflowSuitePublicImpact(root: string, pkg: Record<string, unknown> | undefined, status: string | undefined): string {
  if (pkg?.name !== "@mediadatafusion/pi-workflow-suite") return "not applicable unless the target repo is the Pi Workflow Suite package";
  const files = (status ?? "").split("\n").map((line) => line.trim().slice(3).trim()).filter(Boolean);
  if (!files.length) return "Pi Workflow Suite package repo detected; no current git changes detected";
  const publicPrefixes = ["extensions/", "agents/", "skills/", "config/", "docs/", "scripts/", "README.md", "LICENSE.md", "package.json", "package-lock.json", "tsconfig.json", "AGENTS.md"];
  const publicFiles = files.filter((file) => publicPrefixes.some((prefix) => file === prefix || file.startsWith(prefix)));
  return publicFiles.length ? `yes — public/live package files touched: ${publicFiles.slice(0, 12).join(", ")}${publicFiles.length > 12 ? ", ..." : ""}` : "Pi Workflow Suite package repo detected; changed files are not in public package paths";
}

export function renderHandoffProjectContext(cwd?: string): string {
  const current = cwd ?? process.cwd();
  const repoRoot = safeGit(current, ["rev-parse", "--show-toplevel"]);
  const root = repoRoot ?? current;
  const pkg = safeReadPackageJson(root);
  const branch = safeGit(root, ["branch", "--show-current"]) ?? safeGit(root, ["rev-parse", "--abbrev-ref", "HEAD"]);
  const head = safeGit(root, ["rev-parse", "--short", "HEAD"]);
  const status = safeGit(root, ["status", "--short"]);
  const instructions = detectedInstructionFiles(root);
  const isSuite = pkg?.name === "@mediadatafusion/pi-workflow-suite";
  return `## Target Application Context
- CWD: ${current}
- Git root: ${repoRoot ?? "not detected"}
- Branch: ${branch ?? "unknown"}
- HEAD: ${head ?? "unknown"}
- Application profile: ${detectProjectProfile(root, pkg)}
- Project instructions detected: ${instructions.length ? instructions.join(", ") : "none"}
- Changed files: ${gitChangedFilesLine(status)}

## Pi Workflow Suite Context
- Target is Pi Workflow Suite package repo: ${isSuite ? "yes" : "no"}
- Context boundary: keep the target application repo, the Workflow Suite DEV worktree, the live Pi runtime, and the public main package mirror distinct.
- Public package impact: ${workflowSuitePublicImpact(root, pkg, status)}
- Live runtime sync: only confirmed when scripts/install-to-live.sh has been run and reports auth/settings/sessions/workflow state were not touched.
- Promotion expectation for suite package changes: validate on DEV, sync live when requested, promote the same public-safe files to main, validate main, push both branches, then verify origin/main..origin/DEV parity.`;
}

function planNeedsClarification(text?: string): boolean {
  if (!text) return false;
  if (/^PLAN_DECISION:\s*clarify/im.test(text)) return true;
  if (/^#{0,3}\s*Clarifying Questions:?\s*$/im.test(text)) return true;
  if (/Status:\s*(NOT READY|READY AFTER QUESTIONS)/i.test(text)) return true;
  return false;
}

function planStatus(state: WorkflowState): string {
  if (state.approvedPlan) return "Approved";
  if (state.draftPlan) return "Draft";
  return "None";
}

function isMissionMode(mode: string): boolean {
  return mode === "awaiting_mission_input" || mode.startsWith("mission_");
}

function isStandardMode(mode: string): boolean {
  return mode === "standard";
}

function standardClarificationLabel(settings: WorkflowSettings, state: WorkflowState): string {
  const mode = settings.standard.clarificationEnabled === false || settings.standard.clarificationMode === "off" || settings.standard.clarificationMode === "never"
    ? "never"
    : settings.standard.clarificationMode === "always_for_nontrivial"
      ? "always_for_nontrivial"
      : "auto";
  return `${mode}${state.standardClarificationPending ? " (pending)" : ""}`;
}

function formatDurationMs(ms: number): string {
  const safe = Math.max(0, ms);
  const days = Math.floor(safe / 86_400_000);
  const hours = Math.floor((safe % 86_400_000) / 3_600_000);
  const minutes = Math.floor((safe % 3_600_000) / 60_000);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function standardRuntimeLines(state: WorkflowState): string {
  return `Standard Runtime ID: ${state.standardRuntime?.id ?? "none"}\nStandard Active Runtime: ${formatDurationMs(standardActiveRuntimeMs(state))} active${isStandardRuntimeActive(state) ? " and running" : ""}\nStandard Elapsed Since Created: ${formatDurationMs(standardWallClockAgeMs(state))}\nStandard Runtime Counter: ${standardRuntimeCounterState(state)}`;
}

function displayLabel(text: string | undefined, max = 120): string {
  const cleaned = (text ?? "none")
    .replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}\uFE0F]/gu, "")
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/^\s*(?:[-*+]\s+|\d{1,3}[.)\-:]\s+)/, "")
    .replace(/\s+/g, " ")
    .trim();
  return compact(cleaned || "none", max).replace(/\n/g, " ");
}

function standardProgressLines(state: WorkflowState): string {
  const todo = state.standardTodo;
  const runtime = standardRuntimeLines(state);
  if (!todo?.items?.length) return `${runtime}\nStandard To Do: none`;
  const completed = todo.items.filter((item) => item.status === "completed" || item.status === "skipped").length;
  const current = todo.items[Math.max(0, Math.min(todo.currentItemIndex ?? 0, todo.items.length - 1))];
  return `${runtime}\nStandard To Do: ${completed} / ${todo.items.length} (${Math.round((completed / todo.items.length) * 100)}%)\nStandard Status: ${todo.status}\nStandard Current: ${current ? `${(todo.currentItemIndex ?? 0) + 1} of ${todo.items.length} - ${displayLabel(current.title)} (${current.status})` : "none"}`;
}

function missionRuntimeLines(mission?: MissionState, state?: WorkflowState): string {
  const completedSummary = state?.lastCompletedMissionSummary;
  if (completedSummary && state?.mode === "awaiting_mission_input") {
    return `Mission Active Runtime: ${formatDurationMs(completedSummary.activeRuntimeMs)} active\nMission Wall Clock Age: ${formatDurationMs(completedSummary.elapsedMs)}\nMission Runtime Counter: completed\nMission Progress: ${completedSummary.milestonesCompleted} / ${completedSummary.milestonesTotal}\nMission Validation: ${completedSummary.validationResult}\nMission Repair Retry: ${completedSummary.repairRetries} / ${completedSummary.maxRepairRetries}\nMission Repair Status: ${completedSummary.repairStatus ?? "none"}`;
  }
  if (!mission) return "Mission Active Runtime: unknown\nMission Wall Clock Age: unknown\nMission Runtime Counter: unknown";
  return `Mission Active Runtime: ${formatDurationMs(missionActiveRuntimeMs(mission))} active${isMissionRuntimeActiveStatus(mission.status) ? " and running" : ""}\nMission Wall Clock Age: ${formatDurationMs(missionWallClockAgeMs(mission))}\nMission Runtime Counter: ${missionRuntimeCounterState(mission)}`;
}

function stripMarkdownInline(text: string): string {
  return text
    .replace(/^\[[ xX-]\]\s*/, "")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

function collectStatusPlanListSteps(section: string): string[] {
  const normalize = (raw: string): string | undefined => {
    const title = stripMarkdownInline(raw.replace(/\s+[-–—]\s+.*$/, ""));
    return title && !/^status:\s*/i.test(title) ? title : undefined;
  };
  const numbered: string[] = [];
  const bullets: string[] = [];
  for (const line of section.split("\n")) {
    const topNumbered = line.match(/^\s{0,3}(?:\d+|Step\s+\d+)\s*[.)\-:]\s+(.+)/i);
    const topCheckbox = line.match(/^\s{0,3}[-*]\s*\[[ xX-]\]\s+(.+)/);
    const topBullet = line.match(/^\s{0,3}[-*]\s+(.+)/);
    const numberedTitle = topNumbered ? normalize(topNumbered[1]) : undefined;
    if (numberedTitle) {
      numbered.push(numberedTitle);
      continue;
    }
    const bulletTitle = normalize(topCheckbox?.[1] ?? topBullet?.[1] ?? "");
    if (bulletTitle) bullets.push(bulletTitle);
  }
  return Array.from(new Set(numbered.length ? numbered : bullets));
}

function extractStatusPlanHeadingSteps(plan?: string): NonNullable<WorkflowState["planProgress"]>["steps"] {
  if (!plan?.trim() || planNeedsClarification(plan)) return [];
  const explicit = Array.from(plan.matchAll(/^##\s*(?:(?:Implementation|Proposed Implementation|Execution|Investigation|Audit|Action|Next|Plan)\s+(?:Steps|Tasks|Plan|Workflow)|(?:Steps|Tasks|Plan))\s*\n([\s\S]*?)(?=^##\s+|(?![\s\S]))/gim))
    .flatMap((match) => collectStatusPlanListSteps(match[1]));
  const headings = explicit.length ? explicit : Array.from(plan.matchAll(/^#{2,3}\s+(.+)$/gm))
    .map((match) => stripMarkdownInline(match[1]).trim())
    .map((heading) => {
      const step = heading.match(/^step\s*(\d+)\s*[.)\-:]?\s*(.*)$/i);
      if (step) return step[2]?.trim() || `Step ${step[1]}`;
      const numbered = heading.match(/^\d+\s*[.)\-:]\s+(.+)$/i)?.[1];
      if (numbered) return numbered;
      const phase = heading.match(/^phase\s+(\d+)\s*[.)\-:]?\s*(.*)$/i);
      if (phase) return phase[2]?.trim() || `Phase ${phase[1]}`;
      return undefined;
    })
    .filter((heading): heading is string => Boolean(heading?.trim()))
    .map((heading) => heading.trim());
  const lineSteps = explicit.length || headings.length ? [] : plan.split("\n")
    .map((line) => line.match(/^\s{0,3}(?:[-*]\s+)?Step\s+(\d+)\s*[.)\-:]?\s*(.+)$/i))
    .filter((match): match is RegExpMatchArray => Boolean(match))
    .map((match) => stripMarkdownInline(match[2]?.trim() || `Step ${match[1]}`))
    .filter(Boolean);
  const unique = Array.from(new Set(headings.length ? headings : lineSteps));
  return unique.slice(0, 24).map((title, index) => ({ id: `S${index + 1}`, title, status: "pending" as const }));
}

function planValidationGateActive(cwd?: string): boolean {
  const settings = loadWorkflowSettings(cwd);
  const autoValidation = (settings.workflow.validateAfterExecution ?? settings.workflow.autoRunValidationAfterExecute) !== false;
  const validationModelAvailable = settings.models.validator.enabled && roleIsConfigured(settings.models.validator);
  return validationModelAvailable && (autoValidation || settings.workflow.offerValidationAfterExecute !== false);
}

function displayedPlanSteps(state: WorkflowState, steps: NonNullable<WorkflowState["planProgress"]>["steps"], cwd?: string): NonNullable<WorkflowState["planProgress"]>["steps"] {
  if (state.mode !== "executed" || planValidationGateActive(cwd)) return steps;
  return steps.map((step) => step.status === "failed" || step.status === "blocked" ? step : { ...step, status: "completed" as const });
}

function planProgressLines(state: WorkflowState, cwd?: string): string {
  const completedSummary = state.lastCompletedPlanSummary;
  if (!state.planProgress && completedSummary && state.mode === "awaiting_plan_input") {
    const percent = completedSummary.stepsTotal ? Math.round((completedSummary.stepsCompleted / completedSummary.stepsTotal) * 100) : 100;
    return `Plan Progress: ${completedSummary.stepsCompleted} / ${completedSummary.stepsTotal} (${percent}%)\nPlan Lifecycle: completed\nPlan Current Step: none\nLast Completed Plan: ${completedSummary.validationResult}`;
  }
  const progress = state.planProgress;
  const isClarifying = state.mode === "awaiting_clarification" || planNeedsClarification(state.draftPlan);
  const planText = state.approvedPlan ?? state.draftPlan;
  const parsedSteps = isClarifying ? [] : extractStatusPlanHeadingSteps(planText);
  const progressMatchesPlan = Boolean(progress?.steps?.length) && (!planText?.trim() || parsedSteps.length > 0 && progress!.steps.length === parsedSteps.length && progress!.steps.every((step, index) => step.title === parsedSteps[index]?.title));
  const steps = isClarifying ? [] : progressMatchesPlan ? progress!.steps : parsedSteps;
  if (!steps.length && isClarifying) return `Plan Progress: awaiting clarification\nPlan Lifecycle: awaiting_clarification\nPlan Current Step: none`;
  if (!steps.length) return "Plan Progress: not available";
  const displaySteps = displayedPlanSteps(state, steps, cwd);
  const completed = displaySteps.filter((step) => step.status === "completed" || step.status === "skipped").length;
  const total = displaySteps.length;
  const validationGateActive = planValidationGateActive(cwd);
  const currentStepIndex = state.mode === "executed" && !validationGateActive ? Math.max(0, total - 1) : Math.max(0, Math.min(progress?.currentStepIndex ?? 0, total - 1));
  const current = displaySteps[currentStepIndex];
  const lifecycle = state.mode === "executed" && !validationGateActive ? "completed" : progress?.lifecycleStatus ?? state.mode;
  return `Plan Progress: ${completed} / ${total} (${Math.round((completed / total) * 100)}%)\nPlan Lifecycle: ${lifecycle}\nPlan Current Step: ${current ? `${currentStepIndex + 1} of ${total} - ${displayLabel(current.title)} (${current.status})` : "none"}`;
}

function planRuntimeLines(state: WorkflowState, cwd?: string): string {
  const suffix = isPlanRuntimeActiveMode(state.mode) ? " and running" : "";
  const completedSummary = state.lastCompletedPlanSummary;
  if (!state.planProgress && completedSummary && state.mode === "awaiting_plan_input") {
    return `Plan Active Runtime: ${formatDurationMs(completedSummary.activeRuntimeMs)} active\nPlan Elapsed Since Created: ${formatDurationMs(completedSummary.elapsedMs)}\nPlan Runtime Counter: completed\n${planProgressLines(state, cwd)}\nPlan Validation: ${completedSummary.validationResult}\nPlan Repair Retry: ${completedSummary.repairRetries} / ${completedSummary.maxRepairRetries}\nPlan Repair Status: ${completedSummary.repairStatus ?? "none"}`;
  }
  return `Plan Active Runtime: ${formatDurationMs(planActiveRuntimeMs(state))} active${suffix}\nPlan Elapsed Since Created: ${formatDurationMs(planWallClockAgeMs(state))}\nPlan Runtime Counter: ${planRuntimeCounterState(state)}\n${planProgressLines(state, cwd)}\nPlan Validation: ${state.mode === "validating" || state.mode === "revalidating" ? "running" : state.validationVerdict ?? "pending"}\nPlan Repair Retry: ${state.currentValidationRetry ?? 0} / ${state.maxValidationRetriesPerPlan ?? loadWorkflowSettings(cwd).workflow.maxValidationRetriesPerPlan ?? 2}\nPlan Repair Status: ${state.lastRepairStatus ?? "none"}${state.lastRepairStatus === "blocked" && state.lastRepairAttempt ? ` — ${compact(state.lastRepairAttempt, 160)}` : ""}`;
}

export function renderWorkflowStatus(state: WorkflowState, activeTools: string[], cwd?: string): string {
  const effective = loadEffectiveSettings(cwd ?? process.cwd());
  const settings = effective.settings;
  const scope = effective.projectOverridePath ? "project override" : "global";
  const projectLine = effective.projectOverridePath ?? "none";
  const sourceLine = effective.projectOverridePath ? "merged project over global" : "global";
  const settingsWarnings = workflowSettingsDiagnostics();
  const settingsWarningLine = settingsWarnings.length ? settingsWarnings.join("; ") : "none";
  const safeMode = process.env[WORKFLOW_SUITE_SAFE_MODE_ENV] === "1"
    || process.env[WORKFLOW_SUITE_SAFE_MODE_ENV] === "true"
    || process.env[LEGACY_WORKFLOW_SAFE_MODE_ENV] === "1"
    || process.env[LEGACY_WORKFLOW_SAFE_MODE_ENV] === "true";
  // Detect project instructions
  let projectInstrLine = "not detected";
  const cwdPath = cwd ?? process.cwd();
  const instrFiles: string[] = [];
  const candidates = ["AGENTS.md", "SYSTEM.md", "CLAUDE.md", ".cursor/rules", ".factory/rules", ".factory/memories.md"];
  for (const rel of candidates) {
    const full = join(cwdPath, rel);
    if (existsSync(full)) instrFiles.push(rel);
  }
  if (instrFiles.length > 0) {
    projectInstrLine = `detected (${instrFiles.join(", ")})`;
  }
  const returnToPlan = (settings.workflow as typeof settings.workflow & { returnToPlanModeAfterWorkflow?: boolean }).returnToPlanModeAfterWorkflow !== false;
  const clarificationStatus = state.mode === "awaiting_clarification" ? "pending" : (state.draftPlan && planNeedsClarification(state.draftPlan)) ? "needed" : "none";
  const missionModeActive = isMissionMode(state.mode);
  const standardModeActive = isStandardMode(state.mode);
  const standardLines = standardModeActive ? `\nStandard Mode: active\n${standardProgressLines(state)}\nStandard Clarification: ${standardClarificationLabel(settings, state)}` : "";
  const mission = state.activeMissionId ? loadMissionState(state.activeMissionId) : undefined;
  const missionLabel = missionModeActive ? "Mission" : "Last Mission";
  const currentMilestone = mission?.milestones?.[mission.currentMilestoneIndex];
  const completed = mission?.milestones?.filter((m) => m.status === "completed" || m.status === "skipped").length ?? 0;
  const total = mission?.milestones?.length ?? 0;
  const missionNextAction = mission?.status === "draft" && total === 0 ? "Run /mission plan to create milestones, then /mission approve, then /mission continue." : mission?.nextAction ?? "none";
  const missionLines = missionModeActive || mission ? `\nMission Mode: ${missionModeActive ? "active" : "inactive"}\n${missionLabel} ID: ${mission?.id ?? state.lastCompletedMissionSummary?.missionId ?? "none"}\n${missionLabel} Status: ${mission?.status ?? state.lastCompletedMissionSummary?.status ?? "none"}\n${missionRuntimeLines(mission, state)}\nMilestone: ${currentMilestone ? `${Math.min((mission?.currentMilestoneIndex ?? 0) + 1, total)} of ${total} - ${displayLabel(currentMilestone.title)}` : "none"}\nProgress: ${total ? `${completed} / ${total}` : state.lastCompletedMissionSummary ? `${state.lastCompletedMissionSummary.milestonesCompleted} / ${state.lastCompletedMissionSummary.milestonesTotal}` : "0 / 0"}\nValidation Retry: ${mission?.currentValidationRetry ?? 0} / ${mission?.maxValidationRetriesPerMilestone ?? settings.missions.maxValidationRetriesPerMilestone ?? 2} per milestone\nMission Repair Retries: ${mission?.missionValidationRetryCount ?? state.lastCompletedMissionSummary?.repairRetries ?? 0} / ${mission?.maxValidationRetriesPerMission ?? state.lastCompletedMissionSummary?.maxRepairRetries ?? settings.missions.maxValidationRetriesPerMission ?? 8} total\nRepair Status: ${mission?.lastRepairStatus ?? state.lastCompletedMissionSummary?.repairStatus ?? "none"}\n${missionLabel} Next Action: ${displayLabel(missionNextAction)}` : "";
  return `# Workflow Status\n\nWorkflow Mode: ${state.mode}${standardLines}${missionLines}\nPlan Mode Persistent: ${returnToPlan ? "enabled" : "disabled"}\nWaiting For Next Plan: ${state.mode === "awaiting_plan_input" ? "yes" : "no"}\nClarification Status: ${clarificationStatus}\nReturn To Plan Mode After Workflow: ${returnToPlan ? "enabled" : "disabled"}\nPlan Status: ${planStatus(state)}\n${planRuntimeLines(state, cwd)}\nSettings Scope: ${scope}\nProject Override: ${projectLine}\nGlobal Settings File: ${WORKFLOW_SETTINGS_FILE}\nEffective Settings Source: ${sourceLine}\nWorkflow Suite Safe Mode: ${safeMode ? "enabled" : "disabled"}\nSettings Warnings: ${settingsWarningLine}\nProject Instructions: ${projectInstrLine}\nProject Override Priority: enabled\nPlanner: ${formatRole("planner", settings).replace(/^Planner: /, "")}\nExecutor: ${formatRole("executor", settings).replace(/^Executor: /, "")}\nValidator: ${formatRole("validator", settings).replace(/^Validator: /, "")}\nReviewer: ${formatRole("reviewer", settings).replace(/^Reviewer: /, "")}\nSub-agents: ${settings.subagents.enabled ? "enabled" : "disabled"}\nActive Tools: ${activeTools.join(", ")}\nSession State: current Pi session entries (${WORKFLOW_SUITE_SESSION_STATE_TYPE}; compatibility fallback enabled)\nLegacy Active State File: ${ACTIVE_STATE_FILE}\n\nPlan Mode Entry: /p or /plan\nLegacy Alias: /plan-mode\nShortcut: none confirmed\nRecovery: /workflow recover\nUI Indicator: ${((settings.ui as typeof settings.ui & { showPlanModeIndicator?: boolean }).showPlanModeIndicator !== false) ? "enabled" : "disabled"}\nUI Indicator Placement: widget above editor`;
}

export function renderApprovedPlanSummary(state: WorkflowState): string {
  return `# Approved Plan Summary\n\n## Task\n${state.task ?? "(none)"}\n\n## Approved Plan\n${compact(state.approvedPlan, 2200)}\n\nYou can now run \`/execute\`.`;
}

function latestFinalStopSummary(state: WorkflowState): string | undefined {
  const plan = state.lastPlanStopSummary;
  const mission = state.lastMissionStopSummary;
  if (isMissionMode(state.mode) || state.mode === "awaiting_mission_input") return mission?.summary ?? plan?.summary;
  if (state.mode === "awaiting_plan_input" || state.mode === "validated") return plan?.summary ?? mission?.summary;
  if (!plan) return mission?.summary;
  if (!mission) return plan.summary;
  return mission.stoppedAt > plan.stoppedAt ? mission.summary : plan.summary;
}

export function renderWorkflowSummary(state: WorkflowState, cwd?: string): string {
  const settings = loadWorkflowSettings(cwd);
  const finalStop = latestFinalStopSummary(state);
  if (finalStop && (state.mode === "awaiting_plan_input" || state.mode === "awaiting_mission_input" || state.mode === "validated" || state.mode === "mission_blocked" || state.mode === "mission_completed" || state.mode === "mission_failed" || state.mode === "mission_stopped")) {
    return `# Workflow Summary\n\n${finalStop}`;
  }
  return `# Workflow Summary\n\n${renderHandoffProjectContext(cwd)}\n\n## Original Task\n${state.task ?? "(none)"}\n\n## Models Used\n- Planner: ${state.modelsUsed?.planner ?? "(not recorded)"}\n- Executor: ${state.modelsUsed?.executor ?? "(not recorded)"}\n- Validator: ${state.modelsUsed?.validator ?? "(not run)"}\n- Reviewer: ${state.modelsUsed?.reviewer ?? "(not run)"}\n\n## Current Model Configuration\n${renderWorkflowModels(settings)}\n\n## Approved Plan\n${compact(state.approvedPlan, 2200)}\n\n## Execution Summary\n${compact(state.executionSummary, 1800)}\n\n## Validation Result\n${state.validationVerdict ?? "(not validated)"}\n\n${compact(state.validationReport, 1800)}\n\n## Remaining Risks\nReview validation notes, unrun tests, changed files, and public/internal package impact before committing or promoting.\n\n## Recommended Next Action\nRun project checks manually if they were not run, then review the target repo diff. For Pi Workflow Suite package work, complete DEV validation, live sync if requested, main promotion, main validation, and branch parity verification.\n\n## Exact Resume Instructions\n- Re-open the target repo shown above and confirm branch/status.\n- Run /workflow status before continuing.\n- Review this summary alongside the saved plan record when available.\n- Re-read detected project instruction files before any new edits.\n\n## Suggested Commit Message\nImplement approved workflow plan`;
}

// No-op default export so this helper module can be safely auto-discovered as a Pi extension.
export default function workflowSuiteNoopExtension(): void {}
