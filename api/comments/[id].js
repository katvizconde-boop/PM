import { query } from '../../lib/db.js';
import { requireAuth } from '../../lib/auth.js';
import { methodHandler } from '../../lib/handler.js';

export default methodHandler({
  DELETE: async (req, res) => {
    const user = requireAuth(req, res);
    if (!user) return;
    // Author or admin can delete.
    const { rows } = await query('SELECT author_id FROM comments WHERE id = $1', [req.query.id]);
    if (!rows[0]) { res.status(404).json({ error: 'not found' }); return; }
    if (rows[0].author_id !== user.id && user.role !== 'admin') {
      res.status(403).json({ error: 'forbidden' });
      return;
    }
    await query('DELETE FROM comments WHERE id = $1', [req.query.id]);
    res.status(204).end();
  },
});
