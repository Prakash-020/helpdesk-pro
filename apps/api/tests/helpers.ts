import type { Express } from 'express';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { createApp } from '../src/app';
import { prisma } from '../src/utils/prisma';

/**
 * Test harness. `createApp()` builds the real Express app (middleware +
 * routers) so tests exercise production code paths against helpdesk_test.
 */
let app: Express | null = null;
export function getApp() {
  if (!app) app = createApp();
  return app;
}

/** supertest agent = persistent cookie jar per "user". */
export function agent() {
  return request.agent(getApp());
}

const PWD = 'TestPassw0rd!';
let cachedHash: string | null = null;
async function hash() {
  cachedHash ??= await bcrypt.hash(PWD, 10);
  return cachedHash;
}
export const TEST_PASSWORD = PWD;

/** Full reset + minimal fixtures: users (one per role + extra customer), category, SLA targets. */
export async function resetDb() {
  await prisma.$transaction([
    prisma.comment.deleteMany(),
    prisma.attachment.deleteMany(),
    prisma.notification.deleteMany(),
    prisma.auditLog.deleteMany(),
    prisma.ticket.deleteMany(),
    prisma.session.deleteMany(),
    prisma.category.deleteMany(),
    prisma.slaTarget.deleteMany(),
    prisma.user.deleteMany(),
  ]);

  const passwordHash = await hash();
  const mk = (name: string, email: string, role: 'CUSTOMER' | 'AGENT' | 'ADMIN') =>
    prisma.user.create({ data: { name, email, passwordHash, role } });

  const [admin, agent1, agent2, customer, customer2] = await Promise.all([
    mk('Test Admin', 'admin@test.dev', 'ADMIN'),
    mk('Test Agent', 'agent@test.dev', 'AGENT'),
    mk('Test Agent2', 'agent2@test.dev', 'AGENT'),
    mk('Test Customer', 'customer@test.dev', 'CUSTOMER'),
    mk('Test Customer2', 'customer2@test.dev', 'CUSTOMER'),
  ]);

  const category = await prisma.category.create({
    data: { name: 'General', description: 'General requests' },
  });
  const sla = await prisma.slaTarget.createMany({
    data: [
      { priority: 'LOW', firstResponseMinutes: 480, resolutionMinutes: 5760 },
      { priority: 'MEDIUM', firstResponseMinutes: 240, resolutionMinutes: 2880 },
      { priority: 'HIGH', firstResponseMinutes: 60, resolutionMinutes: 480 },
      { priority: 'URGENT', firstResponseMinutes: 30, resolutionMinutes: 240 },
    ],
  });

  return { admin, agent: agent1, agent2, customer, customer2, category, sla };
}

export type Fixtures = Awaited<ReturnType<typeof resetDb>>;

/** Log in and return a cookie-authenticated supertest agent. */
export async function loginAs(email: string) {
  const a = agent();
  const res = await a
    .post('/api/v1/auth/login')
    .send({ email, password: TEST_PASSWORD })
    .expect(200);
  return { agent: a, user: res.body.user };
}
