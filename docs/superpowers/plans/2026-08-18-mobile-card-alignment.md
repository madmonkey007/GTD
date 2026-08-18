# Mobile Card Alignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make mobile note reference metadata compact and aligned, tighten note action spacing, and move todo expansion controls to the right edge.

**Architecture:** Keep behavior in the existing components and change only composition plus responsive utility classes. Apply equivalent reference styling to the standard diary card and time-machine card; move the existing todo expand component into the established right-side action group.

**Tech Stack:** React 19, TypeScript, Tailwind CSS, Next.js, Biome

---

### Task 1: Compact note-card references and actions

**Files:**
- Modify: `lifetrace-frontend/apps/diary/DiaryEditor.tsx`
- Modify: `lifetrace-frontend/apps/diary/components/TimeMachineNoteCard.tsx`

- [ ] **Step 1: Record the current visual contract**

Confirm both components currently use `text-sm` for reference summaries and separate mobile `p-2` action buttons. This establishes the failing state: reference metadata matches body size and the action buttons consume excess horizontal space.

- [ ] **Step 2: Make the standard diary reference block compact**

Change the expandable summary and individual incoming/outgoing rows to `text-xs` on mobile. Use `items-center`, `leading-none` on the icon wrapper, and `shrink-0` on icons so the glyph center aligns with the text line. Wrap Chat and Link buttons in one `flex items-center gap-0.5` container; keep each mobile button at least `h-9 w-9` while removing independent padding that creates visual separation.

- [ ] **Step 3: Apply the same reference alignment to time-machine cards**

Change the reference wrapper from unconditional `text-sm` to responsive `text-xs sm:text-sm`. Set reference buttons to `items-center`, keep arrow-circle icons `shrink-0`, and use a compact `gap-0` action group on mobile while preserving desktop hover behavior.

- [ ] **Step 4: Run targeted formatting checks**

Run:

```bash
cd lifetrace-frontend
pnpm exec biome check apps/diary/DiaryEditor.tsx apps/diary/components/TimeMachineNoteCard.tsx
```

Expected: `Checked 2 files` with no errors.

### Task 2: Move todo expansion to the right action area

**Files:**
- Modify: `lifetrace-frontend/apps/todo-list/TodoCard.tsx`
- Modify: `lifetrace-frontend/apps/todo-list/components/TodoCardExpandButton.tsx`

- [ ] **Step 1: Remove the expand control from the left content row**

Delete the `TodoCardExpandButton` instance before `TodoCardCheckbox`. The checkbox becomes the first child, so cards with and without children share the same left text origin.

- [ ] **Step 2: Insert the existing control into the right action group**

Render `TodoCardExpandButton` at the start of the existing right-side action container beside AI breakdown/advice controls. Keep `hasChildren`, `isExpanded`, and `onToggle` unchanged so tree behavior and accessibility labels remain intact.

- [ ] **Step 3: Normalize expand-button alignment**

Remove `self-start mt-1` from `TodoCardExpandButton`; use the same mobile `h-9 w-9` and desktop `h-6 w-6` sizing as adjacent action buttons. Preserve the Chevron rotation animation.

- [ ] **Step 4: Verify formatting and type safety**

Run:

```bash
cd lifetrace-frontend
pnpm exec biome check apps/todo-list/TodoCard.tsx apps/todo-list/components/TodoCardExpandButton.tsx
pnpm exec tsc --noEmit
```

Expected: Biome passes. TypeScript passes, or only pre-existing unrelated errors are reported and recorded.

### Task 3: Build and commit

**Files:**
- Verify all four modified component files.

- [ ] **Step 1: Run the production build**

```bash
cd lifetrace-frontend
pnpm build
```

Expected: Next.js production build exits successfully.

- [ ] **Step 2: Review the scoped diff**

```bash
git diff --check
git diff -- lifetrace-frontend/apps/diary/DiaryEditor.tsx lifetrace-frontend/apps/diary/components/TimeMachineNoteCard.tsx lifetrace-frontend/apps/todo-list/TodoCard.tsx lifetrace-frontend/apps/todo-list/components/TodoCardExpandButton.tsx
```

Expected: no whitespace errors and no data-flow changes.

- [ ] **Step 3: Commit the implementation**

Stage only the four component files, commit with verification evidence, and push `main`. Do not stage the user's unrelated working-tree changes.
