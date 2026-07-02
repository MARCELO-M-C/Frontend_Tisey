import api from '../api/axios'

export async function getMenuStationsRequest(params = {}) {
  const { data } = await api.get('/menu/stations', { params })
  return data
}

export async function getMenuCategoriesRequest(params = {}) {
  const { data } = await api.get('/menu/categories', { params })
  return data
}

export async function getMenuCategoryByIdRequest(categoryId) {
  const { data } = await api.get(`/menu/categories/${categoryId}`)
  return data
}

export async function createMenuCategoryRequest(payload) {
  const { data } = await api.post('/menu/categories', payload)
  return data
}

export async function updateMenuCategoryRequest(categoryId, payload) {
  const { data } = await api.patch(`/menu/categories/${categoryId}`, payload)
  return data
}

export async function updateMenuCategoryStatusRequest(categoryId, isActive) {
  const { data } = await api.patch(`/menu/categories/${categoryId}/status`, {
    isActive,
  })

  return data
}

export async function getMenuItemsRequest(params = {}) {
  const { data } = await api.get('/menu/items', { params })
  return data
}

export async function getMenuItemByIdRequest(itemId) {
  const { data } = await api.get(`/menu/items/${itemId}`)
  return data
}

export async function createMenuItemRequest(payload) {
  const { data } = await api.post('/menu/items', payload)
  return data
}

export async function updateMenuItemRequest(itemId, payload) {
  const { data } = await api.patch(`/menu/items/${itemId}`, payload)
  return data
}

export async function updateMenuItemStatusRequest(itemId, isActive) {
  const { data } = await api.patch(`/menu/items/${itemId}/status`, {
    isActive,
  })

  return data
}