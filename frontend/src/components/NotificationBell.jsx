import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';

const SEEN_KEY = 'pm_activity_last_seen';
const POLL_MS  = 30_000;

// Map activity_logs rows to a clickable destination — only some entity_types
// route somewhere useful. Comment activity points at the parent task's project.
function destination(a) {
  if (a.entity_type === 'project') return `/projects/${a.entity_id}`;
  if (a.entity_type === 'task'    && a.metadata?.project_id) return `/projects/${a.metadata.project_id}`;
  if (a.entity_type === 'comment' && a.metadata?.task_id)    return null; // we only have task_id, not project_id
  return null;
}

function summary(a) {
  return `${a.actor_name} ${a.action.replace('_', ' ')} ${a.entity_type}`;
}

export default function NotificationBell() {
  const [items, setItems]   = useState([]);
  const [open, setOpen]     = useState(false);
  const [lastSeen, setSeen] = useState(() => Number(localStorage.getItem(SEEN_KEY)) || 0);
  const ref = useRef(null);

  // Poll the global activity feed. Cheap — capped at 100 rows server-side.
  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const data = await api('/activity');
        if (alive) setItems(data);
      } catch { /* network blip — try again next interval */ }
    };
    tick();
    const id = setInterval(tick, POLL_MS);
    return () => { alive = false; clearInterval(id); };
  }, []);

  // Close popover on outside click.
  useEffect(() => {
    if (!open) return;
    const onClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  const unread = items.filter(a => new Date(a.created_at).getTime() > lastSeen).length;

  const togglePanel = () => {
    if (!open && items.length) {
      const newest = new Date(items[0].created_at).getTime();
      localStorage.setItem(SEEN_KEY, String(newest));
      setSeen(newest);
    }
    setOpen(!open);
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={togglePanel}
        className="relative w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm text-slate-600 hover:bg-slate-100"
        aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
             strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        <span>Activity</span>
        {unread > 0 && (
          <span className="ml-auto inline-flex items-center justify-center min-w-[18px] h-[18px] text-xs font-medium bg-red-500 text-white rounded-full px-1">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute left-full ml-2 top-0 w-80 max-h-96 overflow-auto card p-2 z-10">
          {items.length === 0 && <div className="p-3 text-sm text-slate-500">No activity yet.</div>}
          {items.slice(0, 30).map(a => {
            const dest = destination(a);
            const text = summary(a);
            const when = new Date(a.created_at).toLocaleString();
            const inner = (
              <div className="px-2 py-1.5 text-sm hover:bg-slate-50 rounded">
                <div className="text-slate-700">{text}</div>
                <div className="text-xs text-slate-400">{when}</div>
              </div>
            );
            return dest
              ? <Link key={a.id} to={dest} onClick={() => setOpen(false)} className="block">{inner}</Link>
              : <div key={a.id}>{inner}</div>;
          })}
        </div>
      )}
    </div>
  );
}
