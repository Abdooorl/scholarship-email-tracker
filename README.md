# Scholarship Email Tracker

Cloudflare Worker + Vite dashboard that tracks scholarship decisions
(acceptances / rejections) arriving in **badamosiabdullahi@gmail.com**.

- A **GitHub Action** runs every 15 minutes, pulls new Gmail messages via the
  Gmail API, classifies them, and pushes results to a Cloudflare Worker.
- The **Worker** stores emails in Cloudflare D1 and serves the built frontend.
- Classification is **scholarship-gated**: job-application emails are never
  marked accepted/rejected — they are skipped entirely.

```
GitHub Action (cron) ──Gmail API──> fetch + classify ──POST /api/ingest──> Worker (Hono)
                                                                              │ D1 (emails)
Dashboard <──── static assets + /api/* ───────────────────────────────────────┘
```

## Repo layout

| Path | Purpose |
| --- | --- |
| `worker/` | Hono API (`/api/*`), D1 schema/migrations, wrangler config |
| `frontend/` | Vite + React + Tailwind dashboard |
| `action/sync.mjs` | Scheduled sync job (runs in GitHub Actions) |
| `action/classify.mjs` | Scholarship-gated classifier (tune word lists here) |
| `action/classify.test.mjs` | Classifier test cases (`npm run test:classify`) |
| `scripts/gmail-auth.mjs` | One-time OAuth consent flow → refresh token |

## One-time setup

### 1. Google Cloud (manual)

1. Go to [console.cloud.google.com](https://console.cloud.google.com) → create or select a project.
2. **APIs & Services → Library** → enable **Gmail API**.
3. **APIs & Services → OAuth consent screen** → type **External** → fill in app name → add yourself (`badamosiabdullahi@gmail.com`) as a **test user**.
4. **APIs & Services → Credentials → Create credentials → OAuth client ID**:
   - Application type: **Web application**
   - Authorized redirect URI: `http://localhost:53682`

> Gmail cannot be read with a plain API key — OAuth2 (below) is required.

### 2. Get the Gmail refresh token

```bash
npm install
npm run auth:gmail
```

Sign in as badamosiabdullahi@gmail.com and consent. The script prints all
values you need for the next steps.

### 3. Deploy the Worker

```bash
npx wrangler login
cd worker
npx wrangler d1 create scholar-tracker      # copy database_id into wrangler.jsonc
npx wrangler d1 migrations apply scholar-tracker --remote
npx wrangler secret put INGEST_SECRET       # paste the INGEST_SECRET from step 2
npm run build -w frontend                   # from repo root: builds frontend/dist
npx wrangler deploy
```

Note your worker URL: `https://scholarship-email-tracker.<your-subdomain>.workers.dev`.

### 4. Add GitHub repo secrets

Repo → Settings → Secrets and variables → Actions → New repository secret:

| Secret | Value |
| --- | --- |
| `GMAIL_CLIENT_ID` | From auth script |
| `GMAIL_CLIENT_SECRET` | From auth script |
| `GMAIL_REFRESH_TOKEN` | From auth script |
| `WORKER_URL` | Your deployed worker URL |
| `INGEST_SECRET` | Same value as the Worker secret |

Push this project to GitHub (Actions requires a remote repo). Then run the
workflow once manually (**Actions → Sync scholarship emails → Run workflow**)
and check the logs.

## Local development

```bash
# terminal 1 — API on :8787 (uses local D1)
cp worker/.dev.vars.example worker/.dev.vars
npm run db:migrate:local -w worker
npm run dev:worker

# terminal 2 — Vite dev server with /api proxied to :8787
npm run dev:web
```

Run a manual sync against your local stack:

```bash
WORKER_URL=http://127.0.0.1:8787 \
INGEST_SECRET=dev-ingest-secret \
GMAIL_CLIENT_ID=... GMAIL_CLIENT_SECRET=... GMAIL_REFRESH_TOKEN=... \
npm run sync:test
```

## Customizing classification

Edit the keyword arrays at the top of `action/classify.mjs`:

- `SCHOLARSHIP_TERMS` / `ACADEMIC_TERMS` — what counts as scholarship-related
- `JOB_TERMS` — vetoes classification when job signals outweigh academic ones
- `ACCEPT_PATTERNS` / `REJECT_PATTERNS` — decision wording

Verify changes with `npm run test:classify`.

## API reference

| Endpoint | Description |
| --- | --- |
| `GET /api/stats` | Aggregate counts (total, accepted, rejected, scholarships) |
| `GET /api/emails?status=&topic=&q=&limit=&offset=` | List tracked emails |
| `GET /api/emails/:id` | Full email incl. body |
| `POST /api/ingest` | Upsert batch — requires `Authorization: Bearer $INGEST_SECRET` |

## Costs

Everything runs on free tiers: GitHub Actions public-repo minutes are free,
Workers free tier allows 100k requests/day, D1 free tier covers this easily,
and the Gmail API quota (1 billion units/day) is far beyond this workload.
