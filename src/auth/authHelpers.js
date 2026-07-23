function normalizeValue(value) {
  return String(value ?? '')
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function extractRoleValue(role) {
  if (!role) return ''

  if (typeof role === 'string') {
    return role
  }

  return (
    role.code ||
    role.name ||
    role.roleCode ||
    role.roleName ||
    role.role?.code ||
    role.role?.name ||
    ''
  )
}

export function getRoleNames(user) {
  const possibleRoles = [
    ...(Array.isArray(user?.roles) ? user.roles : []),
    ...(Array.isArray(user?.roleCodes) ? user.roleCodes : []),
    ...(Array.isArray(user?.userRoles) ? user.userRoles : []),
  ]

  if (user?.role) possibleRoles.push(user.role)
  if (user?.roleCode) possibleRoles.push(user.roleCode)
  if (user?.roleName) possibleRoles.push(user.roleName)

  return [
    ...new Set(
      possibleRoles
        .map(extractRoleValue)
        .map(normalizeValue)
        .filter(Boolean),
    ),
  ]
}

export function getPermissionCodes(user) {
  const possiblePermissions = [
    ...(Array.isArray(user?.permissions)
      ? user.permissions
      : []),
    ...(Array.isArray(user?.permissionCodes)
      ? user.permissionCodes
      : []),
  ]

  return [
    ...new Set(
      possiblePermissions
        .map((permission) => {
          if (typeof permission === 'string') {
            return normalizeValue(permission)
          }

          return normalizeValue(
            permission?.code ||
              permission?.name ||
              permission?.permission?.code ||
              permission?.permission?.name,
          )
        })
        .filter(Boolean),
    ),
  ]
}

export function hasRole(user, allowedRoles = []) {
  if (!Array.isArray(allowedRoles) || allowedRoles.length === 0) {
    return true
  }

  const currentRoles = new Set(getRoleNames(user))

  return allowedRoles.some((allowedRole) =>
    currentRoles.has(normalizeValue(allowedRole)),
  )
}

export function hasPermission(user, requiredPermissions = []) {
  if (
    !Array.isArray(requiredPermissions) ||
    requiredPermissions.length === 0
  ) {
    return true
  }

  const currentPermissions = new Set(
    getPermissionCodes(user),
  )

  return requiredPermissions.some((permission) =>
    currentPermissions.has(normalizeValue(permission)),
  )
}

export function isAdminUser(user) {
  return hasRole(user, [
    'ADMIN',
    'ADMINISTRADOR',
    'ADMINISTRATOR',
  ])
}

export function isCashierUser(user) {
  return hasRole(user, [
    'CAJA',
    'CAJERO',
    'CAJERA',
    'CASHIER',
  ])
}

export function isKitchenUser(user) {
  return hasRole(user, [
    'COCINA',
    'COCINERO',
    'COCINERA',
    'KITCHEN',
  ])
}

export function isWaiterUser(user) {
  return hasRole(user, [
    'MESERO',
    'MESERA',
    'WAITER',
    'SERVER',
  ])
}

export function getDefaultRouteForUser(user) {
  if (isAdminUser(user)) {
    return '/dashboard'
  }

  if (isCashierUser(user)) {
    return '/billing'
  }

  if (isKitchenUser(user)) {
    return '/kitchen'
  }

  if (isWaiterUser(user)) {
    return '/orders'
  }

  return '/unauthorized'
}
