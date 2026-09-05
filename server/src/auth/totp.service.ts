import crypto from 'node:crypto';
import { authenticator } from 'otplib';
import QRCode from 'qrcode';
import { config } from '../config.js';

// Setup otplib options
authenticator.options = {
  window: 1, // Allow 1 step before/after for slight clock drift
};

// Derive 32-byte encryption key from JWT secret for AES-256-GCM
const ENCRYPTION_KEY = crypto.createHash('sha256').update(config.jwtSecret).digest();
const ALGORITHM = 'aes-256-gcm';

export function encryptSecret(secret: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
  let encrypted = cipher.update(secret, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

export function decryptSecret(encryptedData: string): string {
  const parts = encryptedData.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted secret format');
  }
  const [ivHex, authTagHex, encryptedText] = parts;
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

export async function generateTotpSetup(userEmail: string): Promise<{ secret: string; otpauthUrl: string; qrCodeDataUrl: string }> {
  const secret = authenticator.generateSecret();
  const serviceName = 'Gatekeeper Dashboard';
  const otpauthUrl = authenticator.keyuri(userEmail, serviceName, secret);
  const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl, {
    errorCorrectionLevel: 'M',
    margin: 2,
    color: {
      dark: '#14152c',
      light: '#ffffff',
    },
  });

  return { secret, otpauthUrl, qrCodeDataUrl };
}

export function verifyTotpToken(token: string, secret: string): boolean {
  return authenticator.verify({ token, secret });
}

export function generateBackupCodes(count = 8): { rawCodes: string[]; hashedCodes: string[] } {
  const rawCodes: string[] = [];
  const hashedCodes: string[] = [];

  for (let i = 0; i < count; i++) {
    const raw = crypto.randomBytes(4).toString('hex').toUpperCase(); // e.g. "8FA12B04"
    const hashed = crypto.createHash('sha256').update(raw).digest('hex');
    rawCodes.push(raw);
    hashedCodes.push(hashed);
  }

  return { rawCodes, hashedCodes };
}

export function verifyBackupCode(code: string, hashedCodesJson: string | null): { valid: boolean; remainingHashedJson: string | null } {
  if (!hashedCodesJson) return { valid: false, remainingHashedJson: null };
  try {
    const hashedCodes: string[] = JSON.parse(hashedCodesJson);
    const candidateHash = crypto.createHash('sha256').update(code.trim().toUpperCase()).digest('hex');
    const index = hashedCodes.indexOf(candidateHash);
    if (index !== -1) {
      hashedCodes.splice(index, 1);
      return { valid: true, remainingHashedJson: JSON.stringify(hashedCodes) };
    }
    return { valid: false, remainingHashedJson: hashedCodesJson };
  } catch {
    return { valid: false, remainingHashedJson: null };
  }
}
