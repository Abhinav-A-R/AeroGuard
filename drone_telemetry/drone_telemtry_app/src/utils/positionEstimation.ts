import type { ESP32Telemetry, PositionEstimate } from '../types/telemetry';

export interface PositionEstimatorState {
  x: number;          // Relative displacement X (meters, East)
  y: number;          // Relative displacement Y (meters, North)
  z: number;          // Relative displacement Z (meters, Up)
  vx: number;         // Velocity X (m/s)
  vy: number;         // Velocity Y (m/s)
  vz: number;         // Velocity Z (m/s)
  refLat: number;     // Laptop Initial Reference Latitude (deg)
  refLon: number;     // Laptop Initial Reference Longitude (deg)
  refSource: 'Laptop Geolocation' | 'Manual Reference' | 'Default Reference';
  stationaryTime: number; // Time stationary for ZUPT
  driftTimer: number;     // Continuous integration seconds
}

export const INITIAL_POSITION_STATE: PositionEstimatorState = {
  x: 0,
  y: 0,
  z: 0,
  vx: 0,
  vy: 0,
  vz: 0,
  refLat: 28.6139,    // Default Laptop Geolocation Reference
  refLon: 77.2090,
  refSource: 'Default Reference',
  stationaryTime: 0,
  driftTimer: 0,
};

/**
 * Transforms Body-Frame Acceleration (ax, ay, az) into World-Frame Acceleration
 * using Roll, Pitch, and Yaw Euler angles (in radians).
 */
export function bodyToWorldFrame(
  ax: number,
  ay: number,
  az: number,
  rollDeg: number,
  pitchDeg: number,
  yawDeg: number
): { axW: number; ayW: number; azW: number } {
  const r = (rollDeg * Math.PI) / 180;
  const p = (pitchDeg * Math.PI) / 180;
  const y = (yawDeg * Math.PI) / 180;

  const cr = Math.cos(r), sr = Math.sin(r);
  const cp = Math.cos(p), sp = Math.sin(p);
  const cy = Math.cos(y), sy = Math.sin(y);

  // Rotation Matrix R = Rz(yaw) * Ry(pitch) * Rx(roll)
  const axW = (cy * cp) * ax + (cy * sp * sr - sy * cr) * ay + (cy * sp * cr + sy * sr) * az;
  const ayW = (sy * cp) * ax + (sy * sp * sr + cy * cr) * ay + (sy * sp * cr - cy * sr) * az;
  const azW = (-sp) * ax + (cp * sr) * ay + (cp * cr) * az;

  return { axW, ayW, azW };
}

/**
 * Calculates Drone's Approximate GPS Coordinates (Latitude, Longitude)
 * from Laptop Reference GPS Coordinates and local X, Y displacements in meters.
 */
export function calculateDroneGpsCoordinates(
  laptopLat: number,
  laptopLon: number,
  dxMeters: number,
  dyMeters: number
): { droneLat: number; droneLon: number } {
  // 1 degree latitude ~ 111,320 meters
  const deltaLat = dyMeters / 111320.0;
  // 1 degree longitude ~ 111,320 * cos(latitude) meters
  const radLat = (laptopLat * Math.PI) / 180.0;
  const deltaLon = dxMeters / (111320.0 * Math.cos(radLat) || 1.0);

  return {
    droneLat: +(laptopLat + deltaLat).toFixed(7),
    droneLon: +(laptopLon + deltaLon).toFixed(7),
  };
}

/**
 * Estimates distance from Laptop using Wi-Fi RSSI (Log-distance Path Loss Model)
 * d = 10^((A - RSSI) / (10 * n))
 * where A = -40 dBm (signal strength at 1m), n = 2.5 (path loss exponent)
 */
export function estimateDistanceLogPathLoss(rssi?: number): number {
  if (rssi === undefined || isNaN(rssi) || rssi >= 0) return 0;
  const txPower = -40; // Reference RSSI at 1 meter in dBm
  const pathLossExponent = 2.5; // Free-space / indoor obstacle exponent
  const ratio = (txPower - rssi) / (10 * pathLossExponent);
  const dist = Math.pow(10, ratio);
  return +dist.toFixed(1);
}

/**
 * Inertial Position Estimator with Zero Velocity Update (ZUPT) and GPS Projection.
 */
export function updatePositionEstimate(
  state: PositionEstimatorState,
  telemetry: ESP32Telemetry | null,
  dt: number
): { nextState: PositionEstimatorState; estimate: PositionEstimate } {
  if (!telemetry) {
    const { droneLat, droneLon } = calculateDroneGpsCoordinates(state.refLat, state.refLon, state.x, state.y);
    const distanceFromLaptop = Math.sqrt(state.x ** 2 + state.y ** 2 + state.z ** 2);
    const groundDistance = Math.sqrt(state.x ** 2 + state.y ** 2);
    
    return {
      nextState: state,
      estimate: {
        droneLat,
        droneLon,
        relX: +state.x.toFixed(2),
        relY: +state.y.toFixed(2),
        relZ: +state.z.toFixed(2),
        distanceFromLaptop: +distanceFromLaptop.toFixed(2),
        groundDistance: +groundDistance.toFixed(2),
        wifiDistance: 0,
        vx: +state.vx.toFixed(2),
        vy: +state.vy.toFixed(2),
        vz: +state.vz.toFixed(2),
        confidence: 'LOW',
        source: 'INERTIAL + LAPTOP GPS',
        refType: state.refSource,
        refLat: state.refLat,
        refLon: state.refLon,
        driftWarning: true,
        driftSeconds: +state.driftTimer.toFixed(0),
      }
    };
  }

  const validDt = isNaN(dt) || dt <= 0 || dt > 1.0 ? 0.05 : dt;

  // Transform accel from body to world frame
  const { axW, ayW, azW } = bodyToWorldFrame(
    telemetry.ax,
    telemetry.ay,
    telemetry.az,
    telemetry.roll,
    telemetry.pitch,
    telemetry.yaw
  );

  // Subtract gravity from World Z acceleration
  const netAx = axW;
  const netAy = ayW;
  const netAz = azW - 9.81;

  // Zero Velocity Update (ZUPT) stationary detection
  const accelMag = Math.sqrt(telemetry.ax ** 2 + telemetry.ay ** 2 + telemetry.az ** 2);
  const gyroMag = Math.sqrt(telemetry.gx ** 2 + telemetry.gy ** 2 + telemetry.gz ** 2);
  const isStationary = Math.abs(accelMag - 9.81) < 0.35 && gyroMag < 4.0;

  let vx = state.vx;
  let vy = state.vy;
  let vz = state.vz;
  let stationaryTime = state.stationaryTime;
  let driftTimer = state.driftTimer + validDt;

  if (isStationary) {
    stationaryTime += validDt;
    if (stationaryTime > 0.3) {
      // Reset velocity (ZUPT) to prevent unbounded drift
      vx = 0;
      vy = 0;
      vz = 0;
      driftTimer = 0;
    }
  } else {
    stationaryTime = 0;
    // Damped velocity integration (v = v0 + a * dt)
    const damping = 0.98;
    vx = (vx + netAx * validDt) * damping;
    vy = (vy + netAy * validDt) * damping;
    vz = (vz + netAz * validDt) * damping;
  }

  // Integrate velocity to displacement (x = x0 + v * dt)
  const x = state.x + vx * validDt;
  const y = state.y + vy * validDt;
  const z = telemetry.altitude !== undefined ? telemetry.altitude : state.z + vz * validDt;

  // Compute Drone Approximate GPS Coordinates
  const { droneLat, droneLon } = calculateDroneGpsCoordinates(state.refLat, state.refLon, x, y);

  // Direct 3D distance from laptop (meters)
  const distanceFromLaptop = Math.sqrt(x * x + y * y + z * z);
  const groundDistance = Math.sqrt(x * x + y * y);

  // Wi-Fi RSSI Distance Estimation
  const wifiDistance = estimateDistanceLogPathLoss(telemetry.rssi);

  // Determine Position Confidence & Drift Warnings
  let confidence: 'HIGH' | 'MEDIUM' | 'LOW' = 'HIGH';
  let driftWarning = false;

  if (driftTimer > 60 || Math.abs(x) > 500 || Math.abs(y) > 500) {
    confidence = 'LOW';
    driftWarning = true;
  } else if (driftTimer > 20 || Math.abs(x) > 150 || Math.abs(y) > 150) {
    confidence = 'MEDIUM';
  }

  const nextState: PositionEstimatorState = {
    ...state,
    x,
    y,
    z,
    vx,
    vy,
    vz,
    stationaryTime,
    driftTimer,
  };

  const estimate: PositionEstimate = {
    droneLat,
    droneLon,
    relX: +x.toFixed(2),
    relY: +y.toFixed(2),
    relZ: +z.toFixed(2),
    distanceFromLaptop: +distanceFromLaptop.toFixed(2),
    groundDistance: +groundDistance.toFixed(2),
    wifiDistance,
    vx: +vx.toFixed(2),
    vy: +vy.toFixed(2),
    vz: +vz.toFixed(2),
    confidence,
    source: 'INERTIAL + LAPTOP GPS',
    refType: state.refSource,
    refLat: state.refLat,
    refLon: state.refLon,
    driftWarning,
    driftSeconds: +driftTimer.toFixed(0),
  };

  return { nextState, estimate };
}
