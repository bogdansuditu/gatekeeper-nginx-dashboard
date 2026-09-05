import { FastifyPluginAsync } from 'fastify';
import { getSyncStatus, syncNpmHosts } from './npm.service.js';
import { NpmClient } from './npm.client.js';
import { verifyJwtToken, getUserPreferences } from '../auth/auth.service.js';
import { encryptSecret, decryptSecret } from '../auth/totp.service.js';
import { db } from '../db/database.js';

export const npmRoutes: FastifyPluginAsync = async (fastify) => {
  // Sync Status
  fastify.get('/api/v1/npm/status', async () => {
    return getSyncStatus();
  });

  // Trigger Manual Sync (with optional runtime endpoint credentials)
  fastify.post('/api/v1/npm/sync', async (request, reply) => {
    const cookie = request.cookies.gatekeeper_token;
    if (!cookie) return reply.status(401).send({ error: 'Unauthenticated' });
    const decoded = verifyJwtToken(cookie);
    if (!decoded) return reply.status(401).send({ error: 'Unauthorized' });

    const body = request.body as { host?: string; identity?: string; secret?: string } | undefined;
    const prefs = getUserPreferences(decoded.sub);
    const host = body?.host?.trim() || prefs?.npm_endpoint || '';
    const identity = body?.identity?.trim() || prefs?.npm_identity || '';
    let secret = body?.secret?.trim();

    if (!secret && prefs?.npm_secret_encrypted) {
      try {
        secret = decryptSecret(prefs.npm_secret_encrypted);
      } catch (e) {
        console.error('[Gatekeeper] Could not decrypt user NPM secret:', e);
      }
    }

    let override: { host: string; user: string; pass: string } | undefined;
    if (host && identity && secret) {
      override = { host, user: identity, pass: secret };
      // Persist updated credentials in user preferences
      db.prepare(`
        UPDATE user_preferences
        SET npm_endpoint = ?, npm_identity = ?, npm_secret_encrypted = ?
        WHERE user_id = ?
      `).run(host, identity, encryptSecret(secret), decoded.sub);
    }

    const status = await syncNpmHosts(override);
    return reply.send(status);
  });

  // Test NPM Connection
  fastify.post('/api/v1/npm/test', async (request, reply) => {
    const cookie = request.cookies.gatekeeper_token;
    if (!cookie) return reply.status(401).send({ error: 'Unauthenticated' });
    const decoded = verifyJwtToken(cookie);
    if (!decoded) return reply.status(401).send({ error: 'Unauthorized' });

    const body = request.body as { host?: string; identity?: string; secret?: string } | undefined;
    const prefs = getUserPreferences(decoded.sub);
    const host = body?.host?.trim() || prefs?.npm_endpoint;
    const identity = body?.identity?.trim() || prefs?.npm_identity;
    let secret = body?.secret?.trim();

    if (!secret && prefs?.npm_secret_encrypted) {
      try {
        secret = decryptSecret(prefs.npm_secret_encrypted);
      } catch {}
    }

    if (!host || !identity) {
      return reply.status(400).send({ error: 'Host and identity (email/username) are required' });
    }

    if (!secret) {
      return reply.status(400).send({ error: 'Password is required to test the connection' });
    }

    const client = new NpmClient(host, identity, secret);
    const result = await client.testConnection();
    return reply.send(result);
  });

  // Clear / Reset NPM Configuration
  fastify.post('/api/v1/npm/reset', async (request, reply) => {
    const cookie = request.cookies.gatekeeper_token;
    if (!cookie) return reply.status(401).send({ error: 'Unauthenticated' });
    const decoded = verifyJwtToken(cookie);
    if (!decoded) return reply.status(401).send({ error: 'Unauthorized' });

    db.prepare(`
      UPDATE user_preferences
      SET npm_endpoint = NULL, npm_identity = NULL, npm_secret_encrypted = NULL
      WHERE user_id = ?
    `).run(decoded.sub);

    return reply.send({ success: true, message: 'NPM configuration cleared' });
  });
};
