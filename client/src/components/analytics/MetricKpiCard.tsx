import React from 'react';

interface MetricKpiCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  badge?: {
    text: string;
    trend: 'up' | 'down' | 'neutral';
  };
  hasSparkline?: boolean;
}

export const MetricKpiCard: React.FC<MetricKpiCardProps> = ({
  title,
  value,
  subtitle,
  badge,
  hasSparkline,
}) => {
  return (
    <div className="bg-card-dark border border-border-subtle rounded-card p-5 flex flex-col justify-between relative overflow-hidden dashboard-card shadow-lg">
      <div className="flex items-start justify-between z-10">
        <div>
          <div className="text-2xl md:text-3xl font-extrabold text-text-primary tracking-tight">
            {value}
          </div>
          <div className="text-xs uppercase font-semibold tracking-wider text-text-secondary mt-1">
            {title}
          </div>
        </div>

        {badge && (
          <span
            className={`text-xs font-semibold px-2.5 py-1 rounded-full flex items-center gap-1 ${
              badge.trend === 'up'
                ? 'bg-status-healthy/15 text-status-healthy'
                : badge.trend === 'down'
                ? 'bg-amber-500/15 text-amber-400'
                : 'bg-accent-primary/15 text-accent-hover'
            }`}
          >
            {badge.trend === 'up' ? '↑' : badge.trend === 'down' ? '↓' : ''} {badge.text}
          </span>
        )}
      </div>

      {hasSparkline ? (
        <div className="mt-4 relative h-14 w-full">
          {/* SVG Smooth Sparkline mirroring sample_dashboard.png */}
          <svg className="w-full h-full overflow-visible" viewBox="0 0 100 40" preserveAspectRatio="none">
            <defs>
              <linearGradient id="sparkline-grad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#5364f0" stopOpacity="0.4" />
                <stop offset="100%" stopColor="#5364f0" stopOpacity="0.0" />
              </linearGradient>
            </defs>
            <path
              d="M 0,25 C 20,35 30,10 50,15 C 70,20 80,5 100,8 L 100,40 L 0,40 Z"
              fill="url(#sparkline-grad)"
            />
            <path
              d="M 0,25 C 20,35 30,10 50,15 C 70,20 80,5 100,8"
              fill="none"
              stroke="#6c7cf7"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
            <circle cx="80" cy="5" r="4" fill="#ffffff" stroke="#5364f0" strokeWidth="2" />
          </svg>
          <div className="flex justify-between text-[9px] text-text-muted mt-1 uppercase font-medium">
            <span>Mon</span>
            <span>Tue</span>
            <span>Wed</span>
            <span className="text-accent-hover font-bold">Thu</span>
            <span>Fri</span>
            <span>Sat</span>
          </div>
        </div>
      ) : (
        subtitle && (
          <div className="mt-4 text-xs text-text-muted">
            {subtitle}
          </div>
        )
      )}
    </div>
  );
};
