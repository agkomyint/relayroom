import { defineTool } from "eve/tools";
import { z } from "zod";
import { forget, recall, remember, updateSummary } from "./store.js";

const kindSchema = z.enum(["fact", "preference", "goal", "note", "plan"]);

/** Disk-backed remember tool scoped to one agent id. */
export function makeRememberTool(agentId) {
  return defineTool({
    description:
      "Save a durable fact/preference/goal/note/plan to this agent's on-disk memory " +
      "(survives restarts and new sessions on this computer).",
    inputSchema: z.object({
      key: z
        .string()
        .min(1)
        .describe("Stable label, e.g. user.name or project.deadline"),
      value: z.string().min(1).describe("What to remember."),
      kind: kindSchema.describe("Category of this memory."),
    }),
    async execute({ key, value, kind }) {
      return remember(agentId, { key, value, kind });
    },
  });
}

export function makeRecallMemoryTool(agentId) {
  return defineTool({
    description:
      "Read this agent's durable on-disk memory (facts, preferences, goals, notes, plans, summary). " +
      "Call before asking the user to repeat something.",
    inputSchema: z.object({
      key: z.string().optional().describe("Fetch one key; omit for all."),
      kind: kindSchema.optional().describe("Filter by kind."),
    }),
    async execute({ key, kind }) {
      return recall(agentId, { key, kind });
    },
  });
}

export function makeForgetTool(agentId) {
  return defineTool({
    description: "Delete one on-disk memory entry, or wipe this agent's memory.",
    inputSchema: z.object({
      key: z.string().optional().describe("Key to forget."),
      clearAll: z
        .boolean()
        .optional()
        .describe("If true, wipe all entries + summary."),
    }),
    async execute({ key, clearAll }) {
      return forget(agentId, { key, clearAll });
    },
  });
}

export function makeUpdateSummaryTool(agentId) {
  return defineTool({
    description:
      "Rewrite this agent's freeform on-disk session summary (who the user is, plans, status).",
    inputSchema: z.object({
      summary: z.string().min(1).describe("Short accurate summary."),
    }),
    async execute({ summary }) {
      return updateSummary(agentId, summary);
    },
  });
}
