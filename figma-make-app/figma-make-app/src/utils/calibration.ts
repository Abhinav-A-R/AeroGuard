import type { SensorCalibration, ESP32Telemetry } from '../types/telemetry';

const CALIBRATION_KEY = 'aeroguard_sensor_calibration';

export const DEFAULT_CALIBRATION: SensorCalibration = {
  isCalibrated: false,
  axBias: 0,
  ayBias: 0,
  azBias: 0,
  gxBias: 0,
  gyBias: 0,
  gzBias: 0,
  sampleCount: 0,
};

export function loadCalibrationFromStorage(): SensorCalibration {
  try {
    const saved = localStorage.getItem(CALIBRATION_KEY);
    if (saved) {
      return { ...DEFAULT_CALIBRATION, ...JSON.parse(saved) };
    }
  } catch (e) {
    console.error('Failed to load sensor calibration from storage', e);
  }
  return DEFAULT_CALIBRATION;
}

export function saveCalibrationToStorage(calib: SensorCalibration): void {
  try {
    localStorage.setItem(CALIBRATION_KEY, JSON.stringify(calib));
  } catch (e) {
    console.error('Failed to save sensor calibration to storage', e);
  }
}

export function applyCalibration(raw: ESP32Telemetry, calib: SensorCalibration) {
  if (!calib.isCalibrated) {
    return {
      ax: raw.ax,
      ay: raw.ay,
      az: raw.az,
      gx: raw.gx,
      gy: raw.gy,
      gz: raw.gz,
    };
  }

  return {
    ax: +(raw.ax - calib.axBias).toFixed(4),
    ay: +(raw.ay - calib.ayBias).toFixed(4),
    az: +(raw.az - calib.azBias).toFixed(4),
    gx: +(raw.gx - calib.gxBias).toFixed(4),
    gy: +(raw.gy - calib.gyBias).toFixed(4),
    gz: +(raw.gz - calib.gzBias).toFixed(4),
  };
}
