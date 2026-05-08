import { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import { Link } from 'react-router-dom';

// Inline editor for blocked_by / blocks lists on a task.
// Pulls full task object via GET /api/tasks/:id (which returns blocked_by + blocks
// arrays of {id,title,status}); commits via PATCH on save.
//
// Mode:
//   - direction='blocked_by'  ("This task is blocked by …")
//   - direction='blocks'      ("This task blocks …")
export default function DependencyPicker({ taskId, projectTasks, direction, onChange }) {
  const [items, setItems] = useState([]);
  const [adding, setAdding] = useState(false);

  // Pull the full task once when picker opens, to populate the current set.
  const reload = async () => {
    const t = await api(`/tasks/${taskId}`);
    setItems(direction === 'blocked_by' ? t.blocked_by : t.blocks);
  };
  useEffect(() => { reload(); }, [taskId, direction]);

  const save = async (next) => {
    const key = direction === 'blocked_by' ? 'blocked_by_ids' : 'blocks_ids';
    await api(`/tasks/${taskId}`, { method: 'PATCH', body: { [key]: next.map(i => i.id) } });
    setItems(next);
    onChange();
  };

  const remove = (id) => save(items.filter(i => i.id !== id));
  const add = (peerId) => {
    if (peerId === Number(taskId) || items.find(i => i.id === peerId)) return;
    const peer = projectTasks.find(t => t.id === peerId);
    if (!peer) return;
    save([...items, { id: peer.id, title: peer.title, status: peer.status }]);
    setAdding(false);
  };

  const STATUS_DOT = { todo: 'bg-slate-400', in_progress: 'bg-indigo-500', done: 'bg-emerald-500' };

  return (
    <div className="space-y-1">
      {items.length === 0 && !adding && (
        <button onClick={() => setAdding(true)} className="text-xs text-slate-400 hover:text-indigo-600">
          + {direction === 'blocked_by' ? 'add blocker' : 'add blocked task'}
        </button>
      )}
      {items.map(i => (
        <div key={i.id} className="flex items-center gap-1.5 text-xs">
          <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[i.status]}`} />
          <Link to={`/projects/${i.project_id ?? ''}`} className="hover:underline truncate flex-1">{i.title}</Link>
          <button
            onClick={() => remove(i.id)}
            className="text-slate-400 hover:text-red-600"
            aria-label="Remove dependency"
          >×</button>
        </div>
      ))}
      {(items.length > 0 || adding) && (
        adding ? (
          <select
            autoFocus
            className="text-xs px-2 py-1 border border-slate-300 rounded w-full"
            onChange={(e) => e.target.value && add(Number(e.target.value))}
            onBlur={() => setAdding(false)}
          >
            <option value="">Pick a task…</option>
            {projectTasks
              .filter(t => t.id !== Number(taskId) && !items.find(i => i.id === t.id))
              .map(t => (
                <option key={t.id} value={t.id}>{t.title}</option>
              ))}
          </select>
        ) : (
          <button onClick={() => setAdding(true)} className="text-xs text-slate-400 hover:text-indigo-600">+ add</button>
        )
      )}
    </div>
  );
}
