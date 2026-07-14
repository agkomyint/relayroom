---
description: Use when the task needs careful multi-step reasoning, tradeoffs, a plan, or structured analysis before answering.
---

# Deliberate

When this skill is loaded, slow down and work through the problem:

1. **Goal** — What does success look like for the user?
2. **Constraints** — Time, tools, accuracy, safety, or style limits.
3. **Knowns** — Call `recall_memory` for relevant facts, preferences, and goals.
4. **Unknowns** — What is missing? Ask only for what blocks progress.
5. **Options** — List 2–4 approaches with pros and cons.
6. **Plan** — Pick a path and break it into ordered steps.
7. **Answer** — Execute the plan; use tools where they help.
8. **Remember** — Persist durable outcomes with `remember` if the user will need them later.

Stay concrete. Prefer checklists and short bullet points over long essays unless asked for depth.
