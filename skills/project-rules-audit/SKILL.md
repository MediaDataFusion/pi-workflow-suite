---
name: project-rules-audit
description: Find and respect project rules such as AGENTS.md, CLAUDE.md, README.md, .cursor/rules, .factory/rules, .pi, and .env.example before planning or execution.
---

# Project Rules Audit

Before planning or execution, look for project instructions and safety rules. Check AGENTS.md, CLAUDE.md, README.md, .cursor/rules, .factory/rules, .pi, and .env.example. Preserve project-specific conventions and do not override existing agent rules.

Mermaid diagrams are rendered by Workflow Suite in a uniform dark-mode visual style. For user-facing workflows, export/share paths, request lifecycles, architecture, data flow, multi-step sequences, state transitions, dependencies, validation flow, or implementation phases, include a meaningful Mermaid diagram plus concise prose unless the user requested prose only or the response is trivial. Use concise labels and the right diagram type; do not hardcode random style/classDef/light-theme overrides unless the user explicitly asks.
## Professional Constraints

- Check project instructions before recommendations when the task touches code, docs, settings, or workflow behavior.
- Keep scope bounded to the user request and approved workflow phase.
- Do not print secrets, credentials, tokens, auth/session values, private runtime state, or `.env` contents.
- Avoid destructive commands, deploys, pushes, resets, cleans, database mutations, and dependency installs unless explicitly approved outside this workflow.
- Prefer concise, evidence-based output with exact files or commands reviewed.
## Skills vs Agents

Use this skill as in-process guidance for the current model. Use a sub-agent only when the task benefits from an isolated context window, parallel read-only research, forced preflight, or independent validation. Do not use both this skill and a same-purpose agent for the same narrow job unless the workflow or user explicitly requires it.
