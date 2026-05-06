import { useEffect, useState } from 'react';
import { NavLink, Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';
import { api } from '../api/client.js';
import { labelFor } from '../lib/roles.js';
import {
  HomeIcon, FolderIcon, ListIcon, CalendarIcon, BellIcon, SearchIcon,
  PlusIcon, ChevronDownIcon, ChevronRightIcon,
} from './icons.jsx';
import NotificationBell from './NotificationBell.jsx';

// Outer dark icon strip — top-level destinations.
function OuterRail() {
  const items = [
    { to: '/',         label: 'Home',     Icon: HomeIcon     },
    { to: '/projects', label: 'Projects', Icon: FolderIcon   },
    { to: '/tasks',    label: 'My Tasks', Icon: ListIcon     },
    { to: '/calendar', label: 'Calendar', Icon: CalendarIcon },
  ];
  return (
    <div className="w-14 bg-slate-900 text-slate-300 flex flex-col items-center py-3 gap-1.5">
      <div className="w-9 h-9 rounded-lg bg-indigo-500 text-white flex items-center justify-center font-semibold text-sm mb-2">
        PM
      </div>
      {items.map(({ to, label, Icon }) => (
        <NavLink
          key={to}
          to={to}
          end={to === '/'}
          title={label}
          className={({ isActive }) =>
            `w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${
              isActive
                ? 'bg-slate-700 text-white'
                : 'text-slate-400 hover:bg-slate-800 hover:text-white'
            }`
          }
        >
          <Icon className="w-4 h-4" />
        </NavLink>
      ))}
    </div>
  );
}

// Inner light sidebar — shows the same primary nav (in text form) + project list.
function InnerSidebar() {
  const [projects, setProjects] = useState([]);
  const [showProjects, setShowProjects] = useState(true);
  const loc = useLocation();

  useEffect(() => { api('/projects').then(setProjects).catch(() => {}); }, []);

  const linkCls = ({ isActive }) =>
    `flex items-center gap-2 px-2 py-1.5 rounded text-sm ${
      isActive ? 'bg-indigo-50 text-indigo-700 font-medium' : 'text-slate-700 hover:bg-slate-100'
    }`;

  return (
    <aside className="w-60 bg-slate-50 border-r border-slate-200 flex flex-col">
      <div className="px-3 py-3 border-b border-slate-200">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
          <span className="w-5 h-5 rounded bg-indigo-100 text-indigo-700 flex items-center justify-center text-[10px] font-bold">PM</span>
          <span>Workspace</span>
          <ChevronDownIcon className="w-4 h-4 text-slate-400 ml-auto" />
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-2 space-y-0.5">
        <NavLink to="/"          end className={linkCls}><HomeIcon     className="w-4 h-4" /> Home</NavLink>
        <NavLink to="/tasks"         className={linkCls}><ListIcon     className="w-4 h-4" /> My Tasks</NavLink>
        <NavLink to="/all-tasks"     className={linkCls}><ListIcon     className="w-4 h-4" /> All Tasks</NavLink>
        <NavLink to="/calendar"      className={linkCls}><CalendarIcon className="w-4 h-4" /> Calendar</NavLink>

        <div className="pt-3 pb-1 px-2 flex items-center justify-between">
          <button
            onClick={() => setShowProjects(s => !s)}
            className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500 hover:text-slate-700"
          >
            {showProjects ? <ChevronDownIcon className="w-3 h-3" /> : <ChevronRightIcon className="w-3 h-3" />}
            Projects
          </button>
          <Link to="/projects" title="All projects" className="text-slate-400 hover:text-slate-700">
            <PlusIcon className="w-3.5 h-3.5" />
          </Link>
        </div>

        {showProjects && (
          <div className="space-y-0.5">
            {projects.map(p => (
              <NavLink
                key={p.id}
                to={`/projects/${p.id}`}
                className={({ isActive }) =>
                  `flex items-center gap-2 px-2 py-1.5 rounded text-sm truncate ${
                    isActive || loc.pathname === `/projects/${p.id}`
                      ? 'bg-indigo-50 text-indigo-700 font-medium'
                      : 'text-slate-700 hover:bg-slate-100'
                  }`
                }
              >
                <FolderIcon className="w-4 h-4 shrink-0 text-slate-400" />
                <span className="truncate">{p.name}</span>
                {p.task_count > 0 && (
                  <span className="ml-auto text-xs text-slate-400">{p.task_count}</span>
                )}
              </NavLink>
            ))}
            {projects.length === 0 && (
              <div className="px-2 py-1 text-xs text-slate-400 italic">No projects yet</div>
            )}
          </div>
        )}

        <div className="pt-3">
          <NotificationBell />
        </div>
      </nav>
    </aside>
  );
}

// Top bar — search, action buttons, user menu.
function TopBar() {
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="h-12 bg-white border-b border-slate-200 flex items-center px-4 gap-3">
      <div className="flex-1 max-w-md relative">
        <SearchIcon className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          className="w-full pl-8 pr-3 py-1.5 text-sm bg-slate-100 hover:bg-slate-50 focus:bg-white border border-transparent focus:border-indigo-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-100"
          placeholder="Search…"
          // search wiring is intentionally a no-op for now; renders so the layout matches
        />
      </div>

      <div className="ml-auto flex items-center gap-2">
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="relative w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-medium text-xs"
          title={user?.name}
        >
          {user?.name?.split(' ').map(s => s[0]).join('').slice(0, 2).toUpperCase() || '?'}
        </button>
        {menuOpen && (
          <div className="absolute right-3 top-11 w-56 card p-2 z-20">
            <div className="px-2 py-1.5 border-b border-slate-100 mb-1">
              <div className="text-sm font-medium">{user?.name}</div>
              <div className="text-xs text-slate-500">{user?.email}</div>
              <div className="text-xs text-slate-500">{labelFor(user?.role)}</div>
            </div>
            <button
              onClick={() => { setMenuOpen(false); logout(); }}
              className="w-full text-left px-2 py-1.5 text-sm hover:bg-slate-50 rounded text-red-600"
            >
              Sign out
            </button>
          </div>
        )}
      </div>
    </header>
  );
}

export default function Layout() {
  return (
    <div className="h-screen flex bg-slate-50">
      <OuterRail />
      <InnerSidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
