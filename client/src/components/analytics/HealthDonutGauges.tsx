import React from 'react';
import { Activity, ShieldCheck, Cloud, Network } from 'lucide-react';
import { HealthStats } from '../../types';

interface HealthDonutGaugesProps {
  stats: HealthStats | null;
}

export const HealthDonutGauges: React.FC<HealthDonutGaugesProps> = ({ stats }) => {
  const onlineCount = stats?.onlineApps ?? 0;
  const totalCount = stats?.totalApps ?? 0;
  const onlinePct = totalCount > 0 ? Math.min(100, Math.round((onlineCount / totalCount) * 100)) : 0;

  const sslCount = stats?.protocolStats.httpsCount ?? 0;
  const sslPct = totalCount > 0 ? Math.min(100, Math.round((sslCount / totalCount) * 100)) : 0;

  const cfCount = stats?.cloudflareSyncStatus?.hostCount ?? 0;
  const npmCount = Math.max(0, totalCount - cfCount);

  // Determine latency health rating
  const avgLatency = stats?.avgLatencyMs ?? 0;
  const latencyStatus = avgLatency <= 100 ? 'Optimal' : avgLatency <= 300 ? 'Normal' : 'High';
  const latencyBadgeClass =
    avgLatency <= 100
      ? 'bg-status-healthy/15 text-status-healthy border-status-healthy/30'
      : avgLatency <= 300
      ? 'bg-accent-primary/15 text-accent-primary border-accent-primary/30'
      : 'bg-status-critical/15 text-status-critical border-status-critical/30';

  return (
    <div className="flex flex-col gap-3.5 h-full justify-between">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-bold text-text-primary tracking-wide">
          Service Health & Gateways
        </h3>
        <span className="flex items-center gap-1.5 text-xs text-status-healthy font-medium">
          <span className="w-2 h-2 rounded-full bg-status-healthy animate-pulse"></span>
          Live
        </span>
      </div>

      {/* Online Hosts Card */}
      <div className="bg-card-dark border border-border-subtle rounded-card p-3.5 flex items-center justify-between shadow-md">
        <div className="flex flex-col">
          <span className="text-sm font-semibold text-text-primary">Online Services</span>
          <span className="text-xs text-text-muted">Live upstream reachability</span>
        </div>

        <div className="flex items-center gap-3.5">
          {/* Circular Progress Ring */}
          <div className="relative w-11 h-11 flex items-center justify-center">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
              <circle
                cx="18"
                cy="18"
                r="15"
                fill="none"
                stroke="currentColor"
                className="text-border-subtle opacity-40"
                strokeWidth="3.5"
              />
              <circle
                cx="18"
                cy="18"
                r="15"
                fill="none"
                stroke="#10b981"
                strokeWidth="3.5"
                strokeDasharray={`${(onlinePct * 94.2) / 100} 94.2`}
                strokeLinecap="round"
              />
            </svg>
            <Activity className="w-4 h-4 text-status-healthy absolute" />
          </div>

          <div className="text-right">
            <span className="text-[10px] text-text-muted block uppercase font-medium">MAX {totalCount}</span>
            <span className="text-lg font-extrabold text-text-primary">{onlineCount}</span>
          </div>
        </div>
      </div>

      {/* SSL Secured Card */}
      <div className="bg-card-dark border border-border-subtle rounded-card p-3.5 flex items-center justify-between shadow-md">
        <div className="flex flex-col">
          <span className="text-sm font-semibold text-text-primary">SSL Encrypted</span>
          <span className="text-xs text-text-muted">TLS certificate termination</span>
        </div>

        <div className="flex items-center gap-3.5">
          {/* Circular Progress Ring */}
          <div className="relative w-11 h-11 flex items-center justify-center">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
              <circle
                cx="18"
                cy="18"
                r="15"
                fill="none"
                stroke="currentColor"
                className="text-border-subtle opacity-40"
                strokeWidth="3.5"
              />
              <circle
                cx="18"
                cy="18"
                r="15"
                fill="none"
                stroke="#5364f0"
                strokeWidth="3.5"
                strokeDasharray={`${(sslPct * 94.2) / 100} 94.2`}
                strokeLinecap="round"
              />
            </svg>
            <ShieldCheck className="w-4 h-4 text-accent-hover absolute" />
          </div>

          <div className="text-right">
            <span className="text-[10px] text-text-muted block uppercase font-medium">MAX {totalCount}</span>
            <span className="text-lg font-extrabold text-text-primary">{sslCount}</span>
          </div>
        </div>
      </div>

      {/* Upstream Gateways Card */}
      <div className="bg-card-dark border border-border-subtle rounded-card p-3.5 flex items-center justify-between shadow-md">
        <div className="flex flex-col">
          <span className="text-sm font-semibold text-text-primary">Upstream Gateways</span>
          <span className="text-xs text-text-muted">Origin routing breakdown</span>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/25 rounded-lg text-xs font-semibold text-emerald-400">
            <Network className="w-3.5 h-3.5" />
            <span>{npmCount} NPM</span>
          </div>
          {cfCount > 0 && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-[#f38020]/10 border border-[#f38020]/25 rounded-lg text-xs font-semibold text-[#f38020]">
              <Cloud className="w-3.5 h-3.5" />
              <span>{cfCount} CF</span>
            </div>
          )}
        </div>
      </div>

      {/* Latency Average Card */}
      <div className="bg-card-dark border border-border-subtle rounded-card p-3.5 flex items-center justify-between shadow-md">
        <div className="flex flex-col">
          <span className="text-sm font-semibold text-text-primary">Average Latency</span>
          <span className="text-xs text-text-muted">Global roundtrip ping</span>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xl font-extrabold text-text-primary">
            {avgLatency}<span className="text-xs text-text-muted font-normal ml-0.5">ms</span>
          </span>
          <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${latencyBadgeClass}`}>
            {latencyStatus}
          </span>
        </div>
      </div>
    </div>
  );
};
