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
  storagePath = 'C:\\AeroGuard\\Logs' 
}: DataLoggerProps) {
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
    <div className="h-full flex flex-col p-4 gap-3 select-none">
      {/* Controls Header */}
      <div className="flex items-center gap-3 flex-shrink-0">
        <button
          onClick={onStart}
          disabled={logging && !logPaused}
          className="px-4 py-1.5 rounded font-mono text-xs font-semibold border border-[#22c55e] text-[#22c55e] bg-[#22c55e]/10 hover:bg-[#22c55e]/20 disabled:opacity-40 transition-colors"
        >
          ● START LOGGING
        </button>
        <button
          onClick={onPause}
          disabled={!logging}
          className="px-4 py-1.5 rounded font-mono text-xs font-semibold border border-[#eab308] text-[#eab308] bg-[#eab308]/10 hover:bg-[#eab308]/20 disabled:opacity-40 transition-colors"
        >
          {logPaused ? '▶ RESUME' : '⏸ PAUSE'}
        </button>
        <button
          onClick={onStop}
          disabled={!logging}
          className="px-4 py-1.5 rounded font-mono text-xs font-semibold border border-[#ef4444] text-[#ef4444] bg-[#ef4444]/10 hover:bg-[#ef4444]/20 disabled:opacity-40 transition-colors"
        >
          ■ STOP LOGGING
        </button>

        <div className="ml-4 flex items-center gap-1">
          {(['CSV', 'JSON', 'TXT'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFormat(f)}
              className={`px-3 py-1 rounded font-mono text-xs border transition-colors ${
                format === f ? 'border-[#0ea5e9] text-[#0ea5e9] bg-[#0ea5e9]/10 font-bold' : 'border-[#1e2a3e] text-[#637087]'
              }`}
            >{f}</button>
          ))}
        </div>

        <button
          onClick={handleExport}
          className="px-4 py-1.5 rounded font-mono text-xs font-semibold border border-[#0ea5e9] text-[#0ea5e9] bg-[#0ea5e9]/10 hover:bg-[#0ea5e9]/20 transition-colors"
        >
          ↓ DOWNLOAD LOG FILE ({format})
        </button>
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-6 gap-2 flex-shrink-0">
        {[
          { label: 'Logger Status', value: !logging ? 'IDLE' : logPaused ? 'PAUSED' : 'RECORDING', color: !logging ? '#637087' : logPaused ? '#eab308' : '#22c55e' },
          { label: 'Duration', value: `${duration}s`, color: '#d4dae6' },
          { label: 'Total Samples', value: history.length.toLocaleString(), color: '#38bdf8' },
          { label: 'Telemetry Frequency', value: `${samplingHz} Hz`, color: '#d4dae6' },
          { label: 'Estimated Size', value: `${fileSize} KB`, color: '#d4dae6' },
          { label: 'Storage Target', value: storagePath, color: '#637087' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-[#0d1320] border border-[#1e2a3e] rounded p-2">
            <div className="text-[9px] font-mono text-[#637087] uppercase tracking-widest mb-1">{label}</div>
            <div className="font-mono text-xs font-bold truncate" style={{ color }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Live Sample Table */}
      <div className="flex-1 bg-[#0d1320] border border-[#1e2a3e] rounded overflow-hidden flex flex-col min-h-0">
        <div className="flex-shrink-0 grid font-mono text-[9px] text-[#637087] uppercase tracking-widest px-3 py-2 border-b border-[#1e2a3e]"
          style={{ gridTemplateColumns: '14% 6% 6% 6% 7% 7% 7% 7% 7% 7% 7% 7% 6% 6%' }}>
          <div>Timestamp</div><div>Roll</div><div>Pitch</div><div>Yaw</div>
          <div>Ax</div><div>Ay</div><div>Az</div>
          <div>Gx</div><div>Gy</div><div>Gz</div>
          <div>Temp</div><div>Pressure</div><div>Altitude</div><div>Battery</div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {history.slice().reverse().slice(0, 300).map((r, i) => (
            <div
              key={i}
              className="grid font-mono text-[10px] px-3 py-1 border-b border-[#1e2a3e]/40 hover:bg-[#0ea5e9]/5 transition-colors"
              style={{ gridTemplateColumns: '14% 6% 6% 6% 7% 7% 7% 7% 7% 7% 7% 7% 6% 6%' }}
            >
              <div className="text-[#637087]">{new Date(r.timestamp < 1e11 ? r.timestamp * 1000 : r.timestamp).toISOString().slice(11, 23)}</div>
              <div className="text-[#22c55e]">{fmt(r.roll)}°</div>
              <div className="text-[#eab308]">{fmt(r.pitch)}°</div>
              <div className="text-[#f97316]">{fmt(r.yaw)}°</div>
              <div className="text-[#22d3ee]">{fmt(r.ax)}</div>
              <div className="text-[#0ea5e9]">{fmt(r.ay)}</div>
              <div className="text-[#38bdf8]">{fmt(r.az)}</div>
              <div className="text-[#a78bfa]">{fmt(r.gx)}</div>
              <div className="text-[#818cf8]">{fmt(r.gy)}</div>
              <div className="text-[#6366f1]">{fmt(r.gz)}</div>
              <div className="text-[#38bdf8]">{r.temperature?.toFixed(1)}°C</div>
              <div className="text-[#38bdf8]">{r.pressure?.toFixed(1)}</div>
              <div className="text-[#22c55e]">{r.altitude?.toFixed(1)}m</div>
              <div className="text-[#ef4444]">{r.battery?.toFixed(2)}V</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
