export interface ESP32Telemetry {
  timestamp: number;     // Unix timestamp in seconds or epoch ms
  roll: number;          // Orientation Roll (deg)
  pitch: number;         // Orientation Pitch (deg)
  yaw: number;           // Orientation Yaw (deg)
  ax: number;            // Accel X (m/s^2)
  ay: number;            // Accel Y (m/s^2)
  az: number;            // Accel Z (m/s^2)
  gx: number;            // Gyro X (deg/s)
  gy: number;            // Gyro Y (deg/s)
  gz: number;            // Gyro Z (deg/s)
  temperature: number;   // Temperature (deg C)
  pressure: number;      // Atmospheric Pressure (hPa)
  altitude: number;      // Altitude (m)
  battery: number;       // Battery Voltage (V)
  rssi?: number;         // Wi-Fi Signal Strength in dBm (e.g. -55 dBm)
}

import type { MLPredictionResult } from '../utils/mlCrashModel';

export type CrashRiskLevel = 'NORMAL' | 'LOW RISK' | 'MEDIUM RISK' | 'HIGH RISK' | 'CRITICAL';

export interface CrashRiskStatus {
  level: CrashRiskLevel;
  score: number;             // 0 to 100 risk score
  motionState: 'USUAL MOTION' | 'UNUSUAL MOTION' | 'STANDBY';
  crashPrediction: 'SAFE (NO CRASH PREDICTED)' | 'WARNING (UNUSUAL MOTION)' | 'WILL CRASH (CRITICAL IMPACT)' | 'STANDBY';
  willCrash: boolean;
  reasons: string[];         // Human-readable triggers (e.g. "High acceleration spike")
  accelMag: number;          // Acceleration magnitude (m/s^2)
  gyroMag: number;           // Angular velocity magnitude (deg/s)
  jerk: number;              // Rate of change of acceleration (m/s^3)
  altRate: number;           // Rate of change of altitude (m/s)
  mlPrediction?: MLPredictionResult; // High-speed Machine Learning Inference & AI Agent Result
}

export interface PositionEstimate {
  droneLat: number;          // Derived Drone Latitude (deg)
  droneLon: number;          // Derived Drone Longitude (deg)
  relX: number;              // Displacement X (m, East)
  relY: number;              // Displacement Y (m, North)
  relZ: number;              // Displacement Z / Altitude (m, Up)
  distanceFromLaptop: number;// Direct 3D distance from laptop (m)
  groundDistance: number;    // 2D horizontal ground distance (m)
  wifiDistance: number;      // Wi-Fi RSSI path-loss distance estimate (m)
  vx: number;                // Velocity X (m/s)
  vy: number;                // Velocity Y (m/s)
  vz: number;                // Velocity Z (m/s)
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  source: 'INERTIAL + LAPTOP GPS';
  refType: 'Laptop Geolocation' | 'Manual Reference' | 'Default Reference';
  refLat: number;            // Laptop Reference Latitude
  refLon: number;            // Laptop Reference Longitude
  driftWarning: boolean;
  driftSeconds: number;
}

export interface SensorCalibration {
  isCalibrated: boolean;
  axBias: number;
  ayBias: number;
  azBias: number;
  gxBias: number;
  gyBias: number;
  gzBias: number;
  sampleCount: number;
}

export interface SystemStatus {
  hasReceivedData: boolean;   // True ONLY when real telemetry packets have been received
  esp32Connected: boolean;
  wsConnected: boolean;
  backendConnected: boolean;
  lastPacketMsAgo: number;
  packetRateHz: number;
  totalPackets: number;
  mode: 'LIVE ESP32' | 'AWAITING TELEMETRY' | 'TEST SCENARIO';
  activeScenario?: string;
}

export interface ProcessedTelemetry {
  raw: ESP32Telemetry | null;
  serverTimestamp: number;
  dt: number;
  calibrated: {
    ax: number;
    ay: number;
    az: number;
    gx: number;
    gy: number;
    gz: number;
  } | null;
  orientation: {
    roll: number;
    pitch: number;
    yaw: number;
  } | null;
  crashRisk: CrashRiskStatus | null;
  position: PositionEstimate;
  calibration: SensorCalibration;
  status: SystemStatus;
}
