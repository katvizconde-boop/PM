import { z } from 'zod';
import { query } from '../../../lib/db.js';
import { requireAuth } from '../../../lib/auth.js';
import { logActivity } from '../../../lib/activity.js';
import { methodHandler } from '../../../lib/handler.js';

export default methodHandler({
  GET: async (req, res) => {
    if (!requireAuth(req, res)) return;
    const { rows } = await query(
      `SELECT c.*, u.name AS author_name FROM comments c
       JOIN users u ON u.id = c.author_id
       WHERE c.task_id = $1 ORDER BY c.created_at ASC`,
      [req.query.taskId]
    );
    res.json(rows);
  },

  POST: async (req, res) => {
    const user = requireAuth(req, res);
    if (!user) return;
    const { body } = z.object({ body: z.string().min(1).max(2000) }).parse(req.body);
    const { rows } = await query(
      `INSERT INTO comments (task_id, author_id, body)
       VALUES ($1, $2, $3) RETURNING *`,
      [req.query.taskId, user.id, body]
    );
    logActivity({
      actorId: user.id, entityType: 'comment', entityId: rows[0].id,
      action: 'created', metadata: { task_id: Number(req.query.taskId) },
    });
    res.status(201).json({ ...rows[0], author_name: user.name });
  },
});
