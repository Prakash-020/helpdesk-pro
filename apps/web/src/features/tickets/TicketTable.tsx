import { Link } from 'react-router-dom';
import { MessageSquare } from 'lucide-react';
import type { TicketSummaryDto } from '@helpdesk/shared';
import { PriorityBadge, StatusBadge } from '../../components/ui';

function Avatar({ name }: { name: string }) {
  return (
    <span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-brand-100 text-[11px] font-semibold text-brand-700">
      {name.slice(0, 1).toUpperCase()}
    </span>
  );
}

function Rows({ tickets, showCustomer }: { tickets: TicketSummaryDto[]; showCustomer: boolean }) {
  return (
    <tbody className="divide-y divide-slate-100">
      {tickets.map((t) => (
        <tr key={t.id} className="group hover:bg-slate-50">
          <td className="px-4 py-3 text-xs font-medium text-slate-400">{t.ticketNumber}</td>
          <td className="px-4 py-3">
            <Link
              to={`/tickets/${t.id}`}
              className="font-medium text-slate-900 group-hover:text-brand-600"
            >
              {t.subject}
            </Link>
            {t.slaBreached && (
              <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-700">
                SLA
              </span>
            )}
          </td>
          {showCustomer && (
            <td className="px-4 py-3 text-slate-600">
              <Avatar name={t.customer.name} />
              {t.customer.name}
            </td>
          )}
          <td className="px-4 py-3">
            {t.assignee ? (
              <>
                <Avatar name={t.assignee.name} />
                <span className="text-slate-600">{t.assignee.name}</span>
              </>
            ) : (
              <span className="text-slate-400">Unassigned</span>
            )}
          </td>
          <td className="px-4 py-3"><StatusBadge status={t.status} /></td>
          <td className="px-4 py-3"><PriorityBadge priority={t.priority} /></td>
          <td className="px-4 py-3 text-slate-400">
            <span className="inline-flex items-center gap-1 text-xs">
              <MessageSquare className="h-3.5 w-3.5" />
              {t.commentCount}
            </span>
          </td>
          <td className="px-4 py-3 text-slate-500">{new Date(t.updatedAt).toLocaleDateString()}</td>
        </tr>
      ))}
    </tbody>
  );
}

function Header({ showCustomer }: { showCustomer: boolean }) {
  return (
    <thead>
      <tr className="text-left text-[11px] uppercase tracking-wider text-slate-400">
        <th className="px-4 py-3 font-medium">Request #</th>
        <th className="px-4 py-3 font-medium">Topic</th>
        {showCustomer && <th className="px-4 py-3 font-medium">Customer</th>}
        <th className="px-4 py-3 font-medium">Assigned to</th>
        <th className="px-4 py-3 font-medium">Status</th>
        <th className="px-4 py-3 font-medium">Priority</th>
        <th className="px-4 py-3 font-medium"></th>
        <th className="px-4 py-3 font-medium">Date</th>
      </tr>
    </thead>
  );
}

/**
 * Flat table, or grouped sections ("New" = unassigned OPEN first, then the
 * rest) matching the reference board layout when `grouped` is set.
 */
export function TicketTable({
  tickets,
  showCustomer = true,
  grouped = false,
}: {
  tickets: TicketSummaryDto[];
  showCustomer?: boolean;
  grouped?: boolean;
}) {
  if (!grouped) {
    return (
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <Header showCustomer={showCustomer} />
          <Rows tickets={tickets} showCustomer={showCustomer} />
        </table>
      </div>
    );
  }

  const fresh = tickets.filter((t) => !t.assignee && t.status === 'OPEN');
  const active = tickets.filter((t) => !(!t.assignee && t.status === 'OPEN'));

  const section = (title: string, rows: TicketSummaryDto[]) =>
    rows.length > 0 && (
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <h3 className="px-4 pt-4 text-sm font-semibold text-slate-800">
          {title} <span className="ml-1 text-slate-400">({rows.length})</span>
        </h3>
        <table className="mt-1 w-full text-sm">
          <Header showCustomer={showCustomer} />
          <Rows tickets={rows} showCustomer={showCustomer} />
        </table>
      </div>
    );

  return (
    <div className="space-y-6">
      {section('Assigned, in progress', active)}
      {section('New', fresh)}
    </div>
  );
}
