import { useMemo, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer } from 'recharts';
import type { ProcessedTelemetry, ESP32Telemetry } from '../types/telemetry';

interface DashboardProps {
  processed: ProcessedTelemetry;
  telemetryHistory: ESP32Telemetry[];
  onCalibrate: () => void;
  onResetPosition: () => void;
  theme?: 'dark' | 'light';
}

function StatCard({ label, value, unit, color, isLight }: { label: string; value: string | number; unit?: string; color?: string; isLight?: boolean }) {
  return (
    <div className={`border rounded p-2.5 flex flex-col justify-between select-none ${
      isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-[#0f172a] border-slate-800'
    }`}>
      <div className={`text-[9px] font-mono uppercase tracking-widest ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>{label}</div>
      <div className="font-mono text-lg font-bold" style={{ color: color || (isLight ? '#0f172a' : '#f8fafc') }}>
        {value}
        {unit && <span className={`text-xs font-normal ml-1 ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>{unit}</span>}
      </div>
    </div>
  );
}

function MiniGraph({ data, dataKey, color, label, isLight }: { data: ESP32Telemetry[]; dataKey: keyof ESP32Telemetry; color: string; label: string; isLight?: boolean }) {
  const chartData = useMemo(() => {
    return data.slice(-50).map((r, i) => ({ i, v: r[dataKey] as number }));
  }, [data, dataKey]);

  return (
    <div className={`border rounded p-2 select-none ${
      isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-[#0f172a] border-slate-800'
    }`}>
      <div className={`text-[9px] font-mono uppercase mb-1 flex justify-between ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
        <span>{label}</span>
        <span style={{ color }}>{data.length > 0 ? (data[data.length - 1][dataKey] as number)?.toFixed(1) : '--'}</span>
      </div>
      <ResponsiveContainer width="100%" height={40}>
        <LineChart data={chartData}>
          <Line type="monotone" dataKey="v" stroke={color} strokeWidth={1.5} dot={false} isAnimationActive={false} />
          <YAxis domain={['auto', 'auto']} hide />
          <XAxis dataKey="i" hide />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function ArtificialHorizonPFD({ roll = 0, pitch = 0, yaw = 0, active = false, isLight = false }: { roll?: number; pitch?: number; yaw?: number; active?: boolean; isLight?: boolean }) {
  const clampedPitch = Math.max(-45, Math.min(45, pitch));
  const pitchY = clampedPitch * 1.6;
  const normYaw = (yaw % 360 + 360) % 360;

  return (
    <div className={`border rounded p-3 flex flex-col items-center select-none h-full justify-between ${
      isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-[#0f172a] border-slate-800'
    }`}>
      <div className={`text-[10px] font-mono uppercase tracking-widest flex items-center gap-2 ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
        <span>Artificial Horizon</span>
        <span className="text-[9px] text-[#0ea5e9] bg-[#0ea5e9]/10 border border-[#0ea5e9]/30 rounded px-1 py-0.2 font-bold">PFD</span>
      </div>
      
      <div className={`relative w-36 h-36 rounded-full overflow-hidden border-2 shadow-inner my-1 ${
        isLight ? 'border-slate-300 bg-slate-900' : 'border-slate-800 bg-[#080c12]'
      }`}>
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

      <div className={`font-mono text-[10px] flex items-center gap-2 ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
        <span>YAW:</span>
        <span className={`font-bold px-2 py-0.5 rounded border ${
          isLight ? 'bg-slate-100 border-slate-300 text-slate-800' : 'bg-[#080c12] border-slate-800 text-white'
        }`}>
          {active ? `${normYaw.toFixed(1)}°` : '--°'}
        </span>
      </div>
    </div>
  );
}

export default function DashboardPage({ processed, telemetryHistory, onCalibrate, onResetPosition, theme = 'dark' }: DashboardProps) {
  const { raw, crashRisk, position, calibration, status } = processed;
  const [copiedGps, setCopiedGps] = useState(false);

  const isLight = theme === 'light';
  const hasData = status.hasReceivedData && raw !== null;

  // Motion & Crash Risk Styling Rules
  const motionState = !hasData ? 'STANDBY' : (crashRisk?.motionState || 'USUAL MOTION');
  const crashPred = !hasData ? 'STANDBY' : (crashRisk?.crashPrediction || 'SAFE (NO CRASH PREDICTED)');
  const willCrash = hasData && (crashRisk?.willCrash || false);

  const motionBg = !hasData ? (isLight ? 'bg-slate-100 border-slate-300 text-slate-500' : 'bg-slate-800/40 border-slate-700 text-slate-400') :
    motionState === 'UNUSUAL MOTION' ? (isLight ? 'bg-rose-100 border-rose-400 text-rose-800 animate-pulse font-bold' : 'bg-rose-950/40 border-rose-500 text-rose-400 animate-pulse') :
    (isLight ? 'bg-emerald-100 border-emerald-400 text-emerald-800 font-bold' : 'bg-emerald-950/40 border-emerald-500 text-emerald-400');

  const crashColor = !hasData ? (isLight ? '#64748b' : '#94a3b8') :
    willCrash ? '#dc2626' :
    crashRisk?.level === 'MEDIUM RISK' || crashRisk?.level === 'LOW RISK' ? '#d97706' : (isLight ? '#059669' : '#22c55e');

  const crashBg = !hasData ? (isLight ? 'bg-slate-100 border-slate-300 text-slate-500' : 'bg-slate-800/40 border-slate-700 text-slate-400') :
    willCrash ? 'bg-rose-600 text-white animate-bounce border-rose-700 font-bold' :
    crashRisk?.level === 'MEDIUM RISK' || crashRisk?.level === 'LOW RISK' ? (isLight ? 'bg-amber-100 border-amber-400 text-amber-800' : 'bg-amber-950/40 border-amber-500 text-amber-400') :
    (isLight ? 'bg-emerald-100 border-emerald-400 text-emerald-800 font-bold' : 'bg-emerald-950/40 border-emerald-500 text-emerald-400');

  const handleCopyGps = () => {
    const coords = `${position.droneLat}, ${position.droneLon}`;
    navigator.clipboard.writeText(coords);
    setCopiedGps(true);
    setTimeout(() => setCopiedGps(false), 2000);
  };

  return (
    <div className={`h-full overflow-y-auto p-4 space-y-4 select-none ${isLight ? 'bg-slate-50 text-slate-900' : 'bg-[#060910] text-slate-100'}`}>
      
      {/* 🚨 HERO PROMINENT SECTION 1: CRASH PREDICTION & MOTION MONITOR BOARD (HIGHLIGHTED) */}
      <div 
        className={`rounded-lg p-4 border-2 transition-all duration-300 shadow-md ${
          !hasData ? (isLight ? 'bg-white border-slate-300' : 'bg-[#0f172a] border-slate-800') :
          willCrash ? (isLight ? 'bg-rose-50 border-rose-500 shadow-rose-200' : 'bg-[#2d0a0a] border-rose-500 shadow-rose-950/50') :
          motionState === 'UNUSUAL MOTION' ? (isLight ? 'bg-amber-50 border-amber-400 shadow-amber-200' : 'bg-[#281c07] border-amber-500 shadow-amber-950/40') :
          (isLight ? 'bg-emerald-50/60 border-emerald-400 shadow-emerald-100' : 'bg-[#062016] border-emerald-500 shadow-emerald-950/30')
        }`}
      >
        <div className={`flex items-center justify-between border-b pb-3 mb-3 ${isLight ? 'border-slate-200' : 'border-white/10'}`}>
          <div className="flex items-center gap-3">
            <div className={`w-3.5 h-3.5 rounded-full ${!hasData ? 'bg-slate-400' : willCrash ? 'bg-rose-500 animate-ping' : motionState === 'UNUSUAL MOTION' ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'}`} />
            <div>
              <h2 className={`font-mono text-sm font-extrabold uppercase tracking-widest flex items-center gap-2 ${isLight ? 'text-slate-900' : 'text-white'}`}>
                CRASH PREDICTION & MOTION CLASSIFICATION
                <span className={`text-[10px] px-2 py-0.5 rounded border font-normal ${
                  isLight ? 'bg-sky-100 border-sky-300 text-sky-800' : 'bg-cyan-950/80 border-cyan-500/40 text-cyan-400'
                }`}>
                  REAL-TIME ANOMALY ENGINE
                </span>
              </h2>
              <p className={`font-mono text-[10px] ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
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
          <div className={`flex justify-between font-mono text-[10px] ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>
            <span className="uppercase font-bold">PHYSICAL ANOMALY RISK SCORE:</span>
            <span className="font-bold" style={{ color: crashColor }}>
              {hasData && crashRisk ? `${crashRisk.score}% (${crashRisk.level})` : '0% (STANDBY)'}
            </span>
          </div>
          <div className={`w-full h-2.5 rounded-full overflow-hidden border p-0.5 ${
            isLight ? 'bg-slate-200 border-slate-300' : 'bg-black/60 border-white/10'
          }`}>
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
          {[
            { label: 'G-FORCE ACCEL MAG', val: hasData && crashRisk ? `${crashRisk.accelMag} m/s²` : '--', limit: 'Threshold: >20 m/s²' },
            { label: 'ROTATIONAL SPIN RATE', val: hasData && crashRisk ? `${crashRisk.gyroMag} °/s` : '--', limit: 'Threshold: >180 °/s' },
            { label: 'IMPULSE JERK', val: hasData && crashRisk ? `${crashRisk.jerk} m/s³` : '--', limit: 'Threshold: >60 m/s³' },
            { label: 'ALTITUDE CHANGE RATE', val: hasData && crashRisk ? `${crashRisk.altRate} m/s` : '--', limit: 'Drop Limit: <-6 m/s' },
          ].map(({ label, val, limit }) => (
            <div key={label} className={`p-2 rounded border ${
              isLight ? 'bg-white border-slate-200' : 'bg-black/50 border-white/10'
            }`}>
              <div className={`text-[8px] font-mono uppercase ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>{label}</div>
              <div className={`font-mono text-sm font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>{val}</div>
              <div className={`text-[8px] font-mono ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>{limit}</div>
            </div>
          ))}
        </div>

        {/* Active Risk Trigger Reasons */}
        <div className={`p-2.5 rounded border flex items-center justify-between ${
          isLight ? 'bg-white border-slate-200' : 'bg-black/60 border-white/10'
        }`}>
          <div className="flex items-center gap-2 font-mono text-xs">
            <span className={`uppercase font-bold text-[10px] ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>ACTIVE MOTION DIAGNOSTIC:</span>
            {!hasData || !crashRisk ? (
              <span className={isLight ? 'text-slate-400' : 'text-slate-500'}>Awaiting real ESP32 telemetry packet stream...</span>
            ) : crashRisk.reasons.length === 0 ? (
              <span className={`font-bold ${isLight ? 'text-emerald-700' : 'text-emerald-400'}`}>✓ USUAL MOTION DETECTED — All telemetry vectors nominal</span>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {crashRisk.reasons.map((r, i) => (
                  <span key={i} className={`border text-[10px] font-bold px-2 py-0.5 rounded flex items-center gap-1 ${
                    isLight ? 'bg-rose-100 border-rose-300 text-rose-800' : 'bg-rose-950/80 border-rose-500/60 text-rose-300'
                  }`}>
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
        <div className={`border-2 rounded-lg p-3.5 space-y-3 ${
          isLight ? 'bg-white border-sky-300 shadow-sm' : 'bg-[#0f172a] border-[#0ea5e9]/60 shadow-lg shadow-cyan-950/20'
        }`}>
          <div className={`flex items-center justify-between border-b pb-2 ${isLight ? 'border-slate-200' : 'border-slate-800'}`}>
            <div className={`font-mono text-xs font-black flex items-center gap-2 ${isLight ? 'text-slate-900' : 'text-white'}`}>
              <span className="text-base text-sky-500">📐</span>
              <span>APPROXIMATE DISTANCE</span>
            </div>
            <span className={`font-mono text-[9px] px-1.5 py-0.5 rounded ${
              isLight ? 'bg-sky-100 text-sky-800 font-bold' : 'bg-sky-950 text-sky-400 border border-sky-500/30'
            }`}>
              3D RANGE
            </span>
          </div>

          <div className={`p-3 rounded-lg border text-center ${
            isLight ? 'bg-sky-50/50 border-sky-200' : 'bg-[#080c12] border-sky-500/30'
          }`}>
            <div className={`text-[9px] font-mono uppercase tracking-wider mb-0.5 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>DIRECT 3D SLANT DISTANCE FROM LAPTOP</div>
            <div className={`font-mono text-3xl font-black ${isLight ? 'text-sky-700' : 'text-sky-400 drop-shadow-[0_0_8px_rgba(56,189,248,0.4)]'}`}>
              {position.distanceFromLaptop} <span className={`text-base font-normal ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>meters</span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-1.5 font-mono text-xs">
            <div className={`p-2 rounded border text-center ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#080c12] border-slate-800'}`}>
              <div className={`text-[8px] uppercase ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>2D GROUND DIST</div>
              <div className={`font-bold text-sm ${isLight ? 'text-emerald-700' : 'text-emerald-400'}`}>{position.groundDistance} m</div>
            </div>
            <div className={`p-2 rounded border text-center ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#080c12] border-slate-800'}`}>
              <div className={`text-[8px] uppercase ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>ALTITUDE (Z)</div>
              <div className={`font-bold text-sm ${isLight ? 'text-slate-900' : 'text-white'}`}>{position.relZ} m</div>
            </div>
            <div className={`p-2 rounded border text-center ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#080c12] border-slate-800'}`}>
              <div className={`text-[8px] uppercase ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>WI-FI RSSI RANGE</div>
              <div className={`font-bold text-sm ${isLight ? 'text-amber-700' : 'text-amber-400'}`}>
                {position.wifiDistance > 0 ? `${position.wifiDistance} m` : '--'}
              </div>
            </div>
          </div>

          <div className={`text-[8px] font-mono leading-tight ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
            Distance derived from 3D vector $\sqrt&#123;X^2 + Y^2 + Z^2&#125;$ & Wi-Fi log-distance path loss.
          </div>
        </div>

        {/* Highlight Tile B: DRONE RELATIVE GPS COORDINATES */}
        <div className={`border-2 rounded-lg p-3.5 space-y-3 ${
          isLight ? 'bg-white border-emerald-300 shadow-sm' : 'bg-[#0f172a] border-[#22c55e]/60 shadow-lg shadow-emerald-950/20'
        }`}>
          <div className={`flex items-center justify-between border-b pb-2 ${isLight ? 'border-slate-200' : 'border-slate-800'}`}>
            <div className={`font-mono text-xs font-black flex items-center gap-2 ${isLight ? 'text-slate-900' : 'text-white'}`}>
              <span className="text-base text-emerald-500">🛰️</span>
              <span>DRONE RELATIVE GPS COORDINATES</span>
            </div>
            <button
              onClick={handleCopyGps}
              className={`px-2 py-0.5 rounded font-mono text-[9px] border transition-colors ${
                isLight ? 'border-emerald-400 bg-emerald-50 text-emerald-800 hover:bg-emerald-100' : 'border-emerald-500/50 text-emerald-400 hover:bg-emerald-500/20'
              }`}
            >
              {copiedGps ? '✓ COPIED!' : '📋 COPY COORDS'}
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className={`p-2.5 rounded border ${
              isLight ? 'bg-emerald-50/40 border-emerald-200' : 'bg-[#080c12] border-emerald-500/40'
            }`}>
              <div className={`text-[8px] font-mono uppercase ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>APPROX LATITUDE</div>
              <div className={`font-mono text-lg font-black ${isLight ? 'text-emerald-700' : 'text-emerald-400'}`}>
                {position.droneLat}° N
              </div>
              <div className={`text-[8px] font-mono mt-0.5 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Ref: {position.refLat}°</div>
            </div>
            <div className={`p-2.5 rounded border ${
              isLight ? 'bg-emerald-50/40 border-emerald-200' : 'bg-[#080c12] border-emerald-500/40'
            }`}>
              <div className={`text-[8px] font-mono uppercase ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>APPROX LONGITUDE</div>
              <div className={`font-mono text-lg font-black ${isLight ? 'text-emerald-700' : 'text-emerald-400'}`}>
                {position.droneLon}° E
              </div>
              <div className={`text-[8px] font-mono mt-0.5 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Ref: {position.refLon}°</div>
            </div>
          </div>

          <div className={`p-2 rounded border flex items-center justify-between font-mono text-[10px] ${
            isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#080c12] border-slate-800'
          }`}>
            <span className={isLight ? 'text-slate-500' : 'text-slate-400'}>GPS REFERENCE ORIGIN:</span>
            <span className={`font-bold ${isLight ? 'text-sky-700' : 'text-sky-400'}`}>{position.refType}</span>
          </div>

          <div className={`text-[8px] font-mono leading-tight ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
            Drone GPS calculated using Laptop reference coordinate + local inertial displacement conversion.
          </div>
        </div>

        {/* Highlight Tile C: APPROXIMATE 3D POSITION VECTOR */}
        <div className={`border-2 rounded-lg p-3.5 space-y-3 ${
          isLight ? 'bg-white border-purple-300 shadow-sm' : 'bg-[#0f172a] border-[#a78bfa]/60 shadow-lg shadow-purple-950/20'
        }`}>
          <div className={`flex items-center justify-between border-b pb-2 ${isLight ? 'border-slate-200' : 'border-slate-800'}`}>
            <div className={`font-mono text-xs font-black flex items-center gap-2 ${isLight ? 'text-slate-900' : 'text-white'}`}>
              <span className="text-base text-purple-500">📍</span>
              <span>APPROXIMATE 3D POSITION</span>
            </div>
            <button
              onClick={onResetPosition}
              className={`px-2 py-0.5 rounded font-mono text-[9px] border transition-colors ${
                isLight ? 'border-slate-300 text-slate-600 hover:bg-slate-100' : 'border-slate-800 text-slate-400 hover:border-purple-400 hover:text-purple-400'
              }`}
            >
              ⟳ RE-ZERO ORIGIN
            </button>
          </div>

          <div className="grid grid-cols-3 gap-1.5 font-mono text-xs">
            <div className={`p-2 rounded border text-center ${
              isLight ? 'bg-purple-50/50 border-purple-200' : 'bg-[#080c12] border-purple-500/40'
            }`}>
              <div className={`text-[8px] uppercase ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>REL X (EAST)</div>
              <div className={`font-black text-base ${isLight ? 'text-slate-900' : 'text-white'}`}>{position.relX} m</div>
              <div className={`text-[8px] ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Vx: {position.vx} m/s</div>
            </div>
            <div className={`p-2 rounded border text-center ${
              isLight ? 'bg-purple-50/50 border-purple-200' : 'bg-[#080c12] border-purple-500/40'
            }`}>
              <div className={`text-[8px] uppercase ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>REL Y (NORTH)</div>
              <div className={`font-black text-base ${isLight ? 'text-slate-900' : 'text-white'}`}>{position.relY} m</div>
              <div className={`text-[8px] ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Vy: {position.vy} m/s</div>
            </div>
            <div className={`p-2 rounded border text-center ${
              isLight ? 'bg-purple-50/50 border-purple-200' : 'bg-[#080c12] border-purple-500/40'
            }`}>
              <div className={`text-[8px] uppercase ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>REL Z (UP)</div>
              <div className={`font-black text-base ${isLight ? 'text-slate-900' : 'text-white'}`}>{position.relZ} m</div>
              <div className={`text-[8px] ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Vz: {position.vz} m/s</div>
            </div>
          </div>

          {position.driftWarning ? (
            <div className={`px-2 py-1 rounded font-mono text-[9px] flex items-center gap-1 border ${
              isLight ? 'bg-amber-100 border-amber-300 text-amber-800' : 'bg-amber-950/40 border-amber-500/40 text-amber-400'
            }`}>
              <span>⚠ DRIFT ACTIVE ({position.driftSeconds}s). Click Re-zero to clear.</span>
            </div>
          ) : (
            <div className={`px-2 py-1 rounded font-mono text-[9px] flex items-center justify-between border ${
              isLight ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-emerald-950/30 border-emerald-500/30 text-emerald-400'
            }`}>
              <span>✓ ZUPT INERTIAL STABILITY</span>
              <span className="font-bold">CONFIDENCE: {position.confidence}</span>
            </div>
          )}

          <div className={`text-[8px] font-mono leading-tight ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
            Inertial double integration with Zero-Velocity Update (ZUPT) drift cancellation.
          </div>
        </div>

      </div>

      {/* Connection Quick Bar */}
      <div className="grid grid-cols-6 gap-2">
        <StatCard 
          label="ESP32 Telemetry" 
          value={hasData ? (status.esp32Connected ? 'CONNECTED' : 'DISCONNECTED') : 'AWAITING ESP32'} 
          color={hasData ? (status.esp32Connected ? (isLight ? '#059669' : '#22c55e') : (isLight ? '#d97706' : '#eab308')) : (isLight ? '#64748b' : '#94a3b8')} 
          isLight={isLight}
        />
        <StatCard 
          label="WebSocket Server" 
          value={status.wsConnected ? 'LIVE :5001' : 'OFFLINE'} 
          color={status.wsConnected ? (isLight ? '#059669' : '#22c55e') : (isLight ? '#dc2626' : '#ef4444')} 
          isLight={isLight}
        />
        <StatCard 
          label="Packet Rate" 
          value={hasData ? status.packetRateHz : '--'} 
          unit="Hz" 
          color={isLight ? '#0284c7' : '#38bdf8'} 
          isLight={isLight}
        />
        <StatCard 
          label="Latency" 
          value={hasData && status.lastPacketMsAgo >= 0 ? status.lastPacketMsAgo : '--'} 
          unit="ms" 
          color={hasData && status.lastPacketMsAgo < 100 ? (isLight ? '#059669' : '#22c55e') : (isLight ? '#64748b' : '#94a3b8')} 
          isLight={isLight}
        />
        <StatCard 
          label="Battery Voltage" 
          value={hasData && raw?.battery ? raw.battery.toFixed(2) : '--'} 
          unit="V" 
          color={hasData && raw && raw.battery > 3.4 ? (isLight ? '#059669' : '#22c55e') : (isLight ? '#64748b' : '#94a3b8')} 
          isLight={isLight}
        />
        <StatCard 
          label="Sensor Calibration" 
          value={calibration.isCalibrated ? 'CALIBRATED' : 'UNCALIBRATED'} 
          color={calibration.isCalibrated ? (isLight ? '#059669' : '#22c55e') : (isLight ? '#d97706' : '#eab308')} 
          isLight={isLight}
        />
      </div>

      {/* Main Grid Row 3: IMU Sensor Telemetry Cards + Artificial Horizon PFD */}
      <div className="grid grid-cols-4 gap-3">
        {/* Accelerometer */}
        <div className={`col-span-1 border rounded p-3 space-y-2 ${
          isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-[#0f172a] border-slate-800'
        }`}>
          <div className={`text-[10px] font-mono uppercase tracking-widest ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Accelerometer (m/s²)</div>
          {[
            { axis: 'X-AXIS', val: hasData ? raw?.ax : undefined },
            { axis: 'Y-AXIS', val: hasData ? raw?.ay : undefined },
            { axis: 'Z-AXIS', val: hasData ? raw?.az : undefined },
          ].map(({ axis, val }) => (
            <div key={axis} className={`border rounded px-3 py-1.5 flex justify-between items-center ${
              isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#080c12] border-slate-800'
            }`}>
              <span className={`font-mono text-xs ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>{axis}</span>
              <span className={`font-mono text-sm font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>{val !== undefined ? val.toFixed(2) : '--'}</span>
            </div>
          ))}
        </div>

        {/* Gyroscope */}
        <div className={`col-span-1 border rounded p-3 space-y-2 ${
          isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-[#0f172a] border-slate-800'
        }`}>
          <div className={`text-[10px] font-mono uppercase tracking-widest ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Gyroscope (°/s)</div>
          {[
            { axis: 'X-AXIS', val: hasData ? raw?.gx : undefined },
            { axis: 'Y-AXIS', val: hasData ? raw?.gy : undefined },
            { axis: 'Z-AXIS', val: hasData ? raw?.gz : undefined },
          ].map(({ axis, val }) => (
            <div key={axis} className={`border rounded px-3 py-1.5 flex justify-between items-center ${
              isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#080c12] border-slate-800'
            }`}>
              <span className={`font-mono text-xs ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>{axis}</span>
              <span className={`font-mono text-sm font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>{val !== undefined ? val.toFixed(2) : '--'}</span>
            </div>
          ))}
        </div>

        {/* Environment & Power */}
        <div className={`col-span-1 border rounded p-3 space-y-2 ${
          isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-[#0f172a] border-slate-800'
        }`}>
          <div className={`text-[10px] font-mono uppercase tracking-widest ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Environment & Power</div>
          <div className={`border rounded px-3 py-1 flex justify-between items-center ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#080c12] border-slate-800'}`}>
            <span className={`font-mono text-xs ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>TEMPERATURE</span>
            <span className={`font-mono text-sm font-bold ${isLight ? 'text-sky-700' : 'text-[#38bdf8]'}`}>{hasData && raw?.temperature ? `${raw.temperature.toFixed(1)} °C` : '--'}</span>
          </div>
          <div className={`border rounded px-3 py-1 flex justify-between items-center ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#080c12] border-slate-800'}`}>
            <span className={`font-mono text-xs ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>PRESSURE</span>
            <span className={`font-mono text-sm font-bold ${isLight ? 'text-sky-700' : 'text-[#38bdf8]'}`}>{hasData && raw?.pressure ? `${raw.pressure.toFixed(1)} hPa` : '--'}</span>
          </div>
          <div className={`border rounded px-3 py-1 flex justify-between items-center ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#080c12] border-slate-800'}`}>
            <span className={`font-mono text-xs ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>ALTITUDE</span>
            <span className={`font-mono text-sm font-bold ${isLight ? 'text-emerald-700' : 'text-[#22c55e]'}`}>{hasData && raw?.altitude ? `${raw.altitude.toFixed(1)} m` : '--'}</span>
          </div>
          <div className={`border rounded px-3 py-1 flex justify-between items-center ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#080c12] border-slate-800'}`}>
            <span className={`font-mono text-xs ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>BATTERY</span>
            <span className="font-mono text-sm font-bold" style={{ color: hasData && raw && raw.battery > 3.4 ? (isLight ? '#059669' : '#22c55e') : (isLight ? '#64748b' : '#94a3b8') }}>
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
            isLight={isLight}
          />
        </div>
      </div>

      {/* Main Grid Row 4: Scrolling Live Telemetry Mini Graphs */}
      <div className="grid grid-cols-4 gap-2">
        <MiniGraph data={telemetryHistory} dataKey="roll" color={isLight ? '#059669' : '#22c55e'} label="Roll (°)" isLight={isLight} />
        <MiniGraph data={telemetryHistory} dataKey="pitch" color={isLight ? '#d97706' : '#eab308'} label="Pitch (°)" isLight={isLight} />
        <MiniGraph data={telemetryHistory} dataKey="ax" color={isLight ? '#0284c7' : '#22d3ee'} label="Accel X (m/s²)" isLight={isLight} />
        <MiniGraph data={telemetryHistory} dataKey="altitude" color={isLight ? '#0284c7' : '#38bdf8'} label="Altitude (m)" isLight={isLight} />
      </div>

    </div>
  );
}
