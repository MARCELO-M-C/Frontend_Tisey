import api from '../api/axios'

export async function getShiftsRequest(params = {}) {
  const { data } = await api.get('/shifts', { params })
  return data
}

export async function getShiftByIdRequest(shiftId) {
  const { data } = await api.get(`/shifts/${shiftId}`)
  return data
}

export async function createShiftRequest(payload) {
  const { data } = await api.post('/shifts', payload)
  return data
}

export async function updateShiftRequest(shiftId, payload) {
  const { data } = await api.patch(`/shifts/${shiftId}`, payload)
  return data
}

export async function endShiftRequest(shiftId, payload = {}) {
  const { data } = await api.patch(`/shifts/${shiftId}/end`, payload)
  return data
}

export async function getStationsRequest(params = {}) {
  const { data } = await api.get('/stations', { params })
  return data
}

export async function getStationByIdRequest(stationId) {
  const { data } = await api.get(`/stations/${stationId}`)
  return data
}

export async function createStationRequest(payload) {
  const { data } = await api.post('/stations', payload)
  return data
}

export async function updateStationRequest(stationId, payload) {
  const { data } = await api.patch(`/stations/${stationId}`, payload)
  return data
}

export async function updateStationStatusRequest(stationId, isActive) {
  const { data } = await api.patch(`/stations/${stationId}/status`, {
    isActive,
  })

  return data
}