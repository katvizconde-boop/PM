import { useEffect, useMemo, useState } from 'react';
import { api } from '../api/client.js';
import { useAuth } from '../contexts/AuthContext.jsx';
import ConfirmDialog from './ConfirmDialog.jsx';
import { PlusIcon } from './icons.jsx';

// Roadmap-style milestone panel: list of milestones with a horizontal date-axis
// timeline below them. Bars are positioned by start_date/end_date, scaled to the
// project's overall date span (min start → max end, padded). Not draggable yet —
// edit by clicking a milestone.
//
// Manager+ can create / edit / delete. Anyone with auth can view.

const STATUS_BADGE = {
  active:    'bg-indigo-100 text-indigo-700',
  completed: 'bg-emerald-100 text-emerald-700',
  archived:  'bg-slate-100 text-slate-500',
};

function daysBetween(a, b) {
  return Math.round((new Date(b) - new Date(a)) / 86_400_000);
}

function fmtDate(d) {
  if (!d) return null;
  return new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function MilestoneEditor({ initial, onSave, onCancel, busy }) {
  const [form, setForm] = useState({
    name:        initial?.name ?? '',
    description: initial?.description ?? '',
    start_date:  initial?.start_date?.slice(0, 10) ?? '',
    end_date:    initial?.end_date?.slice(0, 10)   ?? '',
    status:      initial?.status ?? 'active',
  });
  const submit = (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    onSave({
      ...form,
      start_date: form.start_date || null,
      end_date:   form.end_date   || null,
    });
  };
  return (
    <form onSubmit={submit} className="space-y-2 bg-slate-50 p-3 rounded border border-slate-200">
      <input
        className="input"
        placeholder="Milestone name"
        autoFocus
        value={form.name}
        onChange={e => setForm({ ...form, name: e.target.value })}
        required
      />
      <textarea
        className="input min-h-[60px] resize-y"
        placeholder="Description (optional)"
        value={form.description}
        onChange={e => setForm({ ...form, description: e.target.value })}
      />
      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className="text-[10px] uppercase tracking-wide text-slate-500">Start</label>
          <input className="input" type="date" value={form.start_date}
                 onChange={e => setForm({ ...form, start_date: e.target.value })} />
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-wide text-slate-500">End</label>
          <input className="input" type="date" value={form.end_date}
                 onChange={e => setForm({ ...form, end_date: e.target.value })} />
        </div>
        {initial && (
          <div>
            <label className="text-[10px] uppercase tracking-wide text-slate-500">Status</label>
            <select className="input" value={form.status}
                    onChange={e => setForm({ ...form, status: e.target.value })}>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
              <option value="archived">Archived</option>
            </select>
          </div>
        )}
      </div>
      <div className="flex gap-2">
        <button className="btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
        <button type="button" onClick={onCancel} className="btn-ghost">Cancel</button>
      </div>
    </form>
  );
}

function Timeline({ milestones }) {
  // Compute the date axis. Only datey milestones contribute to scale.
  const dated = milestones.filter(m => m.start_date && m.end_date);
  if (dated.length === 0) return null;

  const minDate = new Date(Math.min(...dated.map(m => new Date(m.start_date))));
  const maxDate = new Date(Math.max(...dated.map(m => new Date(m.end_date))));
  // Pad ±2 days for breathing room.
  minDate.setDate(minDate.getDate() - 2);
  maxDate.setDate(maxDate.getDate() + 2);
  const totalDays = Math.max(1, daysBetween(minDate, maxDate));

  // Build month ticks across the span.
  const ticks = [];
  const cursor = new Date(minDate.getFullYear(), minDate.getMonth(), 1);
  while (cursor <= maxDate) {
    const offset = Math.max(0, daysBetween(minDate, cursor));
    ticks.push({
      label: cursor.toLocaleString(undefined, { month: 'short' }),
      left: (offset / totalDays) * 100,
    });
    cursor.setMonth(cursor.getMonth() + 1);
  }

  // Today marker.
  const today = new Date();
  const todayOffset = daysBetween(minDate, today);
  const todayPct = (todayOffset / totalDays) * 100;

  return (
    <div className="mt-4">
      <div className="relative h-5 border-b border-slate-200 mb-2">
        {ticks.map(t => (
          <div
            key={t.left}
            className="absolute top-0 text-[10px] uppercase tracking-wide text-slate-400 -translate-x-1/2"
            style={{ left: `${t.left}%` }}
          >
            {t.label}
          </div>
        ))}
        {todayPct >= 0 && todayPct <= 100 && (
          <div
            className="absolute top-0 bottom-0 w-px bg-red-400"
            style={{ left: `${todayPct}%` }}
            title="Today"
          />
        )}
      </div>

      <div className="space-y-2">
        {dated.map(m => {
          const leftPct  = (daysBetween(minDate, new Date(m.start_date)) / totalDays) * 100;
          const widthPct = Math.max(1, (daysBetween(new Date(m.start_date), new Date(m.end_date)) / totalDays) * 100);
          const pct = m.task_count ? Math.round((m.done_count / m.task_count) * 100) : 0;
          const barColor = m.status === 'completed' ? 'bg-emerald-500'
                         : m.status === 'archived'  ? 'bg-slate-300'
                         : 'bg-indigo-500';
          return (
            <div key={m.id} className="relative h-7" title={`${m.name} (${pct}%)`}>
              <div
                className={`absolute top-0 h-full ${barColor} rounded-md flex items-center px-2 text-xs text-white font-medium shadow-sm`}
                style={{ left: `${leftPct}%`, width: `${widthPct}%`, minWidth: '60px' }}
              >
                <span className="truncate">{m.name}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function MilestonesPanel({ projectId, onChange }) {
  const { user } = useAuth();
  const canEdit = ['admin', 'manager'].includes(user.role);
  const [items, setItems]       = useState([]);
  const [editing, setEditing]   = useState(null);   // milestone object OR { creating: true }
  const [confirmDel, setConfirmDel] = useState(null);
  const [busy, setBusy]         = useState(false);

  const load = () => api(`/milestones?project_id=${projectId}`).then(setItems);
  useEffect(() => { load(); }, [projectId]);

  const create = async (data) => {
    setBusy(true);
    try {
      await api(`/milestones?project_id=${projectId}`, { method: 'POST', body: data });
      setEditing(null); await load(); onChange?.();
    } finally { setBusy(false); }
  };
  const update = async (id, data) => {
    setBusy(true);
    try {
      await api(`/milestones?id=${id}`, { method: 'PATCH', body: data });
      setEditing(null); await load(); onChange?.();
    } finally { setBusy(false); }
  };
  const del = async () => {
    setBusy(true);
    try {
      await api(`/milestones?id=${confirmDel.id}`, { method: 'DELETE' });
      setConfirmDel(null); await load(); onChange?.();
    } finally { setBusy(false); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold">Roadmap</h2>
          <p className="text-xs text-slate-500 mt-0.5">{items.length} milestone{items.length === 1 ? '' : 's'}</p>
        </div>
        {canEdit && !editing && (
          <button onClick={() => setEditing({ creating: true })} className="btn-primary inline-flex items-center gap-1.5">
            <PlusIcon className="w-4 h-4" /> Milestone
          </button>
        )}
      </div>

      {editing?.creating && (
        <MilestoneEditor
          busy={busy}
          onSave={create}
          onCancel={() => setEditing(null)}
        />
      )}

      <div className="card p-4">
        {items.length === 0 ? (
          <p className="text-sm text-slate-400 italic">No milestones yet.</p>
        ) : (
          <>
            <ul className="space-y-2">
              {items.map(m => {
                const pct = m.task_count ? Math.round((m.done_count / m.task_count) * 100) : 0;
                if (editing?.id === m.id) {
                  return (
                    <li key={m.id}>
                      <MilestoneEditor
                        initial={m}
                        busy={busy}
                        onSave={(data) => update(m.id, data)}
                        onCancel={() => setEditing(null)}
                      />
                    </li>
                  );
                }
                return (
                  <li key={m.id} className="flex items-center gap-3 p-2 rounded hover:bg-slate-50 group">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium truncate">{m.name}</span>
                        <span className={`badge ${STATUS_BADGE[m.status]}`}>{m.status}</span>
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        {(m.start_date || m.end_date) && (
                          <span>{fmtDate(m.start_date) ?? '?'} → {fmtDate(m.end_date) ?? '?'} · </span>
                        )}
                        {m.task_count} task{m.task_count === 1 ? '' : 's'} · {pct}% done
                      </div>
                      {m.description && <p className="text-xs text-slate-600 mt-1 whitespace-pre-wrap">{m.description}</p>}
                    </div>
                    <div className="w-32">
                      <div className="h-1.5 bg-slate-100 rounded overflow-hidden">
                        <div className="h-1.5 bg-indigo-500" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                    {canEdit && (
                      <div className="opacity-0 group-hover:opacity-100 flex items-center gap-2 transition-opacity">
                        <button onClick={() => setEditing(m)} className="text-xs text-indigo-600 hover:underline">Edit</button>
                        <button onClick={() => setConfirmDel(m)} className="text-xs text-red-600 hover:underline">Delete</button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
            <Timeline milestones={items} />
          </>
        )}
      </div>

      <ConfirmDialog
        open={!!confirmDel}
        title={`Delete "${confirmDel?.name}"?`}
        message="The milestone is removed; any tasks linked to it are unlinked but kept."
        confirmLabel="Delete milestone"
        busy={busy}
        onCancel={() => setConfirmDel(null)}
        onConfirm={del}
      />
    </div>
  );
}
