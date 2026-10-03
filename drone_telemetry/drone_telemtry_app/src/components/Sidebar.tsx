import type { Page } from '../types/navigation';

interface SidebarProps {
  currentPage: Page;
  onNavigate: (page: Page) => void;
  esp32Connected: boolean;
  wsConnected: boolean;
  packetRateHz: number;
  theme?: 'dark' | 'light';
}

const NAV_ITEMS: { id: Page; label: string; icon: string; category?: string }[] = [
  { id: 'dashboard', label: 'Overview', icon: '📊', category: 'MONITORING' },
  { id: 'monitoring', label: 'Live Stream', icon: '📡', category: 'MONITORING' },
  { id: 'telemetry', label: 'Telemetry', icon: '⚙️', category: 'MONITORING' },
  { id: 'network', label: 'Network / Bridge', icon: '🌐', category: 'SYSTEM' },
  { id: 'alerts', label: 'Alert Center', icon: '🚨', category: 'SYSTEM' },
  { id: 'health', label: 'System Health', icon: '💚', category: 'SYSTEM' },
  { id: 'logger', label: 'Data Logger', icon: '📁', category: 'DATA' },
  { id: 'settings', label: 'Settings', icon: '🔧', category: 'DATA' },
];

export default function Sidebar({
  currentPage,
  onNavigate,
  esp32Connected,
  wsConnected,
  packetRateHz,
  theme = 'dark',
}: SidebarProps) {
  const isLight = theme === 'light';

  return (
    <aside className={`w-60 border-r flex flex-col justify-between select-none flex-shrink-0 transition-colors ${
      isLight ? 'bg-white border-slate-200 text-slate-900' : 'bg-[#090d16] border-slate-800 text-slate-100'
    }`}>
      
      {/* Brand & Wordmark */}
      <div className={`p-4 border-b ${isLight ? 'border-slate-200' : 'border-slate-800'}`}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-sky-950 border border-sky-500/50 flex items-center justify-center text-sky-400 font-mono font-bold text-sm shadow-sm">
            AG
          </div>
          <div className="flex flex-col">
            <span className={`font-mono text-sm font-bold tracking-widest uppercase leading-none ${
              isLight ? 'text-slate-900' : 'text-slate-100'
            }`}>AERO GUARD</span>
            <span className="font-mono text-[9px] text-sky-500 font-semibold tracking-wider mt-0.5">UAV TELEMETRY PLATFORM</span>
          </div>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 py-3 px-2 overflow-y-auto space-y-4">
        {['MONITORING', 'SYSTEM', 'DATA'].map((cat) => {
          const items = NAV_ITEMS.filter(i => i.category === cat);
          return (
            <div key={cat} className="space-y-1">
              <div className={`px-3 font-mono text-[9px] font-bold tracking-widest uppercase mb-1 ${
                isLight ? 'text-slate-400' : 'text-slate-500'
              }`}>
                {cat}
              </div>
              {items.map(({ id, label, icon }) => {
                const active = currentPage === id;
                return (
                  <button
                    key={id}
                    onClick={() => onNavigate(id)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded text-xs font-mono tracking-wide transition-all ${
                      active
                        ? isLight 
                          ? 'bg-sky-50 border border-sky-300 text-sky-700 font-bold shadow-sm'
                          : 'bg-sky-950/60 border border-sky-500/40 text-sky-300 font-bold shadow-sm'
                        : isLight
                          ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-transparent'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60 border border-transparent'
                    }`}
                  >
                    <span className="text-sm opacity-80">{icon}</span>
                    <span>{label}</span>
                  </button>
                );
              })}
            </div>
          );
        })}
      </nav>

      {/* Footer System Status & User Section */}
      <div className={`p-3 border-t space-y-3 ${
        isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#060910] border-slate-800'
      }`}>
        {/* Real-time Connection Matrix */}
        <div className={`p-2 rounded border space-y-1.5 font-mono text-[10px] ${
          isLight ? 'bg-white border-slate-200' : 'bg-slate-900/80 border-slate-800'
        }`}>
          <div className={`flex items-center justify-between ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
            <span>LINK STATE:</span>
            <span className={esp32Connected ? 'text-emerald-600 font-bold' : 'text-amber-600 font-bold'}>
              {esp32Connected ? 'HARDWARE LIVE' : 'STANDBY'}
            </span>
          </div>
          <div className={`flex items-center justify-between ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
            <span>WS BRIDGE:</span>
            <span className={wsConnected ? 'text-emerald-600 font-bold' : 'text-rose-600 font-bold'}>
              {wsConnected ? ':5001 ACTIVE' : 'OFFLINE'}
            </span>
          </div>
          <div className={`flex items-center justify-between ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
            <span>STREAM RATE:</span>
            <span className="text-sky-600 font-bold">{packetRateHz} Hz</span>
          </div>
        </div>

        {/* User Profile / Station Info */}
        <div className="flex items-center gap-2.5 pt-1">
          <div className={`w-7 h-7 rounded-full border flex items-center justify-center font-mono text-xs font-bold ${
            isLight ? 'bg-slate-200 border-slate-300 text-slate-700' : 'bg-slate-800 border-slate-700 text-slate-300'
          }`}>
            OP
          </div>
          <div className="flex flex-col min-w-0">
            <span className={`font-mono text-xs font-semibold truncate ${
              isLight ? 'text-slate-800' : 'text-slate-200'
            }`}>GCS OPERATOR</span>
            <span className={`font-mono text-[9px] truncate ${
              isLight ? 'text-slate-500' : 'text-slate-500'
            }`}>STATION-01 · LOCAL</span>
          </div>
        </div>
      </div>

    </aside>
  );
}
