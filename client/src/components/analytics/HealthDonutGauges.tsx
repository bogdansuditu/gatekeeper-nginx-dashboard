import React from 'react';
import { MoreVertical, Activity, ShieldCheck } from 'lucide-react';
import { HealthStats } from '../../types';

interface HealthDonutGaugesProps {
  stats: HealthStats | null;
}

export const HealthDonutGauges: React.FC<HealthDonutGaugesProps> = ({ stats }) => {
  const onlineCount = stats?.onlineApps ?? 0;
  const totalCount = stats?.totalApps ?? 1;
  const onlinePct = Math.min(100, Math.round((onlineCount / (totalCount || 1)) * 100));

  const sslCount = stats?.protocolStats.httpsCount ?? 0;
  const sslPct = Math.min(100, Math.round((sslCount / (totalCount || 1)) * 100));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-bold text-text-primary tracking-wide">
          Statistics
        </h3>
        <button className="text-text-muted hover:text-white transition-colors">
          <MoreVertical className="w-4 h-4" />
        </button>
      </div>

      {/* Online Hosts Card */}
      <div className="bg-card-dark border border-border-subtle rounded-card p-4 flex items-center justify-between shadow-md">
        <div className="flex flex-col">
          <span className="text-sm font-semibold text-text-primary">Online Hosts</span>
          <span className="text-xs text-text-muted">Live upstream status</span>
        </div>

        <div className="flex items-center gap-4">
          {/* Circular Progress Ring */}
          <div className="relative w-12 h-12 flex items-center justify-center">
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
            <span className="text-xl font-extrabold text-text-primary">{onlineCount}</span>
          </div>
        </div>
      </div>

      {/* SSL Secured Card */}
      <div className="bg-card-dark border border-border-subtle rounded-card p-4 flex items-center justify-between shadow-md">
        <div className="flex flex-col">
          <span className="text-sm font-semibold text-text-primary">SSL Encrypted</span>
          <span className="text-xs text-text-muted">TLS certificate status</span>
        </div>

        <div className="flex items-center gap-4">
          {/* Circular Progress Ring */}
          <div className="relative w-12 h-12 flex items-center justify-center">
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
            <span className="text-xl font-extrabold text-text-primary">{sslCount}</span>
          </div>
        </div>
      </div>

      {/* Latency Average Card */}
      <div className="bg-card-dark border border-border-subtle rounded-card p-4 flex items-center justify-between shadow-md">
        <div className="flex flex-col">
          <span className="text-sm font-semibold text-text-primary">Average Latency</span>
          <span className="text-xs text-text-muted">Global roundtrip ping</span>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-2xl font-extrabold text-text-primary">
            {stats?.avgLatencyMs ?? 0}<span className="text-sm text-text-muted font-normal ml-0.5">ms</span>
          </span>
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-status-healthy/15 text-status-healthy">
            +18%
          </span>
        </div>
      </div>
    </div>
  );
};
