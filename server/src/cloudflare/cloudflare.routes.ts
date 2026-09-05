import { FastifyPluginAsync } from 'fastify';
import { verifyJwtToken, getUserPreferences } from '../auth/auth.service.js';
import { decryptSecret, encryptSecret } from '../auth/totp.service.js';
import { CloudflareClient } from './cloudflare.client.js';
import { syncCloudflareApps, resetCloudflareConfig, getCfSyncStatus } from './cloudflare.service.js';
import { db } from '../db/database.js';

export const cloudflareRoutes: FastifyPluginAsync = async (fastify) => {
  // Test connection to Cloudflare API
  fastify.post('/api/v1/cloudflare/test', async (request, reply) => {
    const cookie = request.cookies.gatekeeper_token;
    if (!cookie) return reply.status(401).send({ error: 'Unauthenticated' });
    const decoded = verifyJwtToken(cookie);
    if (!decoded) return reply.status(401).send({ error: 'Unauthorized' });

    const { accountId, apiToken } = request.body as {
      accountId?: string;
      apiToken?: string;
    };

    let effectiveAccountId = accountId?.trim();
    let effectiveToken = apiToken?.trim();

    // Fall back to saved preferences if token is omitted (e.g. testing existing saved credentials)
    if (!effectiveAccountId || !effectiveToken) {
      const prefs = getUserPreferences(decoded.sub);
      if (prefs?.cf_account_id && prefs?.cf_token_encrypted) {
        effectiveAccountId = effectiveAccountId || prefs.cf_account_id;
        try {
          effectiveToken = effectiveToken || decryptSecret(prefs.cf_token_encrypted);
        } catch {
          return reply.status(400).send({ success: false, message: 'Failed to decrypt saved Cloudflare token' });
        }
      }
    }

    if (!effectiveAccountId || !effectiveToken) {
      return reply.status(400).send({
        success: false,
        message: 'Cloudflare Account ID and API Token are required.',
      });
    }

    const client = new CloudflareClient(effectiveAccountId, effectiveToken);
    const result = await client.testConnection();
    return reply.send(result);
  });

  // Save settings & synchronize Cloudflare published applications
  fastify.post('/api/v1/cloudflare/sync', async (request, reply) => {
    const cookie = request.cookies.gatekeeper_token;
    if (!cookie) return reply.status(401).send({ error: 'Unauthenticated' });
    const decoded = verifyJwtToken(cookie);
    if (!decoded) return reply.status(401).send({ error: 'Unauthorized' });

    const { accountId, apiToken, tunnelId, tunnelName } = request.body as {
      accountId?: string;
      apiToken?: string;
      tunnelId?: string;
      tunnelName?: string;
    };

    let effectiveAccountId = accountId?.trim();
    let effectiveToken = apiToken?.trim();

    const prefs = getUserPreferences(decoded.sub);

    // If new credentials passed, persist them encrypted
    if (effectiveAccountId || effectiveToken || tunnelId !== undefined || tunnelName !== undefined) {
      const encryptedToken = effectiveToken ? encryptSecret(effectiveToken) : prefs?.cf_token_encrypted;
      const finalAccountId = effectiveAccountId || prefs?.cf_account_id;
      const finalTunnelId = tunnelId !== undefined ? tunnelId : (prefs?.cf_tunnel_id || 'all');
      const finalTunnelName = tunnelName !== undefined ? tunnelName : (prefs?.cf_tunnel_name || 'All Tunnels');

      db.prepare(`
        UPDATE user_preferences
        SET cf_account_id = ?, cf_token_encrypted = ?, cf_tunnel_id = ?, cf_tunnel_name = ?
        WHERE user_id = ?
      `).run(finalAccountId || null, encryptedToken || null, finalTunnelId, finalTunnelName, decoded.sub);
    }

    const status = await syncCloudflareApps({
      accountId: effectiveAccountId,
      apiToken: effectiveToken,
      tunnelId,
      tunnelName,
    });

    return reply.send(status);
  });

  // Reset Cloudflare configuration
  fastify.post('/api/v1/cloudflare/reset', async (request, reply) => {
    const cookie = request.cookies.gatekeeper_token;
    if (!cookie) return reply.status(401).send({ error: 'Unauthenticated' });
    const decoded = verifyJwtToken(cookie);
    if (!decoded) return reply.status(401).send({ error: 'Unauthorized' });

    resetCloudflareConfig(decoded.sub);
    return reply.send({ success: true, message: 'Cloudflare configuration reset successfully' });
  });

  // Get Cloudflare sync status
  fastify.get('/api/v1/cloudflare/status', async () => {
    return getCfSyncStatus();
  });
};
