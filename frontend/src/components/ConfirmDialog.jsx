import { useEffect } from 'react';

// Simple destructive-confirm modal. Used for delete actions across the app
// instead of native window.confirm() so it matches the rest of the styling.
//
// Caller controls open state — this is a presentational component.
//   open      : boolean
//   title     : short header
//   message   : body text (plain) — pass JSX via `children` for richer content
//   confirmLabel : defaults to "Delete"
//   onConfirm : called when user confirms
//   onCancel  : called when user cancels (also fires on Escape / backdrop click)
export default function ConfirmDialog({
  open, title = 'Are you sure?', message, children,
  confirmLabel = 'Delete', cancelLabel = 'Cancel',
  onConfirm, onCancel, busy = false,
}) {
  // Close on Escape.
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape' && !busy) onCancel?.(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onCancel, busy]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40" onClick={() => !busy && onCancel?.()}>
      <div
        className="card max-w-md w-full p-5 shadow-lg"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <h2 className="text-lg font-semibold">{title}</h2>
        {message && <p className="text-sm text-slate-600 mt-2">{message}</p>}
        {children && <div className="mt-2 text-sm text-slate-600">{children}</div>}
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onCancel} disabled={busy} className="btn-ghost">
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={busy}
            className="btn bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
          >
            {busy ? 'Working…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
