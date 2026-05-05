import { neon } from '@neondatabase/serverless';

// HTTP-based driver — no persistent pool, perfect for serverless cold starts.
// Each `query()` call is one HTTP round-trip to Neon's edge proxy.
const sql = neon(process.env.DATABASE_URL);

// Match the pg.Pool query() shape so route handlers don't need to change.
export const query = async (text, params = []) => {
  const rows = await sql(text, params);
  return { rows, rowCount: rows.length };
};
