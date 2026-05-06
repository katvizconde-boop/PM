import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { api } from '../api/client.js';
import { useAuth } from '../contexts/AuthContext.jsx';
import { FolderIcon, ListIcon, CalendarIcon } from '../components/icons.jsx';

const STATUS_COLORS = { todo: '#94a3b8', in_progress: '#6366f1', done: '#10b981' };
const STATUS_DOT = {
  todo:        'bg-slate-400',
  in_progress: 'bg-indigo-500',
  done:        'bg-emerald-500',
};
const PRIORITY_BADGE = {
  low:    'bg-slate-100 text-slate-700',
  medium: 'bg-blue-100 text-blue-700',
  high:   'bg-amber-100 text-amber-700',
  urgent: 'bg-red-100 text-red-700',
};

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

function Widget({ title, action, children }) {
  return (
    <div className="card overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
        <h2 className="font-medium text-sm text-slate-700">{title}</h2>
        {action}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function Stat({ label, value, accent }) {
  return (
    <div className="card p-3">
      <div className="text-[11px] uppercase tracking-wide text-slate-500">{label}</div>
      <div className={`text-xl font-semibold mt-0.5 ${accent ?? 'text-slate-800'}`}>{value}</div>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const [summary, setSummary] = useState(null);
  const [myTasks, setMyTasks] = useState([]);
  const [projects, setProjects] = useState([]);

  useEffect(() => {
    api('/dashboard/summary').then(setSummary);
    api(`/tasks?assignee_id=${user.id}`).then(setMyTasks);
    api('/projects').then(setProjects);
  }, [user.id]);

  if (!summary) return <div className="text-slate-500">Loading…</div>;

  const todayIso = new Date().toISOString().slice(0, 10);
  const todoMine = myTasks.filter(t => t.status !== 'done');
  const overdueMine = todoMine.filter(t => t.due_date && t.due_date.slice(0, 10) < todayIso);
  const dueTodayMine = todoMine.filter(t => t.due_date?.slice(0, 10) === todayIso);
  const recentProjects = projects.slice(0, 4);

  const pieData = ['todo', 'in_progress', 'done'].map(k => ({ name: k, value: summary.tasks[k] }));

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h1 className="text-2xl font-semibold">{greeting()}, {user.name?.split(' ')[0]}</h1>
        <p className="text-sm text-slate-500 mt-1">
          Here's what's happening across your projects.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Projects"        value={summary.projects.total} />
        <Stat label="Tasks open"      value={summary.tasks.todo + summary.tasks.in_progress} />
        <Stat label="Completion"      value={`${summary.tasks.completion_rate}%`} accent="text-indigo-600" />
        <Stat label="Overdue"         value={summary.overdue} accent={summary.overdue ? 'text-red-600' : 'text-slate-800'} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Widget
          title="My Work"
          action={<Link to="/tasks" className="text-xs text-indigo-600 hover:underline">View all</Link>}
        >
          {todoMine.length === 0 ? (
            <p className="text-sm text-slate-500">Nothing assigned to you. Nice.</p>
          ) : (
            <ul className="divide-y divide-slate-100 -mx-4">
              {todoMine.slice(0, 6).map(t => {
                const overdue = t.due_date && t.status !== 'done' && t.due_date.slice(0, 10) < todayIso;
                return (
                  <li key={t.id} className="px-4 py-2 flex items-center gap-3 hover:bg-slate-50">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${STATUS_DOT[t.status]}`} />
                    <Link to={`/projects/${t.project_id}`} className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{t.title}</div>
                      <div className="text-xs text-slate-500 truncate">{t.project_name}</div>
                    </Link>
                    <span className={`badge ${PRIORITY_BADGE[t.priority]}`}>{t.priority}</span>
                    {t.due_date && (
                      <span className={`text-xs whitespace-nowrap ${overdue ? 'text-red-600 font-medium' : 'text-slate-500'}`}>
                        {t.due_date.slice(5, 10)}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Widget>

        <Widget
          title="Today & Overdue"
          action={<Link to="/calendar" className="text-xs text-indigo-600 hover:underline">Calendar</Link>}
        >
          <div className="space-y-3">
            {overdueMine.length > 0 && (
              <div>
                <div className="text-xs font-medium text-red-600 mb-1">Overdue ({overdueMine.length})</div>
                <ul className="space-y-1">
                  {overdueMine.slice(0, 3).map(t => (
                    <li key={t.id} className="text-sm">
                      <Link to={`/projects/${t.project_id}`} className="hover:underline">{t.title}</Link>
                      <span className="text-xs text-slate-500 ml-2">· {t.due_date.slice(0, 10)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {dueTodayMine.length > 0 && (
              <div>
                <div className="text-xs font-medium text-indigo-600 mb-1">Today ({dueTodayMine.length})</div>
                <ul className="space-y-1">
                  {dueTodayMine.slice(0, 3).map(t => (
                    <li key={t.id} className="text-sm">
                      <Link to={`/projects/${t.project_id}`} className="hover:underline">{t.title}</Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {overdueMine.length === 0 && dueTodayMine.length === 0 && (
              <p className="text-sm text-slate-500">Nothing due today. You're clear.</p>
            )}
          </div>
        </Widget>

        <Widget
          title="Tasks by status"
        >
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={pieData} dataKey="value" nameKey="name" outerRadius={70} innerRadius={40}>
                {pieData.map(d => <Cell key={d.name} fill={STATUS_COLORS[d.name]} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </Widget>

        <Widget
          title="Recent Projects"
          action={<Link to="/projects" className="text-xs text-indigo-600 hover:underline">View all</Link>}
        >
          {recentProjects.length === 0 ? (
            <p className="text-sm text-slate-500">No projects yet.</p>
          ) : (
            <ul className="space-y-1.5">
              {recentProjects.map(p => {
                const pct = p.task_count ? Math.round((p.done_count / p.task_count) * 100) : 0;
                return (
                  <li key={p.id}>
                    <Link to={`/projects/${p.id}`} className="block hover:bg-slate-50 rounded px-2 py-1.5 -mx-2">
                      <div className="flex items-center gap-2">
                        <FolderIcon className="w-4 h-4 text-slate-400" />
                        <span className="text-sm font-medium flex-1 truncate">{p.name}</span>
                        <span className="text-xs text-slate-500">{p.done_count}/{p.task_count}</span>
                      </div>
                      <div className="h-1 bg-slate-100 rounded mt-1.5 ml-6">
                        <div className="h-1 bg-indigo-500 rounded" style={{ width: `${pct}%` }} />
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Widget>

        <Widget
          title="Open by priority"
          action={<span className="text-xs text-slate-400">{summary.by_priority.reduce((a, p) => a + p.count, 0)} total</span>}
        >
          {summary.by_priority.length === 0 ? (
            <p className="text-sm text-slate-500">No open tasks.</p>
          ) : (
            <ul className="space-y-1.5">
              {['urgent', 'high', 'medium', 'low'].map(p => {
                const row = summary.by_priority.find(r => r.priority === p);
                if (!row) return null;
                return (
                  <li key={p} className="flex items-center justify-between text-sm">
                    <span className={`badge ${PRIORITY_BADGE[p]}`}>{p}</span>
                    <span className="text-slate-700 font-medium">{row.count}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </Widget>
      </div>
    </div>
  );
}
