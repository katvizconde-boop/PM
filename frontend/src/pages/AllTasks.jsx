import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';
import { ChevronDownIcon, ChevronRightIcon, FolderIcon } from '../components/icons.jsx';
import { toCSV, downloadCSV } from '../lib/csv.js';
import { tagColor } from '../components/TagInput.jsx';
import AvatarStack from '../components/AvatarStack.jsx';
import BulkActionBar from '../components/BulkActionBar.jsx';
import { BUILT_IN, loadSaved, add as saveFilter, remove as removeFilter, apply as applyFilter } from '../lib/savedFilters.js';

const STATUSES = [
  { value: 'todo',        label: 'To do',       badge: 'bg-slate-100 text-slate-700' },
  { value: 'in_progress', label: 'In progress', badge: 'bg-indigo-100 text-indigo-700' },
  { value: 'done',        label: 'Done',        badge: 'bg-emerald-100 text-emerald-700' },
];
const PRIORITY_BADGE = {
  low:    'bg-slate-100 text-slate-700',
  medium: 'bg-blue-100 text-blue-700',
  high:   'bg-amber-100 text-amber-700',
  urgent: 'bg-red-100 text-red-700',
};
const STATUS_DOT = { todo: 'bg-slate-400', in_progress: 'bg-indigo-500', done: 'bg-emerald-500' };

function StatusGroup({ status, tasks, selected, onToggleSelect }) {
  const cfg = STATUSES.find(s => s.value === status);
  if (!tasks.length) return null;
  return (
    <div className="card overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2.5 bg-slate-50 border-b border-slate-100">
        <span className={`badge ${cfg.badge}`}>{cfg.label}</span>
        <span className="text-xs text-slate-500">{tasks.length}</span>
      </div>
      <table className="w-full text-sm">
        <thead className="text-[11px] uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-2 py-2 w-8"></th>
            <th className="px-3 py-2 text-left font-medium">Name</th>
            <th className="px-3 py-2 text-left font-medium w-32">Assignees</th>
            <th className="px-3 py-2 text-left font-medium w-28">Due date</th>
            <th className="px-3 py-2 text-left font-medium w-28">Priority</th>
            <th className="px-3 py-2 text-left font-medium w-24">Tags</th>
            <th className="px-3 py-2 text-center font-medium w-16">Deps</th>
          </tr>
        </thead>
        <tbody>
          {tasks.map(t => {
            const overdue = t.due_date && t.status !== 'done' && t.due_date.slice(0, 10) < new Date().toISOString().slice(0, 10);
            const allAssignees = [
              ...(t.assignee_id ? [{ id: t.assignee_id, name: t.assignee_name }] : []),
              ...((t.co_assignees ?? []).filter(u => u.id !== t.assignee_id)),
            ];
            const checked = selected.has(t.id);
            return (
              <tr key={t.id} className={`border-t border-slate-100 ${checked ? 'bg-indigo-50/60' : 'hover:bg-slate-50'}`}>
                <td className="px-2 py-2.5 text-center">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => onToggleSelect(t.id)}
                    className="h-3.5 w-3.5 rounded border-slate-300 text-indigo-600"
                  />
                </td>
                <td className="px-3 py-2.5">
                  <Link to={`/projects/${t.project_id}`} className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${STATUS_DOT[t.status]}`} />
                    <span className="font-medium hover:text-indigo-700">{t.title}</span>
                  </Link>
                </td>
                <td className="px-3 py-2.5">
                  {allAssignees.length > 0
                    ? <AvatarStack users={allAssignees} size="xs" max={3} />
                    : <span className="text-xs text-slate-400 italic">unassigned</span>}
                </td>
                <td className={`px-3 py-2.5 text-xs ${overdue ? 'text-red-600 font-medium' : 'text-slate-600'}`}>
                  {t.due_date ? t.due_date.slice(0, 10) : <span className="text-slate-300">—</span>}
                </td>
                <td className="px-3 py-2.5">
                  <span className={`badge ${PRIORITY_BADGE[t.priority]}`}>{t.priority}</span>
                </td>
                <td className="px-3 py-2.5">
                  <div className="flex flex-wrap gap-1">
                    {(t.tags ?? []).slice(0, 3).map(tag => (
                      <span key={tag} className={`badge ${tagColor(tag)}`}>{tag}</span>
                    ))}
                    {(t.tags ?? []).length > 3 && <span className="text-xs text-slate-400">+{t.tags.length - 3}</span>}
                  </div>
                </td>
                <td className="px-3 py-2.5 text-center text-xs text-slate-500">
                  {t.blocked_by_count > 0 && <span className="text-red-600" title={`${t.blocked_by_count} blocker(s)`}>🚫{t.blocked_by_count}</span>}
                  {t.blocks_count > 0     && <span className="ml-1" title={`blocking ${t.blocks_count}`}>🔗{t.blocks_count}</span>}
                  {!t.blocked_by_count && !t.blocks_count && '—'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ProjectGroup({ project, tasks, selected, onToggleSelect }) {
  const [collapsed, setCollapsed] = useState(false);
  const total = tasks.length;
  const byStatus = STATUSES.reduce((acc, s) => { acc[s.value] = tasks.filter(t => t.status === s.value); return acc; }, {});
  if (total === 0) return null;
  return (
    <section className="space-y-2">
      <button onClick={() => setCollapsed(c => !c)} className="flex items-center gap-2">
        {collapsed ? <ChevronRightIcon className="w-4 h-4 text-slate-500" /> : <ChevronDownIcon className="w-4 h-4 text-slate-500" />}
        <FolderIcon className="w-4 h-4 text-slate-400" />
        <Link to={`/projects/${project.id}`} className="font-medium hover:text-indigo-700">{project.name}</Link>
        <span className="text-xs text-slate-500">{total}</span>
      </button>
      {!collapsed && (
        <div className="space-y-2 pl-6">
          {STATUSES.map(s => (
            <StatusGroup key={s.value} status={s.value} tasks={byStatus[s.value]} selected={selected} onToggleSelect={onToggleSelect} />
          ))}
        </div>
      )}
    </section>
  );
}

function FilterBar({ saved, active, setActive, onSaveCurrent, currentFilter }) {
  const all = [...BUILT_IN, ...saved];
  const canSave = currentFilter && Object.keys(currentFilter).some(k => currentFilter[k]);
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {all.map(f => (
        <button
          key={f.id}
          onClick={() => setActive(active?.id === f.id ? null : f)}
          className={`text-xs px-2 py-1 rounded-md border ${
            active?.id === f.id ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
          }`}
        >
          {f.name}
        </button>
      ))}
      {canSave && (
        <button onClick={onSaveCurrent} className="text-xs text-indigo-600 hover:underline ml-1">
          + save current view
        </button>
      )}
    </div>
  );
}

export default function AllTasks() {
  const [tasks,    setTasks]    = useState([]);
  const [projects, setProjects] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [active,   setActive]   = useState(null); // active built-in / saved filter
  const [saved,    setSaved]    = useState(loadSaved());
  // Ad-hoc filters: priority chip + tag input. We expose a couple of common ones inline.
  const [priorityFilter, setPriorityFilter] = useState('');
  const [tagFilter,      setTagFilter]      = useState('');

  const reload = () => Promise.all([api('/tasks'), api('/projects')]).then(([t, p]) => { setTasks(t); setProjects(p); });
  useEffect(() => { reload(); }, []);

  const adHocFilter = useMemo(() => {
    const f = {};
    if (priorityFilter) f.priority = priorityFilter;
    if (tagFilter)      f.tag = tagFilter;
    return f;
  }, [priorityFilter, tagFilter]);

  // active filter (saved/built-in) overrides ad-hoc; otherwise ad-hoc applies.
  const visibleTasks = active ? applyFilter(tasks, active.filter) : applyFilter(tasks, adHocFilter);

  const onSaveCurrent = () => {
    const name = prompt('Name this filter:');
    if (!name) return;
    setSaved(saveFilter(adHocFilter, name));
    setActive(null);
  };

  const onDeleteSaved = (id) => {
    if (!confirm('Delete this saved filter?')) return;
    setSaved(removeFilter(id));
    if (active?.id === id) setActive(null);
  };

  const toggleSelect = (id) => setSelected(s => {
    const next = new Set(s);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const tasksByProject = visibleTasks.reduce((acc, t) => {
    (acc[t.project_id] ??= []).push(t);
    return acc;
  }, {});

  return (
    <div className="space-y-5 max-w-7xl pb-20">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold">All Tasks</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {visibleTasks.length} of {tasks.length} task{tasks.length === 1 ? '' : 's'} ·
            across {projects.length} project{projects.length === 1 ? '' : 's'}
          </p>
        </div>
        <button
          onClick={() => {
            const csv = toCSV(visibleTasks, [
              { label: 'Project',  value: 'project_name' },
              { label: 'Title',    value: 'title' },
              { label: 'Status',   value: 'status' },
              { label: 'Priority', value: 'priority' },
              { label: 'Assignee', value: 'assignee_name' },
              { label: 'Co-assignees', value: (t) => (t.co_assignees ?? []).map(u => u.name).join('; ') },
              { label: 'Due date', value: (t) => t.due_date?.slice(0, 10) ?? '' },
              { label: 'Tags',     value: (t) => (t.tags ?? []).join('; ') },
              { label: 'Comments', value: 'comments_count' },
              { label: 'Blocked by', value: 'blocked_by_count' },
              { label: 'Blocks',     value: 'blocks_count' },
            ]);
            downloadCSV(`tasks-${new Date().toISOString().slice(0, 10)}.csv`, csv);
          }}
          disabled={!visibleTasks.length}
          className="btn-ghost text-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Export CSV
        </button>
      </div>

      <div className="card p-3 space-y-2">
        <FilterBar saved={saved} active={active} setActive={(f) => { setActive(f); setPriorityFilter(''); setTagFilter(''); }} onSaveCurrent={onSaveCurrent} currentFilter={adHocFilter} />
        {!active && (
          <div className="flex items-center gap-2">
            <select className="input py-1 text-xs w-32" value={priorityFilter} onChange={e => setPriorityFilter(e.target.value)}>
              <option value="">Any priority</option>
              {['low', 'medium', 'high', 'urgent'].map(p => <option key={p} value={p}>{p}</option>)}
            </select>
            <input
              className="input py-1 text-xs w-32"
              placeholder="Tag…"
              value={tagFilter}
              onChange={e => setTagFilter(e.target.value)}
            />
          </div>
        )}
        {saved.length > 0 && (
          <div className="text-xs text-slate-500 flex items-center gap-1.5 flex-wrap pt-1 border-t border-slate-100">
            <span>Custom:</span>
            {saved.map(f => (
              <span key={f.id} className="inline-flex items-center gap-1 bg-slate-100 rounded px-1.5">
                <span>{f.name}</span>
                <button onClick={() => onDeleteSaved(f.id)} className="hover:text-red-600">×</button>
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-6">
        {projects.map(p => (
          <ProjectGroup
            key={p.id}
            project={p}
            tasks={tasksByProject[p.id] ?? []}
            selected={selected}
            onToggleSelect={toggleSelect}
          />
        ))}
        {!projects.length && <div className="card p-10 text-center text-slate-500">No projects yet.</div>}
      </div>

      <BulkActionBar
        selected={[...selected]}
        onClear={() => setSelected(new Set())}
        onChange={reload}
      />
    </div>
  );
}
