import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppLayout } from '../components/AppLayout';
import { ProtectedRoute, RoleGuard } from '../components/guards';
import { LandingPage } from '../pages/LandingPage';
import { LoginPage } from '../pages/LoginPage';
import { RegisterPage } from '../pages/RegisterPage';
import { NotFoundPage } from '../pages/NotFoundPage';
import { DashboardPage } from '../pages/DashboardPage';
import { NotificationsPage } from '../pages/NotificationsPage';
import { ProfilePage } from '../pages/ProfilePage';
import { TicketListPage } from '../features/tickets/TicketListPage';
import { TicketDetailPage } from '../features/tickets/TicketDetailPage';
import { NewTicketPage } from '../features/tickets/NewTicketPage';
import { UsersPage } from '../pages/admin/UsersPage';
import { CategoriesPage } from '../pages/admin/CategoriesPage';
import { AuditLogPage } from '../pages/admin/AuditLogPage';
import { AnalyticsPage } from '../pages/admin/AnalyticsPage';

/**
 * Route tree. Guards are UX-only — the backend authorizes every operation.
 * - /tickets → CUSTOMER sees own; ADMIN sees all (service-layer scoping)
 * - /queue, /assigned → AGENT (+ ADMIN for queue)
 * - /admin/* → ADMIN only
 */
export const router = createBrowserRouter([
  { path: '/', element: <LandingPage /> },
  { path: '/login', element: <LoginPage /> },
  { path: '/register', element: <RegisterPage /> },
  {
    element: (
      <ProtectedRoute>
        <AppLayout />
      </ProtectedRoute>
    ),
    children: [
      { path: '/dashboard', element: <DashboardPage /> },
      { path: '/notifications', element: <NotificationsPage /> },
      { path: '/profile', element: <ProfilePage /> },
      { path: '/tickets', element: <TicketListPage scope="mine" /> },
      { path: '/tickets/new', element: <NewTicketPage /> },
      { path: '/tickets/:id', element: <TicketDetailPage /> },
      {
        path: '/queue',
        element: (
          <RoleGuard roles={['AGENT', 'ADMIN']}>
            <TicketListPage scope="queue" />
          </RoleGuard>
        ),
      },
      {
        path: '/assigned',
        element: (
          <RoleGuard roles={['AGENT']}>
            <TicketListPage scope="mine" />
          </RoleGuard>
        ),
      },
      {
        path: '/admin/users',
        element: (
          <RoleGuard roles={['ADMIN']}>
            <UsersPage />
          </RoleGuard>
        ),
      },
      {
        path: '/admin/categories',
        element: (
          <RoleGuard roles={['ADMIN']}>
            <CategoriesPage />
          </RoleGuard>
        ),
      },
      {
        path: '/admin/analytics',
        element: (
          <RoleGuard roles={['ADMIN']}>
            <AnalyticsPage />
          </RoleGuard>
        ),
      },
      {
        path: '/admin/audit',
        element: (
          <RoleGuard roles={['ADMIN']}>
            <AuditLogPage />
          </RoleGuard>
        ),
      },
    ],
  },
  { path: '*', element: <NotFoundPage /> },
]);
