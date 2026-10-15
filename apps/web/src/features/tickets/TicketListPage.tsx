import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { MessageSquare } from 'lucide-react';
import type { Paginated, TicketSummaryDto } from '@helpdesk/shared';
import { api } from '../../lib/api';
import { useAuth } from '../auth/use-auth';
import { EmptyState, ErrorState, LoadingState, PageHeader, Pagination } from '../../components/ui';
import { TicketTable } from './TicketTable';
import { emptyFilters, TicketFilters, type TicketFilterState } from './TicketFilters';

/** Colored spotlight cards for the top urgent tickets (reference design row). */
function PriorityCards({ tickets }: { tickets: TicketSummaryDto[] }) {
  const hot = tickets
    .filter((t) => ['URGENT', 'HIGH'].includes(t.priority) && ['OPEN', 'IN_PROGRESS'].includes(t.status))
    .slice(0, 3);
  if (hot.length === 0) return null;

  const palette = [
    'bg-teal-600 text-white',
    'bg-rose-500 text-white',
    'bg-amber-300 text-slate-900',
  ];

  return (
    <div className="mb-6">
      <p className="mb-3 text-sm font-semibold text-slate-700">
        Priority attention ({hot.length})
      </p>
      <div className="grid gap-4 sm:grid-cols-3">
        {hot.map((t, i) => (
          <Link
            key={t.id}
            to={`/tickets/${t.id}`}
            className={`rounded-2xl p-5 shadow-sm transition-transform hover:-translate-y-0.5 ${palette[i % palette.length]}`}
          >
            <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide opacity-80">
              <span>{t.ticketNumber}</span>
              <span className="rounded-full bg-white/25 px-2 py-0.5">{t.priority}</span>
            </div>
            <p className="mt-3 font-semibold leading-snug">{t.subject}</p>
            <div className="mt-6 flex items-center justify-between text-xs opacity-80">
              <span className="inline-flex items-center gap-1">
                <MessageSquare className="h-3.5 w-3.5" /> {t.commentCount}
              </span>
              <span>{new Date(t.createdAt).toLocaleDateString()}</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

/**
 * One list page serves three scopes:
 *  - /tickets        → customer "my tickets" / admin "all tickets"
 *  - /queue          → staff pool (unassigned + mine), grouped sections
 *  - /assigned       → agent's own assignments (assignee=me)
 */
export function TicketListPage({ scope }: { scope: 'mine' | 'queue' | 'all' }) {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const [filters, setFilters] = useState<TicketFilterState>(emptyFilters);
  const page = Number(params.get('page')) || 1;

  // Debounce filters → applied state (300ms)
  const [applied, setApplied] = useState(filters);
  useEffect(() => {
    const t = setTimeout(() => setApplied(filters), 300);
    return () => clearTimeout(t);
  }, [filters]);

  const query = useQuery({
    queryKey: ['tickets', scope, applied, page],
    queryFn: () => {
      const sp = new URLSearchParams({ page: String(page), pageSize: '15' });
      if (applied.status) sp.set('status', applied.status);
      if (applied.priority) sp.set('priority', applied.priority);
      if (applied.categoryId) sp.set('categoryId', applied.categoryId);
      if (applied.search) sp.set('search', applied.search);
      if (applied.assigneeId) sp.set('assigneeId', applied.assigneeId);
      if (scope === 'mine' && user?.role === 'AGENT') sp.set('assignee', 'me');
      return api.get<Paginated<TicketSummaryDto>>(`/api/v1/tickets?${sp}`);
    },
    placeholderData: (prev) => prev,
  });

  const titles = { mine: 'My tickets', queue: 'Support requests', all: 'All tickets' };
  const isQueue = scope === 'queue' && user!.role !== 'CUSTOMER';

  return (
    <div>
      <PageHeader title={titles[scope]} />
      {isQueue && query.data && <PriorityCards tickets={query.data.data} />}
      <TicketFilters filters={filters} onChange={setFilters} role={user!.role} />
      {query.isPending && <LoadingState label="Loading tickets…" />}
      {query.isError && <ErrorState message={(query.error as Error).message} onRetry={query.refetch} />}
      {query.data && (
        <>
          {query.data.data.length === 0 ? (
            <EmptyState title="No tickets found" hint="Try adjusting filters or create a new ticket." />
          ) : (
            <TicketTable
              tickets={query.data.data}
              showCustomer={user!.role !== 'CUSTOMER'}
              grouped={isQueue}
            />
          )}
          <Pagination
            page={query.data.page}
            pageSize={query.data.pageSize}
            total={query.data.total}
            onPage={(p) => setParams({ page: String(p) })}
          />
        </>
      )}
    </div>
  );
}
