function normalizeRoleName(value) {
  return String(value ?? '')
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

export function getRoleNames(user) {
  return (user?.roles ?? [])
    .map((role) =>
      normalizeRoleName(
        typeof role === 'string'
          ? role
          : role?.name ?? role?.code ?? role?.role?.name ?? role?.role?.code,
      ),
    )
    .filter(Boolean)
}

export function getPermissionCodes(user) {
  return (user?.permissions ?? [])
    .map((permission) =>
      String(
        typeof permission === 'string'
          ? permission
          : permission?.code ?? permission?.name ?? '',
      )
        .trim()
        .toUpperCase(),
    )
    .filter(Boolean)
}

export function hasRole(user, allowedRoles = []) {
  const roleNames = new Set(getRoleNames(user))

  return allowedRoles.some((role) =>
    roleNames.has(normalizeRoleName(role)),
  )
}

export function hasPermission(user, requiredPermissions = []) {
  const permissionCodes = new Set(getPermissionCodes(user))

  return requiredPermissions.some((permission) =>
    permissionCodes.has(String(permission).trim().toUpperCase()),
  )
}

export function getDefaultRouteForUser(user) {
  if (hasRole(user, ['ADMIN', 'ADMINISTRADOR'])) {
    return '/dashboard'
  }

  if (hasRole(user, ['CAJA', 'CASHIER'])) {
    return '/billing'
  }

  return '/dashboard'
}
