# Release Debt Closure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the verified backend test, frontend type, migration-chain, and production-build blockers from the latest main branch.

**Architecture:** Preserve existing product behavior and repair only stale contracts and validation paths. Dispatch journal vector methods by their bound positional arity rather than parameter spelling, use Next.js's public `Route` type for logout navigation, and validate the existing Alembic/bootstrap path without enabling migrations inside Vercel requests.

**Tech Stack:** Python 3.12, pytest, SQLAlchemy/Alembic, TypeScript, Next.js 16, Biome, pnpm

---

### Task 1: Stabilize journal vector method dispatch

**Files:**
- Modify: `lifetrace/services/journal_service.py`
- Test: `tests/test_sync_service.py`

- [ ] **Step 1: Keep the existing failing regression as the red test**

Run:

```bash
uv run pytest tests/test_sync_service.py::test_journal_delete_reports_error_when_cloud_vector_delete_fails -q
```

Expected before the fix: failure because `_FailingCloudVectorDB.delete_journal()` receives one argument instead of the two-argument cloud contract.

- [ ] **Step 2: Add one private signature helper**

Add a helper in `JournalService` that examines a bound method's positional parameters and returns whether it accepts one more parameter than the desktop form. Use it for both `upsert_journal` and `delete_journal`; do not depend on parameters being literally named `user_id`.

- [ ] **Step 3: Verify cloud and desktop behavior**

Run:

```bash
uv run pytest tests/test_sync_service.py tests/test_postgres_vector_db.py -q
```

Expected: all tests pass, including cloud error propagation and desktop non-blocking behavior.

### Task 2: Restore frontend typed-route health

**Files:**
- Modify: `lifetrace-frontend/components/layout/ProfilePanel.tsx`

- [ ] **Step 1: Reproduce the type error**

Run:

```bash
cd lifetrace-frontend
./node_modules/.bin/tsc --noEmit
```

Expected before the fix: `ProfilePanel.tsx` rejects `router.push("/login")` as a `RouteImpl` argument.

- [ ] **Step 2: Type the logout destination with Next.js's public route type**

Import `Route` from `next` and pass `"/login" as Route` to `router.push`. Keep `clearSession()` before navigation and do not disable `typedRoutes`.

- [ ] **Step 3: Verify the component and application types**

Run:

```bash
./node_modules/.bin/biome check components/layout/ProfilePanel.tsx
./node_modules/.bin/tsc --noEmit
```

Expected: both commands pass.

### Task 3: Validate migrations and production builds

**Files:**
- Verify: `lifetrace/migrations/versions/*.py`
- Verify: `scripts/bootstrap_neon.py`
- Verify: frontend and backend test suites

- [ ] **Step 1: Verify the migration graph**

Run:

```bash
uv run alembic -c lifetrace/alembic.ini heads
uv run python -m py_compile scripts/bootstrap_neon.py
```

Expected: exactly one Alembic head and successful compilation.

- [ ] **Step 2: Run backend verification**

Run:

```bash
uv run pytest -q
uv run ruff check lifetrace/services/journal_service.py tests/test_sync_service.py
```

Expected: all tests and Ruff checks pass; existing deprecation warnings may remain.

- [ ] **Step 3: Run the frontend production gate**

Run:

```bash
cd lifetrace-frontend
./node_modules/.bin/biome check components/layout/ProfilePanel.tsx
./node_modules/.bin/tsc --noEmit
./node_modules/.bin/next build
```

Expected: formatting, type checking, and production build all exit successfully.

- [ ] **Step 4: Review and commit only scoped changes**

Run `git diff --check`, inspect the changed files, commit with the executed verification evidence, and push the resulting commit to GitHub. Keep production Neon migration as a separate user-run command using the existing local `DATABASE_URL`.
