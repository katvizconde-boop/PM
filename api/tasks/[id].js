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
  parent_task_id: z.number().int().positive().nullable(),
  tags: z.array(z.string().min(1).max(40)).max(20),
  // M2M: each replaces the entire set on save (idempotent semantics).
  co_assignee_ids:  z.array(z.number().int().positive()).max(20),
  blocked_by_ids:   z.array(z.number().int().positive()).max(50),
  blocks_ids:       z.array(z.number().int().positive()).max(50),
}).partial();

// Direct task columns (not the join-table fields). Used to know which keys go
// into the UPDATE statement vs which trigger join-table syncs.
const SCALAR_FIELDS = new Set([
  'title', 'description', 'assignee_id', 'status', 'priority',
  'due_date', 'parent_task_id', 'tags',
]);

const TASK_SELECT = `
  SELECT t.*,
         u.name AS assignee_name,
         p.name AS project_name,
         (SELECT COUNT(*)::int FROM comments c WHERE c.task_id = t.id) AS comments_count,
         COALESCE((
           SELECT json_agg(json_build_object('id', u2.id, 'name', u2.name) ORDER BY u2.name)
           FROM task_assignees ta JOIN users u2 ON u2.id = ta.user_id
           WHERE ta.task_id = t.id
         ), '[]'::json) AS co_assignees,
         COALESCE((
           SELECT json_agg(json_build_object('id', t2.id, 'title', t2.title, 'status', t2.status))
           FROM task_dependencies d JOIN tasks t2 ON t2.id = d.blocking_task_id
           WHERE d.blocked_task_id = t.id
         ), '[]'::json) AS blocked_by,
         COALESCE((
           SELECT json_agg(json_build_object('id', t2.id, 'title', t2.title, 'status', t2.status))
           FROM task_dependencies d JOIN tasks t2 ON t2.id = d.blocking_task_id
           WHERE d.blocking_task_id = t.id
         ), '[]'::json) AS blocks
  FROM tasks t
  LEFT JOIN users u ON u.id = t.assignee_id
  JOIN projects p ON p.id = t.project_id
`;

async function syncSet(table, taskCol, peerCol, taskId, peerIds) {
  // Replace-set semantics: delete current, insert new. Cheap at our scale.
  await query(`DELETE FROM ${table} WHERE ${taskCol} = $1`, [taskId]);
  if (peerIds.length === 0) return;
  // Filter self-references for dependency tables.
  const peers = peerIds.filter(pid => pid !== Number(taskId));
  if (peers.length === 0) return;
  const placeholders = peers.map((_, i) => `($1, $${i + 2})`).join(', ');
  await query(
    `INSERT INTO ${table} (${taskCol}, ${peerCol}) VALUES ${placeholders}
     ON CONFLICT DO NOTHING`,
    [taskId, ...peers]
  );
}

export default methodHandler({
  GET: async (req, res) => {
    if (!requireAuth(req, res)) return;
    const { rows } = await query(`${TASK_SELECT} WHERE t.id = $1`, [req.query.id]);
    if (!rows[0]) { res.status(404).json({ error: 'not found' }); return; }
    res.json(rows[0]);
  },

  PATCH: async (req, res) => {
    const user = requireAuth(req, res);
    if (!user) return;
    const data = patchSchema.parse(req.body);
    const taskId = req.query.id;

    // Pre-state for status_changed audit.
    const before = (await query('SELECT status FROM tasks WHERE id = $1', [taskId])).rows[0];
    if (!before) { res.status(404).json({ error: 'not found' }); return; }

    // Apply scalar field updates if any are present.
    const scalarKeys = Object.keys(data).filter(k => SCALAR_FIELDS.has(k));
    if (scalarKeys.length) {
      const set = scalarKeys.map((k, i) => `${k} = $${i + 1}`).join(', ');
      const values = scalarKeys.map(k => data[k]);
      values.push(taskId);
      await query(
        `UPDATE tasks SET ${set}, updated_at = NOW() WHERE id = $${values.length}`,
        values
      );
    }

    // Sync the M2M relations whose keys appeared in the body.
    if (data.co_assignee_ids !== undefined) {
      await syncSet('task_assignees', 'task_id', 'user_id', taskId, data.co_assignee_ids);
    }
    if (data.blocked_by_ids !== undefined) {
      // This task is blocked by (blocking_task_id ∈ ids), where blocked_task_id = taskId.
      await syncSet('task_dependencies', 'blocked_task_id', 'blocking_task_id', taskId, data.blocked_by_ids);
    }
    if (data.blocks_ids !== undefined) {
      await syncSet('task_dependencies', 'blocking_task_id', 'blocked_task_id', taskId, data.blocks_ids);
    }

    // Re-fetch with full join data to return.
    const { rows } = await query(`${TASK_SELECT} WHERE t.id = $1`, [taskId]);

    const action   = data.status && data.status !== before.status ? 'status_changed' : 'updated';
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
