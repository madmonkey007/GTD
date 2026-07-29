"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Copy, MessageSquareText } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { motion } from "framer-motion";
import type { ChatMessage, ToolCallStep } from "@/apps/chat/types";

// ─── MergedStep type ───

export type MergedStep =
  | { type: "thinking"; content: string; index: number; insertAt: number }
  | { type: "tool"; step: ToolCallStep; index: number; insertAt: number }
  | { type: "text"; content: string; index: number; insertAt: number };

// ─── Markdown content ───

export function MarkdownContent({ text }: { text: string }) {
  return (
    <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-1.5 prose-p:leading-relaxed prose-headings:mb-2 prose-headings:mt-4 prose-headings:text-foreground prose-headings:font-semibold prose-a:text-primary prose-a:no-underline hover:prose-a:underline prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5 prose-li:leading-relaxed prose-code:px-1 prose-code:py-0.5 prose-code:rounded-md prose-code:bg-muted/60 prose-code:text-foreground prose-code:text-[11px] prose-pre:bg-muted/40 prose-pre:border prose-pre:border-border/40 prose-pre:rounded-xl prose-strong:text-foreground">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
    </div>
  );
}

// ─── Auto-collapse thinking block ───

export function AutoCollapseThinkingBlock({ content }: { content: string }) {
  const [open, setOpen] = useState(true);

  useEffect(() => {
    setOpen(true);
    const timer = setTimeout(() => setOpen(false), 3000);
    return () => clearTimeout(timer);
  }, [content]);

  return (
    <details className="mt-1.5" open={open} onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary className="flex items-center gap-1.5 cursor-pointer text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors select-none list-none [&::-webkit-details-marker]:hidden [&::marker]:hidden group">
        <span>思考过程</span>
        <svg
          className="w-3 h-3 transition-transform group-open:rotate-90 opacity-0 group-hover:opacity-100"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m9 18 6-6-6-6" />
        </svg>
      </summary>
      <div className="mt-1.5 pl-4 text-xs leading-relaxed text-muted-foreground/70 italic border-l-2 border-muted-foreground/20 prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-p:leading-relaxed">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
      </div>
    </details>
  );
}

// ─── Tool call step (inline chip) ───

export function ToolCallStepChip({ step }: { step: ToolCallStep }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="my-1.5">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="group flex items-center gap-2 w-full text-left px-2 py-1 rounded-md hover:bg-muted/50 transition-colors text-muted-foreground/70"
      >
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3.5 h-3.5 flex-shrink-0">
          <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75a4.5 4.5 0 0 1-4.884 4.484c-1.076-.091-2.264.071-2.95.904l-7.152 8.684a2.548 2.548 0 1 1-3.586-3.586l8.684-7.152c.833-.686.995-1.874.904-2.95a4.5 4.5 0 0 1 6.336-4.486l-3.276 3.276a3.004 3.004 0 0 0 2.25 2.25l3.276-3.276c.256.565.398 1.192.398 1.852Z" />
        </svg>
        <span className="text-xs truncate">
          {step.toolName}
          {step.status === "running" && (
            <span className="ml-1.5 inline-flex items-center gap-1">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 bg-muted-foreground/70" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-muted-foreground/70" />
              </span>
            </span>
          )}
        </span>
        <svg
          className="w-3 h-3 flex-shrink-0 transition-transform duration-200 opacity-0 group-hover:opacity-100"
          style={{ transform: expanded ? "rotate(90deg)" : "rotate(0deg)" }}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m9 18 6-6-6-6" />
        </svg>
      </button>
      {expanded && step.resultPreview && (
        <pre className="mt-0.5 ml-8 px-2 py-1.5 rounded-md text-[11px] leading-relaxed whitespace-pre-wrap break-all overflow-x-auto max-h-48 overflow-y-auto bg-muted/40 text-muted-foreground/70">
          {step.resultPreview}
        </pre>
      )}
    </div>
  );
}

// ─── Execution process (thinking + tool calls merged chronologically) ───

export function ExecutionProcess({
  mergedItems,
  isStreaming,
  firstThinkingEnded,
}: {
  mergedItems: MergedStep[];
  isStreaming: boolean;
  firstThinkingEnded: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const startTimeRef = useRef<number | null>(null);

  // Timer: count up every second while streaming
  useEffect(() => {
    if (isStreaming) {
      if (!startTimeRef.current) {
        startTimeRef.current = Date.now();
      }
      const interval = setInterval(() => {
        setElapsed(Math.floor((Date.now() - startTimeRef.current!) / 1000));
      }, 1000);
      return () => {
        clearInterval(interval);
        if (startTimeRef.current) {
          setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
        }
      };
    }
  }, [isStreaming]);

  // Open during streaming; close when streaming ends
  useEffect(() => {
    if (isStreaming) {
      setOpen(true);
    } else if (startTimeRef.current !== null) {
      setOpen(false);
    }
  }, [isStreaming]);

  if (mergedItems.length === 0 && !isStreaming) return null;

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}h${m}m${s}s`;
    if (m > 0) return `${m}m${s}s`;
    return `${s}s`;
  };

  return (
    <>
      <style>{`
        @keyframes shimmerText {
          0% { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
      `}</style>
      <details className="mb-3" open={open} onToggle={(e) => setOpen(e.currentTarget.open)}>
        <summary className="flex items-center gap-1.5 cursor-pointer text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors select-none list-none [&::-webkit-details-marker]:hidden [&::marker]:hidden">
          <span className="flex items-center gap-1.5">
            {isStreaming && !firstThinkingEnded ? (
              <span
                className="relative inline-block font-medium"
                style={{
                  background: "linear-gradient(90deg, currentColor 0%, currentColor 30%, rgba(255,255,255,0.8) 50%, currentColor 70%, currentColor 100%)",
                  backgroundSize: "200% 100%",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                  animation: "shimmerText 3s linear infinite",
                }}
              >
                思考中
              </span>
            ) : (
              <span>已处理</span>
            )}
            <span className="tabular-nums">{formatTime(elapsed)}</span>
          </span>
          <svg
            className="w-3 h-3 transition-transform duration-200"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ transform: open ? "rotate(90deg)" : "rotate(0deg)" }}
          >
            <path d="m9 18 6-6-6-6" />
          </svg>
        </summary>
        <div className="mt-2 space-y-1">
          {mergedItems.map((item, i) => {
            if (item.type === "thinking") {
              return <AutoCollapseThinkingBlock key={`think-${i}`} content={item.content} />;
            }
            if (item.type === "text") {
              return (
                <div
                  key={`text-${i}`}
                  className="py-0.5 text-xs leading-relaxed text-muted-foreground/80 whitespace-pre-wrap break-words"
                >
                  {item.content}
                </div>
              );
            }
            return <ToolCallStepChip key={item.step.id} step={item.step} />;
          })}
        </div>
      </details>
    </>
  );
}

// ─── Final response ───

export function FinalResponse({ text, isStreaming }: { text: string; isStreaming: boolean }) {
  if (!text.trim()) return null;
  const showStreaming = isStreaming && !text.trim();
  if (showStreaming) return null;
  return <MarkdownContent text={text} />;
}

// ─── Message actions ───

export function MessageActions({ content }: { content: string }) {
  const [copied, setCopied] = useState(false);
  const copyContent = content
    .replace(/\[THINK\][\s\S]*?\[\/THINK\]/g, "")
    .replace(/\[THINK\][\s\S]*/g, "")
    .trim() || content;

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(copyContent).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  }, [copyContent]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.3, duration: 0.2 }}
      className="flex items-center gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
    >
      <button type="button" onClick={handleCopy} title="复制"
        className="rounded-md p-1 text-muted-foreground/40 hover:text-foreground hover:bg-muted/50 transition-colors">
        {copied ? <Check className="w-3.5 h-3.5 text-primary" /> : <Copy className="w-3.5 h-3.5" />}
      </button>
    </motion.div>
  );
}

// ─── Streaming indicator ───

export function StreamingIndicator({ text }: { text?: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-muted-foreground/60">
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary/40" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-primary/60" />
      </span>
      <span className="text-xs">{text ?? "分析中"}</span>
    </span>
  );
}

// ─── Parse thinking blocks ───

export function parseThinkingContent(content: string): Array<{ type: "text" | "think"; content: string }> {
  const parts: Array<{ type: "text" | "think"; content: string }> = [];
  const regex = /\[THINK\]([\s\S]*?)\[\/THINK\]/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: "text", content: content.slice(lastIndex, match.index) });
    }
    parts.push({ type: "think", content: match[1] });
    lastIndex = regex.lastIndex;
  }
  const remaining = content.slice(lastIndex);
  if (remaining) {
    const unclosed = remaining.match(/\[THINK\]([\s\S]*)/);
    if (unclosed) {
      if (unclosed.index! > 0) parts.push({ type: "text", content: remaining.slice(0, unclosed.index) });
      parts.push({ type: "think", content: unclosed[1] });
    } else {
      parts.push({ type: "text", content: remaining });
    }
  }
  return parts;
}

// ─── Strip [THINK] tags from text ───

export function stripThink(s: string): string {
  return s.replace(/\[THINK\][\s\S]*?\[\/THINK\]/g, "").replace(/\[THINK\][\s\S]*/g, "").trim();
}

// ─── Build merged execution timeline from content + steps ───

export function buildExecutionTimeline(content: string, steps?: ToolCallStep[]): MergedStep[] {
  type Item = { kind: "think" | "tool" | "text"; start: number; thinkContent?: string; step?: ToolCallStep; text?: string };
  const items: Item[] = [];

  const thinkRe = /\[THINK\]([\s\S]*?)(\[\/THINK\]|$)/g;
  let tm: RegExpExecArray | null;
  let thinkEnd = 0;
  while ((tm = thinkRe.exec(content)) !== null) {
    if (tm.index > thinkEnd) {
      const seg = stripThink(content.slice(thinkEnd, tm.index));
      if (seg) items.push({ kind: "text", start: thinkEnd, text: seg });
    }
    items.push({ kind: "think", start: tm.index, thinkContent: tm[1] });
    thinkEnd = tm.index + tm[0].length;
    if (tm[2] !== "[/THINK]") break;
  }
  const tailText = stripThink(content.slice(thinkEnd));
  if (tailText) items.push({ kind: "text", start: thinkEnd, text: tailText });

  (steps || []).forEach((step) => {
    if (typeof step.insertAt === "number") {
      items.push({ kind: "tool", start: step.insertAt, step });
    }
  });
  items.sort((a, b) => a.start - b.start);

  return items.map((it, i) => {
    if (it.kind === "think") return { type: "thinking" as const, content: it.thinkContent ?? "", index: i, insertAt: it.start };
    if (it.kind === "tool" && it.step) return { type: "tool" as const, step: it.step, index: i, insertAt: it.start };
    return { type: "text" as const, content: it.text ?? "", index: i, insertAt: it.start };
  });
}

// ─── AssistantBody ───

export function AssistantBody({
  content,
  steps,
  finalReply,
  isStreaming,
}: {
  content: string;
  steps?: ToolCallStep[];
  finalReply?: { source: string; text: string };
  isStreaming: boolean;
}) {
  const closedThinkingCount = (content.match(/\[THINK\][\s\S]*?\[\/THINK\]/g) || []).length;
  const firstThinkingEnded = closedThinkingCount > 0 || !!(steps && steps.length > 0) || !!finalReply;

  const mergedItems = buildExecutionTimeline(content, steps);
  const finalText = finalReply?.text ?? (isStreaming ? "" : stripThink(content));

  return (
    <>
      <ExecutionProcess
        mergedItems={mergedItems}
        isStreaming={isStreaming}
        firstThinkingEnded={firstThinkingEnded}
      />
      <FinalResponse text={finalText} isStreaming={isStreaming} />
    </>
  );
}

// ─── MessageBubble ───

export function MessageBubble({
  msg,
  isStreaming,
}: {
  msg: ChatMessage;
  isStreaming: boolean;
}) {
  const isUser = msg.role === "user";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className={`flex ${isUser ? "justify-end" : "justify-start"}`}
    >
      <div className={isUser ? "max-w-[85%] min-w-0" : "w-full min-w-0"}>
        {/* 用户消息附带的笔记卡片 */}
        {isUser && msg.attachedNotes && msg.attachedNotes.length > 0 && (
          <div className="flex flex-col gap-1.5 mb-1.5 items-end">
            {msg.attachedNotes.map((n) => (
              <div key={n.id} className="w-full max-w-full rounded-lg border border-border/40 bg-background px-2.5 py-1.5">
                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/70">
                  <MessageSquareText className="w-3 h-3" />
                  <span className="truncate">{n.name}</span>
                  {n.date && <span className="ml-auto shrink-0">{n.date.slice(5, 10)}</span>}
                </div>
                {n.preview && (
                  <p className="mt-0.5 text-[11px] text-muted-foreground/60 line-clamp-2 leading-relaxed">{n.preview}</p>
                )}
              </div>
            ))}
          </div>
        )}
        <div className={`px-3.5 text-sm leading-relaxed ${
          isUser
            ? "inline-block rounded-lg py-1.5 text-foreground"
            : "rounded-2xl py-2.5 text-foreground border border-border/30 bg-muted/25"
        }`} style={isUser ? { backgroundColor: "#EFEFEE" } : undefined}>
          {isUser ? (
            msg.content ? (
              <p className="whitespace-pre-wrap text-[13px]">{msg.content}</p>
            ) : null
          ) : (
            <>
              {msg.content === "" && isStreaming && !(msg.toolCallSteps && msg.toolCallSteps.length > 0) ? (
                <StreamingIndicator text="处理中" />
              ) : (msg.content || (msg.toolCallSteps && msg.toolCallSteps.length > 0)) ? (
                <div className="text-[13px] [&_details+div]:mt-3 [&_details]:mb-3">
                  <AssistantBody content={msg.content} steps={msg.toolCallSteps} finalReply={msg.finalReply} isStreaming={isStreaming} />
                </div>
              ) : null}
            </>
          )}
        </div>
        {!isUser && (msg.content || msg.finalReply) && <MessageActions content={msg.finalReply?.text ?? msg.content} />}
      </div>
    </motion.div>
  );
}
