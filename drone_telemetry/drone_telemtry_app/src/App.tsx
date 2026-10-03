import { useState, useEffect, useRef, useCallback } from 'react';
import type { Page } from './types/navigation';
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
import { 
  startCrashAlarm, 
  stopCrashAlarm, 
  setAudioMuted 
} from './services/audioAlertService';

import Sidebar from './components/Sidebar';
import TopBar from './components/TopBar';

import DashboardPage from './pages/DashboardPage';
import LiveMonitoringPage from './pages/LiveMonitoringPage';
import SensorGraphsPage from './pages/SensorGraphsPage';
import NetworkBridgePage from './pages/NetworkBridgePage';
import AlertsPage from './pages/AlertsPage';
import SystemHealthPage from './pages/SystemHealthPage';
import DataLoggerPage from './pages/DataLoggerPage';
import SettingsPage from './pages/SettingsPage';

export default function App() {
  const [page, setPage] = useState<Page>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
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

  const handleToggleAudio = useCallback(() => {
    const nextMuted = !settings.audioMuted;
    updateSettings({
      ...settings,
      audioMuted: nextMuted,
    });
  }, [settings, updateSettings]);

  const handleToggleTheme = useCallback(() => {
    const nextTheme = settings.theme === 'light' ? 'dark' : 'light';
    updateSettings({
      ...settings,
      theme: nextTheme,
    });
  }, [settings, updateSettings]);

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

  // Critical Crash Siren Audio Triggering Handler
  useEffect(() => {
    setAudioMuted(settings.audioMuted || false);
    if (crashRisk?.willCrash && hasReceivedData && !settings.audioMuted) {
      startCrashAlarm();
    } else {
      stopCrashAlarm();
    }
    return () => {
      stopCrashAlarm();
    };
  }, [crashRisk?.willCrash, hasReceivedData, settings.audioMuted]);

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

  const isLight = settings.theme === 'light';

  return (
    <div className={`flex h-screen w-screen overflow-hidden font-sans select-none transition-colors ${
      isLight ? 'bg-slate-100 text-slate-900' : 'bg-[#080c12] text-slate-100'
    }`}>
      
      {/* Enterprise Left Sidebar */}
      <div className={`fixed inset-y-0 left-0 z-40 transform transition-transform duration-200 md:relative md:translate-x-0 ${
        mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        <Sidebar
          currentPage={page}
          onNavigate={(p) => { setPage(p); setMobileMenuOpen(false); }}
          esp32Connected={status.esp32Connected}
          wsConnected={status.wsConnected}
          packetRateHz={packetRateHz}
          theme={settings.theme}
        />
      </div>

      {/* Backdrop for Mobile Sidebar */}
      {mobileMenuOpen && (
        <div
          onClick={() => setMobileMenuOpen(false)}
          className="fixed inset-0 z-30 bg-black/60 md:hidden"
        />
      )}

      {/* Main Content Viewport */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        
        {/* Enterprise Top Bar */}
        <TopBar
          currentPage={page}
          wsConnected={status.wsConnected}
          esp32Connected={status.esp32Connected}
          packetRateHz={packetRateHz}
          activeScenario={activeTestScenario}
          onSelectScenario={handleSelectScenario}
          onToggleMobileMenu={() => setMobileMenuOpen(p => !p)}
          audioMuted={settings.audioMuted || false}
          onToggleAudio={handleToggleAudio}
          theme={settings.theme || 'dark'}
          onToggleTheme={handleToggleTheme}
        />

        {/* Dynamic Operational Page Area */}
        <main className={`flex-1 overflow-hidden transition-colors ${
          isLight ? 'bg-slate-50' : 'bg-[#060910]'
        }`}>
          {page === 'dashboard' && (
            <DashboardPage
              processed={processed}
              telemetryHistory={telemetryHistory}
              onCalibrate={handleStartCalibration}
              onResetPosition={handleResetPosition}
              theme={settings.theme}
            />
          )}

          {page === 'monitoring' && (
            <LiveMonitoringPage
              processed={processed}
              history={telemetryHistory}
              theme={settings.theme}
            />
          )}

          {page === 'telemetry' && (
            <SensorGraphsPage
              history={telemetryHistory}
              running={graphRunning}
              onToggle={() => setGraphRunning(r => !r)}
              onClear={() => setTelemetryHistory([])}
              theme={settings.theme}
            />
          )}

          {page === 'network' && (
            <NetworkBridgePage
              processed={processed}
              laptopIp={settings.laptopIp}
              backendPort={settings.backendPort}
              wsPort={settings.wsPort}
              theme={settings.theme}
            />
          )}

          {page === 'alerts' && (
            <AlertsPage
              processed={processed}
              theme={settings.theme}
            />
          )}

          {page === 'health' && (
            <SystemHealthPage
              processed={processed}
              theme={settings.theme}
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
              theme={settings.theme}
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
              theme={settings.theme}
            />
          )}
        </main>

        {/* Enterprise Bottom Status Ribbon */}
        <footer className={`h-7 border-t px-3 flex items-center justify-between text-[9px] font-mono select-none flex-shrink-0 transition-colors ${
          isLight ? 'bg-white border-slate-200 text-slate-600' : 'bg-[#090d16] border-slate-800 text-slate-400'
        }`}>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <span>HARDWARE:</span>
              <span className={status.esp32Connected ? 'text-emerald-500 font-bold' : (hasReceivedData ? 'text-sky-500 font-bold' : 'text-slate-400')}>
                {status.esp32Connected ? 'ESP32 LIVE' : (hasReceivedData ? 'PACKET RECEIVED' : 'AWAITING ESP32')}
              </span>
            </div>
            <div className="flex items-center gap-1.5 hidden sm:flex">
              <span>WEBSOCKET:</span>
              <span className={status.wsConnected ? 'text-emerald-500 font-bold' : 'text-rose-500 font-bold'}>
                {status.wsConnected ? `ws://${settings.laptopIp || 'localhost'}:${settings.wsPort || 5001}` : 'OFFLINE'}
              </span>
            </div>
            <div className="flex items-center gap-1.5 hidden md:flex">
              <span>UDP BIND:</span>
              <span className="text-sky-500 font-bold">PORT :{settings.backendPort || 5000}</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div>
              AUDIO: <strong className={settings.audioMuted ? 'text-amber-500' : 'text-emerald-500'}>
                {settings.audioMuted ? 'MUTED' : 'ACTIVE'}
              </strong>
            </div>
            <div>
              THEME: <strong className="text-sky-500 uppercase">{settings.theme || 'DARK'}</strong>
            </div>
            <div>
              RATE: <strong className="text-sky-500">{packetRateHz} Hz</strong>
            </div>
            <div>
              LATENCY: <strong className={lastPacketMsAgo >= 0 && lastPacketMsAgo < 100 ? 'text-emerald-500' : 'text-slate-500'}>
                {lastPacketMsAgo >= 0 ? `${lastPacketMsAgo} ms` : '--'}
              </strong>
            </div>
            <div className="text-slate-400 hidden xl:block">
              AERO GUARD GCS · v3.3.0
            </div>
          </div>
        </footer>

      </div>

    </div>
  );
}
