// Format a duration in seconds as H:MM:SS (or MM:SS if under an hour).
// Used for both static totals and live ticker displays — keep this pure.
export function formatDuration(seconds) {
  const s = Math.max(0, Math.floor(seconds || 0));
  const h  = Math.floor(s / 3600);
  const m  = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  const mm = String(m).padStart(2, '0');
  const sStr = String(ss).padStart(2, '0');
  if (h > 0) return `${h}:${mm}:${sStr}`;
  return `${mm}:${sStr}`;
}

// Sum the duration_seconds of a list of entries — null durations (running) treated as 0.
export function sumDurations(entries) {
  return (entries || []).reduce((acc, e) => acc + (e.duration_seconds || 0), 0);
}
