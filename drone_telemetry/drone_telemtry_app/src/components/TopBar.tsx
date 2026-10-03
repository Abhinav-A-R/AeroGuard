import { useState, useEffect } from 'react';
import type { Page } from '../types/navigation';
import type { TestScenarioName } from '../services/websocketClient';
import StatusBadge from './StatusBadge';

interface TopBarProps {
  currentPage: Page;
  wsConnected: boolean;
  esp32Connected: boolean;
  packetRateHz: number;
  activeScenario: TestScenarioName;
  onSelectScenario: (scenario: TestScenarioName) => void;
  onToggleMobileMenu: () => void;
  audioMuted: boolean;
  onToggleAudio: () => void;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
}

const PAGE_TITLES: Record<Page, { title: string; subtitle: string }> = {
  dashboard: { title: 'OPERATIONAL OVERVIEW', subtitle: 'Global System Health, 3D Position & Crash Anomaly Monitor' },
  monitoring: { title: 'LIVE MONITORING STREAM', subtitle: 'Real-time ESP32 Ingest Stream & Packet Counters' },
  telemetry: { title: 'TELEMETRY ANALYTICS', subtitle: 'IMU Sensor Vectors, Euler Angles & Barometric Metrics' },
  network: { title: 'NETWORK & BRIDGE TOPOLOGY', subtitle: 'Node.js Express (5000), UDP Receiver & WebSocket (5001)' },
  alerts: { title: 'ALERT & DIAGNOSTIC CENTER', subtitle: 'Real-time Threshold Violations & Flight Safety Alarms' },
  health: { title: 'SYSTEM HEALTH & SERVICES', subtitle: 'Backend Runtime Metrics, API Health & Service Matrix' },
  logger: { title: 'TELEMETRY DATA LOGGER', subtitle: 'CSV / JSON / TXT Flight Recording & Playback Buffer' },
  settings: { title: 'SYSTEM CONFIGURATION', subtitle: 'Connection Endpoints, Sensor Calibration & Geolocation' },
};

export default function TopBar({
  currentPage,
  wsConnected,
  esp32Connected,
  packetRateHz,
  activeScenario,
  onSelectScenario,
  onToggleMobileMenu,
  audioMuted,
  onToggleAudio,
  theme,
  onToggleTheme,
}: TopBarProps) {
  const [utcTimeStr, setUtcTimeStr] = useState('');
  const [localTimeStr, setLocalTimeStr] = useState('');

  useEffect(() => {
    const updateTime = () => {
      const d = new Date();
      setUtcTimeStr(d.toISOString().substring(11, 19) + ' UTC');
      setLocalTimeStr(d.toLocaleTimeString());
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  const meta = PAGE_TITLES[currentPage] || { title: 'AERO GUARD', subtitle: 'UAV Monitoring Station' };

  const isLight = theme === 'light';

  return (
    <header className={`h-14 border-b px-4 flex items-center justify-between select-none flex-shrink-0 transition-colors ${
      isLight ? 'bg-white border-slate-200 text-slate-900' : 'bg-[#090d16] border-slate-800 text-slate-100'
    }`}>
      
      {/* Page Title & Breadcrumb */}
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleMobileMenu}
          className={`md:hidden p-1.5 rounded transition-colors ${
            isLight ? 'text-slate-600 hover:bg-slate-100' : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
          aria-label="Toggle Menu"
        >
          ☰
        </button>
        <div>
          <h1 className={`font-mono text-sm font-bold tracking-wider uppercase leading-none ${
            isLight ? 'text-slate-900' : 'text-slate-100'
          }`}>
            {meta.title}
          </h1>
          <p className={`font-mono text-[9px] leading-tight mt-0.5 hidden sm:block ${
            isLight ? 'text-slate-500' : 'text-slate-400'
          }`}>
            {meta.subtitle}
          </p>
        </div>
      </div>

      {/* Right Controls: Network Indicators, Audio Toggle, Theme Switcher, Clocks */}
      <div className="flex items-center gap-3">
        
        {/* Audio Siren Mute / Play Control Button */}
        <button
          onClick={onToggleAudio}
          className={`px-2.5 py-1 rounded font-mono text-[10px] font-bold border flex items-center gap-1.5 transition-all ${
            audioMuted
              ? isLight ? 'bg-amber-50 border-amber-300 text-amber-700' : 'bg-amber-950/40 border-amber-500/40 text-amber-400'
              : isLight ? 'bg-emerald-50 border-emerald-300 text-emerald-700' : 'bg-emerald-950/40 border-emerald-500/40 text-emerald-400'
          }`}
          title={audioMuted ? 'Unmute Critical Crash Siren Audio' : 'Mute Crash Alarm Sound'}
        >
          <span>{audioMuted ? '🔇' : '🔊'}</span>
          <span className="hidden sm:inline">{audioMuted ? 'AUDIO MUTED' : 'AUDIO ACTIVE'}</span>
        </button>

        {/* Dark / Light Theme Mode Switcher */}
        <button
          onClick={onToggleTheme}
          className={`px-2.5 py-1 rounded font-mono text-[10px] font-bold border flex items-center gap-1.5 transition-all ${
            isLight
              ? 'bg-slate-100 border-slate-300 text-slate-800 hover:bg-slate-200'
              : 'bg-slate-900 border-slate-800 text-sky-400 hover:bg-slate-800'
          }`}
          title="Toggle Light / Dark Interface Theme"
        >
          <span>{isLight ? '☀️' : '🌙'}</span>
          <span className="hidden sm:inline">{isLight ? 'LIGHT MODE' : 'DARK MODE'}</span>
        </button>

        {/* Manual Test Scenario Injection Selector */}
        <div className={`hidden lg:flex items-center gap-1.5 border rounded px-2 py-1 ${
          isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-900 border-slate-800'
        }`}>
          <span className={`font-mono text-[9px] uppercase font-semibold ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>TEST INJECT:</span>
          <select
            value={activeScenario}
            onChange={(e) => onSelectScenario(e.target.value as TestScenarioName)}
            className={`bg-transparent font-mono text-[10px] outline-none cursor-pointer ${
              isLight ? 'text-sky-700 font-bold' : 'text-sky-400'
            }`}
          >
            <option value="NONE" className={isLight ? 'bg-white text-slate-800' : 'bg-slate-900 text-slate-300'}>NONE (REAL HARDWARE)</option>
            <option value="NORMAL" className={isLight ? 'bg-white text-emerald-700' : 'bg-slate-900 text-emerald-400'}>TEST: NORMAL FLIGHT</option>
            <option value="HIGH_ACCELERATION" className={isLight ? 'bg-white text-amber-700' : 'bg-slate-900 text-amber-400'}>TEST: HIGH ACCEL ($G$ SPIKE)</option>
            <option value="HIGH_ANGULAR_VELOCITY" className={isLight ? 'bg-white text-amber-700' : 'bg-slate-900 text-amber-400'}>TEST: HIGH ROTATION RATE</option>
            <option value="SUDDEN_PITCH_CHANGE" className={isLight ? 'bg-white text-amber-700' : 'bg-slate-900 text-amber-400'}>TEST: SUDDEN TILT</option>
            <option value="ALTITUDE_DROP" className={isLight ? 'bg-white text-amber-700' : 'bg-slate-900 text-amber-400'}>TEST: ALTITUDE DROP</option>
            <option value="POSSIBLE_CRASH" className={isLight ? 'bg-white text-rose-700' : 'bg-slate-900 text-rose-400'}>TEST: CRASH SCENARIO</option>
          </select>
        </div>

        {/* Live Network Status Indicators */}
        <div className="hidden md:flex items-center gap-2">
          <StatusBadge status={esp32Connected ? 'LIVE' : 'STANDBY'} pulse={esp32Connected} />
          <StatusBadge status={wsConnected ? 'CONNECTED' : 'OFFLINE'} />
        </div>

        {/* Clocks (UTC & Local) */}
        <div className="font-mono text-right hidden xl:block">
          <div className={`text-xs font-bold ${isLight ? 'text-slate-800' : 'text-slate-200'}`}>{localTimeStr}</div>
          <div className={`text-[9px] ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>{utcTimeStr}</div>
        </div>

      </div>
    </header>
  );
}
