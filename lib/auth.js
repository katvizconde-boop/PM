import jwt from 'jsonwebtoken';

// Verify the request's JWT and attach the user payload. Returns null on bad/missing token.
// Caller is expected to short-circuit with 401 when null.
export function getUser(req) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return null;
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return null;
  }
}

export function requireAuth(req, res) {
  const user = getUser(req);
  if (!user) { res.status(401).json({ error: 'unauthenticated' }); return null; }
  return user;
}

export function requireRole(req, res, ...roles) {
  const user = requireAuth(req, res);
  if (!user) return null;
  if (!roles.includes(user.role)) { res.status(403).json({ error: 'forbidden' }); return null; }
  return user;
}

export function signToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role, name: user.name },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
}
