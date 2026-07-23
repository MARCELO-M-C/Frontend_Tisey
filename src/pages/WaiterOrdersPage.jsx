import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../auth/AuthContext'
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
  sendOrderRequest,
} from '../services/ordersService'
import './WaiterOrdersPage.css'

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

  const [openShift, setOpenShift] = useState(null)
  const [shiftState, setShiftState] = useState('loading')
  const [openShiftNotes, setOpenShiftNotes] = useState('')
  const [closeShiftNotes, setCloseShiftNotes] = useState('')
  const [showClosePanel, setShowClosePanel] = useState(false)

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

  const [loadingData, setLoadingData] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    loadInitialData()
  }, [user?.id])

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

  const cartTotal = useMemo(() => {
    return cart.reduce(
      (total, line) =>
        total + Number(line.unitPrice) * Number(line.quantity),
      0,
    )
  }, [cart])

  const totalQuantity = useMemo(() => {
    return cart.reduce(
      (total, line) => total + Number(line.quantity),
      0,
    )
  }, [cart])

  async function loadInitialData() {
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
      ] = await Promise.all([
        getShiftsRequest({
          userId: user.id,
          isOpen: 'true',
        }),
        getMenuItemsRequest({ isActive: true }),
        getRestaurantTablesRequest({ isActive: true }),
        getStaysRequest({ status: 'CHECKED_IN' }),
      ])

      const shifts = normalizeList(shiftsPayload, 'shifts')
      const currentShift = shifts.find((shift) => shift.isOpen) ?? null

      setOpenShift(currentShift)
      setShiftState(currentShift ? 'open' : 'closed')
      setMenuItems(normalizeList(menuPayload, 'items'))
      setTables(normalizeList(tablesPayload, 'tables'))
      setStays(normalizeList(staysPayload, 'stays'))
    } catch (requestError) {
      setShiftState('error')
      setError(
        getErrorMessage(
          requestError,
          'No se pudo cargar la información del turno y las órdenes.',
        ),
      )
    } finally {
      setLoadingData(false)
    }
  }

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

  async function handleOpenShift(event) {
    event.preventDefault()
    clearMessages()

    try {
      setSaving(true)

      const payload = openShiftNotes.trim()
        ? { notes: openShiftNotes.trim() }
        : {}

      const createdShift = await createShiftRequest(payload)

      setOpenShift(createdShift)
      setShiftState('open')
      setOpenShiftNotes('')
      setSuccess('Turno abierto correctamente. Ya puedes crear órdenes.')
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
      resetOrder()
      setSuccess('Turno cerrado correctamente. Ya puedes cerrar sesión.')
    } catch (requestError) {
      setError(
        getErrorMessage(
          requestError,
          'No se pudo cerrar el turno. Revisa si aún existen órdenes abiertas.',
        ),
      )
    } finally {
      setSaving(false)
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
      setError('Necesitas un turno abierto para enviar una orden.')
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
        await refreshCurrentShift()
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
      await refreshCurrentShift()
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

  function resetOrder() {
    setOrderForm(createInitialOrderForm())
    setCart([])
    setStep(1)
    setProductSearch('')
    setActiveCategory('all')
    setPendingDraft(null)
    setCompletedOrder(null)
    clearMessages()
    scrollToTop()
  }

  function clearMessages() {
    setError('')
    setSuccess('')
  }

  const selectedTable = activeTables.find(
    (table) => String(table.id) === String(orderForm.tableId),
  )

  const selectedStay = checkedInStays.find(
    (stay) => String(stay.id) === String(orderForm.stayId),
  )

  if (loadingData || shiftState === 'loading') {
    return (
      <main className="waiter-page waiter-centered-page">
        <section className="waiter-status-card">
          <span className="waiter-spinner" />
          <h1>Cargando jornada</h1>
          <p>Estamos recuperando tu turno y los datos del restaurante.</p>
        </section>
      </main>
    )
  }

  if (shiftState === 'ended') {
    return (
      <main className="waiter-page waiter-centered-page">
        <section className="waiter-status-card waiter-status-success">
          <span className="waiter-status-icon">✓</span>
          <span className="waiter-eyebrow">Jornada finalizada</span>
          <h1>Turno cerrado</h1>
          <p>
            El turno fue registrado correctamente. Ahora puedes cerrar tu
            sesión de forma segura.
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

  if (!openShift) {
    return (
      <main className="waiter-page waiter-centered-page">
        <section className="waiter-status-card">
          <span className="waiter-status-icon">⏱</span>
          <span className="waiter-eyebrow">Inicio de jornada</span>
          <h1>Abre tu turno</h1>
          <p>
            Hola, {getUserName(user)}. Necesitas abrir un turno antes de
            comenzar a registrar órdenes.
          </p>

          {error && <div className="waiter-alert error">{error}</div>}
          {success && <div className="waiter-alert success">{success}</div>}

          <form className="waiter-shift-form" onSubmit={handleOpenShift}>
            <label>
              Nota inicial opcional
              <textarea
                value={openShiftNotes}
                onChange={(event) => setOpenShiftNotes(event.target.value)}
                maxLength={255}
                rows={3}
                placeholder="Ej: Inicio de turno de la tarde"
              />
            </label>

            <button
              type="submit"
              className="waiter-primary-button"
              disabled={saving}
            >
              {saving ? 'Abriendo turno...' : 'Abrir turno y comenzar'}
            </button>
          </form>

          <button
            type="button"
            className="waiter-text-button"
            onClick={logout}
            disabled={saving}
          >
            Volver al inicio de sesión
          </button>
        </section>
      </main>
    )
  }

  return (
    <main className="waiter-page">
      <header className="waiter-hero">
        <div>
          <span className="waiter-eyebrow">Órdenes · Mesero</span>
          <h1>Hola, {getUserName(user)}</h1>
          <p>
            Registra la orden paso a paso y envíala directamente a cocina.
          </p>

          <div className="waiter-shift-pill">
            <span className="waiter-live-dot" />
            Turno abierto desde {formatTime(openShift.startedAt)}
            <strong>· {openShift.ordersCount ?? 0} orden(es)</strong>
          </div>
        </div>

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
      </header>

      {error && <div className="waiter-alert error">{error}</div>}
      {success && <div className="waiter-alert success">{success}</div>}

      {showClosePanel && (
        <section className="waiter-close-panel">
          <div>
            <span className="waiter-eyebrow">Finalizar jornada</span>
            <h2>¿Deseas cerrar el turno?</h2>
            <p>
              El backend impedirá el cierre si todavía tienes órdenes abiertas.
            </p>
          </div>

          <form onSubmit={handleCloseShift}>
            <label>
              Nota de cierre opcional
              <input
                type="text"
                value={closeShiftNotes}
                onChange={(event) => setCloseShiftNotes(event.target.value)}
                maxLength={255}
                placeholder="Ej: Jornada completada sin incidencias"
              />
            </label>

            <div className="waiter-inline-actions">
              <button
                type="button"
                className="waiter-secondary-button"
                onClick={() => setShowClosePanel(false)}
                disabled={saving}
              >
                Volver al trabajo
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

      {!completedOrder && (
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
                  clearMessages()
                  setStep(currentStep.id)
                }
              }}
            >
              <span>{step > currentStep.id ? '✓' : currentStep.id}</span>
              {currentStep.label}
            </button>
          ))}
        </nav>
      )}

      {completedOrder ? (
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
            <span>{completedOrder.summary?.totalQuantity ?? totalQuantity} producto(s)</span>
            <strong>{formatMoney(completedOrder.summary?.subtotal ?? cartTotal)}</strong>
          </div>

          <button
            type="button"
            className="waiter-primary-button"
            onClick={resetOrder}
          >
            Crear nueva orden
          </button>
        </section>
      ) : (
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
                          {table.capacity ? ` · ${table.capacity} personas` : ''}
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
                    placeholder="Buscar producto"
                  />

                  <div className="waiter-category-scroll">
                    <button
                      type="button"
                      className={activeCategory === 'all' ? 'active' : ''}
                      onClick={() => setActiveCategory('all')}
                    >
                      Todos
                    </button>

                    {categories.map((category) => (
                      <button
                        type="button"
                        key={category.id}
                        className={activeCategory === category.id ? 'active' : ''}
                        onClick={() => setActiveCategory(category.id)}
                      >
                        {category.name}
                      </button>
                    ))}
                  </div>
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
                      <article className="waiter-cart-line" key={line.localId}>
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
                              Number(line.unitPrice) * Number(line.quantity),
                            )}
                          </strong>
                        </div>

                        <input
                          type="text"
                          value={line.itemNotes}
                          onChange={(event) =>
                            updateCartNotes(line.localId, event.target.value)
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
                          ? `Cabaña ${selectedStay?.cabin?.cabinNumber ?? ''}`
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
                    <strong>{pendingDraft.orderCode} quedó como borrador.</strong>
                    <p>
                      No crees otra orden. Usa el botón de reintento para
                      enviarla a cocina.
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
      )}
    </main>
  )
}

function normalizeList(payload, key) {
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.[key])) return payload[key]
  if (Array.isArray(payload?.items)) return payload.items
  if (Array.isArray(payload?.data)) return payload.data
  return []
}

function createLocalId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function removeUndefinedValues(payload) {
  return Object.fromEntries(
    Object.entries(payload).filter(([, value]) => value !== undefined),
  )
}

function getUserName(user) {
  if (!user) return 'Mesero'

  return (
    user.fullName ||
    `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() ||
    user.username ||
    'Mesero'
  )
}

function getChannelLabel(channel) {
  const labels = {
    DINE_IN: 'Servicio en mesa',
    TAKE_AWAY: 'Para llevar',
    ROOM_CHARGE: 'Cargo a habitación',
  }

  return labels[channel] || channel
}

function formatMoney(value) {
  const amount = Number(value)

  if (Number.isNaN(amount)) return `C$ ${value}`

  return new Intl.NumberFormat('es-NI', {
    style: 'currency',
    currency: 'NIO',
  }).format(amount)
}

function formatTime(value) {
  if (!value) return 'hora desconocida'

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) return value

  return new Intl.DateTimeFormat('es-NI', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(date)
}

function scrollToTop() {
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

function getErrorMessage(error, fallback) {
  return (
    error?.response?.data?.message ||
    error?.response?.data?.error ||
    error?.response?.data?.details?.[0]?.message ||
    error?.message ||
    fallback
  )
}
