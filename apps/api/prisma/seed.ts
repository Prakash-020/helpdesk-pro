import {
  PrismaClient,
  type Priority,
  type Role,
  type TicketStatus,
} from '@prisma/client';
import bcrypt from 'bcryptjs';

/**
 * Idempotent dev seed. Creates demo users (one per role, then extras),
 * categories, SLA targets, and a realistic spread of tickets + comments +
 * notifications + audit rows. Safe to run repeatedly: wipes transactional
 * tables (tickets/comments/notifications/audit) then recreates them;
 * users/categories/SLA are upserted.
 *
 * Demo credentials (documented in README, NEVER used in production):
 *   admin@helpdesk.dev    / Demo!Passw0rd  (ADMIN)
 *   agent@helpdesk.dev    / Demo!Passw0rd  (AGENT)
 *   customer@helpdesk.dev / Demo!Passw0rd  (CUSTOMER)
 */
const prisma = new PrismaClient();

const DEMO_PASSWORD = 'Demo!Passw0rd';
const now = Date.now();
const hoursAgo = (h: number) => new Date(now - h * 3_600_000);

const SLA_BY_PRIORITY: Record<Priority, { firstResponseMinutes: number; resolutionMinutes: number }> = {
  LOW: { firstResponseMinutes: 24 * 60, resolutionMinutes: 72 * 60 },
  MEDIUM: { firstResponseMinutes: 8 * 60, resolutionMinutes: 24 * 60 },
  HIGH: { firstResponseMinutes: 2 * 60, resolutionMinutes: 8 * 60 },
  URGENT: { firstResponseMinutes: 30, resolutionMinutes: 2 * 60 },
};

async function nextTicketNumber(): Promise<string> {
  const [{ nextval }] = await prisma.$queryRaw<[{ nextval: bigint }]>`
    SELECT nextval('ticket_number_seq')`;
  return `HD-${String(nextval).padStart(6, '0')}`;
}

async function main() {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);

  /* ---------- users ---------- */
  const seedUser = (name: string, email: string, role: Role) =>
    prisma.user.upsert({
      where: { email },
      update: { name, role },
      create: { name, email, role, passwordHash },
    });

  const [admin, agentA, agentB, custA, custB, custC] = await Promise.all([
    seedUser('Ava Admin', 'admin@helpdesk.dev', 'ADMIN'),
    seedUser('Sam Support', 'agent@helpdesk.dev', 'AGENT'),
    seedUser('Riley Resolver', 'agent2@helpdesk.dev', 'AGENT'),
    seedUser('Casey Customer', 'customer@helpdesk.dev', 'CUSTOMER'),
    seedUser('Morgan Mercer', 'customer2@helpdesk.dev', 'CUSTOMER'),
    seedUser('Jordan Jiang', 'customer3@helpdesk.dev', 'CUSTOMER'),
  ]);
  const agents = [agentA, agentB];
  const customers = [custA, custB, custC];

  /* ---------- categories ---------- */
  const categoryDefs = [
    { name: 'Billing', description: 'Invoices, payments, refunds, subscriptions' },
    { name: 'Technical', description: 'Bugs, errors, performance, integrations' },
    { name: 'Account', description: 'Login, profile, security, permissions' },
    { name: 'General', description: 'Everything else' },
  ];
  const categories: Record<string, { id: string }> = {};
  for (const c of categoryDefs) {
    const row = await prisma.category.upsert({
      where: { name: c.name },
      update: { description: c.description },
      create: c,
    });
    categories[c.name] = row;
  }

  /* ---------- SLA targets ---------- */
  for (const [priority, t] of Object.entries(SLA_BY_PRIORITY) as [Priority, (typeof SLA_BY_PRIORITY)[Priority]][]) {
    await prisma.slaTarget.upsert({
      where: { priority },
      update: t,
      create: { priority, ...t },
    });
  }

  /* ---------- wipe transactional data (dev only) ---------- */
  await prisma.$transaction([
    prisma.notification.deleteMany(),
    prisma.auditLog.deleteMany(),
    prisma.attachment.deleteMany(),
    prisma.comment.deleteMany(),
    prisma.ticket.deleteMany(),
  ]);
  await prisma.$executeRaw`SELECT setval('ticket_number_seq', 1, false)`;

  /* ---------- tickets + threads ---------- */
  type TicketSeed = {
    subject: string;
    description: string;
    status: TicketStatus;
    priority: Priority;
    customerIdx: number;
    category: string;
    assigneeIdx?: number;
    createdHrsAgo: number;
    replies?: { author: 'customer' | 'agent'; body: string; internal?: boolean; hrsAgo: number }[];
  };

  const ticketSeeds: TicketSeed[] = [
    {
      subject: 'Charged twice for annual plan',
      description: 'I upgraded to the annual plan on Monday and my card shows two identical charges. Can someone confirm and refund the duplicate?',
      status: 'IN_PROGRESS', priority: 'URGENT', customerIdx: 0, category: 'Billing', assigneeIdx: 0, createdHrsAgo: 30,
      replies: [
        { author: 'agent', body: 'Hi Casey — I can see the duplicate charge. I\'ve escalated to our billing processor for a refund within 3–5 business days.', hrsAgo: 28 },
        { author: 'agent', body: 'Stripe dispute ref ch_3Oa… — verified duplicate, refund issued.', internal: true, hrsAgo: 27 },
      ],
    },
    {
      subject: 'Cannot log in after password change',
      description: 'I reset my password yesterday and now I get "invalid credentials" with the new password. Old password also fails.',
      status: 'WAITING_FOR_CUSTOMER', priority: 'HIGH', customerIdx: 1, category: 'Account', assigneeIdx: 0, createdHrsAgo: 50,
      replies: [
        { author: 'agent', body: 'Could you try logging in from an incognito window? This helps us rule out a cached session.', hrsAgo: 46 },
      ],
    },
    {
      subject: 'Dashboard charts show stale data',
      description: 'The analytics page shows numbers from last week even after several refresh attempts. Filtering by date does not update the charts.',
      status: 'OPEN', priority: 'MEDIUM', customerIdx: 0, category: 'Technical', createdHrsAgo: 20,
    },
    {
      subject: 'Request: export tickets to CSV',
      description: 'Is there a way to export our support history? We need it for quarterly reporting.',
      status: 'RESOLVED', priority: 'LOW', customerIdx: 2, category: 'General', assigneeIdx: 1, createdHrsAgo: 120,
      replies: [
        { author: 'agent', body: 'CSV export is available under Reports → Export. I\'ve enabled it on your account.', hrsAgo: 100 },
        { author: 'customer', body: 'Found it — thank you!', hrsAgo: 96 },
      ],
    },
    {
      subject: 'API returns 500 on ticket list endpoint',
      description: 'GET /tickets intermittently returns HTTP 500 for our integration user. Started after the last deploy.',
      status: 'IN_PROGRESS', priority: 'URGENT', customerIdx: 1, category: 'Technical', assigneeIdx: 1, createdHrsAgo: 12,
      replies: [
        { author: 'agent', body: 'Reproduced — looks like a pagination edge case. Engineering is deploying a fix.', hrsAgo: 6 },
        { author: 'agent', body: 'Root cause: null order-by column on archived rows. PR opened.', internal: true, hrsAgo: 5 },
      ],
    },
    {
      subject: 'How do I add a teammate to our account?',
      description: 'We have a new support rep starting Monday. How do I give them access?',
      status: 'CLOSED', priority: 'LOW', customerIdx: 2, category: 'Account', assigneeIdx: 0, createdHrsAgo: 200,
      replies: [
        { author: 'agent', body: 'Admins can invite teammates under Settings → Team. Invite sent!', hrsAgo: 190 },
        { author: 'customer', body: 'Perfect, all set.', hrsAgo: 188 },
      ],
    },
    {
      subject: 'Invoice shows wrong company name',
      description: 'Our legal entity changed last month. Please update the invoice header to "Mercer Analytics Ltd".',
      status: 'OPEN', priority: 'MEDIUM', customerIdx: 1, category: 'Billing', createdHrsAgo: 8,
    },
    {
      subject: 'Mobile app crashes on ticket submit',
      description: 'On iOS 26 the app force-closes when I attach a photo to a new ticket.',
      status: 'OPEN', priority: 'HIGH', customerIdx: 0, category: 'Technical', createdHrsAgo: 4,
    },
    {
      subject: 'Slow page loads in EU region',
      description: 'Pages take 8–10s to load from our Berlin office since Tuesday. US colleagues see normal speeds.',
      status: 'IN_PROGRESS', priority: 'HIGH', customerIdx: 2, category: 'Technical', assigneeIdx: 1, createdHrsAgo: 60,
      replies: [
        { author: 'agent', body: 'We\'re seeing elevated latency on the EU edge. CDN provider is investigating.', hrsAgo: 40 },
      ],
    },
    {
      subject: 'Cancel subscription at period end',
      description: 'We want to cancel auto-renewal but keep access until our term ends in March.',
      status: 'RESOLVED', priority: 'MEDIUM', customerIdx: 0, category: 'Billing', assigneeIdx: 0, createdHrsAgo: 300,
      replies: [
        { author: 'agent', body: 'Auto-renewal disabled — you\'ll keep full access until March 31.', hrsAgo: 280 },
      ],
    },
    {
      subject: 'SSO login loops back to sign-in page',
      description: 'After our IdP migration, SAML login completes then bounces back to the login form.',
      status: 'WAITING_FOR_CUSTOMER', priority: 'HIGH', customerIdx: 1, category: 'Account', assigneeIdx: 1, createdHrsAgo: 26,
      replies: [
        { author: 'agent', body: 'Please share the new SAML metadata XML so we can update the ACS URL.', hrsAgo: 20 },
      ],
    },
    {
      subject: 'Feature request: dark mode',
      description: 'Any plans for a dark theme? Our support team works night shifts.',
      status: 'OPEN', priority: 'LOW', customerIdx: 2, category: 'General', createdHrsAgo: 3,
    },
    {
      subject: 'Webhook deliveries delayed by 15+ min',
      description: 'ticket.updated webhooks arrived in batches 15–20 minutes late yesterday afternoon.',
      status: 'RESOLVED', priority: 'HIGH', customerIdx: 1, category: 'Technical', assigneeIdx: 1, createdHrsAgo: 90,
      replies: [
        { author: 'agent', body: 'A queue consumer was stalled — recovered and backlog flushed. Monitoring added.', hrsAgo: 70 },
      ],
    },
    {
      subject: 'Two-factor auth setup fails',
      description: 'Scanning the TOTP QR code shows "invalid secret" in my authenticator app.',
      status: 'OPEN', priority: 'MEDIUM', customerIdx: 0, category: 'Account', createdHrsAgo: 2,
    },
    {
      subject: 'Refund for unused seats',
      description: 'We removed 3 seats mid-cycle. Expected a prorated refund but nothing arrived yet.',
      status: 'IN_PROGRESS', priority: 'MEDIUM', customerIdx: 2, category: 'Billing', assigneeIdx: 0, createdHrsAgo: 44,
      replies: [
        { author: 'agent', body: 'Refund approved — should post to your card within 5 business days.', hrsAgo: 30 },
      ],
    },
  ];

  for (const t of ticketSeeds) {
    const customer = customers[t.customerIdx]!;
    const assignee = t.assigneeIdx !== undefined ? agents[t.assigneeIdx]! : null;
    const createdAt = hoursAgo(t.createdHrsAgo);
    const agentReplyHrs = t.replies?.find((r) => r.author === 'agent' && !r.internal)?.hrsAgo;

    const ticket = await prisma.ticket.create({
      data: {
        ticketNumber: await nextTicketNumber(),
        subject: t.subject,
        description: t.description,
        status: t.status,
        priority: t.priority,
        customerId: customer.id,
        assigneeId: assignee?.id ?? null,
        categoryId: categories[t.category]!.id,
        firstResponseAt: agentReplyHrs !== undefined ? hoursAgo(agentReplyHrs) : null,
        resolvedAt: t.status === 'RESOLVED' || t.status === 'CLOSED' ? hoursAgo(Math.max(t.createdHrsAgo - 20, 1)) : null,
        closedAt: t.status === 'CLOSED' ? hoursAgo(Math.max(t.createdHrsAgo - 30, 1)) : null,
        createdAt,
        updatedAt: createdAt,
      },
    });

    await prisma.auditLog.create({
      data: {
        actorId: customer.id,
        action: 'TICKET_CREATED',
        entityType: 'TICKET',
        entityId: ticket.id,
        metadata: { ticketNumber: ticket.ticketNumber },
        createdAt,
      },
    });

    if (assignee) {
      await prisma.auditLog.create({
        data: {
          actorId: assignee.id,
          action: 'ASSIGNED',
          entityType: 'TICKET',
          entityId: ticket.id,
          metadata: { to: assignee.id },
          createdAt: hoursAgo(t.createdHrsAgo - 1),
        },
      });
      await prisma.notification.create({
        data: {
          recipientId: assignee.id,
          ticketId: ticket.id,
          type: 'TICKET_ASSIGNED',
          message: `Ticket ${ticket.ticketNumber} assigned to you`,
          createdAt: hoursAgo(t.createdHrsAgo - 1),
        },
      });
    }

    for (const r of t.replies ?? []) {
      const author = r.author === 'agent' ? assignee ?? agentA : customer;
      await prisma.comment.create({
        data: {
          ticketId: ticket.id,
          authorId: author.id,
          body: r.body,
          isInternal: r.internal ?? false,
          createdAt: hoursAgo(r.hrsAgo),
          updatedAt: hoursAgo(r.hrsAgo),
        },
      });
      if (!r.internal && r.author === 'agent') {
        await prisma.notification.create({
          data: {
            recipientId: customer.id,
            ticketId: ticket.id,
            type: 'TICKET_REPLY',
            message: `New reply on ${ticket.ticketNumber}`,
            createdAt: hoursAgo(r.hrsAgo),
          },
        });
      }
    }
  }

  const counts = await prisma.$transaction([
    prisma.user.count(),
    prisma.ticket.count(),
    prisma.comment.count(),
    prisma.notification.count(),
    prisma.auditLog.count(),
  ]);

  console.log('Seed complete:', {
    users: counts[0],
    tickets: counts[1],
    comments: counts[2],
    notifications: counts[3],
    auditLogs: counts[4],
  });
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
