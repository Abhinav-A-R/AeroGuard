import { useState, useEffect } from 'react';
import type { SystemSettings } from '../types/settings';
import { DEFAULT_SETTINGS } from '../types/settings';
import type { SensorCalibration } from '../types/telemetry';

interface SettingsPageProps {
  settings?: SystemSettings;
  onSaveSettings?: (settings: SystemSettings) => void;
  calibration?: SensorCalibration;
  onCalibrate?: () => void;
  refLat?: number;
  refLon?: number;
  onSetRefCoords?: (lat: number, lon: number) => void;
  onRequestLocation?: () => void;
}

export default function SettingsPage({
  settings,
  onSaveSettings,
  calibration,
  onCalibrate,
  refLat = 28.6139,
  refLon = 77.2090,
  onSetRefCoords,
  onRequestLocation,
}: SettingsPageProps) {
  const [vals, setVals] = useState<SystemSettings>(() => settings || DEFAULT_SETTINGS);
  const [manualLat, setManualLat] = useState<string>(String(refLat));
  const [manualLon, setManualLon] = useState<string>(String(refLon));
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (settings) setVals(settings);
  }, [settings]);

  useEffect(() => {
    setManualLat(String(refLat));
    setManualLon(String(refLon));
  }, [refLat, refLon]);

  const setStr = (k: keyof SystemSettings, v: string) => setVals(p => ({ ...p, [k]: v }));
  const setNum = (k: keyof SystemSettings, v: number) => setVals(p => ({ ...p, [k]: v }));

  const handleSave = () => {
    if (onSaveSettings) onSaveSettings(vals);
    const parsedLat = parseFloat(manualLat);
    const parsedLon = parseFloat(manualLon);
    if (!isNaN(parsedLat) && !isNaN(parsedLon) && onSetRefCoords) {
      onSetRefCoords(parsedLat, parsedLon);
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleReset = () => {
    setVals(DEFAULT_SETTINGS);
    if (onSaveSettings) onSaveSettings(DEFAULT_SETTINGS);
  };

  return (
    <div className="h-full overflow-y-auto p-4 select-none">
      <div className="max-w-3xl space-y-4">
        {/* Network & Ports */}
        <div className="bg-[#0d1320] border border-[#1e2a3e] rounded p-4 space-y-3">
          <div className="font-mono text-xs font-bold text-white flex items-center justify-between">
            <span>NETWORK & WEBSOCKET CONFIGURATION</span>
            <span className="text-[9px] font-mono text-[#38bdf8] bg-[#38bdf8]/10 border border-[#38bdf8]/30 px-1.5 py-0.5 rounded">
              ESP32 + BACKEND
            </span>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="font-mono text-[9px] text-[#637087] uppercase tracking-widest block mb-1">Laptop / Host IP</label>
              <input
                value={vals.laptopIp}
                onChange={e => setStr('laptopIp', e.target.value)}
                placeholder="192.168.43.20"
                className="w-full bg-[#080c12] border border-[#1e2a3e] rounded px-3 py-1.5 font-mono text-xs text-white focus:border-[#0ea5e9] outline-none"
              />
            </div>
            <div>
              <label className="font-mono text-[9px] text-[#637087] uppercase tracking-widest block mb-1">ESP32 Backend Port</label>
              <input
                type="number"
                value={vals.backendPort}
                onChange={e => setNum('backendPort', parseInt(e.target.value) || 5000)}
                className="w-full bg-[#080c12] border border-[#1e2a3e] rounded px-3 py-1.5 font-mono text-xs text-white focus:border-[#0ea5e9] outline-none"
              />
            </div>
            <div>
              <label className="font-mono text-[9px] text-[#637087] uppercase tracking-widest block mb-1">Browser WebSocket Port</label>
              <input
                type="number"
                value={vals.wsPort}
                onChange={e => setNum('wsPort', parseInt(e.target.value) || 5001)}
                className="w-full bg-[#080c12] border border-[#1e2a3e] rounded px-3 py-1.5 font-mono text-xs text-white focus:border-[#0ea5e9] outline-none"
              />
            </div>
          </div>
          <div className="text-[9px] font-mono text-[#637087]">
            ESP32 sends JSON telemetry to <span className="text-white">http://{vals.laptopIp}:{vals.backendPort}/api/telemetry</span>. Browser connects via <span className="text-[#38bdf8]">ws://{vals.laptopIp}:{vals.wsPort}</span>.
          </div>
        </div>

        {/* Geographic Reference Coordinates */}
        <div className="bg-[#0d1320] border border-[#1e2a3e] rounded p-4 space-y-3">
          <div className="font-mono text-xs font-bold text-white flex items-center justify-between">
            <span>INITIAL GEOGRAPHIC REFERENCE POSITION</span>
            <span className="text-[9px] font-mono text-[#22c55e] bg-[#22c55e]/10 border border-[#22c55e]/30 px-1.5 py-0.5 rounded">
              POSITION ESTIMATION
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="font-mono text-[9px] text-[#637087] uppercase tracking-widest block mb-1">Initial Latitude (deg)</label>
              <input
                value={manualLat}
                onChange={e => setManualLat(e.target.value)}
                className="w-full bg-[#080c12] border border-[#1e2a3e] rounded px-3 py-1.5 font-mono text-xs text-white focus:border-[#0ea5e9] outline-none"
              />
            </div>
            <div>
              <label className="font-mono text-[9px] text-[#637087] uppercase tracking-widest block mb-1">Initial Longitude (deg)</label>
              <input
                value={manualLon}
                onChange={e => setManualLon(e.target.value)}
                className="w-full bg-[#080c12] border border-[#1e2a3e] rounded px-3 py-1.5 font-mono text-xs text-white focus:border-[#0ea5e9] outline-none"
              />
            </div>
          </div>

          <div className="flex gap-3 pt-1">
            <button
              onClick={onRequestLocation}
              className="px-4 py-1.5 rounded font-mono text-xs border border-[#0ea5e9] text-[#0ea5e9] bg-[#0ea5e9]/10 hover:bg-[#0ea5e9]/20 transition-colors"
            >
              📍 USE LAPTOP GEOLOCATION API
            </button>
          </div>
        </div>

        {/* Sensor Calibration */}
        <div className="bg-[#0d1320] border border-[#1e2a3e] rounded p-4 space-y-3">
          <div className="font-mono text-xs font-bold text-white flex items-center justify-between">
            <span>MPU6050 / SENSOR CALIBRATION</span>
            <span className="text-[9px] font-mono text-[#eab308] bg-[#eab308]/10 border border-[#eab308]/30 px-1.5 py-0.5 rounded">
              BIAS SUBTRACTION
            </span>
          </div>

          <div className="grid grid-cols-6 gap-2 font-mono text-xs text-center">
            <div className="bg-[#080c12] p-1.5 rounded border border-[#1e2a3e]">
              <div className="text-[8px] text-[#637087]">AX BIAS</div>
              <div className="text-white">{calibration?.axBias ?? 0}</div>
            </div>
            <div className="bg-[#080c12] p-1.5 rounded border border-[#1e2a3e]">
              <div className="text-[8px] text-[#637087]">AY BIAS</div>
              <div className="text-white">{calibration?.ayBias ?? 0}</div>
            </div>
            <div className="bg-[#080c12] p-1.5 rounded border border-[#1e2a3e]">
              <div className="text-[8px] text-[#637087]">AZ BIAS</div>
              <div className="text-white">{calibration?.azBias ?? 0}</div>
            </div>
            <div className="bg-[#080c12] p-1.5 rounded border border-[#1e2a3e]">
              <div className="text-[8px] text-[#637087]">GX BIAS</div>
              <div className="text-white">{calibration?.gxBias ?? 0}</div>
            </div>
            <div className="bg-[#080c12] p-1.5 rounded border border-[#1e2a3e]">
              <div className="text-[8px] text-[#637087]">GY BIAS</div>
              <div className="text-white">{calibration?.gyBias ?? 0}</div>
            </div>
            <div className="bg-[#080c12] p-1.5 rounded border border-[#1e2a3e]">
              <div className="text-[8px] text-[#637087]">GZ BIAS</div>
              <div className="text-white">{calibration?.gzBias ?? 0}</div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            <div className="font-mono text-xs text-white">
              Status: <span style={{ color: calibration?.isCalibrated ? '#22c55e' : '#eab308' }}>
                {calibration?.isCalibrated ? `CALIBRATED (${calibration.sampleCount} samples)` : 'UNCALIBRATED'}
              </span>
            </div>
            <button
              onClick={onCalibrate}
              className="px-4 py-1.5 rounded font-mono text-xs border border-[#22c55e] text-[#22c55e] bg-[#22c55e]/10 hover:bg-[#22c55e]/20 transition-colors"
            >
              ⊕ CALIBRATE SENSORS (STATIONARY)
            </button>
          </div>
        </div>

        {/* Data Storage Path */}
        <div className="bg-[#0d1320] border border-[#1e2a3e] rounded p-4 space-y-3">
          <div className="font-mono text-xs font-bold text-white">DATA STORAGE</div>
          <div>
            <label className="font-mono text-[9px] text-[#637087] uppercase tracking-widest block mb-1">Log Export Target Path</label>
            <input
              value={vals.storage}
              onChange={e => setStr('storage', e.target.value)}
              className="w-full bg-[#080c12] border border-[#1e2a3e] rounded px-3 py-1.5 font-mono text-xs text-white focus:border-[#0ea5e9] outline-none"
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <button
            onClick={handleSave}
            className={`px-8 py-2 rounded font-mono text-xs font-semibold border transition-colors ${
              saved
                ? 'border-[#22c55e] text-[#22c55e] bg-[#22c55e]/10'
                : 'border-[#0ea5e9] text-[#0ea5e9] bg-[#0ea5e9]/10 hover:bg-[#0ea5e9]/20'
            }`}
          >
            {saved ? '✓ SETTINGS SAVED' : 'SAVE SETTINGS'}
          </button>
          <button
            onClick={handleReset}
            className="px-8 py-2 rounded font-mono text-xs font-semibold border border-[#1e2a3e] text-[#637087] hover:border-[#ef4444] hover:text-[#ef4444] transition-colors"
          >
            RESET DEFAULTS
          </button>
        </div>
      </div>
    </div>
  );
}
