interface HomePageProps {
  onNavigate: (page: string) => void;
}

const nav = [
  { id: 'dashboard', label: 'Live Dashboard', icon: '⬛', desc: 'Real-time IMU data, graphs, and artificial horizon' },
  { id: 'logger', label: 'Start Data Logging', icon: '⬛', desc: 'Record and export sensor data to CSV/JSON/TXT' },
  { id: 'graphs', label: 'Sensor Data', icon: '⬛', desc: 'Configurable real-time and historical sensor graphs' },
  { id: 'session', label: 'Flight Sessions', icon: '⬛', desc: 'Manage and save complete flight test sessions' },
  { id: 'analysis', label: 'Data Analysis', icon: '⬛', desc: 'Post-flight log analysis with timeline playback' },
  { id: 'settings', label: 'System Settings', icon: '⬛', desc: 'Configure ports, rates, and storage locations' },
];

export default function HomePage({ onNavigate }: HomePageProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full px-12 py-10 select-none">
      {/* Architecture diagram */}
      <div className="mb-10 flex items-center gap-0 font-mono text-xs">
        {['MPU6050', 'ESP32', 'LAPTOP', 'STM32', 'LAPTOP'].map((node, i, arr) => (
          <div key={i} className="flex items-center">
            <div className={`px-3 py-1.5 border rounded text-center ${
              node === 'LAPTOP'
                ? 'border-[#0ea5e9] text-[#0ea5e9] bg-[#0ea5e9]/10'
                : node === 'ESP32'
                ? 'border-[#22c55e] text-[#22c55e] bg-[#22c55e]/10'
                : node === 'STM32'
                ? 'border-[#eab308] text-[#eab308] bg-[#eab308]/10'
                : 'border-[#22d3ee] text-[#22d3ee] bg-[#22d3ee]/10'
            }`}>
              {node}
            </div>
            {i < arr.length - 1 && (
              <div className="flex items-center mx-1 text-[#1e2a3e]">
                <div className="w-6 h-px bg-[#1e2a3e]" />
                <span className="text-[#637087]">▶</span>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Title */}
      <div className="text-center mb-2">
        <div className="font-mono text-xs tracking-[0.3em] text-[#637087] uppercase mb-3">
          STM32 + ESP32 + MPU6050
        </div>
        <h1 className="text-5xl font-bold tracking-tight text-white mb-2">
          DRONE DATA LOGGER
        </h1>
        <p className="text-[#637087] font-mono text-sm tracking-widest uppercase">
          Flight Monitoring System · v2.4.1
        </p>
      </div>

      {/* Divider */}
      <div className="w-px h-8 bg-[#1e2a3e] my-4" />

      {/* Nav buttons */}
      <div className="grid grid-cols-3 gap-3 w-full max-w-3xl">
        {nav.map((item) => (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            className="group flex flex-col items-start p-4 bg-[#0d1320] border border-[#1e2a3e] rounded hover:border-[#0ea5e9]/60 hover:bg-[#0ea5e9]/5 transition-all text-left"
          >
            <span className="font-semibold text-sm text-white mb-1 group-hover:text-[#38bdf8] transition-colors">
              {item.label}
            </span>
            <span className="text-xs text-[#637087] leading-snug">{item.desc}</span>
          </button>
        ))}
      </div>

      <button
        onClick={() => {
          const projectMeta = {
            project: 'STM32 Drone Data Logger and Flight Monitoring System',
            version: '2.4.1',
            architecture: 'MPU6050 -> ESP32 -> LAPTOP -> STM32 -> LAPTOP',
            timestamp: new Date().toISOString(),
          };
          const blob = new Blob([JSON.stringify(projectMeta, null, 2)], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = 'drone_logger_manifest.json';
          a.click();
          URL.revokeObjectURL(url);
        }}
        className="mt-6 inline-flex items-center justify-center rounded border border-[#0ea5e9] bg-[#0ea5e9]/10 px-5 py-2 font-mono text-xs font-semibold text-[#38bdf8] transition-colors hover:bg-[#0ea5e9]/20"
      >
        ↓ EXPORT SYSTEM MANIFEST
      </button>
      <div className="mt-1 text-xs font-mono text-[#637087]">
        Download system telemetry manifest & parameters
      </div>

      {/* Footer note */}
      <div className="mt-6 font-mono text-[10px] text-[#637087] text-center">
        PROJECT: AERO-DL-2024 · OPERATOR: ENG-TEAM-01 · STATUS: SIMULATION MODE
      </div>
    </div>
  );
}
