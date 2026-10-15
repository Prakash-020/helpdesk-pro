import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { Lock, Send } from 'lucide-react';
import {
  ALLOWED_TRANSITIONS,
  TICKET_STATUS_LABELS,
  type CommentDto,
  type Paginated,
  type TicketDto,
  type TicketStatus,
  type UserDto,
} from '@helpdesk/shared';
import { api, ApiRequestError } from '../../lib/api';
import { SOCKET_EVENTS } from '@helpdesk/shared';
import { getSocket } from '../../lib/socket';
import { useAuth } from '../auth/use-auth';
import {
  EmptyState,
  ErrorState,
  Field,
  inputCls,
  LoadingState,
  PriorityBadge,
  StatusBadge,
  toast,
} from '../../components/ui';

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

  // Join the ticket room for live thread updates (server re-authorizes).
  useEffect(() => {
    if (!id) return;
    const socket = getSocket();
    socket.emit(SOCKET_EVENTS.JoinTicket, { ticketId: id });
    return () => {
      socket.emit(SOCKET_EVENTS.LeaveTicket, { ticketId: id });
    };
  }, [id]);

  const statusMutation = useMutation({
    mutationFn: (status: TicketStatus) =>
      api.patch<TicketDto>(`/api/v1/tickets/${id}/status`, { status }),
    onSuccess: (t) => {
      queryClient.invalidateQueries({ queryKey: ['ticket', id] });
      toast(`Status → ${TICKET_STATUS_LABELS[t.status]}`);
    },
    onError: (e) => toast(e instanceof ApiRequestError ? e.message : 'Action failed'),
  });

  const assignMutation = useMutation({
    mutationFn: (assigneeId: string | null) =>
      api.patch<TicketDto>(`/api/v1/tickets/${id}/assignment`, { assigneeId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ticket', id] });
      toast('Assignment updated');
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
  const customerTargets =
    user!.role === 'CUSTOMER'
      ? allowedTargets.filter((s) => (ticket.status === 'RESOLVED' ? ['CLOSED', 'OPEN'].includes(s) : false))
      : [];

  return (
    <div className="mx-auto max-w-4xl">
      <Link to="/tickets" className="text-sm font-medium text-slate-500 hover:text-slate-700">
        ← Back to tickets
      </Link>

      <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold text-slate-900">{ticket.subject}</h1>
              {ticket.slaBreached && (
                <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-700">
                  SLA breached
                </span>
              )}
            </div>
            <p className="mt-1 text-sm text-slate-500">
              {ticket.ticketNumber} · opened by {ticket.customer.name} ·{' '}
              {new Date(ticket.createdAt).toLocaleString()}
            </p>
          </div>
          <div className="flex gap-2">
            <StatusBadge status={ticket.status} />
            <PriorityBadge priority={ticket.priority} />
          </div>
        </div>
        <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-slate-700">
          {ticket.description}
        </p>

        {/* Staff controls */}
        {isStaff && (
          <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-4">
            <label className="flex items-center gap-2 text-sm">
              <span className="text-slate-500">Status</span>
              <select
                value={ticket.status}
                onChange={(e) => statusMutation.mutate(e.target.value as TicketStatus)}
                className={`${inputCls} w-48`}
                disabled={statusMutation.isPending}
              >
                <option value={ticket.status}>{TICKET_STATUS_LABELS[ticket.status]}</option>
                {allowedTargets.map((s) => (
                  <option key={s} value={s}>{TICKET_STATUS_LABELS[s]}</option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2 text-sm">
              <span className="text-slate-500">Assignee</span>
              <select
                value={ticket.assignee?.id ?? ''}
                onChange={(e) => assignMutation.mutate(e.target.value || null)}
                className={`${inputCls} w-44`}
                disabled={assignMutation.isPending}
              >
                <option value="">Unassigned</option>
                {agentsQuery.data?.data.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </label>
          </div>
        )}

        {/* Customer confirm/reopen on resolved */}
        {user!.role === 'CUSTOMER' && ticket.status === 'RESOLVED' && (
          <div className="mt-5 flex gap-2 border-t border-slate-100 pt-4">
            <button
              onClick={() => statusMutation.mutate('CLOSED')}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
            >
              Confirm resolution
            </button>
            <button
              onClick={() => statusMutation.mutate('OPEN')}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              I still need help
            </button>
          </div>
        )}
      </div>

      {/* Conversation */}
      <h2 className="mt-8 mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
        Conversation
      </h2>
      <div className="space-y-3">
        {commentsQuery.data?.length === 0 && (
          <EmptyState title="No replies yet" hint="Start the conversation below." />
        )}
        {commentsQuery.data?.map((c) => (
          <div
            key={c.id}
            className={`rounded-xl border p-4 ${
              c.isInternal
                ? 'border-amber-200 bg-amber-50'
                : 'border-slate-200 bg-white'
            }`}
          >
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-slate-800">
                {c.author.name}
                <span className="ml-2 font-normal text-slate-400">{c.author.role.toLowerCase()}</span>
                {c.isInternal && (
                  <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-amber-200 px-2 py-0.5 font-medium text-amber-800">
                    <Lock className="h-3 w-3" /> internal note
                  </span>
                )}
              </span>
              <span className="text-slate-400">{new Date(c.createdAt).toLocaleString()}</span>
            </div>
            <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{c.body}</p>
          </div>
        ))}
      </div>

      {/* Reply box */}
      {ticket.status !== 'CLOSED' && (
        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          {isStaff && (
            <label className="mb-3 flex items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={internal}
                onChange={(e) => setInternal(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
              />
              <Lock className="h-3.5 w-3.5" />
              Internal note (staff only — never visible to the customer)
            </label>
          )}
          <Field label="">
            <textarea
              rows={3}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder={internal ? 'Internal note for the team…' : 'Write a reply…'}
              className={inputCls}
            />
          </Field>
          <div className="mt-3 flex justify-end">
            <button
              onClick={() => replyMutation.mutate({ body, isInternal: internal })}
              disabled={!body.trim() || replyMutation.isPending}
              className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
              {replyMutation.isPending ? 'Sending…' : internal ? 'Add note' : 'Reply'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
