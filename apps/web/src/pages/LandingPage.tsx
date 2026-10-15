import { Link, useNavigate } from 'react-router-dom';
import {
  BarChart3,
  Bell,
  Headset,
  KeyRound,
  Lock,
  ShieldCheck,
  Timer,
  User,
  UserCog,
  Zap,
} from 'lucide-react';
import { useAuth } from '../features/auth/use-auth';
import { toast } from '../components/ui';

const DEMO = [
  {
    role: 'Customer',
    email: 'customer@helpdesk.dev',
    icon: User,
    blurb: 'Create tickets, reply to agents, track resolution, reopen if needed.',
    accent: 'bg-sky-500',
  },
  {
    role: 'Agent',
    email: 'agent@helpdesk.dev',
    icon: Headset,
    blurb: 'Work the queue, triage, assign, add internal notes, resolve tickets.',
    accent: 'bg-brand-600',
  },
  {
    role: 'Admin',
    email: 'admin@helpdesk.dev',
    icon: UserCog,
    blurb: 'Manage users & roles, categories, analytics, and the audit trail.',
    accent: 'bg-slate-900',
  },
] as const;

const FEATURES = [
  { icon: ShieldCheck, title: 'Role-based access', text: 'Customer / Agent / Admin enforced server-side on every route.' },
  { icon: Zap, title: 'Realtime updates', text: 'Socket.IO pushes replies, assignments and notifications instantly.' },
  { icon: Timer, title: 'SLA tracking', text: 'Per-priority response & resolution deadlines with breach flags.' },
  { icon: Lock, title: 'Session security', text: 'HttpOnly cookie sessions, hashed tokens, CSRF origin checks.' },
  { icon: BarChart3, title: 'Analytics', text: 'Volume, backlog, SLA and per-agent performance dashboards.' },
  { icon: KeyRound, title: 'Audit trail', text: 'Every sensitive action is logged — filterable and append-only.' },
] as const;

const STACK = ['React 19', 'TypeScript', 'Vite', 'Tailwind v4', 'Express', 'Prisma', 'PostgreSQL 16', 'Socket.IO', 'TanStack Query', 'Zod'];

export function LandingPage() {
  const { login, user } = useAuth();
  const navigate = useNavigate();

  async function demoLogin(email: string, role: string) {
    try {
      await login.mutateAsync({ email, password: 'Demo!Passw0rd' });
      toast(`Signed in as demo ${role}`);
      navigate('/dashboard', { replace: true });
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Demo login failed');
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Nav */}
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2 font-semibold text-slate-900">
          <Headset className="h-6 w-6 text-brand-600" />
          HelpDesk Pro
        </div>
        <div className="flex items-center gap-3">
          {user ? (
            <Link
              to="/dashboard"
              className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
            >
              Open app →
            </Link>
          ) : (
            <>
              <Link to="/login" className="text-sm font-medium text-slate-600 hover:text-slate-900">
                Sign in
              </Link>
              <Link
                to="/register"
                className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
              >
                Get started
              </Link>
            </>
          )}
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-6 pb-16 pt-14 text-center">
        <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700 ring-1 ring-brand-200">
          Live demo environment
        </span>
        <h1 className="mx-auto mt-6 max-w-2xl text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">
          Customer support, the full-stack way.
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-lg text-slate-600">
          Tickets, SLA deadlines, realtime notifications, internal notes, analytics and a
          complete audit trail — with role-based security enforced by the backend.
        </p>

        {/* One-click role demo — built for reviewers */}
        <div className="mx-auto mt-12 grid max-w-3xl gap-4 sm:grid-cols-3">
          {DEMO.map((d) => (
            <div
              key={d.role}
              className="rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm"
            >
              <div className={`inline-flex rounded-xl p-2.5 text-white ${d.accent}`}>
                <d.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-3 font-semibold text-slate-900">Demo as {d.role}</h3>
              <p className="mt-1 min-h-10 text-sm text-slate-500">{d.blurb}</p>
              <button
                onClick={() => demoLogin(d.email, d.role)}
                disabled={login.isPending}
                className="mt-4 w-full rounded-xl bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
              >
                {login.isPending ? 'Signing in…' : `Try as ${d.role} →`}
              </button>
            </div>
          ))}
        </div>
        <p className="mt-4 text-xs text-slate-400">
          No signup needed — seeded demo data, safe to explore. Password for all accounts:{' '}
          <code className="rounded bg-slate-100 px-1.5 py-0.5">Demo!Passw0rd</code>
        </p>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-6xl px-6 pb-16">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <f.icon className="h-5 w-5 text-brand-600" />
              <h3 className="mt-3 font-semibold text-slate-900">{f.title}</h3>
              <p className="mt-1 text-sm text-slate-500">{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Stack strip */}
      <section className="border-t border-slate-200 bg-white py-8">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-6 gap-y-2 px-6 text-sm font-medium text-slate-400">
          {STACK.map((s) => (
            <span key={s}>{s}</span>
          ))}
        </div>
      </section>

      <footer className="py-8 text-center text-xs text-slate-400">
        <Bell className="mr-1 inline h-3.5 w-3.5" />
        Built as a portfolio project — PostgreSQL, Prisma, Express, React, Socket.IO.
      </footer>
    </div>
  );
}
