# Relayroom — an asynchronous multi-agent workspace built with Eve

Relayroom is an experimental open-source multi-agent workspace built with
[Eve](https://eve.dev), Next.js, and React.

Instead of opening several separate chats and copying context between them, you
talk to one manager. Mr Doof routes work to specialist agents, immediately
acknowledges the dispatch, and lets each specialist continue in its own live
pane.

The included team has three agents:

| Agent | Role |
| --- | --- |
| **Mr Doof** | Front door and asynchronous task dispatcher |
| **Brain** | Analysis, decisions, trade-offs, and careful reasoning |
| **Spark** | Ideas, naming, copy, drafts, and creative exploration |

> This project is experimental. Review authentication, model access, memory,
> and tool permissions before exposing it to untrusted users or production data.

## What makes it different

- **One front door:** talk to Mr Doof and name the specialist you want.
- **Fire-and-forget dispatch:** Mr Doof does not wait for Brain or Spark to
  finish and does not synthesize their replies.
- **Live specialist panes:** each dispatched session streams independently.
- **Direct chat:** switch to Brain or Spark when you want a normal standalone
  conversation.
- **Parallel work:** Mr Doof can dispatch independent tasks to Brain and Spark
  in the same turn.
- **Local durable memory:** each agent can store JSON memory on the current
  machine.
- **Registry-driven agents:** the UI and Eve route mounts share one agent
  registry.

## How it works

```text
User
  │
  ▼
Mr Doof session
  │  calls dispatch_agent({ agentId, message })
  │
  ├── POST /eve/agents/brain/eve/v1/session ──► Brain session
  │                                              │
  │                                              └── live Brain pane
  │
  └── POST /eve/agents/spark/eve/v1/session ──► Spark session
                                                 │
                                                 └── live Spark pane
```

Eve's normal declared-subagent calls keep the parent turn open until the child
finishes. That is useful when a manager must combine results, but it is not the
interaction model used here.

Mr Doof instead uses the authored
[`dispatch_agent` tool](agents/mr-doof/agent/tools/dispatch_agent.ts). The tool:

1. Starts a new standalone Brain or Spark session through Eve's HTTP API.
2. Receives a session ID immediately.
3. Returns that ID to Mr Doof without waiting for the specialist result.
4. Lets Mr Doof acknowledge that the task was sent.

The browser observes the tool result in
[`orchestration-context.tsx`](app/_components/orchestration-context.tsx), maps
the session ID to the correct specialist pane, and attaches to the specialist's
NDJSON event stream with
[`use-child-session-stream.ts`](app/_components/use-child-session-stream.ts).

This keeps the manager responsive while specialist sessions run independently.

## Technology

- [Eve](https://eve.dev) for agent discovery, tools, durable sessions, and
  streaming
- [Next.js](https://nextjs.org) and React for the host application
- [Vercel AI Gateway](https://vercel.com/ai-gateway) for the default model route
- TypeScript, Tailwind CSS, and AI Elements-style chat components
- JSON files for local agent memory

The default model is configured in
[`packages/agent-shared/model.js`](packages/agent-shared/model.js).

## Requirements

- Node.js 24
- npm
- A Vercel AI Gateway key, or compatible provider configuration

## Quick start

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create the local environment file:

   ```bash
   cp .env.example .env.local
   ```

   On PowerShell:

   ```powershell
   Copy-Item .env.example .env.local
   ```

3. Set your gateway key in `.env.local`:

   ```env
   AI_GATEWAY_API_KEY=your_key_here
   EVE_DISPATCH_ORIGIN=http://127.0.0.1:3000
   ```

4. Start development:

   ```bash
   npm run dev
   ```

5. Open [http://localhost:3000](http://localhost:3000).

Use a new manager conversation and try:

```text
Tell Brain to review the risks in this plan.
```

Or dispatch parallel work:

```text
Ask Brain for the technical risks and Spark for three product names.
```

Mr Doof should acknowledge the dispatch. Read the actual answers in the Brain
and Spark panes.

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `AI_GATEWAY_API_KEY` | Usually | Access to models through Vercel AI Gateway |
| `EVE_DISPATCH_ORIGIN` | No | Public Next host used by Mr Doof to start named-agent sessions; defaults to `http://127.0.0.1:3000` locally |
| `EVE_MEMORY_DIR` | No | Absolute override for the local memory directory |
| `VERCEL_OIDC_TOKEN` | No | Optional Vercel authentication |
| `ANTHROPIC_API_KEY` | No | Optional direct provider key |
| `OPENAI_API_KEY` | No | Optional direct provider key |
| `EVE_NEXT_PRODUCTION_PORT` | No | Base port for local production Eve services |

If Next runs on another port, update `EVE_DISPATCH_ORIGIN`. Do not use the
private Eve worker port printed as `[eve:dev:mr-doof]`; named-agent routes live
on the Next host.

## Project structure

```text
app/                              Next.js UI
  _components/
    agent-workspace.tsx           Switch and parallel layouts
    agent-chat.tsx                Interactive and live-follower panes
    orchestration-context.tsx     Maps dispatch results to specialist sessions
    use-child-session-stream.ts   Projects Eve NDJSON into chat messages

agents/
  mr-doof/                        Manager Eve application
    agent/tools/dispatch_agent.ts Asynchronous session dispatcher
  brain/                          Analyst Eve application
  spark/                          Creative Eve application

lib/agents/registry.ts            Shared UI and route registry
lib/orchestration/types.ts        Delegation state types

packages/agent-shared/            Canonical shared model, memory, and prompts
scripts/sync-agent-shared.mjs     Copies shared code into every Eve app root
data/memory/                      Local JSON memory; contents are gitignored
next.config.ts                    Mounts every registered Eve agent
```

## Agent routes

Every registry entry is mounted by `withEve`:

| Capability | Route or API |
| --- | --- |
| Agent HTTP API | `/eve/agents/<id>/eve/v1/*` |
| Create a session | `POST /eve/agents/<id>/eve/v1/session` |
| Stream a session | `GET /eve/agents/<id>/eve/v1/session/<sessionId>/stream` |
| React client | `useEveAgent({ agent: "<id>" })` |
| Eve application root | `./agents/<id>` |

## Memory

Agent memory is stored as JSON under `data/memory/`:

| Agent | Default file |
| --- | --- |
| Mr Doof | `data/memory/mr-doof.json` |
| Brain | `data/memory/brain.json` |
| Spark | `data/memory/spark.json` |

Memory survives application restarts on the same computer. It is not a cloud
database, is not synchronized between machines, and should not be treated as a
secure secret store. Memory JSON files are excluded from Git.

## Editing shared agent code

Eve bundles files from each agent application root. Canonical shared code lives
under `packages/agent-shared/`, then gets copied into each `agents/<id>/shared/`
directory.

After changing shared prompts, memory helpers, the shared channel, or the model:

```bash
npm run sync:shared
```

Commit canonical shared changes and their synchronized copies together.

## Adding another specialist

1. Copy an existing standalone agent:

   ```bash
   cp -r agents/spark agents/critic
   ```

2. Update its package name, `agent/agent.ts`, and instructions.

3. Add it to `AGENT_REGISTRY` in `lib/agents/registry.ts`.

4. Extend the `agentId` schema in
   `agents/mr-doof/agent/tools/dispatch_agent.ts` so Mr Doof may dispatch to it.

5. Update Mr Doof's canonical instructions in
   `packages/agent-shared/personalities/mr-doof.js`.

6. Synchronize shared code and restart development:

   ```bash
   npm run sync:shared
   npm run dev
   ```

The registry automatically updates the UI and the named Eve mounts in
`next.config.ts`.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start Next.js and all registered Eve agents |
| `npm run typecheck` | Check TypeScript without emitting files |
| `npm run build` | Build the production application |
| `npm run start` | Start the production build |
| `npm run sync:shared` | Copy canonical shared files into each agent root |

Before opening a pull request, run:

```bash
npm run sync:shared
npm run typecheck
npm run build
```

## Troubleshooting

### `dispatch_agent` returns 404

Make sure `EVE_DISPATCH_ORIGIN` points to the Next host, normally:

```env
EVE_DISPATCH_ORIGIN=http://127.0.0.1:3000
```

Do not point it at a private Eve worker port such as `58353`.

### Eve reports unresolved imports after moving agent files

Eve development workers compile snapshots. Stop the entire development process,
restart `npm run dev`, and begin a fresh chat so the new session uses the latest
agent snapshot.

### Old sessions are re-enqueued on startup

Eve uses durable local runs. Startup messages such as `Re-enqueued active
run(s)` mean unfinished sessions were found and resumed. Use fresh conversations
when validating a changed tool or prompt.

### Shared prompt changes do not appear

Run `npm run sync:shared`, restart development, and create a fresh session.

## Security and deployment notes

- Replace development/local route authentication before exposing the app
  publicly.
- Treat every authored tool as server-side code with access to the application
  runtime and environment.
- Restrict `EVE_DISPATCH_ORIGIN` to a trusted host.
- Review what data is sent to model providers and stored in local memory.
- Add rate limits, per-user session ownership, and authorization checks for a
  public deployment.
- Do not commit `.env.local`, provider keys, generated Eve state, or memory JSON.

## Contributing

Issues and pull requests are welcome. Keep changes focused, explain behavioral
changes, and include verification steps. For agent behavior changes, mention the
prompt, tool, or stream event involved so reviewers can reproduce the result.

## License

Relayroom is released under the [MIT License](LICENSE).

You may use, modify, distribute, sublicense, and sell copies of the project,
provided that the copyright and permission notices are included with the
software. The project is provided without warranty; see the full text in
[`LICENSE`](LICENSE).
