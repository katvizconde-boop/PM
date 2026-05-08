import { useState } from 'react';
import { api } from '../api/client.js';

// Stable per-tag color from a string hash → keeps UI consistent without a colors table.
const TAG_COLORS = [
  'bg-rose-100 text-rose-700',
  'bg-amber-100 text-amber-700',
  'bg-emerald-100 text-emerald-700',
  'bg-sky-100 text-sky-700',
  'bg-violet-100 text-violet-700',
  'bg-pink-100 text-pink-700',
  'bg-teal-100 text-teal-700',
  'bg-orange-100 text-orange-700',
];
export function tagColor(tag) {
  let h = 0;
  for (let i = 0; i < tag.length; i++) h = (h * 31 + tag.charCodeAt(i)) | 0;
  return TAG_COLORS[Math.abs(h) % TAG_COLORS.length];
}

// Inline tag editor — stored as TEXT[] on the task. Hits PATCH /api/tasks/:id.
export default function TagInput({ taskId, tags = [], onChange }) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft]   = useState('');

  const save = async (next) => {
    await api(`/tasks/${taskId}`, { method: 'PATCH', body: { tags: next } });
    onChange();
  };

  const add = async (e) => {
    e.preventDefault();
    const t = draft.trim().toLowerCase();
    if (!t || tags.includes(t)) { setDraft(''); setAdding(false); return; }
    await save([...tags, t]);
    setDraft(''); setAdding(false);
  };
  const remove = async (t) => {
    await save(tags.filter(x => x !== t));
  };

  return (
    <div className="flex flex-wrap items-center gap-1">
      {tags.map(t => (
        <span key={t} className={`badge ${tagColor(t)} group`}>
          {t}
          <button
            onClick={() => remove(t)}
            className="ml-1 opacity-0 group-hover:opacity-100 hover:text-red-600"
            aria-label={`Remove tag ${t}`}
          >×</button>
        </span>
      ))}
      {adding ? (
        <form onSubmit={add} className="inline">
          <input
            className="text-xs px-2 py-0.5 border border-slate-300 rounded w-24 focus:outline-none focus:ring-2 focus:ring-indigo-200"
            autoFocus
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onBlur={add}
            onKeyDown={e => { if (e.key === 'Escape') { setAdding(false); setDraft(''); } }}
            placeholder="tag…"
            maxLength={40}
          />
        </form>
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="text-xs text-slate-400 hover:text-slate-700 px-1"
          aria-label="Add tag"
        >+ tag</button>
      )}
    </div>
  );
}
