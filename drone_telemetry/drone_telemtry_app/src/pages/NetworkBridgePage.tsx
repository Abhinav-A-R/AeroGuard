import type { ProcessedTelemetry } from '../types/telemetry';
import MetricCard from '../components/MetricCard';
import StatusBadge from '../components/StatusBadge';
import NetworkDiagram from '../components/NetworkDiagram';

interface NetworkBridgePageProps {
  processed: ProcessedTelemetry;
  laptopIp: string;
  backendPort: number;
  wsPort: number;
  theme?: 'dark' | 'light';
}

export default function NetworkBridgePage({
  processed,
  laptopIp,
  backendPort,
  wsPort,
  theme = 'dark',
}: NetworkBridgePageProps) {
  const { status } = processed;
  const isLight = theme === 'light';

  return (
    <div className={`h-full overflow-y-auto p-4 space-y-4 select-none font-mono ${
      isLight ? 'bg-slate-50 text-slate-900' : 'bg-[#060910] text-slate-100'
    }`}>
      
      {/* Top Network KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <MetricCard
          label="NODE.JS BRIDGE"
          value={status.backendConnected ? 'RUNNING' : 'OFFLINE'}
          statusColor={status.backendConnected ? (isLight ? '#059669' : '#22c55e') : (isLight ? '#dc2626' : '#ef4444')}
          accent
        />
        <MetricCard
          label="WEBSOCKET"
          value={status.wsConnected ? 'CONNECTED' : 'OFFLINE'}
          statusColor={status.wsConnected ? (isLight ? '#059669' : '#22c55e') : (isLight ? '#dc2626' : '#ef4444')}
        />
        <MetricCard
          label="UDP RECEIVER"
          value={status.backendConnected ? 'ACTIVE' : 'STANDBY'}
          statusColor={status.backendConnected ? (isLight ? '#059669' : '#22c55e') : (isLight ? '#d97706' : '#eab308')}
        />
        <MetricCard
          label="HTTP / UDP PORT"
          value={`:${backendPort}`}
          subtext={`Target: ${laptopIp}:${backendPort}`}
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
      </div>

      {/* Engineering Network Flow Diagram Component */}
      <NetworkDiagram
        esp32Connected={status.esp32Connected}
        backendConnected={status.backendConnected}
        wsConnected={status.wsConnected}
        packetRateHz={status.packetRateHz}
        httpPort={backendPort}
        wsPort={wsPort}
        theme={theme}
      />

      {/* Network Configuration & Node Details Matrix */}
      <div className={`border rounded-lg p-4 space-y-3 ${
        isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-[#0f172a] border-slate-800'
      }`}>
        <div className={`flex items-center justify-between border-b pb-2 ${isLight ? 'border-slate-200' : 'border-slate-800'}`}>
          <span className={`text-xs font-bold uppercase tracking-wider ${isLight ? 'text-slate-900' : 'text-slate-200'}`}>
            NETWORK ENDPOINTS & SOCKET MATRIX
          </span>
          <StatusBadge status={status.wsConnected ? 'OPERATIONAL' : 'WARNING'} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          
          <div className={`p-3 rounded border space-y-2 ${
            isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#090d16] border-slate-800'
          }`}>
            <div className={`font-bold uppercase text-[10px] border-b pb-1 ${
              isLight ? 'text-sky-700 border-slate-200' : 'text-sky-400 border-slate-800'
            }`}>
              ESP32 HARDWARE INGEST TARGET
            </div>
            <div className={`flex justify-between ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
              <span className={isLight ? 'text-slate-500' : 'text-slate-500'}>LAPTOP IP:</span>
              <span className={`font-bold ${isLight ? 'text-slate-900' : 'text-slate-100'}`}>{laptopIp}</span>
            </div>
            <div className={`flex justify-between ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
              <span className={isLight ? 'text-slate-500' : 'text-slate-500'}>HTTP REST ENDPOINT:</span>
              <span className={`font-bold ${isLight ? 'text-sky-700' : 'text-sky-400'}`}>http://{laptopIp}:{backendPort}/api/telemetry</span>
            </div>
            <div className={`flex justify-between ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
              <span className={isLight ? 'text-slate-500' : 'text-slate-500'}>UDP SOCKET BIND:</span>
              <span className={`font-bold ${isLight ? 'text-sky-700' : 'text-sky-400'}`}>0.0.0.0:{backendPort} (UDP4)</span>
            </div>
          </div>

          <div className={`p-3 rounded border space-y-2 ${
            isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#090d16] border-slate-800'
          }`}>
            <div className={`font-bold uppercase text-[10px] border-b pb-1 ${
              isLight ? 'text-emerald-700 border-slate-200' : 'text-emerald-400 border-slate-800'
            }`}>
              BROWSER WEBSOCKET SERVER
            </div>
            <div className={`flex justify-between ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
              <span className={isLight ? 'text-slate-500' : 'text-slate-500'}>WEBSOCKET URL:</span>
              <span className={`font-bold ${isLight ? 'text-emerald-700' : 'text-emerald-400'}`}>ws://{laptopIp}:{wsPort}</span>
            </div>
            <div className={`flex justify-between ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
              <span className={isLight ? 'text-slate-500' : 'text-slate-500'}>CLIENT PROTOCOL:</span>
              <span className={`font-bold ${isLight ? 'text-slate-900' : 'text-slate-100'}`}>JSON Broadcast</span>
            </div>
            <div className={`flex justify-between ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
              <span className={isLight ? 'text-slate-500' : 'text-slate-500'}>TIMEOUT HANDLER:</span>
              <span className={`font-bold ${isLight ? 'text-slate-900' : 'text-slate-100'}`}>3000 ms Auto-Dropout Warning</span>
            </div>
          </div>

        </div>
      </div>

    </div>
  );
}
