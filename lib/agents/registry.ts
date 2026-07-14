/**
 * Single source of truth for multi-agent layout.
 *
 * To add an agent:
 * 1. Create agents/<id>/package.json + agents/<id>/agent/…
 * 2. Append one entry here
 * 3. Restart `npm run dev`
 */

export type AgentDefinition = {
  /** Route / hook id: useEveAgent({ agent: id }) → /eve/agents/<id>/… */
  readonly id: string;
  readonly name: string;
  readonly tagline: string;
  readonly description: string;
  /** Eve app root relative to monorepo root. Default: ./agents/<id> */
  readonly root?: string;
  readonly placeholder?: string;
  /** Show in parallel multi-pane by default. */
  readonly parallelDefault?: boolean;
  /** Open this agent first in Switch mode. */
  readonly isDefault?: boolean;
};

export const AGENT_REGISTRY: readonly AgentDefinition[] = [
  {
    id: "mr-doof",
    name: "Mr Doof",
    tagline: "Manager · plans & delegates",
    description:
      "Talk to him first. He plans, then calls Brain and Spark (often in parallel).",
    placeholder: "Tell Mr Doof what you want to ship…",
    parallelDefault: true,
    isDefault: true,
  },
  {
    id: "brain",
    name: "Brain",
    tagline: "Analyst · memory",
    description: "Careful analysis with on-disk memory (shared with Doof’s Brain).",
    placeholder: "Ask Brain anything…",
    parallelDefault: true,
  },
  {
    id: "spark",
    name: "Spark",
    tagline: "Creative energy",
    description: "Ideas and drafts (shared memory with Doof’s Spark).",
    placeholder: "Pitch an idea, ask for a draft…",
    parallelDefault: true,
  },
] as const;

export type AgentId = (typeof AGENT_REGISTRY)[number]["id"];

export function getAgent(id: string): AgentDefinition {
  return AGENT_REGISTRY.find((a) => a.id === id) ?? defaultAgent();
}

export function defaultAgent(): AgentDefinition {
  return AGENT_REGISTRY.find((a) => a.isDefault) ?? AGENT_REGISTRY[0]!;
}

export function agentRoot(def: AgentDefinition): string {
  return def.root ?? `./agents/${def.id}`;
}

/** Map for withEve({ agents }) — keeps Next mounts in sync with the registry. */
export function toWithEveAgents(): Record<string, string> {
  return Object.fromEntries(
    AGENT_REGISTRY.map((def) => [def.id, agentRoot(def)]),
  );
}

export function defaultParallelAgentIds(): string[] {
  return AGENT_REGISTRY.filter((a) => a.parallelDefault !== false).map((a) => a.id);
}
