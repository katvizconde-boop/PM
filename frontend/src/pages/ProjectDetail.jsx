import { Fragment, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api/client.js';
import { useAuth } from '../contexts/AuthContext.jsx';
import KanbanBoard from '../components/KanbanBoard.jsx';
import ChecklistPanel from '../components/ChecklistPanel.jsx';
import NotesPanel from '../components/NotesPanel.jsx';
import TimerButton from '../components/TimerButton.jsx';
import TagInput from '../components/TagInput.jsx';
import AssigneePicker from '../components/AssigneePicker.jsx';
import DependencyPicker from '../components/DependencyPicker.jsx';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import ProjectDashboard from '../components/ProjectDashboard.jsx';
import MilestonesPanel from '../components/MilestonesPanel.jsx';
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

function TaskRow({ task, users, entries, runningEntry, onChange, onOpenComments, openComments, depth = 0, subtaskDraft, setSubtaskDraft, projectTasks, onRequestDelete }) {
  const update = async (patch) => {
    await api(`/tasks/${task.id}`, { method: 'PATCH', body: patch });
    onChange();
  };
  const overdue = task.due_date && task.status !== 'done' && new Date(task.due_date) < new Date();
  const isAddingSub = subtaskDraft?.parentId === task.id;
  const blockedByOpen = task.blocked_by_count > 0;
  return (
    <>
      <tr className="border-t border-slate-100 hover:bg-slate-50">
        <td className="px-3 py-2.5" style={{ paddingLeft: `${0.75 + depth * 1.5}rem` }}>
          <div className="font-medium flex items-center gap-1.5">
            {depth > 0 && <span className="text-slate-300">↳</span>}
            <span>{task.title}</span>
            {blockedByOpen && <span className="text-xs text-red-600" title={`${task.blocked_by_count} blocker(s)`}>🚫{task.blocked_by_count}</span>}
            {task.blocks_count > 0 && <span className="text-xs text-slate-500" title={`blocking ${task.blocks_count}`}>🔗{task.blocks_count}</span>}
          </div>
          {task.description && <div className="text-xs text-slate-500 mt-0.5">{task.description}</div>}
          <div className="mt-1.5 flex items-center gap-3 flex-wrap">
            <TimerButton taskId={task.id} entries={entries} runningEntry={runningEntry} onChange={onChange} />
            <TagInput taskId={task.id} tags={task.tags ?? []} onChange={onChange} />
            {depth === 0 && (
              <button
                onClick={() => setSubtaskDraft(isAddingSub ? null : { parentId: task.id, status: task.status, title: '' })}
                className="text-xs text-slate-400 hover:text-indigo-600"
              >
                + subtask
              </button>
            )}
            <button
              onClick={() => onOpenComments(task.id)}
              className="text-xs text-slate-400 hover:text-indigo-600"
            >
              {openComments === task.id ? 'hide details' : 'details'}
            </button>
          </div>
        </td>
        <td className="px-3 py-2.5">
          <div className="space-y-1">
            <select className="input py-1 text-xs" value={task.assignee_id ?? ''}
                    onChange={e => update({ assignee_id: e.target.value ? Number(e.target.value) : null })}>
              <option value="">Primary…</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
            <AssigneePicker
              taskId={task.id}
              primaryId={task.assignee_id}
              coAssignees={task.co_assignees ?? []}
              allUsers={users}
              onChange={onChange}
            />
          </div>
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
        <tr><td colSpan={6} className="bg-slate-50 px-6 py-3 border-t border-slate-100 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h4 className="text-xs uppercase tracking-wide text-slate-500 mb-1.5">Blocked by</h4>
              <DependencyPicker taskId={task.id} projectTasks={projectTasks} direction="blocked_by" onChange={onChange} />
            </div>
            <div>
              <h4 className="text-xs uppercase tracking-wide text-slate-500 mb-1.5">Blocks</h4>
              <DependencyPicker taskId={task.id} projectTasks={projectTasks} direction="blocks" onChange={onChange} />
            </div>
          </div>
          <Comments taskId={task.id} onChange={onChange} />
          <div className="border-t border-slate-200 pt-3 flex items-center justify-between">
            <span className="text-xs text-slate-500">Created {new Date(task.created_at).toLocaleDateString()}</span>
            <button
              onClick={() => onRequestDelete(task)}
              className="text-xs text-red-600 hover:text-red-700 hover:underline"
            >
              Delete task
            </button>
          </div>
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

function SubtaskCreateRow({ projectId, parent, draft, setDraft, onCreate }) {
  const submit = async (e) => {
    e.preventDefault();
    if (!draft.title.trim()) return;
    await api('/tasks', {
      method: 'POST',
      body: {
        project_id: Number(projectId),
        title: draft.title,
        status: parent.status,
        priority: 'medium',
        parent_task_id: parent.id,
      },
    });
    setDraft(null);
    onCreate();
  };
  return (
    <tr className="border-t border-slate-100 bg-slate-50/50">
      <td colSpan={6} className="px-3 py-2" style={{ paddingLeft: '2.25rem' }}>
        <form onSubmit={submit} className="flex items-center gap-2 text-sm">
          <span className="text-slate-300">↳</span>
          <input
            className="flex-1 border-0 focus:outline-none focus:ring-0 text-sm bg-transparent"
            placeholder="New subtask…"
            autoFocus
            value={draft.title}
            onChange={e => setDraft({ ...draft, title: e.target.value })}
            onKeyDown={e => { if (e.key === 'Escape') setDraft(null); }}
          />
        </form>
      </td>
    </tr>
  );
}

function StatusGroup({ status, parents, subtasksByParent, users, entries, runningEntry, projectId, onChange, openComments, onOpenComments, subtaskDraft, setSubtaskDraft, projectTasks, onRequestDelete }) {
  const [collapsed, setCollapsed] = useState(false);
  const totalCount = parents.reduce((sum, p) => sum + 1 + (subtasksByParent[p.id]?.length ?? 0), 0);

  return (
    <div className="card overflow-hidden">
      <button
        onClick={() => setCollapsed(c => !c)}
        className="w-full flex items-center gap-2 px-3 py-2.5 bg-slate-50 hover:bg-slate-100 border-b border-slate-100"
      >
        {collapsed ? <ChevronRightIcon className="w-4 h-4 text-slate-500" /> : <ChevronDownIcon className="w-4 h-4 text-slate-500" />}
        <StatusBadge status={status} />
        <span className="text-xs text-slate-500">{totalCount}</span>
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
            {parents.map(t => {
              const subs = subtasksByParent[t.id] ?? [];
              return (
                <Fragment key={t.id}>
                  <TaskRow
                    task={t}
                    users={users}
                    entries={entries[t.id] ?? []}
                    runningEntry={runningEntry}
                    onChange={onChange}
                    openComments={openComments}
                    onOpenComments={onOpenComments}
                    depth={0}
                    subtaskDraft={subtaskDraft}
                    setSubtaskDraft={setSubtaskDraft}
                    projectTasks={projectTasks}
                    onRequestDelete={onRequestDelete}
                  />
                  {subtaskDraft?.parentId === t.id && (
                    <SubtaskCreateRow
                      projectId={projectId}
                      parent={t}
                      draft={subtaskDraft}
                      setDraft={setSubtaskDraft}
                      onCreate={onChange}
                    />
                  )}
                  {subs.map(sub => (
                    <TaskRow
                      key={sub.id}
                      task={sub}
                      users={users}
                      entries={entries[sub.id] ?? []}
                      runningEntry={runningEntry}
                      onChange={onChange}
                      openComments={openComments}
                      onOpenComments={onOpenComments}
                      depth={1}
                      subtaskDraft={subtaskDraft}
                      setSubtaskDraft={setSubtaskDraft}
                    />
                  ))}
                </Fragment>
              );
            })}
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
  const [view, setView]       = useState('list');                // sub-view inside Tasks tab
  const [tab,  setTab]        = useState('dashboard');            // top-level project tab
  const [openComments, setOpenComments] = useState(null);
  const [timeByTask, setTimeByTask] = useState({});
  const [runningEntry, setRunningEntry] = useState(null);
  const [milestones, setMilestones] = useState([]);
  // subtaskDraft: { parentId, status, title } when adding a subtask under a parent
  const [subtaskDraft, setSubtaskDraft] = useState(null);
  const [confirmTaskDelete, setConfirmTaskDelete] = useState(null);     // task to delete
  const [confirmProjectDelete, setConfirmProjectDelete] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const [p, t, u, a, running, ms] = await Promise.all([
      api(`/projects/${id}`),
      api(`/tasks?project_id=${id}`),
      api('/dashboard/users'),
      api(`/activity?entity_type=project&entity_id=${id}`),
      api('/time?running=1'),
      api(`/milestones?project_id=${id}`),
    ]);
    setProject(p); setTasks(t); setUsers(u); setActivity(a); setRunningEntry(running);
    setMilestones(ms);
    const allEntries = await Promise.all(
      t.map(task => api(`/time?task_id=${task.id}`).then(rows => [task.id, rows]))
    );
    setTimeByTask(Object.fromEntries(allEntries));
  };
  useEffect(() => { load(); }, [id]);

  if (!project) return <div className="text-slate-500">Loading…</div>;

  // Split top-level (parents) from subtasks. Subtasks render under their parent
  // regardless of parent's status — the status grouping uses the parent's status.
  const subtasksByParent = tasks.reduce((acc, t) => {
    if (t.parent_task_id) (acc[t.parent_task_id] ??= []).push(t);
    return acc;
  }, {});
  const topLevel = tasks.filter(t => !t.parent_task_id);
  const tasksByStatus = STATUSES.reduce((acc, s) => {
    acc[s.value] = topLevel.filter(t => t.status === s.value);
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
        {user?.role === 'admin' && (
          <button
            onClick={() => setConfirmProjectDelete(true)}
            className="text-xs text-red-600 hover:text-red-700 hover:underline"
          >
            Delete project
          </button>
        )}
      </div>

      {/* Top-level project tabs */}
      <div className="border-b border-slate-200">
        <div className="flex gap-1">
          {[
            { key: 'dashboard', label: 'Dashboard' },
            { key: 'roadmap',   label: 'Roadmap'   },
            { key: 'tasks',     label: 'Tasks'     },
            { key: 'notes',     label: 'Notes'     },
          ].map(t => (
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

      {tab === 'dashboard' && (
        <ProjectDashboard
          project={project}
          tasks={tasks}
          users={users}
          activity={activity}
          milestones={milestones}
        />
      )}

      {tab === 'roadmap' && (
        <MilestonesPanel projectId={id} onChange={load} />
      )}

      {tab === 'notes' && (
        <NotesPanel projectId={id} initial={project.notes} updatedAt={project.updated_at} />
      )}

      {tab === 'tasks' && (
      <>
      <ChecklistPanel projectId={id} />

      {/* List/Board sub-toggle */}
      <div className="inline-flex rounded-md border border-slate-200 bg-white text-sm">
        {[
          { key: 'list',  label: 'List'  },
          { key: 'board', label: 'Board' },
        ].map(v => (
          <button
            key={v.key}
            onClick={() => setView(v.key)}
            className={`px-3 py-1.5 capitalize ${view === v.key ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
          >
            {v.label}
          </button>
        ))}
      </div>

      {view === 'board' ? (
        <KanbanBoard tasks={tasks} onChange={load} />
      ) : (
        <div className="space-y-3">
          {STATUSES.map(s => (
            <StatusGroup
              key={s.value}
              status={s.value}
              parents={tasksByStatus[s.value]}
              subtasksByParent={subtasksByParent}
              users={users}
              entries={timeByTask}
              runningEntry={runningEntry}
              projectId={id}
              onChange={load}
              openComments={openComments}
              onOpenComments={(taskId) => setOpenComments(openComments === taskId ? null : taskId)}
              subtaskDraft={subtaskDraft}
              setSubtaskDraft={setSubtaskDraft}
              projectTasks={tasks}
              onRequestDelete={setConfirmTaskDelete}
            />
          ))}
        </div>
      )}
      </>
      )}

      <ConfirmDialog
        open={!!confirmTaskDelete}
        title="Delete this task?"
        message={confirmTaskDelete
          ? `"${confirmTaskDelete.title}" will be permanently removed, along with its comments, time entries, and any subtasks. This cannot be undone.`
          : ''}
        confirmLabel="Delete task"
        busy={busy}
        onCancel={() => setConfirmTaskDelete(null)}
        onConfirm={async () => {
          setBusy(true);
          try {
            await api(`/tasks/${confirmTaskDelete.id}`, { method: 'DELETE' });
            setConfirmTaskDelete(null);
            setOpenComments(null);
            await load();
          } finally { setBusy(false); }
        }}
      />

      <ConfirmDialog
        open={confirmProjectDelete}
        title={`Delete "${project.name}"?`}
        message="This permanently removes the project and every task, comment, checklist item, and time entry inside it. This cannot be undone."
        confirmLabel="Delete project"
        busy={busy}
        onCancel={() => setConfirmProjectDelete(false)}
        onConfirm={async () => {
          setBusy(true);
          try {
            await api(`/projects/${id}`, { method: 'DELETE' });
            // Navigate away — project no longer exists.
            window.location.href = '/projects';
          } finally { setBusy(false); }
        }}
      />
    </div>
  );
}
