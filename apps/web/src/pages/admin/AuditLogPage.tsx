import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { AUDIT_ACTIONS, ENTITY_TYPES, type AuditLogDto, type Paginated } from '@helpdesk/shared';
import { api } from '../../lib/api';
import { inputCls, LoadingState, PageHeader, Pagination } from '../../components/ui';

const filterCls = inputCls.replace('w-full', '');

export function AuditLogPage() {
  const [page, setPage] = useState(1);
  const [action, setAction] = useState('');
  const [entityType, setEntityType] = useState('');

  const query = useQuery({
    queryKey: ['audit', page, action, entityType],
    queryFn: () => {
      const sp = new URLSearchParams({ page: String(page), pageSize: '25' });
      if (action) sp.set('action', action);
      if (entityType) sp.set('entityType', entityType);
      return api.get<Paginated<AuditLogDto>>(`/api/v1/audit-logs?${sp}`);
    },
    placeholderData: (p) => p,
  });

  return (
    <div>
      <PageHeader title="Audit log" />
      <div className="mb-4 flex gap-2">
        <select value={action} onChange={(e) => { setAction(e.target.value); setPage(1); }} className={`${filterCls} w-56`}>
          <option value="">All actions</option>
          {AUDIT_ACTIONS.map((a) => (
            <option key={a} value={a}>{a.replaceAll('_', ' ')}</option>
          ))}
        </select>
        <select value={entityType} onChange={(e) => { setEntityType(e.target.value); setPage(1); }} className={`${filterCls} w-44`}>
          <option value="">All entities</option>
          {ENTITY_TYPES.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </div>

      {query.isPending && <LoadingState />}
      {query.data && (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                <th className="px-4 py-3 font-medium">When</th>
                <th className="px-4 py-3 font-medium">Actor</th>
                <th className="px-4 py-3 font-medium">Action</th>
                <th className="px-4 py-3 font-medium">Entity</th>
                <th className="px-4 py-3 font-medium">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {query.data.data.map((l) => (
                <tr key={l.id}>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-500">
                    {new Date(l.createdAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-slate-700">{l.actor?.name ?? 'system'}</td>
                  <td className="px-4 py-3">
                    <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                      {l.action}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{l.entityType}</td>
                  <td className="max-w-xs truncate px-4 py-3 text-xs text-slate-500">
                    {l.metadata ? JSON.stringify(l.metadata) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {query.data && (
        <Pagination page={query.data.page} pageSize={query.data.pageSize} total={query.data.total} onPage={setPage} />
      )}
    </div>
  );
}
