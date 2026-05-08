// Generates initials avatars + stacks them; deterministic color per name hash.
const COLORS = [
  'bg-rose-200 text-rose-800',
  'bg-amber-200 text-amber-800',
  'bg-emerald-200 text-emerald-800',
  'bg-sky-200 text-sky-800',
  'bg-violet-200 text-violet-800',
  'bg-pink-200 text-pink-800',
  'bg-teal-200 text-teal-800',
  'bg-orange-200 text-orange-800',
];

function color(name) {
  let h = 0;
  for (let i = 0; i < (name?.length ?? 0); i++) h = (h * 31 + name.charCodeAt(i)) | 0;
  return COLORS[Math.abs(h) % COLORS.length];
}
function initials(name) {
  return (name ?? '?').split(/\s+/).map(s => s[0]).join('').slice(0, 2).toUpperCase();
}

export default function AvatarStack({ users, size = 'sm', max = 4 }) {
  const sz = size === 'xs' ? 'w-5 h-5 text-[9px]' : size === 'md' ? 'w-7 h-7 text-xs' : 'w-6 h-6 text-[10px]';
  const visible = users.slice(0, max);
  const overflow = users.length - visible.length;
  return (
    <div className="flex items-center -space-x-1.5">
      {visible.map(u => (
        <div
          key={u.id}
          title={u.name}
          className={`${sz} ${color(u.name)} rounded-full flex items-center justify-center font-medium border-2 border-white`}
        >
          {initials(u.name)}
        </div>
      ))}
      {overflow > 0 && (
        <div className={`${sz} bg-slate-200 text-slate-600 rounded-full flex items-center justify-center font-medium border-2 border-white`}>
          +{overflow}
        </div>
      )}
    </div>
  );
}
