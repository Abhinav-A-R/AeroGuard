import { useEffect, useState } from 'react';
import type { SensorReading } from '../data/sensorSimulator';
import type { SystemSettings } from '../types/settings';

interface Props { current: SensorReading; packetCount: number; settings?: SystemSettings; }

function DeviceCard({ name, status, port, baud, pktRate, lastPkt, errors, latency, color }: {
  name: string; status: string; port: string; baud: string;
  pktRate: number; lastPkt: string; errors: number; latency: number; color: string;
}) {
  return (
    <div className="bg-[#0d1320] border rounded p-4" style={{ borderColor: color + '40' }}>
      <div className="flex items-center justify-between mb-3">
        <div className="font-mono text-sm font-bold" style={{ color }}>{name}</div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ background: color, boxShadow: `0 0 6px ${color}` }} />
          <span className="font-mono text-[10px]" style={{ color }}>{status}</span>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {[
          ['Port', port], ['Baud', baud], ['Pkt Rate', `${pktRate} /s`],
          ['Last Pkt', lastPkt], ['Errors', errors.toString()], ['Latency', `${latency} ms`],
        ].map(([k, v]) => (
          <div key={k}>
            <div className="text-[9px] font-mono text-[#637087] uppercase">{k}</div>
            <div className="font-mono text-xs text-white">{v}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function FlowArrow({ label, color, active }: { label: string; color: string; active: boolean }) {
  const [pulse, setPulse] = useState(false);
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setPulse(p => !p), 600);
    return () => clearInterval(id);
  }, [active]);

  return (
    <div className="flex flex-col items-center py-1">
      <div className="text-[9px] font-mono mb-1" style={{ color }}>{label}</div>
      <div className="flex flex-col items-center gap-0.5">
        {[0, 1, 2].map(i => (
          <div
            key={i}
            className="w-px h-3 transition-opacity duration-300"
            style={{
              background: color,
              opacity: active ? (pulse ? (i === 1 ? 1 : 0.4) : (i === 1 ? 0.4 : 1)) : 0.1,
            }}
          />
        ))}
        <div className="text-xs" style={{ color, opacity: active ? 1 : 0.2 }}>▼</div>
      </div>
    </div>
  );
}

export default function CommStatusPage({ current, packetCount, settings }: Props) {
  const now = new Date().toISOString().slice(11, 23);

  const esp32Port = settings?.esp32Port || 'COM3';
  const stm32Port = settings?.stm32Port || 'COM7';
  const baudRate = settings?.baud || '115200';
  const esp32Conn = settings?.esp32Connected ?? true;
  const stm32Conn = settings?.stm32Connected ?? true;

  return (
    <div className="h-full overflow-y-auto p-4 select-none">
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Vertical flow */}
        <div className="col-span-1 lg:col-span-1 flex flex-col items-center pt-4 space-y-2">
          <div className="font-mono text-[10px] text-[#637087] uppercase tracking-widest mb-2">Data Path Architecture</div>
          <DeviceCard name="MPU6050" status="ACTIVE" port="I2C-0x68" baud="400kHz" pktRate={settings?.imuRate || 100} lastPkt={now} errors={0} latency={2} color="#22d3ee" />
          <FlowArrow label="IMU → MCU" color="#22c55e" active />
          <DeviceCard name="ESP32" status={esp32Conn ? 'CONNECTED' : 'OFFLINE'} port={esp32Port} baud={baudRate} pktRate={settings?.samplingHz || 100} lastPkt={now} errors={esp32Conn ? 2 : 99} latency={current.latency} color={esp32Conn ? '#22c55e' : '#ef4444'} />
          <FlowArrow label="WiFi/Serial" color="#0ea5e9" active={esp32Conn} />
          <DeviceCard name="LAPTOP" status="RUNNING" port="localhost" baud="—" pktRate={settings?.samplingHz || 100} lastPkt={now} errors={0} latency={0} color="#0ea5e9" />
          <FlowArrow label="Serial/USB" color="#eab308" active={stm32Conn} />
          <DeviceCard name="STM32" status={stm32Conn ? 'CONNECTED' : 'OFFLINE'} port={stm32Port} baud={baudRate} pktRate={50} lastPkt={now} errors={stm32Conn ? 1 : 99} latency={8} color={stm32Conn ? '#eab308' : '#ef4444'} />
          <FlowArrow label="Telemetry" color="#a78bfa" active={stm32Conn} />
          <div className="font-mono text-[10px] text-[#a78bfa] bg-[#a78bfa]/10 border border-[#a78bfa]/30 rounded px-3 py-1">LAPTOP TELEMETRY</div>
        </div>

        {/* Right panels */}
        <div className="col-span-1 lg:col-span-4 space-y-3">
          <div className="text-[10px] font-mono text-[#637087] uppercase tracking-widest mb-1">Communication Channels</div>

          {/* ESP32 → Laptop */}
          <div className="bg-[#0d1320] border border-[#22c55e]/30 rounded p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2 h-2 rounded-full bg-[#22c55e]" style={{ boxShadow: '0 0 6px #22c55e' }} />
              <span className="font-mono text-xs font-bold text-[#22c55e]">ESP32 → LAPTOP (Sensor Input)</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 font-mono text-xs">
              <div><div className="text-[#637087] text-[9px]">PROTOCOL</div><div className="text-white">Serial/UART</div></div>
              <div><div className="text-[#637087] text-[9px]">BAUD</div><div className="text-white">115200</div></div>
              <div><div className="text-[#637087] text-[9px]">PACKET RATE</div><div className="text-[#22c55e]">100/s</div></div>
              <div><div className="text-[#637087] text-[9px]">TOTAL RX</div><div className="text-white">{packetCount.toLocaleString()}</div></div>
              <div><div className="text-[#637087] text-[9px]">LATENCY</div><div className="text-white">{current.latency} ms</div></div>
            </div>
          </div>

          {/* Laptop → STM32 */}
          <div className="bg-[#0d1320] border border-[#eab308]/30 rounded p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2 h-2 rounded-full bg-[#eab308]" style={{ boxShadow: '0 0 6px #eab308' }} />
              <span className="font-mono text-xs font-bold text-[#eab308]">LAPTOP → STM32 (Control Commands)</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 font-mono text-xs">
              <div><div className="text-[#637087] text-[9px]">PROTOCOL</div><div className="text-white">Serial/USB</div></div>
              <div><div className="text-[#637087] text-[9px]">BAUD</div><div className="text-white">115200</div></div>
              <div><div className="text-[#637087] text-[9px]">CMD RATE</div><div className="text-[#eab308]">50/s</div></div>
              <div><div className="text-[#637087] text-[9px]">TOTAL TX</div><div className="text-white">{Math.floor(packetCount / 2).toLocaleString()}</div></div>
              <div><div className="text-[#637087] text-[9px]">LATENCY</div><div className="text-white">8 ms</div></div>
            </div>
          </div>

          {/* STM32 → Laptop */}
          <div className="bg-[#0d1320] border border-[#a78bfa]/30 rounded p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2 h-2 rounded-full bg-[#a78bfa]" style={{ boxShadow: '0 0 6px #a78bfa' }} />
              <span className="font-mono text-xs font-bold text-[#a78bfa]">STM32 → LAPTOP (Telemetry Feedback)</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 font-mono text-xs">
              <div><div className="text-[#637087] text-[9px]">PROTOCOL</div><div className="text-white">Serial/USB</div></div>
              <div><div className="text-[#637087] text-[9px]">BAUD</div><div className="text-white">115200</div></div>
              <div><div className="text-[#637087] text-[9px]">TELEM RATE</div><div className="text-[#a78bfa]">50/s</div></div>
              <div><div className="text-[#637087] text-[9px]">TOTAL RX</div><div className="text-white">{Math.floor(packetCount / 2).toLocaleString()}</div></div>
              <div><div className="text-[#637087] text-[9px]">LATENCY</div><div className="text-white">10 ms</div></div>
            </div>
          </div>

          {/* System health */}
          <div className="bg-[#0d1320] border border-[#1e2a3e] rounded p-4">
            <div className="font-mono text-[10px] text-[#637087] uppercase tracking-widest mb-3">System Health</div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'CPU Usage', value: '12%', color: '#22c55e' },
                { label: 'Memory', value: '234 MB', color: '#38bdf8' },
                { label: 'Buffer Fill', value: '23%', color: '#22c55e' },
                { label: 'Uptime', value: '00:' + String(Math.floor(packetCount / 6000)).padStart(2, '0') + ':' + String(Math.floor((packetCount % 6000) / 100)).padStart(2, '0'), color: '#d4dae6' },
              ].map(({ label, value, color }) => (
                <div key={label} className="text-center">
                  <div className="text-[9px] font-mono text-[#637087] uppercase mb-1">{label}</div>
                  <div className="font-mono text-lg font-bold" style={{ color }}>{value}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
