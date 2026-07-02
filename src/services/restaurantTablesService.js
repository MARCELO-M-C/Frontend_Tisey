import api from '../api/axios'

export async function getRestaurantTablesRequest(params = {}) {
  const { data } = await api.get('/restaurant-tables', { params })
  return data
}

export async function getRestaurantTableByIdRequest(tableId) {
  const { data } = await api.get(`/restaurant-tables/${tableId}`)
  return data
}

export async function createRestaurantTableRequest(payload) {
  const { data } = await api.post('/restaurant-tables', payload)
  return data
}

export async function updateRestaurantTableRequest(tableId, payload) {
  const { data } = await api.patch(`/restaurant-tables/${tableId}`, payload)
  return data
}

export async function updateRestaurantTableStatusRequest(tableId, isActive) {
  const { data } = await api.patch(`/restaurant-tables/${tableId}/status`, {
    isActive,
  })

  return data
}