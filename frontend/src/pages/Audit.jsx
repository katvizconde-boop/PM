import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';
import { toCSV, downloadCSV } from '../lib/csv.js';

const ENTITY_TYPES = ['project', 'task', 'comment', 'checklist', 'time'];
const ACTIONS = ['created', 'updated', 'deleted', 'status_changed', 'checked', 'unchecked', 'started', 'stopped', 'logged'];

const ACTION_BADGE = {
  created:        'bg-emerald-100 text-emerald-700',
  updated:        'bg-slate-100  text-slate-700',
  deleted:        'bg-red-100    text-red-700',
  status_changed: 'bg-indigo-100 text-indigo-700',
  checked:        'bg-emerald-100 text-emerald-700',
  unchecked:      'bg-slate-100  text-slate-700',
  started:        'bg-amber-100  text-amber-700',
  stopped:        'bg-slate-100  text-slate-700',
  logged:         'bg-blue-100   text-blue-700',
};

export default function Audit() {
  const [items,    setItems]    = useState([]);
  const [actor,    setActor]    = useState('');
  const [entity,   setEntity]   = useState('');
  const [action,   setAction]   = useState('');
  const [users,    setUsers]    = useState([]);

  // Re-fetch when filters change. /api/activity supports entity_type/entity_id;
  // actor/action filters are client-side because they're rare in our data volume.
  useEffect(() => {
    const params = new URLSearchParams();
    if (entity) params.set('entity_type', entity);
    api(`/activity${params.toString() ? '?' + params.toString() : ''}`).then(setItems);
  }, [entity]);

  useEffect(() => { api('/dashboard/users').then(setUsers); }, []);

  const visible = useMemo(() => items.filter(i => {
    if (actor  && i.actor_id !== Number(actor)) return false;
    if (action && i.action !== action) return false;
    return true;
  }), [items, actor, action]);

  const exportCsv = () => {
    const csv = toCSV(visible, [
      { label: 'When',        value: (i) => new Date(i.created_at).toISOString() },
      { label: 'Actor',       value: 'actor_name' },
      { label: 'Action',      value: 'action' },
      { label: 'Entity type', value: 'entity_type' },
      { label: 'Entity ID',   value: 'entity_id' },
      { label: 'Metadata',    value: (i) => i.metadata ? JSON.stringify(i.metadata) : '' },
    ]);
    downloadCSV(`audit-${new Date().toISOString().slice(0, 10)}.csv`, csv);
  };

  return (
    <div className="space-y-5 max-w-6xl">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Audit log</h1>
          <p className="text-xs text-slate-500 mt-0.5">{visible.length} of {items.length} entries · 100 most recent</p>
        </div>
        <button onClick={exportCsv} disabled={!visible.length} className="btn-ghost text-sm disabled:opacity-50">Export CSV</button>
      </div>

      <div className="card p-3 flex items-center gap-2 flex-wrap">
        <select className="input py-1 text-xs w-40" value={actor} onChange={e => setActor(e.target.value)}>
          <option value="">Any actor</option>
          {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
        <select className="input py-1 text-xs w-36" value={entity} onChange={e => setEntity(e.target.value)}>
          <option value="">Any entity</option>
          {ENTITY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <select className="input py-1 text-xs w-36" value={action} onChange={e => setAction(e.target.value)}>
          <option value="">Any action</option>
          {ACTIONS.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        {(actor || entity || action) && (
          <button onClick={() => { setActor(''); setEntity(''); setAction(''); }} className="text-xs text-slate-500 hover:text-slate-700">
            Clear
          </button>
        )}
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="text-[11px] uppercase tracking-wide text-slate-500 bg-slate-50">
            <tr>
              <th className="px-3 py-2 text-left font-medium w-44">When</th>
              <th className="px-3 py-2 text-left font-medium w-40">Actor</th>
              <th className="px-3 py-2 text-left font-medium w-32">Action</th>
              <th className="px-3 py-2 text-left font-medium w-24">Entity</th>
              <th className="px-3 py-2 text-left font-medium">Details</th>
            </tr>
          </thead>
          <tbody>
            {visible.map(i => {
              const dest = i.entity_type === 'project' ? `/projects/${i.entity_id}`
                         : i.entity_type === 'task' && i.metadata?.project_id ? `/projects/${i.metadata.project_id}`
                         : null;
              return (
                <tr key={i.id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-3 py-2 text-xs text-slate-600 whitespace-nowrap">{new Date(i.created_at).toLocaleString()}</td>
                  <td className="px-3 py-2">{i.actor_name}</td>
                  <td className="px-3 py-2">
                    <span className={`badge ${ACTION_BADGE[i.action] ?? 'bg-slate-100 text-slate-700'}`}>{i.action}</span>
                  </td>
                  <td className="px-3 py-2 text-slate-600">
                    {dest ? <Link to={dest} className="hover:underline">{i.entity_type} #{i.entity_id}</Link>
                          : `${i.entity_type} #${i.entity_id}`}
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-500 truncate max-w-md">
                    {i.metadata ? JSON.stringify(i.metadata) : <span className="text-slate-300">—</span>}
                  </td>
                </tr>
              );
            })}
            {!visible.length && (
              <tr><td colSpan={5} className="p-8 text-center text-slate-500">No entries match the filters.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
