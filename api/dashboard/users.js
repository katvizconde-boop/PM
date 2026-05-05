import { query } from '../../lib/db.js';
import { requireAuth } from '../../lib/auth.js';
import { methodHandler } from '../../lib/handler.js';

export default methodHandler({
  GET: async (req, res) => {
    if (!requireAuth(req, res)) return;
    const { rows } = await query(
      `SELECT id, name, email, role FROM users WHERE is_active = TRUE ORDER BY name`
    );
    res.json(rows);
  },
});
