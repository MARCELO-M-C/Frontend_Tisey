import { Navigate } from 'react-router'
import { useAuth } from './AuthContext'
import { hasPermission } from './authHelpers'

export default function RequirePermission({ permissions, children }) {
  const { user, isAuthenticated, loadingSession } = useAuth()

  if (loadingSession) {
    return (
      <div className="container py-4">
        Cargando permisos...
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  if (!hasPermission(user, permissions)) {
    return <Navigate to="/unauthorized" replace />
  }

  return children
}