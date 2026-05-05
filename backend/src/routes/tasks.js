import { Router } from 'express';
import { z } from 'zod';
import { query } from '../db.js';
import { logActivity } from '../utils/activity.js';

const router = Router();

const taskSchema = z.object({
  project_id: z.number().int().positive(),
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional().nullable(),
  assignee_id: z.number().int().positive().optional().nullable(),
  status: z.enum(['todo', 'in_progress', 'done']).optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  due_date: z.string().date().optional().nullable(),
});

// List tasks. Optional filters: ?project_id=, ?assignee_id=, ?status=
router.get('/', async (req, res, next) => {
  try {
    const filters = [];
    const values = [];
    for (const key of ['project_id', 'assignee_id', 'status']) {
      if (req.query[key]) {
        values.push(req.query[key]);
        filters.push(`t.${key} = $${values.length}`);
      }
    }
    const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
    const { rows } = await query(
      `SELECT t.*, u.name AS assignee_name, p.name AS project_name
       FROM tasks t
       LEFT JOIN users u ON u.id = t.assignee_id
       JOIN projects p ON p.id = t.project_id
       ${where}
       ORDER BY t.created_at DESC`,
      values
    );
    res.json(rows);
  } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT t.*, u.name AS assignee_name, p.name AS project_name
       FROM tasks t
       LEFT JOIN users u ON u.id = t.assignee_id
       JOIN projects p ON p.id = t.project_id
       WHERE t.id = $1`,
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'not found' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  try {
    const data = taskSchema.parse(req.body);
    const { rows } = await query(
      `INSERT INTO tasks (project_id, title, description, assignee_id, status, priority, due_date, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        data.project_id, data.title, data.description ?? null, data.assignee_id ?? null,
        data.status ?? 'todo', data.priority ?? 'medium', data.due_date ?? null, req.user.id,
      ]
    );
    logActivity({ actorId: req.user.id, entityType: 'task', entityId: rows[0].id, action: 'created' });
    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
});

router.patch('/:id', async (req, res, next) => {
  try {
    const data = taskSchema.partial().omit({ project_id: true }).parse(req.body);
    const fields = Object.keys(data);
    if (!fields.length) return res.status(400).json({ error: 'no fields' });

    // Capture pre-state for status_changed audit.
    const before = (await query('SELECT status FROM tasks WHERE id = $1', [req.params.id])).rows[0];
    if (!before) return res.status(404).json({ error: 'not found' });

    const set = fields.map((k, i) => `${k} = $${i + 1}`).join(', ');
    const values = fields.map(k => data[k]);
    values.push(req.params.id);
    const { rows } = await query(
      `UPDATE tasks SET ${set}, updated_at = NOW() WHERE id = $${values.length} RETURNING *`,
      values
    );

    const action = data.status && data.status !== before.status ? 'status_changed' : 'updated';
    const metadata = action === 'status_changed' ? { from: before.status, to: data.status } : data;
    logActivity({ actorId: req.user.id, entityType: 'task', entityId: rows[0].id, action, metadata });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const { rowCount } = await query('DELETE FROM tasks WHERE id = $1', [req.params.id]);
    if (!rowCount) return res.status(404).json({ error: 'not found' });
    logActivity({ actorId: req.user.id, entityType: 'task', entityId: Number(req.params.id), action: 'deleted' });
    res.status(204).end();
  } catch (err) { next(err); }
});

export default router;
