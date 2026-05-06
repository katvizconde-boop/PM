import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api/client.js';
import { useAuth } from '../contexts/AuthContext.jsx';
import KanbanBoard from '../components/KanbanBoard.jsx';
import ChecklistPanel from '../components/ChecklistPanel.jsx';
import TimerButton from '../components/TimerButton.jsx';

const STATUSES = [
  { value: 'todo',        label: 'To do'      },
  { value: 'in_progress', label: 'In progress'},
  { value: 'done',        label: 'Done'       },
];
const PRIORITIES = ['low', 'medium', 'high', 'urgent'];
const PRIORITY_BADGE = {
  low:    'bg-slate-100 text-slate-700',
  medium: 'bg-blue-100 text-blue-700',
  high:   'bg-amber-100 text-amber-700',
  urgent: 'bg-red-100 text-red-700',
};

function TaskRow({ task, users, entries, runningEntry, onChange }) {
  const update = async (patch) => {
    await api(`/tasks/${task.id}`, { method: 'PATCH', body: patch });
    onChange();
  };
  const overdue = task.due_date && task.status !== 'done' && new Date(task.due_date) < new Date();
  return (
    <tr className="border-t">
      <td className="p-2">
        <div className="font-medium">{task.title}</div>
        {task.description && <div className="text-xs text-slate-500">{task.description}</div>}
        <div className="mt-1">
          <TimerButton
            taskId={task.id}
            entries={entries}
            runningEntry={runningEntry}
            onChange={onChange}
          />
        </div>
      </td>
      <td className="p-2">
        <select className="input py-1" value={task.assignee_id ?? ''}
                onChange={e => update({ assignee_id: e.target.value ? Number(e.target.value) : null })}>
          <option value="">Unassigned</option>
          {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
      </td>
      <td className="p-2">
        <select className="input py-1" value={task.status} onChange={e => update({ status: e.target.value })}>
          {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      </td>
      <td className="p-2">
        <select className={`input py-1 ${PRIORITY_BADGE[task.priority]}`} value={task.priority}
                onChange={e => update({ priority: e.target.value })}>
          {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
      </td>
      <td className={`p-2 text-sm ${overdue ? 'text-red-600 font-medium' : ''}`}>
        {task.due_date ? task.due_date.slice(0, 10) : '—'}
      </td>
    </tr>
  );
}

function NewTaskForm({ projectId, users, onCreate }) {
  const [form, setForm] = useState({ title: '', priority: 'medium', assignee_id: '', due_date: '' });
  const submit = async (e) => {
    e.preventDefault();
    await api('/tasks', {
      method: 'POST',
      body: {
        project_id: Number(projectId),
        title: form.title,
        priority: form.priority,
        assignee_id: form.assignee_id ? Number(form.assignee_id) : null,
        due_date: form.due_date || null,
      },
    });
    setForm({ title: '', priority: 'medium', assignee_id: '', due_date: '' });
    onCreate();
  };
  return (
    <form onSubmit={submit} className="card p-3 grid grid-cols-1 md:grid-cols-5 gap-2 items-end">
      <input className="input md:col-span-2" placeholder="New task title" required
             value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
      <select className="input" value={form.assignee_id} onChange={e => setForm({ ...form, assignee_id: e.target.value })}>
        <option value="">Unassigned</option>
        {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
      </select>
      <select className="input" value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })}>
        {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
      </select>
      <input className="input" type="date" value={form.due_date}
             onChange={e => setForm({ ...form, due_date: e.target.value })} />
      <button className="btn-primary md:col-span-5">Add task</button>
    </form>
  );
}

function Comments({ taskId }) {
  const [comments, setComments] = useState([]);
  const [body, setBody] = useState('');
  const load = () => api(`/comments?task_id=${taskId}`).then(setComments);
  useEffect(() => { load(); }, [taskId]);

  const submit = async (e) => {
    e.preventDefault();
    if (!body.trim()) return;
    await api(`/comments?task_id=${taskId}`, { method: 'POST', body: { body } });
    setBody(''); load();
  };
  return (
    <div className="space-y-2">
      <h3 className="font-medium text-sm">Comments</h3>
      {comments.map(c => (
        <div key={c.id} className="text-sm">
          <span className="font-medium">{c.author_name}: </span>
          <span>{c.body}</span>
          <span className="text-xs text-slate-400 ml-2">{new Date(c.created_at).toLocaleString()}</span>
        </div>
      ))}
      <form onSubmit={submit} className="flex gap-2">
        <input className="input" placeholder="Add a comment…" value={body} onChange={e => setBody(e.target.value)} />
        <button className="btn-primary">Send</button>
      </form>
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
  const [openTaskId, setOpenTaskId] = useState(null);
  const [view, setView] = useState('list');
  // timeByTask: { [taskId]: entries[] }; runningEntry: this user's currently-running entry
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

    // Fetch entries per task in parallel and group by task_id.
    const allEntries = await Promise.all(
      t.map(task => api(`/time?task_id=${task.id}`).then(rows => [task.id, rows]))
    );
    setTimeByTask(Object.fromEntries(allEntries));
  };
  useEffect(() => { load(); }, [id]);

  if (!project) return <div>Loading…</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{project.name}</h1>
        <p className="text-slate-600">{project.description}</p>
        <div className="text-xs text-slate-500 mt-1">
          Owner: {project.owner_name} · Status: {project.status} {project.deadline && `· Due ${project.deadline.slice(0, 10)}`}
        </div>
      </div>

      <ChecklistPanel projectId={id} />

      <NewTaskForm projectId={id} users={users} onCreate={load} />

      <div className="inline-flex rounded-md border border-slate-200 bg-white text-sm" role="tablist">
        {['list', 'board'].map(v => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`px-3 py-1.5 capitalize ${view === v ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
          >
            {v}
          </button>
        ))}
      </div>

      {view === 'board' ? (
        <KanbanBoard tasks={tasks} onChange={load} />
      ) : (
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="p-2">Task</th><th className="p-2">Assignee</th>
              <th className="p-2">Status</th><th className="p-2">Priority</th><th className="p-2">Due</th>
            </tr>
          </thead>
          <tbody>
            {tasks.map(t => (
              <>
                <TaskRow key={t.id} task={t} users={users}
                         entries={timeByTask[t.id] ?? []}
                         runningEntry={runningEntry}
                         onChange={load} />
                <tr key={`${t.id}-actions`}>
                  <td colSpan={5} className="p-2 pl-4 text-xs">
                    <button onClick={() => setOpenTaskId(openTaskId === t.id ? null : t.id)}
                            className="text-indigo-600 hover:underline">
                      {openTaskId === t.id ? 'Hide' : 'Show'} comments
                    </button>
                    {openTaskId === t.id && <div className="mt-2"><Comments taskId={t.id} /></div>}
                  </td>
                </tr>
              </>
            ))}
            {!tasks.length && <tr><td colSpan={5} className="p-4 text-center text-slate-500">No tasks yet.</td></tr>}
          </tbody>
        </table>
      </div>
      )}

      <div className="card p-4">
        <h2 className="font-medium mb-2">Recent activity</h2>
        <ul className="space-y-1 text-sm">
          {activity.map(a => (
            <li key={a.id} className="text-slate-600">
              <span className="font-medium text-slate-800">{a.actor_name}</span>
              {' '}{a.action} {a.entity_type}
              <span className="text-xs text-slate-400 ml-2">{new Date(a.created_at).toLocaleString()}</span>
            </li>
          ))}
          {!activity.length && <li className="text-slate-500">No activity yet.</li>}
        </ul>
      </div>
    </div>
  );
}
