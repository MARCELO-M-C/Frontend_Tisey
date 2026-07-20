import api from '../api/axios'

// Cabañas

export async function getCabinsRequest(params = {}) {
  const { data } = await api.get('/cabins', { params })
  return data
}

export async function getCabinByIdRequest(cabinId) {
  const { data } = await api.get(`/cabins/${cabinId}`)
  return data
}

export async function createCabinRequest(payload) {
  const { data } = await api.post('/cabins', payload)
  return data
}

export async function updateCabinRequest(cabinId, payload) {
  const { data } = await api.patch(`/cabins/${cabinId}`, payload)
  return data
}

export async function updateCabinStatusRequest(cabinId, status) {
  const { data } = await api.patch(`/cabins/${cabinId}/status`, {
    status,
  })

  return data
}

export async function updateCabinActiveRequest(cabinId, isActive) {
  const { data } = await api.patch(`/cabins/${cabinId}/active`, {
    isActive,
  })

  return data
}

// Huéspedes

export async function getGuestsRequest(params = {}) {
  const { data } = await api.get('/guests', { params })
  return data
}

export async function getGuestByIdRequest(guestId) {
  const { data } = await api.get(`/guests/${guestId}`)
  return data
}

export async function createGuestRequest(payload) {
  const { data } = await api.post('/guests', payload)
  return data
}

export async function updateGuestRequest(guestId, payload) {
  const { data } = await api.patch(`/guests/${guestId}`, payload)
  return data
}

// Estadías

export async function getStaysRequest(params = {}) {
  const { data } = await api.get('/stays', { params })
  return data
}

export async function getStayByIdRequest(stayId) {
  const { data } = await api.get(`/stays/${stayId}`)
  return data
}

export async function createStayRequest(payload) {
  const { data } = await api.post('/stays', payload)
  return data
}

export async function updateStayRequest(stayId, payload) {
  const { data } = await api.patch(`/stays/${stayId}`, payload)
  return data
}

export async function updateStayStatusRequest(stayId, status) {
  const { data } = await api.patch(`/stays/${stayId}/status`, {
    status,
  })

  return data
}

export async function replaceStayGuestsRequest(stayId, guestIds) {
  const { data } = await api.patch(`/stays/${stayId}/guests`, {
    guestIds,
  })

  return data
}