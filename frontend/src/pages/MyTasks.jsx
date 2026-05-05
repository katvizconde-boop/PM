import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';
import { useAuth } from '../contexts/AuthContext.jsx';

export default function MyTasks() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState([]);
  useEffect(() => { api(`/tasks?assignee_id=${user.id}`).then(setTasks); }, [user.id]);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">My Tasks</h1>
      <div className="card divide-y">
        {tasks.map(t => (
          <Link key={t.id} to={`/projects/${t.project_id}`} className="flex justify-between items-center p-3 hover:bg-slate-50">
            <div>
              <div className="font-medium">{t.title}</div>
              <div className="text-xs text-slate-500">{t.project_name}</div>
            </div>
            <div className="text-xs text-slate-500">
              {t.due_date ? t.due_date.slice(0, 10) : '—'} · {t.status}
            </div>
          </Link>
        ))}
        {!tasks.length && <div className="p-4 text-slate-500">Nothing assigned to you.</div>}
      </div>
    </div>
  );
}
