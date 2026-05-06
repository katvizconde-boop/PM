import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';
import { useAuth } from '../contexts/AuthContext.jsx';
import { PlusIcon } from '../components/icons.jsx';

const STATUS_LABEL = { not_started: 'Not started', in_progress: 'In progress', done: 'Done' };
const STATUS_BADGE = {
  not_started: 'bg-slate-100 text-slate-700',
  in_progress: 'bg-indigo-100 text-indigo-700',
  done:        'bg-emerald-100 text-emerald-700',
};

// Inline new-project form, expandable. Folds away when not in use to keep the
// page header tight (à la ClickUp's "+ Project" affordance).
function NewProjectForm({ users, onCreate, onCancel }) {
  const { user } = useAuth();
  const [form, setForm] = useState({ name: '', description: '', owner_id: user.id, deadline: '' });
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api('/projects', {
        method: 'POST',
        body: { ...form, deadline: form.deadline || null, owner_id: Number(form.owner_id) },
      });
      onCreate();
    } finally { setBusy(false); }
  };

  return (
    <form onSubmit={submit} className="card p-4 grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
      <div className="md:col-span-2">
        <label className="text-xs text-slate-500">Name</label>
        <input className="input" required autoFocus value={form.name}
               onChange={e => setForm({ ...form, name: e.target.value })} />
      </div>
      <div>
        <label className="text-xs text-slate-500">Owner</label>
        <select className="input" value={form.owner_id}
                onChange={e => setForm({ ...form, owner_id: e.target.value })}>
          {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
      </div>
      <div>
        <label className="text-xs text-slate-500">Deadline</label>
        <input className="input" type="date" value={form.deadline}
               onChange={e => setForm({ ...form, deadline: e.target.value })} />
      </div>
      <div className="flex gap-2">
        <button className="btn-primary flex-1" disabled={busy}>Create</button>
        <button type="button" onClick={onCancel} className="btn-ghost">Cancel</button>
      </div>
    </form>
  );
}

export default function Projects() {
  const { user } = useAuth();
  const canCreate = ['admin', 'manager'].includes(user.role);
  const [projects, setProjects] = useState([]);
  const [users, setUsers]       = useState([]);
  const [adding, setAdding]     = useState(false);

  const load = async () => {
    const [p, u] = await Promise.all([api('/projects'), api('/dashboard/users')]);
    setProjects(p); setUsers(u);
  };
  useEffect(() => { load(); }, []);

  return (
    <div className="space-y-5 max-w-7xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Projects</h1>
          <p className="text-xs text-slate-500 mt-0.5">{projects.length} project{projects.length === 1 ? '' : 's'}</p>
        </div>
        {canCreate && !adding && (
          <button onClick={() => setAdding(true)} className="btn-primary inline-flex items-center gap-1.5">
            <PlusIcon className="w-4 h-4" />
            Project
          </button>
        )}
      </div>

      {adding && (
        <NewProjectForm
          users={users}
          onCreate={() => { setAdding(false); load(); }}
          onCancel={() => setAdding(false)}
        />
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {projects.map(p => {
          const pct = p.task_count ? Math.round((p.done_count / p.task_count) * 100) : 0;
          return (
            <Link key={p.id} to={`/projects/${p.id}`} className="card p-4 hover:shadow-md hover:border-indigo-200 transition">
              <div className="flex items-start justify-between gap-2">
                <div className="font-semibold truncate">{p.name}</div>
                <span className={`badge ${STATUS_BADGE[p.status]} shrink-0`}>{STATUS_LABEL[p.status]}</span>
              </div>
              <div className="text-xs text-slate-500 mt-1">Owner: {p.owner_name}</div>
              {p.deadline && <div className="text-xs text-slate-500">Due: {p.deadline.slice(0, 10)}</div>}
              <div className="mt-3">
                <div className="h-1.5 bg-slate-100 rounded">
                  <div className="h-1.5 bg-indigo-600 rounded" style={{ width: `${pct}%` }} />
                </div>
                <div className="text-xs text-slate-500 mt-1">{p.done_count}/{p.task_count} tasks done</div>
              </div>
            </Link>
          );
        })}
        {!projects.length && (
          <div className="md:col-span-2 lg:col-span-3 card p-10 text-center">
            <p className="text-slate-500">No projects yet.</p>
            {canCreate && (
              <button onClick={() => setAdding(true)} className="btn-primary mt-3 inline-flex items-center gap-1.5">
                <PlusIcon className="w-4 h-4" /> Create your first project
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
