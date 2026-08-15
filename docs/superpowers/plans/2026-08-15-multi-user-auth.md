# Multi-User Authentication Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add registration and login with true per-user isolation for backend data, sync, and offline frontend storage.

**Architecture:** Authentication is implemented inside the existing FastAPI backend with a `users` table, password hashes, and signed bearer tokens. Business services and repositories become user-scoped, and the offline IndexedDB layer stores mirrors/outbox rows under a user namespace so accounts cannot see each other's local or server data.

**Tech Stack:** FastAPI, SQLModel/SQLAlchemy, Alembic-style migrations, pytest, Next.js App Router, React, TanStack Query, Zustand/localStorage, IndexedDB via `idb`, TypeScript, Biome.

---

## File Structure

Backend files:

- Create `lifetrace/schemas/auth.py`: request/response schemas for register, login, current user, and token response.
- Create `lifetrace/services/auth_service.py`: password hashing, token signing/verification, user creation, login verification.
- Create `lifetrace/routers/auth.py`: `/api/auth/register`, `/api/auth/login`, `/api/auth/me`.
- Modify `lifetrace/storage/models.py`: add `User` and `user_id` columns on synchronized/user-owned models.
- Create `lifetrace/migrations/versions/add_auth_users_002.py`: create users table, add user ownership columns/indexes, assign existing rows to a bootstrap user.
- Modify `lifetrace/core/dependencies.py`: add auth dependencies and user-scoped service/repository factories.
- Modify `lifetrace/core/module_registry.py`: add core `auth` module.
- Modify `lifetrace/routers/todo.py`, `lifetrace/routers/journal.py`, `lifetrace/routers/habit.py`, `lifetrace/routers/project.py`, `lifetrace/routers/sync.py`: require current user and pass user scope to services.
- Modify repository/service files for todos, journals, habits, projects, and sync so all reads/writes filter by `user_id`.
- Add tests in `tests/test_auth_service.py`, `tests/test_auth_router.py`, `tests/test_user_isolation.py`, and extend `tests/test_sync_router.py`.

Frontend files:

- Create `lifetrace-frontend/lib/auth/store.ts`: token/current-user persistence and logout helpers.
- Create `lifetrace-frontend/lib/auth/api.ts`: register, login, `me` API helpers.
- Create `lifetrace-frontend/components/auth/AuthForm.tsx`: shared login/register form.
- Create `lifetrace-frontend/app/login/page.tsx` and `lifetrace-frontend/app/register/page.tsx`.
- Create `lifetrace-frontend/components/common/ui/AuthGate.tsx`: protect the app shell.
- Modify `lifetrace-frontend/lib/api/fetcher.ts`: attach bearer token and clear auth on 401.
- Modify `lifetrace-frontend/lib/offline/db.ts`, `engine.ts`, `mirror.ts`, `outbox.ts`, `hydrate.ts`, and `writes.ts`: add user namespace to mirror/outbox/meta keys.
- Modify `lifetrace-frontend/components/common/ui/SyncController.tsx`: sync only when authenticated.
- Add frontend source tests such as `lifetrace-frontend/lib/auth/store.test.mjs` and `lifetrace-frontend/lib/api/fetcher.auth.test.mjs` following the existing `.mjs` regression-test pattern.

## Task 1: Backend Auth Primitives

**Files:**

- Create: `lifetrace/schemas/auth.py`
- Create: `lifetrace/services/auth_service.py`
- Create: `tests/test_auth_service.py`
- Modify: `lifetrace/storage/models.py`

- [ ] **Step 1: Write failing auth service tests**

Create tests that verify email normalization, password hash verification, bad-password rejection, token creation, token verification, and expired/invalid token rejection.

Run: `uv run pytest tests/test_auth_service.py -q`

Expected: FAIL because the auth files do not exist yet.

- [ ] **Step 2: Add `User` model and auth schemas**

Add `User` to `lifetrace/storage/models.py` with `email`, `password_hash`, `display_name`, timestamps, and soft delete fields. Add schemas for register/login/token/current-user responses.

- [ ] **Step 3: Implement password and token service**

Use standard-library PBKDF2-HMAC with a random salt if no existing password library is present. Read `JWT_SECRET_KEY` from the environment for token signing; tests may inject a deterministic secret. Never log passwords or hashes.

- [ ] **Step 4: Verify auth service tests**

Run: `uv run pytest tests/test_auth_service.py -q`

Expected: PASS.

- [ ] **Step 5: Commit**

Use a Lore-style commit message describing why local auth primitives are introduced before route protection.

## Task 2: Auth Router and Dependencies

**Files:**

- Create: `lifetrace/routers/auth.py`
- Modify: `lifetrace/core/dependencies.py`
- Modify: `lifetrace/core/module_registry.py`
- Create: `tests/test_auth_router.py`

- [ ] **Step 1: Write failing router tests**

Test register success, duplicate email 409, login success, wrong password 401, `/api/auth/me` without token 401, and `/api/auth/me` with token success.

Run: `uv run pytest tests/test_auth_router.py -q`

Expected: FAIL because the router is not registered.

- [ ] **Step 2: Add `get_current_user` dependency**

Parse `Authorization: Bearer <token>`, validate the token, load the user, and return HTTP 401 on missing, malformed, expired, or unknown-user tokens.

- [ ] **Step 3: Add auth router**

Register `/api/auth/register`, `/api/auth/login`, and `/api/auth/me`; add `auth` as a core module so it loads during priority startup.

- [ ] **Step 4: Verify auth router**

Run: `uv run pytest tests/test_auth_router.py -q`

Expected: PASS.

- [ ] **Step 5: Commit**

Use a Lore-style commit message recording the bearer-token API contract.

## Task 3: User Ownership Migration

**Files:**

- Modify: `lifetrace/storage/models.py`
- Create: `lifetrace/migrations/versions/add_auth_users_002.py`
- Create: `tests/test_auth_models_and_migration.py`

- [ ] **Step 1: Write failing model/migration tests**

Assert `User` exists and user-owned tables include `user_id`. Assert uniqueness/index expectations for `(user_id, uid)`, `(user_id, client_id, op_id)`, and `(user_id, entity_type, uid)` where applicable.

Run: `uv run pytest tests/test_auth_models_and_migration.py -q`

Expected: FAIL until columns and constraints exist.

- [ ] **Step 2: Add `user_id` to synchronized models**

Add `user_id` to todos, journals, habits, habit records, projects, sync op logs, and tombstones. Keep columns non-nullable in the model, with migration defaults for existing rows.

- [ ] **Step 3: Add migration**

Create a bootstrap user such as `bootstrap@lifetrace.local`, add columns with a temporary default, populate existing rows, create indexes, then tighten nullability where the database supports it. Include downgrade best-effort column/index removal.

- [ ] **Step 4: Verify migration/model tests**

Run: `uv run pytest tests/test_auth_models_and_migration.py -q`

Expected: PASS.

- [ ] **Step 5: Commit**

Use a Lore-style commit message noting that existing anonymous rows are assigned to a bootstrap account.

## Task 4: User-Scoped Backend Services and Routers

**Files:**

- Modify: `lifetrace/repositories/sql_todo_repository.py`
- Modify: `lifetrace/repositories/sql_journal_repository.py`
- Modify: `lifetrace/repositories/sql_habit_repository.py`
- Modify: `lifetrace/repositories/sql_project_repository.py`
- Modify: related manager/service files used by those repositories.
- Modify: `lifetrace/services/todo_service.py`
- Modify: `lifetrace/services/journal_service.py`
- Modify: `lifetrace/services/habit_service.py`
- Modify: `lifetrace/services/project_service.py`
- Modify: routers for todo, journal, habit, and project.
- Create: `tests/test_user_isolation.py`

- [ ] **Step 1: Write failing cross-user isolation tests**

Create two users, create todos/journals/habits/projects under user A, then assert user B receives empty lists or 404 for direct ids. Include updates/deletes to prove user B cannot modify user A data.

Run: `uv run pytest tests/test_user_isolation.py -q`

Expected: FAIL because routes are still global.

- [ ] **Step 2: Add user scope to repositories**

Instantiate repositories with `user_id` and make all list/get/create/update/delete operations include that scope. For related entities such as tags, attachments, and project relations, ensure the parent object belongs to the current user before reading or mutating child rows.

- [ ] **Step 3: Add user scope to services**

Pass the current user's id through service constructors or method arguments. Ensure todo-to-journal mirror sync creates and finds mirrored journals only inside the same user scope.

- [ ] **Step 4: Protect routers**

Add `current_user = Depends(get_current_user)` to user-owned routers and construct user-scoped services through dependencies.

- [ ] **Step 5: Verify isolation**

Run: `uv run pytest tests/test_user_isolation.py -q`

Expected: PASS.

- [ ] **Step 6: Run existing backend tests**

Run: `uv run pytest tests/test_todo_serialization.py tests/test_todo_service_mapping.py tests/test_sync_schema.py -q`

Expected: PASS or reveal compatibility changes to fix before continuing.

- [ ] **Step 7: Commit**

Use a Lore-style commit message calling out that cross-user 404 behavior is intentional.

## Task 5: User-Scoped Sync

**Files:**

- Modify: `lifetrace/services/sync_service.py`
- Modify: `lifetrace/routers/sync.py`
- Modify: `tests/test_sync_service.py`
- Modify: `tests/test_sync_router.py`

- [ ] **Step 1: Write failing sync isolation tests**

Assert sync push requires auth. Assert user A and user B can push the same entity `uid` without conflict. Assert pull only returns the authenticated user's entities, tombstones, and idempotency results.

Run: `uv run pytest tests/test_sync_service.py tests/test_sync_router.py -q`

Expected: FAIL until sync accepts user scope.

- [ ] **Step 2: Thread `user_id` through `SyncService`**

Construct sync service with `user_id` or pass it into `push`/`pull`. Filter `_find`, duplicate checks, tombstone writes, pull queries, and habit record operations by user.

- [ ] **Step 3: Protect sync router**

Require `get_current_user` on `/api/sync/push` and `/api/sync/pull`.

- [ ] **Step 4: Verify sync tests**

Run: `uv run pytest tests/test_sync_service.py tests/test_sync_router.py -q`

Expected: PASS.

- [ ] **Step 5: Commit**

Use a Lore-style commit message describing user-scoped idempotency and tombstones.

## Task 6: Frontend Auth Store, API, and Pages

**Files:**

- Create: `lifetrace-frontend/lib/auth/store.ts`
- Create: `lifetrace-frontend/lib/auth/api.ts`
- Create: `lifetrace-frontend/components/auth/AuthForm.tsx`
- Create: `lifetrace-frontend/app/login/page.tsx`
- Create: `lifetrace-frontend/app/register/page.tsx`
- Create: `lifetrace-frontend/lib/auth/store.test.mjs`

- [ ] **Step 1: Write failing auth store regression test**

Test token persistence, current-user persistence, logout clearing, and SSR-safe no-window behavior.

Run: `node lifetrace-frontend/lib/auth/store.test.mjs`

Expected: FAIL because the store does not exist.

- [ ] **Step 2: Implement auth store and API helpers**

Persist token and user in localStorage using stable keys. Provide `setAuthSession`, `clearAuthSession`, `getAuthToken`, `getCurrentAuthUser`, and helpers for register/login/me.

- [ ] **Step 3: Implement login/register UI**

Use a shared compact form with email, password, optional display name on register, loading state, inline error text, and links between login and register. Redirect to `/` on success.

- [ ] **Step 4: Verify auth store test**

Run: `node lifetrace-frontend/lib/auth/store.test.mjs`

Expected: PASS.

- [ ] **Step 5: Commit**

Use a Lore-style commit message noting token localStorage is selected for current PWA/Vercel rewrite constraints.

## Task 7: Fetcher Authorization and App Protection

**Files:**

- Modify: `lifetrace-frontend/lib/api/fetcher.ts`
- Create: `lifetrace-frontend/components/common/ui/AuthGate.tsx`
- Modify: `lifetrace-frontend/app/layout.tsx`
- Modify: `lifetrace-frontend/components/common/ui/SyncController.tsx`
- Create: `lifetrace-frontend/lib/api/fetcher.auth.test.mjs`

- [ ] **Step 1: Write failing fetcher auth test**

Test that requests attach `Authorization: Bearer <token>`, auth endpoints do not require a token, and HTTP 401 clears auth state.

Run: `node lifetrace-frontend/lib/api/fetcher.auth.test.mjs`

Expected: FAIL until fetcher reads auth state.

- [ ] **Step 2: Attach bearer token in fetcher**

Read the token only on the client, preserve caller-provided headers, and do not treat 401 as an offline error. Clear auth on 401.

- [ ] **Step 3: Add `AuthGate`**

Allow `/login` and `/register` unauthenticated. Protect the main app and render a quiet loading state while hydrating auth from localStorage.

- [ ] **Step 4: Pause sync when unauthenticated**

Do not run `syncNow` until a token and current user are available.

- [ ] **Step 5: Verify frontend auth tests**

Run: `node lifetrace-frontend/lib/api/fetcher.auth.test.mjs`

Expected: PASS.

- [ ] **Step 6: Commit**

Use a Lore-style commit message describing the 401 behavior.

## Task 8: User-Scoped Offline Storage

**Files:**

- Modify: `lifetrace-frontend/lib/offline/db.ts`
- Modify: `lifetrace-frontend/lib/offline/engine.ts`
- Modify: `lifetrace-frontend/lib/offline/mirror.ts`
- Modify: `lifetrace-frontend/lib/offline/outbox.ts`
- Modify: `lifetrace-frontend/lib/offline/hydrate.ts`
- Modify: `lifetrace-frontend/lib/offline/writes.ts`
- Create: `lifetrace-frontend/lib/offline/user-scope.test.mjs`

- [ ] **Step 1: Write failing offline namespace test**

Test that mirror rows, outbox ops, client id, and sync cursor are isolated between `user:1` and `user:2`.

Run: `node lifetrace-frontend/lib/offline/user-scope.test.mjs`

Expected: FAIL because current IndexedDB keys are global.

- [ ] **Step 2: Add user namespace helper**

Derive a namespace from authenticated user id. Make DB helpers require the active user namespace for mirror/outbox/meta operations that contain personal data.

- [ ] **Step 3: Update offline reads/writes**

Ensure queries fallback to only the active user's mirror. Ensure queued writes include the active user namespace and cannot flush under another account.

- [ ] **Step 4: Update sync cursor/client id**

Store `sync.cursor` and `sync.clientId` per user, not globally.

- [ ] **Step 5: Verify offline namespace test**

Run: `node lifetrace-frontend/lib/offline/user-scope.test.mjs`

Expected: PASS.

- [ ] **Step 6: Commit**

Use a Lore-style commit message documenting that old anonymous IndexedDB data is left unused.

## Task 9: Full Verification and Deployment Notes

**Files:**

- Modify: `handover.md`
- Optionally modify deployment docs if a deployment doc already exists.

- [ ] **Step 1: Run backend verification**

Run:

```bash
uv run pytest tests/test_auth_service.py tests/test_auth_router.py tests/test_auth_models_and_migration.py tests/test_user_isolation.py tests/test_sync_service.py tests/test_sync_router.py -q
uv run ruff check lifetrace tests/test_auth_service.py tests/test_auth_router.py tests/test_user_isolation.py
uv run pyright lifetrace tests/test_auth_service.py tests/test_auth_router.py tests/test_user_isolation.py
```

Expected: all pass.

- [ ] **Step 2: Run frontend verification**

Run:

```bash
cd lifetrace-frontend
node lib/auth/store.test.mjs
node lib/api/fetcher.auth.test.mjs
node lib/offline/user-scope.test.mjs
pnpm type-check
pnpm check
pnpm build
```

Expected: all pass.

- [ ] **Step 3: Manual local verification**

Start backend and frontend. Register account A, create todo/journal/habit/project data, log out, register account B, verify A data is invisible, log back into A, verify data returns, then test one offline write and sync.

- [ ] **Step 4: Update handover**

Document required deployment env vars:

```bash
JWT_SECRET_KEY=<long random secret>
ACCESS_TOKEN_EXPIRE_MINUTES=10080
DATABASE_URL=<postgres url>
CORS_ORIGINS=https://lifetrace-flame.vercel.app,http://localhost:3001
NEXT_PUBLIC_API_URL=<public backend url>
```

- [ ] **Step 5: Final commit**

Use a Lore-style commit message summarizing the end-to-end auth rollout and verification evidence.

## Self-Review

- Spec coverage: registration, login, token auth, route protection, user-owned backend data, user-scoped sync, user-scoped offline storage, tests, and deployment variables are covered.
- Placeholder scan: no unfinished placeholder markers or copy-forward steps are intentionally left in the plan.
- Type consistency: this plan consistently uses `user_id` on the backend, bearer access tokens for API requests, and an authenticated user namespace for IndexedDB.

## Execution Options

Recommended execution is inline in this session unless the user explicitly asks for subagents. The work touches shared backend and frontend boundaries, so small sequential commits reduce merge risk.
