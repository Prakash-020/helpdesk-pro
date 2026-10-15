import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import {
  ROLES,
  ROLE_LABELS,
  type Paginated,
  type Role,
  type UserDto,
} from '@helpdesk/shared';
import { api, ApiRequestError } from '../../lib/api';
import {
  EmptyState,
  inputCls,
  LoadingState,
  PageHeader,
  Pagination,
  toast,
} from '../../components/ui';
import { useAuth } from '../../features/auth/use-auth';

const filterCls = inputCls.replace('w-full', '');

export function UsersPage() {
  const { user: me } = useAuth();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [roleFilter, setRoleFilter] = useState('');
  const [search, setSearch] = useState('');

  const query = useQuery({
    queryKey: ['users', 'admin', page, roleFilter, search],
    queryFn: () => {
      const sp = new URLSearchParams({ page: String(page), pageSize: '15' });
      if (roleFilter) sp.set('role', roleFilter);
      if (search) sp.set('search', search);
      return api.get<Paginated<UserDto>>(`/api/v1/users?${sp}`);
    },
    placeholderData: (p) => p,
  });

  const patch = useMutation({
    mutationFn: ({ id, path, body }: { id: string; path: 'role' | 'status'; body: unknown }) =>
      api.patch<UserDto>(`/api/v1/users/${id}/${path}`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast('User updated');
    },
    onError: (e) => toast(e instanceof ApiRequestError ? e.message : 'Update failed'),
  });

  return (
    <div>
      <PageHeader title="User management" />
      <div className="mb-4 flex gap-2">
        <input
          placeholder="Search name or email…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className={`${filterCls} w-64`}
        />
        <select
          value={roleFilter}
          onChange={(e) => {
            setRoleFilter(e.target.value);
            setPage(1);
          }}
          className={`${filterCls} w-40`}
        >
          <option value="">All roles</option>
          {ROLES.map((r) => (
            <option key={r} value={r}>{ROLE_LABELS[r]}</option>
          ))}
        </select>
      </div>

      {query.isPending && <LoadingState />}
      {query.data?.data.length === 0 && <EmptyState title="No users found" />}
      {query.data && query.data.data.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {query.data.data.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-900">{u.name}</td>
                  <td className="px-4 py-3 text-slate-600">{u.email}</td>
                  <td className="px-4 py-3">
                    <select
                      value={u.role}
                      disabled={u.id === me!.id || patch.isPending}
                      onChange={(e) => patch.mutate({ id: u.id, path: 'role', body: { role: e.target.value as Role } })}
                      className="rounded-lg border border-slate-300 px-2 py-1 text-xs font-medium disabled:opacity-50"
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      disabled={u.id === me!.id || patch.isPending}
                      onClick={() =>
                        patch.mutate({
                          id: u.id,
                          path: 'status',
                          body: { accountStatus: u.accountStatus === 'ACTIVE' ? 'DISABLED' : 'ACTIVE' },
                        })
                      }
                      className={`rounded-full px-2.5 py-0.5 text-xs font-medium disabled:opacity-50 ${
                        u.accountStatus === 'ACTIVE'
                          ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                          : 'bg-red-100 text-red-700 hover:bg-red-200'
                      }`}
                    >
                      {u.accountStatus === 'ACTIVE' ? 'Active' : 'Disabled'}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-slate-500">{new Date(u.createdAt).toLocaleDateString()}</td>
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
