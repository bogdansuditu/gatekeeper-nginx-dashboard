import React from 'react';
import { LayoutGrid, BarChart2, Layers, Settings, Users, LogOut, Sparkles } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface SidebarProps {
  currentTab: 'dashboard' | 'analytics' | 'apps' | 'users' | 'settings';
  onSelectTab: (tab: 'dashboard' | 'analytics' | 'apps' | 'users' | 'settings') => void;
  onOpenSettings: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentTab, onSelectTab, onOpenSettings }) => {
  const { user, logout } = useAuth();

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutGrid },
    { id: 'analytics', label: 'Analytics', icon: BarChart2 },
    { id: 'apps', label: 'Applications', icon: Layers },
  ];

  return (
    <aside className="w-16 md:w-20 h-screen sticky top-0 bg-surface-dark/95 border-r border-border-subtle flex flex-col items-center py-6 justify-between shrink-0 z-30 transition-all backdrop-blur-md">
      {/* Top Brand Logo */}
      <div className="flex flex-col items-center gap-8">
        <div 
          onClick={() => onSelectTab('dashboard')}
          className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent-primary to-accent-purple flex items-center justify-center shadow-lg shadow-accent-primary/20 cursor-pointer hover:scale-105 transition-transform"
          title="Gatekeeper NGINX Dashboard"
        >
          <Sparkles className="w-5 h-5 text-white animate-pulse" />
        </div>

        {/* Primary Navigation Icons */}
        <nav className="flex flex-col gap-4">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSelectTab(item.id as any)}
                title={item.label}
                className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all ${
                  isActive
                    ? 'bg-accent-primary text-white shadow-md shadow-accent-primary/30'
                    : 'text-text-secondary hover:text-white hover:bg-card-dark/60'
                }`}
              >
                <Icon className="w-5 h-5" />
              </button>
            );
          })}

          {/* Admin-only Users Icon */}
          {user?.role === 'admin' && (
            <button
              onClick={() => onSelectTab('users')}
              title="User Management"
              className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all ${
                currentTab === 'users'
                  ? 'bg-accent-primary text-white shadow-md shadow-accent-primary/30'
                  : 'text-text-secondary hover:text-white hover:bg-card-dark/60'
              }`}
            >
              <Users className="w-5 h-5" />
            </button>
          )}

          {/* Settings Trigger */}
          <button
            onClick={onOpenSettings}
            title="Settings & 2FA"
            className="w-11 h-11 rounded-xl flex items-center justify-center text-text-secondary hover:text-white hover:bg-card-dark/60 transition-all"
          >
            <Settings className="w-5 h-5" />
          </button>
        </nav>
      </div>

      {/* Bottom Actions: Logout */}
      <div className="flex flex-col items-center gap-3">
        <button
          onClick={() => logout()}
          title="Sign Out of Gatekeeper"
          className="w-11 h-11 rounded-xl flex items-center justify-center text-text-muted hover:text-status-critical hover:bg-status-critical/15 hover:border hover:border-status-critical/30 transition-all group"
        >
          <LogOut className="w-5 h-5 group-hover:scale-110 transition-transform" />
        </button>
      </div>
    </aside>
  );
};
