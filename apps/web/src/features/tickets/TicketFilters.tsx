import { useQuery } from '@tanstack/react-query';
import {
  PRIORITIES,
  PRIORITY_LABELS,
  TICKET_STATUSES,
  TICKET_STATUS_LABELS,
  type CategoryDto,
  type Paginated,
  type Role,
  type UserDto,
} from '@helpdesk/shared';
import { api } from '../../lib/api';
import { inputCls } from '../../components/ui';

// inputCls ships w-full (for stacked forms) — filters need intrinsic widths.
const filterCls = inputCls.replace('w-full', '');

export interface TicketFilterState {
  search: string;
  status: string;
  priority: string;
  categoryId: string;
  assigneeId: string;
}

export const emptyFilters: TicketFilterState = {
  search: '',
  status: '',
  priority: '',
  categoryId: '',
  assigneeId: '',
};

export function TicketFilters({
  filters,
  onChange,
  role,
}: {
  filters: TicketFilterState;
  onChange: (f: TicketFilterState) => void;
  role: Role;
}) {
  const isStaff = role !== 'CUSTOMER';
  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: () => api.get<CategoryDto[]>('/api/v1/categories'),
  });
  const { data: agents } = useQuery({
    queryKey: ['users', 'agents'],
    queryFn: () => api.get<Paginated<UserDto>>('/api/v1/users?role=AGENT&pageSize=50'),
    enabled: isStaff,
  });

  const set = (patch: Partial<TicketFilterState>) => onChange({ ...filters, ...patch });

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <input
        placeholder="Search subject or #…"
        value={filters.search}
        onChange={(e) => set({ search: e.target.value })}
        className={`${filterCls} w-56`}
      />
      <select value={filters.status} onChange={(e) => set({ status: e.target.value })} className={`${filterCls} w-44`}>
        <option value="">All statuses</option>
        {TICKET_STATUSES.map((s) => (
          <option key={s} value={s}>{TICKET_STATUS_LABELS[s]}</option>
        ))}
      </select>
      <select value={filters.priority} onChange={(e) => set({ priority: e.target.value })} className={`${filterCls} w-36`}>
        <option value="">All priorities</option>
        {PRIORITIES.map((p) => (
          <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>
        ))}
      </select>
      <select value={filters.categoryId} onChange={(e) => set({ categoryId: e.target.value })} className={`${filterCls} w-40`}>
        <option value="">All categories</option>
        {categories?.map((c) => (
          <option key={c.id} value={c.id}>{c.name}</option>
        ))}
      </select>
      {isStaff && (
        <select value={filters.assigneeId} onChange={(e) => set({ assigneeId: e.target.value })} className={`${filterCls} w-40`}>
          <option value="">Any assignee</option>
          {agents?.data.map((a) => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </select>
      )}
    </div>
  );
}
