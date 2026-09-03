import { Navigate } from 'react-router-dom';
import { useAuth, UserRole } from '../hooks/useAuth';

/**
 * Client-side gate — redirects to /login if not authenticated, or to
 * the user's own landing route if they're authenticated but trying to
 * view a console that isn't theirs. This is UX only: the real
 * enforcement is server-side (require_role() on every backend route).
 * Never rely on this component alone to protect anything sensitive.
 */
export function ProtectedRoute({
  allowedRoles,
  children,
}: {
  allowedRoles: UserRole[];
  children: React.ReactNode;
}) {
  const { user, isAuthenticated } = useAuth();

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }
  if (!allowedRoles.includes(user.role)) {
    return <Navigate to={user.landing_route} replace />;
  }
  return <>{children}</>;
}
