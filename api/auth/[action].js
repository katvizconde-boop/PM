import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { query } from '../../lib/db.js';
import { signToken } from '../../lib/auth.js';
import { methodHandler } from '../../lib/handler.js';

// One function file backing both /api/auth/login and /api/auth/register thanks
// to Vercel's file-based dynamic routing. The action is the URL segment, so the
// frontend's existing /api/auth/{login,register} calls keep working unchanged.
//
// Consolidating these two routes into one function file frees a slot under the
// 12-function Hobby cap, which we use for /api/milestones.

const registerSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(100),
  password: z.string().min(8).max(100),
  role: z.enum(['admin', 'manager', 'member']).optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

async function register(req, res) {
  const data = registerSchema.parse(req.body);
  const hash = await bcrypt.hash(data.password, 10);
  // First user becomes admin so the system is bootstrappable.
  const { rows: countRows } = await query('SELECT COUNT(*)::int AS c FROM users');
  const role = countRows[0].c === 0 ? 'admin' : (data.role ?? 'member');

  const { rows } = await query(
    `INSERT INTO users (email, name, password_hash, role)
     VALUES ($1, $2, $3, $4)
     RETURNING id, email, name, role`,
    [data.email, data.name, hash, role]
  );
  const user = rows[0];
  res.status(201).json({ token: signToken(user), user });
}

async function login(req, res) {
  const data = loginSchema.parse(req.body);
  const { rows } = await query(
    'SELECT id, email, name, role, password_hash, is_active FROM users WHERE email = $1',
    [data.email]
  );
  const user = rows[0];
  if (!user || !user.is_active) { res.status(401).json({ error: 'invalid credentials' }); return; }
  const ok = await bcrypt.compare(data.password, user.password_hash);
  if (!ok) { res.status(401).json({ error: 'invalid credentials' }); return; }
  delete user.password_hash;
  delete user.is_active;
  res.json({ token: signToken(user), user });
}

export default methodHandler({
  POST: async (req, res) => {
    if (req.query.action === 'register') return register(req, res);
    if (req.query.action === 'login')    return login(req, res);
    res.status(404).json({ error: 'unknown auth action' });
  },
});
