import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';
import { ChevronDownIcon, ChevronRightIcon, FolderIcon } from '../components/icons.jsx';

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

function StatusGroup({ status, tasks, collapsed, onToggle }) {
  const cfg = STATUSES.find(s => s.value === status);
  if (!tasks.length) return null;
  return (
    <div className="card overflow-hidden">
      <button onClick={onToggle} className="w-full flex items-center gap-2 px-3 py-2.5 bg-slate-50 hover:bg-slate-100 border-b border-slate-100">
        {collapsed ? <ChevronRightIcon className="w-4 h-4 text-slate-500" /> : <ChevronDownIcon className="w-4 h-4 text-slate-500" />}
        <span className={`badge ${cfg.badge}`}>{cfg.label}</span>
        <span className="text-xs text-slate-500">{tasks.length}</span>
      </button>
      {!collapsed && (
        <table className="w-full text-sm">
          <thead className="text-[11px] uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Name</th>
              <th className="px-3 py-2 text-left font-medium w-32">Assignee</th>
              <th className="px-3 py-2 text-left font-medium w-28">Due date</th>
              <th className="px-3 py-2 text-left font-medium w-28">Priority</th>
              <th className="px-3 py-2 text-center font-medium w-20">Comments</th>
            </tr>
          </thead>
          <tbody>
            {tasks.map(t => {
              const overdue = t.due_date && t.status !== 'done' && t.due_date.slice(0, 10) < new Date().toISOString().slice(0, 10);
              return (
                <tr key={t.id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-3 py-2.5">
                    <Link to={`/projects/${t.project_id}`} className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${STATUS_DOT[t.status]}`} />
                      <span className="font-medium hover:text-indigo-700">{t.title}</span>
                    </Link>
                  </td>
                  <td className="px-3 py-2.5 text-slate-600">{t.assignee_name ?? <span className="text-slate-400">Unassigned</span>}</td>
                  <td className={`px-3 py-2.5 text-xs ${overdue ? 'text-red-600 font-medium' : 'text-slate-600'}`}>
                    {t.due_date ? t.due_date.slice(0, 10) : <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-3 py-2.5">
                    <span className={`badge ${PRIORITY_BADGE[t.priority]}`}>{t.priority}</span>
                  </td>
                  <td className="px-3 py-2.5 text-center text-xs text-slate-500">
                    {t.comments_count > 0 ? `${t.comments_count}` : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

function ProjectGroup({ project, tasks }) {
  const [collapsed, setCollapsed] = useState(false);
  const [statusCollapsed, setStatusCollapsed] = useState({});
  const total = tasks.length;
  const byStatus = STATUSES.reduce((acc, s) => { acc[s.value] = tasks.filter(t => t.status === s.value); return acc; }, {});

  return (
    <section className="space-y-2">
      <button
        onClick={() => setCollapsed(c => !c)}
        className="flex items-center gap-2 text-left group"
      >
        {collapsed ? <ChevronRightIcon className="w-4 h-4 text-slate-500" /> : <ChevronDownIcon className="w-4 h-4 text-slate-500" />}
        <FolderIcon className="w-4 h-4 text-slate-400" />
        <Link to={`/projects/${project.id}`} className="font-medium hover:text-indigo-700">{project.name}</Link>
        <span className="text-xs text-slate-500">{total}</span>
      </button>

      {!collapsed && (
        <div className="space-y-2 pl-6">
          {STATUSES.map(s => (
            <StatusGroup
              key={s.value}
              status={s.value}
              tasks={byStatus[s.value]}
              collapsed={statusCollapsed[s.value]}
              onToggle={() => setStatusCollapsed(prev => ({ ...prev, [s.value]: !prev[s.value] }))}
            />
          ))}
        </div>
      )}
    </section>
  );
}

export default function AllTasks() {
  const [tasks,    setTasks]    = useState([]);
  const [projects, setProjects] = useState([]);

  useEffect(() => {
    Promise.all([api('/tasks'), api('/projects')]).then(([t, p]) => { setTasks(t); setProjects(p); });
  }, []);

  // Group tasks by project_id; iterate over projects in created-order so the page is stable.
  const tasksByProject = tasks.reduce((acc, t) => {
    (acc[t.project_id] ??= []).push(t);
    return acc;
  }, {});

  return (
    <div className="space-y-5 max-w-7xl">
      <div>
        <h1 className="text-2xl font-semibold">All Tasks</h1>
        <p className="text-xs text-slate-500 mt-0.5">{tasks.length} task{tasks.length === 1 ? '' : 's'} across {projects.length} project{projects.length === 1 ? '' : 's'}</p>
      </div>

      <div className="space-y-6">
        {projects.map(p => (
          <ProjectGroup key={p.id} project={p} tasks={tasksByProject[p.id] ?? []} />
        ))}
        {!projects.length && (
          <div className="card p-10 text-center text-slate-500">No projects yet.</div>
        )}
      </div>
    </div>
  );
}
