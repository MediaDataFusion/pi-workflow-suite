# Changelog

All notable public releases will be documented in this file.

## [0.0.25] - 2026-07-07

- Hardened Plan and Mission handoffs, validation context, repair/retry recovery, and pass-with-notes behavior.
- Refined Plan and Mission review/validation menus, including optional validation, quiet End handling, and Mission revision feedback.
- Improved model routing visibility and inheritance controls for Plan, Standard, Mission, and sub-agent worker routes.

## [0.0.24] - 2026-07-05

- Added `None` preset support for saved manual settings.
- Added Plan and sub-agent model controls, including child model/thinking visibility and token accounting.
- Set built-in Plan presets to offer manual validation after execution.
- Refined sub-agent policy, validation repair handling, and workflow menu completion.

## [0.0.23] - 2026-06-19

### Improved

- Updated install guidance for Pi's self-only `pi update` behavior and `pi update --all` package updates.
- Documented planned sub-agent model routing for lower-cost worker configuration.

## [0.0.22] - 2026-06-14

### Improved

- Refined Standard Mode sub-agent worker bucket handling.
- Refreshed Plan Mode README commands and recovery notes.

## [0.0.21] - 2026-06-13

### Hardened

- Hardened Mission Mode clarification and execution handoff behavior.
- Hardened sub-agent policy handling across workflow phases.
- Refined forced sub-agent exceptions and validation handoff timing.
- Refined Mission validation repair routing for safer continued progress.
- Hardened project-aware Plan/Mission resume selection.
- Hardened Plan Mode continuation behavior for multi-step plans.

## [0.0.20] - 2026-06-12

### Improved

- Added platform-aware Workflow Suite shortcuts so macOS keeps the existing `Ctrl+Shift` shortcuts while Windows and Linux use function-key shortcuts for Standard, Plan, Mission, widget, and preset controls.
- Updated inline shortcut hints, widget documentation, and package README output so Windows and Linux users see shortcuts that match the active platform profile.

### Hardened

- Added regression coverage that keeps shortcut registration, inline hints, README examples, and fallback commands aligned with the centralized shortcut registry.

## [0.0.19] - 2026-06-10

### Improved

- Improved workflow widget and settings UI documentation.
- Refined editor hint readability controls.

## [0.0.18] - 2026-06-10

### Improved

- Improved package metadata and compaction settings documentation.
- Refined compaction safeguards for default and custom configuration flows.

## [0.0.17] - 2026-06-10

### Improved

- Improved package metadata to better reflect the suite's workflow modes, configuration surfaces, and orchestration features.

## [0.0.16] - 2026-06-09

### Fixed

- Fixed Plan Mode recovery so interrupted or resumed workflows return to the correct state more reliably.
- Fixed Standard Mode completion cleanup to prevent stale active-status indicators after work is complete.
- Fixed workflow preset behavior so presets preserve user-selected model-routing preferences.
- Improved compaction recovery for continued workflow sessions.
- Refined repair flow handling so advisory follow-up notes do not unnecessarily block continued progress.

### Improved

- Improved overall workflow reliability across Plan, Standard, and repair flows.

## [0.0.15] - 2026-06-09

### Improved

- Improved Plan Mode approval handoffs so approval-ready plans remain visible while action menus are open.
- Refined the Deep Plan preset so reviewer review remains available without automatically starting by default.
- Improved workflow recovery around transient connection interruptions so Plan, Mission, and Standard workflows are easier to resume after short transport failures.

### Hardened

- Expanded regression coverage for reviewer routing, sub-agent handoffs, package command surfaces, and interruption recovery.

## [0.0.14] - 2026-06-08

### Fixed

- Restored the npm/pi.dev publish preparation path so the package-safe README is active before npm publish starts, preserving the rendered package README while keeping media pinned to the published `0.0.12` assets.

## [0.0.13] - 2026-06-08

### Changed

- Prepared the small runtime package to use the refreshed `0.0.12` npm-hosted package media while keeping promotional media assets out of the install payload.

## [0.0.12] - 2026-06-07

### Added

- Added `workflow_stop_server` for platform-aware cleanup of temporary dev and static servers after validation checks.
- Added independent text-style controls for workflow widgets and startup visuals.
- Added Mission saved-history retention with a dedicated Mission History settings surface.
- Added clearer sub-agent worker policy controls for Standard, Plan, and Mission workflow phases.

### Changed

- Refined Standard, Plan, and Mission widgets with clearer top/bottom status, progress, model route, runtime, repair, and validation context.
- Improved Standard Mode To Do, clarification, and status behavior for direct active work.
- Improved sub-agent orchestration language and behavior around planning, execution preparation, review, validation, and repair support.
- Clarified token and runtime tradeoffs for worker-backed workflows and deeper sub-agent policies.
- Clarified presets as workflow behavior profiles that do not change model, provider, auth, session, or shared compaction settings.
- Rebalanced Plan and Mission reviewer routing so safe, executable work preserves reviewer findings as notes unless a true blocker requires repair.

### Hardened

- Hardened Plan handoffs across reviewer, executor, validator, repair, and re-review phases.
- Hardened Mission recovery so provider, API, rate-limit, or no-output interruptions preserve repair evidence, validation reports, retry counts, and next actions.
- Hardened forced sub-agent policies and worker lifecycle cleanup.
- Hardened parent-owned workflow boundaries so background worker evidence supports the active phase without replacing the main workflow controller.
- Hardened Repo Lock and tool guards around protected files, temporary evidence, skill reads, screenshot paths, and destructive commands.
- Hardened validation evidence classification for browser, runtime, endpoint, and localStorage evidence gaps.

### Fixed

- Fixed Standard clarification answer routing and menu handoffs.
- Fixed Standard status display so user-facing states are shown instead of internal phase labels.
- Fixed Plan reviewer PASS/NOTES handoff recovery and progress widget drift.
- Fixed Mission validation interruptions that could obscure completed repair or PASS evidence.
- Fixed preset operations that could affect user-owned model/provider or compaction state.
- Fixed reviewer repair recovery paths so reviewer blockers are not confused with validation repair.

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
