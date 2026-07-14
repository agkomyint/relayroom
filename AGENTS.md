# Mr Doof · multi-agent host

Talk to **Mr Doof** first. He plans and delegates to **Brain** and **Spark**
(often in parallel). All agents use **on-disk JSON memory** under `data/memory/`.

## Layout

```text
packages/agent-shared/   # canonical shared code (edit here)
agents/
  mr-doof/               # manager (default UI)
    shared/              # copy of agent-shared (eve bundles this)
    agent/
      subagents/
        brain/           # tool name: brain
        spark/           # tool name: spark
  brain/
    shared/
    agent/
  spark/
    shared/
    agent/
lib/agents/registry.ts   # register agents here
data/memory/             # *.json on-disk memory (gitignored)
app/                     # Next UI
```

After editing `packages/agent-shared`, run:

```bash
npm run sync:shared
```

## Run

```bash
npm run dev
```

Open http://localhost:3000 — default tab is **Mr Doof**.

Requires `.env.local` → `AI_GATEWAY_API_KEY=...`

## Memory

| Agent id | File |
|----------|------|
| mr-doof | `data/memory/mr-doof.json` |
| brain | `data/memory/brain.json` (shared by UI Brain + Doof’s brain subagent) |
| spark | `data/memory/spark.json` (shared likewise) |

Survives restarts on this computer. Not a cloud DB.

## Add another agent

1. Copy `agents/spark` → `agents/<id>`
2. Register in `lib/agents/registry.ts`
3. Optionally add `agents/mr-doof/agent/subagents/<id>/` so Doof can delegate
4. Restart `npm run dev`
