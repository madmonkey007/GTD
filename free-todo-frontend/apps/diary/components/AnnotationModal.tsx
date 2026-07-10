"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Send, MessageSquarePlus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { JournalView } from "@/lib/query";

interface AnnotationModalProps {
  isOpen: boolean;
  onClose: () => void;
  sourceNote: JournalView;
  onSubmit: (content: string) => void;
  isSubmitting?: boolean;
}

export function AnnotationModal({
  isOpen,
  onClose,
  sourceNote,
  onSubmit,
  isSubmitting = false,
}: AnnotationModalProps) {
  const [content, setContent] = useState("");
  const editorRef = useRef<HTMLDivElement>(null);
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setContent("");
      setTimeout(() => editorRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const handleSubmit = useCallback(() => {
    const trimmed = content.trim();
    if (!trimmed || isSubmitting) return;
    onSubmit(trimmed);
  }, [content, isSubmitting, onSubmit]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        handleSubmit();
      }
      if (e.key === "Escape") {
        onClose();
      }
    },
    [handleSubmit, onClose],
  );

  const sourcePreview =
    sourceNote.userNotes?.replace(/\n/g, " ").slice(0, 120) ?? "";

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg gap-0 p-0 overflow-hidden">
        <DialogHeader className="px-5 pt-4 pb-0">
          <DialogTitle className="text-base font-semibold flex items-center gap-2">
            <MessageSquarePlus className="w-4 h-4 text-primary/60" />
            批注
          </DialogTitle>
        </DialogHeader>

        <div className="px-5 pt-3 pb-2">
          <div
            className={
              "relative rounded-xl border transition-all duration-200 " +
              (isFocused
                ? "border-primary/40 shadow-[0_0_0_1px_rgba(var(--primary)/0.08)]"
                : "border-border/40")
            }
          >
            <div
              ref={editorRef}
              contentEditable
              suppressContentEditableWarning
              onInput={(e) =>
                setContent((e.target as HTMLDivElement).innerText || "")
              }
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              onKeyDown={handleKeyDown}
              data-placeholder="输入批注内容..."
              className="w-full text-sm leading-relaxed text-foreground placeholder:text-muted-foreground/70 focus-visible:outline-none px-3 pt-3 min-h-[100px] whitespace-pre-wrap empty:before:content-[attr(data-placeholder)] empty:before:text-muted-foreground/70"
            />
            <div className="flex items-center justify-end px-2 pb-2 pt-1">
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!content.trim() || isSubmitting}
                className="rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20 transition-colors disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1 active:scale-[0.97]"
              >
                <Send className="w-3.5 h-3.5" />
                {isSubmitting ? "发送中..." : "发送"}
              </button>
            </div>
          </div>
        </div>

        {sourcePreview && (
          <div className="mx-5 mb-4 p-2.5 rounded-lg bg-muted/30 border border-border/30">
            <div className="flex items-start gap-1.5">
              <MessageSquarePlus className="w-3 h-3 text-muted-foreground/40 mt-0.5 shrink-0" />
              <span className="text-[11px] text-muted-foreground/60 leading-relaxed line-clamp-1">
                {sourcePreview}
              </span>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
