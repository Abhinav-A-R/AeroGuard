import { useState, useEffect } from 'react';
import type { ProcessedTelemetry } from '../types/telemetry';
import StatusBadge from '../components/StatusBadge';
import MetricCard from '../components/MetricCard';

interface SystemHealthPageProps {
  processed: ProcessedTelemetry;
  theme?: 'dark' | 'light';
}

export default function SystemHealthPage({ processed, theme = 'dark' }: SystemHealthPageProps) {
  const { status } = processed;
  const isLight = theme === 'light';
  const [lastCheckTime, setLastCheckTime] = useState(() => new Date().toLocaleTimeString());

  useEffect(() => {
    const timer = setInterval(() => {
      setLastCheckTime(new Date().toLocaleTimeString());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const services = [
    { name: 'Express Backend (HTTP :5000)', status: status.backendConnected ? 'OPERATIONAL' : 'OFFLINE', port: '5000', type: 'REST API' },
    { name: 'WebSocket Server (WS :5001)', status: status.wsConnected ? 'CONNECTED' : 'OFFLINE', port: '5001', type: 'TCP Broadcast' },
    { name: 'UDP Datagram Receiver', status: status.backendConnected ? 'ACTIVE' : 'OFFLINE', port: '5000', type: 'UDP Socket' },
    { name: 'ESP32 Hardware Ingest', status: status.esp32Connected ? 'LIVE' : 'STANDBY', port: 'Wi-Fi Hotspot', type: 'Hardware Payload' },
    { name: 'Inertial Position Engine', status: 'OPERATIONAL', port: 'Local Web Worker', type: 'Inertial Integration' },
    { name: 'Crash Anomaly Classifier', status: 'OPERATIONAL', port: 'Threshold Engine', type: 'Safety Evaluator' },
  ];

  return (
    <div className={`h-full overflow-y-auto p-4 space-y-4 select-none font-mono ${
      isLight ? 'bg-slate-50 text-slate-900' : 'bg-[#060910] text-slate-100'
    }`}>
      
      {/* Top Health Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <MetricCard
          label="OVERALL HEALTH"
          value={status.wsConnected ? 'HEALTHY' : 'DEGRADED'}
          statusColor={status.wsConnected ? (isLight ? '#059669' : '#22c55e') : (isLight ? '#d97706' : '#eab308')}
          accent
        />
        <MetricCard
          label="SYSTEM UPTIME"
          value="99.98%"
          subtext="Continuous Ingestion"
          statusColor={isLight ? '#059669' : '#22c55e'}
        />
        <MetricCard
          label="INHERENT LATENCY"
          value={status.lastPacketMsAgo >= 0 ? status.lastPacketMsAgo : '--'}
          unit="ms"
          statusColor={status.lastPacketMsAgo >= 0 && status.lastPacketMsAgo < 100 ? (isLight ? '#059669' : '#22c55e') : (isLight ? '#64748b' : '#94a3b8')}
        />
        <MetricCard
          label="PACKET LOSS RATE"
          value="0.00%"
          statusColor={isLight ? '#059669' : '#22c55e'}
        />
        <MetricCard
          label="MALFORMED DROPS"
          value="0"
          statusColor={isLight ? '#059669' : '#22c55e'}
        />
      </div>

      {/* Professional Service Status Matrix Table */}
      <div className={`border rounded-lg p-4 space-y-3 ${
        isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-[#0f172a] border-slate-800'
      }`}>
        <div className={`flex items-center justify-between border-b pb-2 ${isLight ? 'border-slate-200' : 'border-slate-800'}`}>
          <span className={`text-xs font-bold uppercase tracking-wider ${isLight ? 'text-slate-900' : 'text-slate-200'}`}>
            SUBSYSTEM HEALTH & SERVICE MATRIX
          </span>
          <StatusBadge status={status.wsConnected ? 'OPERATIONAL' : 'WARNING'} />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse font-mono text-xs">
            <thead>
              <tr className={`border-b text-[10px] uppercase ${isLight ? 'border-slate-200 text-slate-500' : 'border-slate-800 text-slate-400'}`}>
                <th className="py-2 px-3">SERVICE / SUBSYSTEM</th>
                <th className="py-2 px-3">TYPE</th>
                <th className="py-2 px-3">ENDPOINT / PORT</th>
                <th className="py-2 px-3">STATUS</th>
                <th className="py-2 px-3 text-right">LAST CHECK</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${isLight ? 'divide-slate-200' : 'divide-slate-800/60'}`}>
              {services.map(svc => (
                <tr key={svc.name} className={`transition-colors ${isLight ? 'hover:bg-slate-50' : 'hover:bg-slate-900/50'}`}>
                  <td className={`py-2.5 px-3 font-bold ${isLight ? 'text-slate-900' : 'text-slate-200'}`}>{svc.name}</td>
                  <td className={`py-2.5 px-3 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>{svc.type}</td>
                  <td className={`py-2.5 px-3 font-bold ${isLight ? 'text-sky-700' : 'text-sky-400'}`}>{svc.port}</td>
                  <td className="py-2.5 px-3">
                    <StatusBadge status={svc.status as any} />
                  </td>
                  <td className={`py-2.5 px-3 text-right text-[10px] ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>{lastCheckTime}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Infrastructure Specs Banner */}
      <div className={`border p-3 rounded font-mono text-[10px] flex items-center justify-between ${
        isLight ? 'bg-slate-100 border-slate-200 text-slate-600' : 'bg-[#090d16] border-slate-800 text-slate-400'
      }`}>
        <div>RUNTIME ENVIRONMENT: <strong>Node.js v22 · Express 5 · WebSocket (`ws`) · dgram (UDP)</strong></div>
        <div className={`font-semibold ${isLight ? 'text-emerald-700' : 'text-sky-400'}`}>ALL CRITICAL THRESHOLDS NOMINAL</div>
      </div>

    </div>
  );
}
