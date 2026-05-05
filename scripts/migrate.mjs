// Local-first migration runner that uses @neondatabase/serverless (port 443 / WebSocket)
// instead of raw pg (port 5432). Identical behavior to `node-pg-migrate up` for our use:
//
//   1. Ensure `pgmigrations` table exists.
//   2. Read migrations/*.sql, split into Up/Down sections.
//   3. Apply any not yet recorded in `pgmigrations`, in filename order.
//   4. Record each applied migration with its run_on timestamp.
//
// Why not node-pg-migrate? Its `pg` driver opens port 5432, which many networks block.
// Why not Neon's HTTP `neon()` helper? It runs single statements only — our schema SQL
// is multi-statement. The WebSocket-based `Pool` accepts the full file in one call.

import { Pool, neonConfig } from '@neondatabase/serverless';
import { readFileSync, readdirSync } from 'node:fs';
import { join, basename } from 'node:path';
import ws from 'ws';

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL not set'); process.exit(1);
}

// Node-side WebSocket transport (browsers have it built in; Node doesn't).
neonConfig.webSocketConstructor = ws;

const dir = 'migrations';
const direction = process.argv[2] || 'up';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS pgmigrations (
      id     SERIAL PRIMARY KEY,
      name   TEXT NOT NULL UNIQUE,
      run_on TIMESTAMP NOT NULL DEFAULT NOW()
    )`);

  const files = readdirSync(dir).filter(f => f.endsWith('.sql')).sort();
  const { rows: applied } = await pool.query('SELECT name FROM pgmigrations ORDER BY id');
  const appliedNames = new Set(applied.map(r => r.name));

  if (direction === 'up') {
    let count = 0;
    for (const file of files) {
      const name = basename(file, '.sql');
      if (appliedNames.has(name)) continue;
      const sql = readFileSync(join(dir, file), 'utf8');
      const upSection = sql.split(/^-- Down Migration\b/m)[0].replace(/^-- Up Migration\b/m, '').trim();
      console.log(`up   ${name}`);
      await pool.query(upSection);
      await pool.query('INSERT INTO pgmigrations (name) VALUES ($1)', [name]);
      count++;
    }
    console.log(`applied ${count} migration(s)`);
  } else if (direction === 'down') {
    const last = applied.at(-1);
    if (!last) { console.log('nothing to roll back'); return; }
    const file = files.find(f => basename(f, '.sql') === last.name);
    if (!file) throw new Error(`migration file missing for ${last.name}`);
    const sql = readFileSync(join(dir, file), 'utf8');
    const downSection = sql.split(/^-- Down Migration\b/m)[1]?.trim();
    if (!downSection) throw new Error(`no down section in ${last.name}`);
    console.log(`down ${last.name}`);
    await pool.query(downSection);
    await pool.query('DELETE FROM pgmigrations WHERE name = $1', [last.name]);
  } else {
    console.error(`unknown direction: ${direction}`);
    process.exit(1);
  }
}

try { await main(); } finally { await pool.end(); }
