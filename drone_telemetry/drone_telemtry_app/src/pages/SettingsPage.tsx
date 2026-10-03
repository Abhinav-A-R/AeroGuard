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
  theme?: 'dark' | 'light';
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
  theme = 'dark',
}: SettingsPageProps) {
  const isLight = theme === 'light';
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
    <div className={`h-full overflow-y-auto p-4 select-none font-mono ${
      isLight ? 'bg-slate-50 text-slate-900' : 'bg-[#060910] text-slate-100'
    }`}>
      <div className="max-w-3xl space-y-4">
        {/* Network & Ports */}
        <div className={`border rounded p-4 space-y-3 ${
          isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-[#0d1320] border-[#1e2a3e]'
        }`}>
          <div className={`text-xs font-bold flex items-center justify-between ${
            isLight ? 'text-slate-900' : 'text-white'
          }`}>
            <span>NETWORK & WEBSOCKET CONFIGURATION</span>
            <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${
              isLight ? 'bg-sky-100 text-sky-800 border border-sky-200' : 'bg-[#38bdf8]/10 text-[#38bdf8] border border-[#38bdf8]/30'
            }`}>
              ESP32 + BACKEND
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className={`text-[9px] uppercase tracking-widest block mb-1 ${
                isLight ? 'text-slate-500' : 'text-[#637087]'
              }`}>Laptop / Host IP</label>
              <input
                value={vals.laptopIp}
                onChange={e => setStr('laptopIp', e.target.value)}
                placeholder="192.168.43.20"
                className={`w-full rounded px-3 py-1.5 text-xs outline-none border transition-colors ${
                  isLight ? 'bg-slate-50 border-slate-300 text-slate-900 focus:border-sky-500' : 'bg-[#080c12] border-[#1e2a3e] text-white focus:border-[#0ea5e9]'
                }`}
              />
            </div>
            <div>
              <label className={`text-[9px] uppercase tracking-widest block mb-1 ${
                isLight ? 'text-slate-500' : 'text-[#637087]'
              }`}>ESP32 Backend Port</label>
              <input
                type="number"
                value={vals.backendPort}
                onChange={e => setNum('backendPort', parseInt(e.target.value) || 5000)}
                className={`w-full rounded px-3 py-1.5 text-xs outline-none border transition-colors ${
                  isLight ? 'bg-slate-50 border-slate-300 text-slate-900 focus:border-sky-500' : 'bg-[#080c12] border-[#1e2a3e] text-white focus:border-[#0ea5e9]'
                }`}
              />
            </div>
            <div>
              <label className={`text-[9px] uppercase tracking-widest block mb-1 ${
                isLight ? 'text-slate-500' : 'text-[#637087]'
              }`}>Browser WebSocket Port</label>
              <input
                type="number"
                value={vals.wsPort}
                onChange={e => setNum('wsPort', parseInt(e.target.value) || 5001)}
                className={`w-full rounded px-3 py-1.5 text-xs outline-none border transition-colors ${
                  isLight ? 'bg-slate-50 border-slate-300 text-slate-900 focus:border-sky-500' : 'bg-[#080c12] border-[#1e2a3e] text-white focus:border-[#0ea5e9]'
                }`}
              />
            </div>
          </div>
          <div className={`text-[9px] ${isLight ? 'text-slate-500' : 'text-[#637087]'}`}>
            ESP32 sends JSON telemetry to <span className={isLight ? 'text-slate-900 font-bold' : 'text-white'}>http://{vals.laptopIp}:{vals.backendPort}/api/telemetry</span>. Browser connects via <span className={isLight ? 'text-sky-700 font-bold' : 'text-[#38bdf8]'}>ws://{vals.laptopIp}:{vals.wsPort}</span>.
          </div>
        </div>

        {/* Geographic Reference Coordinates */}
        <div className={`border rounded p-4 space-y-3 ${
          isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-[#0d1320] border-[#1e2a3e]'
        }`}>
          <div className={`text-xs font-bold flex items-center justify-between ${
            isLight ? 'text-slate-900' : 'text-white'
          }`}>
            <span>INITIAL GEOGRAPHIC REFERENCE POSITION</span>
            <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${
              isLight ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 'bg-[#22c55e]/10 text-[#22c55e] border border-[#22c55e]/30'
            }`}>
              POSITION ESTIMATION
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={`text-[9px] uppercase tracking-widest block mb-1 ${
                isLight ? 'text-slate-500' : 'text-[#637087]'
              }`}>Initial Latitude (deg)</label>
              <input
                value={manualLat}
                onChange={e => setManualLat(e.target.value)}
                className={`w-full rounded px-3 py-1.5 text-xs outline-none border transition-colors ${
                  isLight ? 'bg-slate-50 border-slate-300 text-slate-900 focus:border-sky-500' : 'bg-[#080c12] border-[#1e2a3e] text-white focus:border-[#0ea5e9]'
                }`}
              />
            </div>
            <div>
              <label className={`text-[9px] uppercase tracking-widest block mb-1 ${
                isLight ? 'text-slate-500' : 'text-[#637087]'
              }`}>Initial Longitude (deg)</label>
              <input
                value={manualLon}
                onChange={e => setManualLon(e.target.value)}
                className={`w-full rounded px-3 py-1.5 text-xs outline-none border transition-colors ${
                  isLight ? 'bg-slate-50 border-slate-300 text-slate-900 focus:border-sky-500' : 'bg-[#080c12] border-[#1e2a3e] text-white focus:border-[#0ea5e9]'
                }`}
              />
            </div>
          </div>

          <div className="flex gap-3 pt-1">
            <button
              onClick={onRequestLocation}
              className={`px-4 py-1.5 rounded text-xs border transition-colors ${
                isLight 
                  ? 'border-sky-500 text-sky-800 bg-sky-50 hover:bg-sky-100 font-bold'
                  : 'border-[#0ea5e9] text-[#0ea5e9] bg-[#0ea5e9]/10 hover:bg-[#0ea5e9]/20'
              }`}
            >
              📍 USE LAPTOP GEOLOCATION API
            </button>
          </div>
        </div>

        {/* Sensor Calibration */}
        <div className={`border rounded p-4 space-y-3 ${
          isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-[#0d1320] border-[#1e2a3e]'
        }`}>
          <div className={`text-xs font-bold flex items-center justify-between ${
            isLight ? 'text-slate-900' : 'text-white'
          }`}>
            <span>MPU6050 / SENSOR CALIBRATION</span>
            <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${
              isLight ? 'bg-amber-100 text-amber-800 border border-amber-200' : 'bg-[#eab308]/10 text-[#eab308] border border-[#eab308]/30'
            }`}>
              BIAS SUBTRACTION
            </span>
          </div>

          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-xs text-center">
            {['AX', 'AY', 'AZ', 'GX', 'GY', 'GZ'].map((axis, i) => {
              const keys = ['axBias', 'ayBias', 'azBias', 'gxBias', 'gyBias', 'gzBias'] as const;
              const val = calibration ? calibration[keys[i]] : 0;
              return (
                <div key={axis} className={`p-1.5 rounded border ${
                  isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#080c12] border-[#1e2a3e]'
                }`}>
                  <div className={`text-[8px] ${isLight ? 'text-slate-500' : 'text-[#637087]'}`}>{axis} BIAS</div>
                  <div className={isLight ? 'text-slate-900 font-bold' : 'text-white'}>{val ?? 0}</div>
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-between pt-1">
            <div className={`text-xs ${isLight ? 'text-slate-700' : 'text-white'}`}>
              Status: <span style={{ color: calibration?.isCalibrated ? (isLight ? '#059669' : '#22c55e') : (isLight ? '#d97706' : '#eab308') }}>
                {calibration?.isCalibrated ? `CALIBRATED (${calibration.sampleCount} samples)` : 'UNCALIBRATED'}
              </span>
            </div>
            <button
              onClick={onCalibrate}
              className={`px-4 py-1.5 rounded text-xs border transition-colors ${
                isLight 
                  ? 'border-emerald-500 text-emerald-800 bg-emerald-50 hover:bg-emerald-100 font-bold'
                  : 'border-[#22c55e] text-[#22c55e] bg-[#22c55e]/10 hover:bg-[#22c55e]/20'
              }`}
            >
              ⊕ CALIBRATE SENSORS (STATIONARY)
            </button>
          </div>
        </div>

        {/* Data Storage Path */}
        <div className={`border rounded p-4 space-y-3 ${
          isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-[#0d1320] border-[#1e2a3e]'
        }`}>
          <div className={`text-xs font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>DATA STORAGE</div>
          <div>
            <label className={`text-[9px] uppercase tracking-widest block mb-1 ${
              isLight ? 'text-slate-500' : 'text-[#637087]'
            }`}>Log Export Target Path</label>
            <input
              value={vals.storage}
              onChange={e => setStr('storage', e.target.value)}
              className={`w-full rounded px-3 py-1.5 text-xs outline-none border transition-colors ${
                isLight ? 'bg-slate-50 border-slate-300 text-slate-900 focus:border-sky-500' : 'bg-[#080c12] border-[#1e2a3e] text-white focus:border-[#0ea5e9]'
              }`}
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <button
            onClick={handleSave}
            className={`px-8 py-2 rounded text-xs font-semibold border transition-colors ${
              saved
                ? isLight ? 'border-emerald-500 text-emerald-800 bg-emerald-50' : 'border-[#22c55e] text-[#22c55e] bg-[#22c55e]/10'
                : isLight ? 'border-sky-500 text-sky-800 bg-sky-50 hover:bg-sky-100 font-bold' : 'border-[#0ea5e9] text-[#0ea5e9] bg-[#0ea5e9]/10 hover:bg-[#0ea5e9]/20'
            }`}
          >
            {saved ? '✓ SETTINGS SAVED' : 'SAVE SETTINGS'}
          </button>
          <button
            onClick={handleReset}
            className={`px-8 py-2 rounded text-xs font-semibold border transition-colors ${
              isLight
                ? 'border-slate-300 text-slate-600 hover:border-rose-400 hover:text-rose-700 bg-white'
                : 'border-[#1e2a3e] text-[#637087] hover:border-[#ef4444] hover:text-[#ef4444]'
            }`}
          >
            RESET DEFAULTS
          </button>
        </div>
      </div>
    </div>
  );
}
