import api from '../api/axios'

const WARNING_MINUTES = Number(
  import.meta.env.VITE_LATE_ORDER_WARNING_MINUTES || 20
)

const CRITICAL_MINUTES = Number(
  import.meta.env.VITE_LATE_ORDER_CRITICAL_MINUTES || 30
)

const WAITER_EDIT_WINDOW_MINUTES = Number(
  import.meta.env.VITE_WAITER_EDIT_WINDOW_MINUTES || 30
)

const KITCHEN_STATUSES = ['SENT', 'IN_PROGRESS']
const READY_TO_BILL_STATUSES = ['READY', 'DELIVERED']
const ACTIVE_STATUSES = ['DRAFT', 'SENT', 'IN_PROGRESS', 'READY', 'DELIVERED']

export async function getAdminDashboardData() {
  const ordersResponse = await api.get('/orders')
  const orders = ordersResponse.data

  return buildDashboardData(orders)
}

function buildDashboardData(orders) {  

  const todayOrders = orders.filter((order) =>
  isToday(order.createdAt)
  )

  const kitchenOrders = todayOrders
  .filter((order) => KITCHEN_STATUSES.includes(order.status))
  .map((order) => decorateOrderTiming(order))
  .sort((a, b) => b.minutesWaiting - a.minutesWaiting)

  const readyToBillOrders = todayOrders
  .filter((order) => READY_TO_BILL_STATUSES.includes(order.status))
  .map((order) => decorateOrderTiming(order))

  const activeOrders = todayOrders.filter((order) =>
  ACTIVE_STATUSES.includes(order.status)
  )

  const warningOrders = kitchenOrders.filter(
    (order) => order.delayLevel === 'warning'
  )

  const criticalOrders = kitchenOrders.filter(
    (order) => order.delayLevel === 'critical'
  )

  return {
    stats: {
      todayOrders: todayOrders.length,
      kitchenOrders: kitchenOrders.length,
      readyToBillOrders: readyToBillOrders.length,
      criticalOrders: criticalOrders.length,
    },

    kitchenSummary: buildKitchenSummary(kitchenOrders),

    waiterSummary: buildWaiterSummary(todayOrders),

    lateOrders: [...criticalOrders, ...warningOrders],

    alerts: buildAlerts({
      kitchenOrders,
      readyToBillOrders,
      warningOrders,
      criticalOrders,
    }),

    config: {
      warningMinutes: WARNING_MINUTES,
      criticalMinutes: CRITICAL_MINUTES,
      waiterEditWindowMinutes: WAITER_EDIT_WINDOW_MINUTES,
    },
  }
}

function decorateOrderTiming(order) {
  const startedAt = order.sentAt || order.createdAt
  const minutesWaiting = getMinutesDifference(startedAt)

  return {
    ...order,
    minutesWaiting,
    delayLevel: getDelayLevel(minutesWaiting),
  }
}

function getDelayLevel(minutesWaiting) {
  if (minutesWaiting >= CRITICAL_MINUTES) return 'critical'
  if (minutesWaiting >= WARNING_MINUTES) return 'warning'
  return 'normal'
}

function buildKitchenSummary(kitchenOrders) {
  const sentOrders = kitchenOrders.filter((order) => order.status === 'SENT')
  const inProgressOrders = kitchenOrders.filter(
    (order) => order.status === 'IN_PROGRESS'
  )

  return {
    sent: sentOrders.length,
    inProgress: inProgressOrders.length,
    normal: kitchenOrders.filter((order) => order.delayLevel === 'normal').length,
    warning: kitchenOrders.filter((order) => order.delayLevel === 'warning').length,
    critical: kitchenOrders.filter((order) => order.delayLevel === 'critical').length,
  }
}

function buildWaiterSummary(todayOrders) {
  const summaryMap = new Map()

  todayOrders.forEach((order) => {
    const waiter = order.waiter || order.createdBy

    if (!waiter) return

    const waiterId = waiter.id

    if (!summaryMap.has(waiterId)) {
      summaryMap.set(waiterId, {
        id: waiterId,
        name: waiter.fullName || waiter.username,
        username: waiter.username,
        totalOrders: 0,
        activeOrders: 0,
        kitchenOrders: 0,
        readyToBillOrders: 0,
        delayedOrders: 0,
        subtotal: 0,
      })
    }

    const summary = summaryMap.get(waiterId)

    summary.totalOrders += 1
    summary.subtotal += Number(order.summary?.subtotal || 0)

    if (ACTIVE_STATUSES.includes(order.status)) {
      summary.activeOrders += 1
    }

    if (KITCHEN_STATUSES.includes(order.status)) {
      summary.kitchenOrders += 1

      const timedOrder = decorateOrderTiming(order)

      if (timedOrder.delayLevel !== 'normal') {
        summary.delayedOrders += 1
      }
    }

    if (READY_TO_BILL_STATUSES.includes(order.status)) {
      summary.readyToBillOrders += 1
    }
  })

  return Array.from(summaryMap.values()).sort(
    (a, b) => b.totalOrders - a.totalOrders
  )
}

function buildAlerts({
  kitchenOrders,
  readyToBillOrders,
  warningOrders,
  criticalOrders,
}) {
  const alerts = []

  if (criticalOrders.length > 0) {
    alerts.push({
      title: 'Órdenes críticas',
      message: `${criticalOrders.length} orden(es) llevan ${CRITICAL_MINUTES} minutos o más en cocina.`,
      level: 'danger',
    })
  }

  if (warningOrders.length > 0) {
    alerts.push({
      title: 'Órdenes con demora',
      message: `${warningOrders.length} orden(es) superaron los ${WARNING_MINUTES} minutos.`,
      level: 'warning',
    })
  }

  if (readyToBillOrders.length > 0) {
    alerts.push({
      title: 'Facturación',
      message: `${readyToBillOrders.length} orden(es) están listas para cobrar.`,
      level: 'success',
    })
  }

  if (kitchenOrders.length === 0) {
    alerts.push({
      title: 'Cocina tranquila',
      message: 'No hay órdenes pendientes en cocina en este momento.',
      level: 'success',
    })
  }

  return alerts
}

function getMinutesDifference(dateValue) {
  if (!dateValue) return 0

  const date = new Date(dateValue)
  const now = new Date()

  return Math.max(0, Math.floor((now.getTime() - date.getTime()) / 60000))
}

function isToday(dateValue) {
  if (!dateValue) return false

  const date = new Date(dateValue)
  const today = new Date()

  return (
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
  )
}

export function formatCurrencyCordobas(value) {
  return new Intl.NumberFormat('es-NI', {
    style: 'currency',
    currency: 'NIO',
  }).format(value)
}

export function formatWaitingTime(minutes) {
  if (minutes < 1) return 'Hace menos de 1 min'

  if (minutes < 60) {
    return minutes === 1 ? 'Hace 1 min' : `Hace ${minutes} min`
  }

  const hours = Math.floor(minutes / 60)

  if (hours < 24) {
    return hours === 1 ? 'Hace 1 hora' : `Hace ${hours} horas`
  }

  const days = Math.floor(hours / 24)

  return days === 1 ? 'Hace 1 día' : `Hace ${days} días`
}