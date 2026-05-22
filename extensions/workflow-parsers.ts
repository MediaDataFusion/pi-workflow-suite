/**
 * Pure parsing and formatting helpers for Pi Workflow Suite.
 *
 * Extracted from workflow-modes.ts so they are independently testable
 * without importing the full extension entry point.
 */

import type { ClarificationAnswer, ClarificationQuestion, MissionAutonomy, PlanValidationStatus, WorkflowState } from "./workflow-state.js";
import type { StandardClarificationMode, StandardModelRole, StandardTodoTriggerMode, WorkflowAgentScope, WorkflowSettingsScope } from "./workflow-model-router.js";

// ── Command / settings parse helpers ─────────────────────────────

export function parseScope(value: string | undefined): WorkflowSettingsScope | undefined {
  return value === "global" || value === "project" ? value : undefined;
}

export function parseBool(value: string | undefined): boolean | undefined {
  if (value === "true" || value === "on" || value === "enabled" || value === "yes") return true;
  if (value === "false" || value === "off" || value === "disabled" || value === "no") return false;
  return undefined;
}

export function parsePlanningDepth(value: string | undefined): "fast" | "standard" | "deep" | "maximum" | undefined {
  return value === "fast" || value === "standard" || value === "deep" || value === "maximum" ? value : undefined;
}

export function parseClarificationMode(value: string | undefined): "auto" | "always_for_nontrivial" | "never" | undefined {
  return value === "auto" || value === "always_for_nontrivial" || value === "never" ? value : undefined;
}

export function parseStandardTodoTriggerMode(value: string | undefined): StandardTodoTriggerMode | undefined {
  const normalized = value?.trim().toLowerCase().replace(/[()]/g, "").replace(/[\s_-]+/g, " ");
  if (!normalized) return undefined;
  if (normalized === "off" || normalized === "disabled") return "off";
  if (normalized === "manual" || normalized === "on request" || normalized === "only when requested" || normalized === "only when explicitly requested") return "manual";
  if (normalized === "auto" || normalized === "automatic" || normalized === "automatic when useful" || normalized === "when useful") return "auto";
  if (normalized === "required" || normalized === "require" || normalized === "always") return "required";
  return undefined;
}

export function parseStandardClarificationMode(value: string | undefined): StandardClarificationMode | undefined {
  const normalized = value?.trim().toLowerCase().replace(/[()]/g, "").replace(/[\s-]+/g, "_");
  if (!normalized) return undefined;
  if (normalized === "off" || normalized === "never" || normalized === "disabled") return "never";
  if (normalized === "minimal" || normalized === "auto" || normalized === "automatic") return "auto";
  if (normalized === "always_for_nontrivial" || normalized === "always" || normalized === "required" || normalized === "force" || normalized === "forced") return "always_for_nontrivial";
  return undefined;
}

export function parseStandardModelRole(value: string | undefined): StandardModelRole | undefined {
  const normalized = value?.trim().toLowerCase().replace(/\s+pi\s+model/g, "").replace(/[ -]+/g, "_");
  if (normalized === "current") return "current";
  return normalized === "planner" || normalized === "executor" || normalized === "reviewer" || normalized === "validator" ? normalized : undefined;
}

export function parseWorkflowAgentScope(value: string | undefined): WorkflowAgentScope | undefined {
  return value === "user" || value === "project" || value === "both" ? value : undefined;
}

export function parseClarificationTiming(value: string | undefined): "immediate" | "after_initial_analysis" | undefined {
  return value === "immediate" || value === "after_initial_analysis" ? value : undefined;
}

export function parseSubagentPolicy(value: string | undefined): "off" | "auto" | "deep" | "maximum" | "forced" | undefined {
  return value === "off" || value === "auto" || value === "deep" || value === "maximum" || value === "forced" ? value : undefined;
}

export function parseSubagentPlanningPolicy(value: string | undefined): "off" | "auto" | "deep" | "maximum" | "forced" | undefined {
  return parseSubagentPolicy(value);
}

export function parseEditConcurrencyMode(value: string | undefined): "sequential" | "scoped" | "blocked" | undefined {
  return value === "sequential" || value === "scoped" || value === "blocked" ? value : undefined;
}

export function parsePlanningOrchestrationPolicy(value: string | undefined): "off" | "auto" | "orchestrator_first" | "forced_orchestrated" | undefined {
  return value === "off" || value === "auto" || value === "orchestrator_first" || value === "forced_orchestrated" ? value : undefined;
}

export function parseCompactionMode(value: string | undefined): "pi_default" | "custom_model" | "custom_agent" | "disabled" | undefined {
  const normalized = value?.trim().toLowerCase().replace(/[ -]+/g, "_");
  return normalized === "pi_default" || normalized === "custom_model" || normalized === "custom_agent" || normalized === "disabled" ? normalized : undefined;
}

export function parseWorkflowCompactionCheckMode(value: string | undefined): "boundary" | "in_session" | undefined {
  const normalized = value?.trim().toLowerCase().replace(/[ -]+/g, "_");
  if (normalized === "boundary" || normalized === "boundary_only") return "boundary";
  if (normalized === "in_session" || normalized === "session") return "in_session";
  return undefined;
}

export function parseMissionAutonomy(value: string | undefined): MissionAutonomy | undefined {
  return value === "manual" || value === "approval_gated" || value === "supervised_auto" || value === "full_auto" ? value : undefined;
}

export function parseValidationRetryMode(value: string | undefined): "off" | "safe_only" | "aggressive_within_scope" | undefined {
  return value === "off" || value === "safe_only" || value === "aggressive_within_scope" ? value : undefined;
}

export function parsePositiveInt(value: string | undefined): number | undefined {
  if (!value || !/^\d+$/.test(value)) return undefined;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : undefined;
}

export function updatedMessage(scope: WorkflowSettingsScope, file: string, setting: string, value: string): string {
  return `# Workflow Setting Updated\n\nUpdated:\nScope: ${scope}\nFile: ${file}\nSetting: ${setting}\nNew Value: ${value}`;
}

// ── Clarification parsing ────────────────────────────────────────

/**
 * Parse clarifying questions from the planner's response text.
 * Tolerates the canonical ### Q1. format plus older Q1., 1., and ## Question 1 forms.
 */
export function parseClarifyingQuestions(text: string): ClarificationQuestion[] {
  const questions: ClarificationQuestion[] = [];
  const lines = text.split("\n");
  let currentQ: { index: number; question: string; options: string[] } | null = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || /^skip this question$/i.test(line) || /^clarifying questions:?$/i.test(line) || /^#+\s*clarifying questions:?$/i.test(line)) continue;
    const qMatch = line.match(/^(?:#{1,3}\s*)?(?:(?:Question|Q)\s*)?(\d+)\.?\s*[:.)-]?\s*(.*)$/i);
    if (qMatch && !/^[A-D][.:)]/i.test(line)) {
      if (currentQ && currentQ.options.length > 0) questions.push(currentQ);
      currentQ = { index: parseInt(qMatch[1], 10), question: qMatch[2].trim(), options: [] };
      continue;
    }
    if (currentQ && !currentQ.question && !/^[A-D][.:)]/i.test(line)) {
      currentQ.question = line;
      continue;
    }
    const optMatch = line.match(/^([A-D])[.:)]\s*(.+)/i);
    if (optMatch && currentQ) currentQ.options.push(`${optMatch[1].toUpperCase()}. ${optMatch[2].trim()}`);
  }
  if (currentQ && currentQ.options.length > 0) questions.push(currentQ);
  return questions;
}

/**
 * Parse a user's shorthand answer like "1A, 2C, 3D: custom text" or "1S" to skip.
 * Returns array of { index, letter, custom?, skipped? } objects.
 */
export function parseShorthandAnswers(input: string): ClarificationAnswer[] {
  const answers: ClarificationAnswer[] = [];
  const cleaned = input.trim();

  let customSuffix = "";
  const colonMatch = cleaned.match(/:\s*([^,]+)\s*$/);
  if (colonMatch) {
    const beforeColon = cleaned.slice(0, cleaned.lastIndexOf(":"));
    const lastAnswer = beforeColon.trim().split(/[\s,]+/).pop() ?? "";
    if (/^[1-9][A-DSa-ds]$/.test(lastAnswer)) {
      customSuffix = colonMatch[1].trim();
    }
  }

  const pairs = cleaned.matchAll(/\b(\d)([A-DSa-ds])\b/g);
  const seen = new Map<number, ClarificationAnswer>();
  const matchList = [...pairs];

  for (let i = 0; i < matchList.length; i++) {
    const m = matchList[i];
    const idx = parseInt(m[1]);
    const letter = m[2].toUpperCase();
    const answer: ClarificationAnswer = letter === "S" ? { index: idx, letter, skipped: true } : { index: idx, letter };
    if (i === matchList.length - 1 && customSuffix) {
      answer.custom = customSuffix;
    }
    seen.set(idx, answer);
  }

  for (const a of seen.values()) {
    answers.push(a);
  }
  return answers.sort((a, b) => a.index - b.index);
}

/**
 * Format parsed answers into a readable summary for the planner.
 */
export function formatAnswersForPlanner(questions: ClarificationQuestion[], answers: ClarificationAnswer[]): string {
  const lines: string[] = ["User's answers to clarifying questions:"];
  for (const q of questions) {
    const answer = answers.find(a => a.index === q.index);
    if (answer) {
      if (answer.skipped || answer.letter === "S") {
        lines.push(`${q.index}. ${q.question}\n   → skipped by user`);
      } else if (answer.custom) {
        lines.push(`${q.index}. ${q.question}\n   → ${answer.letter} (Custom): ${answer.custom}`);
      } else {
        const optionText = q.options.find(o => o.startsWith(`${answer.letter}.`));
        lines.push(`${q.index}. ${q.question}\n   → ${optionText ?? answer.letter}`);
      }
    } else {
      lines.push(`${q.index}. ${q.question}\n   → (no answer provided)`);
    }
  }
  return lines.join("\n");
}

// ── Validation verdict helpers ────────────────────────────────────

export function planValidationStatusForVerdict(verdict: WorkflowState["validationVerdict"]): PlanValidationStatus {
  if (verdict === "PASS") return "pass";
  if (verdict === "UNKNOWN" || verdict === "PARTIAL PASS") return "unknown";
  return "fail";
}

// No-op default export so this helper module can be safely auto-discovered as a Pi extension.
export default function workflowSuiteNoopExtension(): void {}
