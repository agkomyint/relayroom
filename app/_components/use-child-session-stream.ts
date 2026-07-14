"use client";

import { defaultMessageReducer, type EveMessageData } from "eve/react";
import { useEffect, useMemo, useRef, useState } from "react";

/** Same-origin mount used by withEve({ agents }) multi-agent mode. */
function managerSessionStreamUrl(managerAgentId: string, childSessionId: string) {
  return `/eve/agents/${managerAgentId}/eve/v1/session/${encodeURIComponent(childSessionId)}/stream`;
}

/**
 * Attach to a child session stream on the manager agent host and project
 * messages with the same reducer as useEveAgent.
 */
export function useChildSessionStream(options: {
  readonly managerAgentId: string;
  readonly streamAgentId?: string;
  readonly childSessionId: string | null;
  readonly brief?: string;
}) {
  const { managerAgentId, streamAgentId, childSessionId, brief } = options;
  const [data, setData] = useState<EveMessageData>({ messages: [] });
  const [status, setStatus] = useState<"idle" | "streaming" | "error" | "done">(
    "idle",
  );
  const [error, setError] = useState<Error | null>(null);
  const reducer = useMemo(() => defaultMessageReducer(), []);
  const seenRef = useRef(new Set<string>());

  useEffect(() => {
    if (!childSessionId) {
      setData({ messages: [] });
      setStatus("idle");
      setError(null);
      return;
    }

    const ac = new AbortController();
    const url = managerSessionStreamUrl(
      streamAgentId ?? managerAgentId,
      childSessionId,
    );

    setData({ messages: [] });
    setStatus("streaming");
    setError(null);
    seenRef.current = new Set();

    let projection = reducer.initial();

    // Show Doof's brief as the user message while the child stream catches up.
    if (brief?.trim()) {
      projection = reducer.reduce(projection, {
        type: "client.message.submitted",
        data: {
          createdAt: Date.now(),
          message: brief,
          submissionId: `brief-${childSessionId}`,
        },
      } as never);
      setData(projection);
    }

    (async () => {
      try {
        const res = await fetch(url, {
          signal: ac.signal,
          headers: { accept: "application/x-ndjson" },
        });
        if (!res.ok) {
          throw new Error(`Stream failed (${res.status}) for ${childSessionId}`);
        }
        if (!res.body) throw new Error("No stream body");

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            let event: { type?: string; meta?: { at?: string } };
            try {
              event = JSON.parse(trimmed) as { type?: string; meta?: { at?: string } };
            } catch {
              continue;
            }
            const key = `${event.type}:${event.meta?.at ?? ""}:${trimmed.length}`;
            if (seenRef.current.has(key)) continue;
            seenRef.current.add(key);

            projection = reducer.reduce(projection, event as never);
            setData({ ...projection, messages: [...projection.messages] });

            if (
              event.type === "session.completed" ||
              event.type === "session.waiting" ||
              event.type === "session.failed"
            ) {
              setStatus(event.type === "session.failed" ? "error" : "done");
            }
          }
        }
        setStatus((s) => (s === "streaming" ? "done" : s));
      } catch (err) {
        if (ac.signal.aborted) return;
        setError(err instanceof Error ? err : new Error(String(err)));
        setStatus("error");
      }
    })();

    return () => ac.abort();
  }, [brief, childSessionId, managerAgentId, reducer, streamAgentId]);

  return { data, status, error };
}
