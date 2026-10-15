import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Headset, Inbox, BarChart3, BellRing } from 'lucide-react';
import type { HealthDto } from '@helpdesk/shared';
import { api } from '../lib/api';

const features = [
  {
    icon: Inbox,
    title: 'Ticket management',
    text: 'Full lifecycle from first report to resolution — assignment, priorities, categories, audit trail.',
  },
  {
    icon: BellRing,
    title: 'Real-time updates',
    text: 'Socket.IO pushes status changes and replies instantly — with persisted notifications as fallback.',
  },
  {
    icon: BarChart3,
    title: 'Analytics & SLA',
    text: 'Workload, first-response and resolution times, and SLA breach monitoring for admins.',
  },
];

/** Live proof the frontend ↔ proxy ↔ API path works. */
function ApiStatusCard() {
  const { data, isPending, isError } = useQuery({
    queryKey: ['health'],
    queryFn: () => api.get<HealthDto>('/api/health'),
    refetchInterval: 15_000,
    retry: 0,
  });

  return (
    <div className="mt-12 inline-flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-5 py-3 shadow-sm">
      <span
        className={`h-2.5 w-2.5 rounded-full ${
          isPending ? 'animate-pulse bg-amber-400' : isError ? 'bg-red-500' : 'bg-emerald-500'
        }`}
      />
      <span className="text-sm font-medium text-slate-700">
        {isPending && 'Checking API…'}
        {isError && 'API unreachable — start the server (npm run dev:api)'}
        {data && `API connected · uptime ${data.uptime}s`}
      </span>
    </div>
  );
}

export function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-brand-50 via-white to-white">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2 font-semibold text-slate-900">
          <Headset className="h-6 w-6 text-brand-600" />
          HelpDesk Pro
        </div>
        <nav className="flex items-center gap-3">
          <Link to="/login" className="text-sm font-medium text-slate-600 hover:text-slate-900">
            Log in
          </Link>
          <Link
            to="/register"
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-700"
          >
            Get started
          </Link>
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-6 pb-24 pt-16 text-center">
        <h1 className="mx-auto max-w-3xl text-5xl font-bold tracking-tight text-slate-900">
          Customer support that scales with your team
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-lg text-slate-600">
          HelpDesk Pro gives customers a clear way to ask for help — and gives agents and
          admins the tools to resolve issues fast.
        </p>
        <ApiStatusCard />

        <div className="mt-20 grid gap-6 text-left sm:grid-cols-3">
          {features.map(({ icon: Icon, title, text }) => (
            <div
              key={title}
              className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
            >
              <Icon className="h-7 w-7 text-brand-600" />
              <h3 className="mt-4 font-semibold text-slate-900">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">{text}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
