import { z } from 'zod';
import { query } from '../../lib/db.js';
import { requireAuth } from '../../lib/auth.js';
import { logActivity } from '../../lib/activity.js';
import { methodHandler } from '../../lib/handler.js';

const schema = z.object({
  project_id: z.number().int().positive(),
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional().nullable(),
  assignee_id: z.number().int().positive().optional().nullable(),
  status: z.enum(['todo', 'in_progress', 'done']).optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  due_date: z.string().date().optional().nullable(),
  parent_task_id: z.number().int().positive().optional().nullable(),
  tags: z.array(z.string().min(1).max(40)).max(20).optional(),
});

export default methodHandler({
  GET: async (req, res) => {
    if (!requireAuth(req, res)) return;
    const filters = [];
    const values = [];
    for (const key of ['project_id', 'assignee_id', 'status']) {
      if (req.query[key]) { values.push(req.query[key]); filters.push(`t.${key} = $${values.length}`); }
    }
    const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
    const { rows } = await query(
      `SELECT t.*, u.name AS assignee_name, p.name AS project_name,
              (SELECT COUNT(*)::int FROM comments c WHERE c.task_id = t.id) AS comments_count
       FROM tasks t
       LEFT JOIN users u ON u.id = t.assignee_id
       JOIN projects p ON p.id = t.project_id
       ${where}
       ORDER BY t.created_at DESC`,
      values
    );
    res.json(rows);
  },

  POST: async (req, res) => {
    const user = requireAuth(req, res);
    if (!user) return;
    const data = schema.parse(req.body);
    const { rows } = await query(
      `INSERT INTO tasks (project_id, title, description, assignee_id, status, priority,
                          due_date, created_by, parent_task_id, tags)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        data.project_id, data.title, data.description ?? null, data.assignee_id ?? null,
        data.status ?? 'todo', data.priority ?? 'medium', data.due_date ?? null, user.id,
        data.parent_task_id ?? null, data.tags ?? [],
      ]
    );
    logActivity({ actorId: user.id, entityType: 'task', entityId: rows[0].id, action: 'created' });
    res.status(201).json(rows[0]);
  },
});
