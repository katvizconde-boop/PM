// Local E2E orchestrator: spins up an embedded Postgres on a random port,
// runs migrations, starts the API, runs auth.e2e.mjs, tears everything down.
// Not used in production — purely a one-shot harness for `npm run test:e2e:local`.

import EmbeddedPostgres from 'embedded-postgres';
import { spawn } from 'node:child_process';
import { rm, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const PG_PORT  = 55432;
const API_PORT = 4055;
const DB_NAME  = 'pm_test';
const DB_USER  = 'postgres';
const DB_PASS  = 'postgres';

const databaseDir = await mkdtemp(join(tmpdir(), 'pm-e2e-'));
const pg = new EmbeddedPostgres({
  databaseDir,
  user: DB_USER,
  password: DB_PASS,
  port: PG_PORT,
  persistent: false,
  onLog: (m) => process.stderr.write(`[pg] ${m}`),
  onError: (e) => console.error('[pg!]', e),
});

let api;

const cleanup = async (code = 0) => {
  if (api && !api.killed) {
    api.kill('SIGTERM');
    await new Promise(r => api.once('exit', r));
  }
  try { await pg.stop(); } catch {}
  try { await rm(databaseDir, { recursive: true, force: true }); } catch {}
  process.exit(code);
};
process.on('SIGINT',  () => cleanup(130));
process.on('SIGTERM', () => cleanup(143));
// Postgres clients yell ECONNRESET when we shut the DB down — expected during teardown.
process.on('uncaughtException', (e) => {
  if (e?.code === 'ECONNRESET' || /Connection terminated/.test(e?.message ?? '')) return;
  throw e;
});

try {
  console.log('[1/5] starting embedded postgres…');
  await pg.initialise();
  await pg.start();
  await pg.createDatabase(DB_NAME);

  const databaseUrl = `postgres://${DB_USER}:${DB_PASS}@localhost:${PG_PORT}/${DB_NAME}`;
  const env = { ...process.env, DATABASE_URL: databaseUrl, JWT_SECRET: 'test-secret', PORT: String(API_PORT) };

  console.log('[2/5] running migrations…');
  await new Promise((resolve, reject) => {
    const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    const m = spawn(npmCmd, ['run', 'migrate:up'], { env, stdio: 'inherit', shell: true });
    m.once('exit', (c) => c === 0 ? resolve() : reject(new Error(`migrate exit ${c}`)));
  });

  console.log('[3/5] starting API…');
  // Spawn node directly (not via npm) so SIGTERM hits the right process on Windows.
  api = spawn(process.execPath, ['src/index.js'], { env, stdio: 'inherit' });

  // Wait for /health.
  const apiUrl = `http://localhost:${API_PORT}`;
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${apiUrl}/health`);
      if (res.ok) break;
    } catch {}
    await new Promise(r => setTimeout(r, 250));
  }
  console.log('[4/5] running auth e2e suite…');
  await new Promise((resolve, reject) => {
    const t = spawn(process.execPath, ['test/auth.e2e.mjs'], {
      env: { ...env, API_URL: apiUrl }, stdio: 'inherit',
    });
    t.once('exit', (c) => c === 0 ? resolve() : reject(new Error(`tests exit ${c}`)));
  });

  console.log('[5/5] tearing down.');
  await cleanup(0);
} catch (err) {
  // Set exitCode immediately so even if cleanup never reaches process.exit, we still fail.
  process.exitCode = 1;
  console.error('E2E failed:', err ?? '(no error object)');
  await cleanup(1);
}
