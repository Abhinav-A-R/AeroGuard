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
}

export const DEFAULT_SETTINGS: SystemSettings = {
  laptopIp: '192.168.43.20',
  backendPort: 5000,
  wsPort: 5001,
  samplingHz: 20,
  imuRate: 50,
  logHz: 20,
  graphRate: 200,
  storage: 'C:\\AeroGuard\\Logs',
  esp32Connected: true,
};

const SETTINGS_KEY = 'aeroguard_system_settings';

export function loadSettings(): SystemSettings {
  try {
    const saved = localStorage.getItem(SETTINGS_KEY);
    if (saved) {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
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
