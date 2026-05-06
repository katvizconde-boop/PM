import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';
import { useAuth } from '../contexts/AuthContext.jsx';

const STATUS_DOT = {
  todo:        'bg-slate-400',
  in_progress: 'bg-indigo-500',
  done:        'bg-emerald-500',
};
const STATUS_LABEL = { todo: 'To do', in_progress: 'In progress', done: 'Done' };
const PRIORITY_BADGE = {
  low:    'bg-slate-100 text-slate-700',
  medium: 'bg-blue-100 text-blue-700',
  high:   'bg-amber-100 text-amber-700',
  urgent: 'bg-red-100 text-red-700',
};

const TABS = [
  { key: 'all',    label: 'All open' },
  { key: 'today',  label: 'Today & Overdue' },
  { key: 'done',   label: 'Done' },
];

function filterTasks(tasks, tab) {
  const today = new Date().toISOString().slice(0, 10);
  if (tab === 'all')   return tasks.filter(t => t.status !== 'done');
  if (tab === 'today') return tasks.filter(t => t.status !== 'done' && t.due_date && t.due_date.slice(0, 10) <= today);
  if (tab === 'done')  return tasks.filter(t => t.status === 'done');
  return tasks;
}

export default function MyTasks() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [tab, setTab]     = useState('all');

  useEffect(() => { api(`/tasks?assignee_id=${user.id}`).then(setTasks); }, [user.id]);

  const visible = filterTasks(tasks, tab);
  const todayIso = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-4 max-w-6xl">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold">My Tasks</h1>
          <p className="text-xs text-slate-500 mt-0.5">{visible.length} task{visible.length === 1 ? '' : 's'}</p>
        </div>
      </div>

      <div className="border-b border-slate-200">
        <div className="flex gap-1">
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-3 py-2 text-sm border-b-2 transition-colors ${
                tab === t.key
                  ? 'border-indigo-600 text-indigo-700 font-medium'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-500">
            <tr>
              <th className="p-3 font-medium">Name</th>
              <th className="p-3 font-medium">Project</th>
              <th className="p-3 font-medium">Status</th>
              <th className="p-3 font-medium">Priority</th>
              <th className="p-3 font-medium">Due date</th>
            </tr>
          </thead>
          <tbody>
            {visible.map(t => {
              const overdue = t.due_date && t.status !== 'done' && t.due_date.slice(0, 10) < todayIso;
              return (
                <tr key={t.id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="p-3">
                    <Link to={`/projects/${t.project_id}`} className="flex items-center gap-2 group">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${STATUS_DOT[t.status]}`} />
                      <span className="font-medium group-hover:text-indigo-700">{t.title}</span>
                    </Link>
                  </td>
                  <td className="p-3 text-slate-600">{t.project_name}</td>
                  <td className="p-3 text-slate-600">{STATUS_LABEL[t.status]}</td>
                  <td className="p-3">
                    <span className={`badge ${PRIORITY_BADGE[t.priority]}`}>{t.priority}</span>
                  </td>
                  <td className={`p-3 ${overdue ? 'text-red-600 font-medium' : 'text-slate-600'}`}>
                    {t.due_date ? t.due_date.slice(0, 10) : '—'}
                  </td>
                </tr>
              );
            })}
            {!visible.length && (
              <tr>
                <td colSpan={5} className="p-8 text-center text-slate-500">
                  Nothing to show in this tab.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
