import { z } from 'zod';
import { query } from '../../lib/db.js';
import { requireAuth } from '../../lib/auth.js';
import { logActivity } from '../../lib/activity.js';
import { methodHandler } from '../../lib/handler.js';

const patchSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).nullable(),
  assignee_id: z.number().int().positive().nullable(),
  status: z.enum(['todo', 'in_progress', 'done']),
  priority: z.enum(['low', 'medium', 'high', 'urgent']),
  due_date: z.string().date().nullable(),
}).partial();

export default methodHandler({
  GET: async (req, res) => {
    if (!requireAuth(req, res)) return;
    const { rows } = await query(
      `SELECT t.*, u.name AS assignee_name, p.name AS project_name
       FROM tasks t
       LEFT JOIN users u ON u.id = t.assignee_id
       JOIN projects p ON p.id = t.project_id
       WHERE t.id = $1`,
      [req.query.id]
    );
    if (!rows[0]) { res.status(404).json({ error: 'not found' }); return; }
    res.json(rows[0]);
  },

  PATCH: async (req, res) => {
    const user = requireAuth(req, res);
    if (!user) return;
    const data = patchSchema.parse(req.body);
    const fields = Object.keys(data);
    if (!fields.length) { res.status(400).json({ error: 'no fields' }); return; }

    // Capture pre-state for status_changed audit.
    const before = (await query('SELECT status FROM tasks WHERE id = $1', [req.query.id])).rows[0];
    if (!before) { res.status(404).json({ error: 'not found' }); return; }

    const set = fields.map((k, i) => `${k} = $${i + 1}`).join(', ');
    const values = fields.map(k => data[k]);
    values.push(req.query.id);
    const { rows } = await query(
      `UPDATE tasks SET ${set}, updated_at = NOW() WHERE id = $${values.length} RETURNING *`,
      values
    );

    const action = data.status && data.status !== before.status ? 'status_changed' : 'updated';
    const metadata = action === 'status_changed' ? { from: before.status, to: data.status } : data;
    logActivity({ actorId: user.id, entityType: 'task', entityId: rows[0].id, action, metadata });
    res.json(rows[0]);
  },

  DELETE: async (req, res) => {
    const user = requireAuth(req, res);
    if (!user) return;
    const { rowCount } = await query('DELETE FROM tasks WHERE id = $1', [req.query.id]);
    if (!rowCount) { res.status(404).json({ error: 'not found' }); return; }
    logActivity({ actorId: user.id, entityType: 'task', entityId: Number(req.query.id), action: 'deleted' });
    res.status(204).end();
  },
});
