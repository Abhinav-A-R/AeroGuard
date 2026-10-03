import { useState, useEffect, useRef, useCallback } from 'react';
import type { 
  ESP32Telemetry, 
  ProcessedTelemetry, 
  SensorCalibration 
} from './types/telemetry';
import { loadSettings, saveSettingsToStorage } from './types/settings';
import type { SystemSettings } from './types/settings';
import { predictCrashRisk } from './utils/crashDetection';
import { 
  updatePositionEstimate, 
  INITIAL_POSITION_STATE, 
  type PositionEstimatorState 
} from './utils/positionEstimation';
import { 
  loadCalibrationFromStorage, 
  saveCalibrationToStorage, 
  applyCalibration 
} from './utils/calibration';
import { 
  connectTelemetryClient, 
  setTestScenario, 
  type TestScenarioName 
} from './services/websocketClient';

import DashboardPage from './pages/DashboardPage';
import SensorGraphsPage from './pages/SensorGraphsPage';
import DataLoggerPage from './pages/DataLoggerPage';
import SettingsPage from './pages/SettingsPage';

type Page = 'dashboard' | 'telemetry' | 'logger' | 'settings';

const NAV: { id: Page; label: string }[] = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'telemetry', label: 'Telemetry Graphs' },
  { id: 'logger', label: 'Data Logger' },
  { id: 'settings', label: 'Settings' },
];

export default function App() {
  const [page, setPage] = useState<Page>('dashboard');
  const [settings, setSettingsState] = useState<SystemSettings>(loadSettings);
  const [calibration, setCalibration] = useState<SensorCalibration>(loadCalibrationFromStorage);
  const [positionState, setPositionState] = useState<PositionEstimatorState>(INITIAL_POSITION_STATE);

  // Raw telemetry starts NULL until real data arrives
  const [rawTelemetry, setRawTelemetry] = useState<ESP32Telemetry | null>(null);
  const [telemetryHistory, setTelemetryHistory] = useState<ESP32Telemetry[]>([]);
  const [logHistory, setLogHistory] = useState<ESP32Telemetry[]>([]);
  
  const [graphRunning, setGraphRunning] = useState(true);
  const [logging, setLogging] = useState(false);
  const [logPaused, setLogPaused] = useState(false);
  
  const [status, setStatus] = useState({
    wsConnected: false,
    esp32Connected: false,
    backendConnected: false,
    message: 'Awaiting Hardware ESP32 Connection...',
  });
  
  const [hasReceivedData, setHasReceivedData] = useState(false);
  const [packetCount, setPacketCount] = useState(0);
  const [lastPacketTime, setLastPacketTime] = useState<number | null>(null);
  const [packetRateHz, setPacketRateHz] = useState(0);
  const [currentTimeStr, setCurrentTimeStr] = useState(() => new Date().toLocaleTimeString());
  const [activeTestScenario, setActiveTestScenarioState] = useState<TestScenarioName>('NONE');

  const prevTelemetryRef = useRef<ESP32Telemetry | undefined>(undefined);
  const prevTimestampRef = useRef<number>(Date.now());
  const packetCounterRef = useRef(0);
  const lastRateCheckRef = useRef(Date.now());
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  const updateSettings = useCallback((newSettings: SystemSettings) => {
    setSettingsState(newSettings);
    saveSettingsToStorage(newSettings);
  }, []);

  // Request Laptop Geolocation API Reference
  const requestLaptopLocation = useCallback(() => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          console.log('[AeroGuard] Laptop Reference Geolocation Locked:', pos.coords.latitude, pos.coords.longitude);
          setPositionState(prev => ({
            ...prev,
            refLat: pos.coords.latitude,
            refLon: pos.coords.longitude,
            refSource: 'Laptop Geolocation',
          }));
        },
        (err) => {
          console.warn('[AeroGuard] Laptop Geolocation permission or sensor unavailable:', err.message);
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    }
  }, []);

  useEffect(() => {
    requestLaptopLocation();
  }, [requestLaptopLocation]);

  // Header 1s Clock
  useEffect(() => {
    const clockId = setInterval(() => {
      setCurrentTimeStr(new Date().toLocaleTimeString());
    }, 1000);
    return () => clearInterval(clockId);
  }, []);

  // Packet Rate Calculator (Hz)
  useEffect(() => {
    const rateInterval = setInterval(() => {
      const now = Date.now();
      const dt = (now - lastRateCheckRef.current) / 1000;
      if (dt > 0) {
        const rate = Math.round(packetCounterRef.current / dt);
        setPacketRateHz(rate);
        packetCounterRef.current = 0;
        lastRateCheckRef.current = now;
      }
    }, 1000);
    return () => clearInterval(rateInterval);
  }, []);

  // Real Incoming Telemetry Receiver Handler
  const handleIncomingTelemetry = useCallback((telem: ESP32Telemetry, source: string) => {
    const now = Date.now();
    setHasReceivedData(true);
    packetCounterRef.current += 1;
    setPacketCount(p => p + 1);
    setLastPacketTime(now);

    const prevTs = prevTimestampRef.current;
    let dt = (now - prevTs) / 1000;
    if (dt <= 0 || dt > 2.0) dt = 0.05;
    prevTimestampRef.current = now;

    setRawTelemetry(telem);

    setTelemetryHistory(prev => {
      const maxLen = settingsRef.current.graphRate || 2000;
      const updated = [...prev, telem];
      return updated.length > maxLen ? updated.slice(-maxLen) : updated;
    });

    setLogHistory(prev => {
      if (!logging || logPaused) return prev;
      const updated = [...prev, telem];
      return updated.length > 50000 ? updated.slice(-50000) : updated;
    });

    // Update Inertial Position Estimator
    setPositionState(prevState => {
      const { nextState } = updatePositionEstimate(prevState, telem, dt);
      return nextState;
    });

    prevTelemetryRef.current = telem;
  }, [logging, logPaused]);

  // Connect to WebSocket Server (Port 5001)
  useEffect(() => {
    const cleanup = connectTelemetryClient({
      host: settings.laptopIp || 'localhost',
      wsPort: settings.wsPort || 5001,
      onTelemetry: (telem, source) => {
        handleIncomingTelemetry(telem, source);
      },
      onStatusChange: (newStatus) => {
        setStatus(prev => ({
          ...prev,
          wsConnected: newStatus.wsConnected,
          esp32Connected: newStatus.esp32Connected,
          message: newStatus.message,
        }));
      },
    });

    return () => cleanup();
  }, [settings.laptopIp, settings.wsPort, handleIncomingTelemetry]);

  // Sensor Calibration Handler
  const handleStartCalibration = useCallback(() => {
    const samples: ESP32Telemetry[] = telemetryHistory.slice(-50);
    if (!samples.length) return;

    let sumAx = 0, sumAy = 0, sumAz = 0;
    let sumGx = 0, sumGy = 0, sumGz = 0;

    samples.forEach(s => {
      sumAx += s.ax;
      sumAy += s.ay;
      sumAz += s.az;
      sumGx += s.gx;
      sumGy += s.gy;
      sumGz += s.gz;
    });

    const count = samples.length;
    const newCalib: SensorCalibration = {
      isCalibrated: true,
      axBias: +(sumAx / count).toFixed(4),
      ayBias: +(sumAy / count).toFixed(4),
      azBias: +((sumAz / count) - 9.81).toFixed(4),
      gxBias: +(sumGx / count).toFixed(4),
      gyBias: +(sumGy / count).toFixed(4),
      gzBias: +(sumGz / count).toFixed(4),
      sampleCount: count,
    };

    setCalibration(newCalib);
    saveCalibrationToStorage(newCalib);
  }, [telemetryHistory]);

  const handleResetPosition = useCallback(() => {
    setPositionState(prev => ({
      ...INITIAL_POSITION_STATE,
      refLat: prev.refLat,
      refLon: prev.refLon,
      refSource: prev.refSource,
    }));
  }, []);

  const handleSelectScenario = useCallback((scenario: TestScenarioName) => {
    setActiveTestScenarioState(scenario);
    setTestScenario(scenario);
  }, []);

  // Compute Processed Telemetry Pipeline
  const nowMs = Date.now();
  const lastPacketMsAgo = lastPacketTime ? nowMs - lastPacketTime : -1;
  const dt = prevTelemetryRef.current && lastPacketTime ? Math.min(1.0, (nowMs - lastPacketTime) / 1000) : 0.05;

  const calibratedSensors = rawTelemetry ? applyCalibration(rawTelemetry, calibration) : null;
  const crashRisk = rawTelemetry ? predictCrashRisk(rawTelemetry, prevTelemetryRef.current, dt) : null;
  const { estimate: positionEstimate } = updatePositionEstimate(positionState, rawTelemetry, dt);

  const processed: ProcessedTelemetry = {
    raw: rawTelemetry,
    serverTimestamp: nowMs,
    dt,
    calibrated: calibratedSensors,
    orientation: rawTelemetry ? {
      roll: rawTelemetry.roll,
      pitch: rawTelemetry.pitch,
      yaw: rawTelemetry.yaw,
    } : null,
    crashRisk,
    position: positionEstimate,
    calibration,
    status: {
      hasReceivedData,
      esp32Connected: status.esp32Connected,
      wsConnected: status.wsConnected,
      backendConnected: status.backendConnected || status.wsConnected,
      lastPacketMsAgo,
      packetRateHz,
      totalPackets: packetCount,
      mode: activeTestScenario !== 'NONE' ? 'TEST SCENARIO' : (status.esp32Connected ? 'LIVE ESP32' : 'AWAITING TELEMETRY'),
      activeScenario: activeTestScenario,
    },
  };

  const handleLogStart = useCallback(() => { setLogging(true); setLogPaused(false); setLogHistory([]); }, []);
  const handleLogStop = useCallback(() => { setLogging(false); setLogPaused(false); }, []);
  const handleLogPause = useCallback(() => setLogPaused(p => !p), []);

  return (
    <div className="flex flex-col select-none" style={{ height: '100vh', background: '#080c12', overflow: 'hidden' }}>
      {/* Top Header Navigation */}
      <header className="flex-shrink-0 flex items-center border-b border-[#1e2a3e] bg-[#080c12]" style={{ height: 44 }}>
        {/* Brand Logo */}
        <button
          onClick={() => setPage('dashboard')}
          className="flex items-center gap-2.5 px-4 h-full border-r border-[#1e2a3e] hover:bg-[#0d1320] transition-colors"
        >
          <div className="w-6 h-6 border border-[#22d3ee] rounded flex items-center justify-center bg-[#22d3ee]/10">
            <div className="w-2.5 h-2.5 bg-[#22d3ee] rounded-sm" style={{ boxShadow: '0 0 6px #22d3ee' }} />
          </div>
          <div className="flex flex-col items-start">
            <span className="font-mono text-xs font-bold text-[#22d3ee] tracking-widest uppercase leading-none">AEROGUARD</span>
            <span className="font-mono text-[8px] text-[#637087] leading-tight">LIVE UAV TELEMETRY & CRASH MONITOR</span>
          </div>
        </button>

        {/* Primary Navigation Tabs */}
        <nav className="flex items-center h-full">
          {NAV.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setPage(id)}
              className={`px-5 h-full font-mono text-xs tracking-wider border-r border-[#1e2a3e] transition-colors ${
                page === id
                  ? 'text-[#38bdf8] bg-[#0ea5e9]/10 border-b-2 border-b-[#0ea5e9] font-bold'
                  : 'text-[#637087] hover:text-white hover:bg-[#0d1320]'
              }`}
            >
              {label.toUpperCase()}
            </button>
          ))}
        </nav>

        {/* Manual Test Scenario Mode */}
        <div className="ml-auto flex items-center gap-2 px-3">
          <span className="font-mono text-[9px] text-[#637087] uppercase">MANUAL TEST INJECTION:</span>
          <select
            value={activeTestScenario}
            onChange={e => handleSelectScenario(e.target.value as TestScenarioName)}
            className="bg-[#0d1320] border border-[#1e2a3e] rounded px-2 py-1 font-mono text-[10px] text-[#38bdf8] outline-none"
          >
            <option value="NONE">DISABLED (AWAITING REAL ESP32)</option>
            <option value="NORMAL">TEST: NORMAL FLIGHT</option>
            <option value="HIGH_ACCELERATION">TEST: HIGH ACCELERATION</option>
            <option value="HIGH_ANGULAR_VELOCITY">TEST: HIGH ANGULAR VELOCITY</option>
            <option value="SUDDEN_PITCH_CHANGE">TEST: SUDDEN PITCH CHANGE</option>
            <option value="ALTITUDE_DROP">TEST: ALTITUDE DROP</option>
            <option value="POSSIBLE_CRASH">TEST: POSSIBLE CRASH</option>
          </select>
        </div>

        {/* Status Badges */}
        <div className="flex items-center gap-3 px-4 border-l border-[#1e2a3e] h-full">
          <div className="flex items-center gap-1.5">
            <div className={`w-2 h-2 rounded-full ${hasReceivedData ? 'bg-[#22c55e]' : 'bg-[#ef4444]'}`}
              style={{ boxShadow: hasReceivedData ? '0 0 6px #22c55e' : '0 0 6px #ef4444' }} />
            <span className="font-mono text-[10px] font-bold" style={{ color: hasReceivedData ? '#22c55e' : '#ef4444' }}>
              {hasReceivedData ? (status.esp32Connected ? 'ESP32 LIVE' : 'TELEMETRY RECEIVED') : 'NO TELEMETRY'}
            </span>
          </div>
          <div className="font-mono text-[10px] text-[#637087]">
            {currentTimeStr}
          </div>
        </div>
      </header>

      {/* Main Active Page View */}
      <main className="flex-1 overflow-hidden">
        {page === 'dashboard' && (
          <DashboardPage
            processed={processed}
            telemetryHistory={telemetryHistory}
            onCalibrate={handleStartCalibration}
            onResetPosition={handleResetPosition}
          />
        )}
        {page === 'telemetry' && (
          <SensorGraphsPage
            history={telemetryHistory}
            running={graphRunning}
            onToggle={() => setGraphRunning(r => !r)}
            onClear={() => setTelemetryHistory([])}
          />
        )}
        {page === 'logger' && (
          <DataLoggerPage
            history={logHistory}
            logging={logging}
            onStart={handleLogStart}
            onStop={handleLogStop}
            onPause={handleLogPause}
            logPaused={logPaused}
            samplingHz={settings.samplingHz}
            storagePath={settings.storage}
          />
        )}
        {page === 'settings' && (
          <SettingsPage
            settings={settings}
            onSaveSettings={updateSettings}
            calibration={calibration}
            onCalibrate={handleStartCalibration}
            refLat={positionState.refLat}
            refLon={positionState.refLon}
            onSetRefCoords={(lat, lon) => setPositionState(prev => ({ ...prev, refLat: lat, refLon: lon, refSource: 'Manual Reference' }))}
            onRequestLocation={requestLaptopLocation}
          />
        )}
      </main>

      {/* Bottom Status Bar */}
      <footer className="flex-shrink-0 flex items-center border-t border-[#1e2a3e] bg-[#080c12]" style={{ height: 28 }}>
        {[
          { label: 'ESP32', value: status.esp32Connected ? 'CONNECTED' : (hasReceivedData ? 'PACKET RECEIVED' : 'AWAITING DATA'), color: status.esp32Connected ? '#22c55e' : (hasReceivedData ? '#38bdf8' : '#637087') },
          { label: 'WEBSOCKET', value: status.wsConnected ? `ws://${settings.laptopIp || 'localhost'}:${settings.wsPort || 5001}` : 'OFFLINE', color: status.wsConnected ? '#22c55e' : '#ef4444' },
          { label: 'BACKEND', value: `PORT ${settings.backendPort || 5000}`, color: '#0ea5e9' },
          { label: 'LOGGING', value: logging ? (logPaused ? 'PAUSED' : 'ON') : 'OFF', color: logging ? (logPaused ? '#eab308' : '#22c55e') : '#637087' },
          { label: 'RATE', value: `${packetRateHz} Hz`, color: '#38bdf8' },
          { label: 'LATENCY', value: lastPacketMsAgo >= 0 ? `${lastPacketMsAgo} ms` : '-- ms', color: lastPacketMsAgo >= 0 && lastPacketMsAgo < 100 ? '#22c55e' : '#637087' },
          { label: 'BATTERY', value: rawTelemetry ? `${rawTelemetry.battery} V` : '-- V', color: rawTelemetry && rawTelemetry.battery > 3.4 ? '#22c55e' : '#637087' },
        ].map(({ label, value, color }) => (
          <div key={label} className="flex items-center gap-1.5 px-3 h-full border-r border-[#1e2a3e]">
            <span className="font-mono text-[9px] text-[#637087]">{label}:</span>
            <span className="font-mono text-[9px] font-bold" style={{ color }}>{value}</span>
          </div>
        ))}
        <div className="ml-auto px-3 font-mono text-[9px] text-[#637087]">
          AEROGUARD UAV TELEMETRY STATION · v3.1.0
        </div>
      </footer>
    </div>
  );
}
