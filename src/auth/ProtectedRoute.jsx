import { Navigate } from 'react-router'
import { useAuth } from './AuthContext'
import {
  hasPermission,
  hasRole,
  isAdminUser,
} from './authHelpers'

export default function ProtectedRoute({
  children,
  allowedRoles = [],
  requiredPermissions = [],
  accessMode = 'all',
  requireAllPermissions = false,
  adminBypass = true,
}) {
  const { user, isAuthenticated, loadingSession } = useAuth()

  if (loadingSession) {
    return <div className="container py-4">Cargando sesión...</div>
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  const hasRoleRule = allowedRoles.length > 0
  const hasPermissionRule = requiredPermissions.length > 0
  const roleAllowed = !hasRoleRule || hasRole(user, allowedRoles)
  const permissionAllowed =
    !hasPermissionRule ||
    (adminBypass && isAdminUser(user)) ||
    hasPermission(user, requiredPermissions, {
      requireAll: requireAllPermissions,
    })

  let isAllowed = true

  if (hasRoleRule && hasPermissionRule) {
    isAllowed =
      accessMode === 'any'
        ? roleAllowed || permissionAllowed
        : roleAllowed && permissionAllowed
  } else if (hasRoleRule) {
    isAllowed = roleAllowed
  } else if (hasPermissionRule) {
    isAllowed = permissionAllowed
  }

  if (!isAllowed) {
    return <Navigate to="/unauthorized" replace />
  }

  return children
}
