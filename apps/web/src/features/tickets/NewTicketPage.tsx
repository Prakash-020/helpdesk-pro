import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  createTicketSchema,
  PRIORITIES,
  PRIORITY_LABELS,
  type CategoryDto,
  type CreateTicketInput,
  type TicketDto,
} from '@helpdesk/shared';
import { api } from '../../lib/api';
import { Field, inputCls, PageHeader, toast } from '../../components/ui';

export function NewTicketPage() {
  const navigate = useNavigate();
  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: () => api.get<CategoryDto[]>('/api/v1/categories'),
  });

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<CreateTicketInput>({
    resolver: zodResolver(createTicketSchema),
    defaultValues: { priority: 'MEDIUM' },
  });

  async function onSubmit(input: CreateTicketInput) {
    try {
      const ticket = await api.post<TicketDto>('/api/v1/tickets', input);
      toast(`Ticket ${ticket.ticketNumber} created`);
      navigate(`/tickets/${ticket.id}`);
    } catch (e) {
      setError('root', { message: e instanceof Error ? e.message : 'Could not create ticket' });
    }
  }

  return (
    <div className="max-w-2xl">
      <PageHeader title="New ticket" />
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        <Field label="Subject" error={errors.subject?.message}>
          <input
            className={inputCls}
            placeholder="Brief summary of the problem"
            {...register('subject')}
          />
        </Field>

        <Field label="Category" error={errors.categoryId?.message}>
          <select className={inputCls} {...register('categoryId')}>
            <option value="">Select a category…</option>
            {categories?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Priority" error={errors.priority?.message}>
          <select className={inputCls} {...register('priority')}>
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {PRIORITY_LABELS[p]}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Description" error={errors.description?.message}>
          <textarea
            rows={6}
            className={inputCls}
            placeholder="What happened? Steps to reproduce, error messages, when it started…"
            {...register('description')}
          />
        </Field>

        {errors.root && <p className="text-sm text-red-600">{errors.root.message}</p>}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-lg bg-brand-600 px-5 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
          >
            {isSubmitting ? 'Submitting…' : 'Submit ticket'}
          </button>
        </div>
      </form>
    </div>
  );
}
