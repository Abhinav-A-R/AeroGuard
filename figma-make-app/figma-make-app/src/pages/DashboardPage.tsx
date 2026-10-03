import { useMemo, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer } from 'recharts';
import type { ProcessedTelemetry, ESP32Telemetry } from '../types/telemetry';

interface DashboardProps {
  processed: ProcessedTelemetry;
  telemetryHistory: ESP32Telemetry[];
  onCalibrate: () => void;
  onResetPosition: () => void;
}

function StatCard({ label, value, unit, color = '#d4dae6' }: { label: string; value: string | number; unit?: string; color?: string }) {
  return (
    <div className="bg-[#0d1320] border border-[#1e2a3e] rounded p-2.5 flex flex-col justify-between select-none">
      <div className="text-[9px] font-mono text-[#637087] uppercase tracking-widest">{label}</div>
      <div className="font-mono text-lg font-bold" style={{ color }}>
        {value}
        {unit && <span className="text-xs font-normal text-[#637087] ml-1">{unit}</span>}
      </div>
    </div>
  );
}

function MiniGraph({ data, dataKey, color, label }: { data: ESP32Telemetry[]; dataKey: keyof ESP32Telemetry; color: string; label: string }) {
  const chartData = useMemo(() => {
    return data.slice(-50).map((r, i) => ({ i, v: r[dataKey] as number }));
  }, [data, dataKey]);

  return (
    <div className="bg-[#0d1320] border border-[#1e2a3e] rounded p-2 select-none">
      <div className="text-[9px] font-mono text-[#637087] uppercase mb-1 flex justify-between">
        <span>{label}</span>
        <span style={{ color }}>{data.length > 0 ? (data[data.length - 1][dataKey] as number)?.toFixed(1) : '--'}</span>
      </div>
      <ResponsiveContainer width="100%" height="40">
        <LineChart data={chartData}>
          <Line type="monotone" dataKey="v" stroke={color} strokeWidth={1.5} dot={false} isAnimationActive={false} />
          <YAxis domain={['auto', 'auto']} hide />
          <XAxis dataKey="i" hide />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function ArtificialHorizonPFD({ roll = 0, pitch = 0, yaw = 0, active = false }: { roll?: number; pitch?: number; yaw?: number; active?: boolean }) {
  const clampedPitch = Math.max(-45, Math.min(45, pitch));
  const pitchY = clampedPitch * 1.6;
  const normYaw = (yaw % 360 + 360) % 360;

  return (
    <div className="bg-[#0d1320] border border-[#1e2a3e] rounded p-3 flex flex-col items-center select-none h-full justify-between">
      <div className="text-[10px] font-mono text-[#637087] uppercase tracking-widest flex items-center gap-2">
        <span>Artificial Horizon</span>
        <span className="text-[9px] text-[#0ea5e9] bg-[#0ea5e9]/10 border border-[#0ea5e9]/30 rounded px-1 py-0.2">PFD</span>
      </div>
      
      <div className="relative w-36 h-36 rounded-full overflow-hidden border-2 border-[#1e2a3e] shadow-inner my-1" style={{ background: '#080c12' }}>
        <svg width="144" height="144" viewBox="-72 -72 144 144" className="absolute inset-0">
          <defs>
            <clipPath id="pfd-clip">
              <circle cx="0" cy="0" r="70" />
            </clipPath>
          </defs>

          {/* Horizon Group (Rotates & Translates) */}
          <g clipPath="url(#pfd-clip)">
            <g transform={`rotate(${-roll}) translate(0, ${pitchY})`}>
              <rect x="-120" y="-200" width="240" height="200" fill="#094b7a" />
              <rect x="-120" y="0" width="240" height="200" fill="#1b3d1f" />
              <line x1="-120" y1="0" x2="120" y2="0" stroke="#ffffff" strokeWidth="2" />

              {[-30, -20, -10, 10, 20, 30].map(deg => {
                const py = -deg * 1.6;
                return (
                  <g key={deg} transform={`translate(0, ${py})`}>
                    <line x1="-18" y1="0" x2="18" y2="0" stroke="#ffffff" strokeWidth="1.2" opacity="0.8" />
                    <text x="-23" y="3" fill="#ffffff" fontSize="7" fontFamily="JetBrains Mono, monospace" textAnchor="end" opacity="0.85">
                      {Math.abs(deg)}
                    </text>
                    <text x="23" y="3" fill="#ffffff" fontSize="7" fontFamily="JetBrains Mono, monospace" textAnchor="start" opacity="0.85">
                      {Math.abs(deg)}
                    </text>
                  </g>
                );
              })}
            </g>
          </g>

          {/* Roll Scale */}
          {[-45, -30, -20, -10, 0, 10, 20, 30, 45].map(deg => {
            const rad = (deg - 90) * (Math.PI / 180);
            const x1 = Math.cos(rad) * 65;
            const y1 = Math.sin(rad) * 65;
            const x2 = Math.cos(rad) * (deg === 0 ? 56 : 61);
            const y2 = Math.sin(rad) * (deg === 0 ? 56 : 61);
            return <line key={deg} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#38bdf8" strokeWidth={deg === 0 ? 2 : 1} opacity="0.7" />;
          })}

          <g transform={`rotate(${-roll})`}>
            <polygon points="0,-64 -4,-56 4,-56" fill="#eab308" />
          </g>

          {/* Aircraft Crosshair */}
          <g fill="none" stroke="#eab308" strokeWidth="2">
            <line x1="-28" y1="0" x2="-10" y2="0" />
            <line x1="-10" y1="0" x2="-10" y2="5" />
            <line x1="10" y1="0" x2="28" y2="0" />
            <line x1="10" y1="0" x2="10" y2="5" />
            <circle cx="0" cy="0" r="3" fill="#eab308" />
          </g>
        </svg>

        <div className="absolute bottom-1 left-2 font-mono text-[8px] text-cyan-300 bg-black/70 px-1 rounded border border-cyan-500/30">
          R:{active ? roll.toFixed(1) : '--'}°
        </div>
        <div className="absolute bottom-1 right-2 font-mono text-[8px] text-amber-300 bg-black/70 px-1 rounded border border-amber-500/30">
          P:{active ? pitch.toFixed(1) : '--'}°
        </div>
      </div>

      <div className="font-mono text-[10px] text-[#637087] flex items-center gap-2">
        <span>YAW:</span>
        <span className="text-white font-bold bg-[#080c12] px-2 py-0.5 rounded border border-[#1e2a3e]">
          {active ? `${normYaw.toFixed(1)}°` : '--°'}
        </span>
      </div>
    </div>
  );
}

export default function DashboardPage({ processed, telemetryHistory, onCalibrate, onResetPosition }: DashboardProps) {
  const { raw, crashRisk, position, calibration, status } = processed;
  const [copiedGps, setCopiedGps] = useState(false);

  const hasData = status.hasReceivedData && raw !== null;

  // Motion & Crash Risk Styling Rules
  const motionState = !hasData ? 'STANDBY' : (crashRisk?.motionState || 'USUAL MOTION');
  const crashPred = !hasData ? 'STANDBY' : (crashRisk?.crashPrediction || 'SAFE (NO CRASH PREDICTED)');
  const willCrash = hasData && (crashRisk?.willCrash || false);

  const motionBg = !hasData ? 'bg-[#1e2a3e]/30 border-[#1e2a3e] text-[#637087]' :
    motionState === 'UNUSUAL MOTION' ? 'bg-[#ef4444]/20 border-[#ef4444] text-[#ef4444] animate-pulse' : 'bg-[#22c55e]/15 border-[#22c55e] text-[#22c55e]';

  const crashColor = !hasData ? '#637087' :
    willCrash ? '#ef4444' :
    crashRisk?.level === 'MEDIUM RISK' || crashRisk?.level === 'LOW RISK' ? '#eab308' : '#22c55e';

  const crashBg = !hasData ? 'bg-[#1e2a3e]/30 border-[#1e2a3e] text-[#637087]' :
    willCrash ? 'bg-[#ef4444] text-white animate-bounce border-red-500' :
    crashRisk?.level === 'MEDIUM RISK' || crashRisk?.level === 'LOW RISK' ? 'bg-[#eab308]/20 border-[#eab308] text-[#eab308]' : 'bg-[#22c55e]/20 border-[#22c55e] text-[#22c55e]';

  const handleCopyGps = () => {
    const coords = `${position.droneLat}, ${position.droneLon}`;
    navigator.clipboard.writeText(coords);
    setCopiedGps(true);
    setTimeout(() => setCopiedGps(false), 2000);
  };

  return (
    <div className="h-full overflow-y-auto p-4 space-y-4 select-none">
      
      {/* 🚨 HERO PROMINENT SECTION 1: CRASH PREDICTION & MOTION MONITOR BOARD (HIGHLIGHTED) */}
      <div 
        className={`rounded-lg p-4 border-2 transition-all duration-300 shadow-lg ${
          !hasData ? 'bg-[#0d1320] border-[#1e2a3e]' :
          willCrash ? 'bg-[#2d0a0a] border-[#ef4444] shadow-red-900/40' :
          motionState === 'UNUSUAL MOTION' ? 'bg-[#281c07] border-[#f97316] shadow-amber-900/30' :
          'bg-[#062016] border-[#22c55e] shadow-emerald-900/20'
        }`}
      >
        <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-3">
          <div className="flex items-center gap-3">
            <div className={`w-3.5 h-3.5 rounded-full ${!hasData ? 'bg-gray-500' : willCrash ? 'bg-red-500 animate-ping' : motionState === 'UNUSUAL MOTION' ? 'bg-amber-500 animate-pulse' : 'bg-emerald-400'}`} />
            <div>
              <h2 className="font-mono text-sm font-extrabold uppercase tracking-widest text-white flex items-center gap-2">
                CRASH PREDICTION & MOTION CLASSIFICATION
                <span className="text-[10px] text-cyan-400 bg-cyan-950/80 px-2 py-0.5 rounded border border-cyan-500/40 font-normal">
                  REAL-TIME ANOMALY ENGINE
                </span>
              </h2>
              <p className="font-mono text-[10px] text-gray-400">
                Monitors physical $g$-forces, angular rotation rate, impulse jerk, and orientation tilt.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Motion State Badge */}
            <div className={`px-3 py-1.5 rounded-md border font-mono text-xs font-black tracking-wider uppercase ${motionBg}`}>
              {motionState === 'STANDBY' ? 'MOTION: STANDBY' : `MOTION: ${motionState}`}
            </div>

            {/* Crash Prediction Badge */}
            <div className={`px-4 py-1.5 rounded-md border font-mono text-xs font-black tracking-wider uppercase shadow-md ${crashBg}`}>
              {crashPred === 'STANDBY' ? 'PREDICTION: STANDBY' : `CRASH PREDICTION: ${crashPred}`}
            </div>
          </div>
        </div>

        {/* Risk Score Progress Bar */}
        <div className="space-y-1 mb-3">
          <div className="flex justify-between font-mono text-[10px] text-gray-300">
            <span className="uppercase font-bold">PHYSICAL ANOMALY RISK SCORE:</span>
            <span className="font-bold" style={{ color: crashColor }}>
              {hasData && crashRisk ? `${crashRisk.score}% (${crashRisk.level})` : '0% (STANDBY)'}
            </span>
          </div>
          <div className="w-full bg-black/60 h-2.5 rounded-full overflow-hidden border border-white/10 p-0.5">
            <div 
              className="h-full rounded-full transition-all duration-300" 
              style={{ 
                width: `${hasData && crashRisk ? Math.max(5, crashRisk.score) : 0}%`,
                backgroundColor: crashColor,
                boxShadow: `0 0 8px ${crashColor}`
              }} 
            />
          </div>
        </div>

        {/* Physical Metrics Grid */}
        <div className="grid grid-cols-4 gap-2 mb-3">
          <div className="bg-black/50 p-2 rounded border border-white/10">
            <div className="text-[8px] font-mono text-gray-400 uppercase">G-FORCE ACCEL MAG</div>
            <div className="font-mono text-sm font-bold text-white">
              {hasData && crashRisk ? `${crashRisk.accelMag} m/s²` : '--'}
            </div>
            <div className="text-[8px] font-mono text-gray-500">Threshold: &gt;20 m/s²</div>
          </div>
          <div className="bg-black/50 p-2 rounded border border-white/10">
            <div className="text-[8px] font-mono text-gray-400 uppercase">ROTATIONAL SPIN RATE</div>
            <div className="font-mono text-sm font-bold text-white">
              {hasData && crashRisk ? `${crashRisk.gyroMag} °/s` : '--'}
            </div>
            <div className="text-[8px] font-mono text-gray-500">Threshold: &gt;180 °/s</div>
          </div>
          <div className="bg-black/50 p-2 rounded border border-white/10">
            <div className="text-[8px] font-mono text-gray-400 uppercase">IMPULSE JERK</div>
            <div className="font-mono text-sm font-bold text-white">
              {hasData && crashRisk ? `${crashRisk.jerk} m/s³` : '--'}
            </div>
            <div className="text-[8px] font-mono text-gray-500">Threshold: &gt;60 m/s³</div>
          </div>
          <div className="bg-black/50 p-2 rounded border border-white/10">
            <div className="text-[8px] font-mono text-gray-400 uppercase">ALTITUDE CHANGE RATE</div>
            <div className="font-mono text-sm font-bold text-white">
              {hasData && crashRisk ? `${crashRisk.altRate} m/s` : '--'}
            </div>
            <div className="text-[8px] font-mono text-gray-500">Drop Limit: &lt;-6 m/s</div>
          </div>
        </div>

        {/* Active Risk Trigger Reasons */}
        <div className="bg-black/60 p-2.5 rounded border border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2 font-mono text-xs">
            <span className="text-gray-400 uppercase font-bold text-[10px]">ACTIVE MOTION DIAGNOSTIC:</span>
            {!hasData || !crashRisk ? (
              <span className="text-gray-500">Awaiting real ESP32 telemetry packet stream...</span>
            ) : crashRisk.reasons.length === 0 ? (
              <span className="text-emerald-400 font-bold">✓ USUAL MOTION DETECTED — All telemetry vectors nominal</span>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {crashRisk.reasons.map((r, i) => (
                  <span key={i} className="bg-red-950/80 border border-red-500/60 text-red-300 text-[10px] font-bold px-2 py-0.5 rounded flex items-center gap-1">
                    <span>⚠</span> {r}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 📐 PROMINENT SECTION 2: APPROXIMATE DISTANCE, POSITION & GPS BOARD */}
      <div className="grid grid-cols-3 gap-3">

        {/* Highlight Tile A: APPROXIMATE DISTANCE FROM LAPTOP */}
        <div className="bg-[#0d1320] border-2 border-[#0ea5e9]/60 rounded-lg p-3.5 space-y-3 shadow-lg shadow-cyan-950/20">
          <div className="flex items-center justify-between border-b border-[#1e2a3e] pb-2">
            <div className="font-mono text-xs font-black text-white flex items-center gap-2">
              <span className="text-base text-[#38bdf8]">📐</span>
              <span>APPROXIMATE DISTANCE</span>
            </div>
            <span className="font-mono text-[9px] text-[#38bdf8] bg-[#38bdf8]/10 border border-[#38bdf8]/30 px-1.5 py-0.5 rounded">
              3D RANGE
            </span>
          </div>

          <div className="bg-[#080c12] p-3 rounded-lg border border-[#38bdf8]/30 text-center">
            <div className="text-[9px] font-mono text-[#637087] uppercase tracking-wider mb-0.5">DIRECT 3D SLANT DISTANCE FROM LAPTOP</div>
            <div className="font-mono text-3xl font-black text-[#38bdf8] drop-shadow-[0_0_8px_rgba(56,189,248,0.4)]">
              {position.distanceFromLaptop} <span className="text-base font-normal text-[#637087]">meters</span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-1.5 font-mono text-xs">
            <div className="bg-[#080c12] p-2 rounded border border-[#1e2a3e] text-center">
              <div className="text-[8px] text-[#637087] uppercase">2D GROUND DIST</div>
              <div className="font-bold text-[#22c55e] text-sm">{position.groundDistance} m</div>
            </div>
            <div className="bg-[#080c12] p-2 rounded border border-[#1e2a3e] text-center">
              <div className="text-[8px] text-[#637087] uppercase">ALTITUDE (Z)</div>
              <div className="font-bold text-white text-sm">{position.relZ} m</div>
            </div>
            <div className="bg-[#080c12] p-2 rounded border border-[#1e2a3e] text-center">
              <div className="text-[8px] text-[#637087] uppercase">WI-FI RSSI RANGE</div>
              <div className="font-bold text-[#eab308] text-sm">
                {position.wifiDistance > 0 ? `${position.wifiDistance} m` : '--'}
              </div>
            </div>
          </div>

          <div className="text-[8px] font-mono text-[#637087] leading-tight">
            Distance derived from 3D vector $\sqrt&#123;X^2 + Y^2 + Z^2&#125;$ & Wi-Fi log-distance path loss.
          </div>
        </div>

        {/* Highlight Tile B: DRONE RELATIVE GPS COORDINATES */}
        <div className="bg-[#0d1320] border-2 border-[#22c55e]/60 rounded-lg p-3.5 space-y-3 shadow-lg shadow-emerald-950/20">
          <div className="flex items-center justify-between border-b border-[#1e2a3e] pb-2">
            <div className="font-mono text-xs font-black text-white flex items-center gap-2">
              <span className="text-base text-[#22c55e]">🛰️</span>
              <span>DRONE RELATIVE GPS COORDINATES</span>
            </div>
            <button
              onClick={handleCopyGps}
              className="px-2 py-0.5 rounded font-mono text-[9px] border border-[#22c55e]/50 text-[#22c55e] hover:bg-[#22c55e]/20 transition-colors"
            >
              {copiedGps ? '✓ COPIED!' : '📋 COPY COORDS'}
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="bg-[#080c12] p-2.5 rounded border border-[#22c55e]/40">
              <div className="text-[8px] font-mono text-[#637087] uppercase">APPROX LATITUDE</div>
              <div className="font-mono text-lg font-black text-[#22c55e]">
                {position.droneLat}° N
              </div>
              <div className="text-[8px] font-mono text-[#637087] mt-0.5">Ref: {position.refLat}°</div>
            </div>
            <div className="bg-[#080c12] p-2.5 rounded border border-[#22c55e]/40">
              <div className="text-[8px] font-mono text-[#637087] uppercase">APPROX LONGITUDE</div>
              <div className="font-mono text-lg font-black text-[#22c55e]">
                {position.droneLon}° E
              </div>
              <div className="text-[8px] font-mono text-[#637087] mt-0.5">Ref: {position.refLon}°</div>
            </div>
          </div>

          <div className="bg-[#080c12] p-2 rounded border border-[#1e2a3e] flex items-center justify-between font-mono text-[10px]">
            <span className="text-[#637087]">GPS REFERENCE ORIGIN:</span>
            <span className="text-[#38bdf8] font-bold">{position.refType}</span>
          </div>

          <div className="text-[8px] font-mono text-[#637087] leading-tight">
            Drone GPS calculated using Laptop reference coordinate + local inertial displacement conversion.
          </div>
        </div>

        {/* Highlight Tile C: APPROXIMATE 3D POSITION VECTOR */}
        <div className="bg-[#0d1320] border-2 border-[#a78bfa]/60 rounded-lg p-3.5 space-y-3 shadow-lg shadow-purple-950/20">
          <div className="flex items-center justify-between border-b border-[#1e2a3e] pb-2">
            <div className="font-mono text-xs font-black text-white flex items-center gap-2">
              <span className="text-base text-[#a78bfa]">📍</span>
              <span>APPROXIMATE 3D POSITION</span>
            </div>
            <button
              onClick={onResetPosition}
              className="px-2 py-0.5 rounded font-mono text-[9px] border border-[#1e2a3e] text-[#637087] hover:border-[#a78bfa] hover:text-[#a78bfa] transition-colors"
            >
              ⟳ RE-ZERO ORIGIN
            </button>
          </div>

          <div className="grid grid-cols-3 gap-1.5 font-mono text-xs">
            <div className="bg-[#080c12] p-2 rounded border border-[#a78bfa]/40 text-center">
              <div className="text-[8px] text-[#637087] uppercase">REL X (EAST)</div>
              <div className="font-black text-white text-base">{position.relX} m</div>
              <div className="text-[8px] text-[#637087]">Vx: {position.vx} m/s</div>
            </div>
            <div className="bg-[#080c12] p-2 rounded border border-[#a78bfa]/40 text-center">
              <div className="text-[8px] text-[#637087] uppercase">REL Y (NORTH)</div>
              <div className="font-black text-white text-base">{position.relY} m</div>
              <div className="text-[8px] text-[#637087]">Vy: {position.vy} m/s</div>
            </div>
            <div className="bg-[#080c12] p-2 rounded border border-[#a78bfa]/40 text-center">
              <div className="text-[8px] text-[#637087] uppercase">REL Z (UP)</div>
              <div className="font-black text-white text-base">{position.relZ} m</div>
              <div className="text-[8px] text-[#637087]">Vz: {position.vz} m/s</div>
            </div>
          </div>

          {position.driftWarning ? (
            <div className="bg-[#eab308]/15 border border-[#eab308]/40 px-2 py-1 rounded font-mono text-[9px] text-[#eab308] flex items-center gap-1">
              <span>⚠ DRIFT ACTIVE ({position.driftSeconds}s). Click Re-zero to clear.</span>
            </div>
          ) : (
            <div className="bg-[#22c55e]/10 border border-[#22c55e]/30 px-2 py-1 rounded font-mono text-[9px] text-[#22c55e] flex items-center justify-between">
              <span>✓ ZUPT INERTIAL STABILITY</span>
              <span className="font-bold">CONFIDENCE: {position.confidence}</span>
            </div>
          )}

          <div className="text-[8px] font-mono text-[#637087] leading-tight">
            Inertial double integration with Zero-Velocity Update (ZUPT) drift cancellation.
          </div>
        </div>

      </div>

      {/* Connection Quick Bar */}
      <div className="grid grid-cols-6 gap-2">
        <StatCard 
          label="ESP32 Telemetry" 
          value={hasData ? (status.esp32Connected ? 'CONNECTED' : 'DISCONNECTED') : 'AWAITING ESP32'} 
          color={hasData ? (status.esp32Connected ? '#22c55e' : '#eab308') : '#637087'} 
        />
        <StatCard 
          label="WebSocket Server" 
          value={status.wsConnected ? 'LIVE :5001' : 'OFFLINE'} 
          color={status.wsConnected ? '#22c55e' : '#ef4444'} 
        />
        <StatCard 
          label="Packet Rate" 
          value={hasData ? status.packetRateHz : '--'} 
          unit="Hz" 
          color="#38bdf8" 
        />
        <StatCard 
          label="Latency" 
          value={hasData && status.lastPacketMsAgo >= 0 ? status.lastPacketMsAgo : '--'} 
          unit="ms" 
          color={hasData && status.lastPacketMsAgo < 100 ? '#22c55e' : '#637087'} 
        />
        <StatCard 
          label="Battery Voltage" 
          value={hasData && raw?.battery ? raw.battery.toFixed(2) : '--'} 
          unit="V" 
          color={hasData && raw && raw.battery > 3.4 ? '#22c55e' : '#637087'} 
        />
        <StatCard 
          label="Sensor Calibration" 
          value={calibration.isCalibrated ? 'CALIBRATED' : 'UNCALIBRATED'} 
          color={calibration.isCalibrated ? '#22c55e' : '#eab308'} 
        />
      </div>

      {/* Main Grid Row 3: IMU Sensor Telemetry Cards + Artificial Horizon PFD */}
      <div className="grid grid-cols-4 gap-3">
        {/* Accelerometer */}
        <div className="col-span-1 bg-[#0d1320] border border-[#1e2a3e] rounded p-3 space-y-2">
          <div className="text-[10px] font-mono text-[#637087] uppercase tracking-widest">Accelerometer (m/s²)</div>
          {[
            { axis: 'X-AXIS', val: hasData ? raw?.ax : undefined },
            { axis: 'Y-AXIS', val: hasData ? raw?.ay : undefined },
            { axis: 'Z-AXIS', val: hasData ? raw?.az : undefined },
          ].map(({ axis, val }) => (
            <div key={axis} className="bg-[#080c12] border border-[#1e2a3e] rounded px-3 py-1.5 flex justify-between items-center">
              <span className="font-mono text-xs text-[#637087]">{axis}</span>
              <span className="font-mono text-sm font-bold text-white">{val !== undefined ? val.toFixed(2) : '--'}</span>
            </div>
          ))}
        </div>

        {/* Gyroscope */}
        <div className="col-span-1 bg-[#0d1320] border border-[#1e2a3e] rounded p-3 space-y-2">
          <div className="text-[10px] font-mono text-[#637087] uppercase tracking-widest">Gyroscope (°/s)</div>
          {[
            { axis: 'X-AXIS', val: hasData ? raw?.gx : undefined },
            { axis: 'Y-AXIS', val: hasData ? raw?.gy : undefined },
            { axis: 'Z-AXIS', val: hasData ? raw?.gz : undefined },
          ].map(({ axis, val }) => (
            <div key={axis} className="bg-[#080c12] border border-[#1e2a3e] rounded px-3 py-1.5 flex justify-between items-center">
              <span className="font-mono text-xs text-[#637087]">{axis}</span>
              <span className="font-mono text-sm font-bold text-white">{val !== undefined ? val.toFixed(2) : '--'}</span>
            </div>
          ))}
        </div>

        {/* Environment & Power */}
        <div className="col-span-1 bg-[#0d1320] border border-[#1e2a3e] rounded p-3 space-y-2">
          <div className="text-[10px] font-mono text-[#637087] uppercase tracking-widest">Environment & Power</div>
          <div className="bg-[#080c12] border border-[#1e2a3e] rounded px-3 py-1 flex justify-between items-center">
            <span className="font-mono text-xs text-[#637087]">TEMPERATURE</span>
            <span className="font-mono text-sm font-bold text-[#38bdf8]">{hasData && raw?.temperature ? `${raw.temperature.toFixed(1)} °C` : '--'}</span>
          </div>
          <div className="bg-[#080c12] border border-[#1e2a3e] rounded px-3 py-1 flex justify-between items-center">
            <span className="font-mono text-xs text-[#637087]">PRESSURE</span>
            <span className="font-mono text-sm font-bold text-[#38bdf8]">{hasData && raw?.pressure ? `${raw.pressure.toFixed(1)} hPa` : '--'}</span>
          </div>
          <div className="bg-[#080c12] border border-[#1e2a3e] rounded px-3 py-1 flex justify-between items-center">
            <span className="font-mono text-xs text-[#637087]">ALTITUDE</span>
            <span className="font-mono text-sm font-bold text-[#22c55e]">{hasData && raw?.altitude ? `${raw.altitude.toFixed(1)} m` : '--'}</span>
          </div>
          <div className="bg-[#080c12] border border-[#1e2a3e] rounded px-3 py-1 flex justify-between items-center">
            <span className="font-mono text-xs text-[#637087]">BATTERY</span>
            <span className="font-mono text-sm font-bold" style={{ color: hasData && raw && raw.battery > 3.4 ? '#22c55e' : '#637087' }}>
              {hasData && raw?.battery ? `${raw.battery.toFixed(2)} V` : '--'}
            </span>
          </div>
        </div>

        {/* PFD Horizon */}
        <div className="col-span-1">
          <ArtificialHorizonPFD 
            roll={hasData ? raw?.roll : 0} 
            pitch={hasData ? raw?.pitch : 0} 
            yaw={hasData ? raw?.yaw : 0} 
            active={hasData}
          />
        </div>
      </div>

      {/* Main Grid Row 4: Scrolling Live Telemetry Mini Graphs */}
      <div className="grid grid-cols-4 gap-2">
        <MiniGraph data={telemetryHistory} dataKey="roll" color="#22c55e" label="Roll (°)" />
        <MiniGraph data={telemetryHistory} dataKey="pitch" color="#eab308" label="Pitch (°)" />
        <MiniGraph data={telemetryHistory} dataKey="ax" color="#22d3ee" label="Accel X (m/s²)" />
        <MiniGraph data={telemetryHistory} dataKey="altitude" color="#38bdf8" label="Altitude (m)" />
      </div>

    </div>
  );
}
