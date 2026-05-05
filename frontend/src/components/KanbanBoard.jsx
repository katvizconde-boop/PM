import { useState } from 'react';
import { api } from '../api/client.js';

const COLUMNS = [
  { status: 'todo',        label: 'To do' },
  { status: 'in_progress', label: 'In progress' },
  { status: 'done',        label: 'Done' },
];

const PRIORITY_BADGE = {
  low:    'bg-slate-100 text-slate-700',
  medium: 'bg-blue-100 text-blue-700',
  high:   'bg-amber-100 text-amber-700',
  urgent: 'bg-red-100 text-red-700',
};

export default function KanbanBoard({ tasks, onChange }) {
  // Track which column the cursor is over so we can highlight the drop target.
  const [hoverCol, setHoverCol] = useState(null);

  const onDragStart = (e, taskId) => {
    e.dataTransfer.setData('text/task-id', String(taskId));
    e.dataTransfer.effectAllowed = 'move';
  };

  const onDrop = async (e, status) => {
    e.preventDefault();
    setHoverCol(null);
    const id = e.dataTransfer.getData('text/task-id');
    if (!id) return;
    const task = tasks.find(t => String(t.id) === id);
    if (!task || task.status === status) return;
    await api(`/tasks/${id}`, { method: 'PATCH', body: { status } });
    onChange();
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {COLUMNS.map(col => {
        const colTasks = tasks.filter(t => t.status === col.status);
        const active = hoverCol === col.status;
        return (
          <div
            key={col.status}
            onDragOver={(e) => { e.preventDefault(); setHoverCol(col.status); }}
            onDragLeave={() => setHoverCol(prev => prev === col.status ? null : prev)}
            onDrop={(e) => onDrop(e, col.status)}
            className={`card p-3 min-h-[200px] transition ${active ? 'ring-2 ring-indigo-400 bg-indigo-50/40' : ''}`}
          >
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-medium text-sm">{col.label}</h3>
              <span className="text-xs text-slate-400">{colTasks.length}</span>
            </div>
            <div className="space-y-2">
              {colTasks.map(t => (
                <div
                  key={t.id}
                  draggable
                  onDragStart={(e) => onDragStart(e, t.id)}
                  className="card p-2 text-sm cursor-grab active:cursor-grabbing"
                >
                  <div className="font-medium">{t.title}</div>
                  <div className="flex items-center justify-between mt-1 text-xs text-slate-500">
                    <span className={`badge ${PRIORITY_BADGE[t.priority]}`}>{t.priority}</span>
                    <span>{t.assignee_name ?? 'Unassigned'}</span>
                  </div>
                  {t.due_date && (
                    <div className="text-xs text-slate-400 mt-1">Due {t.due_date.slice(0, 10)}</div>
                  )}
                </div>
              ))}
              {!colTasks.length && (
                <div className="text-xs text-slate-400 italic py-4 text-center">Drop tasks here</div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
