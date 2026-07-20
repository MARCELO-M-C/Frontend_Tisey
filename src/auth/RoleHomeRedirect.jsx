import { Navigate } from 'react-router'
import { useAuth } from './AuthContext'
import { getDefaultRouteForUser } from './authHelpers'

export default function RoleHomeRedirect() {
  const { user, isAuthenticated, loadingSession } = useAuth()

  if (loadingSession) {
    return <div className="container py-4">Cargando sesión...</div>
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  return <Navigate to={getDefaultRouteForUser(user)} replace />
}