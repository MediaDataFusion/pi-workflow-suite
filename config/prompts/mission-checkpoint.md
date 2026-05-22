> NOTE: Reference/fallback template. Mission checkpoints are currently written by runtime logic in `extensions/workflow-modes.ts` and `extensions/workflow-state.ts`; this file documents the intended checkpoint summary contract.

# Mission Checkpoint Prompt

Summarize Mission Mode progress for durable resume after pause, validation, compaction, or restart.

Output concise checkpoint fields:
- Mission ID
- Goal
- Status
- Current milestone
- Current step
- Completed milestones
- Files inspected or changed
- Acceptance criteria coverage
- Commands run with exit status
- Checks skipped with reason
- Validation result if any
- Risks or blockers
- Errors if any
- Next safe action

Rules:
- Do not include secrets.
- Redact tokens, keys, passwords, credentials, sessions, and auth values.
- Checkpoints persist only under ~/.pi/agent/workflows/missions/.
