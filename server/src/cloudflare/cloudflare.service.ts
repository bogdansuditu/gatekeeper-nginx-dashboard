import { db } from '../db/database.js';
import { CloudflareClient, CloudflareTunnel } from './cloudflare.client.js';
import { decryptSecret } from '../auth/totp.service.js';
import { fetchAndCacheIcon } from '../icons/icon.scraper.js';

export interface CfSyncStatus {
  lastSyncAt: string | null;
  status: 'idle' | 'syncing' | 'connected' | 'error';
  message: string;
  hostCount: number;
}

let currentCfSyncStatus: CfSyncStatus = {
  lastSyncAt: null,
  status: 'idle',
  message: 'Cloudflare Tunnels integration unconfigured',
  hostCount: 0,
};

export function getCfSyncStatus(): CfSyncStatus {
  const countRow = db.prepare('SELECT COUNT(*) as count FROM cloudflare_applications').get() as { count: number };
  return {
    ...currentCfSyncStatus,
    hostCount: countRow?.count ?? 0,
  };
}

export interface ParsedServiceTarget {
  forwardScheme: string;
  forwardHost: string;
  forwardPort: number;
}

/**
 * Parses Cloudflare ingress service targets (e.g. http://192.168.1.120:3000, https://10.0.0.5)
 */
export function parseIngressService(service: string): ParsedServiceTarget | null {
  if (!service || service.startsWith('http_status:') || service === 'hello_world') {
    return null;
  }

  try {
    // Match scheme://host:port or scheme://host
    const urlMatch = service.match(/^([a-zA-Z]+):\/\/([^:/]+)(?::(\d+))?/);
    if (urlMatch) {
      const scheme = urlMatch[1].toLowerCase();
      const host = urlMatch[2];
      let port = urlMatch[3] ? parseInt(urlMatch[3], 10) : 0;
      if (!port) {
        if (scheme === 'https') port = 443;
        else if (scheme === 'http') port = 80;
        else if (scheme === 'ssh') port = 22;
        else if (scheme === 'rdp') port = 3389;
        else port = 80;
      }
      return {
        forwardScheme: scheme,
        forwardHost: host,
        forwardPort: port,
      };
    }

    // Host:port without scheme (e.g. "192.168.1.50:8080")
    const hostPortMatch = service.match(/^([^:/]+):(\d+)$/);
    if (hostPortMatch) {
      return {
        forwardScheme: 'http',
        forwardHost: hostPortMatch[1],
        forwardPort: parseInt(hostPortMatch[2], 10),
      };
    }

    return {
      forwardScheme: 'http',
      forwardHost: service,
      forwardPort: 80,
    };
  } catch {
    return null;
  }
}

export function inferAppTitle(domain: string): string {
  const parts = domain.split('.');
  const sub = parts[0] || 'App';
  return sub.charAt(0).toUpperCase() + sub.slice(1);
}

export async function syncCloudflareApps(overrideConfig?: {
  accountId?: string;
  apiToken?: string;
  tunnelId?: string;
  tunnelName?: string;
}): Promise<CfSyncStatus> {
  let accountId = overrideConfig?.accountId;
  let apiToken = overrideConfig?.apiToken;
  let tunnelId = overrideConfig?.tunnelId;
  let tunnelName = overrideConfig?.tunnelName;

  // 1. Inspect user_preferences if credentials not passed directly
  if (!accountId || !apiToken) {
    const savedPrefs = db.prepare(`
      SELECT cf_account_id, cf_token_encrypted, cf_tunnel_id, cf_tunnel_name
      FROM user_preferences
      WHERE cf_account_id IS NOT NULL AND cf_token_encrypted IS NOT NULL
      LIMIT 1
    `).get() as {
      cf_account_id: string;
      cf_token_encrypted: string;
      cf_tunnel_id: string | null;
      cf_tunnel_name: string | null;
    } | undefined;

    if (savedPrefs) {
      try {
        accountId = savedPrefs.cf_account_id;
        apiToken = decryptSecret(savedPrefs.cf_token_encrypted);
        tunnelId = savedPrefs.cf_tunnel_id || 'all';
        tunnelName = savedPrefs.cf_tunnel_name || undefined;
      } catch (e) {
        console.error('[Gatekeeper] Failed to decrypt Cloudflare API token:', e);
      }
    }
  }

  // 2. If unconfigured, return idle status
  if (!accountId || !apiToken) {
    const countRow = db.prepare('SELECT COUNT(*) as count FROM cloudflare_applications').get() as { count: number };
    currentCfSyncStatus = {
      lastSyncAt: currentCfSyncStatus.lastSyncAt,
      status: 'idle',
      message: 'Cloudflare credentials pending configuration',
      hostCount: countRow?.count ?? 0,
    };
    return currentCfSyncStatus;
  }

  currentCfSyncStatus.status = 'syncing';
  currentCfSyncStatus.message = 'Connecting to Cloudflare Zero Trust API...';

  try {
    const client = new CloudflareClient(accountId, apiToken);
    const allTunnels: CloudflareTunnel[] = await client.listTunnels();

    // Determine target tunnels to sync
    let targetTunnels: CloudflareTunnel[] = [];
    if (!tunnelId || tunnelId === 'all') {
      targetTunnels = allTunnels.filter((t) => t.status !== 'inactive' && t.status !== 'down');
      if (targetTunnels.length === 0) {
        targetTunnels = allTunnels; // fallback to all if status is unknown or down
      }
    } else {
      const match = allTunnels.find((t) => t.id === tunnelId);
      if (match) {
        targetTunnels = [match];
      } else {
        targetTunnels = [{ id: tunnelId, name: tunnelName || 'Selected Tunnel', status: 'healthy', created_at: '' }];
      }
    }

    const existingApps = db.prepare('SELECT * FROM cloudflare_applications').all() as any[];
    const existingMap = new Map(existingApps.map((a) => [`${a.tunnel_id}:${a.domain_name}`, a]));

    const upsertStmt = db.prepare(`
      INSERT INTO cloudflare_applications (
        id, tunnel_id, tunnel_name, domain_name, forward_scheme, forward_host,
        forward_port, is_ssl, is_enabled, custom_title, custom_description, favicon_path
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(tunnel_id, domain_name) DO UPDATE SET
        tunnel_name = excluded.tunnel_name,
        forward_scheme = excluded.forward_scheme,
        forward_host = excluded.forward_host,
        forward_port = excluded.forward_port,
        is_ssl = excluded.is_ssl,
        is_enabled = excluded.is_enabled
    `);

    let discoveredCount = 0;
    const activeKeysInCloudflare = new Set<string>();

    for (const tunnel of targetTunnels) {
      try {
        const configData = await client.getTunnelConfiguration(tunnel.id);
        const ingressRules = configData.config?.ingress || [];

        for (const rule of ingressRules) {
          if (!rule.hostname) continue; // Skip catch-alls like http_status:404
          const target = parseIngressService(rule.service);
          if (!target) continue;

          const key = `${tunnel.id}:${rule.hostname}`;
          activeKeysInCloudflare.add(key);

          // Deterministic unique ID for this tunnel + hostname
          const appId = `cf-${tunnel.id.slice(0, 8)}-${rule.hostname.replace(/[^a-zA-Z0-9_-]/g, '-')}`;
          const existing = existingMap.get(key);
          const title = existing?.custom_title || inferAppTitle(rule.hostname);
          const description = existing?.custom_description || `Forwarded to: ${target.forwardHost}:${target.forwardPort}`;
          const existingFavicon = existing?.favicon_path || null;

          upsertStmt.run(
            appId,
            tunnel.id,
            tunnel.name || 'Cloudflare Tunnel',
            rule.hostname,
            target.forwardScheme,
            target.forwardHost,
            target.forwardPort,
            1, // Public Cloudflare tunnels terminate SSL at edge
            1,
            title,
            description,
            existingFavicon
          );

          discoveredCount++;

          // Trigger asynchronous favicon scraper if not yet cached
          if (!existingFavicon) {
            fetchAndCacheIcon(appId, rule.hostname, 'https', title)
              .then((iconPath) => {
                db.prepare('UPDATE cloudflare_applications SET favicon_path = ? WHERE id = ?').run(iconPath, appId);
              })
              .catch(() => {});
          }
        }
      } catch (err: any) {
        console.warn(`[Gatekeeper] Warning: Failed to fetch ingress rules for tunnel ${tunnel.id}:`, err.message);
      }
    }

    // Prune removed ingress rules from target tunnels
    const targetTunnelIds = new Set(targetTunnels.map((t) => t.id));
    for (const app of existingApps) {
      if (targetTunnelIds.has(app.tunnel_id)) {
        const key = `${app.tunnel_id}:${app.domain_name}`;
        if (!activeKeysInCloudflare.has(key)) {
          db.prepare('DELETE FROM cloudflare_applications WHERE id = ?').run(app.id);
        }
      }
    }

    const currentCount = (db.prepare('SELECT COUNT(*) as count FROM cloudflare_applications').get() as any).count;
    currentCfSyncStatus = {
      lastSyncAt: new Date().toISOString(),
      status: 'connected',
      message: `Successfully synchronized ${discoveredCount} published application(s) from ${targetTunnels.length} Cloudflare tunnel(s).`,
      hostCount: currentCount,
    };
  } catch (err: any) {
    console.error('[Gatekeeper] Cloudflare Sync error:', err.message);
    const existingCount = (db.prepare('SELECT COUNT(*) as count FROM cloudflare_applications').get() as any).count;
    currentCfSyncStatus = {
      lastSyncAt: currentCfSyncStatus.lastSyncAt,
      status: 'error',
      message: `Cloudflare sync error: ${err.message}`,
      hostCount: existingCount,
    };
  }

  return getCfSyncStatus();
}

export function resetCloudflareConfig(userId: string): void {
  db.prepare(`
    UPDATE user_preferences
    SET cf_account_id = NULL, cf_token_encrypted = NULL, cf_tunnel_id = NULL, cf_tunnel_name = NULL
    WHERE user_id = ?
  `).run(userId);

  // Clear Cloudflare applications
  db.prepare('DELETE FROM cloudflare_applications').run();

  currentCfSyncStatus = {
    lastSyncAt: null,
    status: 'idle',
    message: 'Cloudflare configuration reset',
    hostCount: 0,
  };
}
