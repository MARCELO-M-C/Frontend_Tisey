import { Navigate } from 'react-router'
import { useAuth } from './AuthContext'

export default function ProtectedRoute({ children }) {
  const { isAuthenticated, loadingSession } = useAuth()

  if (loadingSession) {
    return (
      <div className="container py-4">
        Cargando sesión...
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  return children
}