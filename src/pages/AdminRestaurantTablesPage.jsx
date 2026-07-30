import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router'
import { useAuth } from '../auth/AuthContext'
import { canUsePermission } from '../auth/authHelpers'
import {
  createRestaurantTableRequest,
  getRestaurantTablesRequest,
  updateRestaurantTableRequest,
  updateRestaurantTableStatusRequest,
} from '../services/restaurantTablesService'
import './AdminRestaurantTablesPage.css'

const CURRENT_ROUTE = '/admin/restaurant-tables'

const adminMenuSections = [
  {
    title: 'Administración',
    items: [
      {
        title: 'Usuarios y Accesos',
        description: 'Gestiona usuarios, roles y permisos individuales.',
        to: '/admin/access',
        icon: '🔐',
        permission: 'ADMIN_USERS_MANAGE',
      },
    ],
  },
  {
    title: 'Restaurante',
    items: [
      {
        title: 'Órdenes',
        description: 'Toma, revisa y gestiona órdenes.',
        to: '/admin/orders',
        icon: '🍽️',
        permission: 'ADMIN_ORDERS_MANAGE',
      },
      {
        title: 'Cocina / KDS',
        description: 'Da seguimiento a las órdenes en cocina.',
        to: '/kitchen',
        icon: '👨‍🍳',
        permission: 'ADMIN_KITCHEN_MANAGE',
      },
      {
        title: 'Mesas',
        description: 'Gestiona las mesas del restaurante.',
        to: CURRENT_ROUTE,
        icon: '🪑',
        permission: 'ADMIN_TABLES_MANAGE',
      },
      {
        title: 'Turnos y estaciones',
        description: 'Administra turnos, áreas y estaciones.',
        to: '/admin/operations',
        icon: '🧭',
        permission: 'ADMIN_SHIFTS_&_STATIONS_MANAGE',
      },
    ],
  },
  {
    title: 'Menú',
    items: [
      {
        title: 'Menú del restaurante',
        description: 'Gestiona platillos, categorías y disponibilidad.',
        to: '/admin/menu',
        icon: '📋',
        permission: 'ADMIN_MENU_MANAGE',
      },
    ],
  },
  {
    title: 'Hospedaje',
    items: [
      {
        title: 'Hospedaje',
        description: 'Gestiona cabañas, huéspedes y estadías.',
        to: '/admin/lodging',
        icon: '🏡',
        permission: 'ADMIN_LODGING_MANAGE',
      },
    ],
  },
  {
    title: 'Facturación',
    items: [
      {
        title: 'Facturación',
        description: 'Gestiona facturas, cobros e historial.',
        to: '/billing',
        icon: '🧾',
        permission: 'ADMIN_BILLING_MANAGE',
      },
    ],
  },
]

const initialTableForm = {
  code: '',
  name: '',
  capacity: '',
  isActive: true,
}

export default function AdminRestaurantTablesPage() {
  const { user, logout } = useAuth()
  const menuRef = useRef(null)

  const [menuOpen, setMenuOpen] = useState(false)
  const [tables, setTables] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [modalError, setModalError] = useState('')

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  const [activeModal, setActiveModal] = useState(null)
  const [selectedTable, setSelectedTable] = useState(null)
  const [tableForm, setTableForm] = useState(initialTableForm)

  const menuSections = useMemo(
    () =>
      adminMenuSections
        .map((section) => ({
          ...section,
          items: section.items.filter((item) =>
            canUsePermission(user, item.permission),
          ),
        }))
        .filter((section) => section.items.length > 0),
    [user],
  )

  const filteredTables = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase()

    return tables.filter((table) => {
      const code = String(table.code ?? '').toLowerCase()
      const name = String(table.name ?? '').toLowerCase()
      const matchesSearch =
        !normalizedSearch ||
        code.includes(normalizedSearch) ||
        name.includes(normalizedSearch)
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' && table.isActive) ||
        (statusFilter === 'inactive' && !table.isActive)

      return matchesSearch && matchesStatus
    })
  }, [search, statusFilter, tables])

  const stats = useMemo(() => {
    const total = tables.length
    const active = tables.filter((table) => table.isActive).length
    const inactive = total - active
    const withOrderHistory = tables.filter(
      (table) => Number(table.ordersCount ?? 0) > 0,
    ).length

    return { total, active, inactive, withOrderHistory }
  }, [tables])

  const loadTables = useCallback(async ({ preserveMessages = false } = {}) => {
    try {
      setLoading(true)
      setError('')
      if (!preserveMessages) setSuccess('')

      const payload = await getRestaurantTablesRequest()
      setTables(normalizeList(payload))
    } catch (requestError) {
      setError(getErrorMessage(requestError, 'No se pudieron cargar las mesas.'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadTables()
  }, [loadTables])

  useEffect(() => {
    function handlePointerDown(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setMenuOpen(false)
      }
    }

    function handleKeyDown(event) {
      if (event.key !== 'Escape') return

      setMenuOpen(false)

      if (activeModal && !saving) {
        closeModal()
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [activeModal, saving])

  useEffect(() => {
    if (!activeModal) return undefined

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [activeModal])

  function clearMessages() {
    setError('')
    setSuccess('')
    setModalError('')
  }

  function openCreateModal() {
    clearMessages()
    setSelectedTable(null)
    setTableForm(initialTableForm)
    setActiveModal('create')
  }

  function openDetailModal(table) {
    clearMessages()
    setSelectedTable(table)
    setActiveModal('detail')
  }

  function openEditModal(table) {
    clearMessages()
    setSelectedTable(table)
    setTableForm({
      code: table.code ?? '',
      name: table.name ?? '',
      capacity: table.capacity ?? '',
      isActive: Boolean(table.isActive),
    })
    setActiveModal('edit')
  }

  function openStatusModal(table) {
    clearMessages()
    setSelectedTable(table)
    setActiveModal('status')
  }

  function closeModal() {
    if (saving) return

    setActiveModal(null)
    setSelectedTable(null)
    setTableForm(initialTableForm)
    setModalError('')
  }

  function handleTableFieldChange(event) {
    const { name, value, type, checked } = event.target

    setTableForm((current) => ({
      ...current,
      [name]: type === 'checkbox' ? checked : value,
    }))
  }

  function validateTableForm() {
    const code = tableForm.code.trim()
    const name = tableForm.name.trim()
    const capacity = tableForm.capacity === '' ? null : Number(tableForm.capacity)

    if (!code) {
      return { error: 'El código de la mesa es obligatorio.' }
    }

    if (!/^[A-Za-z0-9_-]+$/.test(code)) {
      return {
        error:
          'El código solo puede contener letras, números, guion y guion bajo.',
      }
    }

    if (capacity !== null && (!Number.isInteger(capacity) || capacity < 1 || capacity > 100)) {
      return {
        error: 'La capacidad debe ser un número entero entre 1 y 100.',
      }
    }

    return {
      payload: {
        code,
        name: name || null,
        capacity,
      },
    }
  }

  async function handleTableSubmit(event) {
    event.preventDefault()
    setModalError('')

    const validation = validateTableForm()

    if (validation.error) {
      setModalError(validation.error)
      return
    }

    const isEditing = activeModal === 'edit' && selectedTable

    try {
      setSaving(true)

      if (isEditing) {
        await updateRestaurantTableRequest(selectedTable.id, validation.payload)
      } else {
        await createRestaurantTableRequest({
          ...validation.payload,
          isActive: tableForm.isActive,
        })
      }

      const successMessage = isEditing
        ? 'Mesa actualizada correctamente.'
        : 'Mesa creada correctamente.'

      setActiveModal(null)
      setSelectedTable(null)
      setTableForm(initialTableForm)
      setSuccess(successMessage)
      await loadTables({ preserveMessages: true })
    } catch (requestError) {
      setModalError(
        getErrorMessage(requestError, 'No se pudo guardar la mesa.'),
      )
    } finally {
      setSaving(false)
    }
  }

  async function handleStatusSubmit() {
    if (!selectedTable) return

    try {
      setSaving(true)
      setModalError('')

      await updateRestaurantTableStatusRequest(
        selectedTable.id,
        !selectedTable.isActive,
      )

      const successMessage = selectedTable.isActive
        ? 'Mesa desactivada correctamente.'
        : 'Mesa activada correctamente.'

      setActiveModal(null)
      setSelectedTable(null)
      setSuccess(successMessage)
      await loadTables({ preserveMessages: true })
    } catch (requestError) {
      setModalError(
        getErrorMessage(
          requestError,
          'No se pudo cambiar el estado de la mesa.',
        ),
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="tables-page">
      <section className="tables-hero">
        <div>
          <span className="tables-eyebrow">Restaurante</span>
          <h1>Mesas del Restaurante</h1>
          <p>
            Consulta primero las mesas registradas y abre únicamente la acción
            que necesites realizar.
          </p>
          <small className="tables-last-update">
            Sesión: {user?.fullName || user?.username || 'Administrador'}
          </small>
        </div>

        <div className="tables-hero-actions">
          <div className="tables-menu-wrapper" ref={menuRef}>
            <button
              type="button"
              className="btn tables-menu-button"
              onClick={() => setMenuOpen((current) => !current)}
              aria-expanded={menuOpen}
              aria-controls="tables-admin-menu"
            >
              <span aria-hidden="true">☰</span>
              Menú
            </button>

            {menuOpen && (
              <div className="tables-menu-panel" id="tables-admin-menu">
                <div className="tables-menu-header">
                  <div>
                    <strong>Módulos del sistema</strong>
                    <p>Accede a las áreas habilitadas para tu cuenta.</p>
                  </div>
                  <button
                    type="button"
                    className="tables-menu-close"
                    onClick={() => setMenuOpen(false)}
                    aria-label="Cerrar menú"
                  >
                    ×
                  </button>
                </div>

                <div className="tables-menu-sections">
                  {menuSections.map((section) => (
                    <section className="tables-menu-section" key={section.title}>
                      <h2>{section.title}</h2>
                      <div className="tables-menu-items">
                        {section.items.map((item) => (
                          <Link
                            to={item.to}
                            className={`tables-menu-item ${
                              item.to === CURRENT_ROUTE ? 'is-current' : ''
                            }`}
                            key={item.title}
                            onClick={() => setMenuOpen(false)}
                          >
                            <span aria-hidden="true">{item.icon}</span>
                            <div>
                              <strong>{item.title}</strong>
                              <p>{item.description}</p>
                            </div>
                          </Link>
                        ))}
                      </div>
                    </section>
                  ))}
                </div>
              </div>
            )}
          </div>

          <Link to="/dashboard" className="btn tables-secondary-button">
            Volver al dashboard
          </Link>

          <button type="button" className="btn tables-logout" onClick={logout}>
            Cerrar sesión
          </button>
        </div>
      </section>

      {error && <section className="tables-alert tables-alert-error">{error}</section>}
      {success && (
        <section className="tables-alert tables-alert-success">{success}</section>
      )}

      <section className="tables-card tables-management-card">
        <div className="tables-management-header">
          <div>
            <span className="tables-section-eyebrow">Gestión del restaurante</span>
            <h2>Mesas registradas</h2>
            <p>
              Revisa su estado, capacidad e historial de órdenes antes de realizar
              cambios.
            </p>
          </div>

          <div className="tables-management-actions">
            <button
              type="button"
              className="tables-refresh-button"
              onClick={() => loadTables()}
              disabled={loading || saving}
            >
              <RefreshIcon />
              {loading ? 'Actualizando...' : 'Actualizar'}
            </button>
            <button
              type="button"
              className="btn tables-primary-button"
              onClick={openCreateModal}
              disabled={loading || saving}
            >
              + Nueva mesa
            </button>
          </div>
        </div>

        <div className="tables-stats-grid" aria-label="Resumen de mesas">
          <article className="tables-stat">
            <span>Total</span>
            <strong>{loading ? '...' : stats.total}</strong>
            <small>Mesas registradas</small>
          </article>
          <article className="tables-stat is-success">
            <span>Activas</span>
            <strong>{loading ? '...' : stats.active}</strong>
            <small>Disponibles para operación</small>
          </article>
          <article className="tables-stat is-danger">
            <span>Inactivas</span>
            <strong>{loading ? '...' : stats.inactive}</strong>
            <small>Fuera de operación</small>
          </article>
          <article className="tables-stat is-history">
            <span>Con historial</span>
            <strong>{loading ? '...' : stats.withOrderHistory}</strong>
            <small>Con órdenes asociadas</small>
          </article>
        </div>

        <div className="tables-filters" aria-label="Filtros de mesas">
          <label className="tables-search-field">
            <span>Buscar</span>
            <input
              type="search"
              placeholder="Código o nombre visible..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>

          <label>
            <span>Estado</span>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
            >
              <option value="all">Todas</option>
              <option value="active">Activas</option>
              <option value="inactive">Inactivas</option>
            </select>
          </label>
        </div>

        <div className="tables-results-summary">
          {loading
            ? 'Cargando mesas...'
            : `${filteredTables.length} de ${tables.length} mesa(s)`}
        </div>

        {loading ? (
          <div className="tables-empty-state">Cargando mesas...</div>
        ) : filteredTables.length > 0 ? (
          <div className="tables-list" role="table" aria-label="Mesas registradas">
            <div className="tables-list-header" role="row">
              <span role="columnheader">Mesa</span>
              <span role="columnheader">Capacidad</span>
              <span role="columnheader">Historial</span>
              <span role="columnheader">Estado</span>
              <span role="columnheader">Acciones</span>
            </div>

            {filteredTables.map((table) => (
              <article className="tables-row" role="row" key={table.id}>
                <div className="tables-cell tables-identity" data-label="Mesa" role="cell">
                  <span className="tables-table-icon" aria-hidden="true">🪑</span>
                  <div>
                    <strong>{table.code}</strong>
                    <p>{table.name || 'Sin nombre visible'}</p>
                  </div>
                </div>

                <div className="tables-cell" data-label="Capacidad" role="cell">
                  <strong>{formatCapacity(table.capacity)}</strong>
                  <small>
                    {table.capacity ? 'Capacidad registrada' : 'Pendiente de definir'}
                  </small>
                </div>

                <div className="tables-cell" data-label="Historial" role="cell">
                  <strong>{formatOrderCount(table.ordersCount)}</strong>
                  <small>Órdenes asociadas históricamente</small>
                </div>

                <div className="tables-cell" data-label="Estado" role="cell">
                  <span
                    className={`tables-status ${
                      table.isActive ? 'is-active' : 'is-inactive'
                    }`}
                  >
                    <span aria-hidden="true">•</span>
                    {table.isActive ? 'Activa' : 'Inactiva'}
                  </span>
                </div>

                <div className="tables-row-actions" role="cell">
                  <button type="button" onClick={() => openDetailModal(table)}>
                    Ver detalle
                  </button>
                  <button type="button" onClick={() => openEditModal(table)}>
                    Editar
                  </button>
                  <button
                    type="button"
                    className={table.isActive ? 'is-danger' : 'is-success'}
                    onClick={() => openStatusModal(table)}
                  >
                    {table.isActive ? 'Desactivar' : 'Activar'}
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="tables-empty-state">
            No hay mesas que coincidan con los filtros seleccionados.
          </div>
        )}
      </section>

      {activeModal === 'create' && (
        <TableModal
          title="Nueva mesa"
          subtitle="Registra una mesa para la operación del restaurante."
          onClose={closeModal}
          saving={saving}
        >
          <TableForm
            form={tableForm}
            error={modalError}
            saving={saving}
            mode="create"
            onChange={handleTableFieldChange}
            onSubmit={handleTableSubmit}
            onCancel={closeModal}
          />
        </TableModal>
      )}

      {activeModal === 'detail' && selectedTable && (
        <TableModal
          title="Detalle de la mesa"
          subtitle={selectedTable.code}
          onClose={closeModal}
          saving={saving}
        >
          <TableDetail table={selectedTable} />
          <div className="tables-modal-actions">
            <button type="button" className="tables-cancel-button" onClick={closeModal}>
              Cerrar
            </button>
          </div>
        </TableModal>
      )}

      {activeModal === 'edit' && selectedTable && (
        <TableModal
          title="Editar mesa"
          subtitle={selectedTable.code}
          onClose={closeModal}
          saving={saving}
        >
          <TableForm
            form={tableForm}
            error={modalError}
            saving={saving}
            mode="edit"
            onChange={handleTableFieldChange}
            onSubmit={handleTableSubmit}
            onCancel={closeModal}
          />
        </TableModal>
      )}

      {activeModal === 'status' && selectedTable && (
        <TableModal
          title={selectedTable.isActive ? 'Desactivar mesa' : 'Activar mesa'}
          subtitle={selectedTable.code}
          onClose={closeModal}
          saving={saving}
        >
          {modalError && (
            <div className="tables-alert tables-alert-error">{modalError}</div>
          )}

          <div className="tables-confirmation">
            <span className={selectedTable.isActive ? 'is-danger' : 'is-success'}>
              {selectedTable.isActive ? '!' : '✓'}
            </span>
            <div>
              <strong>
                {selectedTable.isActive
                  ? `¿Desactivar la mesa ${selectedTable.code}?`
                  : `¿Activar la mesa ${selectedTable.code}?`}
              </strong>
              <p>
                {selectedTable.isActive
                  ? 'La mesa dejará de estar disponible para nuevas operaciones. Si todavía tiene órdenes abiertas, el sistema no permitirá desactivarla.'
                  : 'La mesa volverá a estar disponible para la operación del restaurante.'}
              </p>
            </div>
          </div>

          <div className="tables-modal-actions">
            <button
              type="button"
              className="tables-cancel-button"
              onClick={closeModal}
              disabled={saving}
            >
              Cancelar
            </button>
            <button
              type="button"
              className={
                selectedTable.isActive
                  ? 'tables-danger-button'
                  : 'tables-save-button'
              }
              onClick={handleStatusSubmit}
              disabled={saving}
            >
              {saving
                ? 'Procesando...'
                : selectedTable.isActive
                  ? 'Desactivar mesa'
                  : 'Activar mesa'}
            </button>
          </div>
        </TableModal>
      )}
    </main>
  )
}

function TableForm({
  form,
  error,
  saving,
  mode,
  onChange,
  onSubmit,
  onCancel,
}) {
  const isCreate = mode === 'create'

  return (
    <form className="tables-form" onSubmit={onSubmit}>
      {error && <div className="tables-alert tables-alert-error">{error}</div>}

      <section className="tables-form-section">
        <div className="tables-form-section-heading">
          <span aria-hidden="true">1</span>
          <div>
            <strong>Identificación</strong>
            <small>Define cómo reconocerás la mesa dentro del sistema.</small>
          </div>
        </div>

        <div className="tables-form-grid">
          <label>
            <span>Código</span>
            <input
              type="text"
              name="code"
              value={form.code}
              onChange={onChange}
              placeholder="Ej: MESA-01"
              maxLength={20}
              autoComplete="off"
              required
            />
            <small>Solo letras, números, guion y guion bajo.</small>
          </label>

          <label>
            <span>Capacidad</span>
            <input
              type="number"
              name="capacity"
              value={form.capacity}
              onChange={onChange}
              placeholder="Ej: 4"
              min="1"
              max="100"
              step="1"
            />
            <small>Opcional. Entre 1 y 100 personas.</small>
          </label>
        </div>

        <label>
          <span>Nombre visible</span>
          <input
            type="text"
            name="name"
            value={form.name}
            onChange={onChange}
            placeholder="Ej: Mesa terraza 1"
            maxLength={50}
          />
          <small>Opcional. Ayuda a ubicarla rápidamente.</small>
        </label>
      </section>

      {isCreate ? (
        <section className="tables-form-section">
          <div className="tables-form-section-heading">
            <span aria-hidden="true">2</span>
            <div>
              <strong>Estado inicial</strong>
              <small>Decide si estará disponible inmediatamente.</small>
            </div>
          </div>

          <label className="tables-switch">
            <input
              type="checkbox"
              name="isActive"
              checked={form.isActive}
              onChange={onChange}
            />
            <span className="tables-switch-control" aria-hidden="true" />
            <span>
              <strong>Crear mesa activa</strong>
              <small>Disponible para usarse en nuevas operaciones.</small>
            </span>
          </label>
        </section>
      ) : (
        <div className="tables-form-note">
          <strong>El estado se administra por separado.</strong>
          <p>
            Activa o desactiva la mesa desde su acción correspondiente para evitar
            cambios accidentales.
          </p>
        </div>
      )}

      <div className="tables-modal-actions">
        <button
          type="button"
          className="tables-cancel-button"
          onClick={onCancel}
          disabled={saving}
        >
          Cancelar
        </button>
        <button type="submit" className="tables-save-button" disabled={saving}>
          {saving
            ? 'Guardando...'
            : isCreate
              ? 'Crear mesa'
              : 'Guardar cambios'}
        </button>
      </div>
    </form>
  )
}

function TableDetail({ table }) {
  return (
    <div className="tables-detail-grid">
      <div>
        <span>Código</span>
        <strong>{table.code}</strong>
      </div>
      <div>
        <span>Nombre visible</span>
        <strong>{table.name || 'Sin nombre visible'}</strong>
      </div>
      <div>
        <span>Capacidad</span>
        <strong>{formatCapacity(table.capacity)}</strong>
      </div>
      <div>
        <span>Estado</span>
        <strong>{table.isActive ? 'Activa' : 'Inactiva'}</strong>
      </div>
      <div className="tables-detail-wide">
        <span>Historial de órdenes</span>
        <strong>{formatOrderCount(table.ordersCount)}</strong>
        <small>
          Este total representa órdenes asociadas históricamente; no indica por sí
          solo que la mesa esté ocupada en este momento.
        </small>
      </div>
    </div>
  )
}

function TableModal({ title, subtitle, onClose, saving, children }) {
  return (
    <div className="tables-modal-backdrop" role="presentation">
      <section
        className="tables-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tables-modal-title"
      >
        <header className="tables-modal-header">
          <div>
            <h2 id="tables-modal-title">{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <button
            type="button"
            className="tables-modal-close"
            onClick={onClose}
            disabled={saving}
            aria-label="Cerrar ventana"
          >
            ×
          </button>
        </header>
        <div className="tables-modal-body">{children}</div>
      </section>
    </div>
  )
}

function RefreshIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d="M20 11a8 8 0 1 0-2.34 5.66M20 4v7h-7"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function formatCapacity(capacity) {
  const parsedCapacity = Number(capacity)

  if (!Number.isInteger(parsedCapacity) || parsedCapacity < 1) {
    return 'Sin definir'
  }

  return `${parsedCapacity} ${parsedCapacity === 1 ? 'persona' : 'personas'}`
}

function formatOrderCount(value) {
  const count = Number(value ?? 0)
  return `${count} ${count === 1 ? 'orden' : 'órdenes'}`
}

function normalizeList(payload) {
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.tables)) return payload.tables
  if (Array.isArray(payload?.restaurantTables)) return payload.restaurantTables
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
