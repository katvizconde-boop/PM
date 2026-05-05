import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { query } from '../../lib/db.js';
import { signToken } from '../../lib/auth.js';
import { methodHandler } from '../../lib/handler.js';

const schema = z.object({ email: z.string().email(), password: z.string() });

export default methodHandler({
  POST: async (req, res) => {
    const data = schema.parse(req.body);
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
  },
});
