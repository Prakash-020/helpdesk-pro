import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Headset } from 'lucide-react';
import { loginSchema, type LoginInput } from '@helpdesk/shared';
import { useAuth } from '../features/auth/use-auth';
import { Field, inputCls } from '../components/ui';

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? '/dashboard';

  const {
    register: field,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

  async function onSubmit(input: LoginInput) {
    try {
      await login.mutateAsync(input);
      navigate(from, { replace: true });
    } catch (e) {
      setError('root', { message: e instanceof Error ? e.message : 'Login failed' });
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="flex items-center gap-2 font-semibold text-slate-900">
          <Headset className="h-6 w-6 text-brand-600" />
          HelpDesk Pro
        </div>
        <h1 className="mt-6 text-xl font-bold text-slate-900">Log in</h1>

        <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4">
          <Field label="Email" error={errors.email?.message}>
            <input type="email" autoComplete="email" className={inputCls} {...field('email')} />
          </Field>
          <Field label="Password" error={errors.password?.message}>
            <input
              type="password"
              autoComplete="current-password"
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
            {isSubmitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className="mt-5 text-center text-sm text-slate-500">
          No account?{' '}
          <Link to="/register" className="font-medium text-brand-600 hover:underline">
            Register
          </Link>
        </p>

        {/* One-click demo roles */}
        <div className="mt-6 border-t border-slate-100 pt-5">
          <p className="mb-2 text-center text-xs font-medium text-slate-500">
            One-click demo (password: Demo!Passw0rd)
          </p>
          <div className="grid grid-cols-3 gap-2">
            {(
              [
                ['Customer', 'customer@helpdesk.dev'],
                ['Agent', 'agent@helpdesk.dev'],
                ['Admin', 'admin@helpdesk.dev'],
              ] as const
            ).map(([label, email]) => (
              <button
                key={email}
                type="button"
                disabled={isSubmitting || login.isPending}
                onClick={async () => {
                  try {
                    await login.mutateAsync({ email, password: 'Demo!Passw0rd' });
                    navigate('/dashboard', { replace: true });
                  } catch (e) {
                    setError('root', { message: e instanceof Error ? e.message : 'Demo login failed' });
                  }
                }}
                className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
