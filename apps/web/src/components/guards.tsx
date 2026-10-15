import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import type { Role } from '@helpdesk/shared';
import { useAuth } from '../features/auth/use-auth';
import { LoadingState } from './ui';

/** Requires an authenticated user; preserves the attempted URL for redirect-back. */
export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, isPending } = useAuth();
  const location = useLocation();

  if (isPending) return <LoadingState label="Restoring session…" />;
  if (!user) return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  return <>{children}</>;
}

/** Role gate. Backend still enforces everything — this is UX-only routing. */
export function RoleGuard({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const { user } = useAuth();
  if (!user) return <LoadingState />;
  if (!roles.includes(user.role)) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}
