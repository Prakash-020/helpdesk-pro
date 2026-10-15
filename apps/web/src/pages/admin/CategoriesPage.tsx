import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import type { CategoryDto, SlaTargetDto } from '@helpdesk/shared';
import { PRIORITY_LABELS } from '@helpdesk/shared';
import { api, ApiRequestError } from '../../lib/api';
import { ConfirmDialog, inputCls, LoadingState, PageHeader, toast } from '../../components/ui';

/** Per-priority SLA targets — editable by admin. */
function SlaTargetsCard() {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ['sla-targets'],
    queryFn: () => api.get<SlaTargetDto[]>('/api/v1/sla-targets'),
  });
  const [edit, setEdit] = useState<Record<string, { fr: string; res: string }>>({});

  const save = useMutation({
    mutationFn: (t: SlaTargetDto & { fr: string; res: string }) =>
      api.patch(`/api/v1/sla-targets/${t.priority}`, {
        firstResponseMinutes: Number(t.fr),
        resolutionMinutes: Number(t.res),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sla-targets'] });
      toast('SLA target updated — applies to new tickets');
    },
    onError: (e) => toast(e instanceof ApiRequestError ? e.message : 'Update failed'),
  });

  const fmt = (mins: number) => (mins >= 60 ? `${(mins / 60).toFixed(mins % 60 ? 1 : 0)}h` : `${mins}m`);

  return (
    <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="font-semibold text-slate-900">SLA targets</h2>
      <p className="mt-1 text-sm text-slate-500">
        Response &amp; resolution deadlines per priority (minutes). Applies to newly created tickets.
      </p>
      {query.isPending && <LoadingState />}
      <div className="mt-4 space-y-3">
        {query.data?.map((t) => {
          const e = edit[t.priority] ?? { fr: String(t.firstResponseMinutes), res: String(t.resolutionMinutes) };
          const dirty =
            Number(e.fr) !== t.firstResponseMinutes || Number(e.res) !== t.resolutionMinutes;
          return (
            <div key={t.priority} className="flex flex-wrap items-center gap-3 text-sm">
              <span className="w-20 font-medium text-slate-800">{PRIORITY_LABELS[t.priority]}</span>
              <label className="flex items-center gap-2 text-slate-500">
                Response
                <input
                  type="number"
                  min={1}
                  value={e.fr}
                  onChange={(ev) => setEdit({ ...edit, [t.priority]: { ...e, fr: ev.target.value } })}
                  className={`${inputCls} w-24`}
                />
                <span className="text-xs text-slate-400">({fmt(t.firstResponseMinutes)})</span>
              </label>
              <label className="flex items-center gap-2 text-slate-500">
                Resolution
                <input
                  type="number"
                  min={1}
                  value={e.res}
                  onChange={(ev) => setEdit({ ...edit, [t.priority]: { ...e, res: ev.target.value } })}
                  className={`${inputCls} w-24`}
                />
                <span className="text-xs text-slate-400">({fmt(t.resolutionMinutes)})</span>
              </label>
              {dirty && (
                <button
                  onClick={() => save.mutate({ ...t, ...e })}
                  disabled={save.isPending}
                  className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-50"
                >
                  Save
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function CategoriesPage() {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<CategoryDto | null>(null);

  const query = useQuery({
    queryKey: ['categories', 'admin'],
    queryFn: () => api.get<CategoryDto[]>('/api/v1/categories'),
  });

  const create = useMutation({
    mutationFn: () => api.post('/api/v1/categories', { name, description: description || null }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      setName('');
      setDescription('');
      toast('Category created');
    },
    onError: (e) => toast(e instanceof ApiRequestError ? e.message : 'Create failed'),
  });

  const toggle = useMutation({
    mutationFn: (c: CategoryDto) => api.patch(`/api/v1/categories/${c.id}`, { isActive: !c.isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      toast('Category updated');
    },
    onError: (e) => toast(e instanceof ApiRequestError ? e.message : 'Update failed'),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/api/v1/categories/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      setConfirmDelete(null);
      toast('Category deleted');
    },
    onError: (e) => {
      setConfirmDelete(null);
      toast(e instanceof ApiRequestError ? e.message : 'Delete failed');
    },
  });

  return (
    <div className="max-w-3xl">
      <PageHeader title="Categories" />

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) create.mutate();
        }}
        className="mb-6 flex gap-2 rounded-xl border border-slate-200 bg-white p-4"
      >
        <input
          placeholder="New category name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={`${inputCls} w-52`}
        />
        <input
          placeholder="Description (optional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className={`${inputCls} flex-1`}
        />
        <button
          type="submit"
          disabled={create.isPending || !name.trim()}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
        >
          Add
        </button>
      </form>

      {query.isPending && <LoadingState />}
      <div className="space-y-2">
        {query.data?.map((c) => (
          <div
            key={c.id}
            className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3"
          >
            <div>
              <p className="font-medium text-slate-900">
                {c.name}
                {!c.isActive && (
                  <span className="ml-2 rounded-full bg-slate-200 px-2 py-0.5 text-xs text-slate-500">
                    inactive
                  </span>
                )}
              </p>
              <p className="text-sm text-slate-500">
                {c.description ?? '—'}
                {c.ticketCount !== undefined && (
                  <span className="ml-2 text-slate-400">· {c.ticketCount} tickets</span>
                )}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => toggle.mutate(c)}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                {c.isActive ? 'Deactivate' : 'Activate'}
              </button>
              <button
                onClick={() => setConfirmDelete(c)}
                className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      <SlaTargetsCard />

      <ConfirmDialog
        open={confirmDelete !== null}
        title={`Delete "${confirmDelete?.name}"?`}
        body="Categories referenced by tickets cannot be deleted — the server will reject it; deactivate instead."
        confirmLabel="Delete"
        danger
        onConfirm={() => confirmDelete && remove.mutate(confirmDelete.id)}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
}
