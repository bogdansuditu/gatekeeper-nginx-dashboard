import React, { useState, useMemo } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
} from '@dnd-kit/sortable';
import { Layers, CheckCircle2, AlertTriangle, Search, Server } from 'lucide-react';
import { AppItem } from '../../types';
import { AppCard } from './AppCard';

interface AppGridProps {
  apps: AppItem[];
  onReorder: (newApps: AppItem[]) => void;
  onEditApp: (app: AppItem) => void;
  onRefetchIcon: (appId: string) => void;
  onHideApp: (appId: string) => void;
  searchQuery: string;
  onOpenNpmSettings?: () => void;
}

export const AppGrid: React.FC<AppGridProps> = ({
  apps,
  onReorder,
  onEditApp,
  onRefetchIcon,
  onHideApp,
  searchQuery,
  onOpenNpmSettings,
}) => {
  const [statusFilter, setStatusFilter] = useState<'all' | 'online' | 'down'>('all');
  const [groupBy, setGroupBy] = useState<'none' | 'server'>(() => {
    return (localStorage.getItem('gatekeeper_apps_grouping') as 'none' | 'server') || 'none';
  });

  const handleSetGroupBy = (mode: 'none' | 'server') => {
    setGroupBy(mode);
    try {
      localStorage.setItem('gatekeeper_apps_grouping', mode);
    } catch {}
  };

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5, // Requires a 5px drag before activation so standard clicks work
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = apps.findIndex((item) => item.id === active.id);
      const newIndex = apps.findIndex((item) => item.id === over.id);
      if (oldIndex !== -1 && newIndex !== -1) {
        const reordered = arrayMove(apps, oldIndex, newIndex);
        onReorder(reordered);
      }
    }
  };

  // Extract clean Site/IP from forwardHost (e.g. "172.19.35.100")
  const extractServerHost = (app: AppItem): string => {
    if (app.forwardHost && app.forwardHost.trim()) {
      let host = app.forwardHost.trim();
      host = host.replace(/^[a-zA-Z]+:\/\//, ''); // strip scheme if present
      host = host.split(':')[0]; // strip port if present
      return host || 'Unknown Server';
    }
    return 'Direct / Unspecified';
  };

  // Filter apps based on search query and status filter
  const filteredApps = apps.filter((app) => {
    const matchesSearch =
      searchQuery === '' ||
      app.domainName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (app.customTitle && app.customTitle.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (app.customDescription && app.customDescription.toLowerCase().includes(searchQuery.toLowerCase())) ||
      app.forwardHost.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    if (statusFilter === 'online') return app.status === 'healthy';
    if (statusFilter === 'down') return app.status === 'down';
    return true;
  });

  // Group applications by Server Site/IP when "By Server" is active
  const serverGroups = useMemo(() => {
    if (groupBy !== 'server') return null;
    const groups: Record<string, AppItem[]> = {};

    for (const app of filteredApps) {
      const host = extractServerHost(app);
      if (!groups[host]) groups[host] = [];
      groups[host].push(app);
    }

    // Sort hosts naturally (IPv4 numerical ordering or alphabetical hostname)
    const sortedHosts = Object.keys(groups).sort((a, b) => {
      const aIp = a.split('.').map(Number);
      const bIp = b.split('.').map(Number);
      if (aIp.length === 4 && bIp.length === 4 && !aIp.some(isNaN) && !bIp.some(isNaN)) {
        for (let i = 0; i < 4; i++) {
          if (aIp[i] !== bIp[i]) return aIp[i] - bIp[i];
        }
        return 0;
      }
      return a.localeCompare(b);
    });

    return sortedHosts.map((host) => ({
      host,
      apps: groups[host],
      onlineCount: groups[host].filter((a) => a.status === 'healthy').length,
      downCount: groups[host].filter((a) => a.status === 'down').length,
    }));
  }, [filteredApps, groupBy]);

  return (
    <section className="flex flex-col gap-6">
      {/* Grid Subheader, Grouping Selector & Filters */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-2 flex-wrap">
          <Layers className="w-5 h-5 text-accent-primary" />
          <h2 className="text-lg font-bold text-text-primary tracking-wide">
            Discovered Applications & Proxy Portals
          </h2>
          <span className="text-xs bg-surface-dark border border-border-subtle px-2.5 py-0.5 rounded-full text-text-secondary font-semibold">
            {filteredApps.length} active
          </span>
          {groupBy === 'server' && serverGroups && (
            <span className="text-xs bg-accent-primary/10 border border-accent-primary/25 px-2.5 py-0.5 rounded-full text-accent-hover font-semibold">
              {serverGroups.length} server{serverGroups.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        {/* Controls: Grouping Selector and Status Filter Pills */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Grouping Selector: None vs By Server */}
          <div className="flex items-center gap-1.5 bg-surface-dark border border-border-subtle p-1 rounded-xl text-xs">
            <span className="text-[10px] uppercase font-bold text-text-muted px-2 select-none tracking-wider">
              Grouping:
            </span>
            <button
              onClick={() => handleSetGroupBy('none')}
              className={`px-3 py-1 rounded-lg font-medium transition-all ${
                groupBy === 'none'
                  ? 'bg-card-dark text-text-primary shadow-sm border border-border-subtle'
                  : 'text-text-muted hover:text-white'
              }`}
            >
              None
            </button>
            <button
              onClick={() => handleSetGroupBy('server')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg font-medium transition-all ${
                groupBy === 'server'
                  ? 'bg-card-dark text-text-primary shadow-sm border border-border-subtle'
                  : 'text-text-muted hover:text-white'
              }`}
            >
              <Server className="w-3.5 h-3.5 text-accent-primary" />
              <span>By Server</span>
            </button>
          </div>

          {/* Status Filter Pills: All Services, Online, Offline */}
          <div className="flex items-center gap-1.5 bg-surface-dark border border-border-subtle p-1 rounded-xl text-xs">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1 rounded-lg font-medium transition-all ${
                statusFilter === 'all'
                  ? 'bg-card-dark text-text-primary shadow-sm border border-border-subtle'
                  : 'text-text-muted hover:text-white'
              }`}
            >
              All Services
            </button>
            <button
              onClick={() => setStatusFilter('online')}
              className={`flex items-center gap-1 px-3 py-1 rounded-lg font-medium transition-all ${
                statusFilter === 'online'
                  ? 'bg-status-healthy/20 text-status-healthy font-bold'
                  : 'text-text-muted hover:text-white'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Online</span>
            </button>
            <button
              onClick={() => setStatusFilter('down')}
              className={`flex items-center gap-1 px-3 py-1 rounded-lg font-medium transition-all ${
                statusFilter === 'down'
                  ? 'bg-status-critical/20 text-status-critical font-bold'
                  : 'text-text-muted hover:text-white'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Offline</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content: Empty States OR Grouped / Flat Grids */}
      {apps.length === 0 ? (
        <div className="bg-card-dark border border-border-subtle rounded-card p-12 text-center flex flex-col items-center justify-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-accent-primary/10 border border-accent-primary/20 flex items-center justify-center text-accent-primary">
            <Layers className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-text-primary">No Proxy Hosts Discovered Yet</h3>
          <p className="text-xs text-text-secondary max-w-md">
            Connect Gatekeeper to your Nginx Proxy Manager instance to automatically discover and monitor your applications and proxy hosts.
          </p>
          {onOpenNpmSettings && (
            <button
              onClick={onOpenNpmSettings}
              className="mt-2 px-5 py-2.5 bg-accent-primary hover:bg-accent-hover text-white text-xs font-bold rounded-xl shadow-lg shadow-accent-primary/20 transition-all flex items-center gap-2"
            >
              <span>Configure NPM Integration</span>
            </button>
          )}
        </div>
      ) : filteredApps.length === 0 ? (
        <div className="bg-card-dark border border-border-subtle rounded-card p-12 text-center flex flex-col items-center justify-center">
          <Search className="w-10 h-10 text-text-muted mb-3" />
          <h3 className="text-base font-bold text-text-primary">No applications match your filter</h3>
          <p className="text-xs text-text-secondary mt-1">
            Try adjusting your search query or reset the status filters.
          </p>
        </div>
      ) : groupBy === 'server' && serverGroups ? (
        /* Grouped by Server Site / IP */
        <div className="flex flex-col gap-8">
          {serverGroups.map((group) => (
            <div key={group.host} className="flex flex-col gap-3">
              {/* Server Section Header Banner */}
              <div className="flex items-center justify-between px-4 py-2.5 bg-surface-dark/80 border border-border-subtle rounded-xl backdrop-blur-sm">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-card-dark border border-border-subtle flex items-center justify-center text-accent-primary shadow-sm">
                    <Server className="w-4 h-4" />
                  </div>
                  <div className="flex items-center gap-2.5">
                    <span className="font-mono font-bold text-sm text-text-primary tracking-wide">
                      {group.host}
                    </span>
                    <span className="text-[11px] font-semibold text-text-muted px-2 py-0.5 rounded-full bg-card-dark border border-border-subtle">
                      {group.apps.length} service{group.apps.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>

                {/* Server Online / Down Counts */}
                <div className="flex items-center gap-2 text-xs font-semibold">
                  {group.onlineCount > 0 && (
                    <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-status-healthy/15 text-status-healthy">
                      <span className="w-1.5 h-1.5 rounded-full bg-status-healthy" />
                      {group.onlineCount} online
                    </span>
                  )}
                  {group.downCount > 0 && (
                    <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-status-critical/15 text-status-critical">
                      <span className="w-1.5 h-1.5 rounded-full bg-status-critical" />
                      {group.downCount} down
                    </span>
                  )}
                </div>
              </div>

              {/* Grid of Applications for this Server */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {group.apps.map((app) => (
                  <AppCard
                    key={app.id}
                    app={app}
                    onEdit={onEditApp}
                    onRefetchIcon={onRefetchIcon}
                    onHide={onHideApp}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Standard Flat Reorderable Grid (None) */
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={filteredApps.map((a) => a.id)} strategy={rectSortingStrategy}>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {filteredApps.map((app) => (
                <AppCard
                  key={app.id}
                  app={app}
                  onEdit={onEditApp}
                  onRefetchIcon={onRefetchIcon}
                  onHide={onHideApp}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </section>
  );
};
