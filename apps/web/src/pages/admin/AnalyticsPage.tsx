import { useQuery } from '@tanstack/react-query';
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
import { PRIORITY_LABELS, type Priority, type TicketStatus } from '@helpdesk/shared';
import { api } from '../../lib/api';
import { LoadingState, PageHeader } from '../../components/ui';

type TicketsAnalytics = {
  days: number;
  volume: { day: string; count: number }[];
  byStatus: { status: TicketStatus; count: number }[];
  byPriority: { priority: Priority; count: number }[];
};

type AgentRow = {
  agent: { id: string; name: string };
  assigned: number;
  open: number;
  resolved: number;
  avgResolutionMinutes: number | null;
};

export function AnalyticsPage() {
  const tickets = useQuery({
    queryKey: ['analytics', 'tickets', 'full'],
    queryFn: () => api.get<TicketsAnalytics>('/api/v1/analytics/tickets?days=30'),
  });
  const agents = useQuery({
    queryKey: ['analytics', 'agents'],
    queryFn: () => api.get<{ data: AgentRow[] }>('/api/v1/analytics/agents'),
  });

  return (
    <div>
      <PageHeader title="Analytics & SLA" />
      {(tickets.isPending || agents.isPending) && <LoadingState />}

      {tickets.data && (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="mb-4 text-sm font-semibold text-slate-700">Volume — {tickets.data.days} days</h3>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={tickets.data.volume}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Line type="monotone" dataKey="count" stroke="#4f46e5" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="mb-4 text-sm font-semibold text-slate-700">By priority</h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={tickets.data.byPriority.map((p) => ({ ...p, priority: PRIORITY_LABELS[p.priority] }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="priority" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {agents.data && (
        <div className="mt-8">
          <h3 className="mb-3 text-sm font-semibold text-slate-700">Agent workload</h3>
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3 font-medium">Agent</th>
                  <th className="px-4 py-3 font-medium">Assigned</th>
                  <th className="px-4 py-3 font-medium">Open</th>
                  <th className="px-4 py-3 font-medium">Resolved</th>
                  <th className="px-4 py-3 font-medium">Avg resolution</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {agents.data.data.map((r) => (
                  <tr key={r.agent.id}>
                    <td className="px-4 py-3 font-medium text-slate-900">{r.agent.name}</td>
                    <td className="px-4 py-3">{r.assigned}</td>
                    <td className="px-4 py-3">{r.open}</td>
                    <td className="px-4 py-3">{r.resolved}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {r.avgResolutionMinutes === null
                        ? '—'
                        : r.avgResolutionMinutes < 60
                          ? `${Math.round(r.avgResolutionMinutes)}m`
                          : `${(r.avgResolutionMinutes / 60).toFixed(1)}h`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
