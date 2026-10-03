import { useMemo } from 'react';
import type { ProcessedTelemetry, ESP32Telemetry } from '../types/telemetry';
import MetricCard from '../components/MetricCard';
import StatusBadge from '../components/StatusBadge';

interface LiveMonitoringPageProps {
  processed: ProcessedTelemetry;
  history: ESP32Telemetry[];
  theme?: 'dark' | 'light';
}

export default function LiveMonitoringPage({ processed, history, theme = 'dark' }: LiveMonitoringPageProps) {
  const { raw, status } = processed;
  const isLight = theme === 'light';
  const hasData = status.hasReceivedData && raw !== null;

  const latestJsonString = useMemo(() => {
    if (!raw) return '// Awaiting live ESP32 telemetry packet stream...';
    return JSON.stringify(raw, null, 2);
  }, [raw]);

  return (
    <div className={`h-full overflow-y-auto p-4 space-y-4 select-none font-mono ${
      isLight ? 'bg-slate-50 text-slate-900' : 'bg-[#060910] text-slate-100'
    }`}>
      
      {/* Top Stream Metric Summary */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <MetricCard
          label="STREAM STATUS"
          value={hasData ? (status.esp32Connected ? 'LIVE' : 'RECVD') : 'AWAITING'}
          statusColor={hasData ? (isLight ? '#059669' : '#22c55e') : (isLight ? '#d97706' : '#eab308')}
          accent
        />
        <MetricCard
          label="PACKET RATE"
          value={status.packetRateHz}
          unit="Hz"
          statusColor={isLight ? '#0284c7' : '#38bdf8'}
        />
        <MetricCard
          label="TOTAL PACKETS"
          value={status.totalPackets}
          statusColor={isLight ? '#7c3aed' : '#a78bfa'}
        />
        <MetricCard
          label="LATENCY"
          value={status.lastPacketMsAgo >= 0 ? status.lastPacketMsAgo : '--'}
          unit="ms"
          statusColor={status.lastPacketMsAgo >= 0 && status.lastPacketMsAgo < 100 ? (isLight ? '#059669' : '#22c55e') : (isLight ? '#64748b' : '#94a3b8')}
        />
        <MetricCard
          label="WEBSOCKET PORT"
          value=":5001"
          subtext="ws://[LAPTOP_IP]:5001"
          statusColor={isLight ? '#0284c7' : '#38bdf8'}
        />
        <MetricCard
          label="UDP PORT"
          value=":5000"
          subtext="HTTP / UDP Target"
          statusColor={isLight ? '#0284c7' : '#38bdf8'}
        />
      </div>

      {/* Main Grid: Data Stream Table + Raw JSON Ingest Terminal */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        
        {/* Left Panel: Real-Time Telemetry Data Stream Values */}
        <div className={`border rounded-lg p-4 space-y-3 ${
          isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-[#0f172a] border-slate-800'
        }`}>
          <div className={`flex items-center justify-between border-b pb-2 ${isLight ? 'border-slate-200' : 'border-slate-800'}`}>
            <span className={`text-xs font-bold uppercase tracking-wider flex items-center gap-2 ${isLight ? 'text-slate-900' : 'text-slate-200'}`}>
              <span>📡 INCOMING TELEMETRY VECTOR STREAM</span>
            </span>
            <StatusBadge status={hasData ? 'LIVE' : 'STANDBY'} />
          </div>

          <div className="space-y-1.5 text-xs">
            {[
              { label: 'TIMESTAMP', val: raw ? raw.timestamp : '--', unit: 'epoch' },
              { label: 'ROLL (ORIENTATION)', val: raw ? raw.roll.toFixed(2) : '--', unit: 'deg' },
              { label: 'PITCH (ELEVATION)', val: raw ? raw.pitch.toFixed(2) : '--', unit: 'deg' },
              { label: 'YAW (HEADING)', val: raw ? raw.yaw.toFixed(2) : '--', unit: 'deg' },
              { label: 'ACCEL X-AXIS', val: raw ? raw.ax.toFixed(2) : '--', unit: 'm/s²' },
              { label: 'ACCEL Y-AXIS', val: raw ? raw.ay.toFixed(2) : '--', unit: 'm/s²' },
              { label: 'ACCEL Z-AXIS', val: raw ? raw.az.toFixed(2) : '--', unit: 'm/s²' },
              { label: 'GYRO X-AXIS', val: raw ? raw.gx.toFixed(2) : '--', unit: '°/s' },
              { label: 'GYRO Y-AXIS', val: raw ? raw.gy.toFixed(2) : '--', unit: '°/s' },
              { label: 'GYRO Z-AXIS', val: raw ? raw.gz.toFixed(2) : '--', unit: '°/s' },
              { label: 'TEMPERATURE', val: raw ? raw.temperature.toFixed(1) : '--', unit: '°C' },
              { label: 'PRESSURE', val: raw ? raw.pressure.toFixed(1) : '--', unit: 'hPa' },
              { label: 'ALTITUDE', val: raw ? raw.altitude.toFixed(1) : '--', unit: 'm' },
              { label: 'BATTERY VOLTAGE', val: raw ? raw.battery.toFixed(2) : '--', unit: 'V' },
            ].map(({ label, val, unit }) => (
              <div key={label} className={`px-3 py-1.5 rounded border flex justify-between items-center ${
                isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#090d16] border-slate-800'
              }`}>
                <span className={`text-[10px] ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>{label}</span>
                <span className={`font-bold ${isLight ? 'text-slate-900' : 'text-slate-100'}`}>
                  {val} <span className={`text-[10px] font-normal ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>{unit}</span>
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Right Panel: Raw JSON Packet Stream Terminal */}
        <div className={`border rounded-lg p-4 space-y-3 flex flex-col ${
          isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-[#0f172a] border-slate-800'
        }`}>
          <div className={`flex items-center justify-between border-b pb-2 ${isLight ? 'border-slate-200' : 'border-slate-800'}`}>
            <span className={`text-xs font-bold uppercase tracking-wider flex items-center gap-2 ${isLight ? 'text-slate-900' : 'text-slate-200'}`}>
              <span>💻 RAW JSON INGEST TERMINAL</span>
            </span>
            <span className={`text-[9px] px-2 py-0.5 rounded font-bold ${
              isLight ? 'bg-sky-100 text-sky-800 border border-sky-200' : 'bg-sky-950 text-sky-400 border border-sky-500/30'
            }`}>
              WEBSOCKET PACKET DECODER
            </span>
          </div>

          <div className={`flex-1 border rounded p-3 text-[11px] font-mono leading-relaxed overflow-x-auto ${
            isLight ? 'bg-slate-900 text-emerald-400 border-slate-800' : 'bg-[#060910] text-emerald-400 border-slate-800'
          }`}>
            <pre>{latestJsonString}</pre>
          </div>

          <div className={`text-[9px] flex justify-between border-t pt-2 ${
            isLight ? 'border-slate-200 text-slate-500' : 'border-slate-800 text-slate-400'
          }`}>
            <span>PACKETS IN BUFFER: {history.length}</span>
            <span>FORMAT: JSON (UTF-8)</span>
          </div>
        </div>

      </div>

    </div>
  );
}
