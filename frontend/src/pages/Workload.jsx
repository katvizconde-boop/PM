import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';
import AvatarStack from '../components/AvatarStack.jsx';
import { labelFor } from '../lib/roles.js';

const STATUS_COLORS = { todo: 'bg-slate-300', in_progress: 'bg-indigo-500', done: 'bg-emerald-500' };

// Capacity dashboard — for Analyst Managers / CSMs to spot overload at a glance.
// Pure aggregation client-side from /api/tasks + /api/dashboard/users; no new endpoint.
export default function Workload() {
  const [users, setUsers] = useState([]);
  const [tasks, setTasks] = useState([]);

  useEffect(() => {
    Promise.all([api('/dashboard/users'), api('/tasks')]).then(([u, t]) => { setUsers(u); setTasks(t); });
  }, []);

  const today = new Date().toISOString().slice(0, 10);

  // For each user, count tasks where they are PRIMARY or co-assignee.
  const stats = users.map(u => {
    const mine = tasks.filter(t =>
      t.assignee_id === u.id ||
      (t.co_assignees ?? []).some(ca => ca.id === u.id)
    );
    const open  = mine.filter(t => t.status !== 'done');
    const todo  = mine.filter(t => t.status === 'todo').length;
    const wip   = mine.filter(t => t.status === 'in_progress').length;
    const done  = mine.filter(t => t.status === 'done').length;
    const overdue = open.filter(t => t.due_date && t.due_date.slice(0, 10) < today).length;
    const urgent  = open.filter(t => t.priority === 'urgent').length;
    const total = todo + wip + done;
    return { user: u, open: open.length, todo, wip, done, overdue, urgent, total };
  }).sort((a, b) => b.open - a.open);

  const maxOpen = Math.max(1, ...stats.map(s => s.open));

  return (
    <div className="space-y-5 max-w-6xl">
      <div>
        <h1 className="text-2xl font-semibold">Workload</h1>
        <p className="text-xs text-slate-500 mt-0.5">Open tasks by assignee, ranked by load</p>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="text-[11px] uppercase tracking-wide text-slate-500 bg-slate-50">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Person</th>
              <th className="px-3 py-2 text-left font-medium">Role</th>
              <th className="px-3 py-2 text-left font-medium w-64">Open load</th>
              <th className="px-3 py-2 text-center font-medium w-20">To do</th>
              <th className="px-3 py-2 text-center font-medium w-24">In progress</th>
              <th className="px-3 py-2 text-center font-medium w-20">Done</th>
              <th className="px-3 py-2 text-center font-medium w-20">Overdue</th>
              <th className="px-3 py-2 text-center font-medium w-20">Urgent</th>
            </tr>
          </thead>
          <tbody>
            {stats.map(s => (
              <tr key={s.user.id} className="border-t border-slate-100 hover:bg-slate-50">
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <AvatarStack users={[s.user]} size="sm" max={1} />
                    <span className="font-medium">{s.user.name}</span>
                  </div>
                </td>
                <td className="px-3 py-2.5 text-xs text-slate-500">{labelFor(s.user.role)}</td>
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 bg-slate-100 rounded overflow-hidden flex">
                      {s.todo > 0 && <div className={STATUS_COLORS.todo}        style={{ width: `${(s.todo / maxOpen) * 100}%` }} />}
                      {s.wip  > 0 && <div className={STATUS_COLORS.in_progress} style={{ width: `${(s.wip  / maxOpen) * 100}%` }} />}
                    </div>
                    <span className="text-xs text-slate-600 w-6 text-right">{s.open}</span>
                  </div>
                </td>
                <td className="px-3 py-2.5 text-center text-slate-700">{s.todo}</td>
                <td className="px-3 py-2.5 text-center text-slate-700">{s.wip}</td>
                <td className="px-3 py-2.5 text-center text-slate-500">{s.done}</td>
                <td className={`px-3 py-2.5 text-center ${s.overdue ? 'text-red-600 font-medium' : 'text-slate-400'}`}>
                  {s.overdue || '—'}
                </td>
                <td className={`px-3 py-2.5 text-center ${s.urgent ? 'text-amber-600 font-medium' : 'text-slate-400'}`}>
                  {s.urgent || '—'}
                </td>
              </tr>
            ))}
            {!stats.length && (
              <tr><td colSpan={8} className="p-8 text-center text-slate-500">No users yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-slate-500 italic">
        Includes both primary assignees and co-assignees. "Done" excluded from the open-load bar.
      </p>
    </div>
  );
}
