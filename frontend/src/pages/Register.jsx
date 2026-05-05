import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';

export default function Register() {
  const { register } = useAuth();
  const nav = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [err, setErr]   = useState(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setErr(null);
    try { await register(form); nav('/'); }
    catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <form onSubmit={submit} className="card p-6 w-full max-w-sm space-y-4">
        <h1 className="text-xl font-semibold">Create account</h1>
        {err && <div className="text-sm text-red-600">{err}</div>}
        <input className="input" placeholder="Full name" required
               value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
        <input className="input" type="email" placeholder="Email" required
               value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
        <input className="input" type="password" placeholder="Password (min 8)" required minLength={8}
               value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
        <button className="btn-primary w-full" disabled={busy}>{busy ? 'Creating…' : 'Register'}</button>
        <p className="text-sm text-slate-500">Already have one? <Link to="/login" className="text-indigo-600">Sign in</Link></p>
      </form>
    </div>
  );
}
