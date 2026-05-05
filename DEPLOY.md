# Deployment

Three services to host: **backend** (Node API), **frontend** (Nginx serving the built SPA), **database** (Postgres). The compose stack works as-is on any single VM; for managed hosting, the recipe below covers Fly.io. Render is sketched at the bottom.

---

## Fly.io — first deploy (one-time setup)

**Cost (rough):** 2× shared-cpu-1x VMs (256MB) + `fly postgres` shared-cpu-1x ≈ **$5–15/mo** with autoscale-to-zero on idle. Free Postgres tier exists but isn't backed up — don't use it for anything you care about.

### 0. Prereqs

```bash
# Install flyctl. On Windows: winget install Fly-io.flyctl
brew install flyctl                      # macOS
curl -L https://fly.io/install.sh | sh   # Linux
fly auth login                           # opens browser
```

You'll need a Fly account with a payment method on file. The free tier covers very small workloads but won't host all three services without one.

### 1. Postgres

```bash
fly postgres create \
  --name pm-db \
  --region iad \
  --vm-size shared-cpu-1x \
  --volume-size 1 \
  --initial-cluster-size 1
```

Save the connection string it prints — you don't need to use it directly because `fly postgres attach` (step 2) wires it into the backend automatically.

### 2. Backend

From the repo root:

```bash
cd backend
fly launch --copy-config --no-deploy --name pm-api
fly postgres attach pm-db --app pm-api               # sets DATABASE_URL secret
fly secrets set JWT_SECRET="$(openssl rand -hex 32)" --app pm-api
fly secrets set CORS_ORIGIN="https://pm-web.fly.dev" --app pm-api
fly deploy
```

The Dockerfile's `CMD` runs `npm run migrate:up && node src/index.js`, so migrations apply automatically on every deploy.

Verify it's up:

```bash
curl https://pm-api.fly.dev/health
# {"ok":true}

cd ../backend
API_URL=https://pm-api.fly.dev npm run test:e2e   # runs the suite against prod
```

### 3. Frontend

```bash
cd ../frontend
fly launch --copy-config --no-deploy --name pm-web
fly deploy
```

`frontend/fly.toml` already sets `API_HOST=pm-api.internal`, which routes via Fly's private 6PN network — the SPA still talks to `/api` on its own origin, so no CORS round trip.

Open https://pm-web.fly.dev. Register the first user (auto-promoted to admin).

### 4. Tighten CORS

Once the frontend is up, set `CORS_ORIGIN` to its real origin:

```bash
fly secrets set CORS_ORIGIN="https://pm-web.fly.dev" --app pm-api
# (You already did this in step 2 if pm-web was the planned name — re-set if it differs.)
```

The backend refuses to boot in production without a non-`*` `CORS_ORIGIN` — by design.

---

## CI/CD (GitHub Actions)

`.github/workflows/deploy.yml` runs the E2E suite against a real Postgres, then deploys both apps to Fly on every push to `main`. To enable:

```bash
fly tokens create deploy -x 999999h           # long-lived deploy token
gh secret set FLY_API_TOKEN --body "<paste token>"
```

(or paste it manually under Settings → Secrets and variables → Actions.)

The workflow deploys backend and frontend in parallel — they're independent.

---

## Production checklist

- [ ] `JWT_SECRET` is a 32-byte random value, set as a Fly secret.
- [ ] `CORS_ORIGIN` is the exact frontend origin, not `*`.
- [ ] `NODE_ENV=production` (set by `backend/fly.toml`; the API throws on boot otherwise).
- [ ] Postgres backups: `fly postgres backup list --app pm-db` shows daily snapshots.
- [ ] First registered user is the admin you want — sign up immediately and don't share the URL until you have.
- [ ] Run `API_URL=https://pm-api.fly.dev npm run test:e2e` against the deployed backend; expect `20/20 passed`.

---

## Render (alternative)

If you'd rather use Render, the equivalent `render.yaml` is:

```yaml
databases:
  - name: pm-db
    plan: starter
    postgresMajorVersion: 16

services:
  - type: web
    name: pm-api
    runtime: docker
    dockerContext: ./backend
    dockerfilePath: ./backend/Dockerfile
    healthCheckPath: /health
    envVars:
      - key: NODE_ENV
        value: production
      - key: DATABASE_URL
        fromDatabase: { name: pm-db, property: connectionString }
      - key: JWT_SECRET
        generateValue: true
      - key: CORS_ORIGIN
        value: https://pm-web.onrender.com

  - type: web
    name: pm-web
    runtime: docker
    dockerContext: ./frontend
    dockerfilePath: ./frontend/Dockerfile
    envVars:
      - key: API_HOST
        fromService: { type: web, name: pm-api, property: host }
      - key: API_PORT
        value: "443"
```

`git push` triggers a deploy. Render runs migrations on each deploy via the Dockerfile.

**Cost:** Starter plan $7/service × 2 + $7 Postgres = **~$21/mo**. Simpler tooling, no idle scale-to-zero, no internal networking surprises.

---

## What's intentionally NOT included

- **CDN / caching headers** — for an internal tool, traffic doesn't justify it.
- **Sentry / structured logging** — defer until you have a real incident; `fly logs` works.
- **Rate limiting** — add `express-rate-limit` to `/api/auth/*` if you ever expose this past your VPN.
- **Multi-region Postgres** — single region is fine. Revisit only if latency is a real complaint.
