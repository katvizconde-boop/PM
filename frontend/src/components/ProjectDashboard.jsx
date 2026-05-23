import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { api } from '../api/client.js';
import { labelFor } from '../lib/roles.js';
import { formatDuration, sumDurations } from '../lib/time.js';
import AvatarStack from './AvatarStack.jsx';

const STATUS_COLORS = { todo: '#94a3b8', in_progress: '#6366f1', done: '#10b981' };
const STATUS_DOT = {
  todo:        'bg-slate-400',
  in_progress: 'bg-indigo-500',
  done:        'bg-emerald-500',
};

function Widget({ title, action, children, className = '' }) {
  return (
    <div className={`card overflow-hidden ${className}`}>
      <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
        <h3 className="font-medium text-sm text-slate-700">{title}</h3>
        {action}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

// Project-level dashboard rendered inside the Dashboard tab on ProjectDetail.
// Pulls data already loaded by the parent (project, tasks, users, activity)
// and adds milestones + cross-task time. No new API endpoints needed.
export default function ProjectDashboard({ project, tasks, users, activity, milestones }) {
  const [allTime, setAllTime] = useState([]);

  // Sum time across every task in the project. Fetch once per task list change.
  useEffect(() => {
    if (!tasks.length) { setAllTime([]); return; }
    Promise.all(tasks.map(t => api(`/time?task_id=${t.id}`)))
      .then(arrs => setAllTime(arrs.flat()));
  }, [tasks]);

  const taskStatus = useMemo(() => {
    const acc = { todo: 0, in_progress: 0, done: 0 };
    for (const t of tasks) acc[t.status] = (acc[t.status] ?? 0) + 1;
    return acc;
  }, [tasks]);

  const pieData = ['todo', 'in_progress', 'done'].map(k => ({ name: k, value: taskStatus[k] }));

  // Project members = owner + everyone who's primary or co-assignee on any task.
  // De-dup by id, preserve insertion order so owner shows first.
  const members = useMemo(() => {
    const seen = new Map();
    const owner = users.find(u => u.id === project.owner_id);
    if (owner) seen.set(owner.id, { ...owner, role_in_project: 'Owner' });
    for (const t of tasks) {
      if (t.assignee_id && !seen.has(t.assignee_id)) {
        const u = users.find(x => x.id === t.assignee_id);
        if (u) seen.set(u.id, { ...u, role_in_project: 'Assignee' });
      }
      for (const ca of t.co_assignees ?? []) {
        if (!seen.has(ca.id)) {
          const u = users.find(x => x.id === ca.id) ?? ca;
          seen.set(u.id, { ...u, role_in_project: 'Collaborator' });
        }
      }
    }
    return [...seen.values()];
  }, [project, tasks, users]);

  const totalSeconds = sumDurations(allTime);
  const completionPct = tasks.length ? Math.round((taskStatus.done / tasks.length) * 100) : 0;
  const overdueCount = tasks.filter(t =>
    t.status !== 'done' && t.due_date && t.due_date.slice(0, 10) < new Date().toISOString().slice(0, 10)
  ).length;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Project Outline */}
      <Widget title="Project Outline" className="lg:col-span-2">
        {project.description
          ? <p className="text-sm text-slate-700 whitespace-pre-wrap">{project.description}</p>
          : <p className="text-sm text-slate-400 italic">No description yet.</p>}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4 pt-3 border-t border-slate-100">
          <div>
            <div className="text-[10px] uppercase tracking-wide text-slate-500">Status</div>
            <div className="text-sm font-medium mt-0.5 capitalize">{project.status.replace('_', ' ')}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wide text-slate-500">Completion</div>
            <div className="text-sm font-medium mt-0.5 text-indigo-600">{completionPct}%</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wide text-slate-500">Overdue</div>
            <div className={`text-sm font-medium mt-0.5 ${overdueCount ? 'text-red-600' : 'text-slate-700'}`}>{overdueCount}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wide text-slate-500">Deadline</div>
            <div className="text-sm font-medium mt-0.5">{project.deadline?.slice(0, 10) ?? '—'}</div>
          </div>
        </div>
      </Widget>

      {/* Activity */}
      <Widget title="Activity" className="lg:row-span-2">
        <ul className="space-y-2 text-sm max-h-96 overflow-auto -mr-2 pr-2">
          {activity.slice(0, 15).map(a => (
            <li key={a.id} className="text-slate-600">
              <span className="font-medium text-slate-800">{a.actor_name}</span>
              {' '}{a.action.replace('_', ' ')} {a.entity_type}
              <div className="text-[11px] text-slate-400">{new Date(a.created_at).toLocaleString()}</div>
            </li>
          ))}
          {!activity.length && <li className="text-slate-400 italic text-xs">No activity yet.</li>}
        </ul>
      </Widget>

      {/* Members */}
      <Widget title={`Members (${members.length})`} className="lg:col-span-2">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {members.map(m => (
            <div key={m.id} className="flex items-center gap-2">
              <AvatarStack users={[m]} size="md" max={1} />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium truncate">{m.name}</div>
                <div className="text-xs text-slate-500 truncate">
                  {m.role_in_project} · {labelFor(m.role)}
                </div>
              </div>
            </div>
          ))}
          {!members.length && <div className="text-sm text-slate-400 italic">No members yet.</div>}
        </div>
      </Widget>

      {/* Task breakout */}
      <Widget title="Task breakout by status">
        {tasks.length === 0 ? (
          <p className="text-sm text-slate-400 italic">No tasks yet.</p>
        ) : (
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={pieData} dataKey="value" nameKey="name" outerRadius={70} innerRadius={45} label>
                {pieData.map(d => <Cell key={d.name} fill={STATUS_COLORS[d.name]} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        )}
      </Widget>

      {/* Milestones */}
      <Widget
        title={`Milestones (${milestones.length})`}
        action={milestones.length > 0 && <span className="text-xs text-slate-400">progress</span>}
      >
        {milestones.length === 0 ? (
          <p className="text-sm text-slate-400 italic">No milestones yet. Add them in the Roadmap tab.</p>
        ) : (
          <ul className="space-y-2">
            {milestones.slice(0, 6).map(m => {
              const pct = m.task_count ? Math.round((m.done_count / m.task_count) * 100) : 0;
              return (
                <li key={m.id} className="space-y-1">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="flex-1 truncate font-medium">{m.name}</span>
                    <span className="text-xs text-slate-500">{pct}%</span>
                  </div>
                  <div className="h-1 bg-slate-100 rounded overflow-hidden">
                    <div className="h-1 bg-indigo-500" style={{ width: `${pct}%` }} />
                  </div>
                  {(m.start_date || m.end_date) && (
                    <div className="text-[11px] text-slate-400">
                      {m.start_date?.slice(0, 10) ?? '?'} → {m.end_date?.slice(0, 10) ?? '?'}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Widget>

      {/* Time tracking */}
      <Widget title="Time tracking">
        <div className="text-3xl font-semibold tabular-nums">{formatDuration(totalSeconds)}</div>
        <div className="text-xs text-slate-500 mt-1">
          Total logged across {tasks.length} task{tasks.length === 1 ? '' : 's'}
        </div>
        {allTime.length > 0 && (
          <div className="mt-3 pt-3 border-t border-slate-100">
            <div className="text-[10px] uppercase tracking-wide text-slate-500 mb-1">Recent entries</div>
            <ul className="space-y-1">
              {allTime.slice(0, 4).map(e => (
                <li key={e.id} className="flex items-center justify-between text-xs">
                  <span className="text-slate-600 truncate">{e.user_name}</span>
                  <span className="tabular-nums text-slate-500">{formatDuration(e.duration_seconds)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Widget>
    </div>
  );
}
