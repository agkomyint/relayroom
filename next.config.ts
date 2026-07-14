import type { NextConfig } from "next";
import { withEve } from "eve/next";
import { toWithEveAgents } from "./lib/agents/registry";

const nextConfig: NextConfig = {};

/**
 * Multi-agent host: every entry in lib/agents/registry.ts is mounted as
 * /eve/agents/<id>/eve/v1/* and reachable via useEveAgent({ agent: id }).
 *
 * Adding an agent = folder under agents/<id>/ + one registry row.
 * Do not hard-code agent lists here.
 */
export default withEve(nextConfig, {
  agents: toWithEveAgents(),
  devServerTimeoutMs: 300_000,
});
