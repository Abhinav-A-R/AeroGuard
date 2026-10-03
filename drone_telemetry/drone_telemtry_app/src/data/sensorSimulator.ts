export interface SensorReading {
  timestamp: number;
  accelX: number;
  accelY: number;
  accelZ: number;
  gyroX: number;
  gyroY: number;
  gyroZ: number;
  roll: number;
  pitch: number;
  yaw: number;
  batteryVoltage: number;
  latency: number;
  esp32Status: string;
  stm32Status: string;
}

let _yaw = 0;
let _roll = 0;
let _pitch = 0;

export function generateReading(prev?: SensorReading): SensorReading {
  const t = Date.now();
  const noise = (scale: number) => (Math.random() - 0.5) * scale;

  _roll = clamp(_roll + noise(2.5), -45, 45);
  _pitch = clamp(_pitch + noise(2), -30, 30);
  _yaw = (_yaw + noise(3) + 0.5 + 360) % 360;

  const accelX = _roll * 0.02 + noise(0.08);
  const accelY = _pitch * 0.015 + noise(0.06);
  const accelZ = 9.81 + noise(0.1);

  return {
    timestamp: t,
    accelX: +accelX.toFixed(4),
    accelY: +accelY.toFixed(4),
    accelZ: +accelZ.toFixed(4),
    gyroX: +(_roll * 0.3 + noise(5)).toFixed(3),
    gyroY: +(_pitch * 0.3 + noise(4)).toFixed(3),
    gyroZ: +(noise(8)).toFixed(3),
    roll: +_roll.toFixed(2),
    pitch: +_pitch.toFixed(2),
    yaw: +_yaw.toFixed(2),
    batteryVoltage: +(11.4 + noise(0.3)).toFixed(2),
    latency: +(8 + Math.random() * 12).toFixed(1),
    esp32Status: 'CONNECTED',
    stm32Status: 'CONNECTED',
  };
}

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

export function generateHistoricalData(count: number): SensorReading[] {
  const data: SensorReading[] = [];
  const now = Date.now();
  for (let i = count; i >= 0; i--) {
    const reading = generateReading(data[data.length - 1]);
    reading.timestamp = now - i * 200;
    data.push(reading);
  }
  return data;
}

export const INITIAL_HISTORY = generateHistoricalData(150);

