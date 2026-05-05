import { query } from '../../lib/db.js';
import { requireAuth } from '../../lib/auth.js';
import { methodHandler } from '../../lib/handler.js';

export default methodHandler({
  GET: async (req, res) => {
    if (!requireAuth(req, res)) return;
    const { entity_type, entity_id } = req.query;
    const filters = [];
    const values = [];
    if (entity_type) { values.push(entity_type); filters.push(`a.entity_type = $${values.length}`); }
    if (entity_id)   { values.push(entity_id);   filters.push(`a.entity_id   = $${values.length}`); }
    const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
    const { rows } = await query(
      `SELECT a.*, u.name AS actor_name FROM activity_logs a
       JOIN users u ON u.id = a.actor_id
       ${where}
       ORDER BY a.created_at DESC LIMIT 100`,
      values
    );
    res.json(rows);
  },
});
