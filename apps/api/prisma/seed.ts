import {
  AccountStatus,
  PrismaClient,
  Priority,
  Role,
  TicketStatus,
  NotificationType,
  type Prisma,
} from '@prisma/client';
import bcrypt from 'bcryptjs';

/**
 * Demo seed — deterministic-ish, idempotent (skips if users exist).
 * Produces a realistic dataset for demos and screenshots:
 *   6 users · 5 categories · 4 SLA targets · 60 tickets across statuses
 *   (some SLA-breached), comment threads, notifications, audit logs.
 * Demo password for every account: Demo!Passw0rd
 */
const prisma = new PrismaClient();

async function nextTicketNumber() {
  const [{ nextval }] = await prisma.$queryRaw<[{ nextval: bigint }]>`
    SELECT nextval('ticket_number_seq')`;
  return `HD-${String(nextval).padStart(6, '0')}`;
}

/* ---------- realistic content pools ---------- */

const SUBJECTS: Record<string, string[]> = {
  Billing: [
    'Charged twice for annual plan',
    'Invoice shows wrong company name',
    'Cancel subscription at period end',
    'Refund not received after 14 days',
    'Upgrade charged full price instead of prorated',
    'Tax/VAT number missing from invoice',
    'Discount code not applied at checkout',
    'Payment failed but card was charged',
    'Change billing email for receipts',
    'Plan downgrade took effect immediately, want refund',
  ],
  'Technical Support': [
    'Cannot log in — infinite redirect loop',
    'Two-factor auth setup fails',
    'Dashboard charts show stale data',
    'Mobile app crashes on ticket submit',
    'SSO login fails with SAML error',
    'API returns 429 without rate limit hit',
    'Export to PDF produces blank file',
    'App freezes when uploading large attachment',
    'Search returns no results for existing tickets',
    'Webhook deliveries silently failing',
    'Browser extension conflicts with dashboard',
    'Session expires after 2 minutes',
    'Dark mode breaks form inputs',
    'Autocomplete suggests wrong values',
    'Page loads blank in Safari only',
  ],
  'Feature Request': [
    'Feature request: dark mode',
    'Add calendar view for tickets',
    'Slack integration for notifications',
    'Bulk ticket operations needed',
    'Custom ticket fields support',
    'Public roadmap / voting board',
    'CSV export of ticket history',
    'Keyboard shortcuts for agents',
    'Multi-language support portal',
    'Auto-responders for common questions',
  ],
  'Account Management': [
    'Change account owner / admin',
    'Add team member — seat limit reached',
    'Delete old employee account',
    'Merge two company accounts',
    'Update company name on profile',
    'Transfer data after acquisition',
    'Enable SAML SSO for the org',
    'Restrict agent access by department',
  ],
  'Bug Report': [
    'Typing in reply box loses focus randomly',
    'Avatar upload crops image incorrectly',
    'Notification badge count never clears',
    'Sorting by date shows wrong order',
    'Ticket link in email is broken (404)',
    'Attachments download as empty files',
    'Filters reset after viewing a ticket',
    'Comment editor strips line breaks',
  ],
};

const AGENT_REPLIES = [
  'Thanks for reporting this — I can reproduce it on my end. Investigating now.',
  'Could you share the exact steps that trigger this? A screenshot would help.',
  'We have identified the cause. A fix is going out in the next deploy.',
  'This is a known issue our engineers are actively working on.',
  'I have escalated this to the engineering team for a deeper look.',
  'Can you try clearing your browser cache and let me know if it persists?',
  'I have applied the credit to your account — should reflect within 24h.',
  'Good news — this is now resolved on our end. Please confirm.',
];
const CUSTOMER_REPLIES = [
  'Here are the steps: 1) open settings 2) click save 3) error appears.',
  'Still happening after clearing cache — tried on two browsers.',
  'The file size is about 40MB if that matters.',
  'That worked, thank you so much!',
  'I tried the workaround but the issue came back today.',
  'This is blocking our whole team, would appreciate an ETA.',
];
const INTERNAL_NOTES = [
  'Reproduced locally — looks like a race condition in the worker queue.',
  'Checked logs: repeated 500s from the payments webhook. Eng ticket ENG-4412.',
  'Customer has high LTV — prioritize if possible.',
  'Duplicate of an earlier report; merging context. Do not close yet.',
  'Asked oncall — fix lands in release 4.2 next Tuesday.',
];

const rand = <T>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)]!;
const randInt = (min: number, max: number) => min + Math.floor(Math.random() * (max - min + 1));
const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000);
const daysAgo = (d: number) => new Date(Date.now() - d * 86_400_000);

async function main() {
  if ((await prisma.user.count()) > 0) {
    console.log('Database already seeded — skipping.');
    return;
  }

  const passwordHash = await bcrypt.hash('Demo!Passw0rd', 12);

  /* ---------- users ---------- */
  const users = await Promise.all(
    (
      [
        { name: 'Ava Admin', email: 'admin@helpdesk.dev', role: Role.ADMIN },
        { name: 'Sam Support', email: 'agent@helpdesk.dev', role: Role.AGENT },
        { name: 'Riley Resolver', email: 'agent2@helpdesk.dev', role: Role.AGENT },
        { name: 'Nina Navigator', email: 'agent3@helpdesk.dev', role: Role.AGENT },
        { name: 'Casey Customer', email: 'customer@helpdesk.dev', role: Role.CUSTOMER },
        { name: 'Chris Client', email: 'customer2@helpdesk.dev', role: Role.CUSTOMER },
        { name: 'Morgan Miller', email: 'customer3@helpdesk.dev', role: Role.CUSTOMER },
        { name: 'Taylor Tenant', email: 'customer4@helpdesk.dev', role: Role.CUSTOMER },
      ] as const
    ).map((u) =>
      prisma.user.create({ data: { ...u, passwordHash, accountStatus: AccountStatus.ACTIVE } }),
    ),
  );
  const admin = users[0]!;
  const agents = users.slice(1, 4);
  const customers = users.slice(4);

  /* ---------- categories ---------- */
  const categories = await Promise.all(
    Object.keys(SUBJECTS).map((name, i) =>
      prisma.category.create({
        data: {
          name,
          description: `${name} requests`,
          isActive: i < 4 || Math.random() > 0.5, // occasionally seed an inactive one
        },
      }),
    ),
  );

  /* ---------- SLA targets ---------- */
  await prisma.slaTarget.createMany({
    data: [
      { priority: Priority.LOW, firstResponseMinutes: 8 * 60, resolutionMinutes: 96 * 60 },
      { priority: Priority.MEDIUM, firstResponseMinutes: 4 * 60, resolutionMinutes: 48 * 60 },
      { priority: Priority.HIGH, firstResponseMinutes: 60, resolutionMinutes: 8 * 60 },
      { priority: Priority.URGENT, firstResponseMinutes: 30, resolutionMinutes: 4 * 60 },
    ],
  });
  const sla = new Map(
    (await prisma.slaTarget.findMany()).map((s) => [s.priority, s]),
  );

  /* ---------- 60+ tickets ---------- */
  const statusPool: TicketStatus[] = [
    // weighted distribution — lively queue for the demo
    'OPEN', 'OPEN', 'OPEN', 'OPEN', 'OPEN', 'OPEN',
    'IN_PROGRESS', 'IN_PROGRESS', 'IN_PROGRESS', 'IN_PROGRESS', 'IN_PROGRESS',
    'WAITING_FOR_CUSTOMER', 'WAITING_FOR_CUSTOMER', 'WAITING_FOR_CUSTOMER',
    'RESOLVED', 'RESOLVED', 'RESOLVED', 'RESOLVED',
    'CLOSED', 'CLOSED',
  ];
  const priorityPool: Priority[] = [
    'LOW', 'LOW', 'LOW',
    'MEDIUM', 'MEDIUM', 'MEDIUM', 'MEDIUM', 'MEDIUM',
    'HIGH', 'HIGH', 'HIGH', 'HIGH',
    'URGENT', 'URGENT',
  ];

  const ticketSeeds: {
    ticket: Prisma.TicketUncheckedCreateInput;
    commentCount: number;
    notifyAssignee: boolean;
  }[] = [];

  // deterministic spread: every subject pool entry used at least once
  const flatSubjects = Object.entries(SUBJECTS).flatMap(([cat, subs]) =>
    subs.map((s) => ({ cat, s })),
  );
  const TOTAL = Math.max(62, flatSubjects.length);

  for (let i = 0; i < TOTAL; i++) {
    const entry = flatSubjects[i % flatSubjects.length]!;
    const category = categories.find((c) => c.name === entry.cat)!;
    const customer = rand(customers);
    const status = statusPool[i % statusPool.length]!;
    const priority = priorityPool[i % priorityPool.length]!;

    // createdAt spread over last ~6 days; every 10th is deliberately old
    const createdAt = i % 10 === 0 ? daysAgo(randInt(20, 30)) : hoursAgo(randInt(1, 140));
    const assigned = status !== 'OPEN' || i % 4 === 0;
    const agent = assigned ? rand(agents) : null;

    const resolved = status === 'RESOLVED' || status === 'CLOSED';
    const hasFirstResponse = status !== 'OPEN' && (assigned || i % 3 === 0);

    const firstResponseAt = hasFirstResponse
      ? new Date(createdAt.getTime() + randInt(10, 300) * 60_000)
      : null;
    const resolvedAt = resolved
      ? new Date(createdAt.getTime() + randInt(3, 72) * 3_600_000)
      : null;
    const closedAt =
      status === 'CLOSED' ? new Date(resolvedAt!.getTime() + randInt(1, 3) * 86_400_000) : null;

    // SLA snapshot — some tickets intentionally breach (created days ago,
    // tight targets, no response yet or never resolved)
    const responseDueAt = new Date(createdAt.getTime() + sla.get(priority)!.firstResponseMinutes * 60_000);
    const resolutionDueAt = new Date(createdAt.getTime() + sla.get(priority)!.resolutionMinutes * 60_000);

    ticketSeeds.push({
      ticket: {
        ticketNumber: await nextTicketNumber(),
        subject: entry.s,
        description:
          `${entry.s} — reported by ${customer.name}. ` +
          'Details: ' +
          rand([
            'started after the latest update',
            'happens consistently every time',
            'intermittent, roughly half of attempts',
            'only on our production workspace',
            'affects multiple team members',
          ]) +
          '.',
        status,
        priority,
        categoryId: category.id,
        customerId: customer.id,
        assigneeId: agent?.id ?? null,
        createdAt,
        updatedAt: resolvedAt ?? createdAt,
        firstResponseAt,
        resolvedAt,
        closedAt,
        responseDueAt,
        resolutionDueAt,
      },
      commentCount:
        status === 'OPEN' ? randInt(0, 2) : status === 'CLOSED' ? randInt(2, 5) : randInt(1, 6),
      notifyAssignee: assigned && !resolved,
    });
  }

  /* ---------- write tickets + comments + audit in a transaction ---------- */
  const auditRows: Prisma.AuditLogCreateManyInput[] = [];
  const notifRows: Prisma.NotificationCreateManyInput[] = [];

  for (const { ticket, commentCount, notifyAssignee } of ticketSeeds) {
    const created = await prisma.ticket.create({ data: ticket });
    const createdAtDate = new Date(ticket.createdAt as Date);
    auditRows.push({
      actorId: ticket.customerId,
      action: 'TICKET_CREATED',
      entityType: 'TICKET',
      entityId: created.id,
      metadata: { ticketNumber: ticket.ticketNumber },
      createdAt: ticket.createdAt,
    });
    if (ticket.assigneeId) {
      auditRows.push({
        actorId: admin.id,
        action: 'ASSIGNED',
        entityType: 'TICKET',
        entityId: created.id,
        metadata: { from: null, to: ticket.assigneeId },
        createdAt: new Date(createdAtDate.getTime() + 3_600_000),
      });
    }
    if (ticket.status !== 'OPEN') {
      auditRows.push({
        actorId: ticket.assigneeId ?? admin.id,
        action: 'STATUS_CHANGED',
        entityType: 'TICKET',
        entityId: created.id,
        metadata: { from: 'OPEN', to: ticket.status },
        createdAt: ticket.resolvedAt ?? new Date(createdAtDate.getTime() + 7_200_000),
      });
    }
    if (notifyAssignee) {
      notifRows.push({
        recipientId: ticket.assigneeId!,
        type: NotificationType.TICKET_ASSIGNED,
        message: `Ticket ${ticket.ticketNumber} was assigned to you`,
        ticketId: created.id,
        createdAt: new Date(createdAtDate.getTime() + 3_600_000),
      });
    }

    /* comment thread: alternate customer/agent, occasional internal note */
    let cursor = new Date(createdAtDate.getTime() + 30 * 60_000);
    for (let j = 0; j < commentCount; j++) {
      const isStaffTurn = j % 2 === 1 && ticket.assigneeId;
      const authorId = isStaffTurn ? ticket.assigneeId! : ticket.customerId;
      const isInternal = Boolean(isStaffTurn) && j === commentCount - 1 && Math.random() < 0.3;
      await prisma.comment.create({
        data: {
          ticketId: created.id,
          authorId,
          isInternal,
          createdAt: cursor,
          body: isInternal ? rand(INTERNAL_NOTES) : isStaffTurn ? rand(AGENT_REPLIES) : rand(CUSTOMER_REPLIES),
        },
      });
      auditRows.push({
        actorId: authorId,
        action: 'COMMENT_ADDED',
        entityType: 'TICKET',
        entityId: created.id,
        metadata: { isInternal },
        createdAt: cursor,
      });
      if (!isInternal && isStaffTurn) {
        notifRows.push({
          recipientId: ticket.customerId,
          type: NotificationType.TICKET_REPLY,
          message: `New reply on ${ticket.ticketNumber}`,
          ticketId: created.id,
          createdAt: cursor,
        });
      }
      cursor = new Date(cursor.getTime() + randInt(20, 400) * 60_000);
    }
  }

  await prisma.auditLog.createMany({ data: auditRows });
  await prisma.notification.createMany({ data: notifRows });

  const [tickets, comments, notifications, audits] = await Promise.all([
    prisma.ticket.count(),
    prisma.comment.count(),
    prisma.notification.count(),
    prisma.auditLog.count(),
  ]);
  console.log('Seed complete:', {
    users: 8,
    categories: categories.length,
    tickets,
    comments,
    notifications,
    audits,
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
