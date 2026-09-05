import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/database.js';
import { config } from '../config.js';

export interface UserRecord {
  id: string;
  username: string;
  email: string;
  password_hash: string;
  display_name: string | null;
  avatar_url: string | null;
  role: 'admin' | 'user';
  totp_secret: string | null;
  totp_enabled: number;
  backup_codes: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserPreferencesRecord {
  user_id: string;
  theme_mode: string;
  custom_theme_json: string | null;
  npm_endpoint: string | null;
  npm_identity: string | null;
  npm_secret_encrypted: string | null;
  cf_account_id?: string | null;
  cf_token_encrypted?: string | null;
  cf_tunnel_id?: string | null;
  cf_tunnel_name?: string | null;
  card_order: string | null;
  hidden_apps: string | null;
  show_analytics: number;
}

export interface SafeUser {
  id: string;
  username: string;
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
  role: 'admin' | 'user';
  totpEnabled: boolean;
  preferences: {
    themeMode: string;
    customThemeJson: string | null;
    npmEndpoint: string | null;
    npmIdentity: string | null;
    hasSavedNpmSecret: boolean;
    cfAccountId: string | null;
    cfTunnelId: string | null;
    cfTunnelName: string | null;
    hasSavedCfToken: boolean;
    cardOrder: string[];
    hiddenApps: string[];
    showAnalytics: boolean;
  };
}

export function sanitizeUser(user: UserRecord, prefs?: UserPreferencesRecord | null): SafeUser {
  let cardOrder: string[] = [];
  let hiddenApps: string[] = [];

  if (prefs?.card_order) {
    try { cardOrder = JSON.parse(prefs.card_order); } catch { /* ignore */ }
  }
  if (prefs?.hidden_apps) {
    try { hiddenApps = JSON.parse(prefs.hidden_apps); } catch { /* ignore */ }
  }

  return {
    id: user.id,
    username: user.username,
    email: user.email,
    displayName: user.display_name,
    avatarUrl: user.avatar_url,
    role: user.role,
    totpEnabled: Boolean(user.totp_enabled),
    preferences: {
      themeMode: prefs?.theme_mode || 'dark',
      customThemeJson: prefs?.custom_theme_json || null,
      npmEndpoint: prefs?.npm_endpoint || null,
      npmIdentity: prefs?.npm_identity || null,
      hasSavedNpmSecret: Boolean(prefs?.npm_secret_encrypted),
      cfAccountId: prefs?.cf_account_id || null,
      cfTunnelId: prefs?.cf_tunnel_id || null,
      cfTunnelName: prefs?.cf_tunnel_name || null,
      hasSavedCfToken: Boolean(prefs?.cf_token_encrypted),
      cardOrder,
      hiddenApps,
      showAnalytics: prefs ? Boolean(prefs.show_analytics) : true,
    },
  };
}


export function bootstrapAdminUser(): void {
  const countRow = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
  if (countRow.count === 0) {
    console.log(`[Gatekeeper] Initializing database: Provisioning initial admin user (${config.initialAdminEmail})...`);
    const adminId = uuidv4();
    const passwordHash = bcrypt.hashSync(config.initialAdminPassword, 12);
    const username = config.initialAdminEmail.split('@')[0] || 'admin';

    db.transaction(() => {
      db.prepare(`
        INSERT INTO users (id, username, email, password_hash, display_name, role)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(adminId, username, config.initialAdminEmail, passwordHash, 'Administrator', 'admin');

      db.prepare(`
        INSERT INTO user_preferences (user_id, theme_mode, show_analytics)
        VALUES (?, 'dark', 1)
      `).run(adminId);
    })();

    console.log(`[Gatekeeper] Initial admin user provisioned successfully.`);
  }
}

export function findUserByEmailOrUsername(identifier: string): UserRecord | undefined {
  return db.prepare(`
    SELECT * FROM users 
    WHERE LOWER(email) = LOWER(?) OR LOWER(username) = LOWER(?)
  `).get(identifier, identifier) as UserRecord | undefined;
}

export function findUserById(id: string): UserRecord | undefined {
  return db.prepare('SELECT * FROM users WHERE id = ?').get(id) as UserRecord | undefined;
}

export function getUserPreferences(userId: string): UserPreferencesRecord | undefined {
  let prefs = db.prepare('SELECT * FROM user_preferences WHERE user_id = ?').get(userId) as UserPreferencesRecord | undefined;
  if (!prefs) {
    db.prepare('INSERT OR IGNORE INTO user_preferences (user_id, theme_mode, show_analytics) VALUES (?, "dark", 1)').run(userId);
    prefs = db.prepare('SELECT * FROM user_preferences WHERE user_id = ?').get(userId) as UserPreferencesRecord | undefined;
  }
  return prefs;
}

export function createJwtToken(userId: string, role: string): string {
  return jwt.sign({ sub: userId, role, type: 'auth' }, config.jwtSecret, { expiresIn: '7d' });
}

export function createTotpChallengeToken(userId: string): string {
  return jwt.sign({ sub: userId, type: 'totp_challenge' }, config.jwtSecret, { expiresIn: '3m' });
}

export function verifyJwtToken(token: string): { sub: string; role?: string; type: string } | null {
  try {
    return jwt.verify(token, config.jwtSecret) as { sub: string; role?: string; type: string };
  } catch {
    return null;
  }
}
