export function getRoleNames(user) {
  return user?.roles?.map((role) => role.name) ?? []
}

export function getPermissionCodes(user) {
  return user?.permissions?.map((permission) => permission.code) ?? []
}

export function hasRole(user, allowedRoles = []) {
  const roleNames = getRoleNames(user)
  return allowedRoles.some((role) => roleNames.includes(role))
}

export function hasPermission(user, requiredPermissions = []) {
  const permissionCodes = getPermissionCodes(user)
  return requiredPermissions.some((permission) =>
    permissionCodes.includes(permission)
  )
}