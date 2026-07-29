"use client";

import { ArrowDownLeft, ArrowUpRight } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import type { JournalView } from "@/lib/query";
import { formatTime, renderContentWithTags } from "./shared";

interface ReferenceModalProps {
  isOpen: boolean;
  onClose: () => void;
  note: JournalView;
  /** 当前笔记的名称/标题 */
  noteName: string;
  /** 所有笔记，用于查询引用和被引用关系 */
  allNotes: JournalView[];
}

export function ReferenceModal({ isOpen, onClose, note, noteName, allNotes }: ReferenceModalProps) {
  const outgoingIds = new Set(note.relatedNoteIds ?? []);
  const outgoing = allNotes.filter((n) => outgoingIds.has(n.id));
  const incoming = allNotes.filter(
    (n) => n.relatedNoteIds?.includes(note.id) && n.id !== note.id
  );
  const hasRefs = outgoing.length > 0 || incoming.length > 0;

  const contentLines = (note.userNotes ?? '').split('\n');

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[95vw] max-w-[1200px] h-[80vh] max-h-[580px] gap-0 p-0 overflow-hidden flex flex-col">
        <DialogTitle className="sr-only">笔记引用关系</DialogTitle>

        <div className="flex min-h-0 flex-1">
          {/* 左侧：原始笔记 */}
          <div className="w-1/2 flex flex-col border-r border-border/30 overflow-hidden">
            <div className="px-4 pt-3 pb-2 border-b border-border/20 bg-muted/10">
              <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/50">原始笔记</span>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
              {noteName && (
                <div className="text-xs font-semibold text-foreground/90">
                  {noteName}
                </div>
              )}
              <div className="text-xs text-muted-foreground leading-relaxed">
                {renderContentWithTags(contentLines.join('\n'))}
              </div>
              <div className="flex items-center gap-1 pt-1 text-[10px] text-muted-foreground/40">
                {formatTime(note.createdAt)}
              </div>
            </div>
          </div>

          {/* 右侧：引用和被引用 */}
          <div className="w-1/2 flex flex-col overflow-hidden">
            <div className="px-4 pt-3 pb-2 border-b border-border/20 bg-muted/10">
              <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/50">引用关系</span>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
              {!hasRefs && (
                <div className="text-xs text-muted-foreground/50 text-center py-8">
                  暂无引用关系
                </div>
              )}

              {/* 引用（出链） */}
              {outgoing.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <ArrowUpRight className="w-3.5 h-3.5 text-primary/60" />
                    <span className="text-xs font-medium text-foreground/80">
                      引用 ({outgoing.length})
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    {outgoing.map((ref) => (
                      <div key={ref.id} className="rounded-lg border border-border/30 bg-card px-3 py-2">
                        {ref.name && (
                          <div className="text-[10px] text-muted-foreground/40 truncate mb-0.5">{ref.name}</div>
                        )}
                        <div className="text-xs text-foreground/80 leading-relaxed line-clamp-4">
                          {renderContentWithTags((ref.userNotes ?? '').split('\n').slice(0, 8).join('\n'))}
                        </div>
                        <div className="text-[10px] text-muted-foreground/40 mt-1">{formatTime(ref.createdAt)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 被引用（入链） */}
              {incoming.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <ArrowDownLeft className="w-3.5 h-3.5 text-primary/60" />
                    <span className="text-xs font-medium text-foreground/80">
                      被引用 ({incoming.length})
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    {incoming.map((ref) => (
                      <div key={ref.id} className="rounded-lg border border-border/30 bg-card px-3 py-2">
                        {ref.name && (
                          <div className="text-[10px] text-muted-foreground/40 truncate mb-0.5">{ref.name}</div>
                        )}
                        <div className="text-xs text-foreground/80 leading-relaxed line-clamp-4">
                          {renderContentWithTags((ref.userNotes ?? '').split('\n').slice(0, 8).join('\n'))}
                        </div>
                        <div className="text-[10px] text-muted-foreground/40 mt-1">{formatTime(ref.createdAt)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
