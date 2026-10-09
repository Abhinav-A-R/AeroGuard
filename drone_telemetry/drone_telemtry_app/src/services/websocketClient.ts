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
let simX = 3.5, simY = 4.2, simVx = 0.4, simVy = 0.3;

export function setTestScenario(scenario: TestScenarioName) {
  const prevScenario = activeScenario;
  activeScenario = scenario;
  console.log(`[Telemetry Service] Manual scenario set to: ${scenario}`);

  // Reset spatial position state on scenario transition
  if (scenario === 'NORMAL' || scenario === 'NONE') {
    simRoll = (Math.random() - 0.5) * 4;
    simPitch = (Math.random() - 0.5) * 4;
    simX = 3.5;
    simY = 4.2;
    simVx = 0.4;
    simVy = 0.3;
    if (simAlt < 20) simAlt = 42.5;
  } else if (prevScenario !== scenario) {
    if (simAlt < 10) simAlt = 42.5;
    simX = 4.0;
    simY = 4.0;
    simVx = 1.0;
    simVy = 0.5;
  }

  // Notify backend API if running locally
  try {
    fetch('http://localhost:5000/api/test-scenario', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scenario }),
    }).catch(() => {});
  } catch (e) {}
}

export function generateTestTelemetry(scenario: TestScenarioName = activeScenario): ESP32Telemetry {
  const noise = (scale: number) => (Math.random() - 0.5) * scale;
  const t = Date.now();
  const dt = 0.05; // 50ms tick rate

  let roll = 0, pitch = 0, yaw = 0;
  let ax = 0, ay = 0, az = 9.81;
  let gx = 0, gy = 0, gz = 0;
  let alt = simAlt;
  let bat = +(11.4 + noise(0.1)).toFixed(2);
  let rssi = -58; // dBm

  switch (scenario) {
    case 'HIGH_ACCELERATION':
      // High forward acceleration & speed breakout maneuver
      simRoll = clamp(simRoll + noise(1.0), 10, 20);
      simPitch = clamp(simPitch + noise(1.0), -30, -20);
      simYaw = (simYaw + noise(1.0) + 360) % 360;
      simAlt = clamp(simAlt + 0.1, 10, 100);

      // Accelerate forward speed Vx dynamically up to 24 m/s
      simVx = clamp(simVx + 4.5 * dt, 1.0, 24.0);
      simVy = clamp(simVy - 2.0 * dt, -12.0, 2.0);
      simX = simX + simVx * dt;
      simY = simY + simVy * dt;

      roll = +simRoll.toFixed(2);
      pitch = +simPitch.toFixed(2);
      yaw = +simYaw.toFixed(2);
      alt = +simAlt.toFixed(1);

      // Body accel = gravity projection + linear thrust acceleration vector
      ax = +(-9.81 * Math.sin((pitch * Math.PI) / 180) + 18.0 + noise(3.0)).toFixed(2);
      ay = +(9.81 * Math.sin((roll * Math.PI) / 180) * Math.cos((pitch * Math.PI) / 180) - 12.0 + noise(2.5)).toFixed(2);
      az = +(9.81 * Math.cos((roll * Math.PI) / 180) * Math.cos((pitch * Math.PI) / 180) + 18.0 + noise(4.0)).toFixed(2);

      gx = +(35.0 + noise(12.0)).toFixed(2);
      gy = +(-55.0 + noise(15.0)).toFixed(2);
      gz = +(25.0 + noise(10.0)).toFixed(2);
      break;

    case 'HIGH_ANGULAR_VELOCITY':
      // Extreme rotational spin rates (gx ~ 260 deg/s, gy ~ -210 deg/s, gz ~ 340 deg/s)
      gx = +(260.0 + noise(40.0)).toFixed(2);
      gy = +(-210.0 + noise(35.0)).toFixed(2);
      gz = +(340.0 + noise(50.0)).toFixed(2);

      // Update Euler orientation angles continuously from gyro rates!
      simRoll = (simRoll + gx * dt + 360) % 360;
      simPitch = clamp(simPitch + gy * dt, -80, 80);
      simYaw = (simYaw + gz * dt + 360) % 360;

      simVx = 12.0 * Math.cos((simYaw * Math.PI) / 180);
      simVy = 12.0 * Math.sin((simYaw * Math.PI) / 180);
      simX = simX + simVx * dt;
      simY = simY + simVy * dt;

      roll = +(simRoll > 180 ? simRoll - 360 : simRoll).toFixed(2);
      pitch = +simPitch.toFixed(2);
      yaw = +simYaw.toFixed(2);

      // Accel reflects rotating gravity vector + centripetal force
      ax = +(-9.81 * Math.sin((pitch * Math.PI) / 180) + noise(2.0)).toFixed(2);
      ay = +(9.81 * Math.sin((roll * Math.PI) / 180) * Math.cos((pitch * Math.PI) / 180) + noise(2.0)).toFixed(2);
      az = +(9.81 * Math.cos((roll * Math.PI) / 180) * Math.cos((pitch * Math.PI) / 180) + noise(2.5)).toFixed(2);
      break;

    case 'SUDDEN_PITCH_CHANGE':
      // Sudden steep pitch up maneuver (pitch ~ 68 deg)
      if (simPitch < 65) {
        simPitch = Math.min(68, simPitch + 12.0);
        gy = +(210.0 + noise(20.0)).toFixed(2);
      } else {
        simPitch = clamp(68 + noise(3.0), 55, 75);
        gy = +(noise(15.0)).toFixed(2);
      }
      simRoll = clamp(simRoll + noise(2.0), -25, 25);
      simYaw = (simYaw + noise(1.0) + 360) % 360;

      simVx = clamp(simVx - 6.0 * dt, -8.0, 5.0);
      simX = simX + simVx * dt;

      roll = +simRoll.toFixed(2);
      pitch = +simPitch.toFixed(2);
      yaw = +simYaw.toFixed(2);
      gx = +(noise(10.0)).toFixed(2);
      gz = +(noise(12.0)).toFixed(2);

      ax = +(-9.81 * Math.sin((pitch * Math.PI) / 180) + noise(1.5)).toFixed(2);
      ay = +(9.81 * Math.sin((roll * Math.PI) / 180) * Math.cos((pitch * Math.PI) / 180) + noise(1.5)).toFixed(2);
      az = +(9.81 * Math.cos((roll * Math.PI) / 180) * Math.cos((pitch * Math.PI) / 180) + noise(1.5)).toFixed(2);
      break;

    case 'ALTITUDE_DROP':
      // Rapid descent / loss of lift (-6.5 m/s drop rate = -0.325 m per 50ms tick)
      simAlt = Math.max(8.0, simAlt - 0.325);
      alt = +simAlt.toFixed(1);

      simRoll = clamp(simRoll + noise(2.0), -15, 15);
      simPitch = clamp(simPitch + noise(2.0), -20, 10);
      simYaw = (simYaw + noise(1.0) + 360) % 360;

      simX = simX + noise(0.2);
      simY = simY + noise(0.2);

      roll = +simRoll.toFixed(2);
      pitch = +simPitch.toFixed(2);
      yaw = +simYaw.toFixed(2);

      // Freefall / reduced gravity component (az drops below 9.81)
      ax = +(-9.81 * Math.sin((pitch * Math.PI) / 180) + noise(0.8)).toFixed(2);
      ay = +(9.81 * Math.sin((roll * Math.PI) / 180) * Math.cos((pitch * Math.PI) / 180) + noise(0.8)).toFixed(2);
      az = +(2.2 + noise(1.0)).toFixed(2);

      gx = +(noise(25.0)).toFixed(2);
      gy = +(noise(25.0)).toFixed(2);
      gz = +(noise(25.0)).toFixed(2);
      break;

    case 'POSSIBLE_CRASH':
      // Severe multi-axis accel impact (>60 m/s^2), extreme gyros (>750 deg/s)
      ax = +(36.5 + noise(12.0)).toFixed(2);
      ay = +(-31.0 + noise(10.0)).toFixed(2);
      az = +(44.0 + noise(15.0)).toFixed(2);
      gx = +(520.0 + noise(180.0)).toFixed(2);
      gy = +(-420.0 + noise(150.0)).toFixed(2);
      gz = +(480.0 + noise(160.0)).toFixed(2);

      simRoll = (simRoll + gx * dt + 360) % 360;
      simPitch = clamp(simPitch + gy * dt, -85, 85);
      simYaw = (simYaw + gz * dt + 360) % 360;

      simX = simX + noise(1.5);
      simY = simY + noise(1.5);

      roll = +(simRoll > 180 ? simRoll - 360 : simRoll).toFixed(2);
      pitch = +simPitch.toFixed(2);
      yaw = +simYaw.toFixed(2);

      simAlt = Math.max(2.0, simAlt - 0.425); // -8.5 m/s drop
      alt = +simAlt.toFixed(1);
      bat = 9.6;
      rssi = -88;
      break;

    case 'NORMAL':
    default:
      // Smooth nominal flight
      simRoll = clamp(simRoll + noise(1.2), -15, 15);
      simPitch = clamp(simPitch + noise(1.0), -12, 12);
      simYaw = (simYaw + noise(1.5) + 0.5 + 360) % 360;
      simAlt = clamp(simAlt + noise(0.1), 35, 60);

      simVx = clamp(simVx + (-9.81 * Math.sin((pitch * Math.PI) / 180) * 0.4 + noise(0.08)) * dt, -2.5, 2.5);
      simVy = clamp(simVy + (9.81 * Math.sin((roll * Math.PI) / 180) * 0.4 + noise(0.08)) * dt, -2.5, 2.5);
      simX = clamp(simX + simVx * dt, -35, 35);
      simY = clamp(simY + simVy * dt, -35, 35);

      roll = +simRoll.toFixed(2);
      pitch = +simPitch.toFixed(2);
      yaw = +simYaw.toFixed(2);
      alt = +simAlt.toFixed(1);

      // Exact gravity projection
      ax = +(-9.81 * Math.sin((pitch * Math.PI) / 180) + noise(0.08)).toFixed(2);
      ay = +(9.81 * Math.sin((roll * Math.PI) / 180) * Math.cos((pitch * Math.PI) / 180) + noise(0.08)).toFixed(2);
      az = +(9.81 * Math.cos((roll * Math.PI) / 180) * Math.cos((pitch * Math.PI) / 180) + noise(0.08)).toFixed(2);

      gx = +(noise(3.0)).toFixed(2);
      gy = +(noise(3.0)).toFixed(2);
      gz = +(noise(3.0)).toFixed(2);
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

  let currentWsStatus = { wsConnected: false, esp32Connected: false, message: '' };

  function notifyStatusChange(wsConnected: boolean, esp32Connected: boolean, message: string) {
    if (
      currentWsStatus.wsConnected !== wsConnected ||
      currentWsStatus.esp32Connected !== esp32Connected ||
      currentWsStatus.message !== message
    ) {
      currentWsStatus = { wsConnected, esp32Connected, message };
      options.onStatusChange(currentWsStatus);
    }
  }

  const browserHost = typeof window !== 'undefined' ? (window.location.hostname || 'localhost') : 'localhost';
  const effectiveHost = (options.host && options.host !== '192.168.43.20' && options.host !== '192.168.43.1') ? options.host : browserHost;
  const wsUrl = `ws://${effectiveHost}:${options.wsPort}`;
  console.log(`[Telemetry Service] Connecting to WebSocket server at ${wsUrl}`);

  let hasWsTelemetry = false;

  try {
    const ws = new WebSocket(wsUrl);
    activeWs = ws;

    ws.onopen = () => {
      console.log(`[Telemetry Service] WebSocket connected to ${wsUrl}`);
      notifyStatusChange(true, activeScenario !== 'NONE', activeScenario !== 'NONE' ? `Test Scenario Active: ${activeScenario}` : 'WebSocket Connected');
    };

    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.type === 'TELEMETRY' && payload.telemetry) {
          hasWsTelemetry = true;
          notifyStatusChange(true, true, 'Live ESP32 Telemetry Receiving');
          if (activeScenario === 'NONE') {
            options.onTelemetry(payload.telemetry, 'WEBSOCKET');
          }
        } else if (payload.type === 'STATUS_UPDATE') {
          notifyStatusChange(
            true,
            activeScenario !== 'NONE' ? true : payload.esp32Connected,
            activeScenario !== 'NONE' ? `Test Scenario Active (${activeScenario})` : (payload.message || 'Status Update')
          );
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
      notifyStatusChange(false, activeScenario !== 'NONE', activeScenario !== 'NONE' ? `Test Scenario Active (${activeScenario})` : 'Awaiting Hardware ESP32 Connection');

      reconnectTimer = setTimeout(() => {
        connectTelemetryClient(options);
      }, 3000);
    };
  } catch (err) {
    console.error('[Telemetry Service] Failed to create WebSocket client:', err);
  }

  // Generate test packets whenever user manually selects a test scenario (NOT 'NONE')
  simTimer = setInterval(() => {
    if (activeScenario !== 'NONE') {
      notifyStatusChange(true, true, `Test Scenario Active (${activeScenario})`);
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
