import type { ESP32Telemetry } from '../types/telemetry';

export type TestScenarioName = 
  | 'NONE'
  | 'NORMAL' 
  | 'HIGH_ACCELERATION' 
  | 'HIGH_ANGULAR_VELOCITY' 
  | 'SUDDEN_PITCH_CHANGE' 
  | 'ALTITUDE_DROP' 
  | 'POSSIBLE_CRASH';

export interface TelemetryClientOptions {
  host: string;
  wsPort: number;
  onTelemetry: (telemetry: ESP32Telemetry, source: 'WEBSOCKET' | 'SIMULATOR') => void;
  onStatusChange: (status: { wsConnected: boolean; esp32Connected: boolean; message: string }) => void;
}

let activeWs: WebSocket | null = null;
let reconnectTimer: any = null;
let simTimer: any = null;

// Manual Test Scenario state (Defaults to 'NONE' - no random numbers)
let activeScenario: TestScenarioName = 'NONE';
let simRoll = 0, simPitch = 0, simYaw = 0, simAlt = 42.5;

export function setTestScenario(scenario: TestScenarioName) {
  activeScenario = scenario;
  console.log(`[Telemetry Service] Manual scenario set to: ${scenario}`);
}

export function generateTestTelemetry(scenario: TestScenarioName = activeScenario): ESP32Telemetry {
  const noise = (scale: number) => (Math.random() - 0.5) * scale;
  const t = Date.now();

  let roll = simRoll, pitch = simPitch, yaw = simYaw, ax = 0, ay = 0, az = 9.81, gx = 0, gy = 0, gz = 0, alt = simAlt;
  let bat = +(11.4 + noise(0.1)).toFixed(2);
  let rssi = -58; // dBm

  switch (scenario) {
    case 'HIGH_ACCELERATION':
      ax = +(22.5 + noise(6.0)).toFixed(2);
      ay = +(-14.2 + noise(5.0)).toFixed(2);
      az = +(28.0 + noise(8.0)).toFixed(2);
      roll = +(18 + noise(4)).toFixed(2);
      pitch = +(-25 + noise(4)).toFixed(2);
      break;

    case 'HIGH_ANGULAR_VELOCITY':
      gx = +(260 + noise(100)).toFixed(2);
      gy = +(-210 + noise(80)).toFixed(2);
      gz = +(340 + noise(120)).toFixed(2);
      roll = +(40 + noise(8)).toFixed(2);
      break;

    case 'SUDDEN_PITCH_CHANGE':
      pitch = +(68.0 + noise(4.0)).toFixed(2);
      roll = +(-48.0 + noise(4.0)).toFixed(2);
      ax = +(9.5 + noise(2)).toFixed(2);
      ay = +(-7.2 + noise(2)).toFixed(2);
      break;

    case 'ALTITUDE_DROP':
      simAlt = Math.max(0, simAlt - 5.0);
      alt = +simAlt.toFixed(1);
      az = +(1.8 + noise(0.8)).toFixed(2);
      break;

    case 'POSSIBLE_CRASH':
      ax = +(36.5 + noise(12.0)).toFixed(2);
      ay = +(-31.0 + noise(10.0)).toFixed(2);
      az = +(44.0 + noise(15.0)).toFixed(2);
      gx = +(510 + noise(180)).toFixed(2);
      gy = +(-420 + noise(150)).toFixed(2);
      roll = +(82.0 + noise(8.0)).toFixed(2);
      pitch = +(-76.0 + noise(8.0)).toFixed(2);
      simAlt = Math.max(0, simAlt - 9.0);
      alt = +simAlt.toFixed(1);
      bat = 9.6;
      rssi = -88;
      break;

    case 'NORMAL':
    default:
      simRoll = clamp(simRoll + noise(1.5), -20, 20);
      simPitch = clamp(simPitch + noise(1.2), -15, 15);
      simYaw = (simYaw + noise(1.5) + 0.5 + 360) % 360;
      simAlt = clamp(simAlt + noise(0.1), 5, 100);

      roll = +simRoll.toFixed(2);
      pitch = +simPitch.toFixed(2);
      yaw = +simYaw.toFixed(2);
      alt = +simAlt.toFixed(1);

      ax = +(roll * 0.02 + noise(0.05)).toFixed(2);
      ay = +(pitch * 0.015 + noise(0.04)).toFixed(2);
      az = +(9.81 + noise(0.1)).toFixed(2);
      gx = +(roll * 0.2 + noise(2.0)).toFixed(2);
      gy = +(pitch * 0.2 + noise(1.8)).toFixed(2);
      gz = +(noise(2.5)).toFixed(2);
      break;
  }

  return {
    timestamp: t,
    roll,
    pitch,
    yaw,
    ax,
    ay,
    az,
    gx,
    gy,
    gz,
    temperature: +(28.5 + noise(0.3)).toFixed(1),
    pressure: +(1008.4 + noise(0.2)).toFixed(1),
    altitude: alt,
    battery: bat,
    rssi,
  };
}

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

export function connectTelemetryClient(options: TelemetryClientOptions) {
  if (activeWs) {
    try { activeWs.close(); } catch (e) {}
  }
  if (reconnectTimer) clearTimeout(reconnectTimer);
  if (simTimer) clearInterval(simTimer);

  const wsUrl = `ws://${options.host}:${options.wsPort}`;
  console.log(`[Telemetry Service] Connecting to WebSocket server at ${wsUrl}`);

  let hasWsTelemetry = false;

  try {
    const ws = new WebSocket(wsUrl);
    activeWs = ws;

    ws.onopen = () => {
      console.log(`[Telemetry Service] WebSocket connected to ${wsUrl}`);
      options.onStatusChange({
        wsConnected: true,
        esp32Connected: false,
        message: 'WebSocket Connected (Awaiting ESP32 packets...)',
      });
    };

    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.type === 'TELEMETRY' && payload.telemetry) {
          hasWsTelemetry = true;
          options.onStatusChange({
            wsConnected: true,
            esp32Connected: true,
            message: 'Live ESP32 Telemetry Receiving',
          });
          options.onTelemetry(payload.telemetry, 'WEBSOCKET');
        } else if (payload.type === 'STATUS_UPDATE') {
          options.onStatusChange({
            wsConnected: true,
            esp32Connected: payload.esp32Connected,
            message: payload.message || 'Status Update',
          });
        }
      } catch (err) {
        console.warn('[Telemetry Service] Message parse error:', err);
      }
    };

    ws.onerror = (err) => {
      console.warn('[Telemetry Service] WebSocket connection error:', err);
    };

    ws.onclose = () => {
      console.warn(`[Telemetry Service] WebSocket closed. Reconnecting in 3s...`);
      options.onStatusChange({
        wsConnected: false,
        esp32Connected: false,
        message: 'Awaiting Hardware ESP32 Connection',
      });

      reconnectTimer = setTimeout(() => {
        connectTelemetryClient(options);
      }, 3000);
    };
  } catch (err) {
    console.error('[Telemetry Service] Failed to create WebSocket client:', err);
  }

  // ONLY generate test packets if user manually selected a test scenario (NOT 'NONE')
  simTimer = setInterval(() => {
    if (activeScenario !== 'NONE' && !hasWsTelemetry) {
      const simData = generateTestTelemetry(activeScenario);
      options.onTelemetry(simData, 'SIMULATOR');
    }
  }, 50);

  return () => {
    if (activeWs) try { activeWs.close(); } catch (e) {}
    if (reconnectTimer) clearTimeout(reconnectTimer);
    if (simTimer) clearInterval(simTimer);
  };
}
