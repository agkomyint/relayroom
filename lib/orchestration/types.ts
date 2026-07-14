/** Live child session spawned when Mr Doof (or another manager) delegates. */
export type LiveDelegation = {
  readonly callId: string;
  readonly subagentId: string;
  /** Agent mount that owns the stream. Async dispatches use the specialist mount. */
  readonly streamAgentId?: string;
  /** Child session lives on the *manager* agent host, not the specialist UI agent. */
  readonly childSessionId: string;
  /** Brief Doof sent to the specialist (if we captured it). */
  readonly brief?: string;
  readonly startedAt: number;
  readonly status: "running" | "completed" | "failed";
};

export type OrchestrationEvent =
  | { type: "delegation.started"; delegation: LiveDelegation }
  | {
      type: "delegation.finished";
      callId: string;
      subagentId: string;
      status: "completed" | "failed";
    }
  | { type: "clear" };
