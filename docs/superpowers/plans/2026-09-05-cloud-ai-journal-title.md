# Cloud AI Journal Title Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make cloud journal saves return immediately and apply a complete AI-generated title shortly afterward without polling, full-list refreshes, white flashes, duplicate requests, or overwriting a user title.

**Architecture:** Separate persistence from title generation with an idempotent authenticated endpoint. The frontend starts that request after a successful save and patches only the affected journal caches and active draft when the complete title returns. A conditional repository update enforces user-edit-wins at the database boundary.

**Tech Stack:** FastAPI, SQLAlchemy, Pydantic, React 19, TanStack Query 5, TypeScript, pytest, Node test/typecheck, Biome.

---

## File map

- Modify `lifetrace/services/journal_service.py`: remove model work from save requests; expose explicit title generation and retain title cleaning/model fallback logic.
- Modify `lifetrace/repositories/interfaces.py`: define conditional title-update contract.
- Modify `lifetrace/repositories/sql_journal_repository.py`: implement user-scoped compare-and-set title update.
- Modify `lifetrace/storage/journal_manager.py`: execute the atomic SQL update and report whether it won the race.
- Modify `lifetrace/routers/journal.py`: add the authenticated generate-title endpoint.
- Modify `lifetrace-frontend/lib/query/journals.ts`: invoke title generation in the background, deduplicate requests, and patch caches precisely.
- Modify `lifetrace-frontend/apps/diary/DiaryPanel.tsx`: accept completed titles into the active draft only when safe.
- Add/modify backend journal tests under `tests/`: lock non-blocking saves, endpoint behavior, ownership, retry, and user-edit-wins semantics.
- Add `lifetrace-frontend/lib/query/journal-title.test.ts` and a small pure helper module if necessary: cover pseudo-title detection, request eligibility, and safe draft/cache replacement without adding a test dependency.

### Task 1: Lock the backend behavior with failing tests

**Files:**
- Modify: `tests/test_journal_service.py` or the closest existing journal-service test module
- Modify: `tests/test_user_isolation.py`

- [ ] Add a service test proving `create_journal` and `update_journal` return without calling the title model even when the stored name is `Untitled` or matches `^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$`.
- [ ] Add endpoint tests for `POST /api/journals/{id}/generate-title`: pseudo title becomes the generated title; real title is returned unchanged; empty content is unchanged; another user receives 404.
- [ ] Add a race test: arrange for the repository title to change from the original pseudo title to a manual title during generation and assert the manual title survives.
- [ ] Run the focused tests and verify RED because saves still call `_maybe_generate_ai_title` and the endpoint/conditional update do not exist:

```bash
PYTHONPATH=. uv run pytest tests/test_journal_service.py tests/test_user_isolation.py -q
```

Expected: new assertions fail for the missing behavior, while existing tests remain collectible.

### Task 2: Add an atomic user-edit-wins repository operation

**Files:**
- Modify: `lifetrace/repositories/interfaces.py`
- Modify: `lifetrace/repositories/sql_journal_repository.py`
- Modify: `lifetrace/storage/journal_manager.py`

- [ ] Add `update_title_if_unchanged(journal_id: int, expected_name: str, generated_name: str) -> bool` to `IJournalRepository` and its SQL implementation.
- [ ] In `JournalManager`, issue one user-scoped SQLAlchemy `UPDATE` whose predicates are `Journal.id == journal_id`, `Journal.user_id == self.user_id`, `Journal.deleted_at.is_(None)`, and `Journal.name == expected_name`; set the generated name and updated timestamp, then return whether exactly one row changed.
- [ ] Run the repository/race tests and verify GREEN:

```bash
PYTHONPATH=. uv run pytest tests/test_journal_service.py tests/test_user_isolation.py -q
```

- [ ] Commit this isolated contract using the repository Lore format, recording the atomic overwrite constraint and focused tests.

### Task 3: Separate title generation from journal persistence

**Files:**
- Modify: `lifetrace/services/journal_service.py`
- Modify: `lifetrace/routers/journal.py`
- Test: journal service/router tests selected in Task 1

- [ ] Change the title generator to return the latest journal and use `update_title_if_unchanged` with the exact title observed before the model call.
- [ ] Add `generate_ai_title(journal_id: int) -> JournalResponse`: load the user-owned journal, return 404 when absent, return unchanged for real titles or empty content, otherwise generate and finally return the latest row.
- [ ] Remove `_maybe_generate_ai_title` calls from `create_journal` and `update_journal`; keep `run_without_ai_title` compatibility only where still used by sync code, deleting obsolete serverless/thread branches if references reach zero.
- [ ] Add `POST /api/journals/{journal_id}/generate-title` with `response_model=JournalResponse`; use the existing authenticated `get_journal_service` dependency and established HTTP exception handling.
- [ ] Run focused tests and verify GREEN:

```bash
PYTHONPATH=. uv run pytest tests/test_journal_service.py tests/test_user_isolation.py tests/test_sync_service.py -q
```

- [ ] Commit the backend endpoint and save-path change using a Lore message that states title failure cannot fail journal persistence.

### Task 4: Lock frontend eligibility and safe replacement with failing tests

**Files:**
- Create: `lifetrace-frontend/lib/query/journal-title.ts`
- Create: `lifetrace-frontend/lib/query/journal-title.test.ts`

- [ ] Define pure test cases for `isPseudoJournalTitle`: empty, `Untitled`, and a valid minute timestamp are true; user titles and malformed timestamps are false.
- [ ] Define pure test cases for `shouldGenerateJournalTitle`: requires a persisted positive ID, non-empty content, and a pseudo title.
- [ ] Define pure test cases for safe active-draft replacement: update only when IDs match and the draft title is still pseudo; preserve a manual title and a different active note.
- [ ] Run the tests and verify RED because the helper module does not yet implement the contract:

```bash
cd lifetrace-frontend
node --test lib/query/journal-title.test.ts
```

Expected: FAIL for missing exports/behavior.

### Task 5: Implement precise background title delivery

**Files:**
- Modify: `lifetrace-frontend/lib/query/journals.ts`
- Modify: `lifetrace-frontend/apps/diary/DiaryPanel.tsx`
- Modify: `lifetrace-frontend/lib/query/journal-title.ts`
- Test: `lifetrace-frontend/lib/query/journal-title.test.ts`

- [ ] Implement the tested pure helpers with the exact pseudo-title rules used by the backend.
- [ ] Add a typed `POST /api/journals/${id}/generate-title` call using `customFetcher`; normalize its returned journal through `normalizeJournal`.
- [ ] Maintain a module- or hook-owned `Set<number>` of in-flight IDs. After create/update succeeds, start generation only when eligible; always remove the ID in `finally`, so later edits can retry after failure.
- [ ] On success call `replaceJournalInCaches` directly. Delete `scheduleTitleRefresh`, its 4-second timer, and both `queryClient.invalidateQueries({ queryKey: queryKeys.journals.all })` calls associated with title generation.
- [ ] Extend `useJournalMutations` with an `onTitleGenerated` callback. In `DiaryPanel`, use the safe replacement helper to update `draft.name` only for the currently open matching pseudo-title note; do not change正文、日期、选择状态或滚动状态.
- [ ] Run the pure tests and typecheck:

```bash
cd lifetrace-frontend
node --test lib/query/journal-title.test.ts
pnpm type-check
```

Expected: all title tests pass and TypeScript exits 0.

- [ ] Commit the frontend behavior with a Lore message documenting precise cache writes and the no-full-invalidation directive.

### Task 6: Regression verification and cloud acceptance

**Files:**
- Modify only files required by failures discovered in this task; do not broaden scope.

- [ ] Run backend journal, auth/isolation, sync, Vercel entrypoint, and vector-contract suites:

```bash
PYTHONPATH=. uv run pytest \
  tests/test_journal_service.py \
  tests/test_user_isolation.py \
  tests/test_sync_service.py \
  tests/test_vercel_app.py \
  tests/test_postgres_vector_db.py -q
```

- [ ] Run Python lint on changed backend files:

```bash
uv run ruff check lifetrace/services/journal_service.py lifetrace/routers/journal.py lifetrace/repositories/interfaces.py lifetrace/repositories/sql_journal_repository.py lifetrace/storage/journal_manager.py tests
```

- [ ] Run frontend tests, typecheck, lint, and production build:

```bash
cd lifetrace-frontend
node --test lib/query/journal-title.test.ts
pnpm type-check
pnpm exec biome check lib/query/journal-title.ts lib/query/journal-title.test.ts lib/query/journals.ts apps/diary/DiaryPanel.tsx
pnpm build:frontend:web
```

- [ ] Deploy backend first, then frontend. In the cloud, verify with browser Network/Performance tools: journal create/update returns before the generate-title request; exactly one title request is in flight per note; the completed title appears without document navigation or all-journal refetch; manually entered title wins; failed generation leaves saved正文 intact and a later edit retries.
- [ ] Record real-cloud timing for save response and title completion, plus any untested external-model/provider behavior, in the final handoff.

## Plan self-review

- Every design requirement maps to Tasks 1–6.
- No queue, temporary title, streaming partial title, new dependency, or unrelated UI refactor is included.
- Backend and frontend use the same pseudo-title definition.
- The database compare-and-set and frontend draft guard jointly enforce user-edit-wins.
- Removing global invalidation directly addresses the observed blank flash while preserving targeted cache consistency.

