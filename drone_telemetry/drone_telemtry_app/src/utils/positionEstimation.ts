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
  refAlt: number | null; // Initial Reference Altitude (meters)
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
  refAlt: null,
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
        relXCm: Math.round(state.x * 100),
        relYCm: Math.round(state.y * 100),
        relZCm: Math.round(state.z * 100),
        distanceFromLaptop: +distanceFromLaptop.toFixed(2),
        distanceFromLaptopCm: Math.round(distanceFromLaptop * 100),
        groundDistance: +groundDistance.toFixed(2),
        groundDistanceCm: Math.round(groundDistance * 100),
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

  // Net accelerations in world frame
  const netAx = axW;
  const netAy = ayW;
  const netAz = azW - 9.81;

  // Vibration Deadband Check for Micro-Drones (DM002)
  // When sitting on desk or holding flat with motor vibration:
  // - Small tilt angles (< 3.5°) are motor vibration / IMU sensor jitter, NOT intentional velocity vectors.
  // - Small net horizontal accelerations (< 0.4 m/s²) are motor vibration noise.
  const absPitch = Math.abs(telemetry.pitch);
  const absRoll = Math.abs(telemetry.roll);
  const isLowTilt = absPitch < 3.5 && absRoll < 3.5;
  const netHorizontalAccel = Math.sqrt(netAx * netAx + netAy * netAy);
  const isLowAccel = netHorizontalAccel < 0.4;

  const gyroMag = Math.sqrt(telemetry.gx ** 2 + telemetry.gy ** 2 + telemetry.gz ** 2);

  // Reference Altitude tracking for relative height calculations
  let refAlt = state.refAlt === null ? telemetry.altitude : state.refAlt;
  let rawRelZ = telemetry.altitude - refAlt;

  // At Rest / Stationary Altitude Deadband Filter:
  // Barometric pressure sensors naturally bounce by +/-0.1m to +/-0.3m due to thermal noise & air drafts.
  // When sitting at rest (low tilt, low gyro), adjust refAlt smoothly and clamp rawRelZ so relZ stays 0.00m at rest!
  if (isLowTilt && gyroMag < 15.0 && Math.abs(rawRelZ) < 0.25) {
    refAlt = refAlt * 0.95 + telemetry.altitude * 0.05; // Continuously calibrate baseline at rest
    rawRelZ = 0; // Lock Z displacement at 0 when resting near ground/desk
  }

  const relZ = +(rawRelZ).toFixed(2);

  const pitchRad = (telemetry.pitch * Math.PI) / 180;
  const rollRad = (telemetry.roll * Math.PI) / 180;

  let targetVx = -9.81 * Math.sin(pitchRad) * 0.5;
  let targetVy = 9.81 * Math.sin(rollRad) * Math.cos(pitchRad) * 0.5;

  if (isLowTilt) {
    targetVx = 0;
    targetVy = 0;
  }

  let vx = state.vx * 0.85 + (netAx * validDt + targetVx) * 0.15;
  let vy = state.vy * 0.85 + (netAy * validDt + targetVy) * 0.15;
  let vz = state.vz * 0.85 + (netAz * validDt) * 0.15;

  // Apply vibration deadband filter: if tilt is low and horizontal accel is low, zero velocity
  if (isLowTilt && isLowAccel) {
    vx = 0;
    vy = 0;
  }

  // Filter out tiny noise jitter (< 0.02 m/s) to prevent distance bounce
  if (Math.abs(vx) < 0.02) vx = 0;
  if (Math.abs(vy) < 0.02) vy = 0;
  if (Math.abs(vz) < 0.02) vz = 0;

  // Zero Velocity Update (ZUPT) stationary detection tuned for micro drones with motor vibrations
  const isStationary = Math.abs(relZ) < 0.25 && isLowTilt && gyroMag < 15.0;

  let stationaryTime = state.stationaryTime;
  let driftTimer = state.driftTimer + validDt;

  if (isStationary) {
    stationaryTime += validDt;
    if (stationaryTime > 0.15) {
      vx = 0;
      vy = 0;
      vz = 0;
      driftTimer = 0;
    }
  } else {
    stationaryTime = 0;
  }

  // Integrate velocity to displacement with Bounded Leaky Kinematic Integrator (BKTD algorithm)
  // Bounding integration with a 0.985 decay factor prevents unconstrained runaway distance growth
  let x = (state.x + vx * validDt) * 0.985;
  let y = (state.y + vy * validDt) * 0.985;

  // Snap small residual x, y drift (< 0.20m) to 0.00 when stationary or when vibration deadband zeroed velocity
  if (isStationary || (vx === 0 && vy === 0)) {
    if (Math.abs(x) < 0.20) x = 0;
    if (Math.abs(y) < 0.20) y = 0;
  }

  const z = relZ;

  // Compute Drone Approximate GPS Coordinates in real time
  const { droneLat, droneLon } = calculateDroneGpsCoordinates(state.refLat, state.refLon, x, y);

  // Direct 3D distance from laptop (meters & centimeters)
  const distanceFromLaptop = Math.sqrt(x * x + y * y + relZ * relZ);
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
    refAlt,
    stationaryTime,
    driftTimer,
  };

  const estimate: PositionEstimate = {
    droneLat,
    droneLon,
    relX: +x.toFixed(2),
    relY: +y.toFixed(2),
    relZ: +relZ.toFixed(2),
    relXCm: Math.round(x * 100),
    relYCm: Math.round(y * 100),
    relZCm: Math.round(relZ * 100),
    distanceFromLaptop: +distanceFromLaptop.toFixed(2),
    distanceFromLaptopCm: Math.round(distanceFromLaptop * 100),
    groundDistance: +groundDistance.toFixed(2),
    groundDistanceCm: Math.round(groundDistance * 100),
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
