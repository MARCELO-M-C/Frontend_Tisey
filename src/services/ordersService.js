import api from '../api/axios'

export async function getOrdersRequest(params = {}) {
  const { data } = await api.get('/orders', { params })
  return data
}

export async function getOrderByIdRequest(orderId) {
  const { data } = await api.get(`/orders/${orderId}`)
  return data
}

export async function createOrderRequest(payload) {
  const { data } = await api.post('/orders', payload)
  return data
}

export async function updateOrderRequest(orderId, payload) {
  const { data } = await api.patch(`/orders/${orderId}`, payload)
  return data
}

export async function addOrderItemsRequest(orderId, items) {
  const { data } = await api.post(`/orders/${orderId}/items`, {
    items,
  })

  return data
}

export async function sendOrderRequest(orderId) {
  const { data } = await api.post(`/orders/${orderId}/send`)
  return data
}

export async function cancelOrderRequest(orderId, reason) {
  const { data } = await api.post(`/orders/${orderId}/cancel`, {
    reason,
  })

  return data
}

export async function updateOrderItemStatusRequest(
  orderId,
  orderItemId,
  status,
) {
  const { data } = await api.patch(
    `/orders/${orderId}/items/${orderItemId}/status`,
    {
      status,
    },
  )

  return data
}