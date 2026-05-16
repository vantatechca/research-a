## Project scope (read this first)

This repo is **peptide-brain** (internal name; deployed as `research-a` on Render). It's an AI-powered idea-discovery pipeline for the peptide e-commerce niche, producing digital-product ideas (ebooks, calculators, courses, templates) targeted at peptide store customers.

**This is NOT nicheiq.** nicheiq is a separate, niche-agnostic market intelligence platform — own repo, own stack, own concepts. Do not borrow vocabulary, schemas, or architecture from nicheiq. Forbidden imports from that codebase:

- `opportunities` / `DigitalOpportunity` (peptide-brain calls them `ideas`)
- `sites` / `Site` / `Product` / `ProductPerformance`
- `niches` / `niche-discovery` / `niche-agnostic`
- `trend sources` / `trend pipeline`
- `scoring engine` (peptide-brain uses `priority_score` from `workers/tasks/idea_pipeline.py`)
- `rotation cycles` / `monthly rotation`

If you find yourself reaching for those concepts here, stop and verify which project you're in. The peptide-brain `Idea` model lives in `prisma/schema.prisma`. The pipeline is `workers/tasks/idea_pipeline.py`. The AI client is `workers/utils/ai_client.py` and uses Anthropic Claude Haiku 4.5 (not OpenRouter).

**Stack:**
- Frontend: Next.js 16 + Prisma 7 + Postgres (Neon)
- Workers: Python 3.12 + Celery + Redis (Render Valkey)
- AI: Anthropic Claude Haiku 4.5 via `workers/utils/ai_client.py`
- Encrypted API keys in `api_keys` table (AES-256-GCM, env var `MASTER_ENCRYPTION_KEY`)
- Deployment: Render — `peptidebrain-api`, `peptidebrain-worker`, `peptidebrain-redis` (beat embedded in worker via `-B`)

<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->
