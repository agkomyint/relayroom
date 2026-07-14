"use client";

import type { UserContent } from "ai";
import { useEveAgent } from "eve/react";
import { AlertCircleIcon, Radio } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import {
  PromptInput,
  type PromptInputMessage,
  PromptInputSubmit,
  PromptInputTextarea,
} from "@/components/ai-elements/prompt-input";
import { getAgent } from "@/lib/agents/registry";
import { cn } from "@/lib/utils";
import { AgentMessage } from "./agent-message";
import { useOrchestration } from "./orchestration-context";
import { useChildSessionStream } from "./use-child-session-stream";

type AgentStatus = ReturnType<typeof useEveAgent>["status"];

export type AgentChatRole =
  /** Normal independent chat (Switch mode). */
  | "standalone"
  /** Manager: publishes subagent.called to orchestration bus. */
  | "orchestrator"
  /** Specialist pane: live-follows Doof's child session for this agent. */
  | "live-follower";

export function AgentChat({
  agentId,
  className,
  compact = false,
  role = "standalone",
  /** Subagent tool name on the manager (defaults to agentId). */
  followSubagentId,
}: {
  readonly agentId: string;
  readonly className?: string;
  readonly compact?: boolean;
  readonly role?: AgentChatRole;
  readonly followSubagentId?: string;
}) {
  if (role === "live-follower") {
    return (
      <LiveFollowerPane
        agentId={agentId}
        className={className}
        compact={compact}
        followSubagentId={followSubagentId ?? agentId}
      />
    );
  }

  return (
    <InteractiveAgentChat
      agentId={agentId}
      className={className}
      compact={compact}
      role={role}
    />
  );
}

function InteractiveAgentChat({
  agentId,
  className,
  compact,
  role,
}: {
  readonly agentId: string;
  readonly className?: string;
  readonly compact: boolean;
  readonly role: "standalone" | "orchestrator";
}) {
  const meta = getAgent(agentId);
  const orchestration = useOrchestration();
  const agentRef = useRef<ReturnType<typeof useEveAgent> | null>(null);
  const dispatchStoppedRef = useRef(false);
  const [dispatchAck, setDispatchAck] = useState<string | null>(null);
  const agent = useEveAgent({
    agent: agentId,
    onEvent: (event) => {
      if (role === "orchestrator" && orchestration) {
        orchestration.reportParentEvents([event]);

        // Eve's subagent tool normally keeps the parent turn open until the
        // child finishes. Mr Doof is only a dispatcher, so stop consuming the
        // parent stream as soon as a child session has been created. The child
        // session remains available through its own durable stream.
        if (event.type === "subagent.called" && !dispatchStoppedRef.current) {
          dispatchStoppedRef.current = true;
          setDispatchAck("Task sent — read the specialist pane for the reply.");
          queueMicrotask(() => agentRef.current?.stop());
        }
      }
    },
  });
  agentRef.current = agent;

  // Catch-up: if onEvent missed batching, also scan new events
  const seenCount = useRef(0);
  useEffect(() => {
    if (role !== "orchestrator" || !orchestration) return;
    const events = agent.events ?? [];
    if (events.length <= seenCount.current) return;
    const fresh = events.slice(seenCount.current);
    seenCount.current = events.length;
    orchestration.reportParentEvents(fresh);
  }, [agent.events, orchestration, role]);

  const isBusy = agent.status === "submitted" || agent.status === "streaming";
  const messages = dispatchAck
    ? [
        ...agent.data.messages,
        {
          id: `dispatch-ack-${agent.data.messages.length}`,
          role: "assistant",
          parts: [{ type: "text", text: dispatchAck }],
        },
      ]
    : agent.data.messages;
  const isEmpty = messages.length === 0;

  const handleSubmit = async (message: PromptInputMessage) => {
    const text = message.text.trim();
    if ((text.length === 0 && message.files.length === 0) || isBusy) return;
    dispatchStoppedRef.current = false;
    setDispatchAck(null);

    if (message.files.length === 0) {
      await agent.send({ message: text });
      return;
    }

    const parts: UserContent = [];
    if (text.length > 0) parts.push({ text, type: "text" });
    for (const file of message.files) {
      parts.push({
        data: file.url,
        filename: file.filename,
        mediaType: file.mediaType,
        type: "file",
      });
    }
    await agent.send({ message: parts });
  };

  return (
    <ChatShell
      agentId={agentId}
      badge={role === "orchestrator" ? "manager" : undefined}
      className={className}
      compact={compact}
      error={agent.error ?? null}
      isBusy={isBusy}
      isEmpty={isEmpty}
      isStreaming={agent.status === "streaming"}
      messages={messages}
      name={meta.name}
      onInputResponses={(inputResponses) => agent.send({ inputResponses })}
      onStop={agent.stop}
      onSubmit={handleSubmit}
      placeholder={
        role === "orchestrator"
          ? "Tell Mr Doof what to plan — e.g. ask Brain hello, research rockets with Brain + Spark…"
          : (meta.placeholder ?? `Message ${meta.name}…`)
      }
      status={agent.status}
      subtitle={
        role === "orchestrator"
          ? "Delegations stream live into Brain & Spark panes"
          : meta.tagline
      }
      tagline={meta.description}
    />
  );
}

function LiveFollowerPane({
  agentId,
  followSubagentId,
  className,
  compact,
}: {
  readonly agentId: string;
  readonly followSubagentId: string;
  readonly className?: string;
  readonly compact: boolean;
}) {
  const meta = getAgent(agentId);
  const orchestration = useOrchestration();
  const live = orchestration?.latestBySpecialist.get(followSubagentId) ?? null;

  const stream = useChildSessionStream({
    managerAgentId: orchestration?.managerAgentId ?? "mr-doof",
    streamAgentId: live?.streamAgentId,
    childSessionId: live?.childSessionId ?? null,
    brief: live?.brief,
  });

  const isStreaming = stream.status === "streaming";
  const isEmpty = stream.data.messages.length === 0 && !live;

  return (
    <ChatShell
      agentId={agentId}
      badge={
        live
          ? live.status === "running"
            ? "live from Doof"
            : live.status
          : "waiting for Doof"
      }
      className={className}
      compact={compact}
      emptyHint={
        live
          ? undefined
          : "When Mr Doof calls this agent, the brief and reply stream here in real time."
      }
      error={stream.error}
      isBusy={isStreaming}
      isEmpty={isEmpty}
      isStreaming={isStreaming}
      messages={stream.data.messages}
      name={meta.name}
      onInputResponses={() => undefined}
      placeholder="(Live view — talk to Mr Doof to delegate here)"
      readOnly
      status={
        stream.status === "error"
          ? "error"
          : isStreaming
            ? "streaming"
            : stream.status === "done"
              ? "ready"
              : "ready"
      }
      subtitle={
        live
          ? `Session ${live.childSessionId.slice(0, 12)}…`
          : "Spectator for Doof’s subagent"
      }
      tagline={meta.description}
    />
  );
}

function ChatShell({
  agentId: _agentId,
  badge,
  className,
  compact,
  emptyHint,
  error,
  isBusy,
  isEmpty,
  isStreaming,
  messages,
  name,
  onInputResponses,
  onStop,
  onSubmit,
  placeholder,
  readOnly,
  status,
  subtitle,
  tagline,
}: {
  readonly agentId: string;
  readonly badge?: string;
  readonly className?: string;
  readonly compact: boolean;
  readonly emptyHint?: string;
  readonly error: Error | null;
  readonly isBusy: boolean;
  readonly isEmpty: boolean;
  readonly isStreaming: boolean;
  readonly messages: readonly {
    readonly id: string;
    readonly role: string;
    readonly parts: readonly unknown[];
  }[];
  readonly name: string;
  readonly onInputResponses: (
    responses: readonly { requestId: string; optionId?: string; text?: string }[],
  ) => void | Promise<void>;
  readonly onStop?: () => void;
  readonly onSubmit?: (message: PromptInputMessage) => void | Promise<void>;
  readonly placeholder: string;
  readonly readOnly?: boolean;
  readonly status: AgentStatus | "ready" | "streaming" | "error" | "submitted";
  readonly subtitle: string;
  readonly tagline: string;
}) {
  const composer =
    readOnly || !onSubmit ? null : (
      <PromptInput onSubmit={onSubmit}>
        <PromptInputTextarea placeholder={placeholder} />
        <PromptInputSubmit onStop={onStop} status={status as AgentStatus} />
      </PromptInput>
    );

  return (
    <div
      className={cn(
        "flex h-full min-h-0 flex-col overflow-hidden bg-background text-foreground",
        className,
      )}
    >
      <header className="flex h-12 shrink-0 items-center justify-center gap-2 border-b border-border/60 px-3">
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate font-medium text-sm">{name}</span>
          <span className="hidden truncate text-muted-foreground text-xs sm:inline">
            {subtitle}
          </span>
          {badge ? (
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wide",
                badge.includes("live")
                  ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                  : "bg-muted text-muted-foreground",
              )}
            >
              {badge.includes("live") ? <Radio className="size-3 animate-pulse" /> : null}
              {badge}
            </span>
          ) : null}
          <StatusDot
            status={
              status === "submitted" || status === "streaming"
                ? status
                : status === "error"
                  ? "error"
                  : "ready"
            }
          />
        </span>
      </header>

      {error ? (
        <div className="mx-auto w-full max-w-3xl shrink-0 px-4 pt-2 sm:px-6">
          <div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm">
            <AlertCircleIcon className="mt-0.5 size-4 shrink-0 text-destructive" />
            <div>
              <p className="font-medium">Request failed</p>
              <p className="mt-0.5 text-muted-foreground">{error.message}</p>
            </div>
          </div>
        </div>
      ) : null}

      {isEmpty ? null : (
        <Conversation className="min-h-0 flex-1">
          <ConversationContent
            className={cn(
              "mx-auto w-full max-w-3xl gap-6 px-4 py-6 sm:px-6",
              compact && "px-3 py-4",
            )}
          >
            {messages.map((message, index) => (
              <AgentMessage
                canRespond={!isBusy && !readOnly}
                isStreaming={isStreaming && index === messages.length - 1}
                key={message.id}
                message={message as never}
                onInputResponses={onInputResponses}
              />
            ))}
          </ConversationContent>
          <ConversationScrollButton />
        </Conversation>
      )}

      <div
        className={cn(
          "mx-auto w-full px-4 sm:px-6",
          isEmpty
            ? "flex max-w-xl flex-1 flex-col items-center justify-center gap-6 pb-[8vh]"
            : "max-w-3xl shrink-0 pb-4",
          compact && "px-3",
        )}
      >
        {isEmpty ? (
          <div className="flex flex-col items-center gap-2 text-center">
            <h1
              className={cn(
                "font-medium tracking-tighter",
                compact ? "text-3xl" : "text-5xl",
              )}
            >
              {name}
            </h1>
            <p className="max-w-sm text-muted-foreground text-sm">
              {emptyHint ?? tagline}
            </p>
          </div>
        ) : null}
        {composer ? <div className="w-full">{composer}</div> : null}
        {readOnly && !isEmpty ? (
          <p className="pt-2 text-center text-muted-foreground text-xs">
            Read-only live view · message Mr Doof to keep going
          </p>
        ) : null}
      </div>
    </div>
  );
}

function StatusDot({ status }: { readonly status: AgentStatus }) {
  const isLive = status === "submitted" || status === "streaming";
  const tone =
    status === "error"
      ? "bg-destructive"
      : isLive
        ? "bg-emerald-500"
        : "bg-muted-foreground";

  return (
    <span className="relative flex size-1.5">
      {isLive ? (
        <span
          className={cn(
            "absolute inline-flex size-full animate-ping rounded-full opacity-75",
            tone,
          )}
        />
      ) : null}
      <span
        className={cn("relative inline-flex size-1.5 rounded-full transition-colors", tone)}
      />
    </span>
  );
}
