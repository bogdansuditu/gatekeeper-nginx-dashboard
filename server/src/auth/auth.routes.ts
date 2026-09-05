import { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import bcrypt from 'bcryptjs';
import {
  findUserByEmailOrUsername,
  findUserById,
  getUserPreferences,
  sanitizeUser,
  createJwtToken,
  createTotpChallengeToken,
  verifyJwtToken,
} from './auth.service.js';
import {
  generateTotpSetup,
  verifyTotpToken,
  encryptSecret,
  decryptSecret,
  generateBackupCodes,
  verifyBackupCode,
} from './totp.service.js';
import { db } from '../db/database.js';

// Map for pending 2FA activations: userId -> secret
const pendingTotpSetups = new Map<string, string>();

export const authRoutes: FastifyPluginAsync = async (fastify) => {
  // Login Endpoint
  fastify.post('/api/v1/auth/login', async (request: FastifyRequest, reply: FastifyReply) => {
    const { identifier, password } = request.body as { identifier?: string; password?: string };

    if (!identifier || !password) {
      return reply.status(400).send({ error: 'Username/Email and password are required' });
    }

    const user = findUserByEmailOrUsername(identifier);
    if (!user) {
      return reply.status(401).send({ error: 'Invalid credentials' });
    }

    const isMatch = bcrypt.compareSync(password, user.password_hash);
    if (!isMatch) {
      return reply.status(401).send({ error: 'Invalid credentials' });
    }

    // If 2FA is enabled, initiate challenge flow
    if (user.totp_enabled) {
      const challengeToken = createTotpChallengeToken(user.id);
      return reply.send({
        requires2FA: true,
        challengeToken,
        message: 'Two-factor authentication required',
      });
    }

    // Direct Login Successful
    const token = createJwtToken(user.id, user.role);
    reply.setCookie('gatekeeper_token', token, {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      secure: false, // support plain HTTP homelab deployments
      maxAge: 7 * 24 * 60 * 60, // 7 days
    });

    const prefs = getUserPreferences(user.id);
    return reply.send({
      user: sanitizeUser(user, prefs),
      message: 'Login successful',
    });
  });

  // 2FA Verification Endpoint
  fastify.post('/api/v1/auth/login/2fa', async (request: FastifyRequest, reply: FastifyReply) => {
    const { challengeToken, code } = request.body as { challengeToken?: string; code?: string };

    if (!challengeToken || !code) {
      return reply.status(400).send({ error: 'Challenge token and verification code are required' });
    }

    const decoded = verifyJwtToken(challengeToken);
    if (!decoded || decoded.type !== 'totp_challenge') {
      return reply.status(401).send({ error: 'Invalid or expired 2FA challenge. Please log in again.' });
    }

    const user = findUserById(decoded.sub);
    if (!user || !user.totp_enabled || !user.totp_secret) {
      return reply.status(400).send({ error: 'User does not have 2FA configured' });
    }

    let isValid = false;
    try {
      const secret = decryptSecret(user.totp_secret);
      isValid = verifyTotpToken(code.trim(), secret);
    } catch {
      isValid = false;
    }

    // Check emergency backup codes if standard TOTP verification failed
    if (!isValid && user.backup_codes) {
      const backupCheck = verifyBackupCode(code, user.backup_codes);
      if (backupCheck.valid) {
        isValid = true;
        // Update user record with remaining backup codes
        db.prepare('UPDATE users SET backup_codes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
          .run(backupCheck.remainingHashedJson, user.id);
      }
    }

    if (!isValid) {
      return reply.status(401).send({ error: 'Invalid authentication code' });
    }

    // 2FA Verification Successful
    const token = createJwtToken(user.id, user.role);
    reply.setCookie('gatekeeper_token', token, {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      secure: false,
      maxAge: 7 * 24 * 60 * 60,
    });

    const prefs = getUserPreferences(user.id);
    return reply.send({
      user: sanitizeUser(user, prefs),
      message: 'Two-factor authentication successful',
    });
  });

  // Logout Endpoint
  fastify.post('/api/v1/auth/logout', async (request: FastifyRequest, reply: FastifyReply) => {
    reply.clearCookie('gatekeeper_token', { path: '/' });
    return reply.send({ message: 'Logged out successfully' });
  });

  // Current User Profile Endpoint
  fastify.get('/api/v1/auth/me', async (request: FastifyRequest, reply: FastifyReply) => {
    const cookie = request.cookies.gatekeeper_token;
    if (!cookie) {
      return reply.status(401).send({ error: 'Unauthenticated' });
    }

    const decoded = verifyJwtToken(cookie);
    if (!decoded || decoded.type !== 'auth') {
      return reply.status(401).send({ error: 'Session expired or invalid' });
    }

    const user = findUserById(decoded.sub);
    if (!user) {
      return reply.status(401).send({ error: 'User not found' });
    }

    const prefs = getUserPreferences(user.id);
    return reply.send({ user: sanitizeUser(user, prefs) });
  });

  // 2FA Enrollment: Step 1 - Generate Setup (QR + Secret)
  fastify.post('/api/v1/auth/2fa/setup', async (request: FastifyRequest, reply: FastifyReply) => {
    const cookie = request.cookies.gatekeeper_token;
    if (!cookie) return reply.status(401).send({ error: 'Unauthenticated' });

    const decoded = verifyJwtToken(cookie);
    if (!decoded || decoded.type !== 'auth') return reply.status(401).send({ error: 'Unauthorized' });

    const user = findUserById(decoded.sub);
    if (!user) return reply.status(404).send({ error: 'User not found' });

    const setup = await generateTotpSetup(user.email);
    pendingTotpSetups.set(user.id, setup.secret);

    return reply.send({
      secret: setup.secret,
      otpauthUrl: setup.otpauthUrl,
      qrCodeDataUrl: setup.qrCodeDataUrl,
    });
  });

  // 2FA Enrollment: Step 2 - Verify and Activate
  fastify.post('/api/v1/auth/2fa/enable', async (request: FastifyRequest, reply: FastifyReply) => {
    const cookie = request.cookies.gatekeeper_token;
    if (!cookie) return reply.status(401).send({ error: 'Unauthenticated' });

    const decoded = verifyJwtToken(cookie);
    if (!decoded || decoded.type !== 'auth') return reply.status(401).send({ error: 'Unauthorized' });

    const { code } = request.body as { code?: string };
    if (!code) return reply.status(400).send({ error: 'Verification code is required' });

    const pendingSecret = pendingTotpSetups.get(decoded.sub);
    if (!pendingSecret) {
      return reply.status(400).send({ error: 'No 2FA setup in progress. Please request a new setup.' });
    }

    const isValid = verifyTotpToken(code.trim(), pendingSecret);
    if (!isValid) {
      return reply.status(400).send({ error: 'Invalid verification code. Please check your authenticator app.' });
    }

    const encryptedSecret = encryptSecret(pendingSecret);
    const { rawCodes, hashedCodes } = generateBackupCodes(8);

    db.prepare(`
      UPDATE users 
      SET totp_secret = ?, totp_enabled = 1, backup_codes = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(encryptedSecret, JSON.stringify(hashedCodes), decoded.sub);

    pendingTotpSetups.delete(decoded.sub);

    return reply.send({
      success: true,
      message: 'Two-factor authentication enabled successfully',
      backupCodes: rawCodes,
    });
  });

  // Disable 2FA
  fastify.post('/api/v1/auth/2fa/disable', async (request: FastifyRequest, reply: FastifyReply) => {
    const cookie = request.cookies.gatekeeper_token;
    if (!cookie) return reply.status(401).send({ error: 'Unauthenticated' });

    const decoded = verifyJwtToken(cookie);
    if (!decoded || decoded.type !== 'auth') return reply.status(401).send({ error: 'Unauthorized' });

    const { password } = request.body as { password?: string };
    if (!password) return reply.status(400).send({ error: 'Password is required to disable 2FA' });

    const user = findUserById(decoded.sub);
    if (!user) return reply.status(404).send({ error: 'User not found' });

    if (!bcrypt.compareSync(password, user.password_hash)) {
      return reply.status(401).send({ error: 'Incorrect password' });
    }

    db.prepare(`
      UPDATE users 
      SET totp_secret = NULL, totp_enabled = 0, backup_codes = NULL, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(user.id);

    return reply.send({ success: true, message: 'Two-factor authentication disabled' });
  });
};
