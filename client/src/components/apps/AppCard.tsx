import React, { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ExternalLink, MoreVertical, GripVertical, Edit2, RotateCw, EyeOff, Lock, Globe, Cloud, Network } from 'lucide-react';
import { AppItem } from '../../types';


interface AppCardProps {
  app: AppItem;
  onEdit: (app: AppItem) => void;
  onRefetchIcon: (appId: string) => void;
  onHide: (appId: string) => void;
}

export const AppCard: React.FC<AppCardProps> = ({ app, onEdit, onRefetchIcon, onHide }) => {
  const [menuOpen, setMenuOpen] = useState(false);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: app.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 1,
    opacity: isDragging ? 0.6 : 1,
  };

  const isHealthy = app.status === 'healthy';
  const isDown = app.status === 'down';
  const scheme = app.isSsl ? 'https' : app.forwardScheme || 'http';
  const externalUrl = `${scheme}://${app.domainName}`;

  const iconSrc = app.faviconPath
    ? `/api/v1/icons/${app.faviconPath}`
    : `/api/v1/icons/${app.id}.svg`;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`bg-card-dark border border-border-subtle hover:border-border-focus rounded-card px-3.5 pt-3 pb-2.5 flex flex-col justify-between dashboard-card relative group shadow-md transition-all select-none ${
        isDragging ? 'ring-2 ring-accent-primary shadow-2xl scale-105' : ''
      }`}
    >
      {/* Top Card Header: Drag Handle, Icon, Titles, Menu */}
      <div className="flex items-start justify-between gap-2.5">
        <div className="flex items-center gap-2.5 min-w-0">
          {/* Drag Handle */}
          <button
            {...attributes}
            {...listeners}
            className="text-text-muted hover:text-white cursor-grab active:cursor-grabbing p-0.5 -ml-1 rounded transition-colors shrink-0"
            title="Drag to reorder card"
          >
            <GripVertical className="w-3.5 h-3.5" />
          </button>

          {/* App Favicon */}
          <div className="w-8.5 h-8.5 w-[34px] h-[34px] rounded-lg overflow-hidden bg-surface-dark border border-border-subtle/80 flex items-center justify-center shrink-0 shadow-sm">
            <img
              src={iconSrc}
              alt={app.customTitle || app.domainName}
              className="w-full h-full object-contain p-1"
              onError={(e) => {
                // Fallback to local SVG generator endpoint if custom path fails
                (e.target as HTMLImageElement).src = `/api/v1/icons/${app.id}.svg`;
              }}
            />
          </div>

          {/* Application Name & Internal Target */}
          <div className="flex flex-col min-w-0">
            <h3 className="text-sm font-bold text-text-primary truncate group-hover:text-accent-hover transition-colors leading-tight mb-0.5">
              {app.customTitle || app.domainName.split('.')[0]}
            </h3>
            <span className="text-[10px] uppercase font-bold text-text-muted tracking-wider flex items-center gap-1 leading-none">
              {app.isSsl ? <Lock className="w-2.5 h-2.5 text-status-healthy" /> : <Globe className="w-2.5 h-2.5 text-text-muted" />}
              <span className="truncate">{app.domainName}</span>
            </span>
          </div>
        </div>

        {/* Top Right: Action Menu */}
        <div className="relative shrink-0">
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="text-text-muted hover:text-white p-1 rounded-lg hover:bg-surface-dark transition-colors"
          >
            <MoreVertical className="w-4 h-4" />
          </button>

          {menuOpen && (
            <div className="absolute right-0 mt-1 w-44 bg-surface-dark border border-border-subtle rounded-xl shadow-xl py-1 z-40 animate-fade-in text-xs">
              <a
                href={externalUrl}
                target="_blank"
                rel="noreferrer noopener"
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-2 px-3 py-2 text-text-primary hover:bg-card-dark hover:text-white"
              >
                <ExternalLink className="w-3.5 h-3.5 text-accent-primary" />
                <span>Open in new tab</span>
              </a>
              <button
                onClick={() => {
                  setMenuOpen(false);
                  onEdit(app);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-text-primary hover:bg-card-dark hover:text-white text-left"
              >
                <Edit2 className="w-3.5 h-3.5 text-text-secondary" />
                <span>Edit card details</span>
              </button>
              <button
                onClick={() => {
                  setMenuOpen(false);
                  onRefetchIcon(app.id);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-text-primary hover:bg-card-dark hover:text-white text-left"
              >
                <RotateCw className="w-3.5 h-3.5 text-text-secondary" />
                <span>Refetch favicon</span>
              </button>
              <button
                onClick={() => {
                  setMenuOpen(false);
                  onHide(app.id);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-text-muted hover:bg-status-critical/10 hover:text-status-critical text-left"
              >
                <EyeOff className="w-3.5 h-3.5" />
                <span>Hide from view</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Description / Host Details with Provider Badge */}
      <div className="mt-1.5 mb-2 flex items-center justify-between gap-2 text-xs text-text-secondary min-w-0">
        <span className="truncate">
          {app.customDescription || `Forwarded to: ${app.forwardHost}:${app.forwardPort}`}
        </span>

        {app.source === 'cloudflare' ? (
          <span
            title="Discovered via Cloudflare Tunnel"
            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold text-[#f38020] bg-[#f38020]/10 border border-[#f38020]/25 shrink-0 select-none"
          >
            <Cloud className="w-2.5 h-2.5 shrink-0" />
            <span>CF</span>
          </span>
        ) : (
          <span
            title="Managed via Nginx Proxy Manager"
            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold text-emerald-500 bg-emerald-500/10 border border-emerald-500/25 shrink-0 select-none"
          >
            <Network className="w-2.5 h-2.5 shrink-0" />
            <span>NPM</span>
          </span>
        )}
      </div>

      {/* Card Footer: Status Dot, Latency, Launch Button */}
      <div className="flex items-center justify-between border-t border-border-subtle/40 pt-2 mt-0.5">
        <div className="flex items-center gap-1.5">
          {/* Pulsing Status Dot */}
          <span
            className={`w-2 h-2 rounded-full ${
              isHealthy
                ? 'bg-status-healthy pulse-healthy'
                : isDown
                ? 'bg-status-critical pulse-critical'
                : 'bg-amber-400'
            }`}
          />
          <span className="text-xs font-medium text-text-secondary">
            {isHealthy ? (
              <span className="text-text-primary">
                {app.responseTimeMs > 0 ? `${app.responseTimeMs}ms` : 'Online'}
              </span>
            ) : isDown ? (
              <span className="text-status-critical font-bold">Offline</span>
            ) : (
              <span className="text-amber-400">Degraded</span>
            )}
          </span>
        </div>

        <a
          href={externalUrl}
          target="_blank"
          rel="noreferrer noopener"
          className="flex items-center gap-1 text-[11px] font-semibold text-accent-primary hover:text-accent-hover bg-accent-primary/10 hover:bg-accent-primary/20 px-2 py-0.5 rounded-md transition-colors"
        >
          <span>Launch</span>
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>
    </div>
  );
};
