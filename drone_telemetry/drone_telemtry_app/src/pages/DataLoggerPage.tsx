import { useState } from 'react';
import type { ESP32Telemetry } from '../types/telemetry';

interface DataLoggerProps {
  history: ESP32Telemetry[];
  logging: boolean;
  onStart: () => void;
  onStop: () => void;
  onPause: () => void;
  logPaused: boolean;
  samplingHz: number;
  storagePath?: string;
  theme?: 'dark' | 'light';
}

// Security sanitizer against CSV formula injection (=, +, -, @)
function sanitizeCsv(val: any): string {
  const str = String(val ?? '');
  if (/^[=+@-]/?.test(str)) {
    return `'${str}`;
  }
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export default function DataLoggerPage({ 
  history, 
  logging, 
  onStart, 
  onStop, 
  onPause, 
  logPaused, 
  samplingHz, 
  storagePath = 'C:\\AeroGuard\\Logs',
  theme = 'dark',
}: DataLoggerProps) {
  const isLight = theme === 'light';
  const [format, setFormat] = useState<'CSV' | 'JSON' | 'TXT'>('CSV');

  const duration = Math.floor(history.length / (samplingHz || 20));
  const fileSize = ((history.length * 140) / 1024).toFixed(1);
  const filename = `aeroguard_log_${new Date().toISOString().slice(0, 10)}.log`;

  const handleExport = () => {
    let content = '';
    if (format === 'CSV') {
      const header = 'Timestamp_ISO,Timestamp_Epoch,Roll,Pitch,Yaw,Ax,Ay,Az,Gx,Gy,Gz,Temperature,Pressure,Altitude,Battery\n';
      content = header + history.map(r => {
        const iso = new Date(r.timestamp < 1e11 ? r.timestamp * 1000 : r.timestamp).toISOString();
        return [
          sanitizeCsv(iso),
          r.timestamp,
          r.roll,
          r.pitch,
          r.yaw,
          r.ax,
          r.ay,
          r.az,
          r.gx,
          r.gy,
          r.gz,
          r.temperature,
          r.pressure,
          r.altitude,
          r.battery,
        ].join(',');
      }).join('\n');
    } else if (format === 'JSON') {
      content = JSON.stringify(history, null, 2);
    } else {
      content = history.map(r =>
        `[${new Date(r.timestamp < 1e11 ? r.timestamp * 1000 : r.timestamp).toISOString()}] R:${r.roll} P:${r.pitch} Y:${r.yaw} AX:${r.ax} AY:${r.ay} AZ:${r.az} GX:${r.gx} GY:${r.gy} GZ:${r.gz} TEMP:${r.temperature}C PRES:${r.pressure}hPa ALT:${r.altitude}m BAT:${r.battery}V`
      ).join('\n');
    }

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename.replace('.log', `.${format.toLowerCase()}`);
    a.click();
    URL.revokeObjectURL(url);
  };

  const fmt = (n: number) => (n !== undefined ? n.toFixed(2) : '0.00');

  return (
    <div className={`h-full flex flex-col p-4 gap-3 select-none font-mono ${
      isLight ? 'bg-slate-50 text-slate-900' : 'bg-[#060910] text-slate-100'
    }`}>
      {/* Controls Header */}
      <div className="flex items-center gap-3 flex-shrink-0">
        <button
          onClick={onStart}
          disabled={logging && !logPaused}
          className={`px-4 py-1.5 rounded text-xs font-semibold border transition-all ${
            isLight
              ? 'border-emerald-500 text-emerald-800 bg-emerald-50 hover:bg-emerald-100 disabled:opacity-40'
              : 'border-[#22c55e] text-[#22c55e] bg-[#22c55e]/10 hover:bg-[#22c55e]/20 disabled:opacity-40'
          }`}
        >
          ● START LOGGING
        </button>
        <button
          onClick={onPause}
          disabled={!logging}
          className={`px-4 py-1.5 rounded text-xs font-semibold border transition-all ${
            isLight
              ? 'border-amber-400 text-amber-800 bg-amber-50 hover:bg-amber-100 disabled:opacity-40'
              : 'border-[#eab308] text-[#eab308] bg-[#eab308]/10 hover:bg-[#eab308]/20 disabled:opacity-40'
          }`}
        >
          {logPaused ? '▶ RESUME' : '⏸ PAUSE'}
        </button>
        <button
          onClick={onStop}
          disabled={!logging}
          className={`px-4 py-1.5 rounded text-xs font-semibold border transition-all ${
            isLight
              ? 'border-rose-400 text-rose-800 bg-rose-50 hover:bg-rose-100 disabled:opacity-40'
              : 'border-[#ef4444] text-[#ef4444] bg-[#ef4444]/10 hover:bg-[#ef4444]/20 disabled:opacity-40'
          }`}
        >
          ■ STOP LOGGING
        </button>

        <div className="ml-4 flex items-center gap-1">
          {(['CSV', 'JSON', 'TXT'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFormat(f)}
              className={`px-3 py-1 rounded text-xs border transition-colors ${
                format === f 
                  ? isLight ? 'border-sky-500 text-sky-800 bg-sky-50 font-bold' : 'border-[#0ea5e9] text-[#0ea5e9] bg-[#0ea5e9]/10 font-bold'
                  : isLight ? 'border-slate-300 text-slate-600 hover:bg-slate-100' : 'border-[#1e2a3e] text-[#637087]'
              }`}
            >{f}</button>
          ))}
        </div>

        <button
          onClick={handleExport}
          className={`px-4 py-1.5 rounded text-xs font-semibold border transition-colors ${
            isLight
              ? 'border-sky-500 text-sky-800 bg-sky-50 hover:bg-sky-100'
              : 'border-[#0ea5e9] text-[#0ea5e9] bg-[#0ea5e9]/10 hover:bg-[#0ea5e9]/20'
          }`}
        >
          ↓ DOWNLOAD LOG FILE ({format})
        </button>
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-6 gap-2 flex-shrink-0">
        {[
          { label: 'Logger Status', value: !logging ? 'IDLE' : logPaused ? 'PAUSED' : 'RECORDING', color: !logging ? (isLight ? '#64748b' : '#637087') : logPaused ? '#d97706' : (isLight ? '#059669' : '#22c55e') },
          { label: 'Duration', value: `${duration}s`, color: isLight ? '#0f172a' : '#d4dae6' },
          { label: 'Total Samples', value: history.length.toLocaleString(), color: isLight ? '#0284c7' : '#38bdf8' },
          { label: 'Telemetry Frequency', value: `${samplingHz} Hz`, color: isLight ? '#0f172a' : '#d4dae6' },
          { label: 'Estimated Size', value: `${fileSize} KB`, color: isLight ? '#0f172a' : '#d4dae6' },
          { label: 'Storage Target', value: storagePath, color: isLight ? '#64748b' : '#637087' },
        ].map(({ label, value, color }) => (
          <div key={label} className={`border rounded p-2 ${
            isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-[#0d1320] border-[#1e2a3e]'
          }`}>
            <div className={`text-[9px] uppercase tracking-widest mb-1 ${isLight ? 'text-slate-500' : 'text-[#637087]'}`}>{label}</div>
            <div className="text-xs font-bold truncate" style={{ color }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Live Sample Table */}
      <div className={`border rounded overflow-hidden flex flex-col min-h-0 ${
        isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-[#0d1320] border-[#1e2a3e]'
      }`}>
        <div className={`flex-shrink-0 grid text-[9px] uppercase tracking-widest px-3 py-2 border-b ${
          isLight ? 'bg-slate-100 border-slate-200 text-slate-600' : 'bg-[#090d16] border-[#1e2a3e] text-[#637087]'
        }`} style={{ gridTemplateColumns: '14% 6% 6% 6% 7% 7% 7% 7% 7% 7% 7% 7% 6% 6%' }}>
          <div>Timestamp</div><div>Roll</div><div>Pitch</div><div>Yaw</div>
          <div>Ax</div><div>Ay</div><div>Az</div>
          <div>Gx</div><div>Gy</div><div>Gz</div>
          <div>Temp</div><div>Pressure</div><div>Altitude</div><div>Battery</div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {history.slice().reverse().slice(0, 300).map((r, i) => (
            <div
              key={i}
              className={`grid text-[10px] px-3 py-1 border-b transition-colors ${
                isLight 
                  ? 'border-slate-100 hover:bg-sky-50 text-slate-800'
                  : 'border-[#1e2a3e]/40 hover:bg-[#0ea5e9]/5'
              }`}
              style={{ gridTemplateColumns: '14% 6% 6% 6% 7% 7% 7% 7% 7% 7% 7% 7% 6% 6%' }}
            >
              <div className={isLight ? 'text-slate-500' : 'text-[#637087]'}>{new Date(r.timestamp < 1e11 ? r.timestamp * 1000 : r.timestamp).toISOString().slice(11, 23)}</div>
              <div className={isLight ? 'text-emerald-700 font-bold' : 'text-[#22c55e]'}>{fmt(r.roll)}°</div>
              <div className={isLight ? 'text-amber-700 font-bold' : 'text-[#eab308]'}>{fmt(r.pitch)}°</div>
              <div className={isLight ? 'text-orange-700 font-bold' : 'text-[#f97316]'}>{fmt(r.yaw)}°</div>
              <div className={isLight ? 'text-sky-700' : 'text-[#22d3ee]'}>{fmt(r.ax)}</div>
              <div className={isLight ? 'text-sky-700' : 'text-[#0ea5e9]'}>{fmt(r.ay)}</div>
              <div className={isLight ? 'text-sky-700' : 'text-[#38bdf8]'}>{fmt(r.az)}</div>
              <div className={isLight ? 'text-purple-700' : 'text-[#a78bfa]'}>{fmt(r.gx)}</div>
              <div className={isLight ? 'text-purple-700' : 'text-[#818cf8]'}>{fmt(r.gy)}</div>
              <div className={isLight ? 'text-purple-700' : 'text-[#6366f1]'}>{fmt(r.gz)}</div>
              <div className={isLight ? 'text-sky-700' : 'text-[#38bdf8]'}>{r.temperature?.toFixed(1)}°C</div>
              <div className={isLight ? 'text-sky-700' : 'text-[#38bdf8]'}>{r.pressure?.toFixed(1)}</div>
              <div className={isLight ? 'text-emerald-700' : 'text-[#22c55e]'}>{r.altitude?.toFixed(1)}m</div>
              <div className={isLight ? 'text-rose-700' : 'text-[#ef4444]'}>{r.battery?.toFixed(2)}V</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
