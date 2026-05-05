import { Router } from 'express';
import { z } from 'zod';
import { query } from '../db.js';
import { requireRole } from '../middleware/auth.js';
import { logActivity } from '../utils/activity.js';

const router = Router();

const projectSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional().nullable(),
  owner_id: z.number().int().positive(),
  status: z.enum(['not_started', 'in_progress', 'done']).optional(),
  deadline: z.string().date().optional().nullable(),
});

router.get('/', async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT p.*, u.name AS owner_name,
              (SELECT COUNT(*)::int FROM tasks t WHERE t.project_id = p.id) AS task_count,
              (SELECT COUNT(*)::int FROM tasks t WHERE t.project_id = p.id AND t.status = 'done') AS done_count
       FROM projects p
       JOIN users u ON u.id = p.owner_id
       ORDER BY p.created_at DESC`
    );
    res.json(rows);
  } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT p.*, u.name AS owner_name FROM projects p
       JOIN users u ON u.id = p.owner_id WHERE p.id = $1`,
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'not found' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

// Only admins/managers can create projects.
router.post('/', requireRole('admin', 'manager'), async (req, res, next) => {
  try {
    const data = projectSchema.parse(req.body);
    const { rows } = await query(
      `INSERT INTO projects (name, description, owner_id, status, deadline)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [data.name, data.description ?? null, data.owner_id, data.status ?? 'not_started', data.deadline ?? null]
    );
    logActivity({ actorId: req.user.id, entityType: 'project', entityId: rows[0].id, action: 'created' });
    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
});

router.patch('/:id', requireRole('admin', 'manager'), async (req, res, next) => {
  try {
    const data = projectSchema.partial().parse(req.body);
    const fields = Object.keys(data);
    if (!fields.length) return res.status(400).json({ error: 'no fields' });
    const set = fields.map((k, i) => `${k} = $${i + 1}`).join(', ');
    const values = fields.map(k => data[k]);
    values.push(req.params.id);
    const { rows } = await query(
      `UPDATE projects SET ${set}, updated_at = NOW() WHERE id = $${values.length} RETURNING *`,
      values
    );
    if (!rows[0]) return res.status(404).json({ error: 'not found' });
    logActivity({
      actorId: req.user.id, entityType: 'project', entityId: rows[0].id,
      action: 'updated', metadata: data
    });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

router.delete('/:id', requireRole('admin'), async (req, res, next) => {
  try {
    const { rowCount } = await query('DELETE FROM projects WHERE id = $1', [req.params.id]);
    if (!rowCount) return res.status(404).json({ error: 'not found' });
    logActivity({ actorId: req.user.id, entityType: 'project', entityId: Number(req.params.id), action: 'deleted' });
    res.status(204).end();
  } catch (err) { next(err); }
});

export default router;
