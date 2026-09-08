---
name: plan-orchestrate-handoff
description: Handoff message when orchestrating plan execution
---

Orchestrate execution of the plan in `{{planPath}}` ({{planTitle}}).

Subagent model lock: {{subagentModel}}. Do not pass `model` to spawn_subagent; the harness uses the locked model.

Read the plan. Spawn one sub-agent per todo with `spawn_subagent` using `mode: "background"`. If an early todo creates a worktree or needs a workspace move, sequence that create, then parent `move_workspace`, then implementers; do not spawn all todos in parallel. After spawning, end the turn; do not poll with `terminal_output`. The harness resumes when background subagents finish. Review outputs, update plan todo status with `update_plan_todo`, and decide what to run next. Never write code or mutate files directly; delegate all implementation to sub-agents.
