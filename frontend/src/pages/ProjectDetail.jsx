import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api/client.js';
import { useAuth } from '../contexts/AuthContext.jsx';
import KanbanBoard from '../components/KanbanBoard.jsx';
import ChecklistPanel from '../components/ChecklistPanel.jsx';
import NotesPanel from '../components/NotesPanel.jsx';
import TimerButton from '../components/TimerButton.jsx';
import { ChevronDownIcon, ChevronRightIcon, PlusIcon } from '../components/icons.jsx';

const STATUSES = [
  { value: 'todo',        label: 'To do',       badge: 'bg-slate-100 text-slate-700' },
  { value: 'in_progress', label: 'In progress', badge: 'bg-indigo-100 text-indigo-700' },
  { value: 'done',        label: 'Done',        badge: 'bg-emerald-100 text-emerald-700' },
];
const PRIORITIES = ['low', 'medium', 'high', 'urgent'];
const PRIORITY_BADGE = {
  low:    'bg-slate-100 text-slate-700',
  medium: 'bg-blue-100 text-blue-700',
  high:   'bg-amber-100 text-amber-700',
  urgent: 'bg-red-100 text-red-700',
};

function StatusBadge({ status }) {
  const cfg = STATUSES.find(s => s.value === status);
  return <span className={`badge ${cfg.badge}`}>{cfg.label}</span>;
}

function TaskRow({ task, users, entries, runningEntry, onChange, onOpenComments, openComments }) {
  const update = async (patch) => {
    await api(`/tasks/${task.id}`, { method: 'PATCH', body: patch });
    onChange();
  };
  const overdue = task.due_date && task.status !== 'done' && new Date(task.due_date) < new Date();
  return (
    <>
      <tr className="border-t border-slate-100 hover:bg-slate-50">
        <td className="px-3 py-2.5">
          <div className="font-medium">{task.title}</div>
          {task.description && <div className="text-xs text-slate-500 mt-0.5">{task.description}</div>}
          <div className="mt-1.5">
            <TimerButton taskId={task.id} entries={entries} runningEntry={runningEntry} onChange={onChange} />
          </div>
        </td>
        <td className="px-3 py-2.5">
          <select className="input py-1 text-xs" value={task.assignee_id ?? ''}
                  onChange={e => update({ assignee_id: e.target.value ? Number(e.target.value) : null })}>
            <option value="">Unassigned</option>
            {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </td>
        <td className={`px-3 py-2.5 text-xs ${overdue ? 'text-red-600 font-medium' : 'text-slate-600'}`}>
          {task.due_date ? task.due_date.slice(0, 10) : <span className="text-slate-300">—</span>}
        </td>
        <td className="px-3 py-2.5">
          <select className={`input py-1 text-xs ${PRIORITY_BADGE[task.priority]}`} value={task.priority}
                  onChange={e => update({ priority: e.target.value })}>
            {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </td>
        <td className="px-3 py-2.5">
          <select className="input py-1 text-xs" value={task.status}
                  onChange={e => update({ status: e.target.value })}>
            {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </td>
        <td className="px-3 py-2.5 text-center">
          <button
            onClick={() => onOpenComments(task.id)}
            className={`text-xs ${task.comments_count > 0 ? 'text-indigo-600 hover:underline' : 'text-slate-400 hover:text-slate-600'}`}
          >
            {task.comments_count > 0 ? `${task.comments_count} 💬` : '💬'}
          </button>
        </td>
      </tr>
      {openComments === task.id && (
        <tr><td colSpan={6} className="bg-slate-50 px-6 py-3 border-t border-slate-100">
          <Comments taskId={task.id} onChange={onChange} />
        </td></tr>
      )}
    </>
  );
}

function NewTaskInline({ projectId, status, users, onCreate }) {
  const [title, setTitle] = useState('');
  const submit = async (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    await api('/tasks', {
      method: 'POST',
      body: { project_id: Number(projectId), title, status, priority: 'medium' },
    });
    setTitle(''); onCreate();
  };
  return (
    <tr className="border-t border-slate-100">
      <td colSpan={6} className="px-3 py-2">
        <form onSubmit={submit} className="flex items-center gap-2 text-sm">
          <PlusIcon className="w-4 h-4 text-slate-400" />
          <input
            className="flex-1 border-0 focus:outline-none focus:ring-0 text-sm bg-transparent"
            placeholder="Add task…"
            value={title}
            onChange={e => setTitle(e.target.value)}
          />
        </form>
      </td>
    </tr>
  );
}

function Comments({ taskId, onChange }) {
  const [comments, setComments] = useState([]);
  const [body, setBody] = useState('');
  const load = () => api(`/comments?task_id=${taskId}`).then(setComments);
  useEffect(() => { load(); }, [taskId]);
  const submit = async (e) => {
    e.preventDefault();
    if (!body.trim()) return;
    await api(`/comments?task_id=${taskId}`, { method: 'POST', body: { body } });
    setBody(''); load(); onChange();
  };
  return (
    <div className="space-y-2">
      <div className="space-y-1.5">
        {comments.map(c => (
          <div key={c.id} className="text-sm">
            <span className="font-medium">{c.author_name}</span>
            <span className="text-xs text-slate-400 ml-2">{new Date(c.created_at).toLocaleString()}</span>
            <div className="text-slate-700">{c.body}</div>
          </div>
        ))}
        {!comments.length && <div className="text-xs text-slate-500 italic">No comments yet.</div>}
      </div>
      <form onSubmit={submit} className="flex gap-2 pt-1">
        <input className="input" placeholder="Add a comment…" value={body} onChange={e => setBody(e.target.value)} />
        <button className="btn-primary">Send</button>
      </form>
    </div>
  );
}

function StatusGroup({ status, tasks, users, entries, runningEntry, projectId, onChange, openComments, onOpenComments }) {
  const [collapsed, setCollapsed] = useState(false);
  const cfg = STATUSES.find(s => s.value === status);
  return (
    <div className="card overflow-hidden">
      <button
        onClick={() => setCollapsed(c => !c)}
        className="w-full flex items-center gap-2 px-3 py-2.5 bg-slate-50 hover:bg-slate-100 border-b border-slate-100"
      >
        {collapsed ? <ChevronRightIcon className="w-4 h-4 text-slate-500" /> : <ChevronDownIcon className="w-4 h-4 text-slate-500" />}
        <StatusBadge status={status} />
        <span className="text-xs text-slate-500">{tasks.length}</span>
      </button>
      {!collapsed && (
        <table className="w-full text-sm">
          <thead className="text-[11px] uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Name</th>
              <th className="px-3 py-2 text-left font-medium w-40">Assignee</th>
              <th className="px-3 py-2 text-left font-medium w-28">Due date</th>
              <th className="px-3 py-2 text-left font-medium w-28">Priority</th>
              <th className="px-3 py-2 text-left font-medium w-32">Status</th>
              <th className="px-3 py-2 text-center font-medium w-24">Comments</th>
            </tr>
          </thead>
          <tbody>
            {tasks.map(t => (
              <TaskRow
                key={t.id}
                task={t}
                users={users}
                entries={entries[t.id] ?? []}
                runningEntry={runningEntry}
                onChange={onChange}
                openComments={openComments}
                onOpenComments={onOpenComments}
              />
            ))}
            <NewTaskInline projectId={projectId} status={status} users={users} onCreate={onChange} />
          </tbody>
        </table>
      )}
    </div>
  );
}

export default function ProjectDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const [project, setProject] = useState(null);
  const [tasks, setTasks]     = useState([]);
  const [users, setUsers]     = useState([]);
  const [activity, setActivity] = useState([]);
  const [view, setView]       = useState('list');
  const [openComments, setOpenComments] = useState(null);
  const [timeByTask, setTimeByTask] = useState({});
  const [runningEntry, setRunningEntry] = useState(null);

  const load = async () => {
    const [p, t, u, a, running] = await Promise.all([
      api(`/projects/${id}`),
      api(`/tasks?project_id=${id}`),
      api('/dashboard/users'),
      api(`/activity?entity_type=project&entity_id=${id}`),
      api('/time?running=1'),
    ]);
    setProject(p); setTasks(t); setUsers(u); setActivity(a); setRunningEntry(running);
    const allEntries = await Promise.all(
      t.map(task => api(`/time?task_id=${task.id}`).then(rows => [task.id, rows]))
    );
    setTimeByTask(Object.fromEntries(allEntries));
  };
  useEffect(() => { load(); }, [id]);

  if (!project) return <div className="text-slate-500">Loading…</div>;

  const tasksByStatus = STATUSES.reduce((acc, s) => {
    acc[s.value] = tasks.filter(t => t.status === s.value);
    return acc;
  }, {});

  return (
    <div className="space-y-5 max-w-7xl">
      {/* Breadcrumb */}
      <nav className="text-sm text-slate-500 flex items-center gap-1.5">
        <Link to="/projects" className="hover:text-slate-700">Projects</Link>
        <span className="text-slate-300">/</span>
        <span className="text-slate-800 font-medium">{project.name}</span>
      </nav>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{project.name}</h1>
          {project.description && <p className="text-sm text-slate-600 mt-1">{project.description}</p>}
          <div className="text-xs text-slate-500 mt-2">
            Owner: {project.owner_name} · Status: {project.status.replace('_', ' ')} {project.deadline && `· Due ${project.deadline.slice(0, 10)}`}
          </div>
        </div>
      </div>

      {/* View toggle */}
      <div className="border-b border-slate-200">
        <div className="flex gap-1">
          {[
            { key: 'list',  label: 'List'  },
            { key: 'board', label: 'Board' },
          ].map(v => (
            <button
              key={v.key}
              onClick={() => setView(v.key)}
              className={`px-3 py-2 text-sm border-b-2 transition-colors ${
                view === v.key
                  ? 'border-indigo-600 text-indigo-700 font-medium'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>

      <ChecklistPanel projectId={id} />

      {view === 'board' ? (
        <KanbanBoard tasks={tasks} onChange={load} />
      ) : (
        <div className="space-y-3">
          {STATUSES.map(s => (
            <StatusGroup
              key={s.value}
              status={s.value}
              tasks={tasksByStatus[s.value]}
              users={users}
              entries={timeByTask}
              runningEntry={runningEntry}
              projectId={id}
              onChange={load}
              openComments={openComments}
              onOpenComments={(taskId) => setOpenComments(openComments === taskId ? null : taskId)}
            />
          ))}
        </div>
      )}

      <NotesPanel projectId={id} initial={project.notes} updatedAt={project.updated_at} />

      <div className="card p-4">
        <h2 className="font-medium mb-2 text-sm text-slate-700">Recent activity</h2>
        <ul className="space-y-1 text-sm">
          {activity.slice(0, 10).map(a => (
            <li key={a.id} className="text-slate-600">
              <span className="font-medium text-slate-800">{a.actor_name}</span>
              {' '}{a.action.replace('_', ' ')} {a.entity_type}
              <span className="text-xs text-slate-400 ml-2">{new Date(a.created_at).toLocaleString()}</span>
            </li>
          ))}
          {!activity.length && <li className="text-slate-500">No activity yet.</li>}
        </ul>
      </div>
    </div>
  );
}
