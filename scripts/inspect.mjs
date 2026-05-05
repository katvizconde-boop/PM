// Quick sanity check: list tables + row counts. Used for ad-hoc verification.
import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';
neonConfig.webSocketConstructor = ws;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
try {
  const { rows } = await pool.query(`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' ORDER BY table_name`);
  for (const r of rows) {
    const { rows: c } = await pool.query(`SELECT COUNT(*)::int AS n FROM "${r.table_name}"`);
    console.log(`  ${r.table_name.padEnd(20)} ${c[0].n} rows`);
  }
} finally { await pool.end(); }
