import { z } from 'zod';
import { query } from '../../lib/db.js';
import { requireAuth, requireRole } from '../../lib/auth.js';
import { logActivity } from '../../lib/activity.js';
import { methodHandler } from '../../lib/handler.js';

const patchSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).nullable(),
  owner_id: z.number().int().positive(),
  status: z.enum(['not_started', 'in_progress', 'done']),
  deadline: z.string().date().nullable(),
}).partial();

export default methodHandler({
  GET: async (req, res) => {
    if (!requireAuth(req, res)) return;
    const { rows } = await query(
      `SELECT p.*, u.name AS owner_name FROM projects p
       JOIN users u ON u.id = p.owner_id WHERE p.id = $1`,
      [req.query.id]
    );
    if (!rows[0]) { res.status(404).json({ error: 'not found' }); return; }
    res.json(rows[0]);
  },

  PATCH: async (req, res) => {
    const user = requireRole(req, res, 'admin', 'manager');
    if (!user) return;
    const data = patchSchema.parse(req.body);
    const fields = Object.keys(data);
    if (!fields.length) { res.status(400).json({ error: 'no fields' }); return; }
    const set = fields.map((k, i) => `${k} = $${i + 1}`).join(', ');
    const values = fields.map(k => data[k]);
    values.push(req.query.id);
    const { rows } = await query(
      `UPDATE projects SET ${set}, updated_at = NOW() WHERE id = $${values.length} RETURNING *`,
      values
    );
    if (!rows[0]) { res.status(404).json({ error: 'not found' }); return; }
    logActivity({ actorId: user.id, entityType: 'project', entityId: rows[0].id, action: 'updated', metadata: data });
    res.json(rows[0]);
  },

  DELETE: async (req, res) => {
    const user = requireRole(req, res, 'admin');
    if (!user) return;
    const { rowCount } = await query('DELETE FROM projects WHERE id = $1', [req.query.id]);
    if (!rowCount) { res.status(404).json({ error: 'not found' }); return; }
    logActivity({ actorId: user.id, entityType: 'project', entityId: Number(req.query.id), action: 'deleted' });
    res.status(204).end();
  },
});
