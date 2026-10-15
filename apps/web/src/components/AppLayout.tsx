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

const NAV: NavItem[] = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['CUSTOMER', 'AGENT', 'ADMIN'] },
  { to: '/tickets/new', label: 'New ticket', icon: PlusCircle, roles: ['CUSTOMER'] },
  { to: '/tickets', label: 'My tickets', icon: Inbox, roles: ['CUSTOMER'] },
  { to: '/queue', label: 'Queue', icon: ListTodo, roles: ['AGENT', 'ADMIN'] },
  { to: '/assigned', label: 'Assigned to me', icon: Inbox, roles: ['AGENT'] },
  { to: '/tickets', label: 'All tickets', icon: Inbox, roles: ['ADMIN'] },
  { to: '/notifications', label: 'Notifications', icon: Bell, roles: ['CUSTOMER', 'AGENT', 'ADMIN'] },
  { to: '/admin/users', label: 'Users', icon: Users, roles: ['ADMIN'] },
  { to: '/admin/categories', label: 'Categories', icon: FolderTree, roles: ['ADMIN'] },
  { to: '/admin/analytics', label: 'Analytics', icon: BarChart3, roles: ['ADMIN'] },
  { to: '/admin/audit', label: 'Audit log', icon: ScrollText, roles: ['ADMIN'] },
];

function NotificationBell() {
  const { data: unread } = useQuery({
    queryKey: ['notifications', 'unread'],
    queryFn: () => api.get<{ count: number }>('/api/v1/notifications/unread-count'),
    refetchInterval: 30_000,
  });
  const { data: recent } = useQuery({
    queryKey: ['notifications', 'recent'],
    queryFn: () =>
      api.get<Paginated<NotificationDto>>('/api/v1/notifications?pageSize=5'),
  });
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const count = unread?.count ?? 0;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={`Notifications${count ? `, ${count} unread` : ''}`}
        className="relative rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
      >
        <Bell className="h-5 w-5" />
        {count > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-40 mt-2 w-80 rounded-xl border border-slate-200 bg-white shadow-lg">
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
    <div className="flex min-h-screen bg-slate-50">
      <aside className="fixed inset-y-0 left-0 z-20 flex w-60 flex-col border-r border-slate-200 bg-white">
        <div className="flex items-center gap-2 px-5 py-5 font-semibold text-slate-900">
          <Headset className="h-6 w-6 text-brand-600" />
          HelpDesk Pro
        </div>
        <nav className="flex-1 space-y-1 px-3">
          {NAV.filter((i) => i.roles.includes(user.role)).map((item) => (
            <NavLink
              key={item.to + item.label}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium ${
                  isActive
                    ? 'bg-brand-50 text-brand-700'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`
              }
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700">
              {user.name.slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-slate-900">{user.name}</p>
              <p className="text-xs text-slate-500">{ROLE_LABELS[user.role]}</p>
            </div>
            <button
              onClick={() => {
                disconnectSocket();
                logout.mutate(undefined, { onSettled: () => navigate('/login') });
              }}
              aria-label="Log out"
              className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
          <NavLink
            to="/profile"
            className="mt-3 block rounded-lg border border-slate-200 px-3 py-1.5 text-center text-xs font-medium text-slate-600 hover:bg-slate-50"
          >
            Profile settings
          </NavLink>
        </div>
      </aside>

      <main className="ml-60 flex-1 p-6 lg:p-8">
        <div className="mb-2 flex justify-end">
          <NotificationBell />
        </div>
        <Outlet />
      </main>
      <ToastHost />
    </div>
  );
}
