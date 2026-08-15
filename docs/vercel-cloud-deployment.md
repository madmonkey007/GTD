# LifeTrace Vercel Cloud Deployment

Deploy LifeTrace as two Vercel projects.

| Project | Root directory | Purpose |
| --- | --- | --- |
| Backend API | repository root | FastAPI serverless endpoints from `api/index.py` |
| Frontend PWA | `lifetrace-frontend` | Next.js web app |

## Backend Project

- Root directory: repository root.
- Install command: `pip install -r requirements-vercel.txt`.
- Build command: leave empty or use the Vercel default.
- Runtime entry: `api/index.py`.

Required environment variables:

- `DATABASE_URL`: Neon PostgreSQL connection string.
- `JWT_SECRET_KEY`: a long random secret for login tokens.
- `CORS_ORIGINS`: the frontend Vercel URL, for example `https://your-frontend.vercel.app`.
- `OPENAI_API_KEY` or compatible LLM provider keys used by the existing config.
- `DASHSCOPE_API_KEY`: DashScope key for completed-recording transcription.
- `SUPABASE_URL`: Supabase project URL.
- `SUPABASE_SERVICE_ROLE_KEY`: Supabase service role key. Keep this backend-only.

After setting `DATABASE_URL`, run this once against the Neon database:

```bash
uv run python scripts/bootstrap_neon.py
```

The bootstrap creates SQLModel tables, enables `pgvector`, and creates the `journal_vectors` table used by cloud RAG.

## Supabase Storage

Create a private bucket named `audio-staging`.

The browser uploads completed recordings directly to Supabase through a short-lived signed URL. Vercel only creates signed URLs and starts/polls the DashScope transcription task. The frontend must never receive `SUPABASE_SERVICE_ROLE_KEY` or `DASHSCOPE_API_KEY`.

## Frontend Project

- Root directory: `lifetrace-frontend`.
- Build command: `pnpm run build:frontend:web`.
- Environment variable: `NEXT_PUBLIC_API_URL=https://<your-backend-project>.vercel.app`.

Offline-first data still lives in browser IndexedDB and syncs when the network is available. Cloud-only features such as LLM calls, pgvector search, and completed-recording transcription require network access.
