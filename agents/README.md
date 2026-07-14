# Multi-agent layout

Every product agent is a **same-shaped package** under `agents/<id>/`.

```text
agents/
  _shared/                 # shared channel / helpers (optional imports)
    channel-eve.ts
  brain/                   # agent root (eve app root)
    package.json           # { "name": "brain-agent" }
    agent/
      agent.ts             # model + defineAgent
      instructions.md      # personality
      channels/eve.ts      # re-export shared channel or own policy
      tools/               # optional
      skills/              # optional
      lib/                 # optional per-agent state/helpers
      subagents/           # optional in-session specialists
  spark/
    package.json
    agent/
      …
  <your-new-id>/
    package.json
    agent/
      …
```

Host app (Next) lives at the **repo root** (`app/`, `next.config.ts`).  
It does **not** own a root `agent/` folder — that was a dead-end for scaling.

## Add a new agent (3 steps)

1. **Copy a template**

   ```bash
   # from repo root
   cp -r agents/spark agents/critic
   ```

   Edit `agents/critic/package.json` → `"name": "critic-agent"`.  
   Edit `agents/critic/agent/instructions.md` personality.  
   Keep or replace tools/skills.

2. **Register it** in `lib/agents/registry.ts`:

   ```ts
   {
     id: "critic",
     name: "Critic",
     tagline: "Tough review",
     description: "Stress-tests plans and copy.",
     parallelDefault: true,
   },
   ```

3. **Restart** `npm run dev`.

The UI switcher, parallel panes, and `withEve({ agents })` mounts all come from that registry. No second hard-coded list in `next.config.ts`.

## Mounts & hooks

| Piece | Path |
|--------|------|
| HTTP | `/eve/agents/<id>/eve/v1/*` |
| React | `useEveAgent({ agent: "<id>" })` |
| Eve app root | `./agents/<id>` |

## Shared code

| Need | Where |
|------|--------|
| Same channel auth | `agents/_shared/channel-eve.ts` (re-export from each `channels/eve.ts`) |
| Host UI only | `app/`, `lib/`, `components/` |
| Per-agent tools/state | stay under that agent’s `agent/` (eve isolation) |
| True shared TS helpers | import from `agents/_shared/` with relative paths, or a future monorepo package |

## In-session parallel (inside one agent)

For fan-out **within** one conversation, add specialists under:

```text
agents/<id>/agent/subagents/<specialist>/
  agent.ts          # requires description
  instructions.md
```

That is separate from multi-agent UI switch/parallel.
