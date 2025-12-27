---
description: Execute a sprint using the orchestrator. Reads tasks from tasks/ directory and delegates to subagents.
---

# Execute Sprint: $ARGUMENTS

Read the task file specified (e.g., `tasks/week1-python.md`) and execute all tasks using the orchestrator pattern.

## Process

1. Use the orchestrator subagent to:
   - Read CLAUDE.md for project context
   - Read the specified task file
   - Read current progress from .claude/state/progress.md
   - Create execution plan
   - Delegate to specialist subagents (python-implementer, react-developer, test-writer, code-reviewer)
   - Track progress and handle failures
   - Continue until all tasks complete or a blocker is encountered

2. After each task:
   - Run validation commands
   - Update progress state
   - Proceed to next task

3. On completion:
   - Summarize what was built
   - List any decisions made
   - Note any issues or blockers

## Example Usage

```
/sprint week1-python
/sprint week1-react
```

Begin orchestration now.
