interface NetworkDiagramProps {
  esp32Connected: boolean;
  backendConnected: boolean;
  wsConnected: boolean;
  packetRateHz: number;
  httpPort: number;
  wsPort: number;
  theme?: 'dark' | 'light';
}

export default function NetworkDiagram({
  esp32Connected,
  backendConnected,
  wsConnected,
  packetRateHz,
  httpPort,
  wsPort,
  theme = 'dark',
}: NetworkDiagramProps) {
  const isLight = theme === 'light';

  return (
    <div className={`border rounded-lg p-4 space-y-4 select-none ${
      isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-[#0f172a] border-slate-800'
    }`}>
      <div className={`flex items-center justify-between border-b pb-2 ${isLight ? 'border-slate-200' : 'border-slate-800'}`}>
        <div className={`font-mono text-xs font-bold tracking-wider uppercase flex items-center gap-2 ${
          isLight ? 'text-slate-900' : 'text-slate-200'
        }`}>
          <span>SYSTEM NETWORK & DATA FLOW TOPOLOGY</span>
          <span className={`text-[9px] px-2 py-0.5 rounded font-bold ${
            isLight ? 'bg-sky-100 text-sky-800 border border-sky-200' : 'bg-sky-950 text-sky-400 border border-sky-500/30'
          }`}>
            ENGINEERING DIAGRAM
          </span>
        </div>
        <div className={`font-mono text-[10px] ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
          STREAM RATE: <strong className={isLight ? 'text-sky-700' : 'text-sky-400'}>{packetRateHz} Hz</strong>
        </div>
      </div>

      {/* Node Flow Diagram Grid */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-center">
        
        {/* Node 1: HARDWARE DEVICE */}
        <div className={`p-3 rounded border font-mono ${
          esp32Connected 
            ? isLight ? 'bg-emerald-50 border-emerald-300 text-emerald-900' : 'bg-emerald-950/20 border-emerald-500/40 text-emerald-300'
            : isLight ? 'bg-slate-50 border-slate-200 text-slate-500' : 'bg-slate-900 border-slate-800 text-slate-400'
        }`}>
          <div className={`text-[9px] uppercase tracking-widest ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>ORIGIN NODE</div>
          <div className={`font-bold text-xs mt-1 ${isLight ? 'text-slate-900' : 'text-slate-100'}`}>ESP32-C3 SUPER MINI</div>
          <div className={`text-[9px] mt-1 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>IMU / MPU6050 Sensors</div>
          <div className="mt-2 text-[9px] font-semibold">
            STATUS: {esp32Connected ? '✓ TRANSMITTING' : '⏸ STANDBY'}
          </div>
        </div>

        {/* Arrow 1 */}
        <div className="flex flex-col items-center justify-center font-mono text-xs">
          <span className={`text-[9px] font-bold ${isLight ? 'text-sky-700' : 'text-sky-400'}`}>Wi-Fi Hotspot</span>
          <span className={isLight ? 'text-slate-400' : 'text-slate-500'}>──────►</span>
          <span className={`text-[8px] ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>JSON Payload</span>
        </div>

        {/* Node 2: NODE.JS BRIDGE SERVER */}
        <div className={`p-3 rounded border font-mono ${
          isLight ? 'bg-sky-50 border-sky-300 text-sky-900' : 'bg-sky-950/20 border-sky-500/40 text-sky-300'
        }`}>
          <div className={`text-[9px] uppercase tracking-widest ${isLight ? 'text-sky-700' : 'text-sky-400'}`}>INGESTION BRIDGE</div>
          <div className={`font-bold text-xs mt-1 ${isLight ? 'text-slate-900' : 'text-slate-100'}`}>NODE.JS BRIDGE</div>
          <div className={`text-[9px] mt-1 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Express + UDP Socket</div>
          <div className={`mt-2 text-[9px] font-semibold ${isLight ? 'text-emerald-700' : 'text-emerald-400'}`}>
            HTTP/UDP PORT: :{httpPort}
          </div>
        </div>

        {/* Arrow 2 */}
        <div className="flex flex-col items-center justify-center font-mono text-xs">
          <span className={`text-[9px] font-bold ${isLight ? 'text-emerald-700' : 'text-emerald-400'}`}>WebSocket</span>
          <span className={isLight ? 'text-slate-400' : 'text-slate-500'}>──────►</span>
          <span className={`text-[8px] ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>ws://[IP]:{wsPort}</span>
        </div>

        {/* Node 3: AERO GUARD WEB APP */}
        <div className={`p-3 rounded border font-mono ${
          wsConnected 
            ? isLight ? 'bg-emerald-50 border-emerald-300 text-emerald-900' : 'bg-emerald-950/20 border-emerald-500/40 text-emerald-300'
            : isLight ? 'bg-slate-50 border-slate-200 text-slate-500' : 'bg-slate-900 border-slate-800 text-slate-400'
        }`}>
          <div className={`text-[9px] uppercase tracking-widest ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>CLIENT TERMINAL</div>
          <div className={`font-bold text-xs mt-1 ${isLight ? 'text-slate-900' : 'text-slate-100'}`}>AERO GUARD UI</div>
          <div className={`text-[9px] mt-1 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>React 18 Ground Station</div>
          <div className="mt-2 text-[9px] font-semibold">
            WEBSOCKET: {wsConnected ? '✓ CONNECTED' : '❌ DISCONNECTED'}
          </div>
        </div>

      </div>

      {/* Protocol Summary Table */}
      <div className={`grid grid-cols-3 gap-2 font-mono text-[10px] pt-2 border-t ${
        isLight ? 'border-slate-200 text-slate-600' : 'border-slate-800 text-slate-400'
      }`}>
        <div>PROTOCOL 1: <strong className={isLight ? 'text-slate-900' : 'text-slate-200'}>UDP Port {httpPort} (High Rate Socket)</strong></div>
        <div>PROTOCOL 2: <strong className={isLight ? 'text-slate-900' : 'text-slate-200'}>HTTP REST POST /api/telemetry</strong></div>
        <div>PROTOCOL 3: <strong className={isLight ? 'text-slate-900' : 'text-slate-200'}>WebSocket ws://[IP]:{wsPort} Stream</strong></div>
      </div>
    </div>
  );
}
