import { useState } from 'react';
import { api } from '../api/client.js';
import ConfirmDialog from './ConfirmDialog.jsx';

const STATUSES = [
  { value: 'todo',        label: 'To do' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'done',        label: 'Done' },
];
const PRIORITIES = ['low', 'medium', 'high', 'urgent'];

// Floating action bar — appears when 1+ task rows are selected. Calls
// PATCH /api/tasks/:id (or DELETE) in parallel for each selection.
export default function BulkActionBar({ selected, onClear, onChange }) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);

  if (selected.length === 0) return null;

  const apply = async (patch) => {
    setBusy(true);
    try {
      await Promise.all(selected.map(id =>
        api(`/tasks/${id}`, { method: 'PATCH', body: patch })
      ));
      onClear();
      onChange();
    } finally { setBusy(false); }
  };

  const doDelete = async () => {
    setBusy(true);
    try {
      await Promise.all(selected.map(id => api(`/tasks/${id}`, { method: 'DELETE' })));
      setConfirmDelete(false);
      onClear();
      onChange();
    } finally { setBusy(false); }
  };

  return (
    <>
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-30 card shadow-lg px-3 py-2 flex items-center gap-3">
        <span className="text-sm font-medium">{selected.length} selected</span>

        <div className="h-6 w-px bg-slate-200" />

        <select
          className="text-sm input py-1 w-32"
          defaultValue=""
          disabled={busy}
          onChange={(e) => {
            if (e.target.value) {
              apply({ status: e.target.value });
              e.target.value = '';
            }
          }}
        >
          <option value="">Set status…</option>
          {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>

        <select
          className="text-sm input py-1 w-32"
          defaultValue=""
          disabled={busy}
          onChange={(e) => {
            if (e.target.value) {
              apply({ priority: e.target.value });
              e.target.value = '';
            }
          }}
        >
          <option value="">Set priority…</option>
          {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
        </select>

        <button
          onClick={() => setConfirmDelete(true)}
          disabled={busy}
          className="text-sm px-2.5 py-1 rounded text-red-600 hover:bg-red-50 disabled:opacity-50"
        >
          Delete
        </button>

        <button onClick={onClear} disabled={busy} className="text-sm text-slate-500 hover:text-slate-700">
          Cancel
        </button>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title={`Delete ${selected.length} task${selected.length === 1 ? '' : 's'}?`}
        message="This permanently removes the selected tasks along with their comments, time entries, and any subtasks. This cannot be undone."
        confirmLabel={`Delete ${selected.length} task${selected.length === 1 ? '' : 's'}`}
        busy={busy}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={doDelete}
      />
    </>
  );
}
