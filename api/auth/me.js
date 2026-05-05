import { requireAuth } from '../../lib/auth.js';
import { methodHandler } from '../../lib/handler.js';

export default methodHandler({
  GET: async (req, res) => {
    const user = requireAuth(req, res);
    if (!user) return;
    res.json({ user });
  },
});
