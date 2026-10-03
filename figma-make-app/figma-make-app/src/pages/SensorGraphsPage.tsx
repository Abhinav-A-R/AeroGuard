import { useState, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import type { ESP32Telemetry } from '../types/telemetry';

interface SensorGraphsProps {
  history: ESP32Telemetry[];
  running: boolean;
  onToggle: () => void;
  onClear: () => void;
}

type Channel = { key: keyof ESP32Telemetry; label: string; color: string; group: string };

const CHANNELS: Channel[] = [
  { key: 'ax', label: 'Accel X', color: '#22d3ee', group: 'Accelerometer' },
  { key: 'ay', label: 'Accel Y', color: '#0ea5e9', group: 'Accelerometer' },
  { key: 'az', label: 'Accel Z', color: '#38bdf8', group: 'Accelerometer' },
  { key: 'gx', label: 'Gyro X', color: '#a78bfa', group: 'Gyroscope' },
  { key: 'gy', label: 'Gyro Y', color: '#818cf8', group: 'Gyroscope' },
  { key: 'gz', label: 'Gyro Z', color: '#6366f1', group: 'Gyroscope' },
  { key: 'roll', label: 'Roll', color: '#22c55e', group: 'Orientation' },
  { key: 'pitch', label: 'Pitch', color: '#eab308', group: 'Orientation' },
  { key: 'yaw', label: 'Yaw', color: '#f97316', group: 'Orientation' },
  { key: 'altitude', label: 'Altitude', color: '#38bdf8', group: 'Environment' },
  { key: 'battery', label: 'Battery V', color: '#ef4444', group: 'System' },
];

const TIME_RANGES = [10, 30, 60, 120, 300];

export default function SensorGraphsPage({ history, running, onToggle, onClear }: SensorGraphsProps) {
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
    <div className="h-full flex flex-col p-4 gap-3 select-none">
      {/* Controls */}
      <div className="flex items-center gap-3 flex-shrink-0">
        <button
          onClick={onToggle}
          className={`px-4 py-1.5 rounded font-mono text-xs font-semibold border transition-colors ${
            running
              ? 'border-[#eab308] text-[#eab308] bg-[#eab308]/10 hover:bg-[#eab308]/20'
              : 'border-[#22c55e] text-[#22c55e] bg-[#22c55e]/10 hover:bg-[#22c55e]/20'
          }`}
        >
          {running ? '⏸ PAUSE' : '▶ START'}
        </button>
        <button
          onClick={onClear}
          className="px-4 py-1.5 rounded font-mono text-xs font-semibold border border-[#1e2a3e] text-[#637087] hover:border-[#ef4444] hover:text-[#ef4444] transition-colors"
        >
          ✕ CLEAR
        </button>
        <div className="flex items-center gap-1 ml-2">
          <span className="font-mono text-[10px] text-[#637087] mr-1">BUFFER:</span>
          {TIME_RANGES.map(t => (
            <button
              key={t}
              onClick={() => setTimeRange(t)}
              className={`px-2 py-1 font-mono text-[10px] rounded border transition-colors ${
                timeRange === t
                  ? 'border-[#0ea5e9] text-[#0ea5e9] bg-[#0ea5e9]/10 font-bold'
                  : 'border-[#1e2a3e] text-[#637087] hover:border-[#637087]'
              }`}
            >
              {t}s
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-1 font-mono text-[10px]">
          <div className={`w-2 h-2 rounded-full ${running ? 'bg-[#22c55e]' : 'bg-[#637087]'}`} />
          <span className="text-[#637087]">{history.length.toLocaleString()} SAMPLES IN BUFFER</span>
        </div>
      </div>

      {/* Channel Selector */}
      <div className="flex-shrink-0 flex flex-wrap gap-3 bg-[#0d1320] border border-[#1e2a3e] p-2.5 rounded">
        {groups.map(group => (
          <div key={group} className="flex items-center gap-1">
            <span className="font-mono text-[9px] text-[#637087] uppercase mr-1 font-bold">{group}:</span>
            {CHANNELS.filter(c => c.group === group).map(c => (
              <button
                key={c.key as string}
                onClick={() => toggleChannel(c.key)}
                className={`px-2 py-0.5 rounded font-mono text-[10px] border transition-all ${
                  selected.has(c.key)
                    ? 'border-current text-current bg-current/10 font-bold'
                    : 'border-[#1e2a3e] text-[#637087]'
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
      <div className="flex-1 bg-[#0d1320] border border-[#1e2a3e] rounded p-3 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 4, right: 16, bottom: 4, left: 8 }}>
            <CartesianGrid strokeDasharray="2 4" stroke="#1e2a3e" />
            <XAxis dataKey="i" tick={{ fontSize: 9, fill: '#637087', fontFamily: 'JetBrains Mono' }} />
            <YAxis tick={{ fontSize: 9, fill: '#637087', fontFamily: 'JetBrains Mono' }} width={45} />
            <Tooltip
              contentStyle={{ background: '#0d1320', border: '1px solid #1e2a3e', fontSize: 10, fontFamily: 'JetBrains Mono' }}
              labelStyle={{ color: '#637087' }}
            />
            <Legend wrapperStyle={{ fontSize: 9, fontFamily: 'JetBrains Mono' }} />
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
