import { z } from 'zod';
import { query } from '../lib/db.js';
import { requireAuth } from '../lib/auth.js';
import { logActivity } from '../lib/activity.js';
import { methodHandler } from '../lib/handler.js';

// Single function backing all comment routes:
//   GET    /api/comments?task_id=42    → list comments on a task
//   POST   /api/comments?task_id=42    → add comment
//   DELETE /api/comments?id=7          → delete comment (author or admin)
//
// Consolidated to keep the function count under the Hobby cap.
// URL contract has changed from the old /api/comments/task/:taskId form;
// frontend client is the only caller and has been updated to match.
export default methodHandler({
  GET: async (req, res) => {
    if (!requireAuth(req, res)) return;
    const { task_id } = req.query;
    if (!task_id) { res.status(400).json({ error: 'task_id required' }); return; }
    const { rows } = await query(
      `SELECT c.*, u.name AS author_name FROM comments c
       JOIN users u ON u.id = c.author_id
       WHERE c.task_id = $1 ORDER BY c.created_at ASC`,
      [task_id]
    );
    res.json(rows);
  },

  POST: async (req, res) => {
    const user = requireAuth(req, res);
    if (!user) return;
    const { task_id } = req.query;
    if (!task_id) { res.status(400).json({ error: 'task_id required' }); return; }
    const { body } = z.object({ body: z.string().min(1).max(2000) }).parse(req.body);
    const { rows } = await query(
      `INSERT INTO comments (task_id, author_id, body)
       VALUES ($1, $2, $3) RETURNING *`,
      [task_id, user.id, body]
    );
    logActivity({
      actorId: user.id, entityType: 'comment', entityId: rows[0].id,
      action: 'created', metadata: { task_id: Number(task_id) },
    });
    res.status(201).json({ ...rows[0], author_name: user.name });
  },

  DELETE: async (req, res) => {
    const user = requireAuth(req, res);
    if (!user) return;
    const { id } = req.query;
    if (!id) { res.status(400).json({ error: 'id required' }); return; }
    const { rows } = await query('SELECT author_id FROM comments WHERE id = $1', [id]);
    if (!rows[0]) { res.status(404).json({ error: 'not found' }); return; }
    if (rows[0].author_id !== user.id && user.role !== 'admin') {
      res.status(403).json({ error: 'forbidden' });
      return;
    }
    await query('DELETE FROM comments WHERE id = $1', [id]);
    res.status(204).end();
  },
});
