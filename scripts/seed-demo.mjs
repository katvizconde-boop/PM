// Idempotent demo seed: 3 users (one per role) + 1 sample project with checklist
// items, tasks, and a comment. Safe to re-run — uses ON CONFLICT DO NOTHING and
// existence checks throughout, so it won't duplicate anything or stomp existing data.
//
// Usage:
//   DATABASE_URL=postgres://... node scripts/seed-demo.mjs
//
// Demo credentials (intentionally simple — DO NOT enable demo accounts on a
// non-internal deploy):
//   csm@demo.com             / demo12345   → Client Success Manager (admin)
//   analyst-manager@demo.com / demo12345   → Analyst Manager (manager)
//   analyst@demo.com         / demo12345   → Analyst (member)

import { Pool, neonConfig } from '@neondatabase/serverless';
import bcrypt from 'bcryptjs';
import ws from 'ws';

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL not set'); process.exit(1);
}
neonConfig.webSocketConstructor = ws;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const DEMO_USERS = [
  { email: 'csm@demo.com',             name: 'Demo CSM',             role: 'admin'   },
  { email: 'analyst-manager@demo.com', name: 'Demo Analyst Manager', role: 'manager' },
  { email: 'analyst@demo.com',         name: 'Demo Analyst',         role: 'member'  },
];
const DEMO_PASSWORD = 'demo12345';

async function upsertUser({ email, name, role }, hash) {
  // Insert if missing; if email already exists, fetch the existing row's id.
  const { rows } = await pool.query(
    `INSERT INTO users (email, name, password_hash, role)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (email) DO UPDATE
       SET name = EXCLUDED.name, role = EXCLUDED.role, password_hash = EXCLUDED.password_hash
     RETURNING id, email, role, (xmax = 0) AS inserted`,
    [email, name, hash, role]
  );
  const row = rows[0];
  console.log(`  ${row.inserted ? '+' : '~'} ${row.email.padEnd(28)} ${row.role}`);
  return row.id;
}

async function ensureProject(name, ownerId) {
  const { rows: existing } = await pool.query(
    'SELECT id FROM projects WHERE name = $1', [name]
  );
  if (existing[0]) {
    console.log(`  ~ project "${name}" already exists (#${existing[0].id})`);
    return existing[0].id;
  }
  const { rows } = await pool.query(
    `INSERT INTO projects (name, description, owner_id, status, deadline)
     VALUES ($1, $2, $3, 'in_progress', CURRENT_DATE + INTERVAL '21 days')
     RETURNING id`,
    [name, 'Sample project seeded for demo accounts. Safe to delete or modify.', ownerId]
  );
  console.log(`  + project "${name}" created (#${rows[0].id})`);
  return rows[0].id;
}

async function ensureChecklist(projectId, items) {
  const { rows: existing } = await pool.query(
    'SELECT COUNT(*)::int AS c FROM checklist_items WHERE project_id = $1', [projectId]
  );
  if (existing[0].c > 0) {
    console.log(`  ~ checklist already populated (${existing[0].c} items)`);
    return;
  }
  for (let i = 0; i < items.length; i++) {
    await pool.query(
      'INSERT INTO checklist_items (project_id, position, text) VALUES ($1, $2, $3)',
      [projectId, i + 1, items[i]]
    );
  }
  console.log(`  + ${items.length} checklist items added`);
}

async function ensureTasks(projectId, assigneeId, createdBy, tasks) {
  const { rows: existing } = await pool.query(
    'SELECT id FROM tasks WHERE project_id = $1 ORDER BY id', [projectId]
  );
  if (existing.length > 0) {
    console.log(`  ~ tasks already populated (${existing.length} items)`);
    return existing.map(r => r.id);
  }
  const ids = [];
  for (const t of tasks) {
    const { rows } = await pool.query(
      `INSERT INTO tasks (project_id, title, description, assignee_id, status, priority, due_date, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
      [projectId, t.title, t.description ?? null, assigneeId, t.status, t.priority, t.due_date, createdBy]
    );
    ids.push(rows[0].id);
  }
  console.log(`  + ${tasks.length} tasks added`);
  return ids;
}

async function ensureComment(taskId, authorId, body) {
  const { rows: existing } = await pool.query(
    'SELECT COUNT(*)::int AS c FROM comments WHERE task_id = $1', [taskId]
  );
  if (existing[0].c > 0) return;
  await pool.query(
    'INSERT INTO comments (task_id, author_id, body) VALUES ($1, $2, $3)',
    [taskId, authorId, body]
  );
  console.log(`  + sample comment added on task #${taskId}`);
}

async function ensureMilestones(projectId, milestones) {
  const { rows: existing } = await pool.query(
    'SELECT COUNT(*)::int AS c FROM milestones WHERE project_id = $1', [projectId]
  );
  if (existing[0].c > 0) {
    console.log(`  ~ milestones already populated (${existing[0].c})`);
    const { rows } = await pool.query(
      'SELECT id, name FROM milestones WHERE project_id = $1 ORDER BY position', [projectId]
    );
    return rows;
  }
  const out = [];
  for (let i = 0; i < milestones.length; i++) {
    const m = milestones[i];
    const { rows } = await pool.query(
      `INSERT INTO milestones (project_id, name, description, start_date, end_date, status, position)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, name`,
      [projectId, m.name, m.description ?? null, m.start_date, m.end_date, m.status ?? 'active', i + 1]
    );
    out.push(rows[0]);
  }
  console.log(`  + ${milestones.length} milestones added`);
  return out;
}

async function ensureTimeEntries(taskId, userId, segments) {
  // Idempotent at the task level: skip if any entry exists on this task.
  // segments: array of [hoursAgo, durationMinutes].
  const { rows: existing } = await pool.query(
    'SELECT COUNT(*)::int AS c FROM time_entries WHERE task_id = $1', [taskId]
  );
  if (existing[0].c > 0) return;
  for (const [hoursAgo, durationMinutes] of segments) {
    await pool.query(
      `INSERT INTO time_entries (task_id, user_id, started_at, ended_at)
       VALUES ($1, $2, NOW() - ($3 || ' hours')::interval,
                       NOW() - ($3 || ' hours')::interval + ($4 || ' minutes')::interval)`,
      [taskId, userId, hoursAgo, durationMinutes]
    );
  }
  console.log(`  + ${segments.length} time entries on task #${taskId}`);
}

async function main() {
  const hash = await bcrypt.hash(DEMO_PASSWORD, 10);
  console.log('Seeding demo users:');
  const ids = {};
  for (const u of DEMO_USERS) ids[u.role] = await upsertUser(u, hash);

  console.log('\nSeeding demo project:');
  const projectId = await ensureProject('Q3 Onboarding Sprint', ids.admin);

  await ensureChecklist(projectId, [
    'Kickoff meeting with client',
    'Gather data sources',
    'Draft initial analysis',
    'Internal QA review',
    'Deliver final report',
  ]);

  const today = new Date();
  const fmt = (d) => d.toISOString().slice(0, 10);
  const taskIds = await ensureTasks(projectId, ids.member, ids.manager, [
    { title: 'Pull last-quarter benchmarks', status: 'done',        priority: 'medium', due_date: fmt(new Date(today.getTime() - 3*864e5)) },
    { title: 'Build dashboard scaffold',     status: 'in_progress', priority: 'high',   due_date: fmt(new Date(today.getTime() + 2*864e5)) },
    { title: 'Write executive summary',      status: 'todo',        priority: 'high',   due_date: fmt(new Date(today.getTime() + 5*864e5)) },
    { title: 'Schedule client review call',  status: 'todo',        priority: 'low',    due_date: fmt(new Date(today.getTime() + 7*864e5)) },
  ]);

  if (taskIds[1]) {
    await ensureComment(taskIds[1], ids.manager, 'Aim for the v1 layout by Thursday — keep it minimal.');
  }

  // Milestones spanning a 4-week project arc.
  const day = (offset) => fmt(new Date(today.getTime() + offset * 864e5));
  const ms = await ensureMilestones(projectId, [
    { name: 'Discovery',  description: 'Stakeholder interviews + scope sign-off',  start_date: day(-14), end_date: day(-5),  status: 'completed' },
    { name: 'Build',      description: 'Implementation + internal QA',             start_date: day(-4),  end_date: day(7),   status: 'active' },
    { name: 'Client review', description: 'Walkthroughs + revisions',              start_date: day(8),   end_date: day(14),  status: 'active' },
    { name: 'Handoff',    description: 'Documentation + final delivery',           start_date: day(15),  end_date: day(21),  status: 'active' },
  ]);
  // Link the seeded tasks to milestones so the Dashboard shows non-empty progress.
  if (taskIds.length && ms.length >= 2) {
    await pool.query('UPDATE tasks SET milestone_id = $1 WHERE id = $2', [ms[0].id, taskIds[0]]); // benchmarks → Discovery
    await pool.query('UPDATE tasks SET milestone_id = $1 WHERE id = ANY($2)',  [ms[1].id, taskIds.slice(1, 3)]); // dashboard, summary → Build
    if (taskIds[3]) {
      await pool.query('UPDATE tasks SET milestone_id = $1 WHERE id = $2', [ms[2].id, taskIds[3]]); // schedule call → Client review
    }
    console.log(`  + linked tasks to milestones`);
  }

  // Sample time on the first two tasks so logging-in users see non-zero totals.
  if (taskIds[0]) await ensureTimeEntries(taskIds[0], ids.member, [[26, 95], [4, 45]]);
  if (taskIds[1]) await ensureTimeEntries(taskIds[1], ids.member, [[3, 120]]);

  console.log('\nDone. Login with:');
  console.log(`  csm@demo.com             / ${DEMO_PASSWORD}   (Client Success Manager)`);
  console.log(`  analyst-manager@demo.com / ${DEMO_PASSWORD}   (Analyst Manager)`);
  console.log(`  analyst@demo.com         / ${DEMO_PASSWORD}   (Analyst)`);
}

try { await main(); } finally { await pool.end(); }
