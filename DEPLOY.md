# Deployment

Two services: **Vercel** (SPA + serverless functions for the API) and **Neon** (Postgres). Vercel deploys from a git push; Neon is provisioned once via the dashboard or CLI.

**Cost reality:** Vercel's Hobby plan is non-commercial use only — for an internal company tool, the Pro plan ($20/mo per developer with deploy access) is technically required. Neon free tier covers low-traffic internal tools (256MB storage, autoscale, branching). All in: **~$20/mo flat.**

---

## First-time setup

### 1. Create the Neon database

```bash
# Web flow (easier): https://neon.tech → new project → copy "Pooled connection" string
# CLI flow:
npx neonctl auth
npx neonctl projects create --name pm
npx neonctl connection-string --project-id <id> --pooled
```

You want the **pooled** connection string — Vercel functions are serverless, and Neon's pooler holds connections across cold starts. Save it; we'll set it as `DATABASE_URL` on Vercel.

### 2. Apply migrations

`node-pg-migrate` runs from your local CLI against the production DB. There's no "container start" hook in serverless — you run migrations manually before each deploy that needs them.

```bash
npm install
DATABASE_URL="<pooled connection string>" npm run migrate:up
```

### 3. Deploy to Vercel

```bash
npm install -g vercel             # or: npx vercel
vercel login                       # opens browser
vercel link                        # links the cwd to a Vercel project
vercel env add DATABASE_URL        # paste pooled connection string, all envs
vercel env add JWT_SECRET          # paste output of: openssl rand -hex 32
vercel --prod                      # ships
```

That's it. Vercel discovers `api/*.js` files automatically and turns each into a serverless function. The SPA is built per `vercel.json`'s `buildCommand`.

### 4. Smoke-test prod

```bash
API_URL=https://<your-app>.vercel.app npm run test:e2e
# expect: 20/20 passed
```

---

## Local development

Run the whole stack locally with Vercel CLI — same routing as prod:

```bash
vercel dev                         # starts on :3000
# In another shell:
API_URL=http://localhost:3000 npm run test:e2e
```

`vercel dev` reads env from `.env.local` (or pulls from Vercel via `vercel env pull`). At minimum:

```
DATABASE_URL=postgres://...   # your Neon dev branch
JWT_SECRET=dev-secret
```

Tip: create a Neon **branch** for dev so you don't pollute prod data:

```bash
npx neonctl branches create --project-id <id> --name dev
npx neonctl connection-string --project-id <id> --branch dev --pooled
```

---

## CI/CD

Vercel's git integration auto-deploys on push:

- Push to `main` → production deploy
- Open PR → preview deploy at `https://pm-git-<branch>-<team>.vercel.app`

Connect your GitHub repo via Vercel dashboard → Project → Settings → Git. No GitHub Action needed.

If you want pre-deploy E2E gating, add `.github/workflows/test.yml` that runs `npm run test:e2e` against the latest preview URL.

---

## Production checklist

- [ ] `DATABASE_URL` is the **pooled** Neon connection string, not direct.
- [ ] `JWT_SECRET` is 32+ bytes of randomness, set as a Vercel env var.
- [ ] Migrations applied — verify with `npx neonctl sql --project-id <id> "SELECT count(*) FROM users"` (returns 0 on a fresh DB, no error means schema exists).
- [ ] First registered user is the admin you want.
- [ ] `npm run test:e2e` against prod URL returns `20/20 passed`.
- [ ] Neon point-in-time recovery is on (paid Neon plans only — free tier has 7 days of branch-based recovery).

## What's intentionally NOT done

- **No Express/Docker/Fly leftovers.** Removed in the Vercel migration (commit pre-vercel: `5bc4b87`).
- **No connection pool in app code** — Neon's pooler handles it. `pg.Pool` is the wrong shape for serverless.
- **No graceful shutdown / SIGTERM handling** — serverless functions are killed without notice. There's nothing to drain.
- **No rate limiting** — add `@upstash/ratelimit` (Vercel-native) on `/api/auth/*` once exposed past your VPN.
- **No structured logging** — Vercel's built-in log explorer is enough until an incident proves otherwise.
