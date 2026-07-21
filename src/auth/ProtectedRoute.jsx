import { Navigate } from 'react-router'
import { useAuth } from './AuthContext'
import { hasRole } from './authHelpers'

export default function ProtectedRoute({
  children,
  allowedRoles = [],
}) {
  const { user, isAuthenticated, loadingSession } = useAuth()

  console.log('Usuario:', user)
  console.log('Roles permitidos:', allowedRoles)

  if (loadingSession) {
    return <div className="container py-4">Cargando sesión...</div>
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  if (allowedRoles.length > 0 && !hasRole(user, allowedRoles)) {
    return <Navigate to="/unauthorized" replace />
  }

  return children
}
