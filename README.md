# peptide-brain (research-a)

AI-powered idea-discovery pipeline for the peptide e-commerce niche. Surfaces
digital-product ideas (ebooks, calculators, courses, templates, etc.) targeted
at peptide store customers, scored against operator preferences stored in a
"brain memory" table.

**Read [`AGENTS.md`](./AGENTS.md) before making changes** — it documents the
project scope, the hard line between peptide-brain and nicheiq, and which
concepts must NOT cross over.

## Stack

| Layer        | Tech |
|--------------|------|
| Frontend     | Next.js 16, React 19, Tailwind v4, shadcn/ui |
| Database     | Postgres (Neon) + pgvector for semantic dedup |
| ORM          | Prisma 7 with `adapter-pg` |
| Workers      | Python 3.12, Celery 5.4 + Redis (Render Valkey) |
| AI — chat    | Anthropic Claude Sonnet 4.6 (default; override via `BRAIN_MODEL`) |
| AI — bulk    | Anthropic Claude Haiku 4.5 (override via `CLAUDE_MODEL`) |
| Embeddings   | OpenAI `text-embedding-3-small` (1536-dim, via OpenAI-compatible endpoint) |
| Deployment   | Render — `peptidebrain-api`, `peptidebrain-worker`, `peptidebrain-redis` |

## Local development

```bash
# 1. Set up env
cp .env.example .env.local
#    Fill in DATABASE_URL, DIRECT_URL, MASTER_ENCRYPTION_KEY,
#    AUTH_SESSION_SECRET, AUTH_PASSWORD, WORKER_API_TOKEN, ANTHROPIC_API_KEY.
#    Generate the secret values with:
#      node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# 2. Bring up DB + Redis + workers
docker compose up -d

# 3. Generate Prisma client and push schema
npm install
npm run db:generate
npm run db:push

# 4. (Optional) seed with example ideas
npm run seed

# 5. Run the Next.js dev server
npm run dev
```

The app listens on http://localhost:3000 — log in with `AUTH_PASSWORD`.

## Project layout

```
prisma/         schema.prisma — Idea, BrainMemory, Conversation, Message, etc.
src/app/        Next.js routes (UI + /api/*)
src/lib/        shared libs — db, ai, embeddings, api-keys, auth
src/components/ React components (shadcn UI + app-specific)
workers/        Python — Celery tasks, FastAPI trigger endpoint, pgvector dedup
scripts/        seed + one-off migration helpers
```

## Where to look first when something breaks

- **AI pipeline produces nothing** → `workers/utils/ai_client.py` (Anthropic
  key resolution), and `workers/tasks/idea_pipeline.py` (relevance →
  extraction → embedding → dedup → insert).
- **Brain chat fails or hangs** → `src/app/api/brain/chat/route.ts`.
- **API key UI shows "missing"** → `MASTER_ENCRYPTION_KEY` is wrong or
  unset; old encrypted rows become undecryptable.
- **`prisma generate` / `prisma db push` fail on a fresh clone** →
  `DIRECT_URL` is unset; see `.env.example`.