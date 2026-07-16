"use client";

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
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
  recentTags?: string[];
}

export function AnnotationModal({
  isOpen,
  onClose,
  sourceNote,
  onSubmit,
  isSubmitting = false,
  recentTags = [],
}: AnnotationModalProps) {
  const [content, setContent] = useState("");
  const editorRef = useRef<HTMLDivElement>(null);
  const autocompleteRef = useRef<HTMLDivElement>(null);
  const [isFocused, setIsFocused] = useState(false);
  const [cursorPos, setCursorPos] = useState<{ top: number; left: number } | null>(null);
  const cursorPosRef = useRef<{ top: number; left: number } | null>(null);
  const [tagAutocomplete, setTagAutocomplete] = useState<{
    query: string;
    open: boolean;
    selectedIndex: number;
  }>({ query: "", open: false, selectedIndex: 0 });

  const tagAutocompleteVisible = tagAutocomplete.open && recentTags.length > 0;

  const filteredTags = useMemo(() => {
    if (!tagAutocomplete.open) return [];
    const q = tagAutocomplete.query.toLowerCase();
    return recentTags
      .filter((t) => !q || t.toLowerCase().includes(q))
      .slice(0, 8);
  }, [recentTags, tagAutocomplete.open, tagAutocomplete.query]);

  const closeAutocomplete = useCallback(() => {
    setTagAutocomplete({ query: "", open: false, selectedIndex: 0 });
    setCursorPos(null);
  }, []);

  useEffect(() => {
    if (isOpen) {
      setContent("");
      closeAutocomplete();
      setTimeout(() => editorRef.current?.focus(), 100);
    }
  }, [isOpen, closeAutocomplete]);

  // 点击外部关闭补全列表
  useEffect(() => {
    if (!tagAutocompleteVisible) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      // 下拉用 Portal 渲染到 body，autocompleteRef 仍指向它
      if (autocompleteRef.current && autocompleteRef.current.contains(target)) {
        return; // 点在下拉内，不关闭
      }
      // 点在编辑器内也不关闭（编辑器输入会自己管理）
      if (editorRef.current && editorRef.current.contains(target)) {
        return;
      }
      closeAutocomplete();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [tagAutocompleteVisible, closeAutocomplete]);

  const syncContent = useCallback(() => {
    const div = editorRef.current;
    if (!div) return;
    setContent(div.innerText || "");
  }, []);

  const insertTagFromAutocomplete = useCallback(
    (tagName: string) => {
      const div = editorRef.current;
      if (!div) {
        console.log("[AnnotationModal] insertTag: no editor div");
        closeAutocomplete();
        return;
      }
      // 点击下拉时编辑器失去焦点，selection 可能不在编辑器内。
      // 先把焦点和选区恢复到编辑器末尾，再插入标签。
      div.focus();
      const sel = window.getSelection();
      if (!sel) {
        console.log("[AnnotationModal] insertTag: no selection");
        closeAutocomplete();
        return;
      }

      // 尝试拿到当前选区；如果不在文本节点上，定位到编辑器末尾
      let range: Range;
      let node: Node;
      let pos: number;
      if (sel.rangeCount && sel.getRangeAt(0).startContainer.nodeType === Node.TEXT_NODE) {
        range = sel.getRangeAt(0);
        node = range.startContainer;
        pos = range.startOffset;
      } else {
        // 选区不在文本节点，把光标放到编辑器最后一个文本节点末尾
        range = document.createRange();
        const lastText = div.lastChild;
        if (lastText && lastText.nodeType === Node.TEXT_NODE) {
          range.setStart(lastText, lastText.nodeValue?.length ?? 0);
        } else {
          range.selectNodeContents(div);
          range.collapse(false);
        }
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
        node = range.startContainer;
        pos = range.startOffset;
      }

      if (node.nodeType !== Node.TEXT_NODE) {
        console.log("[AnnotationModal] insertTag: node not text, abort");
        closeAutocomplete();
        return;
      }
      const text = node.nodeValue || "";
      const beforeCursor = text.slice(0, pos);
      const hashMatch = beforeCursor.match(/#([^\s#]*)$/);
      if (!hashMatch) {
        console.log("[AnnotationModal] insertTag: no #query at cursor, beforeCursor=", JSON.stringify(beforeCursor));
        closeAutocomplete();
        return;
      }
      const matchStart = hashMatch.index!;
      const afterCursor = text.slice(pos);

      const fragment = document.createDocumentFragment();
      if (matchStart > 0)
        fragment.appendChild(document.createTextNode(text.slice(0, matchStart)));
      const span = document.createElement("span");
      span.className =
        "inline-flex items-center rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary";
      span.contentEditable = "false";
      span.textContent = "#" + tagName;
      fragment.appendChild(span);
      fragment.appendChild(document.createTextNode(" "));
      if (afterCursor) fragment.appendChild(document.createTextNode(afterCursor));
      node.parentNode!.replaceChild(fragment, node);

      const newRange = document.createRange();
      newRange.setStartAfter(span.nextSibling!);
      newRange.collapse(true);
      sel.removeAllRanges();
      sel.addRange(newRange);

      syncContent();
      closeAutocomplete();
    },
    [closeAutocomplete, syncContent],
  );

  const handleInput = useCallback(() => {
    const div = editorRef.current;
    if (!div) {
      console.log("[AnnotationModal] handleInput: no editor div");
      syncContent();
      return;
    }
    const sel = window.getSelection();
    if (!sel?.rangeCount) {
      console.log("[AnnotationModal] handleInput: no selection");
      syncContent();
      return;
    }
    const range = sel.getRangeAt(0);
    const node = range.startContainer;

    // 输入 #query（无尾随空格）时弹出补全
    let beforeText = "";
    if (node.nodeType === Node.TEXT_NODE) {
      beforeText = (node.nodeValue || "").slice(0, range.startOffset);
    } else {
      beforeText = div.innerText || "";
    }
    console.log("[AnnotationModal] handleInput", {
      beforeText,
      nodeType: node.nodeType,
      recentTagsCount: recentTags.length,
    });
    const hashQueryMatch = beforeText.match(/#([^\s#]*)$/);
    if (hashQueryMatch) {
      const query = hashQueryMatch[1];
      if (sel?.rangeCount) {
        const r = sel.getRangeAt(0).getBoundingClientRect();
        const pos = { top: r.bottom + 2, left: r.left };
        cursorPosRef.current = pos;
        setCursorPos(pos);
      }
      setTagAutocomplete((prev) => {
        if (prev.open && prev.query === query && prev.selectedIndex === 0) return prev;
        return { query, open: true, selectedIndex: 0 };
      });
    } else {
      closeAutocomplete();
    }

    syncContent();
  }, [closeAutocomplete, syncContent, recentTags]);

  const handleSubmit = useCallback(() => {
    const trimmed = content.trim();
    if (!trimmed || isSubmitting) return;
    onSubmit(trimmed);
  }, [content, isSubmitting, onSubmit]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // 补全列表打开时，优先处理导航
      if (tagAutocompleteVisible && filteredTags.length > 0) {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setTagAutocomplete((prev) => ({
            ...prev,
            selectedIndex: Math.min(prev.selectedIndex + 1, filteredTags.length - 1),
          }));
          return;
        }
        if (e.key === "ArrowUp") {
          e.preventDefault();
          setTagAutocomplete((prev) => ({
            ...prev,
            selectedIndex: Math.max(prev.selectedIndex - 1, 0),
          }));
          return;
        }
        if (e.key === "Enter" || e.key === "Tab") {
          e.preventDefault();
          const selected = filteredTags[tagAutocomplete.selectedIndex];
          if (selected) insertTagFromAutocomplete(selected);
          return;
        }
        if (e.key === "Escape") {
          e.preventDefault();
          closeAutocomplete();
          return;
        }
      }
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        handleSubmit();
      }
      if (e.key === "Escape") {
        onClose();
      }
    },
    [
      tagAutocompleteVisible,
      filteredTags,
      tagAutocomplete.selectedIndex,
      insertTagFromAutocomplete,
      closeAutocomplete,
      handleSubmit,
      onClose,
    ],
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
              onInput={handleInput}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              onKeyDown={handleKeyDown}
              data-placeholder="输入批注内容..."
              className="w-full text-sm leading-relaxed text-foreground placeholder:text-muted-foreground/70 focus-visible:outline-none px-3 pt-3 min-h-[100px] whitespace-pre-wrap empty:before:content-[attr(data-placeholder)] empty:before:text-muted-foreground/70"
            />
            {/* 标签补全下拉列表 —— 用 Portal 渲染到 body，避免被 Dialog 的层叠上下文/overflow 裁切 */}
            {(() => {
              if (!(tagAutocompleteVisible && filteredTags.length > 0 && cursorPos)) return null;
              const pos = cursorPosRef.current ?? cursorPos;
              const dropdown = (
                <div
                  ref={autocompleteRef}
                  onPointerDown={(e) => e.stopPropagation()}
                  className="fixed z-[9999] min-w-[200px] max-h-48 overflow-y-auto rounded-lg border border-border/60 bg-popover shadow-lg"
                  style={{
                    top: pos.top,
                    left: pos.left,
                    pointerEvents: "auto",
                  }}
                >
                  {filteredTags.map((tag, i) => (
                    <button
                      key={tag}
                      type="button"
                      style={{ cursor: "pointer", pointerEvents: "auto" }}
                      className={
                        "w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left transition-colors " +
                        (i === tagAutocomplete.selectedIndex
                          ? "bg-accent text-accent-foreground"
                          : "text-muted-foreground hover:bg-muted/40")
                      }
                      onPointerDown={(e) => {
                        // Radix Dialog 的 DismissableLayer 会拦截 click，
                        // 所以在 pointerdown 阶段直接插入，并阻止事件冒泡到 Dialog
                        e.preventDefault();
                        e.stopPropagation();
                        insertTagFromAutocomplete(tag);
                      }}
                      onMouseEnter={() =>
                        setTagAutocomplete((prev) => ({ ...prev, selectedIndex: i }))
                      }
                    >
                      <span className="text-primary/60">#</span>
                      {tag}
                    </button>
                  ))}
                </div>
              );
              return typeof document !== "undefined" ? createPortal(dropdown, document.body) : dropdown;
            })()}
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
