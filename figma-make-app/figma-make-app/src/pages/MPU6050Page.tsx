import { useState } from 'react';
import type { SensorReading } from '../data/sensorSimulator';

interface Props { current: SensorReading; }

function DroneOrientation({ roll, pitch, yaw }: { roll: number; pitch: number; yaw: number }) {
  const normYaw = (yaw % 360 + 360) % 360;
  // Calculate top-down displacement based on pitch and roll
  const transX = Math.max(-25, Math.min(25, roll * 0.5));
  const transY = Math.max(-25, Math.min(25, pitch * 0.5));

  return (
    <div className="bg-[#0d1320] border border-[#1e2a3e] rounded p-4 flex flex-col items-center select-none">
      <div className="font-mono text-[10px] text-[#637087] uppercase tracking-widest mb-3 flex items-center gap-2">
        <span>3D Orientation Vis</span>
        <span className="text-[9px] text-[#22c55e] bg-[#22c55e]/10 border border-[#22c55e]/30 rounded px-1.5 py-0.5">MPU6050</span>
      </div>
      <svg width="180" height="180" viewBox="-90 -90 180 180" className="overflow-visible">
        {/* Polar Radar Grid */}
        <circle cx="0" cy="0" r="70" stroke="#1e2a3e" strokeWidth="0.8" fill="none" strokeDasharray="3 3" />
        <circle cx="0" cy="0" r="45" stroke="#1e2a3e" strokeWidth="0.8" fill="none" strokeDasharray="3 3" />
        <circle cx="0" cy="0" r="20" stroke="#1e2a3e" strokeWidth="0.8" fill="none" strokeDasharray="3 3" />
        <line x1="-80" y1="0" x2="80" y2="0" stroke="#1e2a3e" strokeWidth="0.5" />
        <line x1="0" y1="-80" x2="0" y2="80" stroke="#1e2a3e" strokeWidth="0.5" />

        {/* Cardinal North/East/South/West labels */}
        <text x="0" y="-76" fill="#637087" fontSize="8" fontFamily="JetBrains Mono, monospace" textAnchor="middle">N (0°)</text>
        <text x="76" y="3" fill="#637087" fontSize="8" fontFamily="JetBrains Mono, monospace" textAnchor="start">E (90°)</text>
        <text x="0" y="82" fill="#637087" fontSize="8" fontFamily="JetBrains Mono, monospace" textAnchor="middle">S (180°)</text>
        <text x="-76" y="3" fill="#637087" fontSize="8" fontFamily="JetBrains Mono, monospace" textAnchor="end">W (270°)</text>

        {/* Drone Body Group - Combined transform: Translate Pitch/Roll tilt, rotate Yaw */}
        <g transform={`translate(${transX}, ${transY}) rotate(${normYaw})`}>
          {/* Main Flight Controller Box */}
          <rect x="-10" y="-10" width="20" height="20" rx="3" fill="#0d1320" stroke="#0ea5e9" strokeWidth="1.5" />
          
          {/* Carbon Fiber Arms */}
          <line x1="-8" y1="-8" x2="-42" y2="-42" stroke="#38bdf8" strokeWidth="2.5" />
          <line x1="8" y1="-8" x2="42" y2="-42" stroke="#38bdf8" strokeWidth="2.5" />
          <line x1="-8" y1="8" x2="-42" y2="42" stroke="#637087" strokeWidth="2.5" />
          <line x1="8" y1="8" x2="42" y2="42" stroke="#637087" strokeWidth="2.5" />

          {/* Motor Pods */}
          {[[-42, -42], [42, -42], [-42, 42], [42, 42]].map(([x, y], i) => (
            <g key={i} transform={`translate(${x}, ${y})`}>
              <circle cx="0" cy="0" r="11" fill="#080c12" stroke={i < 2 ? '#22c55e' : '#eab308'} strokeWidth="1.5" />
              {/* Spinning Propeller discs */}
              <circle cx="0" cy="0" r="15" fill="none" stroke={i < 2 ? '#22c55e' : '#eab308'} strokeWidth="1" strokeDasharray="4 2" opacity="0.6" />
            </g>
          ))}

          {/* Forward Nose Indicator Arrow (Nose facing up at 0 deg) */}
          <polygon points="0,-14 -4,-6 4,-6" fill="#0ea5e9" />
          <line x1="0" y1="-10" x2="0" y2="-30" stroke="#0ea5e9" strokeWidth="1.5" strokeDasharray="2 2" />
        </g>
      </svg>

      <div className="grid grid-cols-3 gap-4 mt-2 font-mono text-xs w-full">
        <div className="text-center bg-[#080c12] p-1.5 rounded border border-[#1e2a3e]">
          <div className="text-[#637087] text-[9px]">ROLL</div>
          <div className="text-[#22c55e] font-bold">{roll.toFixed(1)}°</div>
        </div>
        <div className="text-center bg-[#080c12] p-1.5 rounded border border-[#1e2a3e]">
          <div className="text-[#637087] text-[9px]">PITCH</div>
          <div className="text-[#eab308] font-bold">{pitch.toFixed(1)}°</div>
        </div>
        <div className="text-center bg-[#080c12] p-1.5 rounded border border-[#1e2a3e]">
          <div className="text-[#637087] text-[9px]">YAW</div>
          <div className="text-[#38bdf8] font-bold">{normYaw.toFixed(1)}°</div>
        </div>
      </div>
    </div>
  );
}

export default function MPU6050Page({ current }: Props) {
  const [calibrating, setCalibrating] = useState(false);
  const [calibDone, setCalibDone] = useState(false);

  const handleCalibrate = () => {
    setCalibrating(true);
    setTimeout(() => { setCalibrating(false); setCalibDone(true); }, 3000);
  };

  const fmt = (n: number) => n.toFixed(4);

  return (
    <div className="h-full overflow-y-auto p-4 space-y-3">
      {/* Status row */}
      <div className="grid grid-cols-5 gap-2">
        {[
          { label: 'MPU6050', value: 'ACTIVE', color: '#22c55e' },
          { label: 'I2C Bus', value: '0x68', color: '#38bdf8' },
          { label: 'I2C Status', value: 'OK', color: '#22c55e' },
          { label: 'Update Rate', value: '100 Hz', color: '#d4dae6' },
          { label: 'Calibration', value: calibDone ? 'CALIBRATED' : 'DEFAULT', color: calibDone ? '#22c55e' : '#eab308' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-[#0d1320] border border-[#1e2a3e] rounded p-3">
            <div className="text-[9px] font-mono text-[#637087] uppercase tracking-widest mb-1">{label}</div>
            <div className="font-mono text-sm font-bold" style={{ color }}>{value}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-3">
        {/* Accel */}
        <div className="bg-[#0d1320] border border-[#1e2a3e] rounded p-4 space-y-3">
          <div className="font-mono text-[10px] text-[#637087] uppercase tracking-widest">Accelerometer (m/s²)</div>
          {[
            { axis: 'X', val: current.accelX, color: '#22d3ee' },
            { axis: 'Y', val: current.accelY, color: '#0ea5e9' },
            { axis: 'Z', val: current.accelZ, color: '#38bdf8' },
          ].map(({ axis, val, color }) => (
            <div key={axis}>
              <div className="flex justify-between mb-1">
                <span className="font-mono text-[10px] text-[#637087]">{axis}-AXIS</span>
                <span className="font-mono text-sm font-bold" style={{ color }}>{fmt(val)}</span>
              </div>
              <div className="h-1.5 bg-[#0a0e14] rounded overflow-hidden">
                <div className="h-full rounded transition-all duration-100"
                  style={{ width: `${Math.min(100, Math.abs(val / 15) * 100)}%`, background: color }} />
              </div>
            </div>
          ))}
        </div>

        {/* Gyro */}
        <div className="bg-[#0d1320] border border-[#1e2a3e] rounded p-4 space-y-3">
          <div className="font-mono text-[10px] text-[#637087] uppercase tracking-widest">Gyroscope (°/s)</div>
          {[
            { axis: 'X', val: current.gyroX, color: '#a78bfa' },
            { axis: 'Y', val: current.gyroY, color: '#818cf8' },
            { axis: 'Z', val: current.gyroZ, color: '#6366f1' },
          ].map(({ axis, val, color }) => (
            <div key={axis}>
              <div className="flex justify-between mb-1">
                <span className="font-mono text-[10px] text-[#637087]">{axis}-AXIS</span>
                <span className="font-mono text-sm font-bold" style={{ color }}>{fmt(val)}</span>
              </div>
              <div className="h-1.5 bg-[#0a0e14] rounded overflow-hidden">
                <div className="h-full rounded transition-all duration-100"
                  style={{ width: `${Math.min(100, Math.abs(val / 250) * 100)}%`, background: color }} />
              </div>
            </div>
          ))}
        </div>

        {/* Orientation vis */}
        <DroneOrientation roll={current.roll} pitch={current.pitch} yaw={current.yaw} />
      </div>

      {/* Calibration */}
      <div className="bg-[#0d1320] border border-[#1e2a3e] rounded p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-mono text-[10px] text-[#637087] uppercase tracking-widest mb-1">Calibration</div>
            <div className="font-mono text-xs text-white">
              {calibrating ? 'Calibrating... Keep drone stationary on a level surface.' :
               calibDone ? 'Calibration complete. Offsets applied: AX:-0.023 AY:0.011 AZ:0.004' :
               'Default factory calibration active. Place drone on level surface and click Calibrate.'}
            </div>
          </div>
          <button
            onClick={handleCalibrate}
            disabled={calibrating}
            className="px-6 py-2 rounded font-mono text-xs font-semibold border border-[#0ea5e9] text-[#0ea5e9] bg-[#0ea5e9]/10 hover:bg-[#0ea5e9]/20 disabled:opacity-40 transition-colors"
          >
            {calibrating ? '...' : '⊕ CALIBRATE SENSOR'}
          </button>
        </div>
        {calibrating && (
          <div className="mt-3 h-1 bg-[#0a0e14] rounded overflow-hidden">
            <div className="h-full bg-[#0ea5e9] rounded animate-pulse" style={{ width: '60%' }} />
          </div>
        )}
      </div>
    </div>
  );
}
