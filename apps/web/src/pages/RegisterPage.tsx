import { Link } from 'react-router-dom';
import { Headset } from 'lucide-react';

/** Placeholder — the real RHF+Zod form lands in the auth phase. */
export function RegisterPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="flex items-center gap-2 font-semibold text-slate-900">
          <Headset className="h-6 w-6 text-brand-600" />
          HelpDesk Pro
        </div>
        <h1 className="mt-6 text-xl font-bold text-slate-900">Create your account</h1>
        <p className="mt-2 text-sm text-slate-600">
          Registration is implemented in a later phase — this page is a placeholder.
        </p>
        <Link to="/" className="mt-6 inline-block text-sm font-medium text-brand-600 hover:underline">
          ← Back to home
        </Link>
      </div>
    </div>
  );
}
