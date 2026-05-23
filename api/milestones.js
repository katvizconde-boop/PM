import { z } from 'zod';
import { query } from '../lib/db.js';
import { requireAuth, requireRole } from '../lib/auth.js';
import { logActivity } from '../lib/activity.js';
import { methodHandler } from '../lib/handler.js';

// Project milestones (parent buckets for tasks).
//
//   GET    /api/milestones?project_id=N   list milestones for a project
//   POST   /api/milestones?project_id=N   create  (manager+)  body: { name, ... }
//   PATCH  /api/milestones?id=M           update  (manager+)
//   DELETE /api/milestones?id=M           delete  (manager+) — tasks survive (SET NULL)
//
// Query-param routing keeps this one file under the 12-function Hobby cap.

const createSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional().nullable(),
  start_date: z.string().date().optional().nullable(),
  end_date:   z.string().date().optional().nullable(),
});
const patchSchema = createSchema.extend({
  status: z.enum(['active', 'completed', 'archived']),
  position: z.number().int().min(0),
}).partial();

const SELECT_WITH_STATS = `
  SELECT m.*,
         (SELECT COUNT(*)::int FROM tasks t WHERE t.milestone_id = m.id) AS task_count,
         (SELECT COUNT(*)::int FROM tasks t WHERE t.milestone_id = m.id AND t.status = 'done') AS done_count
  FROM milestones m
`;

export default methodHandler({
  GET: async (req, res) => {
    if (!requireAuth(req, res)) return;
    const { project_id } = req.query;
    if (!project_id) { res.status(400).json({ error: 'project_id required' }); return; }
    const { rows } = await query(
      `${SELECT_WITH_STATS} WHERE m.project_id = $1 ORDER BY m.position ASC, m.id ASC`,
      [project_id]
    );
    res.json(rows);
  },

  POST: async (req, res) => {
    const user = requireRole(req, res, 'admin', 'manager');
    if (!user) return;
    const { project_id } = req.query;
    if (!project_id) { res.status(400).json({ error: 'project_id required' }); return; }
    const data = createSchema.parse(req.body);
    const { rows } = await query(
      `INSERT INTO milestones (project_id, name, description, start_date, end_date, position)
       SELECT $1, $2, $3, $4, $5, COALESCE(MAX(position), 0) + 1
       FROM milestones WHERE project_id = $1
       RETURNING *`,
      [project_id, data.name, data.description ?? null, data.start_date ?? null, data.end_date ?? null]
    );
    logActivity({
      actorId: user.id, entityType: 'milestone', entityId: rows[0].id,
      action: 'created', metadata: { project_id: Number(project_id) },
    });
    res.status(201).json(rows[0]);
  },

  PATCH: async (req, res) => {
    const user = requireRole(req, res, 'admin', 'manager');
    if (!user) return;
    const { id } = req.query;
    if (!id) { res.status(400).json({ error: 'id required' }); return; }
    const data = patchSchema.parse(req.body);
    const fields = Object.keys(data);
    if (!fields.length) { res.status(400).json({ error: 'no fields' }); return; }
    const set = fields.map((k, i) => `${k} = $${i + 1}`).join(', ');
    const values = fields.map(k => data[k]);
    values.push(id);
    const { rows } = await query(
      `UPDATE milestones SET ${set}, updated_at = NOW() WHERE id = $${values.length} RETURNING *`,
      values
    );
    if (!rows[0]) { res.status(404).json({ error: 'not found' }); return; }
    logActivity({
      actorId: user.id, entityType: 'milestone', entityId: rows[0].id,
      action: 'updated', metadata: data,
    });
    res.json(rows[0]);
  },

  DELETE: async (req, res) => {
    const user = requireRole(req, res, 'admin', 'manager');
    if (!user) return;
    const { id } = req.query;
    if (!id) { res.status(400).json({ error: 'id required' }); return; }
    const { rowCount } = await query('DELETE FROM milestones WHERE id = $1', [id]);
    if (!rowCount) { res.status(404).json({ error: 'not found' }); return; }
    logActivity({ actorId: user.id, entityType: 'milestone', entityId: Number(id), action: 'deleted' });
    res.status(204).end();
  },
});
