import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';
import { taskCode } from '../lib/projectCode.js';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

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

// Pure function: returns 42 cells (6 weeks * 7 days), Monday-first.
export function buildMonthGrid(year, month) {
  const first = new Date(year, month, 1);
  const offset = (first.getDay() + 6) % 7; // Mon=0..Sun=6
  const cells = [];
  for (let i = 0; i < 42; i++) {
    const day = new Date(year, month, i - offset + 1);
    // Local-date ISO so wall-clock date matches what the user sees.
    const iso = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
    cells.push({ date: day, iso, inMonth: day.getMonth() === month });
  }
  return cells;
}

export default function Calendar() {
  const today = new Date();
  const [year,  setYear]   = useState(today.getFullYear());
  const [month, setMonth]  = useState(today.getMonth());
  const [tasks, setTasks]  = useState([]);
  // When a task is "picked" from the unscheduled list, the next calendar-day click
  // assigns it that due_date. Click the task again to deselect.
  const [pickedTaskId, setPickedTaskId] = useState(null);

  const reload = () => api('/tasks').then(setTasks);
  useEffect(() => { reload(); }, []);

  const grid = useMemo(() => buildMonthGrid(year, month), [year, month]);

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

  const unscheduled = useMemo(() => tasks.filter(t => !t.due_date && t.status !== 'done'), [tasks]);

  const shift = (delta) => {
    const d = new Date(year, month + delta, 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth());
  };

  const assignDate = async (iso) => {
    if (!pickedTaskId) return;
    await api(`/tasks/${pickedTaskId}`, { method: 'PATCH', body: { due_date: iso } });
    setPickedTaskId(null);
    reload();
  };

  const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
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

      {pickedTaskId && (
        <div className="card p-2 bg-indigo-50 border-indigo-200 text-sm text-indigo-700 flex items-center justify-between">
          <span>Click a date on the calendar to schedule the picked task.</span>
          <button onClick={() => setPickedTaskId(null)} className="text-xs text-indigo-700 hover:underline">Cancel</button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-4">
        {/* Month grid */}
        <div className="card overflow-hidden">
          <div className="grid grid-cols-7 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            {WEEKDAYS.map(d => <div key={d} className="p-2 text-center">{d}</div>)}
          </div>
          <div className="grid grid-cols-7">
            {grid.map(cell => {
              const dueHere = byDate.get(cell.iso) ?? [];
              const isToday = cell.iso === todayIso;
              const clickable = !!pickedTaskId;
              return (
                <div
                  key={cell.iso}
                  onClick={() => clickable && assignDate(cell.iso)}
                  className={`min-h-[110px] p-1.5 border-t border-l border-slate-100
                    ${cell.inMonth ? '' : 'bg-slate-50/50'}
                    ${clickable ? 'cursor-pointer hover:bg-indigo-50' : ''}`}
                >
                  <div className={`text-xs mb-1 ${isToday ? 'font-semibold text-indigo-600' : cell.inMonth ? 'text-slate-700' : 'text-slate-400'}`}>
                    {cell.date.getDate()}
                  </div>
                  <div className="space-y-1">
                    {dueHere.slice(0, 3).map(t => (
                      <Link
                        key={t.id}
                        to={`/projects/${t.project_id}`}
                        onClick={(e) => clickable && e.preventDefault()}
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

        {/* Unscheduled Tasks rail */}
        <aside className="card p-3 self-start lg:sticky lg:top-4 max-h-[600px] overflow-auto">
          <div className="text-sm font-medium text-slate-700 mb-2">
            Unscheduled tasks
            <span className="text-xs text-slate-400 font-normal ml-1">({unscheduled.length})</span>
          </div>
          <p className="text-[11px] text-slate-500 mb-3">
            Click a task to pick it, then click a date to schedule.
          </p>
          {unscheduled.length === 0 ? (
            <p className="text-xs text-slate-400 italic">Everything has a due date. Nice.</p>
          ) : (
            <ul className="space-y-1.5">
              {unscheduled.map(t => {
                const picked = pickedTaskId === t.id;
                return (
                  <li key={t.id}>
                    <button
                      onClick={() => setPickedTaskId(picked ? null : t.id)}
                      className={`w-full text-left rounded border px-2 py-1.5 text-xs transition-colors ${
                        picked
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'bg-white border-slate-200 hover:border-indigo-300'
                      }`}
                    >
                      <div className="flex items-center gap-1.5">
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${STATUS_DOT[t.status]}`} />
                        <span className={`font-mono text-[9px] opacity-70`}>{taskCode(t.project_name, t.id)}</span>
                        <span className="truncate font-medium">{t.title}</span>
                      </div>
                      <div className={`text-[10px] mt-0.5 flex items-center gap-1 ${picked ? 'text-indigo-100' : 'text-slate-500'}`}>
                        <span className="truncate">{t.project_name}</span>
                        <span className={`badge ${PRIORITY_BADGE[t.priority]} ${picked ? 'ring-1 ring-white/30' : ''}`}>{t.priority}</span>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </aside>
      </div>
    </div>
  );
}
