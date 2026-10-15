import type { User } from '@prisma/client';
import type { LoginInput, RegisterInput, Role, UserDto } from '@helpdesk/shared';
import { prisma } from '../../utils/prisma';
import { hashPassword, verifyPassword } from '../../utils/password';
import {
  generateSessionToken,
  hashSessionToken,
  SESSION_TTL_MS,
} from '../../utils/session-token';
import { errors } from '../../utils/errors';
import { emitDomainEvent } from '../../events/bus';

/** Serializes a User for the wire — passwordHash never leaves the server. */
export function toUserDto(user: User): UserDto {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    accountStatus: user.accountStatus,
    createdAt: user.createdAt.toISOString(),
  };
}

interface SessionResult {
  user: User;
  token: string;
  expiresAt: Date;
}

/** Every login creates a FRESH session row — fixation-safe by construction. */
async function createSession(userId: string, ip?: string, userAgent?: string): Promise<SessionResult> {
  const token = generateSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  const session = await prisma.session.create({
    data: {
      userId,
      hashedSessionToken: hashSessionToken(token),
      expiresAt,
      ip: ip ?? null,
      userAgent: userAgent?.slice(0, 300) ?? null,
    },
    include: { user: true },
  });
  return { user: session.user, token, expiresAt };
}

/**
 * Registration always creates a CUSTOMER. Role is never accepted from the
 * client — privilege escalation is impossible at this endpoint.
 */
export async function register(input: RegisterInput, ip?: string, userAgent?: string): Promise<SessionResult> {
  const email = input.email.toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw errors.conflict('An account with this email already exists');

  const passwordHash = await hashPassword(input.password);
  const user = await prisma.user.create({
    data: { name: input.name, email, passwordHash, role: 'CUSTOMER' },
  });
  return createSession(user.id, ip, userAgent);
}

export async function login(input: LoginInput, ip?: string, userAgent?: string): Promise<SessionResult> {
  const user = await prisma.user.findUnique({ where: { email: input.email.toLowerCase() } });

  // Uniform failure — don't reveal whether the email exists.
  if (!user || !(await verifyPassword(input.password, user.passwordHash))) {
    throw errors.unauthenticated('Invalid email or password');
  }
  if (user.accountStatus === 'DISABLED') {
    throw errors.forbidden('This account has been disabled');
  }
  return createSession(user.id, ip, userAgent);
}

export async function logout(sessionId: string | undefined) {
  if (!sessionId) return;
  await prisma.session.updateMany({
    where: { id: sessionId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export interface ResolvedSession {
  sessionId: string;
  user: { id: string; email: string; name: string; role: Role };
}

/**
 * Cookie token → session user. Checks expiry + revocation + account status,
 * and slides the expiry forward when past the half-life (rolling sessions).
 */
export async function resolveSession(token: string): Promise<ResolvedSession | null> {
  const hashed = hashSessionToken(token);
  const session = await prisma.session.findUnique({
    where: { hashedSessionToken: hashed },
    include: { user: true },
  });

  if (!session || session.revokedAt || session.expiresAt < new Date()) return null;
  if (session.user.accountStatus === 'DISABLED') return null;

  const remaining = session.expiresAt.getTime() - Date.now();
  if (remaining < SESSION_TTL_MS / 2) {
    await prisma.session.update({
      where: { id: session.id },
      data: { expiresAt: new Date(Date.now() + SESSION_TTL_MS) },
    });
  }

  const { id, email, name, role } = session.user;
  return { sessionId: session.id, user: { id, email, name, role } };
}

/** Admin disable / security events → revoke all live sessions atomically. */
export async function revokeAllSessions(userId: string, actorId: string | null) {
  await prisma.session.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  emitDomainEvent('sessions.revoked', { userId, actorId });
}
