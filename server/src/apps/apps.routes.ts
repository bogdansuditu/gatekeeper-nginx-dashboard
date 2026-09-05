import { FastifyPluginAsync } from 'fastify';
import { db } from '../db/database.js';
import { verifyJwtToken, getUserPreferences } from '../auth/auth.service.js';
import { fetchAndCacheIcon } from '../icons/icon.scraper.js';

export const appsRoutes: FastifyPluginAsync = async (fastify) => {
  // Get all applications
  fastify.get('/api/v1/apps', async (request, reply) => {
    let currentUserId: string | null = null;
    const cookie = request.cookies.gatekeeper_token;
    if (cookie) {
      const decoded = verifyJwtToken(cookie);
      if (decoded && decoded.type === 'auth') {
        currentUserId = decoded.sub;
      }
    }

    const apps = db.prepare(`
      SELECT 
        id, source, source_id as npmHostId, domain_name as domainName,
        forward_scheme as forwardScheme, forward_host as forwardHost,
        forward_port as forwardPort, is_ssl as isSsl, is_enabled as isEnabled,
        custom_title as customTitle, custom_description as customDescription,
        favicon_path as faviconPath, last_known_status as status,
        last_response_time_ms as responseTimeMs, last_checked_at as lastCheckedAt
      FROM unified_applications
      WHERE is_enabled = 1
    `).all() as any[];

    // Process user preferences for card order and hidden cards
    let orderedApps = [...apps];
    if (currentUserId) {
      const prefs = getUserPreferences(currentUserId);
      if (prefs) {
        let cardOrder: string[] = [];
        let hiddenApps: string[] = [];

        try { if (prefs.card_order) cardOrder = JSON.parse(prefs.card_order); } catch {}
        try { if (prefs.hidden_apps) hiddenApps = JSON.parse(prefs.hidden_apps); } catch {}

        // Map apps by ID for re-ordering
        const appMap = new Map(apps.map((a) => [a.id, a]));
        const ordered: any[] = [];

        // Add ordered apps first
        for (const id of cardOrder) {
          if (appMap.has(id)) {
            ordered.push(appMap.get(id));
            appMap.delete(id);
          }
        }
        // Append any remaining newly discovered apps
        for (const remaining of appMap.values()) {
          ordered.push(remaining);
        }

        // Filter out hidden applications unless requested
        const { includeHidden } = request.query as { includeHidden?: string };
        if (includeHidden !== 'true') {
          const hiddenSet = new Set(hiddenApps);
          orderedApps = ordered.filter((a) => !hiddenSet.has(a.id));
        } else {
          orderedApps = ordered.map((a) => ({
            ...a,
            isHidden: hiddenApps.includes(a.id),
          }));
        }
      }
    }

    return { apps: orderedApps };
  });

  // Update application card metadata (custom title, description, or hide state)
  fastify.put('/api/v1/apps/:id', async (request, reply) => {
    const cookie = request.cookies.gatekeeper_token;
    if (!cookie) return reply.status(401).send({ error: 'Unauthenticated' });
    const decoded = verifyJwtToken(cookie);
    if (!decoded) return reply.status(401).send({ error: 'Unauthorized' });

    const { id } = request.params as { id: string };
    const { customTitle, customDescription, isHidden } = request.body as {
      customTitle?: string;
      customDescription?: string;
      isHidden?: boolean;
    };

    if (customTitle !== undefined || customDescription !== undefined) {
      const npmRes = db.prepare(`
        UPDATE npm_applications
        SET custom_title = coalesce(?, custom_title),
            custom_description = coalesce(?, custom_description)
        WHERE id = ?
      `).run(customTitle || null, customDescription || null, id);

      if (npmRes.changes === 0) {
        db.prepare(`
          UPDATE cloudflare_applications
          SET custom_title = coalesce(?, custom_title),
              custom_description = coalesce(?, custom_description)
          WHERE id = ?
        `).run(customTitle || null, customDescription || null, id);
      }
    }

    if (isHidden !== undefined) {
      const prefs = getUserPreferences(decoded.sub);
      let hiddenApps: string[] = [];
      try { if (prefs?.hidden_apps) hiddenApps = JSON.parse(prefs.hidden_apps); } catch {}

      if (isHidden && !hiddenApps.includes(id)) {
        hiddenApps.push(id);
      } else if (!isHidden) {
        hiddenApps = hiddenApps.filter((appId) => appId !== id);
      }

      db.prepare('UPDATE user_preferences SET hidden_apps = ? WHERE user_id = ?')
        .run(JSON.stringify(hiddenApps), decoded.sub);
    }

    return reply.send({ success: true, message: 'Card updated successfully' });
  });

  // Force re-fetch favicon
  fastify.post('/api/v1/apps/:id/refetch-icon', async (request, reply) => {
    const cookie = request.cookies.gatekeeper_token;
    if (!cookie) return reply.status(401).send({ error: 'Unauthenticated' });

    const { id } = request.params as { id: string };
    let app = db.prepare('SELECT * FROM npm_applications WHERE id = ?').get(id) as any;
    let sourceTable = 'npm_applications';
    if (!app) {
      app = db.prepare('SELECT * FROM cloudflare_applications WHERE id = ?').get(id) as any;
      sourceTable = 'cloudflare_applications';
    }
    if (!app) return reply.status(404).send({ error: 'Application not found' });

    const title = app.custom_title || app.domain_name.split('.')[0];
    const iconPath = await fetchAndCacheIcon(app.id, app.domain_name, app.is_ssl ? 'https' : app.forward_scheme, title);
    db.prepare(`UPDATE ${sourceTable} SET favicon_path = ? WHERE id = ?`).run(iconPath, app.id);

    return reply.send({ success: true, faviconPath: iconPath });
  });


  // Save Card Drag-and-Drop Order
  fastify.post('/api/v1/apps/order', async (request, reply) => {
    const cookie = request.cookies.gatekeeper_token;
    if (!cookie) return reply.status(401).send({ error: 'Unauthenticated' });
    const decoded = verifyJwtToken(cookie);
    if (!decoded) return reply.status(401).send({ error: 'Unauthorized' });

    const { cardOrder } = request.body as { cardOrder?: string[] };
    if (!Array.isArray(cardOrder)) {
      return reply.status(400).send({ error: 'cardOrder must be an array of application IDs' });
    }

    db.prepare('UPDATE user_preferences SET card_order = ? WHERE user_id = ?')
      .run(JSON.stringify(cardOrder), decoded.sub);

    return reply.send({ success: true, message: 'Order saved' });
  });
};
