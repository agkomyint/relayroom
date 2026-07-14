/**
 * Public re-exports for the app.
 * Prefer importing from `@/lib/agents/registry` for new code.
 */
export {
  AGENT_REGISTRY,
  type AgentDefinition,
  type AgentId,
  agentRoot,
  defaultParallelAgentIds,
  getAgent,
  toWithEveAgents,
} from "./agents/registry";

/** @deprecated use AGENT_REGISTRY */
export { AGENT_REGISTRY as AGENTS } from "./agents/registry";
