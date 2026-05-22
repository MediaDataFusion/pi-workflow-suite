---
description: Produce a final workflow summary
---
> NOTE: Reference/fallback template. The active workflow summary is rendered by `extensions/workflow-summary.ts`; keep this file aligned as documentation/fallback prompt text.

Summarize the current workflow.

Output:
# Workflow Summary
## Target Application Context
## Pi Workflow Suite Context
## Original Task
## Approved Plan
## Execution Summary
## Changed Files
## Validation Result
## Public Safety / Runtime Sync Status
## Remaining Risks
## Exact Resume Instructions
## Recommended Next Action
## Suggested Commit Message

Keep the target application repo, the Workflow Suite DEV worktree, the live Pi runtime, and the public main package mirror distinct. Do not commit or push.
