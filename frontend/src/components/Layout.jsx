import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';
import NotificationBell from './NotificationBell.jsx';

const link = ({ isActive }) =>
  `block px-3 py-2 rounded-md text-sm ${isActive ? 'bg-indigo-50 text-indigo-700 font-medium' : 'text-slate-600 hover:bg-slate-100'}`;

export default function Layout() {
  const { user, logout } = useAuth();
  return (
    <div className="min-h-screen flex">
      <aside className="w-56 bg-white border-r border-slate-200 p-4 flex flex-col">
        <div className="text-lg font-semibold mb-6">PM</div>
        <nav className="space-y-1 flex-1">
          <NavLink to="/" end className={link}>Dashboard</NavLink>
          <NavLink to="/projects" className={link}>Projects</NavLink>
          <NavLink to="/tasks" className={link}>My Tasks</NavLink>
          <NavLink to="/calendar" className={link}>Calendar</NavLink>
          <div className="pt-2">
            <NotificationBell />
          </div>
        </nav>
        <div className="text-xs text-slate-500 border-t pt-3">
          <div className="font-medium text-slate-700">{user?.name}</div>
          <div>{user?.role}</div>
          <button onClick={logout} className="mt-2 text-indigo-600 hover:underline">Sign out</button>
        </div>
      </aside>
      <main className="flex-1 p-8 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
