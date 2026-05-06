import { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import { formatDuration, sumDurations } from '../lib/time.js';

// Per-task timer button + live ticker. Single button toggles between Start/Stop
// based on whether a running entry on THIS task exists (`runningEntry`).
//
// Parent passes:
//   taskId        - task this button controls
//   entries       - all time entries for this task (across users), used for total
//   runningEntry  - the current user's running entry (may be on this task, another task, or null)
//   onChange      - called after start/stop so parent can refetch
export default function TimerButton({ taskId, entries, runningEntry, onChange }) {
  const isRunningHere = runningEntry?.task_id === taskId;

  // Live ticker: when running on this task, tick the displayed seconds every second.
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!isRunningHere) return;
    const id = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(id);
  }, [isRunningHere]);

  const baseTotal = sumDurations(entries);
  // If currently running on this task, the matching entry's stored duration is 0;
  // add live elapsed seconds since started_at on top of finished-entry totals.
  const liveExtra = isRunningHere
    ? Math.max(0, Math.floor((Date.now() - new Date(runningEntry.started_at).getTime()) / 1000))
    : 0;
  const display = formatDuration(baseTotal + liveExtra);

  const start = async () => {
    await api('/time', { method: 'POST', body: { task_id: taskId } });
    onChange();
  };
  const stop = async () => {
    await api(`/time?id=${runningEntry.id}`, { method: 'PATCH' });
    onChange();
  };

  return (
    <div className="flex items-center gap-1.5 text-xs">
      {isRunningHere ? (
        <button
          onClick={stop}
          className="w-5 h-5 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center"
          title="Stop timer"
          aria-label="Stop timer"
        >
          <span className="block w-1.5 h-1.5 bg-white rounded-sm" />
        </button>
      ) : (
        <button
          onClick={start}
          className="w-5 h-5 rounded-full bg-slate-200 hover:bg-emerald-500 hover:text-white text-slate-700 flex items-center justify-center transition-colors"
          title={runningEntry ? 'Switch timer to this task' : 'Start timer'}
          aria-label="Start timer"
        >
          <span className="block w-0 h-0 ml-0.5 border-l-[5px] border-l-current border-y-[3px] border-y-transparent" />
        </button>
      )}
      <span className={`font-mono ${isRunningHere ? 'text-red-600 font-medium' : 'text-slate-500'}`}>
        {display}
      </span>
    </div>
  );
}
