# TaskPilot — A Project Management Tool

Lightweight internal project/task tracker. React SPA + Vercel serverless functions, JWT auth, Neon (Postgres). Deploys with `git push`.

**Live:** https://taskpilot-hr-7gen.vercel.app · **CI:** [GitHub Actions](https://github.com/katvizconde-boop/PM/actions) · 20 backend E2E + 29 frontend unit tests · auto-deployed via Vercel git integration

## File structure

```
.
├── api/                       # Vercel serverless functions (one per route)
│   ├── auth/{login,register,me}.js
│   ├── projects/{index,[id]}.js
│   ├── tasks/{index,[id]}.js
│   ├── comments/
│   │   ├── task/[taskId].js
│   │   └── [id].js
│   ├── activity/index.js
│   ├── dashboard/{summary,users}.js
│   └── health.js
├── lib/                       # Shared helpers used by api/ functions
│   ├── db.js                  # @neondatabase/serverless wrapper
│   ├── auth.js                # JWT verify + role gates
│   ├── activity.js            # audit log helper
│   └── handler.js             # method dispatch + error mapping
├── frontend/                  # React + Tailwind SPA (Vite)
│   ├── index.html
│   ├── vite.config.js
│   └── src/
├── migrations/                # node-pg-migrate (SQL files)
├── test/auth.e2e.mjs          # 20-assertion smoke test
├── package.json               # API deps + migration tooling
├── vercel.json                # build + SPA fallback rewrites
└── DEPLOY.md
```

## Quick start

```bash
# Prereqs: Node 20+, a Neon project (free tier is fine)
npm install

# Apply schema to your Neon DB
DATABASE_URL="postgres://..." npm run migrate:up

# Run locally — Vercel CLI serves SPA + functions on one port
echo 'DATABASE_URL=postgres://...
JWT_SECRET=dev-secret' > .env.local
npx vercel dev

# Smoke test
API_URL=http://localhost:3000 npm run test:e2e
```

Open http://localhost:3000. Register the first user — auto-promoted to admin.

For production deploy, see [DEPLOY.md](DEPLOY.md).

## Roles

| Role     | Can register | Create projects | Edit projects | Delete projects | Create/edit tasks | Comment |
|----------|:-:|:-:|:-:|:-:|:-:|:-:|
| admin    | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| manager  | ✓ | ✓ | ✓ |   | ✓ | ✓ |
| member   | ✓ |   |   |   | ✓ | ✓ |

## Migrations

```bash
DATABASE_URL=...  npm run migrate:create -- add-attachments
DATABASE_URL=...  npm run migrate:up
DATABASE_URL=...  npm run migrate:down
```

There's no "container start" hook in serverless — run migrations manually from your CLI against each environment's `DATABASE_URL`. Use Neon branches to test schema changes safely before running them on prod.
