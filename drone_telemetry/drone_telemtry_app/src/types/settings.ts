export interface SystemSettings {
  laptopIp: string;
  backendPort: number;
  wsPort: number;
  samplingHz: number;
  imuRate: number;
  logHz: number;
  graphRate: number;
  storage: string;
  esp32Connected: boolean;
  stm32Connected?: boolean;
  esp32Port?: string;
  stm32Port?: string;
  baud?: string;
  audioMuted: boolean;
  theme: 'dark' | 'light';
}

export const DEFAULT_SETTINGS: SystemSettings = {
  laptopIp: typeof window !== 'undefined' ? (window.location.hostname || 'localhost') : 'localhost',
  backendPort: 5000,
  wsPort: 5001,
  samplingHz: 20,
  imuRate: 50,
  logHz: 20,
  graphRate: 200,
  storage: 'C:\\AeroGuard\\Logs',
  esp32Connected: true,
  stm32Connected: true,
  esp32Port: 'COM3',
  stm32Port: 'COM7',
  baud: '115200',
  audioMuted: false,
  theme: 'dark',
};

const SETTINGS_KEY = 'aeroguard_system_settings';

export function loadSettings(): SystemSettings {
  try {
    const saved = localStorage.getItem(SETTINGS_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.laptopIp === '192.168.43.20' || parsed.laptopIp === '192.168.43.1') {
        parsed.laptopIp = typeof window !== 'undefined' ? (window.location.hostname || 'localhost') : 'localhost';
      }
      return { ...DEFAULT_SETTINGS, ...parsed };
    }
  } catch (e) {
    console.error('Failed to load settings from localStorage', e);
  }
  return DEFAULT_SETTINGS;
}

export function saveSettingsToStorage(settings: SystemSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (e) {
    console.error('Failed to save settings to localStorage', e);
  }
}
