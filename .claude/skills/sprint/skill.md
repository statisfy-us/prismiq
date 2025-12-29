---
name: sprint
description: Execute a sprint using the orchestrator. Reads tasks from tasks/ directory and delegates to subagents.
user_invocable: true
---

# Sprint Execution Skill

Execute sprint tasks using the orchestrator agent workflow.

## Usage

```
/sprint [task-file]
```

Examples:
- `/sprint` - Lists available task files
- `/sprint tasks/week5-python.md` - Execute Python tasks for week 5
- `/sprint tasks/demo-implementation.md` - Execute demo implementation tasks

## Workflow

When invoked, this skill:

1. **Lists available task files** if no argument provided
2. **Reads the specified task file** to understand the work
3. **Launches the orchestrator agent** via Task tool with:
   - `subagent_type: "orchestrator"`
   - Task file contents as prompt
4. **Orchestrator delegates** to specialist agents:
   - `python-implementer` for Python code
   - `react-developer` for React/TypeScript
   - `test-writer` for tests
   - `code-reviewer` for quality checks

## Task File Format

Task files in `tasks/` follow this structure:

```markdown
# Task Title

## Overview
Brief description of the sprint goals.

## Prerequisites
- Required setup steps
- Dependencies

## Validation
```bash
# Commands to verify completion
make check
```

---

## Task 1: Task Name

**Files:**
- `path/to/file.py`

**Requirements:**
- Specific requirement 1
- Specific requirement 2

---

## Task 2: Another Task
...
```

## Example Invocation

```
User: /sprint tasks/week5-python.md
