import { useEffect, useRef, useState } from 'react';
import { api } from '../api/client.js';

// Per-project free-form notes. Stored as a single TEXT column on projects.
// Auto-saves 1.5s after the last keystroke; manual "Save" button also works.
// Plain-text for now (no markdown rendering) — preserves whitespace via CSS.
export default function NotesPanel({ projectId, initial, updatedAt }) {
  const [text, setText]       = useState(initial ?? '');
  const [saving, setSaving]   = useState(false);
  const [savedAt, setSavedAt] = useState(updatedAt ?? null);
  const debounceRef = useRef(null);

  // Reset local state if the project changes (component reuse).
  useEffect(() => { setText(initial ?? ''); setSavedAt(updatedAt ?? null); }, [projectId, initial, updatedAt]);

  const save = async (value) => {
    setSaving(true);
    try {
      const updated = await api(`/projects/${projectId}`, { method: 'PATCH', body: { notes: value || null } });
      setSavedAt(updated.updated_at);
    } finally { setSaving(false); }
  };

  const onChange = (v) => {
    setText(v);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => save(v), 1500);
  };

  const fmtSaved = savedAt ? new Date(savedAt).toLocaleString() : null;

  return (
    <div className="card overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
        <h2 className="font-medium text-sm text-slate-700">Project notes</h2>
        <span className="text-xs text-slate-400">
          {saving ? 'Saving…' : fmtSaved ? `Last saved ${fmtSaved}` : 'No notes yet'}
        </span>
      </div>
      <textarea
        className="w-full p-4 text-sm font-mono leading-relaxed border-0 focus:outline-none focus:ring-0 resize-y min-h-[180px] whitespace-pre-wrap"
        placeholder="Decisions, links, hand-off notes — anything the team needs visible. Auto-saves while you type."
        value={text}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
