import path from 'node:path';
import fs from 'node:fs';

const isProduction = process.env.NODE_ENV === 'production';
const baseDataDir = fs.existsSync('/data') ? '/data' : path.resolve(process.cwd(), 'data');

export const config = {
  isProduction,
  port: parseInt(process.env.PORT || '3000', 10),
  host: process.env.HOST || '0.0.0.0',
  databasePath: process.env.DATABASE_PATH || path.join(baseDataDir, 'gatekeeper.sqlite'),
  cacheDir: process.env.CACHE_DIR || path.join(baseDataDir, 'cache'),
  faviconsDir: path.join(process.env.CACHE_DIR || path.join(baseDataDir, 'cache'), 'favicons'),
  avatarsDir: path.join(baseDataDir, 'avatars'),
  jwtSecret: process.env.JWT_SECRET || 'gatekeeper_ultra_secure_jwt_secret_change_me_in_prod_2026',
  
  // Initial Admin auto-provisioning
  initialAdminEmail: process.env.INITIAL_ADMIN_EMAIL || 'admin@example.com',
  initialAdminPassword: process.env.INITIAL_ADMIN_PASSWORD || 'adminpassword',
  allowPublicRegistration: process.env.ALLOW_PUBLIC_REGISTRATION === 'true',

  // Demo mode & SSL settings
  enableDemoData: process.env.ENABLE_DEMO_DATA !== 'false', // default true
  strictSSL: process.env.STRICT_SSL === 'true', // default false (permissive for homelabs)

  // NPM Defaults
  npmDefaultHost: process.env.NPM_DEFAULT_HOST || '',
  npmDefaultUser: process.env.NPM_DEFAULT_USER || '',
  npmDefaultPass: process.env.NPM_DEFAULT_PASS || '',
  npmTimeoutMs: parseInt(process.env.NPM_TIMEOUT_MS || '15000', 10),
  syncIntervalMinutes: parseInt(process.env.SYNC_INTERVAL_MINUTES || '5', 10),
  healthcheckIntervalSeconds: parseInt(process.env.HEALTHCHECK_INTERVAL_SECONDS || '60', 10),
};
