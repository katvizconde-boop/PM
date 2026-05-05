import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import 'dotenv/config';
import { ZodError } from 'zod';

import { pool } from './db.js';
import { authRequired } from './middleware/auth.js';
import authRoutes from './routes/auth.js';
import projectRoutes from './routes/projects.js';
import taskRoutes from './routes/tasks.js';
import commentRoutes from './routes/comments.js';
import activityRoutes from './routes/activity.js';
import dashboardRoutes from './routes/dashboard.js';

const isProd = process.env.NODE_ENV === 'production';

const app = express();

// Behind a load balancer (Fly, Render, ALB, nginx) so req.ip / secure cookies work.
app.set('trust proxy', 1);

app.use(helmet());
app.use(compression());

// In prod, require an explicit allowlist. In dev, * is fine.
if (isProd) {
  const origins = (process.env.CORS_ORIGIN ?? '').split(',').map(s => s.trim()).filter(Boolean);
  if (!origins.length) throw new Error('CORS_ORIGIN must be set in production');
  app.use(cors({ origin: origins }));
} else {
  app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
}

app.use(express.json({ limit: '1mb' }));

app.get('/health', (_, res) => res.json({ ok: true }));

app.use('/api/auth', authRoutes);

app.use('/api', authRequired);
app.use('/api/projects',  projectRoutes);
app.use('/api/tasks',     taskRoutes);
app.use('/api/comments',  commentRoutes);
app.use('/api/activity',  activityRoutes);
app.use('/api/dashboard', dashboardRoutes);

app.use((err, _req, res, _next) => {
  if (err instanceof ZodError) {
    return res.status(400).json({ error: 'validation', details: err.flatten() });
  }
  console.error(err);
  res.status(500).json({ error: 'internal' });
});

const port = process.env.PORT || 4000;
const server = app.listen(port, () => console.log(`API listening on :${port}`));

// Graceful shutdown: stop accepting new connections, drain in-flight, close pool.
// Hosts (Fly, Render, k8s) send SIGTERM with a grace window before SIGKILL.
const shutdown = async (signal) => {
  console.log(`${signal} received, shutting down`);
  server.close(async () => {
    try { await pool.end(); } catch (e) { console.error('pool close failed', e); }
    process.exit(0);
  });
  // Hard cap so we never exceed the platform's grace window.
  setTimeout(() => process.exit(1), 10_000).unref();
};
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));
