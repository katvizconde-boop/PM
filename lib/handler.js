import { ZodError } from 'zod';

// Wraps a route handler with consistent JSON error handling.
// - Zod validation -> 400 with details
// - Postgres unique violation -> 409
// - Anything else -> 500
//
// `dispatch` is `{ GET: fn, POST: fn, ... }` — we 405 unmatched methods.
export function methodHandler(dispatch) {
  return async (req, res) => {
    const fn = dispatch[req.method];
    if (!fn) { res.status(405).json({ error: 'method not allowed' }); return; }
    try {
      await fn(req, res);
    } catch (err) {
      if (err instanceof ZodError) {
        res.status(400).json({ error: 'validation', details: err.flatten() });
      } else if (err?.code === '23505') {
        res.status(409).json({ error: 'conflict' });
      } else {
        console.error(err);
        res.status(500).json({ error: 'internal' });
      }
    }
  };
}
