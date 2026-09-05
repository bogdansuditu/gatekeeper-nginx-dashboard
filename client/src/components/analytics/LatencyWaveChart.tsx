import React, { useState, useMemo } from 'react';
import { Download, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { HealthSample } from '../../types';

interface LatencyWaveChartProps {
  samples: HealthSample[];
}

export const LatencyWaveChart: React.FC<LatencyWaveChartProps> = ({ samples }) => {
  const [activeRange, setActiveRange] = useState<'Today' | '7d' | '2w' | '1m' | '3m'>('2w');
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const ranges: Array<'Today' | '7d' | '2w' | '1m' | '3m'> = ['Today', '7d', '2w', '1m', '3m'];

  // Filter samples based on the selected time range
  const filteredSamples = useMemo(() => {
    if (!samples || samples.length === 0) return [];
    const sorted = [...samples].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    const now = sorted[sorted.length - 1] ? new Date(sorted[sorted.length - 1].timestamp).getTime() : Date.now();

    const rangeMs: Record<string, number> = {
      'Today': 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000,
      '2w': 14 * 24 * 60 * 60 * 1000,
      '1m': 30 * 24 * 60 * 60 * 1000,
      '3m': 90 * 24 * 60 * 60 * 1000,
    };

    const cutoff = now - (rangeMs[activeRange] || rangeMs['2w']);
    const filtered = sorted.filter((s) => new Date(s.timestamp).getTime() >= cutoff);
    return filtered.length >= 2 ? filtered : sorted.slice(-14);
  }, [samples, activeRange]);

  // Compute coordinate points for SVG rendering
  const rangeConfig = {
    'Today': { label: 'Past 24 Hours', durationMs: 24 * 60 * 60 * 1000 },
    '7d': { label: 'Past 7 Days', durationMs: 7 * 24 * 60 * 60 * 1000 },
    '2w': { label: 'Past 14 Days', durationMs: 14 * 24 * 60 * 60 * 1000 },
    '1m': { label: 'Past 30 Days', durationMs: 30 * 24 * 60 * 60 * 1000 },
    '3m': { label: 'Past 90 Days', durationMs: 90 * 24 * 60 * 60 * 1000 },
  };

  const { points, splinePath, areaPath, maxLatency, axisTicks } = useMemo(() => {
    const config = rangeConfig[activeRange] || rangeConfig['2w'];
    const now = Date.now();
    const windowStart = now - config.durationMs;

    // Generate 7 evenly spaced axis ticks across the selected time range
    const ticks: Array<{ main: string; sub: string }> = [];
    for (let i = 0; i < 7; i++) {
      const tickTime = new Date(windowStart + (i / 6) * config.durationMs);
      if (activeRange === 'Today') {
        ticks.push({
          main: tickTime.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
          sub: i === 6 ? 'Now' : tickTime.toLocaleDateString([], { weekday: 'short' }),
        });
      } else if (activeRange === '7d' || activeRange === '2w') {
        ticks.push({
          main: `${tickTime.getDate()} ${tickTime.toLocaleDateString([], { month: 'short' })}`,
          sub: tickTime.toLocaleDateString([], { weekday: 'short' }),
        });
      } else {
        ticks.push({
          main: `${tickTime.getDate()} ${tickTime.toLocaleDateString([], { month: 'short' })}`,
          sub: `${tickTime.getFullYear()}`,
        });
      }
    }

    if (filteredSamples.length === 0) {
      const fallbackY = 180;
      return {
        points: [],
        splinePath: `M 0,${fallbackY} L 1000,${fallbackY}`,
        areaPath: `M 0,${fallbackY} L 1000,${fallbackY} L 1000,240 L 0,240 Z`,
        maxLatency: 400,
        axisTicks: ticks,
      };
    }

    const highest = Math.max(100, ...filteredSamples.map((s) => s.avgLatencyMs));
    const ceiling = Math.ceil(highest / 100) * 100;

    // If all samples are within a narrow interval (e.g. freshly installed), spread evenly
    // so the line is easily inspectable while retaining true temporal sequence
    const computedPoints = filteredSamples.map((sample, idx) => {
      let x: number;
      if (filteredSamples.length === 1) {
        x = 500;
      } else {
        x = Math.round((idx / (filteredSamples.length - 1)) * 960 + 20);
      }

      // Map latency: 0ms -> y=215, ceiling -> y=25
      const ratio = Math.min(1, Math.max(0, sample.avgLatencyMs / ceiling));
      const y = Math.round(215 - ratio * 190);
      return { x, y, sample };
    });

    // Build smooth cubic bezier curve
    let curve = `M ${computedPoints[0].x},${computedPoints[0].y}`;
    if (computedPoints.length === 1) {
      curve = `M 0,${computedPoints[0].y} L 1000,${computedPoints[0].y}`;
    } else {
      for (let i = 0; i < computedPoints.length - 1; i++) {
        const p0 = computedPoints[i === 0 ? 0 : i - 1];
        const p1 = computedPoints[i];
        const p2 = computedPoints[i + 1];
        const p3 = computedPoints[i + 2 < computedPoints.length ? i + 2 : i + 1];

        const cp1x = p1.x + (p2.x - p0.x) / 6;
        const cp1y = p1.y + (p2.y - p0.y) / 6;
        const cp2x = p2.x - (p3.x - p1.x) / 6;
        const cp2y = p2.y - (p3.y - p1.y) / 6;

        curve += ` C ${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${p2.x},${p2.y}`;
      }
    }

    const lastX = computedPoints.length === 1 ? 1000 : computedPoints[computedPoints.length - 1].x;
    const firstX = computedPoints.length === 1 ? 0 : computedPoints[0].x;
    const area = `${curve} L ${lastX},240 L ${firstX},240 Z`;

    return {
      points: computedPoints,
      splinePath: curve,
      areaPath: area,
      maxLatency: ceiling,
      axisTicks: ticks,
    };
  }, [filteredSamples, activeRange]);

  const handleExportCsv = () => {
    const headers = 'ID,Timestamp,OnlineHosts,DownHosts,TotalHosts,AvgLatencyMs\n';
    const rows = filteredSamples
      .map((s) => `${s.id},"${s.timestamp}",${s.onlineCount},${s.downCount},${s.totalCount},${s.avgLatencyMs}`)
      .join('\n');
    const blob = new Blob([headers + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gatekeeper-telemetry-${activeRange.toLowerCase()}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const activeHoverPoint = hoveredIndex !== null && points[hoveredIndex] ? points[hoveredIndex] : null;

  return (
    <div className="bg-card-dark border border-border-subtle rounded-card p-6 flex flex-col justify-between shadow-lg relative overflow-hidden">
      {/* Chart Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-text-primary tracking-wide">
              Infrastructure Latency & Load Overview
            </h2>
            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-accent-primary/20 text-accent-primary border border-accent-primary/30">
              {activeRange} View
            </span>
          </div>
          <p className="text-xs text-text-secondary mt-0.5 flex items-center gap-1.5">
            <span>📅 {filteredSamples.length} telemetry samples recorded</span>
            <span className="text-text-muted">• Probed continuously every 60s</span>
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Time range selector */}
          <div className="flex items-center gap-1 bg-surface-dark border border-border-subtle p-1 rounded-xl text-xs">
            {ranges.map((range) => (
              <button
                key={range}
                onClick={() => {
                  setActiveRange(range);
                  setHoveredIndex(null);
                }}
                className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                  activeRange === range
                    ? 'bg-card-dark text-text-primary shadow-sm border border-border-subtle'
                    : 'text-text-muted hover:text-white'
                }`}
              >
                {range}
              </button>
            ))}
          </div>

          {/* Download CSV */}
          <button
            onClick={handleExportCsv}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-accent-primary hover:bg-accent-hover text-white text-xs font-semibold rounded-xl shadow-md shadow-accent-primary/20 transition-all"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download CSV</span>
          </button>
        </div>
      </div>

      {/* Main SVG Spline Chart Area */}
      <div className="relative w-full h-56 sm:h-64 my-2">
        {/* Horizontal Guide Grid Lines */}
        <div className="absolute inset-0 flex flex-col justify-between pointer-events-none text-[10px] text-text-muted border-b border-border-subtle/40">
          <div className="border-b border-border-subtle/30 w-full flex items-center justify-between pr-2">
            <span>{maxLatency}ms</span>
          </div>
          <div className="border-b border-border-subtle/30 w-full flex items-center justify-between pr-2">
            <span>{Math.round(maxLatency * 0.75)}ms</span>
          </div>
          <div className="border-b border-border-subtle/30 w-full flex items-center justify-between pr-2">
            <span>{Math.round(maxLatency * 0.5)}ms</span>
          </div>
          <div className="border-b border-border-subtle/30 w-full flex items-center justify-between pr-2">
            <span>{Math.round(maxLatency * 0.25)}ms</span>
          </div>
          <div className="w-full flex items-center justify-between pr-2">
            <span>0ms</span>
          </div>
        </div>

        {/* Dynamic Curved Wave Path */}
        <svg className="absolute inset-0 w-full h-full overflow-visible" viewBox="0 0 1000 240" preserveAspectRatio="none">
          <defs>
            <linearGradient id="wave-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#5364f0" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#5364f0" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Area Fill */}
          <path d={areaPath} fill="url(#wave-gradient)" />

          {/* Glowing Stroke Curve */}
          <path
            d={splinePath}
            fill="none"
            stroke="#6c7cf7"
            strokeWidth="3.5"
            strokeLinecap="round"
          />

          {/* Data Points with Native SVG Animation (Centric Pulse) */}
          {points.map((pt, i) => {
            const hasAnomaly = pt.sample.downCount > 0 || pt.sample.avgLatencyMs > 200;
            const isHovered = hoveredIndex === i;

            return (
              <g key={i} className="cursor-pointer" onMouseEnter={() => setHoveredIndex(i)} onMouseLeave={() => setHoveredIndex(null)}>
                {/* Native SVG Pulse Effect (Keeps center fixed on (cx, cy)) */}
                {hasAnomaly && (
                  <circle cx={pt.x} cy={pt.y} r="5" fill="none" stroke="#ef4444" strokeWidth="1.5">
                    <animate attributeName="r" values="5;11;5" dur="2s" repeatCount="indefinite" />
                    <animate attributeName="opacity" values="0.8;0;0.8" dur="2s" repeatCount="indefinite" />
                  </circle>
                )}

                {/* Point dot */}
                <circle
                  cx={pt.x}
                  cy={pt.y}
                  r={isHovered ? 7 : hasAnomaly ? 5 : 3.5}
                  fill={hasAnomaly ? '#ef4444' : '#6c7cf7'}
                  stroke="#ffffff"
                  strokeWidth={isHovered ? 2.5 : 1.5}
                  className="transition-all duration-150"
                />

                {/* Transparent hit area for easy hover */}
                <circle cx={pt.x} cy={pt.y} r="16" fill="transparent" />
              </g>
            );
          })}
        </svg>

        {/* Interactive Hover Tooltip Anchored to Active Point */}
        {activeHoverPoint && (
          <div
            style={{
              left: `${Math.min(85, Math.max(15, (activeHoverPoint.x / 1000) * 100))}%`,
              top: `${Math.max(10, Math.min(70, (activeHoverPoint.y / 240) * 100 - 25))}%`,
            }}
            className="absolute -translate-x-1/2 -translate-y-full pointer-events-none z-30 bg-surface-dark/95 border border-border-subtle rounded-xl p-2.5 shadow-2xl backdrop-blur-md flex flex-col gap-1 text-xs animate-fade-in whitespace-nowrap min-w-[170px]"
          >
            <div className="flex items-center justify-between gap-3 text-[11px] font-bold text-text-primary border-b border-border-subtle/50 pb-1">
              <span>{new Date(activeHoverPoint.sample.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              <span className="text-text-muted font-normal text-[10px]">
                {new Date(activeHoverPoint.sample.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' })}
              </span>
            </div>

            <div className="flex items-center justify-between gap-3 text-text-secondary text-[11px]">
              <span>Roundtrip Latency:</span>
              <span className="font-mono font-bold text-text-primary">{activeHoverPoint.sample.avgLatencyMs} ms</span>
            </div>

            <div className="flex items-center justify-between gap-3 text-text-secondary text-[11px]">
              <span>Online Services:</span>
              <span className="font-bold text-status-healthy flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                {activeHoverPoint.sample.onlineCount} / {activeHoverPoint.sample.totalCount}
              </span>
            </div>

            {activeHoverPoint.sample.downCount > 0 && (
              <div className="flex items-center justify-between gap-3 text-status-critical text-[11px] font-bold">
                <span className="flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  Offline Hosts:
                </span>
                <span>{activeHoverPoint.sample.downCount} down</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* X-Axis Timeline Dates */}
      <div className="grid grid-cols-7 text-[10px] text-text-muted mt-3 border-t border-border-subtle/40 pt-2 px-2 text-center">
        {axisTicks.map((tick, i) => (
          <div key={i} className="text-center">
            <span className="block font-bold text-text-primary/80">{tick.main}</span>
            <span>{tick.sub}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

