"use client";

import { Clock, MessageSquarePlus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import type { JournalView } from "@/lib/query";
import { renderContentWithTags, formatTime } from "./shared";

interface CompareNotesModalProps {
  isOpen: boolean;
  onClose: () => void;
  sourceNote: JournalView;
  currentNote: JournalView;
}

function NoteCard({
  note,
  label,
}: {
  note: JournalView;
  label: string;
}) {
  const contentLines = (note.userNotes ?? "").split("\n");
  const displayContent = contentLines.slice(0, 20);
  const isLong = contentLines.length > 20;

  return (
    <div className="flex flex-col">
      <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/50 mb-2 px-1">
        {label}
      </div>
      <div className="rounded-xl border border-border/30 bg-card px-4 py-3 flex-1">
        {note.name && (
          <div className="text-sm font-semibold text-foreground mb-2 truncate">
            {note.name}
          </div>
        )}
        <div className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap">
          {renderContentWithTags(displayContent.join("\n"))}
          {isLong && (
            <span className="text-muted-foreground/40">{"\n"}...</span>
          )}
        </div>
        <div className="flex items-center gap-1 mt-3 text-[10px] text-muted-foreground/50">
          <Clock className="w-3 h-3 text-muted-foreground/40" />
          {formatTime(note.createdAt)}
        </div>
      </div>
    </div>
  );
}

export function CompareNotesModal({
  isOpen,
  onClose,
  sourceNote,
  currentNote,
}: CompareNotesModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl gap-0 p-0 overflow-hidden max-h-[80vh]">
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-border/30">
          <DialogTitle className="text-base font-semibold flex items-center gap-2">
            <MessageSquarePlus className="w-4 h-4 text-primary/60" />
            关联笔记对比
          </DialogTitle>
        </div>
        <div className="flex gap-4 p-5 overflow-y-auto flex-1 min-h-0">
          <div className="flex-1 min-w-0">
            <NoteCard note={sourceNote} label="被关联的笔记" />
          </div>
          <div className="flex-1 min-w-0">
            <NoteCard note={currentNote} label="当前笔记" />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
