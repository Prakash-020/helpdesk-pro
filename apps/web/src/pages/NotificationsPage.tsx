import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import type { NotificationDto, Paginated } from '@helpdesk/shared';
import { api } from '../lib/api';
import { EmptyState, LoadingState, PageHeader } from '../components/ui';

export function NotificationsPage() {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ['notifications', 'list'],
    queryFn: () => api.get<Paginated<NotificationDto>>('/api/v1/notifications?pageSize=50'),
  });
  const markAll = useMutation({
    mutationFn: () => api.patch('/api/v1/notifications/read-all'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });
  const markOne = useMutation({
    mutationFn: (id: string) => api.patch(`/api/v1/notifications/${id}/read`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  return (
    <div className="max-w-3xl">
      <PageHeader title="Notifications">
        <button
          onClick={() => markAll.mutate()}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Mark all read
        </button>
      </PageHeader>
      {query.isPending && <LoadingState />}
      {query.data?.data.length === 0 && <EmptyState title="No notifications" />}
      <div className="space-y-2">
        {query.data?.data.map((n) => (
          <div
            key={n.id}
            className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 ${
              n.readAt ? 'border-slate-200 bg-white' : 'border-brand-200 bg-brand-50'
            }`}
          >
            <div className="text-sm">
              {n.ticketId ? (
                <Link to={`/tickets/${n.ticketId}`} className="font-medium text-slate-800 hover:text-brand-600">
                  {n.message}
                </Link>
              ) : (
                <span className="font-medium text-slate-800">{n.message}</span>
              )}
              <span className="mt-0.5 block text-xs text-slate-400">
                {new Date(n.createdAt).toLocaleString()}
              </span>
            </div>
            {!n.readAt && (
              <button
                onClick={() => markOne.mutate(n.id)}
                className="text-xs font-medium text-brand-600 hover:underline"
              >
                Mark read
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
