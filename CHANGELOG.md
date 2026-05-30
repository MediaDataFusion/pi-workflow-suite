# Changelog

All notable public releases will be documented in this file.

## [0.0.11] - 2026-05-30

### Added

- `workflow_browser_check` tool — headless browser verification for validator mode with interactive actions (click, type, read, reload, screenshot, evaluate). Uses Puppeteer from the Pi runtime so validators can verify web app behavior regardless of the target project's dependencies.
- Token budget controls (`maxTokens`, `maxRuntimeHours`) for Plan, Mission, and Standard modes.
- Structured validation boolean fields (`concreteRepairableIssue`, `manualVerificationRequired`, `evidenceGap`) on workflow and mission state for infallible classification.
- `/plan complete` command for explicit Plan Mode completion.
- Mission reviewer and workflow reviewer prompt templates.

### Hardened

- **Validation pipeline**: PARTIAL PASS with no concrete code defects now completes the workflow. Classifier reordered so concrete fixes route to repair over evidence gaps. Expanded automatable-evidence-gap detection. Mission validation manual-only outcomes advance milestones; final-validation manual-only outcomes complete the mission.
- **Reviewer and repair**: Mission reviewer auto-repair uses centralized default-enabled configuration matching Plan Mode. Built-in mission defaults aligned (reviewer auto-repair enabled, retry mode `safe_only`, max retries 2). Consistent retry gating across both modes.
- **Tool guard and Repo Lock**: Safe-command recognition expanded across package managers and ecosystems (pnpm, yarn, bun, npx serve, python3, curl localhost, ps, pgrep, sleep). Shell preamble handling (`stripSafePreamble`) for `set -e` and `export` patterns. `/tmp/` and `/dev/` paths exempted from Repo Lock blocking. Reduced false-positive destructive-command blocks.
- **Prompts and agents**: Unified inline-diagram guidance across all prompts, agents, and skills. Web app verification procedures with structured evidence output requirements in validator prompts. Sub-agent write-ownership clarified in mission run prompt. Agent Mermaid guidance updated for raw blocks since sub-agents lack `workflow_diagram`.
- **Runtime accounting**: Wall-clock age uses terminal timestamp when workflow is stopped. Active-runtime tracking preserved for workflows that began before the current session.
- **Plan Mode progress tracking**: Plan execution step progress now reliably tracks across all steps. The `workflow_progress` tool is guaranteed on the agent's active tool surface every turn. The progress guard enforces step activation before file writes while allowing sub-agents to run freely for research and preparation. Multi-step prompt guidance with inline step status display keeps the agent aligned with the approved plan from first step through final validation.

### Fixed

- Plan execution sub-agents no longer deadlock against the step progress guard when forced sub-agent policies are active.
- Plan Mode step progress widget consistently updates across multi-step execution instead of staying stuck on step 1.

### Updated

- Validators can write temporary evidence-gathering scripts (was read-only).
- Mission `maxRuntimeHours` default 8→13.
- All 4 built-in presets updated with `planShowProgressBar`.
- Internal architecture documentation expanded with model routing, settings merge chain, and preset bundle architecture.

## [0.0.10] - 2026-05-25

### Changed

- Improved workflow reliability across Standard, Plan, and Mission execution, including stronger progress tracking and validation handoff behavior.
- Tightened repository safety checks to keep guarded workflows scoped to the active project.

## [0.0.9] - 2026-05-23

### Changed

- Restored package README media presentation for public package pages while preserving the reduced install payload.

## [0.0.8] - 2026-05-23

### Changed

- Restored package README media rendering for npm and pi.dev while keeping promotional media assets out of the install payload.

## [0.0.7] - 2026-05-23

### Changed

- Reduced published package size by excluding promotional media assets from the install payload while preserving package gallery and README media presentation.

## [0.0.6] - 2026-05-23

### Changed

- Updated package media metadata to use versioned package-hosted preview assets.

## [0.0.5] - 2026-05-23

### Changed

- Updated Pi package gallery metadata to use the main Workflow Suite header image for the package preview.
- Kept README screenshots on repository-hosted image paths for GitHub rendering.

### Removed

- Removed an unused alternate package preview image asset from the published package.

## [0.0.4] - 2026-05-23

### Added

- Added package gallery video preview metadata.
- Added explicit prompt and theme metadata for bundled Workflow Suite resources.

### Changed

- Updated package metadata for improved Pi package discovery.
- Refined public README media presentation.

## [0.0.3] - 2026-05-22

### Added

- Added package gallery image preview metadata.

## [0.0.2] - 2026-05-22

### Changed

- Improved public README media presentation.

## [0.0.1] - 2026-05-22

### Added

- Initial public preview package.
