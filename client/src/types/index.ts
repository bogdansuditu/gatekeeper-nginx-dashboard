export interface AppItem {
  id: string;
  npmHostId: number;
  domainName: string;
  forwardScheme: string;
  forwardHost: string;
  forwardPort: number;
  isSsl: number;
  isEnabled: number;
  customTitle: string | null;
  customDescription: string | null;
  faviconPath: string | null;
  status: 'healthy' | 'down' | 'degraded' | 'unknown';
  responseTimeMs: number;
  lastCheckedAt: string | null;
  isHidden?: boolean;
}

export interface UserPreferences {
  themeMode: string;
  customThemeJson: string | null;
  npmEndpoint: string | null;
  npmIdentity: string | null;
  hasSavedNpmSecret?: boolean;
  cardOrder: string[];
  hiddenApps: string[];
  showAnalytics: boolean;
}

export interface User {
  id: string;
  username: string;
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
  role: 'admin' | 'user';
  totpEnabled: boolean;
  preferences: UserPreferences;
}

export interface HealthStats {
  totalApps: number;
  onlineApps: number;
  downApps: number;
  degradedApps: number;
  avgLatencyMs: number;
  healthRatio: number;
  protocolStats: {
    httpsCount: number;
    httpCount: number;
  };
  portStats: {
    standardWebPorts: number;
    customPorts: number;
  };
  syncStatus: {
    lastSyncAt: string | null;
    status: 'idle' | 'syncing' | 'connected' | 'demo' | 'error';
    message: string;
    hostCount: number;
  };
}

export interface HealthSample {
  id: number;
  timestamp: string;
  onlineCount: number;
  downCount: number;
  totalCount: number;
  avgLatencyMs: number;
}
