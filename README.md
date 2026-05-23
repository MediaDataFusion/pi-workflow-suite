# Pi Workflow Suite

![Pi Workflow Suite — structured workflow orchestration for Pi](https://cdn.jsdelivr.net/npm/@mediadatafusion/pi-workflow-suite@0.0.7/docs/assets/pi-workflow-suite-header.png)

[![Install](https://cdn.jsdelivr.net/npm/@mediadatafusion/pi-workflow-suite@0.0.7/docs/assets/readme-link-install.svg)](#installation) [![Quick Start](https://cdn.jsdelivr.net/npm/@mediadatafusion/pi-workflow-suite@0.0.7/docs/assets/readme-link-quick-start.svg)](#quick-start) [![Commands](https://cdn.jsdelivr.net/npm/@mediadatafusion/pi-workflow-suite@0.0.7/docs/assets/readme-link-commands.svg)](#core-commands) [![Settings](https://cdn.jsdelivr.net/npm/@mediadatafusion/pi-workflow-suite@0.0.7/docs/assets/readme-link-settings.svg)](#settings-reference)

**Workflow Suite Version:** `v0.0.7`

Pi Workflow Suite is a structured workflow orchestration package for [Pi](https://pi.dev/). It adds Standard, Plan, and Mission workflow modes, role-aware model selection, validation gates, progress/status widgets, Mermaid diagram support, web research tools, Repo Lock safety controls, themes, startup visuals, and safe install/recovery tooling.

## Quick Demo

[![Watch the Pi Workflow Suite quick demo](https://cdn.jsdelivr.net/npm/@mediadatafusion/pi-workflow-suite@0.0.7/docs/assets/pi-workflow-suite-demo.gif)](https://cdn.jsdelivr.net/npm/@mediadatafusion/pi-workflow-suite@0.0.7/docs/assets/pi-workflow-suite-demo.mp4)

## Screenshots

![Pi Workflow Suite Mission Home with workflow graphs](https://cdn.jsdelivr.net/npm/@mediadatafusion/pi-workflow-suite@0.0.7/docs/assets/screenshots/00-mission-home.png)

![Pi Workflow Suite startup logo](https://cdn.jsdelivr.net/npm/@mediadatafusion/pi-workflow-suite@0.0.7/docs/assets/screenshots/01-startup-Logo.png)

![Workflow Suite theme settings](https://cdn.jsdelivr.net/npm/@mediadatafusion/pi-workflow-suite@0.0.7/docs/assets/screenshots/02-theme-settings.png)

![Workflow Suite global safety settings](https://cdn.jsdelivr.net/npm/@mediadatafusion/pi-workflow-suite@0.0.7/docs/assets/screenshots/03-GlobalSafetySettings.png)

![Workflow Suite shared sub-agent settings](https://cdn.jsdelivr.net/npm/@mediadatafusion/pi-workflow-suite@0.0.7/docs/assets/screenshots/04-SharedSubAgentsSettings.png)

![Mission Mode milestone progress](https://cdn.jsdelivr.net/npm/@mediadatafusion/pi-workflow-suite@0.0.7/docs/assets/screenshots/05-mission-mode.png)

![Workflow Suite Mermaid diagram output](https://cdn.jsdelivr.net/npm/@mediadatafusion/pi-workflow-suite@0.0.7/docs/assets/screenshots/06-diagram-mermaid.png)

## Installation

```bash
pi install npm:@mediadatafusion/pi-workflow-suite
```

Then restart or reload Pi so the extension resources are available.

## Quick Start

```text
/workflow status
/workflow settings
/standard
/plan
/mission
```

Use Standard Mode for direct active work, Plan Mode for approval-gated execution, and Mission Mode for longer milestone-driven work.

## Core Commands

```text
/workflow status
/workflow settings
/workflow settings Show Current Settings
/workflow settings Global Safety
/workflow settings Shared Compaction
/standard
/plan
/mission
/mission status
/mission resume
```

## Settings Reference

Workflow Suite settings include model roles, Standard/Plan/Mission behavior, sub-agent policy, compaction, widgets, themes, startup visuals, web tools, and Repo Lock safety controls. Open the interactive settings UI with:

```text
/workflow settings
```

## Included Package Resources

- Extensions: workflow modes and sub-agent orchestration.
- Skills: codebase discovery, implementation planning, safe execution, validation review, git-safe summaries, and project rules audit.
- Prompts: planning, execution, validation, repair, checkpoint, and summary prompts.
- Themes: Workflow Suite terminal theme resources.
- Assets: package header, demo media, quick-link badges, and screenshots.

## Verification

Useful package checks after install:

```text
/workflow status
/workflow settings Show Current Settings
/mission status
/workflow widgets list
```

If commands are missing, restart or reload Pi and verify the package installation.

## License

Apache-2.0. See `LICENSE.md`, `NOTICE`, `TRADEMARKS.md`, `SECURITY.md`, `SUPPORT.md`, and `CONTRIBUTING.md` for project policies.
