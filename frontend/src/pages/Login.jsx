import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';

// One-click demo logins under the form. Visitors get a working sign-in for
// every role without having to type credentials. Keep this in sync with the
// seed (scripts/seed-demo.mjs) if you ever change demo emails or password.
const DEMO_PASSWORD = 'demo12345';
const DEMO_LOGINS = [
  { label: 'CSM',     email: 'csm@demo.com',             role: 'Client Success Manager' },
  { label: 'Manager', email: 'analyst-manager@demo.com', role: 'Analyst Manager' },
  { label: 'Analyst', email: 'analyst@demo.com',         role: 'Analyst' },
];

export default function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [err, setErr]   = useState(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setErr(null);
    try { await login(form.email, form.password); nav('/'); }
    catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  };

  const loginAs = async (email) => {
    setBusy(true); setErr(null);
    try { await login(email, DEMO_PASSWORD); nav('/'); }
    catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <form onSubmit={submit} className="card p-6 w-full max-w-sm space-y-4">
        <h1 className="text-xl font-semibold">Sign in to TaskPilot</h1>
        {err && <div className="text-sm text-red-600">{err}</div>}
        <input className="input" type="email" placeholder="Email" required
               value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
        <input className="input" type="password" placeholder="Password" required minLength={8}
               value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
        <button className="btn-primary w-full" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
        <p className="text-sm text-slate-500">No account? <Link to="/register" className="text-indigo-600">Register</Link></p>

        {/* Demo logins — visible on the public sign-in page so visitors can try every role */}
        <div className="border-t border-slate-200 pt-4 mt-4 text-center space-y-2">
          <p className="text-[10px] uppercase tracking-wider text-slate-500">
            Demo logins · Password: <span className="font-mono normal-case">{DEMO_PASSWORD}</span>
          </p>
          <div className="flex justify-center gap-2 flex-wrap">
            {DEMO_LOGINS.map(d => (
              <button
                key={d.email}
                type="button"
                disabled={busy}
                onClick={() => loginAs(d.email)}
                title={`Sign in as ${d.role} (${d.email})`}
                className="btn-ghost text-xs disabled:opacity-50"
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>
      </form>
    </div>
  );
}
