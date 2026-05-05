import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { query } from '../../lib/db.js';
import { signToken } from '../../lib/auth.js';
import { methodHandler } from '../../lib/handler.js';

const schema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(100),
  password: z.string().min(8).max(100),
  role: z.enum(['admin', 'manager', 'member']).optional(),
});

export default methodHandler({
  POST: async (req, res) => {
    const data = schema.parse(req.body);
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
  },
});
