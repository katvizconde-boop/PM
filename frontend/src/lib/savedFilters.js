// localStorage-backed saved filters for the All Tasks page. Shape:
//   [{ id, name, filter: { status?, priority?, assignee_id?, tag?, overdue? } }]
// Filters are pure, so we keep them client-side — no server round trip.

const KEY = 'pm_saved_filters_v1';

export function loadSaved() {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]'); }
  catch { return []; }
}

export function saveAll(list) {
  localStorage.setItem(KEY, JSON.stringify(list));
}

export function add(filter, name) {
  const list = loadSaved();
  const next = [...list, { id: Date.now(), name, filter }];
  saveAll(next);
  return next;
}

export function remove(id) {
  const next = loadSaved().filter(f => f.id !== id);
  saveAll(next);
  return next;
}

// Apply a filter set to a list of tasks. Empty/undefined fields = no constraint.
export function apply(tasks, filter) {
  if (!filter) return tasks;
  const today = new Date().toISOString().slice(0, 10);
  return tasks.filter(t => {
    if (filter.status   && t.status   !== filter.status)   return false;
    if (filter.priority && t.priority !== filter.priority) return false;
    if (filter.assignee_id && t.assignee_id !== filter.assignee_id) return false;
    if (filter.tag) {
      if (!(t.tags ?? []).includes(filter.tag)) return false;
    }
    if (filter.overdue) {
      if (t.status === 'done') return false;
      if (!t.due_date || t.due_date.slice(0, 10) >= today) return false;
    }
    return true;
  });
}

// Built-in filters always available (not stored in localStorage).
export const BUILT_IN = [
  { id: 'overdue',   name: 'Overdue',          filter: { overdue: true } },
  { id: 'urgent',    name: 'Urgent open',      filter: { priority: 'urgent', status: undefined } },
  { id: 'todo',      name: 'To do',            filter: { status: 'todo' } },
  { id: 'inprog',    name: 'In progress',      filter: { status: 'in_progress' } },
];
