import { useState, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import type { ESP32Telemetry } from '../types/telemetry';

interface SensorGraphsProps {
  history: ESP32Telemetry[];
  running: boolean;
  onToggle: () => void;
  onClear: () => void;
  theme?: 'dark' | 'light';
}

type Channel = { key: keyof ESP32Telemetry; label: string; color: string; group: string };

const CHANNELS: Channel[] = [
  { key: 'ax', label: 'Accel X', color: '#0284c7', group: 'Accelerometer' },
  { key: 'ay', label: 'Accel Y', color: '#0ea5e9', group: 'Accelerometer' },
  { key: 'az', label: 'Accel Z', color: '#38bdf8', group: 'Accelerometer' },
  { key: 'gx', label: 'Gyro X', color: '#7c3aed', group: 'Gyroscope' },
  { key: 'gy', label: 'Gyro Y', color: '#818cf8', group: 'Gyroscope' },
  { key: 'gz', label: 'Gyro Z', color: '#6366f1', group: 'Gyroscope' },
  { key: 'roll', label: 'Roll', color: '#059669', group: 'Orientation' },
  { key: 'pitch', label: 'Pitch', color: '#d97706', group: 'Orientation' },
  { key: 'yaw', label: 'Yaw', color: '#f97316', group: 'Orientation' },
  { key: 'altitude', label: 'Altitude', color: '#0284c7', group: 'Environment' },
  { key: 'battery', label: 'Battery V', color: '#dc2626', group: 'System' },
];

const TIME_RANGES = [10, 30, 60, 120, 300];

export default function SensorGraphsPage({ history, running, onToggle, onClear, theme = 'dark' }: SensorGraphsProps) {
  const isLight = theme === 'light';
  const [selected, setSelected] = useState<Set<keyof ESP32Telemetry>>(
    new Set(['ax', 'ay', 'az'])
  );
  const [timeRange, setTimeRange] = useState(60);

  const chartData = useMemo(() => {
    return history
      .slice(-timeRange * 20)
      .map((r, i) => {
        const row: Record<string, number> = { i };
        CHANNELS.forEach(c => { row[c.key as string] = r[c.key] as number; });
        return row;
      });
  }, [history, timeRange]);

  const toggleChannel = (key: keyof ESP32Telemetry) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const groups = Array.from(new Set(CHANNELS.map(c => c.group)));

  return (
    <div className={`h-full flex flex-col p-4 gap-3 select-none ${
      isLight ? 'bg-slate-50 text-slate-900' : 'bg-[#060910] text-slate-100'
    }`}>
      {/* Controls */}
      <div className="flex items-center gap-3 flex-shrink-0">
        <button
          onClick={onToggle}
          className={`px-4 py-1.5 rounded font-mono text-xs font-semibold border transition-colors ${
            running
              ? isLight ? 'border-amber-400 text-amber-800 bg-amber-50 hover:bg-amber-100' : 'border-amber-500 text-amber-400 bg-amber-950/20 hover:bg-amber-950/40'
              : isLight ? 'border-emerald-400 text-emerald-800 bg-emerald-50 hover:bg-emerald-100' : 'border-emerald-500 text-emerald-400 bg-emerald-950/20 hover:bg-emerald-950/40'
          }`}
        >
          {running ? '⏸ PAUSE' : '▶ START'}
        </button>
        <button
          onClick={onClear}
          className={`px-4 py-1.5 rounded font-mono text-xs font-semibold border transition-colors ${
            isLight ? 'border-slate-300 text-slate-700 hover:border-rose-400 hover:text-rose-700 bg-white' : 'border-slate-800 text-slate-400 hover:border-rose-500 hover:text-rose-400 bg-[#0f172a]'
          }`}
        >
          ✕ CLEAR
        </button>
        <div className="flex items-center gap-1 ml-2">
          <span className={`font-mono text-[10px] mr-1 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>BUFFER:</span>
          {TIME_RANGES.map(t => (
            <button
              key={t}
              onClick={() => setTimeRange(t)}
              className={`px-2 py-1 font-mono text-[10px] rounded border transition-colors ${
                timeRange === t
                  ? isLight ? 'border-sky-500 text-sky-800 bg-sky-50 font-bold' : 'border-sky-500 text-sky-400 bg-sky-950/40 font-bold'
                  : isLight ? 'border-slate-300 text-slate-600 hover:border-slate-400 bg-white' : 'border-slate-800 text-slate-400 hover:border-slate-700 bg-[#0f172a]'
              }`}
            >
              {t}s
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-1.5 font-mono text-[10px]">
          <div className={`w-2 h-2 rounded-full ${running ? (isLight ? 'bg-emerald-600' : 'bg-emerald-400') : (isLight ? 'bg-slate-400' : 'bg-slate-500')}`} />
          <span className={isLight ? 'text-slate-600' : 'text-slate-400'}>{history.length.toLocaleString()} SAMPLES IN BUFFER</span>
        </div>
      </div>

      {/* Channel Selector */}
      <div className={`flex-shrink-0 flex flex-wrap gap-3 border p-2.5 rounded ${
        isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-[#0f172a] border-slate-800'
      }`}>
        {groups.map(group => (
          <div key={group} className="flex items-center gap-1">
            <span className={`font-mono text-[9px] uppercase mr-1 font-bold ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>{group}:</span>
            {CHANNELS.filter(c => c.group === group).map(c => (
              <button
                key={c.key as string}
                onClick={() => toggleChannel(c.key)}
                className={`px-2 py-0.5 rounded font-mono text-[10px] border transition-all ${
                  selected.has(c.key)
                    ? 'border-current text-current bg-current/10 font-bold'
                    : isLight ? 'border-slate-200 text-slate-500 hover:bg-slate-50' : 'border-slate-800 text-slate-400'
                }`}
                style={selected.has(c.key) ? { color: c.color, borderColor: c.color + '80' } : {}}
              >
                {c.label}
              </button>
            ))}
          </div>
        ))}
      </div>

      {/* Recharts Live Chart */}
      <div className={`flex-1 border rounded p-3 min-h-0 ${
        isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-[#0f172a] border-slate-800'
      }`}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 4, right: 16, bottom: 4, left: 8 }}>
            <CartesianGrid strokeDasharray="2 4" stroke={isLight ? '#e2e8f0' : '#1e293b'} />
            <XAxis dataKey="i" tick={{ fontSize: 9, fill: isLight ? '#64748b' : '#94a3b8', fontFamily: 'JetBrains Mono' }} />
            <YAxis tick={{ fontSize: 9, fill: isLight ? '#64748b' : '#94a3b8', fontFamily: 'JetBrains Mono' }} width={45} />
            <Tooltip
              contentStyle={{ background: isLight ? '#ffffff' : '#0f172a', border: `1px solid ${isLight ? '#cbd5e1' : '#1e293b'}`, fontSize: 10, fontFamily: 'JetBrains Mono', color: isLight ? '#0f172a' : '#f8fafc' }}
              labelStyle={{ color: isLight ? '#64748b' : '#94a3b8' }}
            />
            <Legend wrapperStyle={{ fontSize: 9, fontFamily: 'JetBrains Mono', color: isLight ? '#0f172a' : '#f8fafc' }} />
            {CHANNELS.filter(c => selected.has(c.key)).map(c => (
              <Line
                key={c.key as string}
                type="monotone"
                dataKey={c.key as string}
                stroke={c.color}
                strokeWidth={1.5}
                dot={false}
                isAnimationActive={false}
                name={c.label}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
