import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { Lock, Send } from 'lucide-react';
import {
  ALLOWED_TRANSITIONS,
  PRIORITIES,
  PRIORITY_LABELS,
  TICKET_STATUS_LABELS,
  type CommentDto,
  type Paginated,
  type Priority,
  type TicketDto,
  type TicketStatus,
  type UserDto,
} from '@helpdesk/shared';
import { api, ApiRequestError } from '../../lib/api';
import { SOCKET_EVENTS } from '@helpdesk/shared';
import { getSocket } from '../../lib/socket';
import { useAuth } from '../auth/use-auth';
import { dueIn } from '../../lib/time';
import {
  EmptyState,
  ErrorState,
  inputCls,
  LoadingState,
  PriorityBadge,
  StatusBadge,
  toast,
} from '../../components/ui';

function initials(name: string) {
  return name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
}

export function TicketDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isStaff = user!.role !== 'CUSTOMER';

  const ticketQuery = useQuery({
    queryKey: ['ticket', id],
    queryFn: () => api.get<TicketDto>(`/api/v1/tickets/${id}`),
  });
  const commentsQuery = useQuery({
    queryKey: ['comments', id],
    queryFn: () => api.get<CommentDto[]>(`/api/v1/tickets/${id}/comments`),
  });
  const agentsQuery = useQuery({
    queryKey: ['users', 'agents'],
    queryFn: () => api.get<Paginated<UserDto>>('/api/v1/users?role=AGENT&pageSize=50'),
    enabled: isStaff,
  });

  // Join the ticket room — server re-authorizes membership.
  useEffect(() => {
    if (!id) return;
    const socket = getSocket();
    socket.emit(SOCKET_EVENTS.JoinTicket, { ticketId: id });
    return () => {
      socket.emit(SOCKET_EVENTS.LeaveTicket, { ticketId: id });
    };
  }, [id]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['ticket', id] });
    queryClient.invalidateQueries({ queryKey: ['comments', id] });
  };

  const statusMutation = useMutation({
    mutationFn: (status: TicketStatus) =>
      api.patch<TicketDto>(`/api/v1/tickets/${id}/status`, { status }),
    onSuccess: (t) => {
      invalidate();
      toast(`Status → ${TICKET_STATUS_LABELS[t.status]}`);
    },
    onError: (e) => toast(e instanceof ApiRequestError ? e.message : 'Action failed'),
  });

  const assignMutation = useMutation({
    mutationFn: (assigneeId: string | null) =>
      api.patch<TicketDto>(`/api/v1/tickets/${id}/assignment`, { assigneeId }),
    onSuccess: () => {
      invalidate();
      toast('Assignment updated');
    },
    onError: (e) => toast(e instanceof ApiRequestError ? e.message : 'Action failed'),
  });

  const priorityMutation = useMutation({
    mutationFn: (priority: Priority) =>
      api.patch<TicketDto>(`/api/v1/tickets/${id}`, { priority }),
    onSuccess: () => {
      invalidate();
      toast('Priority updated');
    },
    onError: (e) => toast(e instanceof ApiRequestError ? e.message : 'Action failed'),
  });

  const replyMutation = useMutation({
    mutationFn: (input: { body: string; isInternal: boolean }) =>
      api.post<CommentDto>(`/api/v1/tickets/${id}/comments`, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comments', id] });
      setBody('');
      setInternal(false);
    },
    onError: (e) => toast(e instanceof ApiRequestError ? e.message : 'Reply failed'),
  });

  const [body, setBody] = useState('');
  const [internal, setInternal] = useState(false);

  if (ticketQuery.isPending) return <LoadingState label="Loading ticket…" />;
  if (ticketQuery.isError) {
    const err = ticketQuery.error as ApiRequestError;
    return <ErrorState message={err.status === 404 ? 'Ticket not found or not accessible.' : err.message} />;
  }
  const ticket = ticketQuery.data;
  const allowedTargets = ALLOWED_TRANSITIONS[ticket.status];

  return (
    <div>
      <Link to="/queue" className="text-sm font-medium text-slate-500 hover:text-slate-700">
        ← Back to requests
      </Link>

      <div className="mt-3 grid gap-6 lg:grid-cols-[1fr_320px]">
        {/* ── Left: conversation ─────────────────────────────── */}
        <div className="min-w-0">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={ticket.status} />
              <PriorityBadge priority={ticket.priority} />
              {ticket.slaBreached && (
                <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-700">
                  SLA breached
                </span>
              )}
            </div>
            <h1 className="mt-3 text-xl font-bold text-slate-900">{ticket.subject}</h1>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">
              {ticket.description}
            </p>
          </div>

          {/* Thread — chat-bubble style */}
          <div className="mt-4 space-y-3">
            {commentsQuery.data?.length === 0 && (
              <EmptyState title="No replies yet" hint="Start the conversation below." />
            )}
            {commentsQuery.data?.map((c) => {
              const mine = c.author.id === user!.id;
              return (
                <div key={c.id} className={`flex gap-3 ${mine ? 'flex-row-reverse' : ''}`}>
                  <span className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-200 text-xs font-semibold text-slate-600">
                    {initials(c.author.name)}
                  </span>
                  <div
                    className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm shadow-sm ${
                      c.isInternal
                        ? 'border border-amber-300 bg-amber-50'
                        : mine
                          ? 'bg-brand-600 text-white'
                          : 'border border-slate-200 bg-white text-slate-700'
                    }`}
                  >
                    <div
                      className={`mb-1 flex items-center gap-2 text-[11px] font-medium ${
                        c.isInternal ? 'text-amber-700' : mine ? 'text-brand-200' : 'text-slate-400'
                      }`}
                    >
                      {c.author.name} · {new Date(c.createdAt).toLocaleString()}
                      {c.isInternal && (
                        <span className="inline-flex items-center gap-1">
                          <Lock className="h-3 w-3" /> internal
                        </span>
                      )}
                    </div>
                    <p className="whitespace-pre-wrap">{c.body}</p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Reply box */}
          {ticket.status !== 'CLOSED' && (
            <div className="sticky bottom-4 mt-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-lg">
              {isStaff && (
                <label className="mb-3 flex items-center gap-2 text-xs font-medium text-slate-600">
                  <input
                    type="checkbox"
                    checked={internal}
                    onChange={(e) => setInternal(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                  />
                  <Lock className="h-3.5 w-3.5" />
                  Internal note (staff only)
                </label>
              )}
              <div className="flex items-end gap-2">
                <textarea
                  rows={2}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder={internal ? 'Internal note for the team…' : 'Type your message here…'}
                  className={`${inputCls} flex-1`}
                />
                <button
                  onClick={() => replyMutation.mutate({ body, isInternal: internal })}
                  disabled={!body.trim() || replyMutation.isPending}
                  aria-label="Send"
                  className="rounded-xl bg-slate-900 p-2.5 text-white hover:bg-slate-700 disabled:opacity-40"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── Right: info panel ──────────────────────────────── */}
        <aside className="space-y-4">
          {/* Customer card */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-100 text-sm font-bold text-brand-700">
                {initials(ticket.customer.name)}
              </span>
              <div>
                <p className="font-semibold text-slate-900">{ticket.customer.name}</p>
                <p className="text-xs text-slate-500">{ticket.customer.email}</p>
              </div>
            </div>
            <div className="mt-4 flex items-center gap-2 text-xs">
              <span className="rounded-full bg-slate-100 px-2 py-1 font-medium text-slate-600">
                {ticket.ticketNumber}
              </span>
              <span className="text-slate-400">{ticket.category?.name}</span>
            </div>
          </div>

          {/* Ticket meta */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Details
            </h3>
            <dl className="mt-3 space-y-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-slate-500">Opened</dt>
                <dd className="font-medium text-slate-800">
                  {new Date(ticket.createdAt).toLocaleDateString()}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Assigned to</dt>
                <dd className="font-medium text-slate-800">{ticket.assignee?.name ?? 'Unassigned'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">First response</dt>
                <dd className="font-medium text-slate-800">
                  {ticket.firstResponseAt ? new Date(ticket.firstResponseAt).toLocaleString() : '—'}
                </dd>
              </div>
              {ticket.resolutionDueAt && (
                <div className="flex justify-between">
                  <dt className="text-slate-500">Resolution due</dt>
                  <dd className="text-right">
                    <span className={`block font-medium ${ticket.slaBreached ? 'text-red-600' : 'text-slate-800'}`}>
                      {dueIn(ticket.resolutionDueAt)?.label}
                    </span>
                    <span className="text-xs text-slate-400">
                      {new Date(ticket.resolutionDueAt).toLocaleString()}
                    </span>
                  </dd>
                </div>
              )}
              {ticket.resolvedAt && (
                <div className="flex justify-between">
                  <dt className="text-slate-500">Resolved</dt>
                  <dd className="font-medium text-slate-800">
                    {new Date(ticket.resolvedAt).toLocaleString()}
                  </dd>
                </div>
              )}
            </dl>
          </div>

          {/* Staff controls */}
          {isStaff && (
            <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Manage
              </h3>
              <label className="block text-sm">
                <span className="mb-1 block text-slate-500">Status</span>
                <select
                  value={ticket.status}
                  onChange={(e) => statusMutation.mutate(e.target.value as TicketStatus)}
                  disabled={statusMutation.isPending || allowedTargets.length === 0}
                  className={inputCls}
                >
                  <option value={ticket.status}>{TICKET_STATUS_LABELS[ticket.status]}</option>
                  {allowedTargets.map((s) => (
                    <option key={s} value={s}>{TICKET_STATUS_LABELS[s]}</option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-slate-500">Assignee</span>
                <select
                  value={ticket.assignee?.id ?? ''}
                  onChange={(e) => assignMutation.mutate(e.target.value || null)}
                  disabled={assignMutation.isPending}
                  className={inputCls}
                >
                  <option value="">Unassigned</option>
                  {agentsQuery.data?.data.map((a) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-slate-500">Priority</span>
                <select
                  value={ticket.priority}
                  onChange={(e) => priorityMutation.mutate(e.target.value as Priority)}
                  disabled={priorityMutation.isPending}
                  className={inputCls}
                >
                  {PRIORITIES.map((p) => (
                    <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>
                  ))}
                </select>
              </label>
            </div>
          )}

          {/* Customer confirm/reopen */}
          {user!.role === 'CUSTOMER' && ticket.status === 'RESOLVED' && (
            <div className="space-y-2 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <button
                onClick={() => statusMutation.mutate('CLOSED')}
                className="w-full rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-700"
              >
                Confirm resolution
              </button>
              <button
                onClick={() => statusMutation.mutate('OPEN')}
                className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                I still need help
              </button>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
