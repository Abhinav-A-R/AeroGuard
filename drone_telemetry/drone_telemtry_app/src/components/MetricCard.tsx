interface MetricCardProps {
  label: string;
  value: string | number;
  unit?: string;
  subtext?: string;
  statusColor?: string;
  trend?: 'up' | 'down' | 'neutral';
  accent?: boolean;
}

export default function MetricCard({ label, value, unit, subtext, statusColor, trend, accent }: MetricCardProps) {
  return (
    <div className={`bg-[#0f172a] border rounded p-3 flex flex-col justify-between select-none ${
      accent ? 'border-sky-500/40 bg-sky-950/10' : 'border-slate-800 hover:border-slate-700'
    } transition-colors`}>
      <div className="flex items-center justify-between gap-1 mb-1">
        <span className="font-mono text-[10px] text-slate-400 uppercase tracking-widest truncate">{label}</span>
        {trend && (
          <span className="font-mono text-[9px] text-slate-500">
            {trend === 'up' ? '▲' : trend === 'down' ? '▼' : '▶'}
          </span>
        )}
      </div>

      <div className="flex items-baseline gap-1">
        <span className="font-mono text-xl font-bold tracking-tight text-slate-100" style={{ color: statusColor }}>
          {value}
        </span>
        {unit && <span className="font-mono text-xs text-slate-400 font-normal">{unit}</span>}
      </div>

      {subtext && (
        <div className="font-mono text-[9px] text-slate-500 mt-1 truncate">
          {subtext}
        </div>
      )}
    </div>
  );
}
