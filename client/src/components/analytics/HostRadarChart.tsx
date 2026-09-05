import React from 'react';
import { MoreVertical } from 'lucide-react';
import { HealthStats } from '../../types';

interface HostRadarChartProps {
  stats: HealthStats | null;
}

export const HostRadarChart: React.FC<HostRadarChartProps> = ({ stats }) => {
  return (
    <div className="bg-card-dark border border-border-subtle rounded-card p-6 flex flex-col justify-between shadow-lg relative">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-bold text-text-primary tracking-wide">
          Host Distribution & Protocols
        </h3>
        <button className="text-text-muted hover:text-white transition-colors">
          <MoreVertical className="w-4 h-4" />
        </button>
      </div>

      {/* Circular Radar Chart Area mirroring sample_dashboard.png */}
      <div className="relative w-full aspect-square max-w-[240px] mx-auto my-4 flex items-center justify-center">
        {/* Concentric Circles */}
        <div className="absolute inset-0 rounded-full border border-border-subtle/50" />
        <div className="absolute inset-6 rounded-full border border-border-subtle/40" />
        <div className="absolute inset-12 rounded-full border border-border-subtle/30" />
        <div className="absolute inset-20 rounded-full border border-border-subtle/20" />

        {/* Crosshairs */}
        <div className="absolute w-full h-[1px] bg-border-subtle/40" />
        <div className="absolute h-full w-[1px] bg-border-subtle/40" />

        {/* Axis Labels */}
        <span className="absolute top-1 text-[10px] font-semibold text-text-secondary uppercase">HTTPS (SSL)</span>
        <span className="absolute bottom-1 text-[10px] font-semibold text-text-secondary uppercase">HTTP (Plain)</span>
        <span className="absolute left-1 text-[10px] font-semibold text-text-secondary uppercase">Standard</span>
        <span className="absolute right-1 text-[10px] font-semibold text-text-secondary uppercase">Custom</span>

        {/* SVG Organic Radar Curve */}
        <svg className="w-full h-full overflow-visible" viewBox="0 0 200 200">
          <defs>
            <linearGradient id="radar-grad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#5364f0" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#8553f0" stopOpacity="0.2" />
            </linearGradient>
          </defs>
          {/* Organic 4-point lobed curve matching sample image */}
          <path
            d="M 100,25 
               C 108,60 140,85 175,100 
               C 138,112 110,140 100,185 
               C 88,140 60,115 25,100 
               C 62,88 90,60 100,25 Z"
            fill="url(#radar-grad)"
            stroke="#6c7cf7"
            strokeWidth="2.5"
          />
          {/* Axis connection points */}
          <circle cx="100" cy="25" r="4" fill="#ffffff" stroke="#5364f0" strokeWidth="2" />
          <circle cx="175" cy="100" r="4" fill="#ffffff" stroke="#5364f0" strokeWidth="2" />
          <circle cx="100" cy="185" r="4" fill="#ffffff" stroke="#5364f0" strokeWidth="2" />
          <circle cx="25" cy="100" r="4" fill="#ffffff" stroke="#5364f0" strokeWidth="2" />
        </svg>
      </div>

      <div className="flex justify-around text-center text-xs border-t border-border-subtle/50 pt-3">
        <div>
          <span className="text-text-muted block text-[10px] uppercase">SSL Secured</span>
          <span className="font-bold text-text-primary">{stats?.protocolStats.httpsCount ?? 0} Hosts</span>
        </div>
        <div>
          <span className="text-text-muted block text-[10px] uppercase">Non-SSL</span>
          <span className="font-bold text-text-primary">{stats?.protocolStats.httpCount ?? 0} Hosts</span>
        </div>
        <div>
          <span className="text-text-muted block text-[10px] uppercase">Health Ratio</span>
          <span className="font-bold text-status-healthy">{stats?.healthRatio ?? 100}%</span>
        </div>
      </div>
    </div>
  );
};
