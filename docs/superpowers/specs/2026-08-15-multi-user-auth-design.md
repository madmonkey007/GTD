# Multi-User Authentication Design

## Goal

Add registration and login to LifeTrace with true per-user data isolation across the
FastAPI backend, the Next.js frontend, and the existing offline-first sync layer.

## Scope

This design implements the full multi-user version, not just a shared-data login
gate. After the change, each authenticated user can only read, write, sync, and
delete their own LifeTrace data.

In scope:

- Email-and-password registration.
- Email-and-password login.
- Bearer token authentication for API requests.
- Route protection in the frontend.
- User ownership on core synchronized entities.
- User-scoped offline mirror and outbox state.
- User-aware sync push/pull and tombstone handling.
- Tests for authentication, isolation, and frontend request behavior.

Out of scope for this first version:

- OAuth providers.
- Password reset email.
- Email verification.
- Organization/team sharing.
- Admin dashboard.
- Migrating existing public production data into separate named accounts.

## Current State

The backend has no authentication layer. Routers use service dependencies directly,
and repositories query global tables. Core user data currently lives in shared
tables such as `todos`, `journals`, `habits`, `habit_records`, `projects`,
`sync_op_logs`, and `sync_tombstones`.

The frontend uses a shared `customFetcher` in
`lifetrace-frontend/lib/api/fetcher.ts`. It does not attach credentials today.
Offline support stores mirrored entities and queued writes in IndexedDB without a
user namespace, which is safe for a single-user local app but unsafe after login
exists.

## Recommended Approach

Build local authentication inside the existing FastAPI backend.

Use a `users` table and password hashes instead of delegating auth to Neon,
Supabase, or Cloudflare. This keeps the app portable and avoids coupling the data
model to a provider while the backend deployment is still being settled.

Tokens should be signed JWT access tokens with a required server-side
`JWT_SECRET_KEY`. The token payload should include the user's stable integer id and
email. A short initial expiry such as seven days is acceptable for the personal
product use case; refresh tokens can be added later if needed.

## Backend Design

Create an auth module:

- `lifetrace/schemas/auth.py`
- `lifetrace/services/auth_service.py`
- `lifetrace/routers/auth.py`
- auth dependency helpers in `lifetrace/core/dependencies.py`
- `auth` registration in `lifetrace/core/module_registry.py`

Create a `User` model with:

- `id`
- `email`
- `password_hash`
- `display_name`
- `created_at`
- `updated_at`
- `deleted_at`

Email is normalized to lowercase and must be unique.

Use Passlib/bcrypt if already available in the environment; otherwise use
standard-library PBKDF2-HMAC with per-password salt to avoid adding another
dependency. Password hashes must never be reversible or logged.

Add endpoints:

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`

Register and login return:

```json
{
  "access_token": "...",
  "token_type": "bearer",
  "user": {
    "id": 1,
    "email": "user@example.com",
    "display_name": "User"
  }
}
```

Protected business routes should depend on `get_current_user`. The dependency
parses `Authorization: Bearer <token>`, validates the token signature and expiry,
loads the user, and returns HTTP 401 when invalid.

## Data Isolation Design

Add a required `user_id` column to the core user-owned tables:

- `todos`
- `journals`
- `habits`
- `habit_records`
- `projects`
- `sync_op_logs`
- `sync_tombstones`

Add indexes for common access patterns:

- `(user_id, id)`
- `(user_id, uid)` on syncable entities.
- `(user_id, client_id, op_id)` on sync operation logs.
- `(user_id, entity_type, uid)` on tombstones.

Repository and service methods must filter by `user_id` for all list, get, update,
delete, upsert, and sync operations. If a record with the requested id exists but
belongs to another user, the API should behave as not found.

For existing local or production data, the migration should create a bootstrap
user and assign existing rows to that user. This preserves current data while
making future user isolation explicit.

## Sync Design

The sync API must require authentication. `SyncService` should receive the current
user id and apply it to:

- incoming client writes
- idempotency checks in `sync_op_logs`
- tombstone creation and lookup
- pull queries

`uid` values are only unique inside a user account. The same client-generated uid
may exist for two different users without conflict.

Conflict handling remains unchanged within one user's data. Cross-user conflicts
should be impossible because queries are user-scoped.

## Frontend Design

Add an auth surface:

- `/login`
- `/register`
- shared auth API helpers
- auth store/provider for token and current user

The login and register pages should follow the existing quiet app UI, not a
marketing layout. The form should be compact, readable, and mobile-friendly.

Store the access token in local storage for the first version. This is acceptable
for the current PWA deployment shape and simpler than cookie-based auth across
Vercel rewrites. The fetcher adds:

```http
Authorization: Bearer <access_token>
```

On HTTP 401, the client clears auth state and redirects to `/login`.

The app shell should protect the main LifeTrace experience. If no token exists,
users land on `/login`; after login or registration, they return to `/`.

## Offline Design

IndexedDB data must be scoped by the authenticated user. The safest first version
is to derive a per-user local namespace from the authenticated user's id and apply
it to mirror reads/writes and outbox keys.

Expected behavior:

- User A cannot see User B's cached data on the same browser.
- Logging out keeps local data but hides it from other users because reads are
  user-scoped.
- Registering or logging in as another user starts with an empty mirror until that
  user's first hydrate/pull completes.
- Outbox writes are tied to the user that created them and sync only with that
  user's token.

If a user logs out while offline and then logs in as another user, queued writes
from the previous user remain stored but inactive until that previous user logs
back in.

## Error Handling

Authentication errors:

- Duplicate email returns 409.
- Invalid email/password returns 401 with a generic message.
- Missing or expired token returns 401.

Authorization errors:

- Cross-user access returns 404 for resource routes.
- Sync operations never disclose whether another user's uid exists.

Offline behavior:

- Network failures should still fall back to that user's IndexedDB mirror.
- Authentication failures should not be treated as offline failures.

## Environment Variables

Backend:

```bash
JWT_SECRET_KEY=<long-random-secret>
ACCESS_TOKEN_EXPIRE_MINUTES=10080
DATABASE_URL=<postgres-url>
CORS_ORIGINS=https://lifetrace-flame.vercel.app,http://localhost:3001
```

Frontend:

```bash
NEXT_PUBLIC_API_URL=<public-backend-url>
```

## Testing Plan

Backend tests:

- Register creates a user and returns a token.
- Duplicate email is rejected.
- Login accepts the correct password and rejects the wrong password.
- `/api/auth/me` requires a valid token.
- Todo, journal, habit, project, and sync routes do not return another user's data.
- Sync push/pull idempotency is user-scoped.

Frontend tests/checks:

- Auth helper stores and clears token.
- Fetcher attaches Authorization.
- 401 clears auth state.
- Login/register form validates required fields.
- Main app redirects to login when unauthenticated.
- TypeScript, Biome, and Next build pass.

Manual verification:

- Create account A, create data, log out.
- Create account B, verify A's data is invisible.
- Log back into A and verify A's data returns.
- Create an item offline as A, reconnect, and verify sync affects only A.

## Rollout Plan

1. Add backend auth primitives and tests.
2. Add `user_id` migration and repository/service scoping.
3. Make sync user-scoped.
4. Add frontend auth pages and token-aware fetcher.
5. Namespace offline IndexedDB reads and writes by user.
6. Run backend and frontend verification.
7. Deploy backend with `JWT_SECRET_KEY`.
8. Redeploy frontend with the real backend URL.

## Risks

The broadest risk is missing one repository query and accidentally exposing shared
data. Tests should focus on cross-user isolation, not just happy-path login.

The second risk is offline migration. Existing local IndexedDB data has no user
namespace. The implementation should either migrate current local data into the
first logged-in account or start a new user-scoped cache. For safety and
predictability, this design recommends starting a new user-scoped cache and
leaving old anonymous cache data unused.

The third risk is existing production data. Assigning all pre-auth database rows
to a bootstrap user preserves data, but the operator must know which account owns
that historical data after deployment.
