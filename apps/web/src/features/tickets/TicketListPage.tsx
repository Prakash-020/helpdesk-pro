import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import type { Paginated, TicketSummaryDto } from '@helpdesk/shared';
import { api } from '../../lib/api';
import { useAuth } from '../auth/use-auth';
import { EmptyState, ErrorState, LoadingState, PageHeader, Pagination } from '../../components/ui';
import { TicketTable } from './TicketTable';
import { emptyFilters, TicketFilters, type TicketFilterState } from './TicketFilters';

/**
 * One list page serves three scopes:
 *  - /tickets        → customer "my tickets" / admin "all tickets"
 *  - /queue          → agent pool (unassigned + mine)
 *  - /assigned?me=1  → agent's own assignments
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
      if (scope === 'queue' && user?.role === 'AGENT') sp.set('status', applied.status || '');
      return api.get<Paginated<TicketSummaryDto>>(`/api/v1/tickets?${sp}`);
    },
    placeholderData: (prev) => prev,
  });

  const titles = { mine: 'My tickets', queue: 'Ticket queue', all: 'All tickets' };

  return (
    <div>
      <PageHeader title={titles[scope]} />
      <TicketFilters filters={filters} onChange={setFilters} role={user!.role} />
      {query.isPending && <LoadingState label="Loading tickets…" />}
      {query.isError && <ErrorState message={(query.error as Error).message} onRetry={query.refetch} />}
      {query.data && (
        <>
          {query.data.data.length === 0 ? (
            <EmptyState title="No tickets found" hint="Try adjusting filters or create a new ticket." />
          ) : (
            <TicketTable tickets={query.data.data} showCustomer={user!.role !== 'CUSTOMER'} />
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
