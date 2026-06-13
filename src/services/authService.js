import api from '../api/axios'

export async function loginRequest(credentials) {
  const response = await api.post('/auth/login', credentials)
  return response.data
}

export async function getMeRequest() {
  const response = await api.get('/auth/me')
  return response.data
}