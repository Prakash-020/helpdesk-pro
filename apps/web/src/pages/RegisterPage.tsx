import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate } from 'react-router-dom';
import { Headset } from 'lucide-react';
import { registerSchema, type RegisterInput } from '@helpdesk/shared';
import { useAuth } from '../features/auth/use-auth';
import { Field, inputCls } from '../components/ui';
import { ApiRequestError } from '../lib/api';

export function RegisterPage() {
  const { register: signup } = useAuth();
  const navigate = useNavigate();

  const {
    register: field,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<RegisterInput>({ resolver: zodResolver(registerSchema) });

  async function onSubmit(input: RegisterInput) {
    try {
      await signup.mutateAsync(input);
      navigate('/dashboard', { replace: true });
    } catch (e) {
      const message =
        e instanceof ApiRequestError && e.code === 'CONFLICT'
          ? 'An account with this email already exists'
          : e instanceof Error
            ? e.message
            : 'Registration failed';
      setError('root', { message });
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="flex items-center gap-2 font-semibold text-slate-900">
          <Headset className="h-6 w-6 text-brand-600" />
          HelpDesk Pro
        </div>
        <h1 className="mt-6 text-xl font-bold text-slate-900">Create your account</h1>

        <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4">
          <Field label="Name" error={errors.name?.message}>
            <input autoComplete="name" className={inputCls} {...field('name')} />
          </Field>
          <Field label="Email" error={errors.email?.message}>
            <input type="email" autoComplete="email" className={inputCls} {...field('email')} />
          </Field>
          <Field label="Password" error={errors.password?.message}>
            <input
              type="password"
              autoComplete="new-password"
              className={inputCls}
              {...field('password')}
            />
          </Field>
          {errors.root && <p className="text-sm text-red-600">{errors.root.message}</p>}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
          >
            {isSubmitting ? 'Creating…' : 'Create account'}
          </button>
        </form>

        <p className="mt-5 text-center text-sm text-slate-500">
          Have an account?{' '}
          <Link to="/login" className="font-medium text-brand-600 hover:underline">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}
