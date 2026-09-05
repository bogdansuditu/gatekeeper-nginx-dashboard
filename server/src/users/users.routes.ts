import { FastifyPluginAsync } from 'fastify';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/database.js';
import { verifyJwtToken, findUserById, getUserPreferences, sanitizeUser } from '../auth/auth.service.js';
import { encryptSecret } from '../auth/totp.service.js';

export const usersRoutes: FastifyPluginAsync = async (fastify) => {
  // Update Preferences (Theme, Show Analytics, NPM overrides)
  fastify.put('/api/v1/users/preferences', async (request, reply) => {
    const cookie = request.cookies.gatekeeper_token;
    if (!cookie) return reply.status(401).send({ error: 'Unauthenticated' });
    const decoded = verifyJwtToken(cookie);
    if (!decoded) return reply.status(401).send({ error: 'Unauthorized' });

    const {
      themeMode, customThemeJson, showAnalytics,
      npmEndpoint, npmIdentity, npmSecret,
      cfAccountId, cfTunnelId, cfTunnelName, cfToken,
    } = request.body as {
      themeMode?: string;
      customThemeJson?: string;
      showAnalytics?: boolean;
      npmEndpoint?: string;
      npmIdentity?: string;
      npmSecret?: string;
      cfAccountId?: string;
      cfTunnelId?: string;
      cfTunnelName?: string;
      cfToken?: string;
    };

    const current = getUserPreferences(decoded.sub);
    const newThemeMode = themeMode !== undefined ? themeMode : (current?.theme_mode || 'dark');
    const newCustomThemeJson = customThemeJson !== undefined ? customThemeJson : current?.custom_theme_json;
    const newShowAnalytics = showAnalytics !== undefined ? (showAnalytics ? 1 : 0) : (current?.show_analytics ?? 1);
    const newNpmEndpoint = npmEndpoint !== undefined ? npmEndpoint : current?.npm_endpoint;
    const newNpmIdentity = npmIdentity !== undefined ? npmIdentity : current?.npm_identity;
    const newNpmSecretEncrypted = npmSecret ? encryptSecret(npmSecret) : current?.npm_secret_encrypted;
    const newCfAccountId = cfAccountId !== undefined ? cfAccountId : current?.cf_account_id;
    const newCfTunnelId = cfTunnelId !== undefined ? cfTunnelId : current?.cf_tunnel_id;
    const newCfTunnelName = cfTunnelName !== undefined ? cfTunnelName : current?.cf_tunnel_name;
    const newCfTokenEncrypted = cfToken ? encryptSecret(cfToken) : current?.cf_token_encrypted;

    db.prepare(`
      UPDATE user_preferences
      SET theme_mode = ?, custom_theme_json = ?, show_analytics = ?,
          npm_endpoint = ?, npm_identity = ?, npm_secret_encrypted = ?,
          cf_account_id = ?, cf_tunnel_id = ?, cf_tunnel_name = ?, cf_token_encrypted = ?
      WHERE user_id = ?
    `).run(
      newThemeMode, newCustomThemeJson, newShowAnalytics,
      newNpmEndpoint, newNpmIdentity, newNpmSecretEncrypted,
      newCfAccountId, newCfTunnelId, newCfTunnelName, newCfTokenEncrypted,
      decoded.sub
    );

    const user = findUserById(decoded.sub);
    const prefs = getUserPreferences(decoded.sub);
    return reply.send({ success: true, user: user ? sanitizeUser(user, prefs) : null });
  });


  // Update Profile (Display name, email)
  fastify.put('/api/v1/users/profile', async (request, reply) => {
    const cookie = request.cookies.gatekeeper_token;
    if (!cookie) return reply.status(401).send({ error: 'Unauthenticated' });
    const decoded = verifyJwtToken(cookie);
    if (!decoded) return reply.status(401).send({ error: 'Unauthorized' });

    const { displayName, email } = request.body as { displayName?: string; email?: string };

    if (email) {
      const existing = db.prepare('SELECT id FROM users WHERE LOWER(email) = LOWER(?) AND id != ?').get(email, decoded.sub);
      if (existing) {
        return reply.status(400).send({ error: 'Email is already in use by another account' });
      }
    }

    db.prepare(`
      UPDATE users
      SET display_name = coalesce(?, display_name),
          email = coalesce(?, email),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(displayName || null, email || null, decoded.sub);

    const user = findUserById(decoded.sub);
    const prefs = getUserPreferences(decoded.sub);
    return reply.send({ success: true, user: user ? sanitizeUser(user, prefs) : null });
  });

  // Change Password
  fastify.post('/api/v1/users/change-password', async (request, reply) => {
    const cookie = request.cookies.gatekeeper_token;
    if (!cookie) return reply.status(401).send({ error: 'Unauthenticated' });
    const decoded = verifyJwtToken(cookie);
    if (!decoded) return reply.status(401).send({ error: 'Unauthorized' });

    const { currentPassword, newPassword } = request.body as { currentPassword?: string; newPassword?: string };
    if (!currentPassword || !newPassword) {
      return reply.status(400).send({ error: 'Current password and new password are required' });
    }
    if (newPassword.length < 8) {
      return reply.status(400).send({ error: 'New password must be at least 8 characters long' });
    }

    const user = findUserById(decoded.sub);
    if (!user || !bcrypt.compareSync(currentPassword, user.password_hash)) {
      return reply.status(401).send({ error: 'Current password is incorrect' });
    }

    const newHash = bcrypt.hashSync(newPassword, 12);
    db.prepare('UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(newHash, user.id);

    return reply.send({ success: true, message: 'Password updated successfully' });
  });

  // Admin Only: List Users
  fastify.get('/api/v1/users', async (request, reply) => {
    const cookie = request.cookies.gatekeeper_token;
    if (!cookie) return reply.status(401).send({ error: 'Unauthenticated' });
    const decoded = verifyJwtToken(cookie);
    if (!decoded || decoded.role !== 'admin') {
      return reply.status(403).send({ error: 'Forbidden: Admin privilege required' });
    }

    const users = db.prepare(`
      SELECT id, username, email, display_name as displayName, role,
             totp_enabled as totpEnabled, created_at as createdAt
      FROM users
      ORDER BY created_at ASC
    `).all();

    return reply.send({ users });
  });

  // Admin Only: Create User
  fastify.post('/api/v1/users', async (request, reply) => {
    const cookie = request.cookies.gatekeeper_token;
    if (!cookie) return reply.status(401).send({ error: 'Unauthenticated' });
    const decoded = verifyJwtToken(cookie);
    if (!decoded || decoded.role !== 'admin') {
      return reply.status(403).send({ error: 'Forbidden: Admin privilege required' });
    }

    const { username, email, password, displayName, role } = request.body as {
      username?: string;
      email?: string;
      password?: string;
      displayName?: string;
      role?: 'admin' | 'user';
    };

    if (!username || !email || !password) {
      return reply.status(400).send({ error: 'Username, email, and password are required' });
    }

    const existing = db.prepare('SELECT id FROM users WHERE LOWER(email) = LOWER(?) OR LOWER(username) = LOWER(?)')
      .get(email, username);
    if (existing) {
      return reply.status(400).send({ error: 'Username or email already exists' });
    }

    const newId = uuidv4();
    const hash = bcrypt.hashSync(password, 12);
    const assignedRole = role === 'admin' ? 'admin' : 'user';

    db.transaction(() => {
      db.prepare(`
        INSERT INTO users (id, username, email, password_hash, display_name, role)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(newId, username, email, hash, displayName || username, assignedRole);

      db.prepare('INSERT INTO user_preferences (user_id, theme_mode, show_analytics) VALUES (?, "dark", 1)')
        .run(newId);
    })();

    return reply.send({
      success: true,
      user: {
        id: newId,
        username,
        email,
        displayName: displayName || username,
        role: assignedRole,
        totpEnabled: false,
      },
    });
  });

  // Admin Only: Delete User
  fastify.delete('/api/v1/users/:id', async (request, reply) => {
    const cookie = request.cookies.gatekeeper_token;
    if (!cookie) return reply.status(401).send({ error: 'Unauthenticated' });
    const decoded = verifyJwtToken(cookie);
    if (!decoded || decoded.role !== 'admin') {
      return reply.status(403).send({ error: 'Forbidden: Admin privilege required' });
    }

    const { id } = request.params as { id: string };
    if (id === decoded.sub) {
      return reply.status(400).send({ error: 'Cannot delete your own account' });
    }

    db.prepare('DELETE FROM users WHERE id = ?').run(id);
    return reply.send({ success: true, message: 'User deleted' });
  });
};
