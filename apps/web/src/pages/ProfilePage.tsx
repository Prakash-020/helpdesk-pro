import { useForm } from 'react-hook-form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { UserDto } from '@helpdesk/shared';
import { api, ApiRequestError } from '../lib/api';
import { useAuth } from '../features/auth/use-auth';
import { Field, inputCls, PageHeader, toast } from '../components/ui';

export function ProfilePage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<{ name: string }>({
    defaultValues: { name: user!.name },
  });

  const save = useMutation({
    mutationFn: (input: { name: string }) =>
      api.patch<UserDto>(`/api/v1/users/${user!.id}`, input),
    onSuccess: (u) => {
      queryClient.setQueryData(['auth', 'me'], u);
      toast('Profile updated');
    },
    onError: (e) => toast(e instanceof ApiRequestError ? e.message : 'Update failed'),
  });

  return (
    <div className="max-w-lg">
      <PageHeader title="Profile settings" />
      <form
        onSubmit={handleSubmit((v) => save.mutate(v))}
        className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        <Field label="Name" error={errors.name?.message}>
          <input className={inputCls} {...register('name', { required: 'Name is required', minLength: 2 })} />
        </Field>
        <Field label="Email">
          <input value={user!.email} disabled className={`${inputCls} bg-slate-50 text-slate-500`} />
        </Field>
        <Field label="Role">
          <input value={user!.role} disabled className={`${inputCls} bg-slate-50 text-slate-500`} />
        </Field>
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isSubmitting || save.isPending}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
          >
            Save changes
          </button>
        </div>
      </form>
    </div>
  );
}
