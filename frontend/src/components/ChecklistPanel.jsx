import { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import { useAuth } from '../contexts/AuthContext.jsx';

// Per-project workflow checklist. Anyone can toggle; managers+ can add/delete.
export default function ChecklistPanel({ projectId }) {
  const { user } = useAuth();
  const canEdit = ['admin', 'manager'].includes(user.role);
  const [items, setItems] = useState([]);
  const [text,  setText]  = useState('');

  const load = () => api(`/checklist?project_id=${projectId}`).then(setItems);
  useEffect(() => { load(); }, [projectId]);

  const add = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    await api(`/checklist?project_id=${projectId}`, { method: 'POST', body: { text } });
    setText(''); load();
  };

  const toggle = async (item) => {
    await api(`/checklist?id=${item.id}`, {
      method: 'PATCH',
      body: { completed: !item.completed_at },
    });
    load();
  };

  const remove = async (item) => {
    if (!confirm(`Delete "${item.text}"?`)) return;
    await api(`/checklist?id=${item.id}`, { method: 'DELETE' });
    load();
  };

  const done = items.filter(i => i.completed_at).length;
  const pct  = items.length ? Math.round((done / items.length) * 100) : 0;

  return (
    <div className="card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-medium">Workflow checklist</h2>
        <span className="text-xs text-slate-500">{done}/{items.length} · {pct}%</span>
      </div>

      {items.length > 0 && (
        <div className="h-1.5 bg-slate-100 rounded">
          <div className="h-1.5 bg-emerald-500 rounded" style={{ width: `${pct}%` }} />
        </div>
      )}

      <ul className="space-y-1.5">
        {items.map(item => (
          <li key={item.id} className="flex items-start gap-2 group">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
              checked={!!item.completed_at}
              onChange={() => toggle(item)}
            />
            <div className="flex-1 text-sm">
              <span className={item.completed_at ? 'line-through text-slate-400' : ''}>{item.text}</span>
              {item.completed_by_name && (
                <span className="text-xs text-slate-400 ml-2">
                  by {item.completed_by_name} · {new Date(item.completed_at).toLocaleDateString()}
                </span>
              )}
            </div>
            {canEdit && (
              <button
                onClick={() => remove(item)}
                className="opacity-0 group-hover:opacity-100 text-xs text-red-600 hover:underline transition-opacity"
                aria-label={`Delete ${item.text}`}
              >
                Delete
              </button>
            )}
          </li>
        ))}
        {!items.length && <li className="text-sm text-slate-500 italic">No checklist items yet.</li>}
      </ul>

      {canEdit && (
        <form onSubmit={add} className="flex gap-2 pt-1">
          <input
            className="input"
            placeholder="Add a step…"
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={500}
          />
          <button className="btn-primary">Add</button>
        </form>
      )}
    </div>
  );
}
