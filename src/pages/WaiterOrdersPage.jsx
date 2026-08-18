import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { Link } from 'react-router'
import { useAuth } from '../auth/AuthContext'
import {
  canUsePermission,
  isAdminUser,
  isWaiterUser,
} from '../auth/authHelpers'
import { getMenuItemsRequest } from '../services/menuService'
import { getRestaurantTablesRequest } from '../services/restaurantTablesService'
import {
  createShiftRequest,
  endShiftRequest,
  getShiftsRequest,
} from '../services/operationsService'
import { getStaysRequest } from '../services/lodgingService'
import {
  createOrderRequest,
  getOrdersRequest,
  sendOrderRequest,
  updateOrderItemStatusRequest,
} from '../services/ordersService'
import './WaiterOrdersPage.css'

const WARNING_MINUTES = 20
const CRITICAL_MINUTES = 30

const steps = [
  { id: 1, label: 'Destino' },
  { id: 2, label: 'Productos' },
  { id: 3, label: 'Revisión' },
]

const channelOptions = [
  {
    value: 'DINE_IN',
    label: 'Mesa',
    helper: 'La orden se atenderá en el restaurante.',
    icon: '🍽️',
  },
  {
    value: 'TAKE_AWAY',
    label: 'Para llevar',
    helper: 'El cliente retirará la orden.',
    icon: '🥡',
  },
  {
    value: 'ROOM_CHARGE',
    label: 'Habitación',
    helper: 'El consumo se cargará a una estadía activa.',
    icon: '🏡',
  },
]

const managementFilters = [
  { id: 'active', label: 'Pendientes' },
  { id: 'ready', label: 'Por entregar' },
  { id: 'delivered', label: 'Entregadas' },
  { id: 'all', label: 'Todas' },
]

function createInitialOrderForm() {
  return {
    customerName: '',
    channel: 'DINE_IN',
    serviceMode: 'EAT_HERE',
    tableId: '',
    stayId: '',
    notes: '',
  }
}

export default function WaiterOrdersPage() {
  const { user, logout } = useAuth()

  const canSuperviseOrders = canUsePermission(user, 'ADMIN_ORDERS_MANAGE')
  const canTakeOrders = isWaiterUser(user) || isAdminUser(user)
  const requiresShiftBeforeAccess = isWaiterUser(user) && !canSuperviseOrders

  const [activeArea, setActiveArea] = useState('')
  const [openShift, setOpenShift] = useState(null)
  const [shiftState, setShiftState] = useState('loading')
  const [closeShiftNotes, setCloseShiftNotes] = useState('')
  const [showClosePanel, setShowClosePanel] = useState(false)

  const [orders, setOrders] = useState([])
  const [menuItems, setMenuItems] = useState([])
  const [tables, setTables] = useState([])
  const [stays, setStays] = useState([])

  const [step, setStep] = useState(1)
  const [orderForm, setOrderForm] = useState(createInitialOrderForm)
  const [cart, setCart] = useState([])
  const [productSearch, setProductSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState('all')
  const [pendingDraft, setPendingDraft] = useState(null)
  const [completedOrder, setCompletedOrder] = useState(null)

  const [orderScope, setOrderScope] = useState('all')
  const [managementFilter, setManagementFilter] = useState('active')
  const [managementSearch, setManagementSearch] = useState('')
  const [waiterFilter, setWaiterFilter] = useState('all')
  const [selectedOrder, setSelectedOrder] = useState(null)

  const [loadingData, setLoadingData] = useState(true)
  const [loadingOrders, setLoadingOrders] = useState(false)
  const [saving, setSaving] = useState(false)
  const [orderActionId, setOrderActionId] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    if (!user?.id || activeArea) return

    if (canSuperviseOrders || !canTakeOrders) {
      setActiveArea('manage')
      return
    }

    setActiveArea('create')
  }, [activeArea, canSuperviseOrders, canTakeOrders, user?.id])

  const loadOrders = useCallback(
    async ({ silent = false } = {}) => {
      if (!user?.id) return

      try {
        if (!silent) setLoadingOrders(true)

        const payload = await getOrdersRequest()
        setOrders(normalizeList(payload, 'orders'))
      } catch (requestError) {
        if (!silent) {
          setError(
            getErrorMessage(
              requestError,
              'No se pudieron cargar las órdenes.',
            ),
          )
        }
      } finally {
        if (!silent) setLoadingOrders(false)
      }
    },
    [user?.id],
  )

  const loadInitialData = useCallback(async () => {
    if (!user?.id) return

    try {
      setLoadingData(true)
      setShiftState('loading')
      setError('')

      const [
        shiftsPayload,
        menuPayload,
        tablesPayload,
        staysPayload,
        ordersPayload,
      ] = await Promise.all([
        getShiftsRequest({
          userId: user.id,
          isOpen: 'true',
        }),
        getMenuItemsRequest({ isActive: true }),
        getRestaurantTablesRequest({ isActive: true }),
        getStaysRequest({ status: 'CHECKED_IN' }),
        getOrdersRequest(),
      ])

      const shifts = normalizeList(shiftsPayload, 'shifts')
      const currentShift = shifts.find((shift) => shift.isOpen) ?? null

      setOpenShift(currentShift)
      setShiftState(currentShift ? 'open' : 'closed')
      setMenuItems(normalizeList(menuPayload, 'items'))
      setTables(normalizeList(tablesPayload, 'tables'))
      setStays(normalizeList(staysPayload, 'stays'))
      setOrders(normalizeList(ordersPayload, 'orders'))
    } catch (requestError) {
      setShiftState('error')
      setError(
        getErrorMessage(
          requestError,
          'No se pudo cargar la información de órdenes.',
        ),
      )
    } finally {
      setLoadingData(false)
    }
  }, [user?.id])

  useEffect(() => {
    loadInitialData()
  }, [loadInitialData])

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(Date.now())
    }, 60_000)

    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    if (activeArea !== 'manage') return undefined

    const interval = window.setInterval(() => {
      loadOrders({ silent: true })
    }, 15_000)

    function handleFocus() {
      loadOrders({ silent: true })
    }

    window.addEventListener('focus', handleFocus)

    return () => {
      window.clearInterval(interval)
      window.removeEventListener('focus', handleFocus)
    }
  }, [activeArea, loadOrders])

  const activeMenuItems = useMemo(
    () => menuItems.filter((item) => item.isActive),
    [menuItems],
  )

  const activeTables = useMemo(
    () => tables.filter((table) => table.isActive),
    [tables],
  )

  const checkedInStays = useMemo(
    () => stays.filter((stay) => stay.status === 'CHECKED_IN'),
    [stays],
  )

  const categories = useMemo(() => {
    const categoryMap = new Map()

    activeMenuItems.forEach((item) => {
      const id = String(
        item.category?.id ??
          item.categoryId ??
          item.category?.name ??
          'uncategorized',
      )

      const name =
        item.category?.name ||
        item.categoryName ||
        'Otros'

      if (!categoryMap.has(id)) {
        categoryMap.set(id, { id, name })
      }
    })

    return [...categoryMap.values()].sort((a, b) =>
      a.name.localeCompare(b.name, 'es'),
    )
  }, [activeMenuItems])

  const filteredMenuItems = useMemo(() => {
    const normalizedSearch = productSearch.trim().toLowerCase()

    return activeMenuItems.filter((item) => {
      const categoryId = String(
        item.category?.id ??
          item.categoryId ??
          item.category?.name ??
          'uncategorized',
      )

      const matchesCategory =
        activeCategory === 'all' ||
        categoryId === activeCategory

      const matchesSearch =
        !normalizedSearch ||
        String(item.name ?? '')
          .toLowerCase()
          .includes(normalizedSearch)

      return matchesCategory && matchesSearch
    })
  }, [activeMenuItems, activeCategory, productSearch])

  const cartTotal = useMemo(
    () =>
      cart.reduce(
        (total, line) =>
          total + Number(line.unitPrice) * Number(line.quantity),
        0,
      ),
    [cart],
  )

  const totalQuantity = useMemo(
    () =>
      cart.reduce(
        (total, line) => total + Number(line.quantity),
        0,
      ),
    [cart],
  )

  const waiterOptions = useMemo(() => {
    const map = new Map()

    orders.forEach((order) => {
      if (!order.waiter?.id) return
      map.set(String(order.waiter.id), order.waiter)
    })

    return [...map.values()].sort((a, b) =>
      getUserName(a).localeCompare(getUserName(b), 'es'),
    )
  }, [orders])

  const scopedOrders = useMemo(() => {
    if (!canSuperviseOrders || orderScope === 'mine') {
      return orders.filter(
        (order) => String(order.waiter?.id) === String(user?.id),
      )
    }

    return orders
  }, [canSuperviseOrders, orderScope, orders, user?.id])

  const filteredOrders = useMemo(() => {
    const search = managementSearch.trim().toLowerCase()

    return scopedOrders
      .filter((order) => {
        const matchesManagementFilter =
          managementFilter === 'all' ||
          (managementFilter === 'active' &&
            ['DRAFT', 'SENT', 'IN_PROGRESS', 'READY'].includes(
              order.status,
            )) ||
          (managementFilter === 'ready' && order.status === 'READY') ||
          (managementFilter === 'delivered' &&
            ['DELIVERED', 'CLOSED'].includes(order.status))

        const matchesWaiter =
          waiterFilter === 'all' ||
          String(order.waiter?.id) === String(waiterFilter)

        const haystack = [
          order.orderCode,
          order.customerName,
          order.waiter?.fullName,
          order.waiter?.username,
          order.table?.code,
          order.table?.name,
          order.stay?.primaryGuest?.fullName,
          order.stay?.cabin?.name,
          order.stay?.cabin?.cabinNumber,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()

        const matchesSearch = !search || haystack.includes(search)

        return (
          matchesManagementFilter &&
          matchesWaiter &&
          matchesSearch
        )
      })
      .sort(compareOrdersForManagement)
  }, [
    scopedOrders,
    managementFilter,
    waiterFilter,
    managementSearch,
  ])

  const attentionOrders = useMemo(
    () =>
      scopedOrders
        .map((order) => ({
          order,
          alert: getOrderDelayAlert(order, now),
        }))
        .filter((entry) => entry.alert)
        .sort((a, b) => {
          if (a.alert.level === b.alert.level) {
            return b.alert.minutes - a.alert.minutes
          }

          return a.alert.level === 'critical' ? -1 : 1
        }),
    [now, scopedOrders],
  )

  const myBlockingOrders = useMemo(
    () =>
      orders.filter(
        (order) =>
          String(order.waiter?.id) === String(user?.id) &&
          ['DRAFT', 'SENT', 'IN_PROGRESS', 'READY'].includes(
            order.status,
          ),
      ),
    [orders, user?.id],
  )

  const selectedTable = activeTables.find(
    (table) => String(table.id) === String(orderForm.tableId),
  )

  const selectedStay = checkedInStays.find(
    (stay) => String(stay.id) === String(orderForm.stayId),
  )

  async function refreshCurrentShift() {
    if (!user?.id) return

    const payload = await getShiftsRequest({
      userId: user.id,
      isOpen: 'true',
    })

    const shifts = normalizeList(payload, 'shifts')
    const currentShift = shifts.find((shift) => shift.isOpen) ?? null

    setOpenShift(currentShift)
    setShiftState(currentShift ? 'open' : 'closed')
  }

  async function handleOpenShift() {
    clearMessages()

    try {
      setSaving(true)

      const createdShift = await createShiftRequest({})
      setOpenShift(createdShift)
      setShiftState('open')
      setSuccess('Turno abierto. Ya puedes tomar órdenes.')
    } catch (requestError) {
      setError(
        getErrorMessage(
          requestError,
          'No se pudo abrir el turno.',
        ),
      )
    } finally {
      setSaving(false)
    }
  }

  async function handleCloseShift(event) {
    event.preventDefault()
    clearMessages()

    if (!openShift?.id) return

    try {
      setSaving(true)

      const payload = closeShiftNotes.trim()
        ? { notes: closeShiftNotes.trim() }
        : {}

      await endShiftRequest(openShift.id, payload)

      setOpenShift(null)
      setShiftState('ended')
      setCloseShiftNotes('')
      setShowClosePanel(false)
      resetOrder({ clearMessage: false })
      setSuccess('Turno cerrado correctamente.')
    } catch (requestError) {
      setError(
        getErrorMessage(
          requestError,
          'No se pudo cerrar el turno. Revisa si aún tienes órdenes pendientes.',
        ),
      )
    } finally {
      setSaving(false)
    }
  }

  function handleAreaChange(nextArea) {
    clearMessages()
    setActiveArea(nextArea)

    if (nextArea === 'manage') {
      loadOrders()
    }
  }

  function handleChannelChange(channel) {
    clearMessages()

    setOrderForm((current) => ({
      ...current,
      channel,
      serviceMode: channel === 'TAKE_AWAY' ? 'TO_GO' : 'EAT_HERE',
      tableId: channel === 'DINE_IN' ? current.tableId : '',
      stayId: channel === 'ROOM_CHARGE' ? current.stayId : '',
    }))
  }

  function handleOrderFieldChange(event) {
    const { name, value } = event.target

    setOrderForm((current) => ({
      ...current,
      [name]: value,
    }))
  }

  function addProduct(item) {
    clearMessages()

    setCart((current) => {
      const existingLine = current.find(
        (line) => String(line.menuItemId) === String(item.id),
      )

      if (existingLine) {
        return current.map((line) =>
          line.localId === existingLine.localId
            ? {
                ...line,
                quantity: Math.min(Number(line.quantity) + 1, 999),
              }
            : line,
        )
      }

      return [
        ...current,
        {
          localId: createLocalId(),
          menuItemId: String(item.id),
          name: item.name,
          unitPrice: item.basePrice,
          quantity: 1,
          itemNotes: '',
          stationName: item.station?.name || 'Sin estación',
        },
      ]
    })
  }

  function updateCartQuantity(localId, nextQuantity) {
    const quantity = Number(nextQuantity)

    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 999) {
      return
    }

    setCart((current) =>
      current.map((line) =>
        line.localId === localId
          ? { ...line, quantity }
          : line,
      ),
    )
  }

  function updateCartNotes(localId, notes) {
    setCart((current) =>
      current.map((line) =>
        line.localId === localId
          ? { ...line, itemNotes: notes }
          : line,
      ),
    )
  }

  function removeCartItem(localId) {
    setCart((current) =>
      current.filter((line) => line.localId !== localId),
    )
  }

  function continueFromDestination() {
    clearMessages()

    if (orderForm.channel === 'DINE_IN' && !orderForm.tableId) {
      setError('Selecciona la mesa que atenderás.')
      return
    }

    if (orderForm.channel === 'ROOM_CHARGE' && !orderForm.stayId) {
      setError('Selecciona la estadía a la que cargarás la orden.')
      return
    }

    setStep(2)
    scrollToTop()
  }

  function continueToReview() {
    clearMessages()

    if (cart.length === 0) {
      setError('Agrega al menos un producto antes de continuar.')
      return
    }

    setStep(3)
    scrollToTop()
  }

  async function handleCreateAndSendOrder() {
    clearMessages()

    if (!openShift?.id) {
      setError('Necesitas abrir tu turno antes de enviar una orden.')
      return
    }

    if (cart.length === 0) {
      setError('La orden no tiene productos.')
      return
    }

    const payload = {
      customerName: orderForm.customerName.trim() || null,
      channel: orderForm.channel,
      serviceMode: orderForm.serviceMode,
      tableId:
        orderForm.channel === 'DINE_IN'
          ? Number(orderForm.tableId)
          : undefined,
      stayId:
        orderForm.channel === 'ROOM_CHARGE'
          ? Number(orderForm.stayId)
          : undefined,
      waiterId: Number(user.id),
      shiftId: Number(openShift.id),
      notes: orderForm.notes.trim() || undefined,
      items: cart.map((line) => ({
        menuItemId: Number(line.menuItemId),
        quantity: Number(line.quantity),
        ...(line.itemNotes.trim()
          ? { itemNotes: line.itemNotes.trim() }
          : {}),
      })),
    }

    try {
      setSaving(true)

      const createdOrder = await createOrderRequest(
        removeUndefinedValues(payload),
      )

      try {
        const sentOrder = await sendOrderRequest(createdOrder.id)

        setCompletedOrder(sentOrder)
        setPendingDraft(null)
        setSuccess(`${sentOrder.orderCode} fue enviada a cocina.`)

        await Promise.all([
          refreshCurrentShift(),
          loadOrders({ silent: true }),
        ])
      } catch (sendError) {
        setPendingDraft(createdOrder)
        setError(
          getErrorMessage(
            sendError,
            `${createdOrder.orderCode} quedó guardada como borrador, pero no se pudo enviar a cocina.`,
          ),
        )
      }
    } catch (requestError) {
      setError(
        getErrorMessage(
          requestError,
          'No se pudo crear la orden.',
        ),
      )
    } finally {
      setSaving(false)
    }
  }

  async function handleRetrySend() {
    if (!pendingDraft?.id) return

    clearMessages()

    try {
      setSaving(true)

      const sentOrder = await sendOrderRequest(pendingDraft.id)

      setCompletedOrder(sentOrder)
      setPendingDraft(null)
      setSuccess(`${sentOrder.orderCode} fue enviada a cocina.`)

      await Promise.all([
        refreshCurrentShift(),
        loadOrders({ silent: true }),
      ])
    } catch (requestError) {
      setError(
        getErrorMessage(
          requestError,
          'El borrador todavía no pudo enviarse a cocina.',
        ),
      )
    } finally {
      setSaving(false)
    }
  }

  async function handleSendDraft(order) {
    clearMessages()

    try {
      setOrderActionId(`send-${order.id}`)

      const updatedOrder = await sendOrderRequest(order.id)
      replaceOrder(updatedOrder)
      setSuccess(`${updatedOrder.orderCode} fue enviada a cocina.`)
    } catch (requestError) {
      setError(
        getErrorMessage(
          requestError,
          'No se pudo enviar la orden a cocina.',
        ),
      )
    } finally {
      setOrderActionId('')
    }
  }

  async function handleDeliverItem(order, item) {
    clearMessages()

    try {
      setOrderActionId(`item-${item.id}`)

      const updatedOrder = await updateOrderItemStatusRequest(
        order.id,
        item.id,
        'DELIVERED',
      )

      replaceOrder(updatedOrder)
      setSuccess(`${item.itemName} marcado como entregado.`)
    } catch (requestError) {
      setError(
        getErrorMessage(
          requestError,
          'No se pudo marcar el producto como entregado.',
        ),
      )
    } finally {
      setOrderActionId('')
    }
  }

  async function handleDeliverAll(order) {
    const readyItems = getReadyItems(order)

    if (readyItems.length === 0) return

    clearMessages()
    let deliveredCount = 0

    try {
      setOrderActionId(`all-${order.id}`)

      let latestOrder = order

      for (const item of readyItems) {
        latestOrder = await updateOrderItemStatusRequest(
          order.id,
          item.id,
          'DELIVERED',
        )
        deliveredCount += 1
      }

      replaceOrder(latestOrder)
      setSuccess(
        `${deliveredCount} producto(s) de ${order.orderCode} marcados como entregados.`,
      )
    } catch (requestError) {
      await loadOrders({ silent: true })

      setError(
        getErrorMessage(
          requestError,
          deliveredCount > 0
            ? `Se entregaron ${deliveredCount} producto(s), pero la operación no pudo completarse.`
            : 'No se pudo completar la entrega.',
        ),
      )
    } finally {
      setOrderActionId('')
    }
  }

  function replaceOrder(updatedOrder) {
    setOrders((current) =>
      current.map((order) =>
        String(order.id) === String(updatedOrder.id)
          ? updatedOrder
          : order,
      ),
    )

    setSelectedOrder((current) =>
      current && String(current.id) === String(updatedOrder.id)
        ? updatedOrder
        : current,
    )
  }

  function resetOrder({ clearMessage = true } = {}) {
    setOrderForm(createInitialOrderForm())
    setCart([])
    setStep(1)
    setProductSearch('')
    setActiveCategory('all')
    setPendingDraft(null)
    setCompletedOrder(null)

    if (clearMessage) clearMessages()

    scrollToTop()
  }

  function clearMessages() {
    setError('')
    setSuccess('')
  }

  if (loadingData || shiftState === 'loading' || !activeArea) {
    return (
      <main className="waiter-page waiter-centered-page">
        <section className="waiter-status-card">
          <span className="waiter-spinner" />
          <h1>Cargando jornada</h1>
          <p>Estamos preparando tus órdenes y el estado del restaurante.</p>
        </section>
      </main>
    )
  }

  if (shiftState === 'ended' && requiresShiftBeforeAccess) {
    return (
      <main className="waiter-page waiter-centered-page">
        <section className="waiter-status-card waiter-status-success">
          <span className="waiter-status-icon">✓</span>
          <span className="waiter-eyebrow">Jornada finalizada</span>
          <h1>Turno cerrado</h1>
          <p>
            Tu turno fue registrado correctamente. Ya puedes cerrar sesión.
          </p>

          {success && <div className="waiter-alert success">{success}</div>}

          <button
            type="button"
            className="waiter-primary-button"
            onClick={logout}
          >
            Cerrar sesión
          </button>
        </section>
      </main>
    )
  }

  if (requiresShiftBeforeAccess && !openShift) {
    return (
      <main className="waiter-page waiter-centered-page">
        <section className="waiter-status-card">
          <span className="waiter-status-icon">⏱</span>
          <span className="waiter-eyebrow">Inicio de jornada</span>
          <h1>Abre tu turno</h1>
          <p>
            Hola, {getUserName(user)}. Abre tu turno para comenzar a atender.
          </p>

          <div className="waiter-shift-start-summary">
            <span>Usuario</span>
            <strong>{getUserName(user)}</strong>
            <small>{formatDateTime(new Date())}</small>
          </div>

          {error && <div className="waiter-alert error">{error}</div>}
          {success && <div className="waiter-alert success">{success}</div>}

          <button
            type="button"
            className="waiter-primary-button waiter-start-shift-button"
            onClick={handleOpenShift}
            disabled={saving}
          >
            {saving ? 'Abriendo turno...' : 'Abrir turno'}
          </button>

          <button
            type="button"
            className="waiter-text-button"
            onClick={logout}
            disabled={saving}
          >
            Cerrar sesión
          </button>
        </section>
      </main>
    )
  }

  return (
    <main className="waiter-page">
      <header className="waiter-hero">
        <div>
          <span className="waiter-eyebrow">
            {canSuperviseOrders ? 'Órdenes · Supervisión' : 'Órdenes · Mesero'}
          </span>
          <h1>Hola, {getUserName(user)}</h1>
          <p>
            {activeArea === 'create'
              ? 'Registra la orden paso a paso y envíala directamente a cocina.'
              : 'Revisa qué órdenes necesitan atención y qué productos ya puedes entregar.'}
          </p>

          {openShift ? (
            <div className="waiter-shift-pill">
              <span className="waiter-live-dot" />
              Turno abierto desde {formatTime(openShift.startedAt)}
              <strong>· {openShift.ordersCount ?? 0} orden(es)</strong>
            </div>
          ) : canSuperviseOrders ? (
            <div className="waiter-supervision-pill">
              Supervisando sin turno abierto
            </div>
          ) : null}
        </div>

        <div className="waiter-hero-actions">
          {canSuperviseOrders && (
            <Link to="/dashboard" className="waiter-dashboard-button">
              Volver al dashboard
            </Link>
          )}

          {openShift && canTakeOrders && (
            <button
              type="button"
              className="waiter-close-shift-button"
              onClick={() => {
                clearMessages()
                setShowClosePanel(true)
              }}
            >
              Finalizar turno
            </button>
          )}

          <button
            type="button"
            className="waiter-logout-button"
            onClick={logout}
          >
            Cerrar sesión
          </button>
        </div>
      </header>

      <nav className="waiter-main-tabs" aria-label="Órdenes">
        {canTakeOrders && (
          <button
            type="button"
            className={activeArea === 'create' ? 'active' : ''}
            onClick={() => handleAreaChange('create')}
          >
            <span aria-hidden="true">＋</span>
            <div>
              <strong>Tomar orden</strong>
              <small>Crear y enviar a cocina</small>
            </div>
          </button>
        )}

        <button
          type="button"
          className={activeArea === 'manage' ? 'active' : ''}
          onClick={() => handleAreaChange('manage')}
        >
          <span aria-hidden="true">🍽️</span>
          <div>
            <strong>
              {canSuperviseOrders ? 'Órdenes' : 'Mis órdenes'}
            </strong>
            <small>
              {canSuperviseOrders
                ? 'Supervisar y entregar'
                : 'Pendientes y entregadas'}
            </small>
          </div>
        </button>
      </nav>

      {error && <div className="waiter-alert error">{error}</div>}
      {success && <div className="waiter-alert success">{success}</div>}

      {showClosePanel && (
        <section className="waiter-close-panel">
          <div>
            <span className="waiter-eyebrow">Finalizar jornada</span>
            <h2>¿Deseas cerrar el turno?</h2>

            {myBlockingOrders.length > 0 ? (
              <p className="waiter-close-warning">
                Tienes {myBlockingOrders.length} orden(es) pendientes. Deben
                quedar entregadas antes de cerrar.
              </p>
            ) : (
              <p>No aparecen órdenes pendientes asociadas a tu usuario.</p>
            )}
          </div>

          <form onSubmit={handleCloseShift}>
            <label>
              Nota de cierre opcional
              <input
                type="text"
                value={closeShiftNotes}
                onChange={(event) => setCloseShiftNotes(event.target.value)}
                maxLength={255}
                placeholder="Observación final"
              />
            </label>

            <div className="waiter-inline-actions">
              <button
                type="button"
                className="waiter-secondary-button"
                onClick={() => setShowClosePanel(false)}
                disabled={saving}
              >
                Volver
              </button>

              <button
                type="submit"
                className="waiter-danger-button"
                disabled={saving}
              >
                {saving ? 'Cerrando...' : 'Cerrar turno'}
              </button>
            </div>
          </form>
        </section>
      )}

      {activeArea === 'create' && (
        <CreateOrderArea
          openShift={openShift}
          canTakeOrders={canTakeOrders}
          saving={saving}
          step={step}
          setStep={setStep}
          completedOrder={completedOrder}
          resetOrder={resetOrder}
          setActiveArea={setActiveArea}
          orderForm={orderForm}
          handleChannelChange={handleChannelChange}
          handleOrderFieldChange={handleOrderFieldChange}
          activeTables={activeTables}
          checkedInStays={checkedInStays}
          continueFromDestination={continueFromDestination}
          productSearch={productSearch}
          setProductSearch={setProductSearch}
          categories={categories}
          activeCategory={activeCategory}
          setActiveCategory={setActiveCategory}
          filteredMenuItems={filteredMenuItems}
          addProduct={addProduct}
          cart={cart}
          totalQuantity={totalQuantity}
          cartTotal={cartTotal}
          removeCartItem={removeCartItem}
          updateCartQuantity={updateCartQuantity}
          updateCartNotes={updateCartNotes}
          continueToReview={continueToReview}
          selectedTable={selectedTable}
          selectedStay={selectedStay}
          pendingDraft={pendingDraft}
          handleRetrySend={handleRetrySend}
          handleCreateAndSendOrder={handleCreateAndSendOrder}
          handleOpenShift={handleOpenShift}
        />
      )}

      {activeArea === 'manage' && (
        <ManageOrdersArea
          canSuperviseOrders={canSuperviseOrders}
          user={user}
          orderScope={orderScope}
          setOrderScope={(nextScope) => {
            setOrderScope(nextScope)
            setWaiterFilter('all')
          }}
          managementFilter={managementFilter}
          setManagementFilter={setManagementFilter}
          managementSearch={managementSearch}
          setManagementSearch={setManagementSearch}
          waiterFilter={waiterFilter}
          setWaiterFilter={setWaiterFilter}
          waiterOptions={waiterOptions}
          filteredOrders={filteredOrders}
          attentionOrders={attentionOrders}
          loadingOrders={loadingOrders}
          orderActionId={orderActionId}
          onOpenDetail={setSelectedOrder}
          onDeliverItem={handleDeliverItem}
          onDeliverAll={handleDeliverAll}
          onSendDraft={handleSendDraft}
        />
      )}

      {selectedOrder && (
        <OrderDetailModal
          order={selectedOrder}
          orderActionId={orderActionId}
          onClose={() => setSelectedOrder(null)}
          onDeliverItem={handleDeliverItem}
          onDeliverAll={handleDeliverAll}
        />
      )}
    </main>
  )
}

function CreateOrderArea({
  openShift,
  canTakeOrders,
  saving,
  step,
  setStep,
  completedOrder,
  resetOrder,
  setActiveArea,
  orderForm,
  handleChannelChange,
  handleOrderFieldChange,
  activeTables,
  checkedInStays,
  continueFromDestination,
  productSearch,
  setProductSearch,
  categories,
  activeCategory,
  setActiveCategory,
  filteredMenuItems,
  addProduct,
  cart,
  totalQuantity,
  cartTotal,
  removeCartItem,
  updateCartQuantity,
  updateCartNotes,
  continueToReview,
  selectedTable,
  selectedStay,
  pendingDraft,
  handleRetrySend,
  handleCreateAndSendOrder,
  handleOpenShift,
}) {
  if (!canTakeOrders) {
    return (
      <section className="waiter-card waiter-empty-workspace">
        <span aria-hidden="true">👁️</span>
        <h2>Vista de supervisión</h2>
        <p>Tu cuenta puede consultar órdenes, pero no tomar una nueva.</p>
      </section>
    )
  }

  if (!openShift) {
    return (
      <section className="waiter-card waiter-open-shift-inline">
        <span className="waiter-status-icon">⏱</span>
        <span className="waiter-eyebrow">Ayudar como mesero</span>
        <h2>Abre tu turno para tomar una orden</h2>
        <p>
          Puedes seguir supervisando sin turno. Solo necesitas abrirlo cuando
          vayas a atender personalmente.
        </p>

        <button
          type="button"
          className="waiter-primary-button"
          onClick={handleOpenShift}
          disabled={saving}
        >
          {saving ? 'Abriendo turno...' : 'Abrir mi turno'}
        </button>
      </section>
    )
  }

  if (completedOrder) {
    return (
      <section className="waiter-complete-card">
        <span className="waiter-status-icon">✓</span>
        <span className="waiter-eyebrow">Orden enviada</span>
        <h2>{completedOrder.orderCode}</h2>
        <p>
          La orden ya está visible en las estaciones de cocina
          correspondientes.
        </p>

        <div className="waiter-complete-summary">
          <span>{getChannelLabel(completedOrder.channel)}</span>
          <span>
            {completedOrder.summary?.totalQuantity ?? totalQuantity} producto(s)
          </span>
          <strong>
            {formatMoney(completedOrder.summary?.subtotal ?? cartTotal)}
          </strong>
        </div>

        <div className="waiter-complete-actions">
          <button
            type="button"
            className="waiter-secondary-button"
            onClick={() => setActiveArea('manage')}
          >
            Ver órdenes
          </button>

          <button
            type="button"
            className="waiter-primary-button"
            onClick={() => resetOrder()}
          >
            Crear nueva orden
          </button>
        </div>
      </section>
    )
  }

  return (
    <>
      <nav className="waiter-steps" aria-label="Pasos de la orden">
        {steps.map((currentStep) => (
          <button
            type="button"
            key={currentStep.id}
            className={`waiter-step ${
              step === currentStep.id ? 'active' : ''
            } ${step > currentStep.id ? 'complete' : ''}`}
            onClick={() => {
              if (currentStep.id < step) {
                setStep(currentStep.id)
              }
            }}
          >
            <span>{step > currentStep.id ? '✓' : currentStep.id}</span>
            {currentStep.label}
          </button>
        ))}
      </nav>

      <section className="waiter-workspace">
        {step === 1 && (
          <section className="waiter-card">
            <div className="waiter-section-heading">
              <span>Paso 1</span>
              <h2>¿A dónde va la orden?</h2>
              <p>Selecciona el tipo de servicio y su destino.</p>
            </div>

            <div className="waiter-channel-grid">
              {channelOptions.map((channel) => (
                <button
                  type="button"
                  key={channel.value}
                  className={`waiter-channel-card ${
                    orderForm.channel === channel.value ? 'selected' : ''
                  }`}
                  onClick={() => handleChannelChange(channel.value)}
                >
                  <span>{channel.icon}</span>
                  <strong>{channel.label}</strong>
                  <small>{channel.helper}</small>
                </button>
              ))}
            </div>

            <div className="waiter-form-grid">
              <label>
                Nombre del cliente
                <input
                  type="text"
                  name="customerName"
                  value={orderForm.customerName}
                  onChange={handleOrderFieldChange}
                  maxLength={160}
                  placeholder="Opcional"
                />
              </label>

              {orderForm.channel === 'DINE_IN' && (
                <label>
                  Mesa
                  <select
                    name="tableId"
                    value={orderForm.tableId}
                    onChange={handleOrderFieldChange}
                    required
                  >
                    <option value="">Selecciona una mesa</option>
                    {activeTables.map((table) => (
                      <option key={table.id} value={table.id}>
                        {table.code}
                        {table.name ? ` · ${table.name}` : ''}
                        {table.capacity
                          ? ` · ${table.capacity} personas`
                          : ''}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              {orderForm.channel === 'ROOM_CHARGE' && (
                <label>
                  Estadía activa
                  <select
                    name="stayId"
                    value={orderForm.stayId}
                    onChange={handleOrderFieldChange}
                    required
                  >
                    <option value="">Selecciona una estadía</option>
                    {checkedInStays.map((stay) => (
                      <option key={stay.id} value={stay.id}>
                        Cabaña {stay.cabin?.cabinNumber} ·{' '}
                        {stay.primaryGuest?.fullName}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>

            <label className="waiter-full-field">
              Nota general
              <textarea
                name="notes"
                value={orderForm.notes}
                onChange={handleOrderFieldChange}
                maxLength={500}
                rows={3}
                placeholder="Observaciones generales de la orden"
              />
            </label>

            <div className="waiter-bottom-actions">
              <span />
              <button
                type="button"
                className="waiter-primary-button"
                onClick={continueFromDestination}
              >
                Continuar a productos
              </button>
            </div>
          </section>
        )}

        {step === 2 && (
          <section className="waiter-products-layout">
            <article className="waiter-card">
              <div className="waiter-section-heading">
                <span>Paso 2</span>
                <h2>Agrega los productos</h2>
                <p>Toca un producto para sumarlo rápidamente.</p>
              </div>

              <div className="waiter-product-toolbar">
                <input
                  type="search"
                  value={productSearch}
                  onChange={(event) => setProductSearch(event.target.value)}
                  placeholder="Buscar producto..."
                />

                <select
                  value={activeCategory}
                  onChange={(event) => setActiveCategory(event.target.value)}
                >
                  <option value="all">Todas las categorías</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>

              {filteredMenuItems.length > 0 ? (
                <div className="waiter-product-grid">
                  {filteredMenuItems.map((item) => (
                    <button
                      type="button"
                      className="waiter-product-card"
                      key={item.id}
                      onClick={() => addProduct(item)}
                    >
                      <div>
                        <strong>{item.name}</strong>
                        <small>{item.station?.name || 'Restaurante'}</small>
                      </div>
                      <span>{formatMoney(item.basePrice)}</span>
                      <b>Agregar +</b>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="waiter-empty-state">
                  No hay productos disponibles con este filtro.
                </div>
              )}
            </article>

            <aside className="waiter-cart-card">
              <div className="waiter-cart-heading">
                <div>
                  <span>Orden actual</span>
                  <strong>{totalQuantity} producto(s)</strong>
                </div>
                <strong>{formatMoney(cartTotal)}</strong>
              </div>

              {cart.length > 0 ? (
                <div className="waiter-cart-list">
                  {cart.map((line) => (
                    <article
                      className="waiter-cart-line"
                      key={line.localId}
                    >
                      <div className="waiter-cart-line-header">
                        <div>
                          <strong>{line.name}</strong>
                          <small>{formatMoney(line.unitPrice)} c/u</small>
                        </div>

                        <button
                          type="button"
                          onClick={() => removeCartItem(line.localId)}
                          aria-label={`Quitar ${line.name}`}
                        >
                          ×
                        </button>
                      </div>

                      <div className="waiter-cart-controls">
                        <button
                          type="button"
                          onClick={() =>
                            line.quantity > 1
                              ? updateCartQuantity(
                                  line.localId,
                                  line.quantity - 1,
                                )
                              : removeCartItem(line.localId)
                          }
                        >
                          −
                        </button>

                        <input
                          type="number"
                          min="1"
                          max="999"
                          value={line.quantity}
                          onChange={(event) =>
                            updateCartQuantity(
                              line.localId,
                              event.target.value,
                            )
                          }
                        />

                        <button
                          type="button"
                          onClick={() =>
                            updateCartQuantity(
                              line.localId,
                              Number(line.quantity) + 1,
                            )
                          }
                        >
                          +
                        </button>

                        <strong>
                          {formatMoney(
                            Number(line.unitPrice) *
                              Number(line.quantity),
                          )}
                        </strong>
                      </div>

                      <input
                        type="text"
                        value={line.itemNotes}
                        onChange={(event) =>
                          updateCartNotes(
                            line.localId,
                            event.target.value,
                          )
                        }
                        maxLength={255}
                        placeholder="Nota: sin cebolla, poco hielo..."
                      />
                    </article>
                  ))}
                </div>
              ) : (
                <div className="waiter-empty-state compact">
                  Toca un producto para comenzar.
                </div>
              )}

              <div className="waiter-cart-footer">
                <button
                  type="button"
                  className="waiter-secondary-button"
                  onClick={() => setStep(1)}
                >
                  Atrás
                </button>

                <button
                  type="button"
                  className="waiter-primary-button"
                  onClick={continueToReview}
                  disabled={cart.length === 0}
                >
                  Revisar orden
                </button>
              </div>
            </aside>
          </section>
        )}

        {step === 3 && (
          <section className="waiter-review-layout">
            <article className="waiter-card">
              <div className="waiter-section-heading">
                <span>Paso 3</span>
                <h2>Revisa antes de enviar</h2>
                <p>Confirma el destino, los productos y las notas.</p>
              </div>

              <div className="waiter-review-context">
                <div>
                  <span>Cliente</span>
                  <strong>{orderForm.customerName || 'Sin nombre'}</strong>
                </div>

                <div>
                  <span>Servicio</span>
                  <strong>{getChannelLabel(orderForm.channel)}</strong>
                </div>

                <div>
                  <span>Destino</span>
                  <strong>
                    {orderForm.channel === 'DINE_IN'
                      ? selectedTable?.code || 'Mesa sin seleccionar'
                      : orderForm.channel === 'ROOM_CHARGE'
                        ? `Cabaña ${
                            selectedStay?.cabin?.cabinNumber ?? ''
                          }`
                        : 'Entrega al cliente'}
                  </strong>
                </div>

                <div>
                  <span>Turno</span>
                  <strong>Desde {formatTime(openShift.startedAt)}</strong>
                </div>
              </div>

              {orderForm.notes && (
                <div className="waiter-review-note">
                  <span>Nota general</span>
                  <p>{orderForm.notes}</p>
                </div>
              )}

              <div className="waiter-review-lines">
                {cart.map((line) => (
                  <article key={line.localId}>
                    <div>
                      <strong>
                        {line.quantity} × {line.name}
                      </strong>
                      {line.itemNotes && <small>{line.itemNotes}</small>}
                    </div>

                    <strong>
                      {formatMoney(
                        Number(line.unitPrice) * Number(line.quantity),
                      )}
                    </strong>
                  </article>
                ))}
              </div>

              <div className="waiter-review-total">
                <span>Total estimado</span>
                <strong>{formatMoney(cartTotal)}</strong>
              </div>

              {pendingDraft && (
                <div className="waiter-draft-warning">
                  <strong>
                    {pendingDraft.orderCode} quedó como borrador.
                  </strong>
                  <p>
                    No crees otra orden. Reintenta el envío a cocina.
                  </p>
                </div>
              )}

              <div className="waiter-bottom-actions">
                <button
                  type="button"
                  className="waiter-secondary-button"
                  onClick={() => setStep(2)}
                  disabled={saving || Boolean(pendingDraft)}
                >
                  Volver a productos
                </button>

                {pendingDraft ? (
                  <button
                    type="button"
                    className="waiter-primary-button"
                    onClick={handleRetrySend}
                    disabled={saving}
                  >
                    {saving ? 'Reintentando...' : 'Reintentar envío'}
                  </button>
                ) : (
                  <button
                    type="button"
                    className="waiter-primary-button waiter-send-button"
                    onClick={handleCreateAndSendOrder}
                    disabled={saving}
                  >
                    {saving ? 'Enviando...' : 'Enviar a cocina'}
                  </button>
                )}
              </div>
            </article>
          </section>
        )}
      </section>
    </>
  )
}

function ManageOrdersArea({
  canSuperviseOrders,
  user,
  orderScope,
  setOrderScope,
  managementFilter,
  setManagementFilter,
  managementSearch,
  setManagementSearch,
  waiterFilter,
  setWaiterFilter,
  waiterOptions,
  filteredOrders,
  attentionOrders,
  loadingOrders,
  orderActionId,
  onOpenDetail,
  onDeliverItem,
  onDeliverAll,
  onSendDraft,
}) {
  return (
    <section className="waiter-management">
      {attentionOrders.length > 0 && (
        <section className="waiter-attention-section">
          <div className="waiter-management-heading">
            <div>
              <span className="waiter-eyebrow">Necesitan atención</span>
              <h2>Órdenes demoradas</h2>
              <p>
                Se muestran cuando una preparación o entrega supera el tiempo
                esperado.
              </p>
            </div>
          </div>

          <div className="waiter-alert-cards">
            {attentionOrders.slice(0, 6).map(({ order, alert }) => (
              <article
                className={`waiter-delay-card ${alert.level}`}
                key={order.id}
              >
                <div>
                  <span>{order.orderCode}</span>
                  <strong>{alert.label}</strong>
                  <small>{getOrderDestination(order)}</small>
                </div>

                <b>{alert.minutes} min</b>

                <button
                  type="button"
                  onClick={() => onOpenDetail(order)}
                >
                  Ver orden
                </button>
              </article>
            ))}
          </div>
        </section>
      )}

      <section className="waiter-card waiter-management-card">
        <div className="waiter-management-heading">
          <div>
            <span className="waiter-eyebrow">
              {canSuperviseOrders ? 'Supervisión' : 'Mi trabajo'}
            </span>
            <h2>
              {canSuperviseOrders ? 'Órdenes del restaurante' : 'Mis órdenes'}
            </h2>
            <p>
              Revisa primero las que están listas y marca la entrega cuando
              corresponda.
            </p>
          </div>

          <div className="waiter-sync-note">
            <span className="waiter-live-dot" />
            Actualización automática
          </div>
        </div>

        {canSuperviseOrders && (
          <div className="waiter-scope-switch">
            <button
              type="button"
              className={orderScope === 'all' ? 'active' : ''}
              onClick={() => setOrderScope('all')}
            >
              Todas
            </button>
            <button
              type="button"
              className={orderScope === 'mine' ? 'active' : ''}
              onClick={() => setOrderScope('mine')}
            >
              Mías
            </button>
          </div>
        )}

        <div className="waiter-management-filters">
          <label className="waiter-search-field">
            Buscar
            <input
              type="search"
              value={managementSearch}
              onChange={(event) => setManagementSearch(event.target.value)}
              placeholder="Orden, cliente, mesa..."
            />
          </label>

          {canSuperviseOrders && orderScope === 'all' && (
            <label>
              Mesero
              <select
                value={waiterFilter}
                onChange={(event) => setWaiterFilter(event.target.value)}
              >
                <option value="all">Todos</option>
                {waiterOptions.map((waiter) => (
                  <option key={waiter.id} value={waiter.id}>
                    {getUserName(waiter)}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>

        <div className="waiter-status-filters">
          {managementFilters.map((filter) => (
            <button
              type="button"
              key={filter.id}
              className={managementFilter === filter.id ? 'active' : ''}
              onClick={() => setManagementFilter(filter.id)}
            >
              {filter.label}
            </button>
          ))}
        </div>

        {loadingOrders ? (
          <div className="waiter-empty-state">
            Cargando órdenes...
          </div>
        ) : filteredOrders.length > 0 ? (
          <div className="waiter-order-grid">
            {filteredOrders.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                currentUserId={user?.id}
                canSuperviseOrders={canSuperviseOrders}
                orderActionId={orderActionId}
                onOpenDetail={onOpenDetail}
                onDeliverItem={onDeliverItem}
                onDeliverAll={onDeliverAll}
                onSendDraft={onSendDraft}
              />
            ))}
          </div>
        ) : (
          <div className="waiter-empty-state">
            No hay órdenes que coincidan con estos filtros.
          </div>
        )}
      </section>
    </section>
  )
}

function OrderCard({
  order,
  currentUserId,
  canSuperviseOrders,
  orderActionId,
  onOpenDetail,
  onDeliverItem,
  onDeliverAll,
  onSendDraft,
}) {
  const readyItems = getReadyItems(order)
  const deliveredItems = order.items?.filter(
    (item) => item.itemStatus === 'DELIVERED',
  ) ?? []

  const isMine =
    String(order.waiter?.id) === String(currentUserId)

  const canOperateDelivery = canSuperviseOrders || isMine
  const isBusy =
    orderActionId === `all-${order.id}` ||
    orderActionId === `send-${order.id}`

  return (
    <article className={`waiter-order-card status-${order.status.toLowerCase()}`}>
      <div className="waiter-order-card-top">
        <div>
          <span>{order.orderCode}</span>
          <strong>{getOrderDestination(order)}</strong>
          <small>
            {order.customerName || 'Cliente sin nombre'}
          </small>
        </div>

        <OrderStatusBadge status={order.status} />
      </div>

      <div className="waiter-order-meta">
        <span>
          <small>Mesero</small>
          <strong>{getUserName(order.waiter)}</strong>
        </span>

        <span>
          <small>Creada</small>
          <strong>{formatTime(order.createdAt)}</strong>
        </span>

        <span>
          <small>Productos</small>
          <strong>{order.summary?.totalQuantity ?? 0}</strong>
        </span>

        <span>
          <small>Total</small>
          <strong>{formatMoney(order.summary?.subtotal ?? 0)}</strong>
        </span>
      </div>

      <div className="waiter-order-progress">
        <span>
          <b>{readyItems.length}</b>
          listos
        </span>
        <span>
          <b>{deliveredItems.length}</b>
          entregados
        </span>
      </div>

      {readyItems.length > 0 && canOperateDelivery && (
        <div className="waiter-ready-items">
          <div className="waiter-ready-items-heading">
            <strong>Listos para entregar</strong>
            {readyItems.length > 1 && (
              <button
                type="button"
                className="waiter-deliver-all-button"
                onClick={() => onDeliverAll(order)}
                disabled={isBusy}
              >
                {isBusy ? 'Entregando...' : 'Entregar todo'}
              </button>
            )}
          </div>

          {readyItems.slice(0, 3).map((item) => (
            <div className="waiter-ready-line" key={item.id}>
              <span>
                <strong>
                  {item.quantity} × {item.itemName}
                </strong>
                <small>{item.station?.name}</small>
              </span>

              <button
                type="button"
                onClick={() => onDeliverItem(order, item)}
                disabled={
                  isBusy ||
                  orderActionId === `item-${item.id}`
                }
              >
                {orderActionId === `item-${item.id}`
                  ? 'Entregando...'
                  : 'Entregar'}
              </button>
            </div>
          ))}

          {readyItems.length > 3 && (
            <small className="waiter-more-ready">
              + {readyItems.length - 3} producto(s) listo(s)
            </small>
          )}
        </div>
      )}

      {order.status === 'DRAFT' && (canSuperviseOrders || isMine) && (
        <div className="waiter-draft-card-note">
          <span>Borrador pendiente de envío</span>
          <button
            type="button"
            onClick={() => onSendDraft(order)}
            disabled={isBusy}
          >
            {isBusy ? 'Enviando...' : 'Enviar a cocina'}
          </button>
        </div>
      )}

      {order.status === 'DELIVERED' && (
        <div className="waiter-billing-ready-note">
          ✓ Entregada · lista para facturación
        </div>
      )}

      <div className="waiter-order-card-actions">
        <button
          type="button"
          className="waiter-secondary-button"
          onClick={() => onOpenDetail(order)}
        >
          Ver detalle
        </button>
      </div>
    </article>
  )
}

function OrderDetailModal({
  order,
  orderActionId,
  onClose,
  onDeliverItem,
  onDeliverAll,
}) {
  const readyItems = getReadyItems(order)
  const allBusy = orderActionId === `all-${order.id}`

  return (
    <div
      className="waiter-modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !orderActionId) {
          onClose()
        }
      }}
    >
      <section
        className="waiter-order-modal"
        role="dialog"
        aria-modal="true"
        aria-label={`Detalle de ${order.orderCode}`}
      >
        <header>
          <div>
            <span className="waiter-eyebrow">Detalle de orden</span>
            <h2>{order.orderCode}</h2>
            <p>
              {getOrderDestination(order)} · {getUserName(order.waiter)}
            </p>
          </div>

          <button
            type="button"
            className="waiter-modal-close"
            onClick={onClose}
            disabled={Boolean(orderActionId)}
            aria-label="Cerrar"
          >
            ×
          </button>
        </header>

        <div className="waiter-order-modal-body">
          <div className="waiter-order-modal-summary">
            <OrderStatusBadge status={order.status} />
            <strong>{formatMoney(order.summary?.subtotal ?? 0)}</strong>
          </div>

          {order.notes && (
            <div className="waiter-order-note">
              <span>Nota general</span>
              <p>{order.notes}</p>
            </div>
          )}

          <div className="waiter-modal-items-heading">
            <div>
              <strong>Productos</strong>
              <small>
                {order.summary?.totalQuantity ?? 0} en total
              </small>
            </div>

            {readyItems.length > 1 && (
              <button
                type="button"
                className="waiter-deliver-all-button"
                onClick={() => onDeliverAll(order)}
                disabled={allBusy}
              >
                {allBusy ? 'Entregando...' : 'Entregar todo'}
              </button>
            )}
          </div>

          <div className="waiter-modal-items">
            {order.items?.map((item) => (
              <article key={item.id}>
                <div>
                  <strong>
                    {item.quantity} × {item.itemName}
                  </strong>
                  <small>
                    {item.station?.name || 'Sin estación'}
                    {item.itemNotes ? ` · ${item.itemNotes}` : ''}
                  </small>
                </div>

                <div className="waiter-modal-item-action">
                  <ItemStatusBadge status={item.itemStatus} />

                  {item.itemStatus === 'READY' && (
                    <button
                      type="button"
                      onClick={() => onDeliverItem(order, item)}
                      disabled={
                        allBusy ||
                        orderActionId === `item-${item.id}`
                      }
                    >
                      {orderActionId === `item-${item.id}`
                        ? 'Entregando...'
                        : 'Entregar'}
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}

function OrderStatusBadge({ status }) {
  return (
    <span className={`waiter-order-status ${status.toLowerCase()}`}>
      {getOrderStatusLabel(status)}
    </span>
  )
}

function ItemStatusBadge({ status }) {
  return (
    <span className={`waiter-item-status ${status.toLowerCase()}`}>
      {getItemStatusLabel(status)}
    </span>
  )
}

function getReadyItems(order) {
  return (
    order.items?.filter((item) => item.itemStatus === 'READY') ?? []
  )
}

function getOrderDelayAlert(order, now) {
  if (['SENT', 'IN_PROGRESS'].includes(order.status) && order.sentAt) {
    const minutes = minutesSince(order.sentAt, now)

    if (minutes >= WARNING_MINUTES) {
      return {
        minutes,
        level: minutes >= CRITICAL_MINUTES ? 'critical' : 'warning',
        label:
          order.status === 'SENT'
            ? 'Esperando preparación'
            : 'En preparación',
      }
    }
  }

  if (order.status === 'READY') {
    const readyDates =
      order.items
        ?.filter(
          (item) =>
            item.itemStatus === 'READY' &&
            item.readyAt,
        )
        .map((item) => new Date(item.readyAt).getTime())
        .filter((value) => Number.isFinite(value)) ?? []

    if (readyDates.length > 0) {
      const oldestReadyAt = Math.min(...readyDates)
      const minutes = Math.max(
        0,
        Math.floor((now - oldestReadyAt) / 60_000),
      )

      if (minutes >= WARNING_MINUTES) {
        return {
          minutes,
          level: minutes >= CRITICAL_MINUTES ? 'critical' : 'warning',
          label: 'Esperando entrega',
        }
      }
    }
  }

  return null
}

function compareOrdersForManagement(a, b) {
  const priority = {
    READY: 0,
    IN_PROGRESS: 1,
    SENT: 2,
    DRAFT: 3,
    DELIVERED: 4,
    CLOSED: 5,
    CANCELLED: 6,
  }

  const priorityDiff =
    (priority[a.status] ?? 99) - (priority[b.status] ?? 99)

  if (priorityDiff !== 0) return priorityDiff

  return new Date(b.createdAt) - new Date(a.createdAt)
}

function minutesSince(value, now) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 0

  return Math.max(0, Math.floor((now - date.getTime()) / 60_000))
}

function normalizeList(payload, key) {
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.[key])) return payload[key]
  if (Array.isArray(payload?.items)) return payload.items
  if (Array.isArray(payload?.data)) return payload.data
  return []
}

function getUserName(currentUser) {
  if (!currentUser) return 'Sin asignar'

  return (
    currentUser.fullName ||
    `${currentUser.firstName ?? ''} ${currentUser.lastName ?? ''}`.trim() ||
    currentUser.username ||
    'Usuario'
  )
}

function getOrderDestination(order) {
  if (order.channel === 'DINE_IN') {
    return order.table?.code
      ? `Mesa ${order.table.code}`
      : 'Mesa'
  }

  if (order.channel === 'ROOM_CHARGE') {
    return order.stay?.cabin?.cabinNumber
      ? `Cabaña ${order.stay.cabin.cabinNumber}`
      : 'Habitación'
  }

  return 'Para llevar'
}

function getChannelLabel(channel) {
  const labels = {
    DINE_IN: 'Mesa',
    TAKE_AWAY: 'Para llevar',
    ROOM_CHARGE: 'Habitación',
  }

  return labels[channel] || channel
}

function getOrderStatusLabel(status) {
  const labels = {
    DRAFT: 'Borrador',
    SENT: 'Enviada',
    IN_PROGRESS: 'En preparación',
    READY: 'Lista',
    DELIVERED: 'Entregada',
    CLOSED: 'Cerrada',
    CANCELLED: 'Cancelada',
  }

  return labels[status] || status
}

function getItemStatusLabel(status) {
  const labels = {
    PENDING: 'Pendiente',
    IN_PROGRESS: 'En preparación',
    READY: 'Listo',
    DELIVERED: 'Entregado',
    CANCELLED: 'Cancelado',
  }

  return labels[status] || status
}

function formatMoney(value) {
  const amount = Number(value)

  if (Number.isNaN(amount)) return `C$ ${value}`

  return new Intl.NumberFormat('es-NI', {
    style: 'currency',
    currency: 'NIO',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

function formatTime(value) {
  if (!value) return '—'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'

  return new Intl.DateTimeFormat('es-NI', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(date)
}

function formatDateTime(value) {
  const date = value instanceof Date ? value : new Date(value)

  if (Number.isNaN(date.getTime())) return '—'

  return new Intl.DateTimeFormat('es-NI', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

function createLocalId() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID()
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function removeUndefinedValues(payload) {
  return Object.fromEntries(
    Object.entries(payload).filter(([, value]) => value !== undefined),
  )
}

function getErrorMessage(error, fallback) {
  return (
    error?.response?.data?.message ||
    error?.response?.data?.error ||
    error?.message ||
    fallback
  )
}

function scrollToTop() {
  window.scrollTo({
    top: 0,
    behavior: 'smooth',
  })
}