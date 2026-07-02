import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { useAuth } from '../auth/AuthContext'
import {
  createRestaurantTableRequest,
  getRestaurantTablesRequest,
  updateRestaurantTableRequest,
  updateRestaurantTableStatusRequest,
} from '../services/restaurantTablesService'
import './AdminRestaurantTablesPage.css'

const restaurantTabs = [
  {
    id: 'tables',
    label: 'Mesas',
    helper: 'Crear, editar, activar y desactivar mesas del restaurante.',
  },
  {
    id: 'areas',
    label: 'Áreas',
    helper: 'Próximo módulo para separar terraza, salón u otros espacios.',
    disabled: true,
  },
  {
    id: 'availability',
    label: 'Disponibilidad',
    helper: 'Próximo módulo para control operativo de ocupación.',
    disabled: true,
  },
]

const initialTableForm = {
  id: '',
  code: '',
  name: '',
  capacity: '',
  isActive: true,
}

export default function AdminRestaurantTablesPage() {
  const { user, logout } = useAuth()

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [activeTab, setActiveTab] = useState('tables')

  const [tables, setTables] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  const [tableForm, setTableForm] = useState(initialTableForm)

  useEffect(() => {
    loadTables()
  }, [])

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
    const inactive = tables.filter((table) => !table.isActive).length
    const withOrders = tables.filter((table) => Number(table.ordersCount ?? 0) > 0).length

    return { total, active, inactive, withOrders }
  }, [tables])

  async function loadTables() {
    try {
      setLoading(true)
      setError('')

      const payload = await getRestaurantTablesRequest()
      setTables(normalizeList(payload))
    } catch (requestError) {
      setError(getErrorMessage(requestError, 'No se pudieron cargar las mesas.'))
    } finally {
      setLoading(false)
    }
  }

  function clearMessages() {
    setError('')
    setSuccess('')
  }

  function handleTabChange(tabId) {
    const tab = restaurantTabs.find((item) => item.id === tabId)

    if (tab?.disabled) return

    clearMessages()
    setActiveTab(tabId)
    setDrawerOpen(false)
  }

  function handleTableFieldChange(event) {
    const { name, value, type, checked } = event.target

    setTableForm((current) => ({
      ...current,
      [name]: type === 'checkbox' ? checked : value,
    }))
  }

  function startCreateTable() {
    clearMessages()
    setTableForm(initialTableForm)
  }

  function startEditTable(table) {
    clearMessages()

    setTableForm({
      id: table.id,
      code: table.code ?? '',
      name: table.name ?? '',
      capacity: table.capacity ?? '',
      isActive: Boolean(table.isActive),
    })

    setActiveTab('tables')
  }

  async function handleTableSubmit(event) {
    event.preventDefault()
    clearMessages()

    const isEditing = Boolean(tableForm.id)
    const code = tableForm.code.trim()
    const name = tableForm.name.trim()
    const capacity = tableForm.capacity === '' ? null : Number(tableForm.capacity)

    if (!code) {
      setError('El código de la mesa es obligatorio.')
      return
    }

    if (capacity !== null && (!Number.isInteger(capacity) || capacity < 1 || capacity > 100)) {
      setError('La capacidad debe ser un número entero entre 1 y 100.')
      return
    }

    const basePayload = {
      code,
      name: name || null,
      capacity,
    }

    try {
      setSaving(true)

      if (isEditing) {
        await updateRestaurantTableRequest(tableForm.id, basePayload)
        setSuccess('Mesa actualizada correctamente.')
      } else {
        await createRestaurantTableRequest({
          ...basePayload,
          isActive: tableForm.isActive,
        })

        setSuccess('Mesa creada correctamente.')
      }

      setTableForm(initialTableForm)
      await loadTables()
    } catch (requestError) {
      setError(getErrorMessage(requestError, 'No se pudo guardar la mesa.'))
    } finally {
      setSaving(false)
    }
  }

  async function handleToggleTableStatus(table) {
    clearMessages()

    try {
      setSaving(true)

      await updateRestaurantTableStatusRequest(table.id, !table.isActive)

      setSuccess(
        table.isActive
          ? 'Mesa desactivada correctamente.'
          : 'Mesa activada correctamente.',
      )

      await loadTables()
    } catch (requestError) {
      setError(
        getErrorMessage(
          requestError,
          'No se pudo cambiar el estado de la mesa.',
        ),
      )
    } finally {
      setSaving(false)
    }
  }

  const activeTabData = restaurantTabs.find((tab) => tab.id === activeTab)

  return (
    <main className="tables-page">
      <section className="tables-hero">
        <div>
          <span className="tables-eyebrow">Restaurante</span>

          <h1>Mesas del Restaurante</h1>

          <p>
            Administra las mesas disponibles para la toma de órdenes, capacidad
            y estado operativo.
          </p>

          <small className="tables-last-update">
            Sesión: {user?.fullName || user?.username || 'Administrador'}
          </small>
        </div>

        <div className="tables-hero-actions">
          <Link to="/dashboard" className="btn tables-secondary-button">
            Volver al dashboard
          </Link>

          <button type="button" className="btn tables-logout" onClick={logout}>
            Cerrar sesión
          </button>
        </div>
      </section>

      <section className="tables-layout">
        <aside className={`tables-sidebar ${drawerOpen ? 'is-open' : ''}`}>
          <div className="tables-sidebar-header">
            <strong>Menú admin</strong>

            <button
              type="button"
              className="tables-menu-close"
              onClick={() => setDrawerOpen(false)}
              aria-label="Cerrar menú"
            >
              ×
            </button>
          </div>

          <Link className="tables-menu-link" to="/admin/access">
            <span>Usuarios</span>
            <small>Usuarios y Accesos</small>
          </Link>

          <button type="button" className="tables-menu-item is-active">
            <span>Restaurante</span>
            <small>Mesas</small>
          </button>

          <button type="button" className="tables-menu-item" disabled>
            <span>Órdenes</span>
            <small>Próximo módulo CRUD</small>
          </button>

          <button type="button" className="tables-menu-item" disabled>
            <span>Hospedaje</span>
            <small>Próximo módulo</small>
          </button>

          <button type="button" className="tables-menu-item" disabled>
            <span>Facturación</span>
            <small>Próximo módulo</small>
          </button>
        </aside>

        {drawerOpen && (
          <button
            type="button"
            className="tables-drawer-backdrop"
            onClick={() => setDrawerOpen(false)}
            aria-label="Cerrar menú administrativo"
          />
        )}

        <section className="tables-content">
          <div className="tables-toolbar">
            <button
              type="button"
              className="tables-menu-button"
              onClick={() => setDrawerOpen(true)}
            >
              ☰ Menú
            </button>

            <div>
              <span>Restaurante</span>
              <strong>Mesas</strong>
            </div>
          </div>

          <section className="tables-card tables-title-card">
            <div className="tables-section-header">
              <div>
                <h2>{activeTabData?.label || 'Mesas'}</h2>
                <p>{activeTabData?.helper}</p>
              </div>

              <button
                type="button"
                className="tables-small-button"
                onClick={loadTables}
                disabled={loading || saving}
              >
                Actualizar
              </button>
            </div>

            <div className="tables-tabs">
              {restaurantTabs.map((tab) => (
                <button
                  type="button"
                  className={`tables-tab ${activeTab === tab.id ? 'is-active' : ''}`}
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id)}
                  disabled={tab.disabled}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </section>

          {error && (
            <section className="tables-alert tables-alert-error">
              {error}
            </section>
          )}

          {success && (
            <section className="tables-alert tables-alert-success">
              {success}
            </section>
          )}

          <section className="tables-stats-grid">
            <article className="tables-stat">
              <span>Total de mesas</span>
              <strong>{loading ? '...' : stats.total}</strong>
              <small>Registradas en el sistema</small>
            </article>

            <article className="tables-stat stat-success">
              <span>Activas</span>
              <strong>{loading ? '...' : stats.active}</strong>
              <small>Disponibles para operación</small>
            </article>

            <article className="tables-stat stat-danger">
              <span>Inactivas</span>
              <strong>{loading ? '...' : stats.inactive}</strong>
              <small>No disponibles para nuevas órdenes</small>
            </article>

            <article className="tables-stat stat-warning">
              <span>Con órdenes</span>
              <strong>{loading ? '...' : stats.withOrders}</strong>
              <small>Mesas con historial de órdenes</small>
            </article>
          </section>

          <section className="tables-two-column">
            <article className="tables-card">
              <div className="tables-section-header">
                <div>
                  <h2>{tableForm.id ? 'Editar mesa' : 'Nueva mesa'}</h2>
                  <p>
                    Define el código, nombre visible y capacidad de la mesa.
                  </p>
                </div>
              </div>

              <form className="tables-form" onSubmit={handleTableSubmit}>
                <div className="tables-form-grid">
                  <label>
                    Código
                    <input
                      type="text"
                      name="code"
                      value={tableForm.code}
                      onChange={handleTableFieldChange}
                      placeholder="Ej: MESA-01"
                      maxLength={20}
                      required
                    />
                  </label>

                  <label>
                    Capacidad
                    <input
                      type="number"
                      name="capacity"
                      value={tableForm.capacity}
                      onChange={handleTableFieldChange}
                      placeholder="Ej: 4"
                      min="1"
                      max="100"
                    />
                  </label>
                </div>

                <label>
                  Nombre visible
                  <input
                    type="text"
                    name="name"
                    value={tableForm.name}
                    onChange={handleTableFieldChange}
                    placeholder="Ej: Mesa terraza 1"
                    maxLength={50}
                  />
                </label>

                {!tableForm.id && (
                  <label className="tables-switch">
                    <input
                      type="checkbox"
                      name="isActive"
                      checked={tableForm.isActive}
                      onChange={handleTableFieldChange}
                    />

                    <span>
                      Crear mesa activa
                      <small>Disponible para usarse en operación.</small>
                    </span>
                  </label>
                )}

                {tableForm.id && (
                  <p className="tables-muted">
                    El estado activo/inactivo se cambia desde el listado para
                    evitar modificaciones accidentales.
                  </p>
                )}

                <div className="tables-form-actions">
                  <button
                    type="submit"
                    className="tables-primary-button"
                    disabled={saving}
                  >
                    {saving
                      ? 'Guardando...'
                      : tableForm.id
                        ? 'Guardar cambios'
                        : 'Crear mesa'}
                  </button>

                  {tableForm.id && (
                    <button
                      type="button"
                      className="tables-small-button"
                      onClick={startCreateTable}
                      disabled={saving}
                    >
                      Cancelar edición
                    </button>
                  )}
                </div>
              </form>
            </article>

            <article className="tables-card">
              <div className="tables-section-header">
                <div>
                  <h2>Listado de mesas</h2>
                  <p>Busca por código o nombre y filtra por estado.</p>
                </div>
              </div>

              <div className="tables-filters">
                <label>
                  Buscar
                  <input
                    type="search"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Código o nombre"
                  />
                </label>

                <label>
                  Estado
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

              {loading ? (
                <div className="tables-empty-state">
                  Cargando mesas...
                </div>
              ) : filteredTables.length > 0 ? (
                <div className="tables-list">
                  {filteredTables.map((table) => (
                    <div className="tables-list-item" key={table.id}>
                      <div>
                        <strong>{table.code}</strong>

                        <p>
                          {table.name || 'Sin nombre visible'}
                          {' · '}
                          {table.capacity
                            ? `${table.capacity} persona(s)`
                            : 'Capacidad sin definir'}
                        </p>

                        <div className="tables-badges">
                          <span className={table.isActive ? 'badge-success' : 'badge-danger'}>
                            {table.isActive ? 'Activa' : 'Inactiva'}
                          </span>

                          <span>
                            {Number(table.ordersCount ?? 0)} orden(es)
                          </span>
                        </div>
                      </div>

                      <div className="tables-row-actions">
                        <button
                          type="button"
                          onClick={() => startEditTable(table)}
                          disabled={saving}
                        >
                          Editar
                        </button>

                        <button
                          type="button"
                          onClick={() => handleToggleTableStatus(table)}
                          disabled={saving}
                        >
                          {table.isActive ? 'Desactivar' : 'Activar'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="tables-empty-state">
                  No hay mesas que coincidan con los filtros.
                </div>
              )}
            </article>
          </section>
        </section>
      </section>
    </main>
  )
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