import { neon } from '@neondatabase/serverless';

// Lazy init — neon() throws if DATABASE_URL isn't set, and module load
// can race with env var population in some serverless runtimes.
let sql;
function getSql() {
  if (!sql) {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL not set');
    }
    sql = neon(process.env.DATABASE_URL);
  }
  return sql;
}

export const query = async (text, params = []) => {
  const rows = await getSql()(text, params);
  return { rows, rowCount: rows.length };
};
