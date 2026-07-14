"use client";

import { Columns2, MessageSquare } from "lucide-react";
import { useMemo, useState } from "react";
import {
  AGENT_REGISTRY,
  defaultAgent,
  defaultParallelAgentIds,
  getAgent,
} from "@/lib/agents/registry";
import { cn } from "@/lib/utils";
import { AgentChat } from "./agent-chat";
import { OrchestrationProvider } from "./orchestration-context";

type ViewMode = "single" | "parallel";

const MANAGER_ID = "mr-doof";

function parallelGridClass(count: number): string {
  if (count <= 1) return "grid-cols-1";
  if (count === 2) return "grid-cols-1 md:grid-cols-2";
  if (count === 3) return "grid-cols-1 md:grid-cols-3";
  if (count === 4) return "grid-cols-1 md:grid-cols-2 xl:grid-cols-4";
  return "grid-cols-1 md:grid-cols-2 xl:grid-cols-3";
}

export function AgentWorkspace() {
  const [agentId, setAgentId] = useState(() => defaultAgent().id);
  const [mode, setMode] = useState<ViewMode>("single");
  const [parallelIds, setParallelIds] = useState<string[]>(() => {
    const ids = defaultParallelAgentIds();
    // Specialists first; keep the manager in the far-right pane.
    return [...ids.filter((id) => id !== MANAGER_ID), MANAGER_ID];
  });

  const parallelAgents = useMemo(
    () => parallelIds.map((id) => getAgent(id)),
    [parallelIds],
  );

  const toggleParallel = (id: string) => {
    setParallelIds((prev) => {
      if (prev.includes(id)) {
        if (prev.length === 1) return prev;
        // Always keep manager if others remain? Allow hide if user wants.
        return prev.filter((x) => x !== id);
      }
      if (id === MANAGER_ID) return [...prev, id];

      const managerIndex = prev.indexOf(MANAGER_ID);
      if (managerIndex === -1) return [...prev, id];
      return [
        ...prev.slice(0, managerIndex),
        id,
        ...prev.slice(managerIndex),
      ];
    });
  };

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-background text-foreground">
      <nav className="flex shrink-0 flex-col gap-2 border-b border-border/60 px-3 py-2 sm:px-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1">
            {AGENT_REGISTRY.map((a) => {
              const active =
                mode === "single"
                  ? agentId === a.id
                  : parallelIds.includes(a.id);
              return (
                <button
                  className={cn(
                    "rounded-full px-3 py-1.5 text-sm transition-colors",
                    active
                      ? "bg-foreground text-background"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                  key={a.id}
                  onClick={() => {
                    if (mode === "single") setAgentId(a.id);
                    else toggleParallel(a.id);
                  }}
                  type="button"
                >
                  {a.name}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-1 rounded-full border border-border/60 p-0.5">
            <button
              aria-label="Single agent"
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs transition-colors",
                mode === "single"
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
              onClick={() => setMode("single")}
              type="button"
            >
              <MessageSquare className="size-3.5" />
              Switch
            </button>
            <button
              aria-label="Parallel agents with live delegation"
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs transition-colors",
                mode === "parallel"
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
              onClick={() => setMode("parallel")}
              type="button"
            >
              <Columns2 className="size-3.5" />
              Parallel live
            </button>
          </div>
        </div>

        {mode === "parallel" ? (
          <p className="text-muted-foreground text-xs">
            Talk to <strong className="font-medium text-foreground">Mr Doof</strong>.
            When he calls Brain or Spark, those panes stream the child session live.
            Try: “Tell Brain hello” or “Have Brain and Spark research rockets in parallel.”
          </p>
        ) : null}
      </nav>

      {mode === "single" ? (
        <div className="min-h-0 flex-1">
          <AgentChat agentId={agentId} key={agentId} role="standalone" />
        </div>
      ) : (
        <OrchestrationProvider managerAgentId={MANAGER_ID}>
          <div
            className={cn(
              "grid min-h-0 flex-1 divide-y divide-border/60 md:divide-x md:divide-y-0",
              parallelGridClass(parallelAgents.length),
            )}
          >
            {parallelAgents.map((a) => (
              <AgentChat
                agentId={a.id}
                compact
                followSubagentId={a.id === MANAGER_ID ? undefined : a.id}
                key={`parallel-${a.id}`}
                role={a.id === MANAGER_ID ? "orchestrator" : "live-follower"}
              />
            ))}
          </div>
        </OrchestrationProvider>
      )}
    </div>
  );
}
