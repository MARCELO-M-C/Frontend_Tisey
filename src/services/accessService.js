import api from '../api/axios'

export async function getUsersRequest(params = {}) {
  const { data } = await api.get('/users', { params })
  return data
}

export async function getUserByIdRequest(userId) {
  const { data } = await api.get(`/users/${userId}`)
  return data
}

export async function createUserRequest(payload) {
  const { data } = await api.post('/users', payload)
  return data
}

export async function updateUserRequest(userId, payload) {
  const { data } = await api.patch(`/users/${userId}`, payload)
  return data
}

export async function updateUserStatusRequest(userId, isActive) {
  const { data } = await api.patch(`/users/${userId}/status`, { isActive })
  return data
}

export async function replaceUserRolesRequest(userId, roleIds) {
  const { data } = await api.put(`/users/${userId}/roles`, { roleIds })
  return data
}

export async function replaceUserPermissionsRequest(userId, permissionIds) {
  const { data } = await api.put(`/users/${userId}/permissions`, {
    permissionIds,
  })
  return data
}

export async function getRolesRequest(params = {}) {
  const { data } = await api.get('/roles', { params })
  return data
}

export async function getRoleByIdRequest(roleId) {
  const { data } = await api.get(`/roles/${roleId}`)
  return data
}

export async function getPermissionsRequest() {
  const { data } = await api.get('/roles/permissions')
  return data
}
