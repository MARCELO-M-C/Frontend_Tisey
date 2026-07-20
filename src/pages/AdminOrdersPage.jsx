import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { useAuth } from '../auth/AuthContext'
import { getUsersRequest } from '../services/accessService'
import { getMenuItemsRequest } from '../services/menuService'
import { getRestaurantTablesRequest } from '../services/restaurantTablesService'
import { getShiftsRequest } from '../services/operationsService'
import { getStaysRequest } from '../services/lodgingService'
import {
  addOrderItemsRequest,
  cancelOrderRequest,
  createOrderRequest,
  getOrdersRequest,
  sendOrderRequest,
  updateOrderItemStatusRequest,
  updateOrderRequest,
} from '../services/ordersService'
import './AdminOrdersPage.css'

const orderTabs = [
  {
    id: 'create',
    label: 'Nueva orden',
    helper: 'Crea borradores y agrega productos antes de enviar a cocina.',
  },
  {
    id: 'manage',
    label: 'Gestión',
    helper: 'Consulta, envía, cancela y actualiza el flujo de cada orden.',
  },
]

const orderStatuses = [
  { value: 'DRAFT', label: 'Borrador' },
  { value: 'SENT', label: 'Enviada' },
  { value: 'IN_PROGRESS', label: 'En preparación' },
  { value: 'READY', label: 'Lista' },
  { value: 'DELIVERED', label: 'Entregada' },
  { value: 'CLOSED', label: 'Cerrada' },
  { value: 'CANCELLED', label: 'Cancelada' },
]

const orderChannels = [
  { value: 'DINE_IN', label: 'Servicio en mesa' },
  { value: 'TAKE_AWAY', label: 'Para llevar' },
  { value: 'ROOM_CHARGE', label: 'Cargo a habitación' },
]

function createInitialOrderForm() {
  return {
    id: '',
    channel: 'DINE_IN',
    serviceMode: 'EAT_HERE',
    tableId: '',
    stayId: '',
    waiterId: '',
    shiftId: '',
    notes: '',
  }
}

const initialCartItem = {
  menuItemId: '',
  quantity: '1',
  itemNotes: '',
}

export default function AdminOrdersPage() {
  const { user, logout } = useAuth()

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [activeTab, setActiveTab] = useState('create')

  const [orders, setOrders] = useState([])
  const [menuItems, setMenuItems] = useState([])
  const [tables, setTables] = useState([])
  const [shifts, setShifts] = useState([])
  const [stays, setStays] = useState([])
  const [users, setUsers] = useState([])

  const [orderForm, setOrderForm] = useState(createInitialOrderForm)
  const [cartItem, setCartItem] = useState(initialCartItem)
  const [cart, setCart] = useState([])

  const [expandedOrderId, setExpandedOrderId] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [channelFilter, setChannelFilter] = useState('all')

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    loadOrdersData()
  }, [])

  const activeTabData = orderTabs.find((tab) => tab.id === activeTab)

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

  const activeUsers = useMemo(
    () => users.filter((currentUser) => currentUser.isActive),
    [users],
  )

  const openShifts = useMemo(() => {
    return shifts.filter((shift) => {
      if (!shift.isOpen) return false

      if (!orderForm.waiterId) return true

      return String(shift.user?.id) === String(orderForm.waiterId)
    })
  }, [shifts, orderForm.waiterId])

  const filteredOrders = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase()

    return orders.filter((order) => {
      const orderCode = String(order.orderCode ?? '').toLowerCase()
      const waiterName = String(
        order.waiter?.fullName ??
          order.createdBy?.fullName ??
          order.waiter?.username ??
          '',
      ).toLowerCase()

      const tableCode = String(order.table?.code ?? '').toLowerCase()
      const guestName = String(
        order.stay?.primaryGuest?.fullName ?? '',
      ).toLowerCase()

      const matchesSearch =
        !normalizedSearch ||
        orderCode.includes(normalizedSearch) ||
        waiterName.includes(normalizedSearch) ||
        tableCode.includes(normalizedSearch) ||
        guestName.includes(normalizedSearch)

      const matchesStatus =
        statusFilter === 'all' || order.status === statusFilter

      const matchesChannel =
        channelFilter === 'all' || order.channel === channelFilter

      return matchesSearch && matchesStatus && matchesChannel
    })
  }, [orders, search, statusFilter, channelFilter])

  const stats = useMemo(() => {
    return {
      drafts: orders.filter((order) => order.status === 'DRAFT').length,

      kitchen: orders.filter((order) =>
        ['SENT', 'IN_PROGRESS'].includes(order.status),
      ).length,

      ready: orders.filter((order) => order.status === 'READY').length,

      delivered: orders.filter((order) =>
        ['DELIVERED', 'CLOSED'].includes(order.status),
      ).length,
    }
  }, [orders])

  const cartSubtotal = useMemo(() => {
    return cart.reduce((total, line) => {
      return total + Number(line.unitPrice) * Number(line.quantity)
    }, 0)
  }, [cart])

  async function loadOrdersData() {
    try {
      setLoading(true)
      setError('')

      const [
        ordersPayload,
        menuPayload,
        tablesPayload,
        shiftsPayload,
        staysPayload,
        usersPayload,
      ] = await Promise.all([
        getOrdersRequest(),
        getMenuItemsRequest(),
        getRestaurantTablesRequest(),
        getShiftsRequest(),
        getStaysRequest(),
        getUsersRequest(),
      ])

      setOrders(normalizeList(ordersPayload, 'orders'))
      setMenuItems(normalizeList(menuPayload, 'items'))
      setTables(normalizeList(tablesPayload, 'tables'))
      setShifts(normalizeList(shiftsPayload, 'shifts'))
      setStays(normalizeList(staysPayload, 'stays'))
      setUsers(normalizeList(usersPayload, 'users'))
    } catch (requestError) {
      setError(
        getErrorMessage(
          requestError,
          'No se pudo cargar la información de órdenes.',
        ),
      )
    } finally {
      setLoading(false)
    }
  }

  function clearMessages() {
    setError('')
    setSuccess('')
  }

  function handleTabChange(tabId) {
    clearMessages()
    setActiveTab(tabId)
    setDrawerOpen(false)
  }

  function handleOrderFieldChange(event) {
    const { name, value } = event.target

    if (name === 'channel') {
      const nextServiceMode =
        value === 'TAKE_AWAY' ? 'TO_GO' : 'EAT_HERE'

      setOrderForm((current) => ({
        ...current,
        channel: value,
        serviceMode: nextServiceMode,
        tableId: value === 'DINE_IN' ? current.tableId : '',
        stayId: value === 'ROOM_CHARGE' ? current.stayId : '',
      }))

      return
    }

    if (name === 'waiterId') {
      setOrderForm((current) => {
        const currentShift = shifts.find(
          (shift) => String(shift.id) === String(current.shiftId),
        )

        const shiftMatchesWaiter =
          !currentShift ||
          !value ||
          String(currentShift.user?.id) === String(value)

        return {
          ...current,
          waiterId: value,
          shiftId: shiftMatchesWaiter ? current.shiftId : '',
        }
      })

      return
    }

    if (name === 'shiftId') {
      const selectedShift = shifts.find(
        (shift) => String(shift.id) === String(value),
      )

      setOrderForm((current) => ({
        ...current,
        shiftId: value,
        waiterId: selectedShift?.user?.id ?? current.waiterId,
      }))

      return
    }

    setOrderForm((current) => ({
      ...current,
      [name]: value,
    }))
  }

  function handleCartFieldChange(event) {
    const { name, value } = event.target

    setCartItem((current) => ({
      ...current,
      [name]: value,
    }))
  }

  function addItemToCart() {
    clearMessages()

    const menuItem = activeMenuItems.find(
      (item) => String(item.id) === String(cartItem.menuItemId),
    )

    const quantity = Number(cartItem.quantity)
    const itemNotes = cartItem.itemNotes.trim()

    if (!menuItem) {
      setError('Selecciona un producto del menú.')
      return
    }

    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 999) {
      setError('La cantidad debe ser un entero entre 1 y 999.')
      return
    }

    setCart((current) => [
      ...current,
      {
        localId: crypto.randomUUID(),
        menuItemId: String(menuItem.id),
        name: menuItem.name,
        unitPrice: menuItem.basePrice,
        quantity,
        itemNotes,
        stationName: menuItem.station?.name || 'Sin estación',
      },
    ])

    setCartItem(initialCartItem)
  }

  function removeCartItem(localId) {
    setCart((current) =>
      current.filter((line) => line.localId !== localId),
    )
  }

  function startCreateOrder() {
    clearMessages()
    setOrderForm(createInitialOrderForm())
    setCart([])
    setCartItem(initialCartItem)
    setActiveTab('create')
    scrollToTop()
  }

  function startEditOrder(order) {
    clearMessages()

    if (order.status !== 'DRAFT') {
      setError('Solo las órdenes en borrador pueden editarse.')
      return
    }

    setOrderForm({
      id: order.id,
      channel: order.channel,
      serviceMode: order.serviceMode,
      tableId: order.table?.id ?? '',
      stayId: order.stay?.id ?? '',
      waiterId: order.waiter?.id ?? '',
      shiftId: order.shift?.id ?? '',
      notes: order.notes ?? '',
    })

    setCart([])
    setCartItem(initialCartItem)
    setActiveTab('create')
    scrollToTop()
  }

  async function handleSaveOrder(sendAfterSave = false) {
    clearMessages()

    const isEditing = Boolean(orderForm.id)

    if (orderForm.channel === 'DINE_IN' && !orderForm.tableId) {
      setError('Las órdenes de mesa requieren una mesa.')
      return
    }

    if (orderForm.channel === 'ROOM_CHARGE' && !orderForm.stayId) {
      setError('El cargo a habitación requiere una estadía activa.')
      return
    }

    if (!isEditing && cart.length === 0) {
      setError('Agrega al menos un producto a la orden.')
      return
    }

    const headerPayload = {
      channel: orderForm.channel,
      serviceMode: orderForm.serviceMode,
      tableId:
        orderForm.channel === 'DINE_IN'
          ? Number(orderForm.tableId)
          : null,
      stayId:
        orderForm.channel === 'ROOM_CHARGE'
          ? Number(orderForm.stayId)
          : null,
      waiterId: orderForm.waiterId
        ? Number(orderForm.waiterId)
        : null,
      shiftId: orderForm.shiftId
        ? Number(orderForm.shiftId)
        : null,
      notes: orderForm.notes.trim() || null,
    }

    const itemsPayload = cart.map((line) => ({
      menuItemId: Number(line.menuItemId),
      quantity: Number(line.quantity),
      ...(line.itemNotes
        ? {
            itemNotes: line.itemNotes,
          }
        : {}),
    }))

    try {
      setSaving(true)

      let savedOrder

      if (isEditing) {
        savedOrder = await updateOrderRequest(
          orderForm.id,
          headerPayload,
        )

        if (itemsPayload.length > 0) {
          savedOrder = await addOrderItemsRequest(
            orderForm.id,
            itemsPayload,
          )
        }
      } else {
        savedOrder = await createOrderRequest({
          ...removeNullValues(headerPayload),
          items: itemsPayload,
        })
      }

      if (sendAfterSave) {
        await sendOrderRequest(savedOrder.id)

        setSuccess(
          isEditing
            ? 'Orden actualizada y enviada a cocina.'
            : 'Orden creada y enviada a cocina.',
        )
      } else {
        setSuccess(
          isEditing
            ? 'Borrador actualizado correctamente.'
            : 'Orden guardada como borrador.',
        )
      }

      setOrderForm(createInitialOrderForm())
      setCart([])
      setCartItem(initialCartItem)
      setActiveTab('manage')

      await loadOrdersData()
    } catch (requestError) {
      setError(
        getErrorMessage(
          requestError,
          'No se pudo guardar la orden.',
        ),
      )
    } finally {
      setSaving(false)
    }
  }

  async function handleSendOrder(order) {
    clearMessages()

    const confirmed = window.confirm(
      `¿Deseas enviar ${order.orderCode} a cocina? Después no podrás editar su cabecera ni agregar productos.`,
    )

    if (!confirmed) return

    try {
      setSaving(true)

      await sendOrderRequest(order.id)
      setSuccess('Orden enviada a cocina correctamente.')

      await loadOrdersData()
    } catch (requestError) {
      setError(
        getErrorMessage(
          requestError,
          'No se pudo enviar la orden.',
        ),
      )
    } finally {
      setSaving(false)
    }
  }

  async function handleCancelOrder(order) {
    clearMessages()

    const reason = window.prompt(
      `Indica el motivo de cancelación de ${order.orderCode}:`,
    )

    if (reason === null) return

    const normalizedReason = reason.trim()

    if (!normalizedReason) {
      setError('Debes indicar un motivo de cancelación.')
      return
    }

    if (normalizedReason.length > 255) {
      setError('El motivo no puede superar 255 caracteres.')
      return
    }

    try {
      setSaving(true)

      await cancelOrderRequest(order.id, normalizedReason)
      setSuccess('Orden cancelada correctamente.')

      await loadOrdersData()
    } catch (requestError) {
      setError(
        getErrorMessage(
          requestError,
          'No se pudo cancelar la orden.',
        ),
      )
    } finally {
      setSaving(false)
    }
  }

  async function handleItemStatusChange(order, item, nextStatus) {
    clearMessages()

    try {
      setSaving(true)

      await updateOrderItemStatusRequest(
        order.id,
        item.id,
        nextStatus,
      )

      setSuccess(
        `Ítem actualizado a ${getItemStatusLabel(nextStatus)}.`,
      )

      await loadOrdersData()
    } catch (requestError) {
      setError(
        getErrorMessage(
          requestError,
          'No se pudo cambiar el estado del ítem.',
        ),
      )
    } finally {
      setSaving(false)
    }
  }

  const editingOrder = orders.find(
    (order) => String(order.id) === String(orderForm.id),
  )

  return (
    <main className="orders-page">
      <section className="orders-hero">
        <div>
          <span className="orders-eyebrow">Restaurante</span>

          <h1>Gestión de Órdenes</h1>

          <p>
            Crea órdenes, envíalas a cocina y supervisa el avance
            de cada producto desde una sola vista administrativa.
          </p>

          <small className="orders-session">
            Sesión:{' '}
            {user?.fullName ||
              user?.username ||
              'Administrador'}
          </small>
        </div>

        <div className="orders-hero-actions">
          <Link
            to="/dashboard"
            className="btn orders-secondary-button"
          >
            Volver al dashboard
          </Link>

          <button
            type="button"
            className="btn orders-logout"
            onClick={logout}
          >
            Cerrar sesión
          </button>
        </div>
      </section>

      <section className="orders-layout">
        <aside
          className={`orders-sidebar ${
            drawerOpen ? 'is-open' : ''
          }`}
        >
          <div className="orders-sidebar-header">
            <strong>Menú admin</strong>

            <button
              type="button"
              className="orders-menu-close"
              onClick={() => setDrawerOpen(false)}
              aria-label="Cerrar menú"
            >
              ×
            </button>
          </div>

          <Link className="orders-menu-link" to="/admin/access">
            <span>Usuarios</span>
            <small>Usuarios y accesos</small>
          </Link>

          <button
            type="button"
            className="orders-menu-item is-active"
          >
            <span>Órdenes</span>
            <small>Gestión del restaurante</small>
          </button>

          <Link
            className="orders-menu-link"
            to="/admin/restaurant-tables"
          >
            <span>Mesas</span>
            <small>Mesas del restaurante</small>
          </Link>

          <Link className="orders-menu-link" to="/admin/menu">
            <span>Menú</span>
            <small>Productos y categorías</small>
          </Link>

          <Link
            className="orders-menu-link"
            to="/admin/operations"
          >
            <span>Operación</span>
            <small>Turnos y estaciones</small>
          </Link>

          <Link
            className="orders-menu-link"
            to="/admin/lodging"
          >
            <span>Hospedaje</span>
            <small>Cabañas y estadías</small>
          </Link>

          <button
            type="button"
            className="orders-menu-item"
            disabled
          >
            <span>Facturación</span>
            <small>Próximo módulo</small>
          </button>
        </aside>

        {drawerOpen && (
          <button
            type="button"
            className="orders-drawer-backdrop"
            onClick={() => setDrawerOpen(false)}
            aria-label="Cerrar menú administrativo"
          />
        )}

        <section className="orders-content">
          <div className="orders-toolbar">
            <button
              type="button"
              className="orders-menu-button"
              onClick={() => setDrawerOpen(true)}
            >
              ☰ Menú
            </button>

            <div>
              <span>Restaurante</span>
              <strong>Gestión de órdenes</strong>
            </div>
          </div>

          <section className="orders-card orders-title-card">
            <div className="orders-section-header">
              <div>
                <h2>{activeTabData?.label}</h2>
                <p>{activeTabData?.helper}</p>
              </div>

              <button
                type="button"
                className="orders-small-button"
                onClick={loadOrdersData}
                disabled={loading || saving}
              >
                Actualizar
              </button>
            </div>

            <div className="orders-tabs">
              {orderTabs.map((tab) => (
                <button
                  type="button"
                  className={`orders-tab ${
                    activeTab === tab.id ? 'is-active' : ''
                  }`}
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id)}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </section>

          {error && (
            <section className="orders-alert orders-alert-error">
              {error}
            </section>
          )}

          {success && (
            <section className="orders-alert orders-alert-success">
              {success}
            </section>
          )}

          <section className="orders-stats-grid">
            <article className="orders-stat">
              <span>Borradores</span>
              <strong>{loading ? '...' : stats.drafts}</strong>
              <small>Pendientes de enviar</small>
            </article>

            <article className="orders-stat stat-warning">
              <span>En cocina</span>
              <strong>{loading ? '...' : stats.kitchen}</strong>
              <small>Enviadas o en preparación</small>
            </article>

            <article className="orders-stat stat-success">
              <span>Listas</span>
              <strong>{loading ? '...' : stats.ready}</strong>
              <small>Pendientes de entregar</small>
            </article>

            <article className="orders-stat stat-danger">
              <span>Entregadas</span>
              <strong>{loading ? '...' : stats.delivered}</strong>
              <small>Disponibles para facturación</small>
            </article>
          </section>

          {activeTab === 'create' && (
            <section className="orders-create-grid">
              <article className="orders-card">
                <div className="orders-section-header">
                  <div>
                    <h2>
                      {orderForm.id
                        ? `Editar ${editingOrder?.orderCode || 'borrador'}`
                        : 'Datos de la orden'}
                    </h2>

                    <p>
                      Selecciona el tipo de servicio y su contexto.
                    </p>
                  </div>
                </div>

                <form
                  className="orders-form"
                  onSubmit={(event) => {
                    event.preventDefault()
                    handleSaveOrder(false)
                  }}
                >
                  <label>
                    Canal
                    <select
                      name="channel"
                      value={orderForm.channel}
                      onChange={handleOrderFieldChange}
                    >
                      {orderChannels.map((channel) => (
                        <option
                          key={channel.value}
                          value={channel.value}
                        >
                          {channel.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label>
                    Modalidad
                    <select
                      name="serviceMode"
                      value={orderForm.serviceMode}
                      onChange={handleOrderFieldChange}
                      disabled={
                        orderForm.channel === 'DINE_IN' ||
                        orderForm.channel === 'TAKE_AWAY'
                      }
                    >
                      <option value="EAT_HERE">
                        Consumir en el lugar
                      </option>

                      <option value="TO_GO">
                        Para llevar
                      </option>
                    </select>
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
                        <option value="">
                          Selecciona una mesa
                        </option>

                        {activeTables.map((table) => (
                          <option
                            key={table.id}
                            value={table.id}
                          >
                            {table.code}
                            {table.name
                              ? ` - ${table.name}`
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
                        <option value="">
                          Selecciona una estadía
                        </option>

                        {checkedInStays.map((stay) => (
                          <option
                            key={stay.id}
                            value={stay.id}
                          >
                            Cabaña {stay.cabin?.cabinNumber}
                            {' - '}
                            {stay.primaryGuest?.fullName}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}

                  <div className="orders-form-grid">
                    <label>
                      Mesero
                      <select
                        name="waiterId"
                        value={orderForm.waiterId}
                        onChange={handleOrderFieldChange}
                      >
                        <option value="">
                          Sin mesero asignado
                        </option>

                        {activeUsers.map((currentUser) => (
                          <option
                            key={currentUser.id}
                            value={currentUser.id}
                          >
                            {getUserName(currentUser)}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label>
                      Turno
                      <select
                        name="shiftId"
                        value={orderForm.shiftId}
                        onChange={handleOrderFieldChange}
                      >
                        <option value="">
                          Sin turno asignado
                        </option>

                        {openShifts.map((shift) => (
                          <option
                            key={shift.id}
                            value={shift.id}
                          >
                            {getUserName(shift.user)}
                            {' · '}
                            {formatDateTime(shift.startedAt)}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <label>
                    Notas generales
                    <textarea
                      name="notes"
                      value={orderForm.notes}
                      onChange={handleOrderFieldChange}
                      placeholder="Observaciones de la orden"
                      maxLength={500}
                      rows={4}
                    />
                  </label>

                  {orderForm.id && (
                    <div className="orders-existing-lines">
                      <strong>Productos actuales</strong>

                      {(editingOrder?.items ?? []).map((item) => (
                        <div key={item.id}>
                          <span>
                            {item.quantity} × {item.itemName}
                          </span>

                          <small>
                            {formatMoney(item.lineTotal)}
                          </small>
                        </div>
                      ))}

                      <p>
                        Los productos existentes no pueden eliminarse
                        ni cambiar de cantidad con la API actual.
                        Puedes agregar líneas nuevas mientras siga
                        en borrador.
                      </p>
                    </div>
                  )}

                  <div className="orders-form-actions">
                    <button
                      type="submit"
                      className="orders-primary-button"
                      disabled={saving}
                    >
                      {saving
                        ? 'Guardando...'
                        : orderForm.id
                          ? 'Guardar cambios'
                          : 'Guardar borrador'}
                    </button>

                    <button
                      type="button"
                      className="orders-send-button"
                      onClick={() => handleSaveOrder(true)}
                      disabled={saving}
                    >
                      Guardar y enviar
                    </button>

                    {orderForm.id && (
                      <button
                        type="button"
                        className="orders-small-button"
                        onClick={startCreateOrder}
                        disabled={saving}
                      >
                        Cancelar edición
                      </button>
                    )}
                  </div>
                </form>
              </article>

              <article className="orders-card">
                <div className="orders-section-header">
                  <div>
                    <h2>Productos</h2>
                    <p>
                      Agrega los productos que formarán la orden.
                    </p>
                  </div>
                </div>

                <div className="orders-product-form">
                  <label>
                    Producto
                    <select
                      name="menuItemId"
                      value={cartItem.menuItemId}
                      onChange={handleCartFieldChange}
                    >
                      <option value="">
                        Selecciona un producto
                      </option>

                      {activeMenuItems.map((item) => (
                        <option
                          key={item.id}
                          value={item.id}
                        >
                          {item.name}
                          {' · '}
                          {formatMoney(item.basePrice)}
                          {' · '}
                          {item.station?.name || 'Sin estación'}
                        </option>
                      ))}
                    </select>
                  </label>

                  <div className="orders-form-grid">
                    <label>
                      Cantidad
                      <input
                        type="number"
                        name="quantity"
                        value={cartItem.quantity}
                        onChange={handleCartFieldChange}
                        min="1"
                        max="999"
                      />
                    </label>

                    <label>
                      Nota del producto
                      <input
                        type="text"
                        name="itemNotes"
                        value={cartItem.itemNotes}
                        onChange={handleCartFieldChange}
                        placeholder="Ej: sin cebolla"
                        maxLength={255}
                      />
                    </label>
                  </div>

                  <button
                    type="button"
                    className="orders-add-button"
                    onClick={addItemToCart}
                  >
                    Agregar producto
                  </button>
                </div>

                {cart.length > 0 ? (
                  <div className="orders-cart">
                    {cart.map((line) => (
                      <div
                        className="orders-cart-line"
                        key={line.localId}
                      >
                        <div>
                          <strong>{line.name}</strong>

                          <p>
                            {line.quantity} ×{' '}
                            {formatMoney(line.unitPrice)}
                            {' · '}
                            {line.stationName}
                          </p>

                          {line.itemNotes && (
                            <small>{line.itemNotes}</small>
                          )}
                        </div>

                        <div>
                          <strong>
                            {formatMoney(
                              Number(line.unitPrice) *
                                Number(line.quantity),
                            )}
                          </strong>

                          <button
                            type="button"
                            onClick={() =>
                              removeCartItem(line.localId)
                            }
                          >
                            Quitar
                          </button>
                        </div>
                      </div>
                    ))}

                    <div className="orders-cart-total">
                      <span>Subtotal agregado</span>
                      <strong>{formatMoney(cartSubtotal)}</strong>
                    </div>
                  </div>
                ) : (
                  <div className="orders-empty-state">
                    Todavía no has agregado productos.
                  </div>
                )}
              </article>
            </section>
          )}

          {activeTab === 'manage' && (
            <section className="orders-card">
              <div className="orders-section-header">
                <div>
                  <h2>Listado de órdenes</h2>

                  <p>
                    Consulta y administra el flujo de las órdenes.
                  </p>
                </div>

                <button
                  type="button"
                  className="orders-primary-button"
                  onClick={startCreateOrder}
                >
                  Nueva orden
                </button>
              </div>

              <div className="orders-filters">
                <label>
                  Buscar
                  <input
                    type="search"
                    value={search}
                    onChange={(event) =>
                      setSearch(event.target.value)
                    }
                    placeholder="Código, mesero, mesa o huésped"
                  />
                </label>

                <label>
                  Estado
                  <select
                    value={statusFilter}
                    onChange={(event) =>
                      setStatusFilter(event.target.value)
                    }
                  >
                    <option value="all">Todos</option>

                    {orderStatuses.map((status) => (
                      <option
                        key={status.value}
                        value={status.value}
                      >
                        {status.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  Canal
                  <select
                    value={channelFilter}
                    onChange={(event) =>
                      setChannelFilter(event.target.value)
                    }
                  >
                    <option value="all">Todos</option>

                    {orderChannels.map((channel) => (
                      <option
                        key={channel.value}
                        value={channel.value}
                      >
                        {channel.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {loading ? (
                <div className="orders-empty-state">
                  Cargando órdenes...
                </div>
              ) : filteredOrders.length > 0 ? (
                <div className="orders-list">
                  {filteredOrders.map((order) => {
                    const isExpanded =
                      String(expandedOrderId) === String(order.id)

                    return (
                      <article
                        className="orders-order-card"
                        key={order.id}
                      >
                        <div className="orders-order-summary">
                          <div>
                            <strong>{order.orderCode}</strong>

                            <p>
                              {getChannelLabel(order.channel)}
                              {' · '}
                              {getOrderContext(order)}
                            </p>

                            <p>
                              {getOrderUser(order)}
                              {' · '}
                              {formatDateTime(order.createdAt)}
                            </p>

                            <div className="orders-badges">
                              <span
                                className={getOrderStatusClass(
                                  order.status,
                                )}
                              >
                                {getOrderStatusLabel(order.status)}
                              </span>

                              <span>
                                {order.summary?.totalQuantity ?? 0}{' '}
                                producto(s)
                              </span>

                              <span>
                                {formatMoney(
                                  order.summary?.subtotal ?? 0,
                                )}
                              </span>
                            </div>
                          </div>

                          <div className="orders-row-actions">
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedOrderId(
                                  isExpanded ? '' : order.id,
                                )
                              }
                            >
                              {isExpanded
                                ? 'Ocultar'
                                : 'Ver detalle'}
                            </button>

                            {order.status === 'DRAFT' && (
                              <>
                                <button
                                  type="button"
                                  onClick={() =>
                                    startEditOrder(order)
                                  }
                                  disabled={saving}
                                >
                                  Editar
                                </button>

                                <button
                                  type="button"
                                  className="success-action"
                                  onClick={() =>
                                    handleSendOrder(order)
                                  }
                                  disabled={saving}
                                >
                                  Enviar
                                </button>
                              </>
                            )}

                            {!['CLOSED', 'CANCELLED'].includes(
                              order.status,
                            ) && (
                              <button
                                type="button"
                                className="danger-action"
                                onClick={() =>
                                  handleCancelOrder(order)
                                }
                                disabled={saving}
                              >
                                Cancelar
                              </button>
                            )}
                          </div>
                        </div>

                        {isExpanded && (
                          <div className="orders-detail">
                            {order.notes && (
                              <div className="orders-note">
                                <strong>Notas</strong>
                                <p>{order.notes}</p>
                              </div>
                            )}

                            <div className="orders-items">
                              {(order.items ?? []).map((item) => (
                                <div
                                  className="orders-item"
                                  key={item.id}
                                >
                                  <div>
                                    <strong>
                                      {item.quantity} ×{' '}
                                      {item.itemName}
                                    </strong>

                                    <p>
                                      {formatMoney(item.lineTotal)}
                                      {' · '}
                                      {item.station?.name}
                                    </p>

                                    {item.itemNotes && (
                                      <small>
                                        {item.itemNotes}
                                      </small>
                                    )}

                                    <div className="orders-badges">
                                      <span
                                        className={getItemStatusClass(
                                          item.itemStatus,
                                        )}
                                      >
                                        {getItemStatusLabel(
                                          item.itemStatus,
                                        )}
                                      </span>
                                    </div>
                                  </div>

                                  <div className="orders-item-actions">
                                    {getNextItemActions(
                                      item.itemStatus,
                                    ).map((action) => (
                                      <button
                                        type="button"
                                        className={
                                          action.status ===
                                          'CANCELLED'
                                            ? 'danger-action'
                                            : ''
                                        }
                                        key={action.status}
                                        onClick={() =>
                                          handleItemStatusChange(
                                            order,
                                            item,
                                            action.status,
                                          )
                                        }
                                        disabled={saving}
                                      >
                                        {action.label}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              ))}
                            </div>

                            {(order.events ?? []).length > 0 && (
                              <details className="orders-events">
                                <summary>
                                  Historial de movimientos
                                </summary>

                                <div>
                                  {order.events.map((event) => (
                                    <p key={event.id}>
                                      <strong>
                                        {event.eventType}
                                      </strong>
                                      {' · '}
                                      {event.newValue ||
                                        'Movimiento registrado'}
                                      {' · '}
                                      {formatDateTime(
                                        event.performedAt,
                                      )}
                                    </p>
                                  ))}
                                </div>
                              </details>
                            )}

                            {order.cancelReason && (
                              <div className="orders-cancel-reason">
                                <strong>Motivo de cancelación</strong>
                                <p>{order.cancelReason}</p>
                              </div>
                            )}
                          </div>
                        )}
                      </article>
                    )
                  })}
                </div>
              ) : (
                <div className="orders-empty-state">
                  No hay órdenes que coincidan con los filtros.
                </div>
              )}
            </section>
          )}
        </section>
      </section>
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

function removeNullValues(payload) {
  return Object.fromEntries(
    Object.entries(payload).filter(
      ([, value]) => value !== null && value !== '',
    ),
  )
}

function getUserName(currentUser) {
  if (!currentUser) return 'Usuario sin nombre'

  return (
    currentUser.fullName ||
    `${currentUser.firstName ?? ''} ${
      currentUser.lastName ?? ''
    }`.trim() ||
    currentUser.username ||
    `Usuario ${currentUser.id}`
  )
}

function getOrderUser(order) {
  return (
    order.waiter?.fullName ||
    order.createdBy?.fullName ||
    order.waiter?.username ||
    order.createdBy?.username ||
    'Sin usuario'
  )
}

function getOrderContext(order) {
  if (order.table) {
    return `Mesa ${order.table.code}`
  }

  if (order.stay) {
    return `Cabaña ${order.stay.cabin?.cabinNumber} · ${
      order.stay.primaryGuest?.fullName
    }`
  }

  return 'Sin mesa ni estadía'
}

function getChannelLabel(channel) {
  const labels = {
    DINE_IN: 'Servicio en mesa',
    TAKE_AWAY: 'Para llevar',
    ROOM_CHARGE: 'Cargo a habitación',
  }

  return labels[channel] || channel
}

function getOrderStatusLabel(status) {
  const labels = {
    DRAFT: 'Borrador',
    SENT: 'Enviada a cocina',
    IN_PROGRESS: 'En preparación',
    READY: 'Lista',
    DELIVERED: 'Entregada',
    CLOSED: 'Cerrada',
    CANCELLED: 'Cancelada',
  }

  return labels[status] || status
}

function getOrderStatusClass(status) {
  const classes = {
    DRAFT: 'badge-neutral',
    SENT: 'badge-info',
    IN_PROGRESS: 'badge-warning',
    READY: 'badge-success',
    DELIVERED: 'badge-success',
    CLOSED: 'badge-neutral',
    CANCELLED: 'badge-danger',
  }

  return classes[status] || 'badge-neutral'
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

function getItemStatusClass(status) {
  const classes = {
    PENDING: 'badge-info',
    IN_PROGRESS: 'badge-warning',
    READY: 'badge-success',
    DELIVERED: 'badge-success',
    CANCELLED: 'badge-danger',
  }

  return classes[status] || 'badge-neutral'
}

function getNextItemActions(status) {
  const actions = {
    PENDING: [
      {
        status: 'IN_PROGRESS',
        label: 'Iniciar',
      },
      {
        status: 'CANCELLED',
        label: 'Cancelar ítem',
      },
    ],

    IN_PROGRESS: [
      {
        status: 'READY',
        label: 'Marcar listo',
      },
      {
        status: 'CANCELLED',
        label: 'Cancelar ítem',
      },
    ],

    READY: [
      {
        status: 'DELIVERED',
        label: 'Entregar',
      },
      {
        status: 'CANCELLED',
        label: 'Cancelar ítem',
      },
    ],

    DELIVERED: [],
    CANCELLED: [],
  }

  return actions[status] || []
}

function formatMoney(value) {
  const amount = Number(value)

  if (Number.isNaN(amount)) {
    return `C$ ${value}`
  }

  return new Intl.NumberFormat('es-NI', {
    style: 'currency',
    currency: 'NIO',
  }).format(amount)
}

function formatDateTime(value) {
  if (!value) return 'Sin fecha'

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) return value

  return new Intl.DateTimeFormat('es-NI', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

function scrollToTop() {
  window.scrollTo({
    top: 0,
    behavior: 'smooth',
  })
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