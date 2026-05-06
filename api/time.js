import { z } from 'zod';
import { query } from '../lib/db.js';
import { requireAuth } from '../lib/auth.js';
import { logActivity } from '../lib/activity.js';
import { methodHandler } from '../lib/handler.js';

// Time tracking. Single function file with method/query routing:
//
//   GET    /api/time?task_id=N       → all entries on a task (any auth)
//   GET    /api/time?running=1       → my currently-running entry, or null
//   POST   /api/time   {task_id}                              → start timer
//   POST   /api/time   {task_id, started_at, ended_at, note?} → log manual entry
//   PATCH  /api/time?id=N                                     → stop running timer
//   DELETE /api/time?id=N                                     → remove entry (own / admin)
//
// Invariant enforced by partial unique index: at most one running entry per user.
// On `start`, we auto-stop any existing running timer for the same user so the UX
// is "click to start, click another to switch".

const startSchema = z.object({
  task_id: z.number().int().positive(),
});
const manualSchema = z.object({
  task_id: z.number().int().positive(),
  started_at: z.string().datetime(),
  ended_at:   z.string().datetime(),
  note: z.string().max(500).optional().nullable(),
});

// Adds a virtual `duration_seconds` column to a time_entries row set.
// For running entries (ended_at IS NULL), counts up to NOW().
const SELECT_WITH_DURATION = `
  SELECT t.*,
         u.name AS user_name,
         EXTRACT(EPOCH FROM (COALESCE(t.ended_at, NOW()) - t.started_at))::int AS duration_seconds
  FROM time_entries t
  JOIN users u ON u.id = t.user_id
`;

export default methodHandler({
  GET: async (req, res) => {
    const user = requireAuth(req, res);
    if (!user) return;

    if (req.query.running) {
      const { rows } = await query(
        `${SELECT_WITH_DURATION} WHERE t.user_id = $1 AND t.ended_at IS NULL LIMIT 1`,
        [user.id]
      );
      res.json(rows[0] ?? null);
      return;
    }

    const { task_id } = req.query;
    if (!task_id) { res.status(400).json({ error: 'task_id or running=1 required' }); return; }
    const { rows } = await query(
      `${SELECT_WITH_DURATION} WHERE t.task_id = $1 ORDER BY t.started_at DESC`,
      [task_id]
    );
    res.json(rows);
  },

  POST: async (req, res) => {
    const user = requireAuth(req, res);
    if (!user) return;

    // Manual entry if both timestamps are present in the body; otherwise start a timer.
    if (req.body?.started_at && req.body?.ended_at) {
      const data = manualSchema.parse(req.body);
      if (new Date(data.ended_at) <= new Date(data.started_at)) {
        res.status(400).json({ error: 'ended_at must be after started_at' }); return;
      }
      const { rows } = await query(
        `INSERT INTO time_entries (task_id, user_id, started_at, ended_at, note)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [data.task_id, user.id, data.started_at, data.ended_at, data.note ?? null]
      );
      logActivity({
        actorId: user.id, entityType: 'time', entityId: rows[0].id,
        action: 'logged', metadata: { task_id: data.task_id, manual: true },
      });
      res.status(201).json(rows[0]);
      return;
    }

    const { task_id } = startSchema.parse(req.body ?? {});
    // Auto-stop any other running entry for this user — keeps the unique index happy
    // and matches the "one timer at a time" UX.
    await query(
      `UPDATE time_entries SET ended_at = NOW() WHERE user_id = $1 AND ended_at IS NULL`,
      [user.id]
    );
    const { rows } = await query(
      `INSERT INTO time_entries (task_id, user_id) VALUES ($1, $2) RETURNING *`,
      [task_id, user.id]
    );
    logActivity({
      actorId: user.id, entityType: 'time', entityId: rows[0].id,
      action: 'started', metadata: { task_id },
    });
    res.status(201).json(rows[0]);
  },

  PATCH: async (req, res) => {
    const user = requireAuth(req, res);
    if (!user) return;
    const { id } = req.query;
    if (!id) { res.status(400).json({ error: 'id required' }); return; }
    const { rows } = await query(
      `UPDATE time_entries
         SET ended_at = NOW()
       WHERE id = $1 AND user_id = $2 AND ended_at IS NULL
       RETURNING *`,
      [id, user.id]
    );
    if (!rows[0]) { res.status(404).json({ error: 'no running entry with that id' }); return; }
    logActivity({
      actorId: user.id, entityType: 'time', entityId: rows[0].id,
      action: 'stopped', metadata: { task_id: rows[0].task_id },
    });
    res.json(rows[0]);
  },

  DELETE: async (req, res) => {
    const user = requireAuth(req, res);
    if (!user) return;
    const { id } = req.query;
    if (!id) { res.status(400).json({ error: 'id required' }); return; }
    // Author or admin can delete.
    const { rows } = await query('SELECT user_id FROM time_entries WHERE id = $1', [id]);
    if (!rows[0]) { res.status(404).json({ error: 'not found' }); return; }
    if (rows[0].user_id !== user.id && user.role !== 'admin') {
      res.status(403).json({ error: 'forbidden' }); return;
    }
    await query('DELETE FROM time_entries WHERE id = $1', [id]);
    res.status(204).end();
  },
});
