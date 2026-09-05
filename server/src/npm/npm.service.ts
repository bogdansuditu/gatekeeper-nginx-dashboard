import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/database.js';
import { config } from '../config.js';
import { NpmClient, NpmProxyHostResponse } from './npm.client.js';
import { fetchAndCacheIcon } from '../icons/icon.scraper.js';
import { decryptSecret } from '../auth/totp.service.js';

export interface SyncStatus {
  lastSyncAt: string | null;
  status: 'idle' | 'syncing' | 'connected' | 'demo' | 'error';
  message: string;
  hostCount: number;
}

let currentSyncStatus: SyncStatus = {
  lastSyncAt: null,
  status: 'idle',
  message: 'Initialized',
  hostCount: 0,
};

export function getSyncStatus(): SyncStatus {
  const countRow = db.prepare('SELECT COUNT(*) as count FROM npm_applications').get() as { count: number };
  return {
    ...currentSyncStatus,
    hostCount: countRow.count,
  };
}

export function inferAppTitle(domain: string): string {
  const parts = domain.split('.');
  const sub = parts[0] || 'App';
  // Capitalize nicely (e.g. "vaultwarden" -> "Vaultwarden")
  return sub.charAt(0).toUpperCase() + sub.slice(1);
}

export async function seedDemoApplications(): Promise<void> {
  const countRow = db.prepare('SELECT COUNT(*) as count FROM npm_applications').get() as { count: number };
  if (countRow.count > 0) return;

  console.log('[Gatekeeper] Seeding realistic sample applications for Demo Mode...');
  const demoApps = [
    {
      id: 'demo-grafana',
      npm_host_id: 101,
      domain_name: 'grafana.homelab.local',
      forward_scheme: 'http',
      forward_host: '192.168.1.120',
      forward_port: 3000,
      is_ssl: 1,
      custom_title: 'Grafana Metrics',
      custom_description: 'Infrastructure dashboards & alerting',
      last_known_status: 'healthy',
      last_response_time_ms: 24,
    },
    {
      id: 'demo-vaultwarden',
      npm_host_id: 102,
      domain_name: 'vault.homelab.local',
      forward_scheme: 'https',
      forward_host: '192.168.1.125',
      forward_port: 8080,
      is_ssl: 1,
      custom_title: 'Vaultwarden',
      custom_description: 'Bitwarden compatible password manager',
      last_known_status: 'healthy',
      last_response_time_ms: 18,
    },
    {
      id: 'demo-nextcloud',
      npm_host_id: 103,
      domain_name: 'cloud.homelab.local',
      forward_scheme: 'https',
      forward_host: '192.168.1.130',
      forward_port: 8443,
      is_ssl: 1,
      custom_title: 'Nextcloud Hub',
      custom_description: 'Private cloud storage & file sync',
      last_known_status: 'healthy',
      last_response_time_ms: 42,
    },
    {
      id: 'demo-plex',
      npm_host_id: 104,
      domain_name: 'plex.homelab.local',
      forward_scheme: 'http',
      forward_host: '192.168.1.140',
      forward_port: 32400,
      is_ssl: 0,
      custom_title: 'Plex Media Server',
      custom_description: 'Local streaming media library',
      last_known_status: 'healthy',
      last_response_time_ms: 12,
    },
    {
      id: 'demo-homeassistant',
      npm_host_id: 105,
      domain_name: 'hass.homelab.local',
      forward_scheme: 'http',
      forward_host: '192.168.1.150',
      forward_port: 8123,
      is_ssl: 1,
      custom_title: 'Home Assistant',
      custom_description: 'Smart home automation coordinator',
      last_known_status: 'healthy',
      last_response_time_ms: 31,
    },
    {
      id: 'demo-portainer',
      npm_host_id: 106,
      domain_name: 'portainer.homelab.local',
      forward_scheme: 'https',
      forward_host: '192.168.1.160',
      forward_port: 9443,
      is_ssl: 1,
      custom_title: 'Portainer CE',
      custom_description: 'Container management cluster UI',
      last_known_status: 'healthy',
      last_response_time_ms: 22,
    },
    {
      id: 'demo-uptimekuma',
      npm_host_id: 107,
      domain_name: 'status.homelab.local',
      forward_scheme: 'http',
      forward_host: '192.168.1.170',
      forward_port: 3001,
      is_ssl: 0,
      custom_title: 'Uptime Kuma',
      custom_description: 'Service uptime & heartbeat monitor',
      last_known_status: 'healthy',
      last_response_time_ms: 15,
    },
    {
      id: 'demo-npm',
      npm_host_id: 108,
      domain_name: 'npm.homelab.local',
      forward_scheme: 'http',
      forward_host: '192.168.1.200',
      forward_port: 81,
      is_ssl: 0,
      custom_title: 'Nginx Proxy Manager',
      custom_description: 'Reverse proxy gateway administration',
      last_known_status: 'healthy',
      last_response_time_ms: 9,
    },
    {
      id: 'demo-pihole',
      npm_host_id: 109,
      domain_name: 'pihole.homelab.local',
      forward_scheme: 'http',
      forward_host: '192.168.1.210',
      forward_port: 80,
      is_ssl: 0,
      custom_title: 'Pi-hole DNS',
      custom_description: 'Network-wide ad blocker & local DNS',
      last_known_status: 'down',
      last_response_time_ms: 0,
    },
  ];

  const insertStmt = db.prepare(`
    INSERT INTO npm_applications (
      id, npm_host_id, domain_name, forward_scheme, forward_host, forward_port,
      is_ssl, is_enabled, custom_title, custom_description, favicon_path,
      last_known_status, last_response_time_ms, last_checked_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
  `);

  db.transaction(() => {
    for (const app of demoApps) {
      const iconFilename = `${app.id}.svg`;
      insertStmt.run(
        app.id,
        app.npm_host_id,
        app.domain_name,
        app.forward_scheme,
        app.forward_host,
        app.forward_port,
        app.is_ssl,
        app.custom_title,
        app.custom_description,
        iconFilename,
        app.last_known_status,
        app.last_response_time_ms
      );
    }
  })();

  // Generate initial SVG icons for demo apps
  for (const app of demoApps) {
    try {
      await fetchAndCacheIcon(app.id, app.domain_name, app.forward_scheme, app.custom_title);
    } catch {
      // Ignore initial scrape errors
    }
  }

  currentSyncStatus = {
    lastSyncAt: new Date().toISOString(),
    status: 'demo',
    message: 'Running in Demo Mode with 9 sample applications',
    hostCount: demoApps.length,
  };
}

export async function syncNpmHosts(overrideEndpoint?: { host: string; user: string; pass: string }): Promise<SyncStatus> {
  let host = overrideEndpoint?.host;
  let user = overrideEndpoint?.user;
  let pass = overrideEndpoint?.pass;

  // 1. If not provided directly, inspect user_preferences for configured NPM credentials
  if (!host || !user || !pass) {
    const savedPrefs = db.prepare(`
      SELECT npm_endpoint, npm_identity, npm_secret_encrypted
      FROM user_preferences
      WHERE npm_endpoint IS NOT NULL AND npm_identity IS NOT NULL AND npm_secret_encrypted IS NOT NULL
      LIMIT 1
    `).get() as { npm_endpoint: string; npm_identity: string; npm_secret_encrypted: string } | undefined;

    if (savedPrefs) {
      try {
        host = savedPrefs.npm_endpoint;
        user = savedPrefs.npm_identity;
        pass = decryptSecret(savedPrefs.npm_secret_encrypted);
      } catch (e) {
        console.error('[Gatekeeper] Failed to decrypt saved user NPM secret:', e);
      }
    }
  }

  // 2. Fall back to environment defaults if still not configured (ignore deprecated nginx-proxy-manager alias)
  if (!host || !user || !pass) {
    if (config.npmDefaultHost && config.npmDefaultHost !== 'http://nginx-proxy-manager:81' && config.npmDefaultUser && config.npmDefaultPass) {
      host = config.npmDefaultHost;
      user = config.npmDefaultUser;
      pass = config.npmDefaultPass;
    }
  }

  // 3. If completely unconfigured, serve demo data only if NO user has configured an NPM endpoint
  if (!host || !user || !pass) {
    const countRow = db.prepare('SELECT COUNT(*) as count FROM npm_applications').get() as { count: number };
    const hasAnyConfigured = db.prepare(`
      SELECT COUNT(*) as count FROM user_preferences WHERE npm_endpoint IS NOT NULL AND npm_endpoint != ''
    `).get() as { count: number };

    if (countRow.count === 0 && config.enableDemoData && hasAnyConfigured.count === 0) {
      await seedDemoApplications();
      return getSyncStatus();
    }
    currentSyncStatus = {
      lastSyncAt: currentSyncStatus.lastSyncAt,
      status: 'idle',
      message: 'NPM endpoint pending configuration',
      hostCount: countRow.count,
    };
    return currentSyncStatus;
  }

  currentSyncStatus.status = 'syncing';
  currentSyncStatus.message = 'Connecting to Nginx Proxy Manager...';

  try {
    const client = new NpmClient(host, user, pass);
    const proxyHosts: NpmProxyHostResponse[] = await client.getProxyHosts();

    const activeHosts = proxyHosts.filter((h) => Boolean(h.enabled));

    // WIPE all demo applications once we successfully connect to a real NPM instance!
    db.prepare("DELETE FROM npm_applications WHERE id LIKE 'demo-%'").run();

    const existingApps = db.prepare('SELECT * FROM npm_applications').all() as any[];
    const existingByHostId = new Map(existingApps.map((a) => [a.npm_host_id, a]));

    const upsertStmt = db.prepare(`
      INSERT INTO npm_applications (
        id, npm_host_id, domain_name, forward_scheme, forward_host, forward_port,
        is_ssl, is_enabled, custom_title, custom_description, favicon_path
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(npm_host_id) DO UPDATE SET
        domain_name = excluded.domain_name,
        forward_scheme = excluded.forward_scheme,
        forward_host = excluded.forward_host,
        forward_port = excluded.forward_port,
        is_ssl = excluded.is_ssl,
        is_enabled = excluded.is_enabled
    `);

    for (const npmHost of activeHosts) {
      const primaryDomain = npmHost.domain_names && npmHost.domain_names.length > 0
        ? npmHost.domain_names[0]
        : `host-${npmHost.id}.local`;
      const isSsl = (Boolean(npmHost.ssl_forced) || (npmHost.certificate_id && npmHost.certificate_id > 0)) ? 1 : 0;
      const title = inferAppTitle(primaryDomain);

      let appId = uuidv4();
      let existingFavicon: string | null = null;
      if (existingByHostId.has(npmHost.id)) {
        const existing = existingByHostId.get(npmHost.id);
        appId = existing.id;
        existingFavicon = existing.favicon_path;
      }

      upsertStmt.run(
        appId,
        npmHost.id,
        primaryDomain,
        npmHost.forward_scheme,
        npmHost.forward_host,
        npmHost.forward_port,
        isSsl,
        1,
        existingByHostId.get(npmHost.id)?.custom_title || title,
        existingByHostId.get(npmHost.id)?.custom_description || `Forwarded to ${npmHost.forward_host}:${npmHost.forward_port}`,
        existingFavicon
      );

      // Trigger asynchronous icon fetch if not yet present
      if (!existingFavicon) {
        fetchAndCacheIcon(appId, primaryDomain, isSsl ? 'https' : npmHost.forward_scheme, title)
          .then((iconPath) => {
            db.prepare('UPDATE npm_applications SET favicon_path = ? WHERE id = ?').run(iconPath, appId);
          })
          .catch(() => {});
      }
    }

    // Clean up hosts removed from NPM
    const currentHostIds = new Set(activeHosts.map((h) => h.id));
    for (const app of existingApps) {
      if (!currentHostIds.has(app.npm_host_id)) {
        db.prepare('DELETE FROM npm_applications WHERE id = ?').run(app.id);
      }
    }

    currentSyncStatus = {
      lastSyncAt: new Date().toISOString(),
      status: 'connected',
      message: `Successfully synchronized ${activeHosts.length} hosts from NPM`,
      hostCount: activeHosts.length,
    };
  } catch (err: any) {
    console.error('[Gatekeeper] NPM Sync error:', err.message);
    const existingCount = (db.prepare('SELECT COUNT(*) as count FROM npm_applications').get() as any).count;
    currentSyncStatus = {
      lastSyncAt: currentSyncStatus.lastSyncAt,
      status: 'error',
      message: `NPM connection failed: ${err.message}`,
      hostCount: existingCount,
    };
  }

  return getSyncStatus();
}
