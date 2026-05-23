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

// Realistic-feeling demo team. All same password.
// Two CSMs (admin), three Analyst Managers (manager), four Analysts (member).
// Enough variety that the Workload view, AvatarStacks, and All Tasks page all
// have non-trivial content to show on first login.
const DEMO_USERS = [
  // Client Success Managers (admin)
  { email: 'csm@demo.com',             name: 'Demo CSM',         role: 'admin'   },
  { email: 'cs.lead@demo.com',         name: 'Maya Chen',        role: 'admin'   },
  // Analyst Managers
  { email: 'analyst-manager@demo.com', name: 'Demo Manager',     role: 'manager' },
  { email: 'ops.manager@demo.com',     name: 'Diego Santos',     role: 'manager' },
  { email: 'hr.lead@demo.com',         name: 'Priya Patel',      role: 'manager' },
  // Analysts
  { email: 'analyst@demo.com',         name: 'Demo Analyst',     role: 'member'  },
  { email: 'analyst.alex@demo.com',    name: 'Alex Park',        role: 'member'  },
  { email: 'analyst.maria@demo.com',   name: 'Maria Lopez',      role: 'member'  },
  { email: 'analyst.sam@demo.com',     name: 'Sam Nguyen',       role: 'member'  },
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

async function ensureCoAssignees(taskId, userIds) {
  // task_assignees uses (task_id, user_id) PK → upsert via ON CONFLICT DO NOTHING.
  for (const uid of userIds) {
    await pool.query(
      `INSERT INTO task_assignees (task_id, user_id) VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [taskId, uid]
    );
  }
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
  // Key users by email so each project can pick its own owner/manager/analysts.
  const u = {};
  for (const user of DEMO_USERS) u[user.email] = await upsertUser(user, hash);

  const today = new Date();
  const fmt = (d) => d.toISOString().slice(0, 10);
  const day = (offset) => fmt(new Date(today.getTime() + offset * 864e5));

  // ── Project 1: Q3 Onboarding Sprint (existing) ──────────────────────────────
  console.log('\nSeeding project: Q3 Onboarding Sprint');
  const p1 = await ensureProject('Q3 Onboarding Sprint', u['csm@demo.com']);

  await ensureChecklist(p1, [
    'Kickoff meeting with client',
    'Gather data sources',
    'Draft initial analysis',
    'Internal QA review',
    'Deliver final report',
  ]);

  const p1Tasks = await ensureTasks(p1, u['analyst@demo.com'], u['analyst-manager@demo.com'], [
    { title: 'Pull last-quarter benchmarks', status: 'done',        priority: 'medium', due_date: day(-3) },
    { title: 'Build dashboard scaffold',     status: 'in_progress', priority: 'high',   due_date: day(+2) },
    { title: 'Write executive summary',      status: 'todo',        priority: 'high',   due_date: day(+5) },
    { title: 'Schedule client review call',  status: 'todo',        priority: 'low',    due_date: day(+7) },
  ]);

  if (p1Tasks[1]) await ensureComment(p1Tasks[1], u['analyst-manager@demo.com'], 'Aim for the v1 layout by Thursday — keep it minimal.');

  const p1Ms = await ensureMilestones(p1, [
    { name: 'Discovery',     description: 'Stakeholder interviews + scope sign-off', start_date: day(-14), end_date: day(-5),  status: 'completed' },
    { name: 'Build',         description: 'Implementation + internal QA',           start_date: day(-4),  end_date: day(+7),  status: 'active' },
    { name: 'Client review', description: 'Walkthroughs + revisions',                start_date: day(+8),  end_date: day(+14), status: 'active' },
    { name: 'Handoff',       description: 'Documentation + final delivery',          start_date: day(+15), end_date: day(+21), status: 'active' },
  ]);
  if (p1Tasks.length && p1Ms.length >= 2) {
    await pool.query('UPDATE tasks SET milestone_id = $1 WHERE id = $2',          [p1Ms[0].id, p1Tasks[0]]);
    await pool.query('UPDATE tasks SET milestone_id = $1 WHERE id = ANY($2)',     [p1Ms[1].id, p1Tasks.slice(1, 3)]);
    if (p1Tasks[3]) await pool.query('UPDATE tasks SET milestone_id = $1 WHERE id = $2', [p1Ms[2].id, p1Tasks[3]]);
  }
  if (p1Tasks[0]) await ensureTimeEntries(p1Tasks[0], u['analyst@demo.com'], [[26, 95], [4, 45]]);
  if (p1Tasks[1]) await ensureTimeEntries(p1Tasks[1], u['analyst@demo.com'], [[3, 120]]);
  // Co-assignee: dashboard scaffold gets Alex as a collaborator
  if (p1Tasks[1]) await ensureCoAssignees(p1Tasks[1], [u['analyst.alex@demo.com']]);

  // ── Project 2: Internal Process Audit ──────────────────────────────────────
  console.log('\nSeeding project: Internal Process Audit');
  const p2 = await ensureProject('Internal Process Audit', u['cs.lead@demo.com']);
  await ensureChecklist(p2, [
    'Define audit scope',
    'Pull workflow data from last 6 months',
    'Interview team leads',
    'Identify bottlenecks',
    'Draft recommendations',
    'Present findings',
  ]);
  const p2Tasks = await ensureTasks(p2, u['analyst.maria@demo.com'], u['ops.manager@demo.com'], [
    { title: 'Audit scope document',        status: 'done',        priority: 'high',   due_date: day(-10) },
    { title: 'Workflow data extraction',    status: 'in_progress', priority: 'high',   due_date: day(+1)  },
    { title: 'Team lead interviews',        status: 'in_progress', priority: 'medium', due_date: day(+6)  },
    { title: 'Bottleneck analysis report',  status: 'todo',        priority: 'urgent', due_date: day(+10) },
    { title: 'Recommendations deck',        status: 'todo',        priority: 'high',   due_date: day(+18) },
  ]);
  if (p2Tasks[1]) await ensureComment(p2Tasks[1], u['ops.manager@demo.com'], 'Need this by EOW so we can hand it to the analysis pod.');
  if (p2Tasks[3]) await ensureComment(p2Tasks[3], u['cs.lead@demo.com'],     'Please escalate any single-point-of-failure findings up to me directly.');

  const p2Ms = await ensureMilestones(p2, [
    { name: 'Scoping',  description: 'Goals + access set up',            start_date: day(-14), end_date: day(-7),  status: 'completed' },
    { name: 'Research', description: 'Data + interviews',                 start_date: day(-6),  end_date: day(+8),  status: 'active' },
    { name: 'Analysis', description: 'Synthesis + recommendations deck',  start_date: day(+9),  end_date: day(+20), status: 'active' },
  ]);
  if (p2Tasks.length && p2Ms.length >= 2) {
    await pool.query('UPDATE tasks SET milestone_id = $1 WHERE id = $2',      [p2Ms[0].id, p2Tasks[0]]);
    await pool.query('UPDATE tasks SET milestone_id = $1 WHERE id = ANY($2)', [p2Ms[1].id, p2Tasks.slice(1, 3)]);
    await pool.query('UPDATE tasks SET milestone_id = $1 WHERE id = ANY($2)', [p2Ms[2].id, p2Tasks.slice(3, 5)]);
  }
  if (p2Tasks[1]) await ensureTimeEntries(p2Tasks[1], u['analyst.maria@demo.com'], [[20, 180], [5, 90]]);
  if (p2Tasks[2]) await ensureTimeEntries(p2Tasks[2], u['analyst.sam@demo.com'],   [[24, 60], [2, 75]]);
  // Co-assignees so Workload counts both primary + collaborator load
  if (p2Tasks[2]) await ensureCoAssignees(p2Tasks[2], [u['analyst.sam@demo.com'], u['analyst.alex@demo.com']]);
  if (p2Tasks[3]) await ensureCoAssignees(p2Tasks[3], [u['analyst.sam@demo.com']]);

  // ── Project 3: Q4 Recruitment Drive ────────────────────────────────────────
  console.log('\nSeeding project: Q4 Recruitment Drive');
  const p3 = await ensureProject('Q4 Recruitment Drive', u['hr.lead@demo.com']);
  await ensureChecklist(p3, [
    'Finalise role briefs',
    'Open positions on careers page',
    'Source candidates',
    'First-round interviews',
    'Make offers',
  ]);
  const p3Tasks = await ensureTasks(p3, u['analyst.alex@demo.com'], u['hr.lead@demo.com'], [
    { title: 'Draft 4 role descriptions',     status: 'done',        priority: 'medium', due_date: day(-8)  },
    { title: 'Publish openings on LinkedIn',  status: 'done',        priority: 'medium', due_date: day(-4)  },
    { title: 'Screen incoming applications',  status: 'in_progress', priority: 'high',   due_date: day(+3)  },
    { title: 'Schedule first-round interviews', status: 'todo',      priority: 'high',   due_date: day(+8)  },
    { title: 'Coordinate panel availability', status: 'todo',        priority: 'medium', due_date: day(+12) },
  ]);
  if (p3Tasks[2]) await ensureComment(p3Tasks[2], u['hr.lead@demo.com'], 'Filter aggressively on the data-analysis seniority bar — we have plenty of pipeline.');

  const p3Ms = await ensureMilestones(p3, [
    { name: 'Sourcing',  description: 'Roles live + candidates flowing',  start_date: day(-10), end_date: day(+5),  status: 'active' },
    { name: 'Interviews',description: 'Screening + first round',          start_date: day(+6),  end_date: day(+18), status: 'active' },
  ]);
  if (p3Tasks.length && p3Ms.length >= 1) {
    await pool.query('UPDATE tasks SET milestone_id = $1 WHERE id = ANY($2)', [p3Ms[0].id, p3Tasks.slice(0, 3)]);
    await pool.query('UPDATE tasks SET milestone_id = $1 WHERE id = ANY($2)', [p3Ms[1].id, p3Tasks.slice(3, 5)]);
  }
  if (p3Tasks[2]) await ensureTimeEntries(p3Tasks[2], u['analyst.alex@demo.com'],  [[18, 105], [3, 60]]);
  if (p3Tasks[2]) await ensureCoAssignees(p3Tasks[2], [u['analyst.maria@demo.com']]);
  if (p3Tasks[3]) await ensureCoAssignees(p3Tasks[3], [u['analyst@demo.com']]);

  console.log('\nDone. Login with any of these — all use password "demo12345":\n');
  console.log('  Client Success Managers (admin):');
  console.log('    csm@demo.com             — Demo CSM');
  console.log('    cs.lead@demo.com         — Maya Chen');
  console.log('\n  Analyst Managers (manager):');
  console.log('    analyst-manager@demo.com — Demo Manager');
  console.log('    ops.manager@demo.com     — Diego Santos');
  console.log('    hr.lead@demo.com         — Priya Patel');
  console.log('\n  Analysts (member):');
  console.log('    analyst@demo.com         — Demo Analyst');
  console.log('    analyst.alex@demo.com    — Alex Park');
  console.log('    analyst.maria@demo.com   — Maria Lopez');
  console.log('    analyst.sam@demo.com     — Sam Nguyen');
}

try { await main(); } finally { await pool.end(); }
