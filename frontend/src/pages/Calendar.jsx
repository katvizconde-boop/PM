import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const STATUS_DOT = {
  todo:        'bg-slate-400',
  in_progress: 'bg-indigo-500',
  done:        'bg-emerald-500',
};

// Pure function: returns 42 cells (6 weeks * 7 days), Monday-first.
export function buildMonthGrid(year, month) {
  const first = new Date(year, month, 1);
  // JS getDay: 0 = Sun. Convert to Mon=0..Sun=6.
  const offset = (first.getDay() + 6) % 7;
  const cells = [];
  for (let i = 0; i < 42; i++) {
    const day = new Date(year, month, i - offset + 1);
    // Build the iso string from LOCAL date components — toISOString() uses UTC
    // and shifts the date in non-zero-offset timezones, which would mismatch
    // the wall-clock date the user sees in the cell.
    const iso = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
    cells.push({ date: day, iso, inMonth: day.getMonth() === month });
  }
  return cells;
}

export default function Calendar() {
  const today = new Date();
  const [year, setYear]   = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [tasks, setTasks] = useState([]);

  useEffect(() => { api('/tasks').then(setTasks); }, []);

  const grid = useMemo(() => buildMonthGrid(year, month), [year, month]);

  // Map ISO date -> tasks due that day. Pre-compute once per task list change.
  const byDate = useMemo(() => {
    const map = new Map();
    for (const t of tasks) {
      if (!t.due_date) continue;
      const key = t.due_date.slice(0, 10);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(t);
    }
    return map;
  }, [tasks]);

  const shift = (delta) => {
    const d = new Date(year, month + delta, 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth());
  };

  const todayIso = today.toISOString().slice(0, 10);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Calendar</h1>
        <div className="flex items-center gap-2">
          <button onClick={() => shift(-1)} className="btn-ghost">←</button>
          <div className="font-medium w-40 text-center">{MONTHS[month]} {year}</div>
          <button onClick={() => shift(1)}  className="btn-ghost">→</button>
          <button onClick={() => { setYear(today.getFullYear()); setMonth(today.getMonth()); }} className="btn-ghost ml-2">
            Today
          </button>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="grid grid-cols-7 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          {WEEKDAYS.map(d => <div key={d} className="p-2 text-center">{d}</div>)}
        </div>
        <div className="grid grid-cols-7">
          {grid.map(cell => {
            const dueHere = byDate.get(cell.iso) ?? [];
            return (
              <div
                key={cell.iso}
                className={`min-h-[110px] p-1.5 border-t border-l border-slate-100 ${cell.inMonth ? '' : 'bg-slate-50/50'}`}
              >
                <div className={`text-xs mb-1 ${cell.iso === todayIso ? 'font-semibold text-indigo-600' : cell.inMonth ? 'text-slate-700' : 'text-slate-400'}`}>
                  {cell.date.getDate()}
                </div>
                <div className="space-y-1">
                  {dueHere.slice(0, 3).map(t => (
                    <Link
                      key={t.id}
                      to={`/projects/${t.project_id}`}
                      className="flex items-center gap-1 text-xs rounded px-1 py-0.5 bg-white border border-slate-200 hover:bg-slate-50 truncate"
                      title={`${t.title} · ${t.project_name}`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${STATUS_DOT[t.status]}`} />
                      <span className="truncate">{t.title}</span>
                    </Link>
                  ))}
                  {dueHere.length > 3 && (
                    <div className="text-xs text-slate-500">+{dueHere.length - 3} more</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
