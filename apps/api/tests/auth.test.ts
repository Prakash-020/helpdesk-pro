import { beforeAll, describe, expect, it } from 'vitest';
import { agent, loginAs, resetDb, TEST_PASSWORD, getApp } from './helpers';
import request from 'supertest';
import { prisma } from '../src/utils/prisma';

describe('auth', () => {
  beforeAll(resetDb);

  it('registers a customer and sets an HttpOnly session cookie', async () => {
    const res = await agent()
      .post('/api/v1/auth/register')
      .send({ name: 'New User', email: 'new@test.dev', password: 'Str0ngPass!' })
      .expect(201);

    expect(res.body.user.email).toBe('new@test.dev');
    expect(res.body.user.role).toBe('CUSTOMER');
    expect(res.body.user.passwordHash).toBeUndefined();

    const cookie = res.headers['set-cookie']?.toString() ?? '';
    expect(cookie).toContain('hp_session=');
    expect(cookie).toContain('HttpOnly');
  });

  it('rejects duplicate email with 409 CONFLICT', async () => {
    await agent()
      .post('/api/v1/auth/register')
      .send({ name: 'Dup', email: 'customer@test.dev', password: 'Str0ngPass!' })
      .expect(409);
  });

  it('validates the body with 400 + field details', async () => {
    const res = await agent()
      .post('/api/v1/auth/register')
      .send({ email: 'not-an-email' })
      .expect(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details.password).toBeDefined();
  });

  it('returns uniform 401 for bad credentials (no user enumeration)', async () => {
    for (const creds of [
      { email: 'customer@test.dev', password: 'wrong' },
      { email: 'nobody@test.dev', password: 'wrong' },
    ]) {
      const res = await request(getApp()).post('/api/v1/auth/login').send(creds);
      expect(res.status).toBe(401);
      expect(res.body.error.message).toBe('Invalid email or password');
    }
  });

  it('login → /me returns the user; logout revokes the session', async () => {
    const a = agent();
    await a
      .post('/api/v1/auth/login')
      .send({ email: 'customer@test.dev', password: TEST_PASSWORD })
      .expect(200);

    const me = await a.get('/api/v1/auth/me').expect(200);
    expect(me.body.user.email).toBe('customer@test.dev');

    await a.post('/api/v1/auth/logout').expect(200);
    await a.get('/api/v1/auth/me').expect(401);
  });

  it('rejects a forged/unknown session token', async () => {
    const res = await request(getApp())
      .get('/api/v1/auth/me')
      .set('Cookie', 'hp_session=forged-token')
      .expect(401);
    // a cookie was presented but is not a valid session → SESSION_EXPIRED
    expect(res.body.error.code).toBe('SESSION_EXPIRED');
  });

  it('revokes all sessions when account is disabled', async () => {
    const { agent: cust } = await loginAs('customer@test.dev');
    const { agent: admin } = await loginAs('admin@test.dev');
    const me = await cust.get('/api/v1/auth/me');
    const userId = me.body.user.id;

    await admin
      .patch(`/api/v1/users/${userId}/status`)
      .send({ accountStatus: 'DISABLED' })
      .expect(200);
    // existing session is now rejected (SESSION_EXPIRED is the precise code)
    const res = await cust.get('/api/v1/auth/me').expect(401);
    expect(['UNAUTHENTICATED', 'SESSION_EXPIRED']).toContain(res.body.error.code);
    await prisma.user.update({ where: { id: userId }, data: { accountStatus: 'ACTIVE' } });
  });
});
