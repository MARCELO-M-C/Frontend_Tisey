import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { useAuth } from '../auth/AuthContext'
import { getUsersRequest } from '../services/accessService'
import {
  createShiftRequest,
  createStationRequest,
  endShiftRequest,
  getShiftsRequest,
  getStationsRequest,
  updateShiftRequest,
  updateStationRequest,
  updateStationStatusRequest,
} from '../services/operationsService'
import './AdminOperationsPage.css'

const operationTabs = [
  {
    id: 'shifts',
    label: 'Turnos',
    helper: 'Abre, consulta, edita y cierra los turnos de trabajo.',
  },
  {
    id: 'stations',
    label: 'Estaciones',
    helper: 'Administra las estaciones de preparación utilizadas por el KDS.',
  },
]

const initialStationForm = {
  id: '',
  code: '',
  name: '',
  isActive: true,
}

function createInitialShiftForm() {
  return {
    id: '',
    userId: '',
    userName: '',
    startedAt: toDateTimeLocal(new Date()),
    notes: '',
  }
}

export default function AdminOperationsPage() {
  const { user, logout } = useAuth()

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [activeTab, setActiveTab] = useState('shifts')

  const [shifts, setShifts] = useState([])
  const [stations, setStations] = useState([])
  const [users, setUsers] = useState([])

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [shiftForm, setShiftForm] = useState(createInitialShiftForm)
  const [stationForm, setStationForm] = useState(initialStationForm)

  const [shiftSearch, setShiftSearch] = useState('')
  const [shiftStatusFilter, setShiftStatusFilter] = useState('all')
  const [shiftUserFilter, setShiftUserFilter] = useState('all')

  const [stationSearch, setStationSearch] = useState('')
  const [stationStatusFilter, setStationStatusFilter] = useState('all')

  useEffect(() => {
    loadOperationsData()
  }, [])

  const activeUsers = useMemo(
    () => users.filter((currentUser) => currentUser.isActive),
    [users],
  )

  const filteredShifts = useMemo(() => {
    const normalizedSearch = shiftSearch.trim().toLowerCase()

    return shifts.filter((shift) => {
      const fullName = String(shift.user?.fullName ?? '').toLowerCase()
      const username = String(shift.user?.username ?? '').toLowerCase()
      const notes = String(shift.notes ?? '').toLowerCase()

      const matchesSearch =
        !normalizedSearch ||
        fullName.includes(normalizedSearch) ||
        username.includes(normalizedSearch) ||
        notes.includes(normalizedSearch)

      const matchesStatus =
        shiftStatusFilter === 'all' ||
        (shiftStatusFilter === 'open' && shift.isOpen) ||
        (shiftStatusFilter === 'closed' && !shift.isOpen)

      const matchesUser =
        shiftUserFilter === 'all' ||
        String(shift.user?.id) === String(shiftUserFilter)

      return matchesSearch && matchesStatus && matchesUser
    })
  }, [shifts, shiftSearch, shiftStatusFilter, shiftUserFilter])

  const filteredStations = useMemo(() => {
    const normalizedSearch = stationSearch.trim().toLowerCase()

    return stations.filter((station) => {
      const code = String(station.code ?? '').toLowerCase()
      const name = String(station.name ?? '').toLowerCase()

      const matchesSearch =
        !normalizedSearch ||
        code.includes(normalizedSearch) ||
        name.includes(normalizedSearch)

      const matchesStatus =
        stationStatusFilter === 'all' ||
        (stationStatusFilter === 'active' && station.isActive) ||
        (stationStatusFilter === 'inactive' && !station.isActive)

      return matchesSearch && matchesStatus
    })
  }, [stations, stationSearch, stationStatusFilter])

  const stats = useMemo(() => {
    return {
      openShifts: shifts.filter((shift) => shift.isOpen).length,
      closedShifts: shifts.filter((shift) => !shift.isOpen).length,
      activeStations: stations.filter((station) => station.isActive).length,
      inactiveStations: stations.filter((station) => !station.isActive).length,
    }
  }, [shifts, stations])

  async function loadOperationsData() {
    try {
      setLoading(true)
      setError('')

      const [shiftsPayload, stationsPayload, usersPayload] = await Promise.all([
        getShiftsRequest(),
        getStationsRequest(),
        getUsersRequest(),
      ])

      setShifts(normalizeShifts(shiftsPayload))
      setStations(normalizeStations(stationsPayload))
      setUsers(normalizeUsers(usersPayload))
    } catch (requestError) {
      setError(
        getErrorMessage(
          requestError,
          'No se pudieron cargar los turnos y estaciones.',
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

  function handleShiftFieldChange(event) {
    const { name, value } = event.target

    setShiftForm((current) => ({
      ...current,
      [name]: value,
    }))
  }

  function handleStationFieldChange(event) {
    const { name, value, type, checked } = event.target

    setStationForm((current) => ({
      ...current,
      [name]: type === 'checkbox' ? checked : value,
    }))
  }

  function startCreateShift() {
    clearMessages()
    setShiftForm(createInitialShiftForm())
    setActiveTab('shifts')
  }

  function startEditShift(shift) {
    clearMessages()

    setShiftForm({
      id: shift.id,
      userId: shift.user?.id ?? '',
      userName:
        shift.user?.fullName ||
        shift.user?.username ||
        'Usuario sin nombre',
      startedAt: toDateTimeLocal(shift.startedAt),
      notes: shift.notes ?? '',
    })

    setActiveTab('shifts')
    scrollToTop()
  }

  function startCreateStation() {
    clearMessages()
    setStationForm(initialStationForm)
    setActiveTab('stations')
  }

  function startEditStation(station) {
    clearMessages()

    setStationForm({
      id: station.id,
      code: station.code ?? '',
      name: station.name ?? '',
      isActive: Boolean(station.isActive),
    })

    setActiveTab('stations')
    scrollToTop()
  }

  async function handleShiftSubmit(event) {
    event.preventDefault()
    clearMessages()

    const isEditing = Boolean(shiftForm.id)
    const notes = shiftForm.notes.trim()
    const startedAt = shiftForm.startedAt
      ? toIsoDateTime(shiftForm.startedAt)
      : undefined

    if (shiftForm.startedAt && !startedAt) {
      setError('La fecha de inicio no es válida.')
      return
    }

    try {
      setSaving(true)

      if (isEditing) {
        await updateShiftRequest(shiftForm.id, {
          startedAt,
          notes: notes || null,
        })

        setSuccess('Turno actualizado correctamente.')
      } else {
        const payload = {
          startedAt,
          notes: notes || null,
        }

        if (shiftForm.userId) {
          payload.userId = Number(shiftForm.userId)
        }

        await createShiftRequest(removeUndefined(payload))
        setSuccess('Turno abierto correctamente.')
      }

      setShiftForm(createInitialShiftForm())
      await loadOperationsData()
    } catch (requestError) {
      setError(
        getErrorMessage(requestError, 'No se pudo guardar el turno.'),
      )
    } finally {
      setSaving(false)
    }
  }

  async function handleEndShift(shift) {
    clearMessages()

    const shouldEnd = window.confirm(
      `¿Deseas cerrar el turno de ${
        shift.user?.fullName || shift.user?.username || 'este usuario'
      }?`,
    )

    if (!shouldEnd) return

    try {
      setSaving(true)

      /*
       * El body vacío hace que el backend utilice
       * la fecha y hora actuales para cerrar el turno.
       */
      await endShiftRequest(shift.id, {})

      setSuccess('Turno cerrado correctamente.')

      if (String(shiftForm.id) === String(shift.id)) {
        setShiftForm(createInitialShiftForm())
      }

      await loadOperationsData()
    } catch (requestError) {
      setError(
        getErrorMessage(
          requestError,
          'No se pudo cerrar el turno.',
        ),
      )
    } finally {
      setSaving(false)
    }
  }

  async function handleStationSubmit(event) {
    event.preventDefault()
    clearMessages()

    const isEditing = Boolean(stationForm.id)
    const code = stationForm.code.trim().toUpperCase()
    const name = stationForm.name.trim()

    if (!code) {
      setError('El código de la estación es obligatorio.')
      return
    }

    if (!/^[A-Za-z0-9_]+$/.test(code)) {
      setError(
        'El código solo puede contener letras, números y guion bajo.',
      )
      return
    }

    if (!name) {
      setError('El nombre de la estación es obligatorio.')
      return
    }

    try {
      setSaving(true)

      if (isEditing) {
        await updateStationRequest(stationForm.id, {
          code,
          name,
        })

        setSuccess('Estación actualizada correctamente.')
      } else {
        await createStationRequest({
          code,
          name,
          isActive: stationForm.isActive,
        })

        setSuccess('Estación creada correctamente.')
      }

      setStationForm(initialStationForm)
      await loadOperationsData()
    } catch (requestError) {
      setError(
        getErrorMessage(
          requestError,
          'No se pudo guardar la estación.',
        ),
      )
    } finally {
      setSaving(false)
    }
  }

  async function handleToggleStationStatus(station) {
    clearMessages()

    try {
      setSaving(true)

      await updateStationStatusRequest(station.id, !station.isActive)

      setSuccess(
        station.isActive
          ? 'Estación desactivada correctamente.'
          : 'Estación activada correctamente.',
      )

      await loadOperationsData()
    } catch (requestError) {
      setError(
        getErrorMessage(
          requestError,
          'No se pudo cambiar el estado de la estación.',
        ),
      )
    } finally {
      setSaving(false)
    }
  }

  const activeTabData = operationTabs.find((tab) => tab.id === activeTab)

  return (
    <main className="operations-page">
      <section className="operations-hero">
        <div>
          <span className="operations-eyebrow">Operación</span>

          <h1>Turnos y Estaciones</h1>

          <p>
            Controla los turnos de trabajo y las estaciones utilizadas para
            preparar las órdenes del restaurante.
          </p>

          <small className="operations-session">
            Sesión: {user?.fullName || user?.username || 'Administrador'}
          </small>
        </div>

        <div className="operations-hero-actions">
          <Link to="/dashboard" className="btn operations-secondary-button">
            Volver al dashboard
          </Link>

          <button
            type="button"
            className="btn operations-logout"
            onClick={logout}
          >
            Cerrar sesión
          </button>
        </div>
      </section>

      <section className="operations-layout">
        <aside
          className={`operations-sidebar ${drawerOpen ? 'is-open' : ''}`}
        >
          <div className="operations-sidebar-header">
            <strong>Menú admin</strong>

            <button
              type="button"
              className="operations-menu-close"
              onClick={() => setDrawerOpen(false)}
              aria-label="Cerrar menú"
            >
              ×
            </button>
          </div>

          <Link className="operations-menu-link" to="/admin/access">
            <span>Usuarios</span>
            <small>Usuarios y accesos</small>
          </Link>

          <Link
            className="operations-menu-link"
            to="/admin/restaurant-tables"
          >
            <span>Restaurante</span>
            <small>Mesas</small>
          </Link>

          <Link className="operations-menu-link" to="/admin/menu">
            <span>Menú</span>
            <small>Productos y categorías</small>
          </Link>

          <button
            type="button"
            className="operations-menu-item is-active"
          >
            <span>Operación</span>
            <small>Turnos y estaciones</small>
          </button>

          <button
            type="button"
            className="operations-menu-item"
            disabled
          >
            <span>Hospedaje</span>
            <small>Próximo módulo</small>
          </button>

          <button
            type="button"
            className="operations-menu-item"
            disabled
          >
            <span>Facturación</span>
            <small>Próximo módulo</small>
          </button>
        </aside>

        {drawerOpen && (
          <button
            type="button"
            className="operations-drawer-backdrop"
            onClick={() => setDrawerOpen(false)}
            aria-label="Cerrar menú administrativo"
          />
        )}

        <section className="operations-content">
          <div className="operations-toolbar">
            <button
              type="button"
              className="operations-menu-button"
              onClick={() => setDrawerOpen(true)}
            >
              ☰ Menú
            </button>

            <div>
              <span>Operación</span>
              <strong>Turnos y estaciones</strong>
            </div>
          </div>

          <section className="operations-card operations-title-card">
            <div className="operations-section-header">
              <div>
                <h2>{activeTabData?.label || 'Operación'}</h2>
                <p>{activeTabData?.helper}</p>
              </div>

              <button
                type="button"
                className="operations-small-button"
                onClick={loadOperationsData}
                disabled={loading || saving}
              >
                Actualizar
              </button>
            </div>

            <div className="operations-tabs">
              {operationTabs.map((tab) => (
                <button
                  type="button"
                  className={`operations-tab ${
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
            <section className="operations-alert operations-alert-error">
              {error}
            </section>
          )}

          {success && (
            <section className="operations-alert operations-alert-success">
              {success}
            </section>
          )}

          <section className="operations-stats-grid">
            <article className="operations-stat stat-success">
              <span>Turnos abiertos</span>
              <strong>{loading ? '...' : stats.openShifts}</strong>
              <small>Actualmente en operación</small>
            </article>

            <article className="operations-stat">
              <span>Turnos cerrados</span>
              <strong>{loading ? '...' : stats.closedShifts}</strong>
              <small>Registrados en el historial</small>
            </article>

            <article className="operations-stat stat-warning">
              <span>Estaciones activas</span>
              <strong>{loading ? '...' : stats.activeStations}</strong>
              <small>Disponibles para el KDS</small>
            </article>

            <article className="operations-stat stat-danger">
              <span>Estaciones inactivas</span>
              <strong>{loading ? '...' : stats.inactiveStations}</strong>
              <small>Fuera de operación</small>
            </article>
          </section>

          {activeTab === 'shifts' && (
            <section className="operations-two-column">
              <article className="operations-card">
                <div className="operations-section-header">
                  <div>
                    <h2>
                      {shiftForm.id ? 'Editar turno' : 'Abrir turno'}
                    </h2>

                    <p>
                      Define el usuario, la fecha de inicio y una nota
                      administrativa opcional.
                    </p>
                  </div>
                </div>

                <form
                  className="operations-form"
                  onSubmit={handleShiftSubmit}
                >
                  {shiftForm.id ? (
                    <div className="operations-readonly-field">
                      <span>Usuario asignado</span>
                      <strong>{shiftForm.userName}</strong>
                      <small>
                        El usuario no puede cambiarse después de abrir el turno.
                      </small>
                    </div>
                  ) : (
                    <label>
                      Usuario
                      <select
                        name="userId"
                        value={shiftForm.userId}
                        onChange={handleShiftFieldChange}
                      >
                        <option value="">
                          Mi usuario actual
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
                  )}

                  <label>
                    Fecha y hora de inicio
                    <input
                      type="datetime-local"
                      name="startedAt"
                      value={shiftForm.startedAt}
                      onChange={handleShiftFieldChange}
                      required
                    />
                  </label>

                  <label>
                    Notas
                    <textarea
                      name="notes"
                      value={shiftForm.notes}
                      onChange={handleShiftFieldChange}
                      placeholder="Observaciones del turno"
                      maxLength={255}
                      rows={4}
                    />
                  </label>

                  <div className="operations-form-actions">
                    <button
                      type="submit"
                      className="operations-primary-button"
                      disabled={saving}
                    >
                      {saving
                        ? 'Guardando...'
                        : shiftForm.id
                          ? 'Guardar cambios'
                          : 'Abrir turno'}
                    </button>

                    {shiftForm.id && (
                      <button
                        type="button"
                        className="operations-small-button"
                        onClick={startCreateShift}
                        disabled={saving}
                      >
                        Cancelar edición
                      </button>
                    )}
                  </div>
                </form>
              </article>

              <article className="operations-card">
                <div className="operations-section-header">
                  <div>
                    <h2>Historial de turnos</h2>
                    <p>
                      Busca por usuario o nota y filtra por estado.
                    </p>
                  </div>
                </div>

                <div className="operations-filters operations-shift-filters">
                  <label>
                    Buscar
                    <input
                      type="search"
                      value={shiftSearch}
                      onChange={(event) =>
                        setShiftSearch(event.target.value)
                      }
                      placeholder="Usuario o nota"
                    />
                  </label>

                  <label>
                    Estado
                    <select
                      value={shiftStatusFilter}
                      onChange={(event) =>
                        setShiftStatusFilter(event.target.value)
                      }
                    >
                      <option value="all">Todos</option>
                      <option value="open">Abiertos</option>
                      <option value="closed">Cerrados</option>
                    </select>
                  </label>

                  <label>
                    Usuario
                    <select
                      value={shiftUserFilter}
                      onChange={(event) =>
                        setShiftUserFilter(event.target.value)
                      }
                    >
                      <option value="all">Todos</option>

                      {users.map((currentUser) => (
                        <option
                          key={currentUser.id}
                          value={currentUser.id}
                        >
                          {getUserName(currentUser)}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                {loading ? (
                  <div className="operations-empty-state">
                    Cargando turnos...
                  </div>
                ) : filteredShifts.length > 0 ? (
                  <div className="operations-list">
                    {filteredShifts.map((shift) => (
                      <div
                        className="operations-list-item"
                        key={shift.id}
                      >
                        <div>
                          <strong>
                            {shift.user?.fullName ||
                              shift.user?.username ||
                              'Usuario sin nombre'}
                          </strong>

                          <p>
                            Inicio: {formatDateTime(shift.startedAt)}
                          </p>

                          <p>
                            {shift.endedAt
                              ? `Cierre: ${formatDateTime(shift.endedAt)}`
                              : `Duración actual: ${formatDuration(
                                  shift.startedAt,
                                  new Date(),
                                )}`}
                          </p>

                          {shift.notes && (
                            <p className="operations-note">
                              {shift.notes}
                            </p>
                          )}

                          <div className="operations-badges">
                            <span
                              className={
                                shift.isOpen
                                  ? 'badge-success'
                                  : 'badge-neutral'
                              }
                            >
                              {shift.isOpen ? 'Abierto' : 'Cerrado'}
                            </span>

                            <span>
                              {Number(shift.ordersCount ?? 0)} orden(es)
                            </span>
                          </div>
                        </div>

                        <div className="operations-row-actions">
                          {shift.isOpen && (
                            <>
                              <button
                                type="button"
                                onClick={() => startEditShift(shift)}
                                disabled={saving}
                              >
                                Editar
                              </button>

                              <button
                                type="button"
                                className="danger-action"
                                onClick={() => handleEndShift(shift)}
                                disabled={saving}
                              >
                                Cerrar turno
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="operations-empty-state">
                    No hay turnos que coincidan con los filtros.
                  </div>
                )}
              </article>
            </section>
          )}

          {activeTab === 'stations' && (
            <section className="operations-two-column">
              <article className="operations-card">
                <div className="operations-section-header">
                  <div>
                    <h2>
                      {stationForm.id
                        ? 'Editar estación'
                        : 'Nueva estación'}
                    </h2>

                    <p>
                      Crea áreas de preparación para cocina, barra u otros
                      puntos del KDS.
                    </p>
                  </div>
                </div>

                <form
                  className="operations-form"
                  onSubmit={handleStationSubmit}
                >
                  <label>
                    Código
                    <input
                      type="text"
                      name="code"
                      value={stationForm.code}
                      onChange={handleStationFieldChange}
                      placeholder="Ej: COCINA"
                      maxLength={30}
                      required
                    />
                    <small className="operations-field-help">
                      Solo letras, números y guion bajo.
                    </small>
                  </label>

                  <label>
                    Nombre
                    <input
                      type="text"
                      name="name"
                      value={stationForm.name}
                      onChange={handleStationFieldChange}
                      placeholder="Ej: Cocina principal"
                      maxLength={80}
                      required
                    />
                  </label>

                  {!stationForm.id && (
                    <label className="operations-switch">
                      <input
                        type="checkbox"
                        name="isActive"
                        checked={stationForm.isActive}
                        onChange={handleStationFieldChange}
                      />

                      <span>
                        Crear estación activa
                        <small>
                          Disponible para asignar productos del menú.
                        </small>
                      </span>
                    </label>
                  )}

                  {stationForm.id && (
                    <p className="operations-muted">
                      El estado activo o inactivo se modifica desde el listado.
                    </p>
                  )}

                  <div className="operations-form-actions">
                    <button
                      type="submit"
                      className="operations-primary-button"
                      disabled={saving}
                    >
                      {saving
                        ? 'Guardando...'
                        : stationForm.id
                          ? 'Guardar cambios'
                          : 'Crear estación'}
                    </button>

                    {stationForm.id && (
                      <button
                        type="button"
                        className="operations-small-button"
                        onClick={startCreateStation}
                        disabled={saving}
                      >
                        Cancelar edición
                      </button>
                    )}
                  </div>
                </form>
              </article>

              <article className="operations-card">
                <div className="operations-section-header">
                  <div>
                    <h2>Listado de estaciones</h2>
                    <p>
                      Busca por código o nombre y revisa sus asociaciones.
                    </p>
                  </div>
                </div>

                <div className="operations-filters">
                  <label>
                    Buscar
                    <input
                      type="search"
                      value={stationSearch}
                      onChange={(event) =>
                        setStationSearch(event.target.value)
                      }
                      placeholder="Código o nombre"
                    />
                  </label>

                  <label>
                    Estado
                    <select
                      value={stationStatusFilter}
                      onChange={(event) =>
                        setStationStatusFilter(event.target.value)
                      }
                    >
                      <option value="all">Todas</option>
                      <option value="active">Activas</option>
                      <option value="inactive">Inactivas</option>
                    </select>
                  </label>
                </div>

                {loading ? (
                  <div className="operations-empty-state">
                    Cargando estaciones...
                  </div>
                ) : filteredStations.length > 0 ? (
                  <div className="operations-list">
                    {filteredStations.map((station) => (
                      <div
                        className="operations-list-item"
                        key={station.id}
                      >
                        <div>
                          <strong>{station.name}</strong>

                          <p>Código: {station.code}</p>

                          <div className="operations-badges">
                            <span
                              className={
                                station.isActive
                                  ? 'badge-success'
                                  : 'badge-danger'
                              }
                            >
                              {station.isActive ? 'Activa' : 'Inactiva'}
                            </span>

                            <span>
                              {Number(station.menuItemsCount ?? 0)} producto(s)
                            </span>

                            <span>
                              {Number(station.orderItemsCount ?? 0)} detalle(s)
                              de orden
                            </span>
                          </div>
                        </div>

                        <div className="operations-row-actions">
                          <button
                            type="button"
                            onClick={() => startEditStation(station)}
                            disabled={saving}
                          >
                            Editar
                          </button>

                          <button
                            type="button"
                            className={
                              station.isActive ? 'danger-action' : ''
                            }
                            onClick={() =>
                              handleToggleStationStatus(station)
                            }
                            disabled={saving}
                          >
                            {station.isActive
                              ? 'Desactivar'
                              : 'Activar'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="operations-empty-state">
                    No hay estaciones que coincidan con los filtros.
                  </div>
                )}
              </article>
            </section>
          )}
        </section>
      </section>
    </main>
  )
}

function normalizeShifts(payload) {
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.shifts)) return payload.shifts
  if (Array.isArray(payload?.data)) return payload.data
  return []
}

function normalizeStations(payload) {
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.stations)) return payload.stations
  if (Array.isArray(payload?.data)) return payload.data
  return []
}

function normalizeUsers(payload) {
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.users)) return payload.users
  if (Array.isArray(payload?.items)) return payload.items
  if (Array.isArray(payload?.data)) return payload.data
  return []
}

function getUserName(currentUser) {
  return (
    currentUser.fullName ||
    `${currentUser.firstName ?? ''} ${currentUser.lastName ?? ''}`.trim() ||
    currentUser.username ||
    `Usuario ${currentUser.id}`
  )
}

function toDateTimeLocal(value) {
  if (!value) return ''

  const date = value instanceof Date ? value : new Date(value)

  if (Number.isNaN(date.getTime())) return ''

  const localDate = new Date(
    date.getTime() - date.getTimezoneOffset() * 60_000,
  )

  return localDate.toISOString().slice(0, 16)
}

function toIsoDateTime(value) {
  if (!value) return undefined

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) return undefined

  return date.toISOString()
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

function formatDuration(startedAt, endedAt) {
  const start = new Date(startedAt)
  const end = endedAt instanceof Date ? endedAt : new Date(endedAt)

  if (
    Number.isNaN(start.getTime()) ||
    Number.isNaN(end.getTime()) ||
    end < start
  ) {
    return 'Sin duración'
  }

  const totalMinutes = Math.floor((end.getTime() - start.getTime()) / 60_000)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60

  if (hours === 0) return `${minutes} min`
  return `${hours} h ${minutes} min`
}

function removeUndefined(payload) {
  return Object.fromEntries(
    Object.entries(payload).filter(([, value]) => value !== undefined),
  )
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
    error?.message ||
    fallback
  )
}