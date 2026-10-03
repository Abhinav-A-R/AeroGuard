import { useState } from 'react';
import type { ProcessedTelemetry } from '../types/telemetry';
import StatusBadge from '../components/StatusBadge';

interface AlertsPageProps {
  processed: ProcessedTelemetry;
  theme?: 'dark' | 'light';
}

interface AlertEntry {
  id: string;
  severity: 'CRITICAL' | 'WARNING' | 'INFO' | 'RESOLVED';
  timestamp: string;
  source: string;
  description: string;
  state: 'ACTIVE' | 'ACKNOWLEDGED' | 'CLEARED';
}

export default function AlertsPage({ processed, theme = 'dark' }: AlertsPageProps) {
  const { crashRisk, status, raw } = processed;
  const isLight = theme === 'light';
  const [filter, setFilter] = useState<'ALL' | 'CRITICAL' | 'WARNING' | 'INFO'>('ALL');
  const [acknowledged, setAcknowledged] = useState<Record<string, boolean>>({});

  // Dynamic alert list based on real telemetry & crashRisk engine
  const alerts: AlertEntry[] = [];

  if (crashRisk && crashRisk.willCrash) {
    alerts.push({
      id: 'crash-critical-1',
      severity: 'CRITICAL',
      timestamp: new Date().toLocaleTimeString(),
      source: 'CrashRiskEngine',
      description: `CRITICAL CRASH RISK PREDICTED — Severe anomaly score (${crashRisk.score}%). Triggers: ${crashRisk.reasons.join(', ')}`,
      state: acknowledged['crash-critical-1'] ? 'ACKNOWLEDGED' : 'ACTIVE',
    });
  } else if (crashRisk && crashRisk.level === 'MEDIUM RISK') {
    alerts.push({
      id: 'crash-warn-1',
      severity: 'WARNING',
      timestamp: new Date().toLocaleTimeString(),
      source: 'CrashRiskEngine',
      description: `ELEVATED ANOMALY RISK — Score (${crashRisk.score}%). Triggers: ${crashRisk.reasons.join(', ')}`,
      state: acknowledged['crash-warn-1'] ? 'ACKNOWLEDGED' : 'ACTIVE',
    });
  }

  if (crashRisk?.mlPrediction && crashRisk.mlPrediction.mlProbability > 20) {
    alerts.push({
      id: 'ml-ai-agent-1',
      severity: crashRisk.mlPrediction.mlProbability > 65 ? 'CRITICAL' : 'WARNING',
      timestamp: new Date().toLocaleTimeString(),
      source: 'AIAgent_MLModel',
      description: `[AI AGENT ML MODEL] Predicted crash probability ${crashRisk.mlPrediction.mlProbability}% (${crashRisk.mlPrediction.earlyWarningMs}ms early warning). ${crashRisk.mlPrediction.aiAgentRecommendation}`,
      state: acknowledged['ml-ai-agent-1'] ? 'ACKNOWLEDGED' : 'ACTIVE',
    });
  }

  if (raw && raw.battery > 0 && raw.battery < 3.4) {
    alerts.push({
      id: 'batt-low-1',
      severity: 'WARNING',
      timestamp: new Date().toLocaleTimeString(),
      source: 'PowerMonitor',
      description: `Low Battery Voltage Warning (${raw.battery.toFixed(2)}V). Threshold: <3.40V`,
      state: acknowledged['batt-low-1'] ? 'ACKNOWLEDGED' : 'ACTIVE',
    });
  }

  if (!status.esp32Connected && status.hasReceivedData) {
    alerts.push({
      id: 'esp32-drop-1',
      severity: 'CRITICAL',
      timestamp: new Date().toLocaleTimeString(),
      source: 'WebSocketBridge',
      description: 'ESP32 Telemetry Signal Dropout — No telemetry packets received for >3.0 seconds.',
      state: acknowledged['esp32-drop-1'] ? 'ACKNOWLEDGED' : 'ACTIVE',
    });
  }

  // Default operational info alert when everything is safe
  if (alerts.length === 0) {
    alerts.push({
      id: 'system-nominal-1',
      severity: 'INFO',
      timestamp: new Date().toLocaleTimeString(),
      source: 'SystemDiagnostics',
      description: 'All flight parameters nominal. Telemetry vectors within safe operational boundaries.',
      state: 'CLEARED',
    });
  }

  const filteredAlerts = alerts.filter(a => filter === 'ALL' || a.severity === filter);

  const toggleAck = (id: string) => {
    setAcknowledged(prev => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className={`h-full overflow-y-auto p-4 space-y-4 select-none font-mono ${
      isLight ? 'bg-slate-50 text-slate-900' : 'bg-[#060910] text-slate-100'
    }`}>
      
      {/* Top Header & Filter Controls */}
      <div className={`border rounded-lg p-4 flex items-center justify-between ${
        isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-[#0f172a] border-slate-800'
      }`}>
        <div>
          <h2 className={`text-xs font-bold uppercase tracking-wider flex items-center gap-2 ${
            isLight ? 'text-slate-900' : 'text-slate-200'
          }`}>
            <span>🚨 FLIGHT ALERT & DIAGNOSTIC CENTER</span>
          </h2>
          <p className={`text-[10px] mt-0.5 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
            Real-time threshold evaluations, crash predictions, and network connectivity alarms.
          </p>
        </div>

        {/* Severity Filter Tabs */}
        <div className={`flex items-center gap-1.5 p-1 rounded border ${
          isLight ? 'bg-slate-100 border-slate-200' : 'bg-[#090d16] border-slate-800'
        }`}>
          {(['ALL', 'CRITICAL', 'WARNING', 'INFO'] as const).map(sev => (
            <button
              key={sev}
              onClick={() => setFilter(sev)}
              className={`px-3 py-1 rounded text-[10px] font-bold transition-colors ${
                filter === sev 
                  ? isLight ? 'bg-white text-sky-800 border border-sky-300 shadow-sm' : 'bg-sky-950 text-sky-400 border border-sky-500/40'
                  : isLight ? 'text-slate-600 hover:text-slate-900' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {sev}
            </button>
          ))}
        </div>
      </div>

      {/* Alert Feed Table */}
      <div className={`border rounded-lg p-4 space-y-3 ${
        isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-[#0f172a] border-slate-800'
      }`}>
        <div className={`flex items-center justify-between border-b pb-2 ${isLight ? 'border-slate-200' : 'border-slate-800'}`}>
          <span className={`text-xs font-bold uppercase ${isLight ? 'text-slate-900' : 'text-slate-200'}`}>
            ACTIVE ALARM LOG ({filteredAlerts.length})
          </span>
          <StatusBadge status={alerts.some(a => a.severity === 'CRITICAL') ? 'CRITICAL' : 'OPERATIONAL'} />
        </div>

        <div className="space-y-2">
          {filteredAlerts.map(alert => {
            const isCrit = alert.severity === 'CRITICAL';
            const isWarn = alert.severity === 'WARNING';
            const isInfo = alert.severity === 'INFO';

            const borderCol = isCrit 
              ? isLight ? 'border-rose-300 bg-rose-50 text-rose-900' : 'border-rose-500/50 bg-rose-950/20 text-rose-300'
              : isWarn 
              ? isLight ? 'border-amber-300 bg-amber-50 text-amber-900' : 'border-amber-500/50 bg-amber-950/20 text-amber-300'
              : isInfo 
              ? isLight ? 'border-sky-300 bg-sky-50 text-sky-900' : 'border-sky-500/40 bg-sky-950/20 text-sky-300'
              : isLight ? 'border-slate-200 bg-slate-50 text-slate-800' : 'border-slate-800 bg-[#090d16] text-slate-300';

            return (
              <div key={alert.id} className={`p-3 rounded border ${borderCol} flex items-start justify-between gap-3 text-xs`}>
                <div className="space-y-1 flex-1">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${
                      isCrit ? 'bg-rose-600 text-white' : isWarn ? 'bg-amber-500 text-slate-900' : 'bg-sky-600 text-white'
                    }`}>
                      {alert.severity}
                    </span>
                    <span className={`font-bold ${isLight ? 'text-slate-900' : 'text-slate-200'}`}>[{alert.source}]</span>
                    <span className={`text-[10px] ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>{alert.timestamp}</span>
                  </div>
                  <p className={`text-xs font-semibold leading-relaxed ${isLight ? 'text-slate-800' : 'text-slate-200'}`}>
                    {alert.description}
                  </p>
                </div>

                {alert.severity !== 'INFO' && (
                  <button
                    onClick={() => toggleAck(alert.id)}
                    className={`px-2.5 py-1 rounded border text-[10px] font-bold transition-colors flex-shrink-0 ${
                      isLight ? 'border-slate-300 bg-white text-slate-700 hover:border-sky-500 hover:text-sky-700' : 'border-slate-700 bg-[#090d16] text-slate-300 hover:border-sky-500 hover:text-sky-300'
                    }`}
                  >
                    {alert.state === 'ACKNOWLEDGED' ? '✓ ACKNOWLEDGED' : 'ACKNOWLEDGE'}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
}
