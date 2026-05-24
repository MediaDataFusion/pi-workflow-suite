# Contributing

Pi Workflow Suite is a maintainer-led project. Contributions are welcome only at maintainer discretion, and unsolicited pull requests may be closed without review.

Before opening a pull request, discuss changes that affect workflow behavior, release safety, or maintenance burden.

Pull requests require explicit maintainer approval before changing:

- workflow modes or mode state
- Mission Mode behavior, milestones, validation, repair, or reviewer logic
- Plan Mode approval, execution, validation, or repair flow
- Standard Mode task handling, clarification, or To Do behavior
- package publishing, GitHub Actions, or install scripts
- security-sensitive logic
- dependency behavior or dependency lists

Contributors must not introduce telemetry, postinstall scripts, credential handling, network calls, obfuscated code, or new dependencies without explicit justification and maintainer approval.

External contributions must preserve existing behavior unless a behavior change is explicitly approved. Feature requests may be declined if they increase scope, complexity, or support burden.
