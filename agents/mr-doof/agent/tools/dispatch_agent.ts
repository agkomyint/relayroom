import { defineTool } from "eve/tools";
import { z } from "zod";

const targetAgents = z.enum(["brain", "spark"]);

function hostOrigin(): string {
  const configured = process.env.EVE_DISPATCH_ORIGIN?.trim();
  if (configured) return configured.replace(/\/+$/, "");
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;

  // Do not use process.env.PORT here. Authored tools execute inside the
  // manager's private Eve worker, where PORT points at that worker (for
  // example 58353), not at the Next host exposing named-agent routes.
  return "http://127.0.0.1:3000";
}

/** Start a specialist session without making Mr Doof wait for its completion. */
export default defineTool({
  description:
    "Dispatch work to Brain or Spark asynchronously. The call returns as soon as " +
    "the specialist session is created; do not wait for or summarize its answer.",
  inputSchema: z.object({
    agentId: targetAgents,
    message: z.string().min(1),
  }),
  async execute({ agentId, message }) {
    const response = await fetch(
      `${hostOrigin()}/eve/agents/${agentId}/eve/v1/session`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message }),
      },
    );

    if (!response.ok) {
      throw new Error(`Could not dispatch to ${agentId} (${response.status})`);
    }

    const body = (await response.json()) as { sessionId?: unknown };
    if (typeof body.sessionId !== "string" || body.sessionId.length === 0) {
      throw new Error(`Dispatch to ${agentId} returned no session id`);
    }

    return { agentId, sessionId: body.sessionId };
  },
});
