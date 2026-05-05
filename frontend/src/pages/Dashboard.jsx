import { useEffect, useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis } from 'recharts';
import { api } from '../api/client.js';

const STATUS_COLORS = { todo: '#94a3b8', in_progress: '#6366f1', done: '#10b981' };

function Stat({ label, value, accent }) {
  return (
    <div className="card p-4">
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div className={`text-2xl font-semibold mt-1 ${accent ?? ''}`}>{value}</div>
    </div>
  );
}

export default function Dashboard() {
  const [data, setData] = useState(null);
  useEffect(() => { api('/dashboard/summary').then(setData); }, []);
  if (!data) return <div>Loading…</div>;

  const pieData = ['todo', 'in_progress', 'done'].map(k => ({ name: k, value: data.tasks[k] }));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Dashboard</h1>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat label="Projects"        value={data.projects.total} />
        <Stat label="In progress"     value={data.projects.in_progress ?? 0} />
        <Stat label="Completion"      value={`${data.tasks.completion_rate}%`} accent="text-indigo-600" />
        <Stat label="Overdue tasks"   value={data.overdue} accent={data.overdue ? 'text-red-600' : ''} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="card p-4">
          <h2 className="font-medium mb-2">Tasks by status</h2>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={pieData} dataKey="value" nameKey="name" outerRadius={80} label>
                {pieData.map(d => <Cell key={d.name} fill={STATUS_COLORS[d.name]} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="card p-4">
          <h2 className="font-medium mb-2">Open tasks by priority</h2>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={data.by_priority}>
              <XAxis dataKey="priority" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="count" fill="#6366f1" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
