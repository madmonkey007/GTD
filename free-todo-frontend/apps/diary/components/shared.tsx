"use client";

import { Fragment } from "react";

export function renderContentWithTags(text: string): React.ReactNode[] {
  const parts = text.split(/(\s?#\S+)/g);
  return parts.map((part, i) => {
    const m = part.match(/^\s?#(\S+)$/);
    if (m && m[1]) {
      const leading = part.startsWith(" ") ? " " : "";
      return (
        <Fragment key={i}>
          {leading}
          <span className="inline-flex items-center rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary align-middle">
            #{m[1]}
          </span>
        </Fragment>
      );
    }
    return <Fragment key={i}>{part}</Fragment>;
  });
}

export function formatTime(dateStr: string) {
  const d = new Date(dateStr);
  return (
    d.getFullYear() +
    "-" +
    String(d.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(d.getDate()).padStart(2, "0") +
    " " +
    String(d.getHours()).padStart(2, "0") +
    ":" +
    String(d.getMinutes()).padStart(2, "0")
  );
}
