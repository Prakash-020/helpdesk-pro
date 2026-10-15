import { beforeAll, describe, expect, it } from 'vitest';
import { loginAs, resetDb, type Fixtures } from './helpers';
import { prisma } from '../src/utils/prisma';

/**
 * Core ticket behavior — the matrix the spec demands be proven:
 * customer isolation, state machine, internal-note secrecy, scoping.
 */
describe('tickets', () => {
  let fx: Fixtures;
  beforeAll(async () => {
    fx = await resetDb();
  });

  async function createTicket(subject = 'Test ticket', priority = 'MEDIUM') {
    const { agent } = await loginAs('customer@test.dev');
    const res = await agent
      .post('/api/v1/tickets')
      .send({ subject, description: 'A test description long enough', categoryId: fx.category.id, priority })
      .expect(201);
    return res.body;
  }

  it('customer creates a ticket → OPEN + ticket number + SLA dates', async () => {
    const t = await createTicket('Billing double charge');
    expect(t.status).toBe('OPEN');
    expect(t.ticketNumber).toMatch(/^HD-\d{6}$/);
    expect(t.responseDueAt).toBeTruthy();
    expect(t.resolutionDueAt).toBeTruthy();
  });

  it('customers see only their own tickets; strangers get 404 (not 403)', async () => {
    const t = await createTicket('Private issue');
    const { agent: stranger } = await loginAs('customer2@test.dev');
    await stranger.get(`/api/v1/tickets/${t.id}`).expect(404);

    const list = await stranger.get('/api/v1/tickets?pageSize=50').expect(200);
    expect(list.body.data.find((x: { id: string }) => x.id === t.id)).toBeUndefined();
  });

  it('agent queue = assigned-to-me + unassigned; admin sees all', async () => {
    const t = await createTicket('Queue scoping');
    const { agent: ag } = await loginAs('agent@test.dev');
    const queue = await ag.get('/api/v1/tickets?pageSize=50').expect(200);
    expect(queue.body.data.some((x: { id: string }) => x.id === t.id)).toBe(true);

    const { agent: admin } = await loginAs('admin@test.dev');
    const all = await admin.get('/api/v1/tickets?pageSize=50').expect(200);
    expect(all.body.total).toBeGreaterThanOrEqual(queue.body.total);
  });

  it('rejects invalid status transitions with FORBIDDEN_TRANSITION', async () => {
    const t = await createTicket('Bad transition');
    const { agent: ag } = await loginAs('agent@test.dev');
    const res = await ag
      .patch(`/api/v1/tickets/${t.id}/status`)
      .send({ status: 'CLOSED' })
      .expect(409);
    expect(res.body.error.code).toBe('FORBIDDEN_TRANSITION');
  });

  it('assignment auto-moves OPEN → IN_PROGRESS and notifies the assignee', async () => {
    const t = await createTicket('Assign me');
    // Admin assigns to the agent — self-assignment correctly sends no notification.
    const { agent: admin } = await loginAs('admin@test.dev');
    const { user: agent } = await loginAs('agent@test.dev');
    const res = await admin
      .patch(`/api/v1/tickets/${t.id}/assignment`)
      .send({ assigneeId: agent.id })
      .expect(200);
    expect(res.body.status).toBe('IN_PROGRESS');

    const notif = await prisma.notification.findFirst({
      where: { recipientId: agent.id, type: 'TICKET_ASSIGNED', ticketId: t.id },
    });
    expect(notif).toBeTruthy();
  });

  it('customers cannot assign, patch metadata, or read audit logs', async () => {
    const t = await createTicket('Forbidden actions');
    const { agent: cust } = await loginAs('customer@test.dev');
    await cust.patch(`/api/v1/tickets/${t.id}/assignment`).send({ assigneeId: null }).expect(403);
    await cust.patch(`/api/v1/tickets/${t.id}`).send({ subject: 'hacked' }).expect(403);
    await cust.get('/api/v1/audit-logs').expect(403);
    await cust.get('/api/v1/analytics/overview').expect(403);
    await cust.get('/api/v1/users?pageSize=10').expect(403);
  });

  it('THE critical rule: internal notes never reach the customer', async () => {
    const t = await createTicket('Internal note secrecy');
    const { agent: ag } = await loginAs('agent@test.dev');
    await ag
      .post(`/api/v1/tickets/${t.id}/comments`)
      .send({ body: 'SECRET internal note text', isInternal: true })
      .expect(201);
    await ag
      .post(`/api/v1/tickets/${t.id}/comments`)
      .send({ body: 'Public reply text', isInternal: false })
      .expect(201);

    const { agent: cust } = await loginAs('customer@test.dev');
    const comments = await cust.get(`/api/v1/tickets/${t.id}/comments`).expect(200);
    const bodies = comments.body.map((c: { body: string }) => c.body).join(' ');
    expect(bodies).not.toContain('SECRET');
    expect(comments.body.every((c: { isInternal: boolean }) => !c.isInternal)).toBe(true);
    expect(comments.body.length).toBe(1);

    // customer cannot forge an internal note either
    await cust
      .post(`/api/v1/tickets/${t.id}/comments`)
      .send({ body: 'sneaky', isInternal: true })
      .expect(403);
  });

  it('customer reply flips WAITING_FOR_CUSTOMER back to IN_PROGRESS', async () => {
    const t = await createTicket('Waiting flip');
    const { agent: ag, user: agent } = await loginAs('agent@test.dev');
    await ag.patch(`/api/v1/tickets/${t.id}/assignment`).send({ assigneeId: agent.id }).expect(200);
    // first public staff reply stamps firstResponseAt (SLA metric)
    await ag
      .post(`/api/v1/tickets/${t.id}/comments`)
      .send({ body: 'We need more info please' })
      .expect(201);
    const withResp = await ag.get(`/api/v1/tickets/${t.id}`).expect(200);
    expect(withResp.body.firstResponseAt).toBeTruthy();

    await ag
      .patch(`/api/v1/tickets/${t.id}/status`)
      .send({ status: 'WAITING_FOR_CUSTOMER' })
      .expect(200);

    const { agent: cust } = await loginAs('customer@test.dev');
    await cust
      .post(`/api/v1/tickets/${t.id}/comments`)
      .send({ body: 'Here is the info you asked for' })
      .expect(201);
    const after = await cust.get(`/api/v1/tickets/${t.id}`).expect(200);
    expect(after.body.status).toBe('IN_PROGRESS');
  });

  it('resolved → customer can reopen or confirm-close', async () => {
    const t = await createTicket('Reopen flow');
    const { agent: ag, user: agent } = await loginAs('agent@test.dev');
    await ag.patch(`/api/v1/tickets/${t.id}/assignment`).send({ assigneeId: agent.id }).expect(200);
    await ag.patch(`/api/v1/tickets/${t.id}/status`).send({ status: 'RESOLVED' }).expect(200);

    const { agent: cust } = await loginAs('customer@test.dev');
    const reopened = await cust
      .patch(`/api/v1/tickets/${t.id}/status`)
      .send({ status: 'OPEN' })
      .expect(200);
    expect(reopened.body.status).toBe('OPEN');

    await ag.patch(`/api/v1/tickets/${t.id}/status`).send({ status: 'RESOLVED' }).expect(200);
    const closed = await cust
      .patch(`/api/v1/tickets/${t.id}/status`)
      .send({ status: 'CLOSED' })
      .expect(200);
    expect(closed.body.closedAt).toBeTruthy();
  });

  it('search + filters + pagination work over the list', async () => {
    await createTicket('Unique zyx-search-term ticket');
    const { agent: cust } = await loginAs('customer@test.dev');
    const found = await cust.get('/api/v1/tickets?search=zyx-search').expect(200);
    expect(found.body.total).toBe(1);

    const paged = await cust.get('/api/v1/tickets?page=1&pageSize=2').expect(200);
    expect(paged.body.data.length).toBeLessThanOrEqual(2);
    expect(paged.body.pageSize).toBe(2);
  });
});
