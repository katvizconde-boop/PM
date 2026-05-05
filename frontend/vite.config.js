import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// `vercel dev` (run from repo root) serves both the SPA and /api functions on
// one port, so no proxy config here. For pure-frontend `vite dev`, set
// VITE_API_BASE in .env to a deployed Vercel preview URL.
export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
});
