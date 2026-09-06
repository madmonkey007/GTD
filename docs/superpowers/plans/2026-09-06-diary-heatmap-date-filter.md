# Diary Heatmap Date Filter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make diary heatmap clicks filter the exact visible local calendar day and expose an unmistakable, toggleable selected state.

**Architecture:** Centralize calendar-day keys and timezone-free API range strings in `journal-utils.ts`. Keep the selected date controlled by `DiaryPanel`, pass it through `DiarySidebar` to `DiaryHeatmap`, and derive both toggle behavior and presentation from the same date key.

**Tech Stack:** React 19, TypeScript, TanStack Query, Tailwind CSS, Node test, Biome, Next.js 16.

---

### Task 1: Lock local-day range and toggle semantics

**Files:**
- Modify: `lifetrace-frontend/apps/diary/journal-utils.test.ts`
- Modify: `lifetrace-frontend/apps/diary/journal-utils.ts`

- [ ] Add failing tests asserting that `getLocalDayApiRange(new Date(2026, 8, 6, 20))` returns `2026-09-06T00:00:00.000` through `2026-09-06T23:59:59.999`, with no `Z` or offset.
- [ ] Add failing tests asserting that `toggleCalendarDate(current, clicked)` returns `null` for the same `formatDateInput` key and a normalized clicked date for a different key.
- [ ] Run `node --test apps/diary/journal-utils.test.ts` and verify failure because the two exports do not exist.
- [ ] Implement both pure helpers using local date parts only; do not call `toISOString()`.
- [ ] Re-run the test and verify all cases pass.

### Task 2: Use local-day boundaries for heatmap filtering

**Files:**
- Modify: `lifetrace-frontend/apps/diary/DiaryEditor.tsx`
- Test: `lifetrace-frontend/apps/diary/journal-utils.test.ts`

- [ ] Replace the heatmap branch that creates local start/end dates and calls `toISOString()` with `getLocalDayApiRange(heatmapFilterDate)`.
- [ ] Keep time-machine behavior unchanged because it is outside this bug's scope.
- [ ] Run the focused unit test and `./node_modules/.bin/tsc --noEmit`; expect zero failures.

### Task 3: Add controlled selection and toggle-off behavior

**Files:**
- Modify: `lifetrace-frontend/apps/diary/DiaryPanel.tsx`
- Modify: `lifetrace-frontend/apps/diary/components/DiarySidebar.tsx`
- Modify: `lifetrace-frontend/apps/diary/components/DiaryHeatmap.tsx`

- [ ] In `DiaryPanel`, create one `handleHeatmapDateSelect` callback that clears mutually exclusive views and applies `toggleCalendarDate(heatmapFilterDate, clicked)`.
- [ ] Pass `heatmapFilterDate` as `selectedDate` to both desktop and mobile `DiarySidebar` instances; remove duplicated inline date-selection handlers.
- [ ] Pass `selectedDate` through `DiarySidebar` to `DiaryHeatmap` and show `M月D日` beside the activity heading when selected.
- [ ] In each heatmap cell compare `formatDateInput(cell.date)` with the selected key. Set `aria-pressed`, a descriptive `aria-label`, and selected classes `ring-2 ring-primary ring-offset-2 scale-110`; apply the weaker today ring only when not selected.
- [ ] Run TypeScript and Biome checks on the four touched files.

### Task 4: Visual and production verification

**Files:**
- No production-file changes unless verification identifies a defect directly within scope.

- [ ] Run `node --test apps/diary/journal-utils.test.ts`.
- [ ] Run `./node_modules/.bin/tsc --noEmit`.
- [ ] Run the Impeccable detector once over `DiaryHeatmap.tsx`, `DiarySidebar.tsx`, and `DiaryPanel.tsx`; resolve only findings introduced by this change.
- [ ] Run `./node_modules/.bin/next build` and verify a zero exit code.
- [ ] Check desktop and mobile layouts: selected day is obvious, today remains distinguishable, same-day click clears the filter, and a note after 16:00 local time appears for its visible calendar date.

