import { z } from 'zod';
import { query } from '../lib/db.js';
import { requireAuth, requireRole } from '../lib/auth.js';
import { logActivity } from '../lib/activity.js';
import { methodHandler } from '../lib/handler.js';

// Workflow checklist per project. Single function file with query-param routing
// to fit under the Hobby cap.
//
//   GET    /api/checklist?project_id=N     → list items for a project (any auth)
//   POST   /api/checklist?project_id=N     → add item (manager+)        body: { text }
//   PATCH  /api/checklist?id=M             → toggle completion (any auth) body: { completed: bool }
//   DELETE /api/checklist?id=M             → delete item (manager+)
const newItem = z.object({ text: z.string().min(1).max(500) });
const toggle  = z.object({ completed: z.boolean() });

export default methodHandler({
  GET: async (req, res) => {
    if (!requireAuth(req, res)) return;
    const { project_id } = req.query;
    if (!project_id) { res.status(400).json({ error: 'project_id required' }); return; }
    const { rows } = await query(
      `SELECT c.*, u.name AS completed_by_name
       FROM checklist_items c
       LEFT JOIN users u ON u.id = c.completed_by
       WHERE c.project_id = $1
       ORDER BY c.position ASC, c.id ASC`,
      [project_id]
    );
    res.json(rows);
  },

  POST: async (req, res) => {
    const user = requireRole(req, res, 'admin', 'manager');
    if (!user) return;
    const { project_id } = req.query;
    if (!project_id) { res.status(400).json({ error: 'project_id required' }); return; }
    const { text } = newItem.parse(req.body);
    // Append at the end: position = max(position) + 1
    const { rows } = await query(
      `INSERT INTO checklist_items (project_id, position, text)
       SELECT $1, COALESCE(MAX(position), 0) + 1, $2
       FROM checklist_items WHERE project_id = $1
       RETURNING *`,
      [project_id, text]
    );
    logActivity({
      actorId: user.id, entityType: 'checklist', entityId: rows[0].id,
      action: 'created', metadata: { project_id: Number(project_id) },
    });
    res.status(201).json(rows[0]);
  },

  PATCH: async (req, res) => {
    const user = requireAuth(req, res);
    if (!user) return;
    const { id } = req.query;
    if (!id) { res.status(400).json({ error: 'id required' }); return; }
    const { completed } = toggle.parse(req.body);
    const { rows } = await query(
      `UPDATE checklist_items
       SET completed_at = CASE WHEN $2 THEN NOW() ELSE NULL END,
           completed_by = CASE WHEN $2 THEN $3 ELSE NULL END
       WHERE id = $1 RETURNING *`,
      [id, completed, user.id]
    );
    if (!rows[0]) { res.status(404).json({ error: 'not found' }); return; }
    logActivity({
      actorId: user.id, entityType: 'checklist', entityId: rows[0].id,
      action: completed ? 'checked' : 'unchecked',
    });
    res.json(rows[0]);
  },

  DELETE: async (req, res) => {
    const user = requireRole(req, res, 'admin', 'manager');
    if (!user) return;
    const { id } = req.query;
    if (!id) { res.status(400).json({ error: 'id required' }); return; }
    const { rowCount } = await query('DELETE FROM checklist_items WHERE id = $1', [id]);
    if (!rowCount) { res.status(404).json({ error: 'not found' }); return; }
    logActivity({ actorId: user.id, entityType: 'checklist', entityId: Number(id), action: 'deleted' });
    res.status(204).end();
  },
});
