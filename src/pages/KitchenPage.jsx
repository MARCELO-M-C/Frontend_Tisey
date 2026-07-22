import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { Link } from 'react-router'
import { useAuth } from '../auth/AuthContext'
import { isAdminUser } from '../auth/authHelpers'
import {
  getKitchenOrdersRequest,
  getKitchenStationsRequest,
  updateKitchenItemsStatusRequest,
} from '../services/kitchenService'
import './KitchenPage.css'

const STATION_STORAGE_KEY = 'kitchenStationId'
const WARNING_MINUTES = 15
const CRITICAL_MINUTES = 30
const REFRESH_INTERVAL_MS = 15_000
const CLOCK_INTERVAL_MS = 30_000

const ACTIVE_ITEM_STATUSES = new Set([
  'PENDING',
  'IN_PROGRESS',
])

export default function KitchenPage() {
  const { user, logout } = useAuth()

  const [stations, setStations] = useState([])
  const [orders, setOrders] = useState([])
  const [selectedStationId, setSelectedStationId] = useState('')
  const [now, setNow] = useState(() => Date.now())

  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [workingOrderId, setWorkingOrderId] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const isAdmin = isAdminUser(user)

  const loadKitchenData = useCallback(async ({ silent = false } = {}) => {
    try {
      if (silent) {
        setRefreshing(true)
      } else {
        setLoading(true)
      }

      setError('')

      const [stationsPayload, ordersPayload] = await Promise.all([
        getKitchenStationsRequest(),
        getKitchenOrdersRequest(),
      ])

      const activeStations = normalizeList(stationsPayload, 'stations')
        .filter((station) => station.isActive)

      setStations(activeStations)
      setOrders(normalizeList(ordersPayload, 'orders'))
      setNow(Date.now())

      setSelectedStationId((currentStationId) => {
        const currentExists = activeStations.some(
          (station) =>
            String(station.id) === String(currentStationId),
        )

        if (currentExists) {
          return String(currentStationId)
        }

        const storedStationId = localStorage.getItem(
          STATION_STORAGE_KEY,
        )

        const storedExists = activeStations.some(
          (station) =>
            String(station.id) === String(storedStationId),
        )

        const nextStationId = storedExists
          ? String(storedStationId)
          : String(activeStations[0]?.id ?? '')

        if (nextStationId) {
          localStorage.setItem(
            STATION_STORAGE_KEY,
            nextStationId,
          )
        }

        return nextStationId
      })
    } catch (requestError) {
      setError(
        getErrorMessage(
          requestError,
          'No se pudo cargar el tablero de cocina.',
        ),
      )
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    loadKitchenData()

    const refreshIntervalId = window.setInterval(() => {
      loadKitchenData({ silent: true })
    }, REFRESH_INTERVAL_MS)

    const clockIntervalId = window.setInterval(() => {
      setNow(Date.now())
    }, CLOCK_INTERVAL_MS)

    return () => {
      window.clearInterval(refreshIntervalId)
      window.clearInterval(clockIntervalId)
    }
  }, [loadKitchenData])

  const selectedStation = useMemo(() => {
    return stations.find(
      (station) =>
        String(station.id) === String(selectedStationId),
    )
  }, [stations, selectedStationId])

  const kitchenCards = useMemo(() => {
    if (!selectedStationId) return []

    return orders
      .map((order) =>
        buildKitchenCard(order, selectedStationId, now),
      )
      .filter(Boolean)
      .sort(
        (firstCard, secondCard) =>
          secondCard.sentAtMs - firstCard.sentAtMs,
      )
  }, [orders, selectedStationId, now])

  const stats = useMemo(() => {
    return {
      total: kitchenCards.length,
      pending: kitchenCards.filter(
        (card) => card.pendingItems.length > 0,
      ).length,
      preparing: kitchenCards.filter(
        (card) => card.inProgressItems.length > 0,
      ).length,
      critical: kitchenCards.filter(
        (card) => card.delayLevel === 'critical',
      ).length,
    }
  }, [kitchenCards])

  function handleStationChange(event) {
    const stationId = event.target.value

    setSelectedStationId(stationId)
    localStorage.setItem(STATION_STORAGE_KEY, stationId)
    setError('')
    setSuccess('')
  }

  async function handleStartPreparing(card) {
    if (card.pendingItems.length === 0) return

    await changeCardItemsStatus(
      card,
      card.pendingItems,
      'IN_PROGRESS',
      'Orden marcada en preparación.',
    )
  }

  async function handleMarkReady(card) {
    if (card.pendingItems.length > 0) {
      setError(
        'Primero debes marcar como preparando todos los productos de la tarjeta.',
      )
      return
    }

    if (card.inProgressItems.length === 0) return

    await changeCardItemsStatus(
      card,
      card.inProgressItems,
      'READY',
      'Productos marcados como listos.',
    )
  }

  async function changeCardItemsStatus(
    card,
    items,
    nextStatus,
    successMessage,
  ) {
    try {
      setWorkingOrderId(String(card.order.id))
      setError('')
      setSuccess('')

      await updateKitchenItemsStatusRequest(
        card.order.id,
        items.map((item) => item.id),
        nextStatus,
      )

      setSuccess(successMessage)
      await loadKitchenData({ silent: true })

      window.setTimeout(() => {
        setSuccess('')
      }, 2500)
    } catch (requestError) {
      setError(
        getErrorMessage(
          requestError,
          'No se pudo actualizar la orden.',
        ),
      )
    } finally {
      setWorkingOrderId('')
    }
  }

  async function handleFullscreen() {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen()
      } else {
        await document.documentElement.requestFullscreen()
      }
    } catch {
      setError('El navegador no permitió cambiar a pantalla completa.')
    }
  }

  return (
    <main className="kitchen-page">
      <section className="kitchen-hero">
        <div>
          <span className="kitchen-eyebrow">
            Cocina / KDS
          </span>

          <h1>
            {selectedStation?.name || 'Tablero de preparación'}
          </h1>

          <p>
            Las órdenes nuevas aparecen primero. El color cambia
            según el tiempo transcurrido desde que fueron enviadas.
          </p>

          <div className="kitchen-session-row">
            <small>
              Sesión: {user?.fullName || user?.username || 'Cocina'}
            </small>

            <small>
              Actualización automática cada 15 segundos
            </small>
          </div>
        </div>

        <div className="kitchen-hero-actions">
          {isAdmin && (
            <Link
              to="/dashboard"
              className="kitchen-header-button kitchen-header-button-light"
            >
              Volver al dashboard
            </Link>
          )}

          <button
            type="button"
            className="kitchen-header-button"
            onClick={handleFullscreen}
          >
            Pantalla completa
          </button>

          <button
            type="button"
            className="kitchen-header-button"
            onClick={logout}
          >
            Cerrar sesión
          </button>
        </div>
      </section>

      <section className="kitchen-control-bar">
        <label className="kitchen-station-selector">
          <span>Estación mostrada</span>

          <select
            value={selectedStationId}
            onChange={handleStationChange}
            disabled={loading || stations.length === 0}
          >
            {stations.length === 0 && (
              <option value="">Sin estaciones activas</option>
            )}

            {stations.map((station) => (
              <option key={station.id} value={station.id}>
                {station.name} ({station.code})
              </option>
            ))}
          </select>
        </label>

        <div className="kitchen-legend">
          <span className="kitchen-legend-item is-new">
            0–14 min
          </span>

          <span className="kitchen-legend-item is-warning">
            15–29 min
          </span>

          <span className="kitchen-legend-item is-critical">
            30+ min
          </span>
        </div>

        <button
          type="button"
          className="kitchen-refresh-button"
          onClick={() => loadKitchenData({ silent: true })}
          disabled={refreshing || loading}
        >
          {refreshing ? 'Actualizando...' : 'Actualizar ahora'}
        </button>
      </section>

      {error && (
        <section className="kitchen-alert kitchen-alert-error">
          {error}
        </section>
      )}

      {success && (
        <section className="kitchen-alert kitchen-alert-success">
          {success}
        </section>
      )}

      <section className="kitchen-summary">
        <article>
          <span>Tarjetas visibles</span>
          <strong>{loading ? '...' : stats.total}</strong>
        </article>

        <article>
          <span>Por iniciar</span>
          <strong>{loading ? '...' : stats.pending}</strong>
        </article>

        <article>
          <span>Preparando</span>
          <strong>{loading ? '...' : stats.preparing}</strong>
        </article>

        <article className="is-critical">
          <span>Críticas</span>
          <strong>{loading ? '...' : stats.critical}</strong>
        </article>
      </section>

      {loading ? (
        <section className="kitchen-empty-state">
          Cargando órdenes de cocina...
        </section>
      ) : !selectedStation ? (
        <section className="kitchen-empty-state">
          No hay una estación activa seleccionada.
        </section>
      ) : kitchenCards.length === 0 ? (
        <section className="kitchen-empty-state kitchen-empty-success">
          No hay órdenes pendientes para {selectedStation.name}.
        </section>
      ) : (
        <section className="kitchen-ticket-grid">
          {kitchenCards.map((card) => {
            const isWorking =
              String(workingOrderId) === String(card.order.id)

            return (
              <article
                className={`kitchen-ticket kitchen-ticket-${card.delayLevel}`}
                key={card.order.id}
              >
                <header className="kitchen-ticket-header">
                  <div>
                    <span className="kitchen-ticket-label">
                      Orden
                    </span>

                    <strong>{card.order.orderCode}</strong>
                  </div>

                  <div className="kitchen-ticket-time">
                    <strong>{formatElapsed(card.minutesWaiting)}</strong>
                    <span>{getDelayLabel(card.delayLevel)}</span>
                  </div>
                </header>

                <div className="kitchen-ticket-context">
                  <strong>{getOrderContext(card.order)}</strong>

                  <span>
                    {getChannelLabel(card.order.channel)}
                    {' · '}
                    {getWaiterName(card.order)}
                  </span>
                </div>

                {card.order.notes && (
                  <div className="kitchen-order-note">
                    <strong>Nota general</strong>
                    <p>{card.order.notes}</p>
                  </div>
                )}

                <div className="kitchen-item-list">
                  {card.items.map((item) => (
                    <div
                      className={`kitchen-item kitchen-item-${item.itemStatus.toLowerCase()}`}
                      key={item.id}
                    >
                      <div className="kitchen-item-quantity">
                        {item.quantity}×
                      </div>

                      <div className="kitchen-item-content">
                        <strong>{item.itemName}</strong>

                        {item.itemNotes && (
                          <p>{item.itemNotes}</p>
                        )}
                      </div>

                      <span className="kitchen-item-status">
                        {getItemStatusLabel(item.itemStatus)}
                      </span>
                    </div>
                  ))}
                </div>

                <footer className="kitchen-ticket-actions">
                  <button
                    type="button"
                    className="kitchen-action-button kitchen-action-preparing"
                    onClick={() => handleStartPreparing(card)}
                    disabled={
                      isWorking || card.pendingItems.length === 0
                    }
                  >
                    {isWorking
                      ? 'Actualizando...'
                      : `Preparando (${card.pendingItems.length})`}
                  </button>

                  <button
                    type="button"
                    className="kitchen-action-button kitchen-action-ready"
                    onClick={() => handleMarkReady(card)}
                    disabled={
                      isWorking ||
                      card.pendingItems.length > 0 ||
                      card.inProgressItems.length === 0
                    }
                    title={
                      card.pendingItems.length > 0
                        ? 'Primero marca todos los productos como preparando.'
                        : ''
                    }
                  >
                    {isWorking
                      ? 'Actualizando...'
                      : `Listo (${card.inProgressItems.length})`}
                  </button>
                </footer>
              </article>
            )
          })}
        </section>
      )}
    </main>
  )
}

function buildKitchenCard(order, stationId, now) {
  const stationItems = (order.items ?? []).filter(
    (item) =>
      String(item.station?.id ?? item.stationId) ===
        String(stationId) &&
      ACTIVE_ITEM_STATUSES.has(item.itemStatus),
  )

  if (stationItems.length === 0) return null

  const sentAtValue = order.sentAt || order.createdAt
  const sentAtMs = new Date(sentAtValue).getTime()
  const safeSentAtMs = Number.isNaN(sentAtMs) ? now : sentAtMs

  const minutesWaiting = Math.max(
    0,
    Math.floor((now - safeSentAtMs) / 60_000),
  )

  return {
    order,
    items: stationItems,
    pendingItems: stationItems.filter(
      (item) => item.itemStatus === 'PENDING',
    ),
    inProgressItems: stationItems.filter(
      (item) => item.itemStatus === 'IN_PROGRESS',
    ),
    sentAtMs: safeSentAtMs,
    minutesWaiting,
    delayLevel: getDelayLevel(minutesWaiting),
  }
}

function getDelayLevel(minutes) {
  if (minutes >= CRITICAL_MINUTES) return 'critical'
  if (minutes >= WARNING_MINUTES) return 'warning'
  return 'new'
}

function getDelayLabel(level) {
  const labels = {
    new: 'Nueva',
    warning: 'En espera',
    critical: 'Crítica',
  }

  return labels[level] || level
}

function getOrderContext(order) {
  if (order.table) {
    return `Mesa ${order.table.code}`
  }

  if (order.stay) {
    return `Cabaña ${order.stay.cabin?.cabinNumber ?? ''}`.trim()
  }

  if (order.channel === 'TAKE_AWAY') {
    return 'Pedido para llevar'
  }

  return 'Orden sin ubicación'
}

function getChannelLabel(channel) {
  const labels = {
    DINE_IN: 'Mesa',
    TAKE_AWAY: 'Para llevar',
    ROOM_CHARGE: 'Habitación',
  }

  return labels[channel] || channel
}

function getWaiterName(order) {
  return (
    order.waiter?.fullName ||
    order.createdBy?.fullName ||
    order.createdByUser?.fullName ||
    order.waiter?.username ||
    order.createdByUser?.username ||
    'Sin mesero'
  )
}

function getItemStatusLabel(status) {
  const labels = {
    PENDING: 'Pendiente',
    IN_PROGRESS: 'Preparando',
  }

  return labels[status] || status
}

function formatElapsed(minutes) {
  if (minutes < 60) {
    return `${minutes} min`
  }

  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60

  return `${hours} h ${remainingMinutes} min`
}

function normalizeList(payload, key) {
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.[key])) return payload[key]
  if (Array.isArray(payload?.items)) return payload.items
  if (Array.isArray(payload?.data)) return payload.data
  return []
}

function getErrorMessage(error, fallback) {
  return (
    error?.response?.data?.message ||
    error?.response?.data?.error ||
    error?.message ||
    fallback
  )
}
