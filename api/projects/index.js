import { z } from 'zod';
import { query } from '../../lib/db.js';
import { requireAuth, requireRole } from '../../lib/auth.js';
import { logActivity } from '../../lib/activity.js';
import { methodHandler } from '../../lib/handler.js';

const schema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional().nullable(),
  owner_id: z.number().int().positive(),
  status: z.enum(['not_started', 'in_progress', 'done']).optional(),
  deadline: z.string().date().optional().nullable(),
});

export default methodHandler({
  GET: async (req, res) => {
    if (!requireAuth(req, res)) return;
    const { rows } = await query(
      `SELECT p.*, u.name AS owner_name,
              (SELECT COUNT(*)::int FROM tasks t WHERE t.project_id = p.id) AS task_count,
              (SELECT COUNT(*)::int FROM tasks t WHERE t.project_id = p.id AND t.status = 'done') AS done_count
       FROM projects p
       JOIN users u ON u.id = p.owner_id
       ORDER BY p.created_at DESC`
    );
    res.json(rows);
  },

  POST: async (req, res) => {
    const user = requireRole(req, res, 'admin', 'manager');
    if (!user) return;
    const data = schema.parse(req.body);
    const { rows } = await query(
      `INSERT INTO projects (name, description, owner_id, status, deadline)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [data.name, data.description ?? null, data.owner_id, data.status ?? 'not_started', data.deadline ?? null]
    );
    logActivity({ actorId: user.id, entityType: 'project', entityId: rows[0].id, action: 'created' });
    res.status(201).json(rows[0]);
  },
});
