// End-to-end smoke test. Hits a running deployment (vercel dev OR a deployed URL).
//
// Usage:
//   API_URL=http://localhost:3000      node test/auth.e2e.mjs   # vercel dev
//   API_URL=https://pm.vercel.app      node test/auth.e2e.mjs   # prod
//
// Exits 0 on pass, 1 on fail. No external test runner needed.

import { strict as assert } from 'node:assert';

const API = process.env.API_URL || 'http://localhost:3000';

const stamp = Date.now();
const user = {
  email:    `e2e+${stamp}@example.com`,
  name:     `E2E ${stamp}`,
  password: 'password1234',
};

const checks = [];
const check = (name, fn) => checks.push({ name, fn });

async function http(method, path, { token, body } = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data; try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return { status: res.status, data };
}

let token, userId, projectId, taskId;

check('health endpoint responds 200', async () => {
  const { status, data } = await http('GET', '/api/health');
  assert.equal(status, 200);
  assert.deepEqual(data, { ok: true });
});

check('protected route rejects missing token (401)', async () => {
  const { status } = await http('GET', '/api/projects');
  assert.equal(status, 401);
});

check('protected route rejects bogus token (401)', async () => {
  const { status } = await http('GET', '/api/projects', { token: 'not.a.jwt' });
  assert.equal(status, 401);
});

check('register returns token + user', async () => {
  const { status, data } = await http('POST', '/api/auth/register', { body: user });
  assert.equal(status, 201, `expected 201, got ${status}: ${JSON.stringify(data)}`);
  assert.ok(data.token);
  assert.equal(data.user.email, user.email);
  token = data.token;
});

check('register rejects duplicate email (409)', async () => {
  const { status } = await http('POST', '/api/auth/register', { body: user });
  assert.equal(status, 409);
});

check('register validates short password (400)', async () => {
  const { status } = await http('POST', '/api/auth/register', {
    body: { email: `short+${stamp}@x.com`, name: 'x', password: 'short' },
  });
  assert.equal(status, 400);
});

check('login with correct password returns token', async () => {
  const { status, data } = await http('POST', '/api/auth/login', {
    body: { email: user.email, password: user.password },
  });
  assert.equal(status, 200);
  assert.ok(data.token);
  token = data.token;
});

check('login with wrong password returns 401', async () => {
  const { status } = await http('POST', '/api/auth/login', {
    body: { email: user.email, password: 'wrong-password' },
  });
  assert.equal(status, 401);
});

check('protected route accepts valid token', async () => {
  const { status, data } = await http('GET', '/api/projects', { token });
  assert.equal(status, 200);
  assert.ok(Array.isArray(data));
});

check('dashboard summary works with valid token', async () => {
  const { status, data } = await http('GET', '/api/dashboard/summary', { token });
  assert.equal(status, 200);
  assert.ok(typeof data.tasks.completion_rate === 'number');
});

check('first user is admin (so manager-only routes work)', async () => {
  const { status, data } = await http('GET', '/api/dashboard/users', { token });
  assert.equal(status, 200);
  const me = data.find(u => u.email === user.email);
  assert.ok(me);
  assert.equal(me.role, 'admin');
  userId = me.id;
});

check('create project (manager-gated)', async () => {
  const { status, data } = await http('POST', '/api/projects', {
    token,
    body: { name: `E2E Project ${stamp}`, owner_id: userId, status: 'in_progress' },
  });
  assert.equal(status, 201);
  projectId = data.id;
});

check('list projects includes the new one', async () => {
  const { status, data } = await http('GET', '/api/projects', { token });
  assert.equal(status, 200);
  assert.ok(data.some(p => p.id === projectId));
});

check('create task on the project', async () => {
  const { status, data } = await http('POST', '/api/tasks', {
    token,
    body: { project_id: projectId, title: 'E2E task', priority: 'high' },
  });
  assert.equal(status, 201);
  assert.equal(data.status, 'todo');
  taskId = data.id;
});

check('filter tasks by project_id', async () => {
  const { status, data } = await http('GET', `/api/tasks?project_id=${projectId}`, { token });
  assert.equal(status, 200);
  assert.ok(data.every(t => t.project_id === projectId));
  assert.ok(data.some(t => t.id === taskId));
});

check('PATCH task status (Kanban drag path)', async () => {
  const { status, data } = await http('PATCH', `/api/tasks/${taskId}`, {
    token, body: { status: 'in_progress' },
  });
  assert.equal(status, 200);
  assert.equal(data.status, 'in_progress');
});

check('status change is recorded in activity log', async () => {
  const { status, data } = await http('GET', `/api/activity?entity_type=task&entity_id=${taskId}`, { token });
  assert.equal(status, 200);
  const change = data.find(a => a.action === 'status_changed');
  assert.ok(change);
  assert.equal(change.metadata.from, 'todo');
  assert.equal(change.metadata.to,   'in_progress');
});

check('add a comment on the task', async () => {
  const { status, data } = await http('POST', `/api/comments/task/${taskId}`, {
    token, body: { body: 'E2E comment' },
  });
  assert.equal(status, 201);
  assert.equal(data.body, 'E2E comment');
});

check('list comments returns it with author_name', async () => {
  const { status, data } = await http('GET', `/api/comments/task/${taskId}`, { token });
  assert.equal(status, 200);
  assert.equal(data.length, 1);
  assert.equal(data[0].author_name, user.name);
});

check('non-admin cannot create a project', async () => {
  const member = { email: `member+${stamp}@example.com`, name: 'Member', password: 'password1234' };
  const reg = await http('POST', '/api/auth/register', { body: member });
  assert.equal(reg.status, 201);
  assert.equal(reg.data.user.role, 'member');
  const memberToken = reg.data.token;
  const { status } = await http('POST', '/api/projects', {
    token: memberToken,
    body: { name: 'unauthorized', owner_id: userId },
  });
  assert.equal(status, 403);
});

let failed = 0;
for (const { name, fn } of checks) {
  try { await fn(); console.log(`  ok  ${name}`); }
  catch (err) { failed++; console.error(`  FAIL ${name}\n       ${err.message}`); }
}
console.log(`\n${checks.length - failed}/${checks.length} passed`);
process.exit(failed ? 1 : 0);
