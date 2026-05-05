import { Router } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { query } from '../db.js';

const router = Router();

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

function signToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role, name: user.name },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
}

router.post('/register', async (req, res, next) => {
  try {
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
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'email already in use' });
    next(err);
  }
});

router.post('/login', async (req, res, next) => {
  try {
    const data = loginSchema.parse(req.body);
    const { rows } = await query(
      'SELECT id, email, name, role, password_hash, is_active FROM users WHERE email = $1',
      [data.email]
    );
    const user = rows[0];
    if (!user || !user.is_active) return res.status(401).json({ error: 'invalid credentials' });
    const ok = await bcrypt.compare(data.password, user.password_hash);
    if (!ok) return res.status(401).json({ error: 'invalid credentials' });
    delete user.password_hash;
    delete user.is_active;
    res.json({ token: signToken(user), user });
  } catch (err) {
    next(err);
  }
});

router.get('/me', async (req, res) => {
  // /me works only when authRequired is mounted upstream
  res.json({ user: req.user });
});

export default router;
