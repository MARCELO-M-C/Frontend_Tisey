import api from '../api/axios'
import {
  getOrdersRequest,
  updateOrderItemStatusRequest,
} from './ordersService'

export async function getKitchenStationsRequest() {
  const { data } = await api.get('/stations', {
    params: {
      isActive: 'true',
    },
  })

  return data
}

export async function getKitchenOrdersRequest() {
  const [sentOrders, inProgressOrders] = await Promise.all([
    getOrdersRequest({ status: 'SENT' }),
    getOrdersRequest({ status: 'IN_PROGRESS' }),
  ])

  const uniqueOrders = new Map()

  for (const order of [
    ...normalizeList(sentOrders),
    ...normalizeList(inProgressOrders),
  ]) {
    uniqueOrders.set(String(order.id), order)
  }

  return Array.from(uniqueOrders.values())
}

export async function updateKitchenItemsStatusRequest(
  orderId,
  itemIds,
  status,
) {
  let updatedOrder = null

  for (const itemId of itemIds) {
    updatedOrder = await updateOrderItemStatusRequest(
      orderId,
      itemId,
      status,
    )
  }

  return updatedOrder
}

function normalizeList(payload) {
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.orders)) return payload.orders
  if (Array.isArray(payload?.items)) return payload.items
  if (Array.isArray(payload?.data)) return payload.data
  return []
}
