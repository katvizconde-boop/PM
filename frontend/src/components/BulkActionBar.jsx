import { api } from '../api/client.js';

const STATUSES = [
  { value: 'todo',        label: 'To do' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'done',        label: 'Done' },
];
const PRIORITIES = ['low', 'medium', 'high', 'urgent'];

// Floating action bar — appears when 1+ task rows are selected. Calls
// PATCH /api/tasks/:id in parallel for each selection (no new function needed).
export default function BulkActionBar({ selected, onClear, onChange }) {
  if (selected.length === 0) return null;

  const apply = async (patch) => {
    await Promise.all(selected.map(id =>
      api(`/tasks/${id}`, { method: 'PATCH', body: patch })
    ));
    onClear();
    onChange();
  };

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-30 card shadow-lg px-3 py-2 flex items-center gap-3">
      <span className="text-sm font-medium">{selected.length} selected</span>

      <div className="h-6 w-px bg-slate-200" />

      <select
        className="text-sm input py-1 w-32"
        defaultValue=""
        onChange={(e) => e.target.value && apply({ status: e.target.value }) && (e.target.value = '')}
      >
        <option value="">Set status…</option>
        {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
      </select>

      <select
        className="text-sm input py-1 w-32"
        defaultValue=""
        onChange={(e) => e.target.value && apply({ priority: e.target.value }) && (e.target.value = '')}
      >
        <option value="">Set priority…</option>
        {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
      </select>

      <button onClick={onClear} className="text-sm text-slate-500 hover:text-slate-700">
        Cancel
      </button>
    </div>
  );
}
