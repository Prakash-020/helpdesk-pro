import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart3,
  Bell,
  FolderTree,
  Headset,
  Inbox,
  LayoutDashboard,
  ListTodo,
  LogOut,
  PlusCircle,
  ScrollText,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { useState } from 'react';
import { ROLE_LABELS, type Role, type Paginated, type NotificationDto } from '@helpdesk/shared';
import { api } from '../lib/api';
import { useAuth } from '../features/auth/use-auth';
import { useRealtime } from '../hooks/use-realtime';
import { disconnectSocket } from '../lib/socket';
import { ToastHost } from './ui';

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  roles: Role[];
}

const NAV_SECTIONS: { label: string; items: NavItem[] }[] = [
  {
    label: 'Workspace',
    items: [
      { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['CUSTOMER', 'AGENT', 'ADMIN'] },
      { to: '/tickets/new', label: 'New ticket', icon: PlusCircle, roles: ['CUSTOMER'] },
      { to: '/tickets', label: 'My tickets', icon: Inbox, roles: ['CUSTOMER'] },
      { to: '/queue', label: 'Requests', icon: ListTodo, roles: ['AGENT', 'ADMIN'] },
      { to: '/assigned', label: 'Assigned to me', icon: Inbox, roles: ['AGENT'] },
      { to: '/tickets', label: 'All tickets', icon: Inbox, roles: ['ADMIN'] },
      { to: '/notifications', label: 'Notifications', icon: Bell, roles: ['CUSTOMER', 'AGENT', 'ADMIN'] },
    ],
  },
  {
    label: 'Admin',
    items: [
      { to: '/admin/users', label: 'Users', icon: Users, roles: ['ADMIN'] },
      { to: '/admin/categories', label: 'Categories', icon: FolderTree, roles: ['ADMIN'] },
      { to: '/admin/analytics', label: 'Analytics', icon: BarChart3, roles: ['ADMIN'] },
      { to: '/admin/audit', label: 'Audit log', icon: ScrollText, roles: ['ADMIN'] },
    ],
  },
];

function NotificationBell() {
  const { data: unread } = useQuery({
    queryKey: ['notifications', 'unread'],
    queryFn: () => api.get<{ count: number }>('/api/v1/notifications/unread-count'),
    refetchInterval: 30_000,
  });
  const { data: recent } = useQuery({
    queryKey: ['notifications', 'recent'],
    queryFn: () => api.get<Paginated<NotificationDto>>('/api/v1/notifications?pageSize=5'),
  });
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const count = unread?.count ?? 0;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={`Notifications${count ? `, ${count} unread` : ''}`}
        className="relative rounded-full p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
      >
        <Bell className="h-5 w-5" />
        {count > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-40 mt-2 w-80 rounded-2xl border border-slate-200 bg-white shadow-xl">
            <div className="border-b border-slate-100 px-4 py-3 text-sm font-semibold">
              Notifications
            </div>
            <div className="max-h-72 overflow-y-auto">
              {recent?.data.length === 0 && (
                <p className="px-4 py-6 text-sm text-slate-500">You're all caught up.</p>
              )}
              {recent?.data.map((n) => (
                <button
                  key={n.id}
                  onClick={() => {
                    setOpen(false);
                    if (n.ticketId) navigate(`/tickets/${n.ticketId}`);
                  }}
                  className={`block w-full px-4 py-3 text-left text-sm hover:bg-slate-50 ${
                    n.readAt ? 'text-slate-500' : 'font-medium text-slate-800'
                  }`}
                >
                  {n.message}
                  <span className="mt-0.5 block text-xs text-slate-400">
                    {new Date(n.createdAt).toLocaleString()}
                  </span>
                </button>
              ))}
            </div>
            <button
              onClick={() => {
                setOpen(false);
                navigate('/notifications');
              }}
              className="w-full border-t border-slate-100 px-4 py-2.5 text-center text-sm font-medium text-brand-600 hover:bg-slate-50"
            >
              View all
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  useRealtime(user);

  if (!user) return null; // ProtectedRoute guarantees a user here

  return (
    <div className="flex min-h-screen bg-slate-100">
      {/* Dark sidebar — matches reference */}
      <aside className="fixed inset-y-0 left-0 z-20 flex w-60 flex-col bg-slate-900">
        <div className="flex items-center gap-2 px-5 py-6 font-semibold text-white">
          <Headset className="h-6 w-6 text-brand-400" />
          HelpDesk Pro
        </div>

        <nav className="flex-1 space-y-6 overflow-y-auto px-3">
          {NAV_SECTIONS.map((section) => {
            const items = section.items.filter((i) => i.roles.includes(user.role));
            if (items.length === 0) return null;
            return (
              <div key={section.label}>
                <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-widest text-slate-500">
                  {section.label}
                </p>
                <div className="space-y-1">
                  {items.map((item) => (
                    <NavLink
                      key={item.to + item.label}
                      to={item.to}
                      className={({ isActive }) =>
                        `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                          isActive
                            ? 'bg-white/10 text-white'
                            : 'text-slate-400 hover:bg-white/5 hover:text-white'
                        }`
                      }
                    >
                      <item.icon className="h-4 w-4" />
                      {item.label}
                    </NavLink>
                  ))}
                </div>
              </div>
            );
          })}
        </nav>

        <div className="border-t border-white/10 p-4">
          <div className="flex items-center gap-3 rounded-xl bg-white/5 p-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-500 text-sm font-semibold text-white">
              {user.name.slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-white">{user.name}</p>
              <p className="text-xs text-slate-400">{ROLE_LABELS[user.role]}</p>
            </div>
            <button
              onClick={() => {
                disconnectSocket();
                logout.mutate(undefined, { onSettled: () => navigate('/login') });
              }}
              aria-label="Log out"
              className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
          <NavLink
            to="/profile"
            className="mt-2 block rounded-xl border border-white/10 px-3 py-2 text-center text-xs font-medium text-slate-300 hover:bg-white/5"
          >
            Profile settings
          </NavLink>
        </div>
      </aside>

      <main className="ml-60 flex-1 p-6 lg:p-8">
        <div className="mb-2 flex items-center justify-end gap-2">
          <NotificationBell />
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-600 text-xs font-semibold text-white">
            {user.name.slice(0, 1).toUpperCase()}
          </span>
        </div>
        <Outlet />
      </main>
      <ToastHost />
    </div>
  );
}
