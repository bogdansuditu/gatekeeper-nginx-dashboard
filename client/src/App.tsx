import React, { useState, useEffect } from 'react';
import { useAuth } from './context/AuthContext';
import { AppItem, HealthStats, HealthSample } from './types';
import { Sidebar } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';
import { CollapsiblePanel } from './components/analytics/CollapsiblePanel';
import { AppGrid } from './components/apps/AppGrid';
import { EditAppModal } from './components/apps/EditAppModal';
import { SettingsModal } from './components/settings/SettingsModal';
import { LoginView } from './components/auth/LoginView';
import { Sparkles } from 'lucide-react';

export const App: React.FC = () => {
  const { user, isLoading, updateUser } = useAuth();

  // Navigation & UI States
  const [currentTab, setCurrentTab] = useState<'dashboard' | 'analytics' | 'apps' | 'users' | 'settings'>('dashboard');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsInitialTab, setSettingsInitialTab] = useState<'profile' | 'theme' | 'npm' | 'cloudflare' | 'users'>('profile');
  const [editingApp, setEditingApp] = useState<AppItem | null>(null);

  // Data States
  const [apps, setApps] = useState<AppItem[]>([]);
  const [healthStats, setHealthStats] = useState<HealthStats | null>(null);
  const [healthSamples, setHealthSamples] = useState<HealthSample[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);

  // Analytics Collapsible state (synced with user preference)
  const [isAnalyticsExpanded, setIsAnalyticsExpanded] = useState<boolean>(
    user?.preferences?.showAnalytics ?? true
  );

  useEffect(() => {
    if (user?.preferences?.showAnalytics !== undefined) {
      setIsAnalyticsExpanded(user.preferences.showAnalytics);
    }
  }, [user?.preferences?.showAnalytics]);

  // Fetch applications
  const fetchApps = async () => {
    try {
      const res = await fetch('/api/v1/apps', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setApps(data.apps || []);
      }
    } catch {}
  };

  // Fetch health stats and telemetry
  const fetchTelemetry = async () => {
    try {
      const [statsRes, historyRes] = await Promise.all([
        fetch('/api/v1/health/stats', { credentials: 'include' }),
        fetch('/api/v1/health/history', { credentials: 'include' }),
      ]);

      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setHealthStats(statsData);
      }
      if (historyRes.ok) {
        const historyData = await historyRes.json();
        setHealthSamples(historyData.samples || []);
      }
    } catch {}
  };

  // Initial Load & Polling (Every 30s as agreed in /grill-me)
  useEffect(() => {
    if (user) {
      fetchApps();
      fetchTelemetry();

      const interval = setInterval(() => {
        fetchApps();
        fetchTelemetry();
      }, 30000);

      const onSyncSuccess = () => {
        fetchApps();
        fetchTelemetry();
      };
      window.addEventListener('gatekeeper:sync-success', onSyncSuccess);

      return () => {
        clearInterval(interval);
        window.removeEventListener('gatekeeper:sync-success', onSyncSuccess);
      };
    }
  }, [user]);

  // Handle Manual Resync (Both NPM and Cloudflare Tunnels)
  const handleManualSync = async () => {
    setIsSyncing(true);
    try {
      await Promise.allSettled([
        fetch('/api/v1/npm/sync', { method: 'POST', credentials: 'include' }),
        fetch('/api/v1/cloudflare/sync', { method: 'POST', credentials: 'include' }),
      ]);
      await Promise.all([fetchApps(), fetchTelemetry()]);
    } catch {} finally {
      setIsSyncing(false);
    }
  };


  // Handle Card Drag-and-Drop Reordering
  const handleReorder = async (newApps: AppItem[]) => {
    setApps(newApps);
    const cardOrder = newApps.map((a) => a.id);
    try {
      await fetch('/api/v1/apps/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ cardOrder }),
      });
    } catch {}
  };

  // Handle Toggle Analytics Panel
  const handleToggleAnalytics = async () => {
    const nextState = !isAnalyticsExpanded;
    setIsAnalyticsExpanded(nextState);
    if (user) {
      try {
        const res = await fetch('/api/v1/users/preferences', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ showAnalytics: nextState }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.user) updateUser(data.user);
        }
      } catch {}
    }
  };

  // Handle Edit App Card Details
  const handleSaveAppDetails = async (appId: string, customTitle: string, customDescription: string) => {
    try {
      const res = await fetch(`/api/v1/apps/${appId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ customTitle, customDescription }),
      });
      if (res.ok) {
        setApps((prev) =>
          prev.map((a) =>
            a.id === appId ? { ...a, customTitle, customDescription } : a
          )
        );
      }
    } catch {}
  };

  // Handle Refetch Icon
  const handleRefetchIcon = async (appId: string) => {
    try {
      const res = await fetch(`/api/v1/apps/${appId}/refetch-icon`, {
        method: 'POST',
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setApps((prev) =>
          prev.map((a) => (a.id === appId ? { ...a, faviconPath: data.faviconPath } : a))
        );
      }
    } catch {}
  };

  // Handle Hide App
  const handleHideApp = async (appId: string) => {
    try {
      await fetch(`/api/v1/apps/${appId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ isHidden: true }),
      });
      setApps((prev) => prev.filter((a) => a.id !== appId));
    } catch {}
  };

  // Handle Tab Selection
  const handleSelectTab = (tab: 'dashboard' | 'analytics' | 'apps' | 'users' | 'settings') => {
    if (tab === 'users') {
      setSettingsInitialTab('users');
      setIsSettingsOpen(true);
      return;
    }
    if (tab === 'settings') {
      setSettingsInitialTab('profile');
      setIsSettingsOpen(true);
      return;
    }
    setCurrentTab(tab);
    if (tab === 'analytics' && !isAnalyticsExpanded) {
      setIsAnalyticsExpanded(true);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-canvas-dark flex flex-col items-center justify-center gap-4 text-text-primary">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-accent-primary to-accent-purple flex items-center justify-center shadow-xl shadow-accent-primary/20 animate-pulse">
          <Sparkles className="w-6 h-6 text-white" />
        </div>
        <span className="text-xs font-semibold text-text-muted">Loading Gatekeeper...</span>
      </div>
    );
  }

  if (!user) {
    return <LoginView />;
  }

  return (
    <div className="min-h-screen flex bg-canvas-dark text-text-primary selection:bg-accent-primary selection:text-white">
      {/* Sleek Vertical Icon Sidebar */}
      <Sidebar
        currentTab={currentTab}
        onSelectTab={handleSelectTab}
        onOpenSettings={() => {
          setSettingsInitialTab('profile');
          setIsSettingsOpen(true);
        }}
      />

      {/* Main Content Viewport */}
      <div className="flex-1 flex flex-col min-w-0">
        <Header
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          healthStats={healthStats}
          onManualSync={handleManualSync}
          isSyncing={isSyncing}
          onOpenSettings={(tab) => {
            setSettingsInitialTab(tab || 'profile');
            setIsSettingsOpen(true);
          }}
        />

        <main className="flex-1 p-6 md:p-8 max-w-7xl w-full mx-auto overflow-y-auto">
          {/* Top Collapsible Analytics Section matching sample_dashboard.png */}
          {(currentTab === 'dashboard' || currentTab === 'analytics') && (
            <CollapsiblePanel
              isExpanded={isAnalyticsExpanded}
              onToggle={handleToggleAnalytics}
              stats={healthStats}
              samples={healthSamples}
            />
          )}

          {/* Application Launcher Card Grid */}
          {(currentTab === 'dashboard' || currentTab === 'apps') && (
            <AppGrid
              apps={apps}
              onReorder={handleReorder}
              onEditApp={(app) => setEditingApp(app)}
              onRefetchIcon={handleRefetchIcon}
              onHideApp={handleHideApp}
              searchQuery={searchQuery}
              onOpenNpmSettings={() => {
                setSettingsInitialTab('npm');
                setIsSettingsOpen(true);
              }}
            />
          )}
        </main>
      </div>

      {/* Modals */}
      <EditAppModal
        app={editingApp}
        isOpen={Boolean(editingApp)}
        onClose={() => setEditingApp(null)}
        onSave={handleSaveAppDetails}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        initialTab={settingsInitialTab}
      />
    </div>
  );
};
