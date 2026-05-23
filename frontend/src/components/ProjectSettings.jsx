import { useEffect, useState } from 'react';
import { api } from '../api/client.js';

// Per-project Control Center: toggle which tabs are visible.
// Only lists modules we actually have routes for — toggles for Files/Forms/
// Discussions show up automatically once those features exist (the modules JSONB
// happily holds whatever keys you give it).
//
// Manager+ may toggle. Members see a read-only view of which modules are on.
const KNOWN_MODULES = [
  { key: 'dashboard', label: 'Dashboard', description: 'Widgets + project outline + members' },
  { key: 'roadmap',   label: 'Roadmap',   description: 'Milestones list + date-axis timeline' },
  { key: 'tasks',     label: 'Tasks',     description: 'List/Board with grouping + subtasks + dependencies' },
  { key: 'notes',     label: 'Notes',     description: 'Free-form auto-saving project notes' },
];

export default function ProjectSettings({ open, projectId, initialModules, canEdit, onClose, onSave }) {
  const [modules, setModules] = useState(initialModules ?? {});
  const [busy, setBusy] = useState(false);
  const [savedMsg, setSavedMsg] = useState(null);

  useEffect(() => { setModules(initialModules ?? {}); }, [initialModules]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape' && !busy) onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, busy, onClose]);

  if (!open) return null;

  // We don't allow turning off ALL tabs — at least Tasks stays on.
  const isOn = (k) => modules[k] !== false;
  const enabledCount = KNOWN_MODULES.filter(m => isOn(m.key)).length;

  const toggle = (k) => {
    if (!canEdit) return;
    const next = { ...modules, [k]: !isOn(k) };
    // Refuse to turn off the last enabled module.
    const stillOn = KNOWN_MODULES.filter(m => next[m.key] !== false).length;
    if (stillOn === 0) return;
    setModules(next);
  };

  const save = async () => {
    if (!canEdit) return;
    setBusy(true);
    setSavedMsg(null);
    try {
      const updated = await api(`/projects/${projectId}`, { method: 'PATCH', body: { modules } });
      setSavedMsg('Saved.');
      onSave?.(updated);
      setTimeout(() => setSavedMsg(null), 2000);
    } finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40" onClick={() => !busy && onClose()}>
      <div
        className="card max-w-2xl w-full shadow-lg overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <header className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Control Center</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Customize which modules appear in this project. {enabledCount}/{KNOWN_MODULES.length} enabled.
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 text-lg leading-none" aria-label="Close">×</button>
        </header>

        <div className="p-5 space-y-3">
          <div className="text-[10px] uppercase tracking-wide text-slate-500">Project modules</div>
          {!canEdit && (
            <div className="text-xs text-slate-500 bg-slate-50 px-3 py-2 rounded">
              Only Analyst Managers and Client Success Managers can change which modules are visible.
            </div>
          )}
          {KNOWN_MODULES.map(m => {
            const on = isOn(m.key);
            return (
              <div key={m.key} className="flex items-center justify-between gap-3 py-2 border-b border-slate-100 last:border-b-0">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium">{m.label}</div>
                  <div className="text-xs text-slate-500">{m.description}</div>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={on}
                  disabled={!canEdit || busy}
                  onClick={() => toggle(m.key)}
                  className={`relative w-10 h-6 rounded-full transition-colors ${on ? 'bg-indigo-600' : 'bg-slate-300'} ${(!canEdit || busy) ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${on ? 'translate-x-4' : ''}`} />
                </button>
              </div>
            );
          })}

          <div className="text-xs text-slate-400 italic pt-2">
            Discussions, Docs, Files, Forms — add this card when those modules ship.
          </div>
        </div>

        <footer className="px-5 py-3 border-t border-slate-200 flex items-center justify-end gap-2">
          {savedMsg && <span className="text-xs text-emerald-600 mr-auto">{savedMsg}</span>}
          <button onClick={onClose} disabled={busy} className="btn-ghost">Close</button>
          {canEdit && (
            <button onClick={save} disabled={busy} className="btn-primary">
              {busy ? 'Saving…' : 'Save'}
            </button>
          )}
        </footer>
      </div>
    </div>
  );
}
