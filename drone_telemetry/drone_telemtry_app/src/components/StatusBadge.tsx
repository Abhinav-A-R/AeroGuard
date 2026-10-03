interface StatusBadgeProps {
  status: 'OPERATIONAL' | 'CONNECTED' | 'DISCONNECTED' | 'LIVE' | 'STANDBY' | 'WARNING' | 'CRITICAL' | 'ACTIVE' | 'OFFLINE';
  size?: 'sm' | 'md';
  pulse?: boolean;
}

export default function StatusBadge({ status, size = 'sm', pulse = false }: StatusBadgeProps) {
  let bg = 'bg-slate-800/60 border-slate-700 text-slate-300';
  let dotBg = 'bg-slate-400';

  switch (status) {
    case 'OPERATIONAL':
    case 'CONNECTED':
    case 'LIVE':
    case 'ACTIVE':
      bg = 'bg-emerald-950/40 border-emerald-500/40 text-emerald-400';
      dotBg = 'bg-emerald-400';
      break;
    case 'WARNING':
    case 'STANDBY':
      bg = 'bg-amber-950/40 border-amber-500/40 text-amber-400';
      dotBg = 'bg-amber-400';
      break;
    case 'CRITICAL':
    case 'DISCONNECTED':
    case 'OFFLINE':
      bg = 'bg-rose-950/40 border-rose-500/40 text-rose-400';
      dotBg = 'bg-rose-500';
      break;
  }

  const px = size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs';

  return (
    <span className={`inline-flex items-center gap-1.5 font-mono font-semibold rounded border uppercase tracking-wider select-none ${bg} ${px}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dotBg} ${pulse ? 'animate-pulse' : ''}`} />
      <span>{status}</span>
    </span>
  );
}
