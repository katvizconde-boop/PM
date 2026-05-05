import { query } from '../../lib/db.js';
import { requireAuth } from '../../lib/auth.js';
import { methodHandler } from '../../lib/handler.js';

export default methodHandler({
  GET: async (req, res) => {
    if (!requireAuth(req, res)) return;
    const [projects, tasksByStatus, overdue, byPriority] = await Promise.all([
      query(`SELECT COUNT(*)::int AS total,
                    SUM((status='in_progress')::int)::int AS in_progress,
                    SUM((status='done')::int)::int        AS done
             FROM projects`),
      query(`SELECT status, COUNT(*)::int AS count FROM tasks GROUP BY status`),
      query(`SELECT COUNT(*)::int AS overdue FROM tasks
             WHERE due_date < CURRENT_DATE AND status <> 'done'`),
      query(`SELECT priority, COUNT(*)::int AS count FROM tasks
             WHERE status <> 'done' GROUP BY priority`),
    ]);

    const taskStatus = { todo: 0, in_progress: 0, done: 0 };
    for (const row of tasksByStatus.rows) taskStatus[row.status] = row.count;
    const total = taskStatus.todo + taskStatus.in_progress + taskStatus.done;
    const completionRate = total ? Math.round((taskStatus.done / total) * 100) : 0;

    res.json({
      projects: projects.rows[0],
      tasks: { ...taskStatus, total, completion_rate: completionRate },
      overdue: overdue.rows[0].overdue,
      by_priority: byPriority.rows,
    });
  },
});
