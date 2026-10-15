import crypto from 'node:crypto';

/**
 * Opaque session tokens. The raw token goes into the cookie; only its
 * SHA-256 digest is persisted — a DB leak never exposes usable tokens.
 */
export function generateSessionToken(): string {
  return crypto.randomBytes(32).toString('base64url');
}

export function hashSessionToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export const SESSION_COOKIE = 'hp_session';
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days, sliding
