# PM — Lightweight Project Management

Internal project/task tracker. React + Tailwind on the front, Node/Express + Postgres on the back, JWT auth, Docker-ready.

## File structure

```
.
├── docker-compose.yml
├── .env.example
├── backend/
│   ├── Dockerfile
│   ├── package.json
│   ├── migrations/            # node-pg-migrate (SQL files)
│   │   └── 1714867200000_initial-schema.sql
│   ├── test/
│   │   └── auth.e2e.mjs       # smoke test: register/login/protected
│   └── src/
│       ├── index.js           # Express entry + error handler
│       ├── db.js              # pg pool
│       ├── middleware/auth.js # JWT + requireRole()
│       ├── utils/activity.js  # audit log helper
│       └── routes/            # auth, projects, tasks, comments, activity, dashboard
└── frontend/
    ├── Dockerfile
    ├── nginx.conf             # serves SPA + proxies /api -> backend
    ├── package.json
    ├── vite.config.js
    ├── tailwind.config.js
    ├── index.html
    └── src/
        ├── main.jsx
        ├── App.jsx            # routes
        ├── index.css          # tailwind layers
        ├── api/client.js      # fetch wrapper, JWT in localStorage
        ├── contexts/AuthContext.jsx
        ├── components/        # Layout, ProtectedRoute
        └── pages/             # Login, Register, Dashboard, Projects, ProjectDetail, MyTasks
```

## Quick start (Docker)

```bash
cp .env.example .env          # generate a real JWT_SECRET
docker compose up --build
```

- App:     http://localhost:8080
- API:     http://localhost:4000
- DB:      localhost:5432  (user/pass: pm/pm)

The first user you register becomes `admin`. Subsequent registrations default to `member`; an admin can promote them.

## Local dev (without Docker)

```bash
# 1. Postgres
docker run -d --name pm-db -p 5432:5432 \
  -e POSTGRES_USER=pm -e POSTGRES_PASSWORD=pm -e POSTGRES_DB=pm postgres:16-alpine

# 2. Backend — migrations run via node-pg-migrate
cd backend
npm install
export DATABASE_URL=postgres://pm:pm@localhost:5432/pm
export JWT_SECRET=dev-secret
npm run migrate:up   # apply all migrations
npm run dev          # API on :4000

# 3. Frontend
cd ../frontend
npm install
npm run dev          # http://localhost:5173, proxies /api to :4000
```

## Migrations

Schema changes live in `backend/migrations/` as timestamped SQL files. Each file has `-- Up Migration` and `-- Down Migration` sections.

```bash
cd backend
npm run migrate:create -- add-attachments  # generates a stub
npm run migrate:up                         # apply pending
npm run migrate:down                       # roll back the last one
```

The Docker `backend` image runs `migrate:up` automatically on container start, so `docker compose up` is enough.

## End-to-end auth test

Two ways to run the suite:

```bash
# Option A — fully self-contained (no Docker, no Postgres install required).
# Spins up an embedded Postgres on a random port, runs migrations, starts the API,
# runs the suite, tears down. Good for CI.
cd backend
npm install --no-save embedded-postgres
npm run test:e2e:local

# Option B — against an already-running stack.
docker compose up -d --build
cd backend
API_URL=http://localhost:4000 npm run test:e2e
```

Covers: health check, register (incl. duplicate + validation), login (incl. wrong password), protected route gating with/without/with-bogus token, dashboard summary. Exits non-zero on failure — wire either form into CI as-is.

Last run (Option A, Node 24 / PG 18 on Windows): **10/10 passed, exit 0.**

## Roles

| Role     | Can register | Create projects | Edit projects | Delete projects | Create/edit tasks | Comment |
|----------|:-:|:-:|:-:|:-:|:-:|:-:|
| admin    | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| manager  | ✓ | ✓ | ✓ |   | ✓ | ✓ |
| member   | ✓ |   |   |   | ✓ | ✓ |

## Scaling notes

- API is stateless — scale horizontally behind a load balancer.
- Postgres handles internal-team load easily; promote to managed Postgres (RDS/Neon/Supabase) for prod.
- For real-time updates, add a WebSocket layer or poll `/api/activity` — deferred for v2.
- Nice-to-haves intentionally skipped in MVP: file attachments (S3 + signed URLs), notifications (worker + SMTP), Kanban (group `tasks` by `status` column), calendar (group by `due_date`).
