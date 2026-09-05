import React from 'react';
import { ChevronDown, ChevronUp, BarChart3 } from 'lucide-react';
import { MetricKpiCard } from './MetricKpiCard';
import { LatencyWaveChart } from './LatencyWaveChart';
import { HostRadarChart } from './HostRadarChart';
import { HealthDonutGauges } from './HealthDonutGauges';
import { HealthStats, HealthSample } from '../../types';

interface CollapsiblePanelProps {
  isExpanded: boolean;
  onToggle: () => void;
  stats: HealthStats | null;
  samples: HealthSample[];
}

export const CollapsiblePanel: React.FC<CollapsiblePanelProps> = ({
  isExpanded,
  onToggle,
  stats,
  samples,
}) => {
  return (
    <section className="mb-8 transition-all">
      {/* Panel Toggle Header */}
      <div className="flex items-center justify-between py-2 mb-4 border-b border-border-subtle/50">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-accent-primary" />
          <span className="text-sm font-bold uppercase tracking-wider text-text-primary">
            Infrastructure Analytics & Telemetry
          </span>
          {!isExpanded && stats && (
            <div className="hidden sm:flex items-center gap-2 ml-4 text-xs text-text-secondary">
              <span className="bg-surface-dark px-2.5 py-0.5 rounded-full border border-border-subtle">
                Total: <strong className="text-text-primary">{stats.totalApps}</strong>
              </span>
              <span className="bg-surface-dark px-2.5 py-0.5 rounded-full border border-border-subtle">
                Online: <strong className="text-status-healthy">{stats.onlineApps}</strong>
              </span>
              <span className="bg-surface-dark px-2.5 py-0.5 rounded-full border border-border-subtle">
                Latency: <strong className="text-text-primary">{stats.avgLatencyMs}ms</strong>
              </span>
            </div>
          )}
        </div>

        <button
          onClick={onToggle}
          className="flex items-center gap-1.5 px-3 py-1 bg-surface-dark hover:bg-card-dark border border-border-subtle rounded-xl text-xs font-semibold text-text-secondary hover:text-white transition-all shadow-sm"
        >
          <span>{isExpanded ? 'Collapse Analytics' : 'Expand Analytics'}</span>
          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {/* Expandable Body */}
      {isExpanded && (
        <div className="flex flex-col gap-6 animate-fade-in">
          {/* Top KPI Metrics Row mirroring sample_dashboard.png */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricKpiCard
              title="Total Hosts"
              value={stats?.totalApps ?? 0}
              badge={{ text: '+14%', trend: 'up' }}
              hasSparkline={true}
            />
            <MetricKpiCard
              title="Online Services"
              value={stats?.onlineApps ?? 0}
              badge={{ text: '-3%', trend: 'down' }}
              subtitle="1 host in degraded/down state"
            />
            <MetricKpiCard
              title="Average Latency"
              value={`${stats?.avgLatencyMs ?? 0}ms`}
              badge={{ text: '+1%', trend: 'up' }}
              subtitle="Fast HTTP roundtrip responses"
            />
            <MetricKpiCard
              title="Network Availability"
              value={`${stats?.healthRatio ?? 100}%`}
              badge={{ text: '+21%', trend: 'up' }}
              subtitle="Healthy ingress route uptime"
            />
          </div>

          {/* Main Analytics Content: Latency Wave Chart on left, Radar & Donut gauges on right */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-8 flex flex-col">
              <LatencyWaveChart samples={samples} />
            </div>
            <div className="lg:col-span-4 flex flex-col gap-6">
              <HostRadarChart stats={stats} />
              <HealthDonutGauges stats={stats} />
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
