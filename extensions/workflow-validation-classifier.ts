/**
 * Validation failure classification for Pi Workflow Suite.
 *
 * Determines whether a validation failure is repairable by code changes,
 * manual-only (visual/browser QA), or ambiguous.
 *
 * Extracted from workflow-modes.ts for independent testability.
 */

import type { PlanValidationStatus, WorkflowState } from "./workflow-state.js";

export type ValidationFailureClassification = "manual_only" | "repairable" | "ambiguous";

function structuredValidationField(text: string, label: string): string | undefined {
  const match = text.match(new RegExp(`(?:^|\\n)\\s*(?:[-*]\\s*)?(?:\\*\\*)?${label}(?:\\*\\*)?\\s*:\\s*([^\\n]+)`, "i"));
  return match?.[1]?.trim().toLowerCase();
}

function structuredValidationYes(text: string, label: string): boolean | undefined {
  const value = structuredValidationField(text, label);
  if (!value) return undefined;
  if (/^(yes|true|y)\b/.test(value)) return true;
  if (/^(no|false|n)\b/.test(value)) return false;
  return undefined;
}

/**
 * Check whether a validation report contains concrete repairable issues.
 *
 * Uses generic software-validation keywords only. The regex looks for
 * build errors, type errors, test failures, missing requirements,
 * regressions, and similar actionable findings. It deliberately
 * excludes project-specific or content-specific keywords so the
 * classifier works correctly across any codebase.
 */
export function validationReportHasRepairableIssue(text?: string): boolean {
  if (structuredValidationYes(text ?? "", "Concrete Repairable Issue") === false) return false;
  if (structuredValidationYes(text ?? "", "Concrete Repairable Issue") === true) return true;
  const normalized = (text ?? "").toLowerCase();
  if (!normalized.trim()) return false;
  const actionable = normalized
    .replace(/\bno (actual |concrete )?(code |repairable )?(failure|failures|issue|issues|defect|defects)\b/g, " ")
    .replace(/\bno (blocking|remaining|required) (issue|issues|action|actions|fix|fixes|gap|gaps)\b/g, " ")
    .replace(/\brequired action (?:is )?(?:manual|visual|browser) (?:verification|qa|inspection|confirmation)\b/g, " ")
    .replace(/\bno automated repair is needed\b/g, " ")
    .replace(/\bno specific missing requirements? (?:is |are )?identified\b/g, " ")
    .replace(/\bmanual[-\s]only\b/g, " ");
  return /\b(needs? repair|needs? revision|repair pass|repairable (issue|failure|defect)|concrete (issue|failure|defect|regression)|blocking issues?|critical issues?|must fix|required (fixes?|actions?)|fixes required|remaining (fixes?|issues?|gaps?)|should be fixed before advancing|apply (the )?(two |[0-9]+ )?remaining fixes?|needs? to be (replaced|updated|expanded|corrected)|missing requirements?|not fully meet|does not fully meet|not (a )?full final artifact|acceptable as (a )?checkpoint baseline but not (a )?(full )?final artifact|unexpected changes?|regression introduced|build (failed|error)|type error|tests? failed|new lint error|incomplete (file|artifact|implementation|coverage)|persistent artifact|structured artifact|risk register artifact|artifact required|(?:produce|create|add|write) (a )?(structured |persistent )?(risk register )?artifact|missing (file|config|import|export|declaration|function|module|dependency))\b/.test(actionable);
}

export function validationReportIsEvidenceGap(text?: string): boolean {
  const report = text ?? "";
  const evidenceGap = structuredValidationYes(report, "Evidence Gap");
  const repairable = structuredValidationYes(report, "Concrete Repairable Issue");
  if (evidenceGap === true && repairable !== true) return true;
  const normalized = report.toLowerCase();
  return /\b(evidence gap|evidence unavailable|insufficient evidence|could not verify|cannot verify|unable to verify|not enough evidence|provenance could not be proven)\b/.test(normalized)
    && !validationReportHasRepairableIssue(report);
}

/**
 * Check whether a validation report represents only a manual/visual QA caveat
 * with no concrete repairable code issue.
 */
export function validationReportIsManualOnlyCaveat(text?: string): boolean {
  const report = text ?? "";
  const manual = structuredValidationYes(report, "Manual Verification Required");
  const repairable = structuredValidationYes(report, "Concrete Repairable Issue");
  if (manual === true && repairable === false) return true;
  const normalized = report.toLowerCase();
  if (!normalized.trim()) return false;
  const manualCaveat = /(manual|visual|browser).{0,50}(verification|qa|inspection|confirmation)|visual[-\s]?verification caveat|pass with.{0,40}caveat|manual verification needed/.test(normalized);
  const noConcreteRepairableIssue = /no (actual |concrete )?(code |repairable )?(failure|failures|issue|issues|defect|defects)|no (code |repairable )?failures exist|no concrete (code |repairable )?issues?|only remaining validation item is manual|only incomplete item is manual|cannot be performed through (code )?repair|out of scope for (code )?repair/.test(normalized);
  return manualCaveat && noConcreteRepairableIssue && !validationReportHasRepairableIssue(normalized);
}

/**
 * Classify a validation failure as manual-only, repairable, or ambiguous.
 */
export function classifyValidationFailure(verdict: WorkflowState["validationVerdict"], report: string): ValidationFailureClassification {
  if (validationReportIsManualOnlyCaveat(report)) return "manual_only";
  if (validationReportIsEvidenceGap(report)) return "ambiguous";
  if (verdict === "FAIL" || validationReportHasRepairableIssue(report)) return "repairable";
  return "ambiguous";
}

/**
 * Normalize a validation verdict. A FAIL with only manual/visual QA caveats
 * is upgraded to PARTIAL PASS because there is no concrete repairable defect.
 */
export function normalizeValidationVerdict(verdict: WorkflowState["validationVerdict"], report: string): WorkflowState["validationVerdict"] {
  if (verdict === "FAIL" && validationReportIsManualOnlyCaveat(report)) return "PARTIAL PASS";
  return verdict;
}

// Re-export the verdict-to-status helper so consumers do not need workflow-parsers.
export function planValidationStatusForVerdict(verdict: WorkflowState["validationVerdict"]): PlanValidationStatus {
  if (verdict === "PASS") return "pass";
  if (verdict === "PARTIAL PASS") return "partial pass";
  if (verdict === "UNKNOWN") return "unknown";
  return "fail";
}

// No-op default export so this helper module can be safely auto-discovered as a Pi extension.
export default function workflowSuiteNoopExtension(): void {}
