import { Navigate } from 'react-router'
import { useAuth } from './AuthContext'
import {
  hasPermission,
  isAdminUser,
} from './authHelpers'

export default function RequirePermission({
  permissions = [],
  children,
  requireAll = false,
  adminBypass = true,
}) {
  const { user, isAuthenticated, loadingSession } = useAuth()

  if (loadingSession) {
    return <div className="container py-4">Cargando permisos...</div>
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  const isAllowed =
    (adminBypass && isAdminUser(user)) ||
    hasPermission(user, permissions, { requireAll })

  if (!isAllowed) {
    return <Navigate to="/unauthorized" replace />
  }

  return children
}
