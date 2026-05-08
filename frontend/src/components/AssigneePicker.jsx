import { useEffect, useRef, useState } from 'react';
import { api } from '../api/client.js';
import AvatarStack from './AvatarStack.jsx';

// Multi-assignee popover. Click the avatar stack → list of users with checkboxes.
// Sends PATCH /api/tasks/:id with co_assignee_ids = the new set.
//
// Note: tasks have ONE primary assignee_id (set elsewhere) plus N co-assignees here.
// The popover treats them uniformly: checking the primary doesn't move them; checking
// non-primaries adds/removes from co_assignees. This keeps the assignee_id semantics
// stable for existing dashboards / filters.
export default function AssigneePicker({ taskId, primaryId, coAssignees, allUsers, onChange }) {
  const [open, setOpen]       = useState(false);
  const [picked, setPicked]   = useState(coAssignees.map(u => u.id));
  const ref = useRef(null);

  useEffect(() => { setPicked(coAssignees.map(u => u.id)); }, [coAssignees]);

  // Click-outside → save and close.
  useEffect(() => {
    if (!open) return;
    const close = async (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        if (JSON.stringify([...picked].sort()) !== JSON.stringify(coAssignees.map(u => u.id).sort())) {
          await api(`/tasks/${taskId}`, { method: 'PATCH', body: { co_assignee_ids: picked } });
          onChange();
        }
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open, picked, taskId, coAssignees, onChange]);

  const toggle = (id) => setPicked(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);

  const stackUsers = [
    ...(primaryId ? [allUsers.find(u => u.id === primaryId)].filter(Boolean) : []),
    ...coAssignees.filter(u => u.id !== primaryId),
  ];

  return (
    <div ref={ref} className="relative inline-block">
      <button
        onClick={() => setOpen(!open)}
        className="hover:opacity-80"
        aria-label="Edit assignees"
      >
        {stackUsers.length > 0
          ? <AvatarStack users={stackUsers} size="xs" max={3} />
          : <span className="text-xs text-slate-400 italic">unassigned</span>}
      </button>
      {open && (
        <div className="absolute z-20 left-0 top-full mt-1 w-56 card max-h-72 overflow-y-auto p-1">
          <div className="text-[10px] uppercase tracking-wide text-slate-500 px-2 py-1">
            Co-assignees
          </div>
          {allUsers.map(u => {
            const isPrimary = u.id === primaryId;
            const isPicked = picked.includes(u.id);
            return (
              <button
                key={u.id}
                onClick={() => !isPrimary && toggle(u.id)}
                disabled={isPrimary}
                className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm ${
                  isPrimary ? 'opacity-50 cursor-not-allowed' : 'hover:bg-slate-50'
                }`}
              >
                <input
                  type="checkbox"
                  checked={isPrimary || isPicked}
                  readOnly
                  className="h-3.5 w-3.5 rounded border-slate-300 text-indigo-600"
                />
                <span className="flex-1 text-left truncate">{u.name}</span>
                {isPrimary && <span className="text-[10px] text-slate-400">primary</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
