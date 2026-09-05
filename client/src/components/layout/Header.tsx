import React, { useState, useRef, useEffect } from 'react';
import { Search, RefreshCw, Sun, Moon, ShieldCheck, ChevronDown, LogOut, Settings, Network, User } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { HealthStats } from '../../types';

interface HeaderProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  healthStats: HealthStats | null;
  onManualSync: () => void;
  isSyncing: boolean;
  onOpenSettings: (tab?: 'profile' | 'theme' | 'npm' | 'users') => void;
}

export const Header: React.FC<HeaderProps> = ({
  searchQuery,
  onSearchChange,
  healthStats,
  onManualSync,
  isSyncing,
  onOpenSettings,
}) => {
  const { user, logout } = useAuth();
  const { effectiveTheme, setThemeMode } = useTheme();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleTheme = () => {
    setThemeMode(effectiveTheme === 'dark' ? 'light' : 'dark');
  };

  const getSyncLabel = () => {
    if (!healthStats?.syncStatus) return 'Syncing...';
    if (healthStats.syncStatus.status === 'demo') return 'Demo Mode';
    if (healthStats.syncStatus.status === 'connected') return 'NPM Connected';
    if (healthStats.syncStatus.status === 'error') return 'Sync Alert';
    return 'Idle';
  };

  return (
    <header className="h-20 px-6 md:px-8 border-b border-border-subtle flex items-center justify-between gap-4 bg-canvas-dark/40 backdrop-blur-md sticky top-0 z-20">
      {/* Left: Greeting */}
      <div className="flex flex-col">
        <h1 className="text-lg md:text-xl font-bold text-text-primary flex items-center gap-2">
          Welcome back, {user?.displayName || user?.username || 'Admin'}
          {user?.totpEnabled && (
            <span title="2FA Protected" className="inline-flex items-center text-status-healthy">
              <ShieldCheck className="w-4 h-4" />
            </span>
          )}
        </h1>
        <p className="text-xs text-text-secondary hidden sm:block">
          Monitoring {healthStats?.totalApps ?? 0} proxy hosts & infrastructure endpoints
        </p>
      </div>

      {/* Middle & Right Controls */}
      <div className="flex items-center gap-3 md:gap-4">
        {/* Search Bar */}
        <div className="relative w-48 sm:w-64 md:w-72">
          <Search className="w-4 h-4 text-text-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search applications..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-surface-dark border border-border-subtle rounded-xl text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-border-focus transition-colors"
          />
        </div>

        {/* NPM Sync Status Badge & Button */}
        <div className="flex items-center gap-2 bg-surface-dark border border-border-subtle px-3 py-1.5 rounded-xl text-xs text-text-secondary">
          <span className={`w-2 h-2 rounded-full ${
            healthStats?.syncStatus?.status === 'demo' ? 'bg-amber-400' :
            healthStats?.syncStatus?.status === 'error' ? 'bg-status-critical' : 'bg-status-healthy'
          }`} />
          <span className="hidden sm:inline font-medium">{getSyncLabel()}</span>
          <button
            onClick={onManualSync}
            disabled={isSyncing}
            title="Force NPM Host Discovery Sync"
            className="text-text-muted hover:text-white transition-colors ml-1 p-0.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-accent-primary' : ''}`} />
          </button>
        </div>

        {/* Dark / Light Mode Switcher */}
        <button
          onClick={toggleTheme}
          title={`Switch to ${effectiveTheme === 'dark' ? 'Light' : 'Dark'} mode`}
          className="w-9 h-9 rounded-xl bg-surface-dark border border-border-subtle flex items-center justify-center text-text-secondary hover:text-white transition-colors"
        >
          {effectiveTheme === 'dark' ? <Sun className="w-4 h-4 text-amber-300" /> : <Moon className="w-4 h-4 text-accent-primary" />}
        </button>

        {/* User Profile Menu with Dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setIsDropdownOpen((prev) => !prev)}
            className="flex items-center gap-2 p-1.5 pl-2 pr-2.5 rounded-xl bg-surface-dark border border-border-subtle hover:border-border-focus transition-all group"
            title="User Profile & Settings"
          >
            <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-accent-primary to-accent-purple flex items-center justify-center text-xs font-bold text-white shadow-sm">
              {(user?.displayName || user?.username || 'A').charAt(0).toUpperCase()}
            </div>
            <ChevronDown className={`w-3.5 h-3.5 text-text-muted group-hover:text-white transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`} />
          </button>

          {isDropdownOpen && (
            <div className="absolute right-0 mt-2 w-64 bg-surface-dark border border-border-subtle rounded-2xl shadow-2xl py-2 z-50 animate-fade-in backdrop-blur-xl">
              {/* User Identity Info */}
              <div className="px-4 py-3 border-b border-border-subtle/60 flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-text-primary truncate">
                    {user?.displayName || user?.username}
                  </span>
                  <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-accent-primary/20 text-accent-primary border border-accent-primary/30">
                    {user?.role}
                  </span>
                </div>
                <span className="text-xs text-text-muted truncate">
                  {user?.email}
                </span>
              </div>

              {/* Actions List */}
              <div className="p-1.5 flex flex-col gap-1">
                <button
                  onClick={() => {
                    setIsDropdownOpen(false);
                    onOpenSettings('profile');
                  }}
                  className="w-full px-3 py-2 text-left text-xs font-medium text-text-secondary hover:text-white hover:bg-card-dark rounded-xl transition-colors flex items-center gap-2.5"
                >
                  <User className="w-4 h-4 text-text-muted" />
                  <span>Profile & Security</span>
                </button>

                <button
                  onClick={() => {
                    setIsDropdownOpen(false);
                    onOpenSettings('npm');
                  }}
                  className="w-full px-3 py-2 text-left text-xs font-medium text-text-secondary hover:text-white hover:bg-card-dark rounded-xl transition-colors flex items-center gap-2.5"
                >
                  <Network className="w-4 h-4 text-text-muted" />
                  <span>NPM Upstream Integration</span>
                </button>

                <button
                  onClick={() => {
                    setIsDropdownOpen(false);
                    onOpenSettings('theme');
                  }}
                  className="w-full px-3 py-2 text-left text-xs font-medium text-text-secondary hover:text-white hover:bg-card-dark rounded-xl transition-colors flex items-center gap-2.5"
                >
                  <Settings className="w-4 h-4 text-text-muted" />
                  <span>System Preferences</span>
                </button>
              </div>

              {/* Logout Option */}
              <div className="p-1.5 pt-2 border-t border-border-subtle/60">
                <button
                  onClick={() => {
                    setIsDropdownOpen(false);
                    logout();
                  }}
                  className="w-full px-3 py-2 text-left text-xs font-bold text-status-critical hover:bg-status-critical/15 rounded-xl transition-colors flex items-center gap-2.5"
                >
                  <LogOut className="w-4 h-4 text-status-critical" />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
