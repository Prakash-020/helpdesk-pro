import { Link } from 'react-router-dom';
import type { TicketSummaryDto } from '@helpdesk/shared';
import { PriorityBadge, StatusBadge } from '../../components/ui';

export function TicketTable({
  tickets,
  showCustomer = true,
}: {
  tickets: TicketSummaryDto[];
  showCustomer?: boolean;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
            <th className="px-4 py-3 font-medium">Ticket</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 font-medium">Priority</th>
            {showCustomer && <th className="px-4 py-3 font-medium">Customer</th>}
            <th className="px-4 py-3 font-medium">Assignee</th>
            <th className="px-4 py-3 font-medium">Category</th>
            <th className="px-4 py-3 font-medium">Updated</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {tickets.map((t) => (
            <tr key={t.id} className="hover:bg-slate-50">
              <td className="px-4 py-3">
                <Link to={`/tickets/${t.id}`} className="font-medium text-slate-900 hover:text-brand-600">
                  {t.subject}
                </Link>
                <span className="mt-0.5 block text-xs text-slate-400">
                  {t.ticketNumber}
                  {t.slaBreached && <span className="ml-2 font-semibold text-red-600">SLA breached</span>}
                </span>
              </td>
              <td className="px-4 py-3"><StatusBadge status={t.status} /></td>
              <td className="px-4 py-3"><PriorityBadge priority={t.priority} /></td>
              {showCustomer && <td className="px-4 py-3 text-slate-600">{t.customer.name}</td>}
              <td className="px-4 py-3 text-slate-600">{t.assignee?.name ?? <span className="text-slate-400">Unassigned</span>}</td>
              <td className="px-4 py-3 text-slate-600">{t.category?.name ?? '—'}</td>
              <td className="px-4 py-3 text-slate-500">{new Date(t.updatedAt).toLocaleDateString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
