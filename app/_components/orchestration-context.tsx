"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { LiveDelegation } from "@/lib/orchestration/types";

type OrchestrationContextValue = {
  /** Manager agent id that owns child session streams (e.g. mr-doof). */
  readonly managerAgentId: string;
  readonly delegations: readonly LiveDelegation[];
  /** Latest delegation per specialist id (brain / spark). */
  readonly latestBySpecialist: ReadonlyMap<string, LiveDelegation>;
  readonly reportParentEvents: (events: readonly unknown[]) => void;
  readonly clear: () => void;
};

const OrchestrationContext = createContext<OrchestrationContextValue | null>(
  null,
);

function asRecord(v: unknown): Record<string, unknown> | null {
  return v !== null && typeof v === "object" ? (v as Record<string, unknown>) : null;
}

function extractBriefFromParentEvent(event: unknown): string | undefined {
  const e = asRecord(event);
  if (!e || e.type !== "actions.requested") return undefined;
  const data = asRecord(e.data);
  const actions = data?.actions;
  if (!Array.isArray(actions)) return undefined;
  for (const action of actions) {
    const a = asRecord(action);
    const input = asRecord(a?.input) ?? asRecord(a?.args);
    const message = input?.message;
    if (typeof message === "string" && message.trim()) return message;
  }
  return undefined;
}

function parseParentEvent(
  event: unknown,
):
  | {
      kind: "called";
      callId: string;
      subagentId: string;
      childSessionId: string;
      brief?: string;
      streamAgentId?: string;
    }
  | { kind: "done"; callId: string; subagentId: string; status: "completed" | "failed" }
  | null {
  const e = asRecord(event);
  if (!e || typeof e.type !== "string") return null;
  const data = asRecord(e.data) ?? {};

  if (e.type === "subagent.called") {
    const childSessionId =
      typeof data.childSessionId === "string" ? data.childSessionId : null;
    const callId = typeof data.callId === "string" ? data.callId : null;
    const subagentId =
      (typeof data.name === "string" && data.name) ||
      (typeof data.toolName === "string" && data.toolName) ||
      null;
    if (!childSessionId || !callId || !subagentId) return null;
    return { kind: "called", callId, subagentId, childSessionId };
  }

  if (e.type === "subagent.completed") {
    const callId = typeof data.callId === "string" ? data.callId : null;
    const subagentId =
      (typeof data.name === "string" && data.name) ||
      (typeof data.toolName === "string" && data.toolName) ||
      null;
    if (!callId || !subagentId) return null;
    const failed = data.error != null || data.ok === false;
    return {
      kind: "done",
      callId,
      subagentId,
      status: failed ? "failed" : "completed",
    };
  }

  // Async dispatch_agent creates a standalone specialist session through
  // Eve's HTTP API. Its action result contains the session id immediately;
  // that session is streamed from the specialist mount, not the manager.
  if (e.type === "action.result") {
    const result = asRecord(data.result);
    const output = asRecord(result?.output);
    if (
      result?.toolName !== "dispatch_agent" ||
      typeof result.callId !== "string" ||
      typeof output?.agentId !== "string" ||
      typeof output.sessionId !== "string"
    ) {
      return null;
    }
    return {
      kind: "called",
      callId: result.callId,
      subagentId: output.agentId,
      childSessionId: output.sessionId,
      streamAgentId: output.agentId,
    };
  }

  return null;
}

export function OrchestrationProvider({
  managerAgentId,
  children,
}: {
  readonly managerAgentId: string;
  readonly children: ReactNode;
}) {
  const [delegations, setDelegations] = useState<LiveDelegation[]>([]);
  // Briefs often land on actions.requested slightly before/after subagent.called
  const [pendingBriefs, setPendingBriefs] = useState<Record<string, string>>({});

  const reportParentEvents = useCallback((events: readonly unknown[]) => {
    // State updates are batched, so keep a local copy while processing this
    // batch. This preserves a brief when actions.requested and
    // subagent.called arrive together.
    const briefs = { ...pendingBriefs };
    for (const event of events) {
      const brief = extractBriefFromParentEvent(event);
      const parsed = parseParentEvent(event);

      if (brief && parsed?.kind === "called") {
        briefs[parsed.callId] = brief;
      } else if (brief) {
        // stash last brief under generic keys from tool names if present
        const e = asRecord(event);
        const data = asRecord(e?.data);
        const actions = Array.isArray(data?.actions) ? data.actions : [];
        for (const action of actions) {
          const a = asRecord(action);
          const name =
            (typeof a?.toolName === "string" && a.toolName) ||
            (typeof a?.name === "string" && a.name);
          if (name && typeof brief === "string") {
            briefs[`tool:${name}`] = brief;
          }
        }
      }

      if (!parsed) continue;

      if (parsed.kind === "called") {
        setDelegations((prev) => {
          if (prev.some((d) => d.callId === parsed.callId)) return prev;
          const briefFromPending =
            briefs[parsed.callId] ??
            briefs[`tool:${parsed.subagentId}`] ??
            brief;
          const next: LiveDelegation = {
            callId: parsed.callId,
            subagentId: parsed.subagentId,
            childSessionId: parsed.childSessionId,
            streamAgentId: parsed.streamAgentId,
            brief: briefFromPending,
            startedAt: Date.now(),
            status: "running",
          };
          return [...prev, next];
        });
      } else {
        setDelegations((prev) =>
          prev.map((d) =>
            d.callId === parsed.callId
              ? { ...d, status: parsed.status }
              : d,
          ),
        );
      }
    }
    setPendingBriefs(briefs);
  }, [pendingBriefs]);

  const clear = useCallback(() => {
    setDelegations([]);
    setPendingBriefs({});
  }, []);

  const latestBySpecialist = useMemo(() => {
    const map = new Map<string, LiveDelegation>();
    for (const d of delegations) {
      const prev = map.get(d.subagentId);
      if (!prev || d.startedAt >= prev.startedAt) map.set(d.subagentId, d);
    }
    return map;
  }, [delegations]);

  const value = useMemo(
    () => ({
      managerAgentId,
      delegations,
      latestBySpecialist,
      reportParentEvents,
      clear,
    }),
    [managerAgentId, delegations, latestBySpecialist, reportParentEvents, clear],
  );

  return (
    <OrchestrationContext.Provider value={value}>
      {children}
    </OrchestrationContext.Provider>
  );
}

export function useOrchestration(): OrchestrationContextValue | null {
  return useContext(OrchestrationContext);
}
