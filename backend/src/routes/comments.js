import { Router } from 'express';
import { z } from 'zod';
import { query } from '../db.js';
import { logActivity } from '../utils/activity.js';

const router = Router();

router.get('/task/:taskId', async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT c.*, u.name AS author_name FROM comments c
       JOIN users u ON u.id = c.author_id
       WHERE c.task_id = $1 ORDER BY c.created_at ASC`,
      [req.params.taskId]
    );
    res.json(rows);
  } catch (err) { next(err); }
});

router.post('/task/:taskId', async (req, res, next) => {
  try {
    const { body } = z.object({ body: z.string().min(1).max(2000) }).parse(req.body);
    const { rows } = await query(
      `INSERT INTO comments (task_id, author_id, body)
       VALUES ($1, $2, $3) RETURNING *`,
      [req.params.taskId, req.user.id, body]
    );
    logActivity({
      actorId: req.user.id, entityType: 'comment', entityId: rows[0].id,
      action: 'created', metadata: { task_id: Number(req.params.taskId) },
    });
    res.status(201).json({ ...rows[0], author_name: req.user.name });
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    // Author or admin can delete.
    const { rows } = await query('SELECT author_id FROM comments WHERE id = $1', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'not found' });
    if (rows[0].author_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'forbidden' });
    }
    await query('DELETE FROM comments WHERE id = $1', [req.params.id]);
    res.status(204).end();
  } catch (err) { next(err); }
});

export default router;
