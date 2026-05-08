import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client.js';
import { SearchIcon, FolderIcon, ListIcon } from './icons.jsx';

// Lightweight global search. Fetches projects + tasks once on focus, filters
// client-side as the user types. Matches title/name + tag substrings.
// Cmd/Ctrl-K from anywhere focuses the input.
export default function SearchBar() {
  const [q,         setQ]         = useState('');
  const [open,      setOpen]      = useState(false);
  const [projects,  setProjects]  = useState([]);
  const [tasks,     setTasks]     = useState([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef(null);
  const nav = useNavigate();

  // Cmd-K / Ctrl-K → focus the input.
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  // Lazy-load the corpus on first focus. Refetch every focus so tag/title edits show up.
  const focus = () => {
    setOpen(true);
    Promise.all([api('/projects'), api('/tasks')]).then(([p, t]) => {
      setProjects(p); setTasks(t);
    }).catch(() => {});
  };

  const close = () => { setOpen(false); setActiveIdx(0); };

  const ql = q.trim().toLowerCase();
  const matchedProjects = ql
    ? projects.filter(p => p.name.toLowerCase().includes(ql)).slice(0, 5)
    : [];
  const matchedTasks = ql
    ? tasks.filter(t =>
        t.title.toLowerCase().includes(ql) ||
        (t.tags ?? []).some(tag => tag.toLowerCase().includes(ql))
      ).slice(0, 8)
    : [];
  const results = [
    ...matchedProjects.map(p => ({ type: 'project', id: p.id, label: p.name, dest: `/projects/${p.id}` })),
    ...matchedTasks.map(t => ({ type: 'task',    id: t.id, label: t.title, sub: t.project_name, tags: t.tags, dest: `/projects/${t.project_id}` })),
  ];

  const go = (r) => { close(); setQ(''); nav(r.dest); };

  const onKeyDown = (e) => {
    if (e.key === 'Escape')    { close(); inputRef.current?.blur(); }
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, results.length - 1)); }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, 0)); }
    if (e.key === 'Enter')     { if (results[activeIdx]) go(results[activeIdx]); }
  };

  return (
    <div className="flex-1 max-w-md relative">
      <SearchIcon className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
      <input
        ref={inputRef}
        className="w-full pl-8 pr-12 py-1.5 text-sm bg-slate-100 hover:bg-slate-50 focus:bg-white border border-transparent focus:border-indigo-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-100"
        placeholder="Search projects + tasks…"
        value={q}
        onChange={e => { setQ(e.target.value); setActiveIdx(0); }}
        onFocus={focus}
        onBlur={() => setTimeout(close, 150)} // delay so click on a result registers first
        onKeyDown={onKeyDown}
      />
      <kbd className="hidden md:flex absolute right-2 top-1/2 -translate-y-1/2 items-center gap-0.5 text-[10px] text-slate-400 bg-white border border-slate-200 rounded px-1 py-0.5">
        ⌘K
      </kbd>

      {open && q && (
        <div className="absolute left-0 right-0 top-full mt-1 card overflow-hidden z-30 max-h-96 overflow-y-auto">
          {results.length === 0 && <div className="p-3 text-sm text-slate-500">No matches.</div>}
          {results.map((r, idx) => {
            const Icon = r.type === 'project' ? FolderIcon : ListIcon;
            const active = idx === activeIdx;
            return (
              <button
                key={`${r.type}-${r.id}`}
                onMouseDown={() => go(r)}                       // mousedown beats blur
                onMouseEnter={() => setActiveIdx(idx)}
                className={`w-full flex items-center gap-2 px-3 py-2 text-left text-sm ${active ? 'bg-indigo-50' : 'hover:bg-slate-50'}`}
              >
                <Icon className="w-4 h-4 text-slate-400" />
                <div className="flex-1 min-w-0">
                  <div className="truncate">{r.label}</div>
                  {r.sub && <div className="text-xs text-slate-500 truncate">{r.sub}</div>}
                </div>
                <span className="text-[10px] uppercase text-slate-400">{r.type}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
