import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { AnalyticsOverviewDto, Paginated, TicketSummaryDto } from '@helpdesk/shared';
import { TICKET_STATUS_LABELS } from '@helpdesk/shared';
import { api } from '../lib/api';
import { useAuth } from '../features/auth/use-auth';
import { LoadingState, PageHeader, StatCard } from '../components/ui';
import { TicketTable } from '../features/tickets/TicketTable';

type TicketsAnalytics = {
  days: number;
  volume: { day: string; count: number }[];
  byStatus: { status: keyof typeof TICKET_STATUS_LABELS; count: number }[];
  byPriority: { priority: string; count: number }[];
};

function fmtMinutes(m: number | null) {
  if (m === null) return '—';
  if (m < 60) return `${Math.round(m)}m`;
  return `${(m / 60).toFixed(1)}h`;
}

export function DashboardPage() {
  const { user } = useAuth();
  const isCustomer = user!.role === 'CUSTOMER';

  const overview = useQuery({
    queryKey: ['analytics', 'overview'],
    queryFn: () => api.get<AnalyticsOverviewDto>('/api/v1/analytics/overview'),
    enabled: !isCustomer,
  });
  const charts = useQuery({
    queryKey: ['analytics', 'tickets'],
    queryFn: () => api.get<TicketsAnalytics>('/api/v1/analytics/tickets?days=30'),
    enabled: !isCustomer,
  });
  const myTickets = useQuery({
    queryKey: ['tickets', 'dash'],
    queryFn: () => api.get<Paginated<TicketSummaryDto>>('/api/v1/tickets?pageSize=5'),
  });

  return (
    <div>
      <PageHeader title={`Welcome back, ${user!.name.split(' ')[0]}`} />

      {/* Customer dashboard */}
      {isCustomer ? (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard label="My tickets" value={myTickets.data?.total ?? '…'} />
            <StatCard
              label="Open / in progress"
              value={
                myTickets.data
                  ? myTickets.data.data.filter((t) =>
                      ['OPEN', 'IN_PROGRESS', 'WAITING_FOR_CUSTOMER'].includes(t.status),
                    ).length
                  : '…'
              }
            />
            <StatCard
              label="Resolved"
              value={
                myTickets.data
                  ? myTickets.data.data.filter((t) => t.status === 'RESOLVED').length
                  : '…'
              }
            />
          </div>
          <div className="mt-8">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-semibold text-slate-900">Recent tickets</h2>
              <Link to="/tickets/new" className="text-sm font-medium text-brand-600 hover:underline">
                + New ticket
              </Link>
            </div>
            {myTickets.data && <TicketTable tickets={myTickets.data.data} showCustomer={false} />}
          </div>
        </>
      ) : (
        /* Staff dashboard */
        <>
          {overview.isPending && <LoadingState />}
          {overview.data && (
            <div className="grid gap-4 sm:grid-cols-4">
              <StatCard label="Total tickets" value={overview.data.total} />
              <StatCard label="Open" value={overview.data.open} />
              <StatCard label="In progress" value={overview.data.inProgress} />
              <StatCard label="Waiting on customer" value={overview.data.waitingForCustomer} />
              <StatCard label="Resolved" value={overview.data.resolved} />
              <StatCard label="Overdue (SLA)" value={overview.data.overdue} accent="red" />
              <StatCard label="Avg first response" value={fmtMinutes(overview.data.avgFirstResponseMinutes)} />
              <StatCard label="Avg resolution" value={fmtMinutes(overview.data.avgResolutionMinutes)} />
            </div>
          )}

          {charts.data && (
            <div className="mt-8 grid gap-6 lg:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="mb-4 text-sm font-semibold text-slate-700">
                  Ticket volume — last {charts.data.days} days
                </h3>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={charts.data.volume}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Line type="monotone" dataKey="count" stroke="#4f46e5" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="mb-4 text-sm font-semibold text-slate-700">Tickets by status</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={charts.data.byStatus.map((s) => ({ ...s, status: TICKET_STATUS_LABELS[s.status] }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="status" tick={{ fontSize: 10 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
