import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import Fastify from 'fastify';
import fastifyCookie from '@fastify/cookie';
import fastifyCors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import { config } from './config.js';
import { initDatabase } from './db/database.js';
import { bootstrapAdminUser } from './auth/auth.service.js';
import { authRoutes } from './auth/auth.routes.js';
import { npmRoutes } from './npm/npm.routes.js';
import { syncNpmHosts } from './npm/npm.service.js';
import { healthRoutes } from './health/health.routes.js';
import { runHealthCheckCycle, seedInitialHealthHistory } from './health/health.checker.js';
import { appsRoutes } from './apps/apps.routes.js';
import { iconRoutes } from './icons/icon.routes.js';
import { usersRoutes } from './users/users.routes.js';
import { cloudflareRoutes } from './cloudflare/cloudflare.routes.js';
import { syncCloudflareApps } from './cloudflare/cloudflare.service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  console.log('========================================================');
  console.log('  NGINX Dashboard (Gatekeeper Portal) - Docker Runtime  ');
  console.log('========================================================');

  // 1. Initialize SQLite Database & Schema
  initDatabase();

  // 2. Provision Initial Administrator User (strict env-based initialization)
  bootstrapAdminUser();

  // 3. Pre-populate Historical Health Telemetry
  seedInitialHealthHistory();

  // 4. Create Fastify Instance
  const server = Fastify({
    logger: {
      level: config.isProduction ? 'info' : 'debug',
    },
  });

  // 5. Register Core Plugins
  await server.register(fastifyCookie);
  await server.register(fastifyCors, {
    origin: true,
    credentials: true,
  });

  // 6. Register API Route Modules
  await server.register(authRoutes);
  await server.register(npmRoutes);
  await server.register(cloudflareRoutes);
  await server.register(healthRoutes);
  await server.register(appsRoutes);
  await server.register(iconRoutes);
  await server.register(usersRoutes);

  // 7. Register Static File Serving for Frontend SPA
  const publicDir = path.join(__dirname, 'public');
  if (fs.existsSync(publicDir)) {
    await server.register(fastifyStatic, {
      root: publicDir,
      prefix: '/',
      wildcard: false,
    });

    // SPA Fallback: send index.html for non-API client routes
    server.setNotFoundHandler((request, reply) => {
      if (request.url.startsWith('/api/')) {
        return reply.status(404).send({ error: 'Endpoint not found' });
      }
      return reply.sendFile('index.html');
    });
  } else {
    server.get('/', async () => {
      return {
        message: 'Gatekeeper NGINX Dashboard Backend API running.',
        status: 'online',
        hint: 'Frontend assets not mounted in dev mode.',
      };
    });
  }

  // 8. Start Background Periodic Schedulers
  console.log(`[Gatekeeper] Starting NPM sync interval (${config.syncIntervalMinutes}m)...`);
  setInterval(() => {
    syncNpmHosts().catch((err) => console.error('[Gatekeeper] Sync error:', err.message));
    syncCloudflareApps().catch((err) => console.error('[Gatekeeper] CF Sync error:', err.message));
  }, config.syncIntervalMinutes * 60 * 1000);

  console.log(`[Gatekeeper] Starting health monitor interval (${config.healthcheckIntervalSeconds}s)...`);
  setInterval(() => {
    runHealthCheckCycle().catch((err) => console.error('[Gatekeeper] Health check error:', err.message));
  }, config.healthcheckIntervalSeconds * 1000);

  // 9. Bind & Listen
  try {
    await server.listen({ port: config.port, host: config.host });
    console.log(`[Gatekeeper] Server successfully listening at http://${config.host}:${config.port}`);
    // Run initial host synchronization
    syncNpmHosts().catch((err) => console.error('[Gatekeeper] Initial sync error:', err.message));
    syncCloudflareApps().catch((err) => console.error('[Gatekeeper] Initial CF sync error:', err.message));
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
}


startServer();
