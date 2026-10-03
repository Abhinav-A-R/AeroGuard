import type { ESP32Telemetry, CrashRiskStatus, CrashRiskLevel } from '../types/telemetry';

export function calculateAccelerationMagnitude(ax: number, ay: number, az: number): number {
  return Math.sqrt(ax * ax + ay * ay + az * az);
}

export function calculateAngularVelocityMagnitude(gx: number, gy: number, gz: number): number {
  return Math.sqrt(gx * gx + gy * gy + gz * gz);
}

export function calculateJerk(currMag: number, prevMag: number, dt: number): number {
  if (dt <= 0 || dt > 2.0) return 0;
  return Math.abs(currMag - prevMag) / dt;
}

export function detectOrientationAnomaly(roll: number, pitch: number): { isAnomaly: boolean; reason?: string } {
  const absRoll = Math.abs(roll);
  const absPitch = Math.abs(pitch);
  if (absRoll > 65 || absPitch > 55) {
    return { isAnomaly: true, reason: `Excessive tilt angle (Roll: ${roll.toFixed(1)}°, Pitch: ${pitch.toFixed(1)}°)` };
  }
  return { isAnomaly: false };
}

export function detectAltitudeAnomaly(currAlt: number, prevAlt: number, dt: number): { isAnomaly: boolean; rate: number; reason?: string } {
  if (dt <= 0 || dt > 2.0) return { isAnomaly: false, rate: 0 };
  const altRate = (currAlt - prevAlt) / dt;
  if (altRate < -6.0) { // Rapid descent / freefall
    return { isAnomaly: true, rate: altRate, reason: `Rapid altitude drop (${altRate.toFixed(1)} m/s)` };
  }
  return { isAnomaly: false, rate: altRate };
}

export function detectTelemetryAnomaly(dt: number): { isAnomaly: boolean; reason?: string } {
  if (dt > 1.5) {
    return { isAnomaly: true, reason: `Telemetry dropout / latency gap (${(dt * 1000).toFixed(0)} ms)` };
  }
  return { isAnomaly: false };
}

/**
 * Modular crash risk calculator based on multi-indicator physical metrics.
 * Designed to be replaced with a trained ML classifier function predictCrashRisk(telemetry) later.
 */
export function predictCrashRisk(curr: ESP32Telemetry, prev?: ESP32Telemetry, dt: number = 0.05): CrashRiskStatus {
  const accelMag = calculateAccelerationMagnitude(curr.ax, curr.ay, curr.az);
  const gyroMag = calculateAngularVelocityMagnitude(curr.gx, curr.gy, curr.gz);
  
  const prevAccelMag = prev ? calculateAccelerationMagnitude(prev.ax, prev.ay, prev.az) : accelMag;
  const jerk = calculateJerk(accelMag, prevAccelMag, dt);

  const prevAlt = prev ? prev.altitude : curr.altitude;
  const altAnomaly = detectAltitudeAnomaly(curr.altitude, prevAlt, dt);
  const orientAnomaly = detectOrientationAnomaly(curr.roll, curr.pitch);
  const telemAnomaly = detectTelemetryAnomaly(dt);

  const reasons: string[] = [];
  let score = 0;

  // 1. Acceleration Spikes (> 2.5G = 24.5 m/s^2)
  if (accelMag > 28.0) {
    score += 40;
    reasons.push(`Severe acceleration impact (${accelMag.toFixed(1)} m/s²)`);
  } else if (accelMag > 20.0) {
    score += 20;
    reasons.push(`High acceleration spike (${accelMag.toFixed(1)} m/s²)`);
  }

  // 2. High Jerk (sudden impulse)
  if (jerk > 60.0) {
    score += 20;
    reasons.push(`Sudden impulse / high jerk (${jerk.toFixed(1)} m/s³)`);
  }

  // 3. Angular Velocity Spikes (> 250 deg/s)
  if (gyroMag > 300.0) {
    score += 35;
    reasons.push(`Extreme rotational spin rate (${gyroMag.toFixed(0)} °/s)`);
  } else if (gyroMag > 180.0) {
    score += 15;
    reasons.push(`High angular velocity (${gyroMag.toFixed(0)} °/s)`);
  }

  // 4. Abnormal Orientation / Extreme Tilt
  if (orientAnomaly.isAnomaly && orientAnomaly.reason) {
    score += 25;
    reasons.push(orientAnomaly.reason);
  }

  // 5. Altitude Drop / Freefall
  if (altAnomaly.isAnomaly && altAnomaly.reason) {
    score += 25;
    reasons.push(altAnomaly.reason);
  }

  // 6. Telemetry Dropout
  if (telemAnomaly.isAnomaly && telemAnomaly.reason) {
    score += 15;
    reasons.push(telemAnomaly.reason);
  }

  // 7. Critical Low Battery (< 3.3V)
  if (curr.battery > 0 && curr.battery < 3.3) {
    score += 20;
    reasons.push(`Critical battery voltage warning (${curr.battery.toFixed(2)}V)`);
  }

  let level: CrashRiskLevel = 'NORMAL';
  let motionState: 'USUAL MOTION' | 'UNUSUAL MOTION' | 'STANDBY' = 'USUAL MOTION';
  let crashPrediction: 'SAFE (NO CRASH PREDICTED)' | 'WARNING (UNUSUAL MOTION)' | 'WILL CRASH (CRITICAL IMPACT)' | 'STANDBY' = 'SAFE (NO CRASH PREDICTED)';
  let willCrash = false;

  if (score >= 50) {
    level = 'CRITICAL';
    motionState = 'UNUSUAL MOTION';
    crashPrediction = 'WILL CRASH (CRITICAL IMPACT)';
    willCrash = true;
  } else if (score >= 35) {
    level = 'HIGH RISK';
    motionState = 'UNUSUAL MOTION';
    crashPrediction = 'WILL CRASH (CRITICAL IMPACT)';
    willCrash = true;
  } else if (score >= 20) {
    level = 'MEDIUM RISK';
    motionState = 'UNUSUAL MOTION';
    crashPrediction = 'WARNING (UNUSUAL MOTION)';
    willCrash = false;
  } else if (score >= 10) {
    level = 'LOW RISK';
    motionState = 'UNUSUAL MOTION';
    crashPrediction = 'WARNING (UNUSUAL MOTION)';
    willCrash = false;
  } else {
    level = 'NORMAL';
    motionState = 'USUAL MOTION';
    crashPrediction = 'SAFE (NO CRASH PREDICTED)';
    willCrash = false;
  }

  return {
    level,
    score: Math.min(100, score),
    motionState,
    crashPrediction,
    willCrash,
    reasons,
    accelMag: +accelMag.toFixed(2),
    gyroMag: +gyroMag.toFixed(2),
    jerk: +jerk.toFixed(2),
    altRate: +altAnomaly.rate.toFixed(2),
  };
}
