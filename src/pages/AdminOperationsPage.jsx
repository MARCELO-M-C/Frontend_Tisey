import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { Link } from 'react-router'
import { useAuth } from '../auth/AuthContext'
import { canUsePermission } from '../auth/authHelpers'
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

const CURRENT_ROUTE = '/admin/operations'

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
        to: '/admin/restaurant-tables',
        icon: '🪑',
        permission: 'ADMIN_TABLES_MANAGE',
      },
      {
        title: 'Turnos y estaciones',
        description: 'Administra turnos, áreas y estaciones.',
        to: CURRENT_ROUTE,
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
        description: 'Gestiona estadías, cabañas, huéspedes y tarifas.',
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

const operationSections = [
  {
    id: 'shifts',
    label: 'Turnos',
    description: 'Apertura, seguimiento e historial del personal.',
    icon: '🕒',
  },
  {
    id: 'stations',
    label: 'Estaciones',
    description: 'Áreas de preparación utilizadas por el KDS.',
    icon: '🧭',
  },
]

const initialStationForm = {
  code: '',
  name: '',
  isActive: true,
}

function createInitialShiftForm() {
  return {
    userId: '',
    startedAt: toDateTimeLocal(new Date()),
    notes: '',
  }
}

export default function AdminOperationsPage() {
  const { user, logout } = useAuth()
  const menuRef = useRef(null)

  const [menuOpen, setMenuOpen] = useState(false)
  const [activeSection, setActiveSection] = useState('shifts')

  const [shifts, setShifts] = useState([])
  const [stations, setStations] = useState([])
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [modalError, setModalError] = useState('')

  const [activeModal, setActiveModal] = useState(null)
  const [selectedRecord, setSelectedRecord] = useState(null)
  const [shiftForm, setShiftForm] = useState(createInitialShiftForm)
  const [stationForm, setStationForm] = useState(initialStationForm)
  const [endShiftNotes, setEndShiftNotes] = useState('')

  const [shiftSearch, setShiftSearch] = useState('')
  const [shiftStatusFilter, setShiftStatusFilter] = useState('open')
  const [shiftUserFilter, setShiftUserFilter] = useState('all')
  const [stationSearch, setStationSearch] = useState('')
  const [stationStatusFilter, setStationStatusFilter] = useState('active')

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

  const activeUsers = useMemo(
    () => users.filter((currentUser) => currentUser.isActive),
    [users],
  )

  const filteredShifts = useMemo(() => {
    const search = shiftSearch.trim().toLowerCase()

    return shifts.filter((shift) => {
      const name = getUserName(shift.user).toLowerCase()
      const username = String(shift.user?.username ?? '').toLowerCase()
      const notes = String(shift.notes ?? '').toLowerCase()

      const matchesSearch =
        !search ||
        name.includes(search) ||
        username.includes(search) ||
        notes.includes(search)

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
    const search = stationSearch.trim().toLowerCase()

    return stations.filter((station) => {
      const code = String(station.code ?? '').toLowerCase()
      const name = String(station.name ?? '').toLowerCase()

      const matchesSearch =
        !search || code.includes(search) || name.includes(search)

      const matchesStatus =
        stationStatusFilter === 'all' ||
        (stationStatusFilter === 'active' && station.isActive) ||
        (stationStatusFilter === 'inactive' && !station.isActive)

      return matchesSearch && matchesStatus
    })
  }, [stations, stationSearch, stationStatusFilter])

  const stats = useMemo(
    () => ({
      openShifts: shifts.filter((shift) => shift.isOpen).length,
      closedShifts: shifts.filter((shift) => !shift.isOpen).length,
      activeStations: stations.filter((station) => station.isActive).length,
      inactiveStations: stations.filter((station) => !station.isActive).length,
    }),
    [shifts, stations],
  )

  const loadOperationsData = useCallback(
    async ({ preserveMessages = false } = {}) => {
      try {
        setLoading(true)
        setError('')
        if (!preserveMessages) setSuccess('')

        const [shiftsPayload, stationsPayload, usersPayload] =
          await Promise.all([
            getShiftsRequest(),
            getStationsRequest(),
            getUsersRequest(),
          ])

        setShifts(normalizeList(shiftsPayload, 'shifts'))
        setStations(normalizeList(stationsPayload, 'stations'))
        setUsers(normalizeUsers(usersPayload))
      } catch (requestError) {
        setError(
          getErrorMessage(
            requestError,
            'No se pudo cargar la información de turnos y estaciones.',
          ),
        )
      } finally {
        setLoading(false)
      }
    },
    [],
  )

  const closeModal = useCallback(() => {
    if (saving) return
    setActiveModal(null)
    setSelectedRecord(null)
    setModalError('')
    setEndShiftNotes('')
    setShiftForm(createInitialShiftForm())
    setStationForm(initialStationForm)
  }, [saving])

  useEffect(() => {
    loadOperationsData()
  }, [loadOperationsData])

  useEffect(() => {
    function handlePointerDown(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setMenuOpen(false)
      }
    }

    function handleKeyDown(event) {
      if (event.key !== 'Escape') return
      setMenuOpen(false)
      if (activeModal) closeModal()
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [activeModal, closeModal])

  useEffect(() => {
    if (!activeModal) return undefined

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [activeModal])

  function clearPageMessages() {
    setError('')
    setSuccess('')
  }

  function handleSectionChange(sectionId) {
    clearPageMessages()
    setActiveSection(sectionId)
  }

  function openCreateShiftModal() {
    clearPageMessages()
    setModalError('')
    setSelectedRecord(null)
    setShiftForm(createInitialShiftForm())
    setActiveModal('create-shift')
  }

  function openEditShiftModal(shift) {
    clearPageMessages()
    setModalError('')
    setSelectedRecord(shift)
    setShiftForm({
      userId: String(shift.user?.id ?? ''),
      startedAt: toDateTimeLocal(shift.startedAt),
      notes: shift.notes ?? '',
    })
    setActiveModal('edit-shift')
  }

  function openShiftDetailModal(shift) {
    clearPageMessages()
    setModalError('')
    setSelectedRecord(shift)
    setActiveModal('detail-shift')
  }

  function openEndShiftModal(shift) {
    clearPageMessages()
    setModalError('')
    setSelectedRecord(shift)
    setEndShiftNotes(shift.notes ?? '')
    setActiveModal('end-shift')
  }

  function openCreateStationModal() {
    clearPageMessages()
    setModalError('')
    setSelectedRecord(null)
    setStationForm(initialStationForm)
    setActiveModal('create-station')
  }

  function openEditStationModal(station) {
    clearPageMessages()
    setModalError('')
    setSelectedRecord(station)
    setStationForm({
      code: station.code ?? '',
      name: station.name ?? '',
      isActive: Boolean(station.isActive),
    })
    setActiveModal('edit-station')
  }

  function openStationDetailModal(station) {
    clearPageMessages()
    setModalError('')
    setSelectedRecord(station)
    setActiveModal('detail-station')
  }

  function openStationStatusModal(station) {
    clearPageMessages()
    setModalError('')
    setSelectedRecord(station)
    setActiveModal('status-station')
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

  async function handleShiftSubmit(event) {
    event.preventDefault()
    setModalError('')

    const startedAt = shiftForm.startedAt
      ? toIsoDateTime(shiftForm.startedAt)
      : undefined
    const notes = shiftForm.notes.trim()

    if (!startedAt) {
      setModalError('Indica una fecha y hora de inicio válida.')
      return
    }

    const isEditing = activeModal === 'edit-shift' && selectedRecord

    try {
      setSaving(true)

      if (isEditing) {
        await updateShiftRequest(selectedRecord.id, {
          startedAt,
          notes: notes || null,
        })
      } else {
        const payload = {
          startedAt,
          notes: notes || null,
        }

        if (shiftForm.userId) {
          payload.userId = Number(shiftForm.userId)
        }

        await createShiftRequest(payload)
      }

      const successMessage = isEditing
        ? 'Turno actualizado correctamente.'
        : 'Turno abierto correctamente.'

      setActiveModal(null)
      setSelectedRecord(null)
      setModalError('')
      setShiftForm(createInitialShiftForm())
      setSuccess(successMessage)
      await loadOperationsData({ preserveMessages: true })
    } catch (requestError) {
      setModalError(
        getErrorMessage(requestError, 'No se pudo guardar el turno.'),
      )
    } finally {
      setSaving(false)
    }
  }

  async function handleEndShiftSubmit() {
    if (!selectedRecord) return

    try {
      setSaving(true)
      setModalError('')

      await endShiftRequest(selectedRecord.id, {
        notes: endShiftNotes.trim() || null,
      })

      setActiveModal(null)
      setSelectedRecord(null)
      setEndShiftNotes('')
      setSuccess('Turno cerrado correctamente.')
      await loadOperationsData({ preserveMessages: true })
    } catch (requestError) {
      setModalError(
        getErrorMessage(requestError, 'No se pudo cerrar el turno.'),
      )
    } finally {
      setSaving(false)
    }
  }

  async function handleStationSubmit(event) {
    event.preventDefault()
    setModalError('')

    const code = stationForm.code.trim().toUpperCase()
    const name = stationForm.name.trim()

    if (!code) {
      setModalError('El código de la estación es obligatorio.')
      return
    }

    if (!/^[A-Za-z0-9_]+$/.test(code)) {
      setModalError('Usa solo letras, números y guion bajo en el código.')
      return
    }

    if (!name) {
      setModalError('El nombre de la estación es obligatorio.')
      return
    }

    const isEditing = activeModal === 'edit-station' && selectedRecord

    try {
      setSaving(true)

      if (isEditing) {
        await updateStationRequest(selectedRecord.id, {
          code,
          name,
        })
      } else {
        await createStationRequest({
          code,
          name,
          isActive: stationForm.isActive,
        })
      }

      const successMessage = isEditing
        ? 'Estación actualizada correctamente.'
        : 'Estación creada correctamente.'

      setActiveModal(null)
      setSelectedRecord(null)
      setModalError('')
      setStationForm(initialStationForm)
      setSuccess(successMessage)
      await loadOperationsData({ preserveMessages: true })
    } catch (requestError) {
      setModalError(
        getErrorMessage(requestError, 'No se pudo guardar la estación.'),
      )
    } finally {
      setSaving(false)
    }
  }

  async function handleStationStatusSubmit() {
    if (!selectedRecord) return

    try {
      setSaving(true)
      setModalError('')

      const nextStatus = !selectedRecord.isActive
      await updateStationStatusRequest(selectedRecord.id, nextStatus)

      setActiveModal(null)
      setSelectedRecord(null)
      setSuccess(
        nextStatus
          ? 'Estación activada correctamente.'
          : 'Estación desactivada correctamente.',
      )
      await loadOperationsData({ preserveMessages: true })
    } catch (requestError) {
      setModalError(
        getErrorMessage(
          requestError,
          'No se pudo cambiar el estado de la estación.',
        ),
      )
    } finally {
      setSaving(false)
    }
  }

  const activeSectionData = operationSections.find(
    (section) => section.id === activeSection,
  )

  return (
    <main className="operations-page">
      <section className="operations-hero">
        <div>
          <span className="operations-eyebrow">Operación</span>
          <h1>Turnos y Estaciones</h1>
          <p>
            Consulta primero la operación registrada y abre únicamente la acción
            que necesites realizar.
          </p>
          <small className="operations-session">
            Sesión: {user?.fullName || user?.username || 'Administrador'}
          </small>
        </div>

        <div className="operations-hero-actions">
          <div className="operations-menu-wrapper" ref={menuRef}>
            <button
              type="button"
              className="btn operations-menu-button"
              onClick={() => setMenuOpen((current) => !current)}
              aria-expanded={menuOpen}
              aria-controls="operations-admin-menu"
            >
              <span aria-hidden="true">☰</span>
              Menú
            </button>

            {menuOpen && (
              <div
                className="operations-menu-panel"
                id="operations-admin-menu"
              >
                <div className="operations-menu-header">
                  <div>
                    <strong>Módulos del sistema</strong>
                    <p>Accede a las áreas habilitadas para tu cuenta.</p>
                  </div>
                  <button
                    type="button"
                    className="operations-menu-close"
                    onClick={() => setMenuOpen(false)}
                    aria-label="Cerrar menú"
                  >
                    ×
                  </button>
                </div>

                <div className="operations-menu-sections">
                  {menuSections.map((section) => (
                    <section
                      className="operations-menu-section"
                      key={section.title}
                    >
                      <h2>{section.title}</h2>
                      <div className="operations-menu-items">
                        {section.items.map((item) => (
                          <Link
                            to={item.to}
                            className={`operations-menu-item ${
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

          <Link
            to="/dashboard"
            className="btn operations-secondary-button"
          >
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

      <section className="operations-card operations-overview-card">
        <div className="operations-overview-heading">
          <span className="operations-section-eyebrow">Resumen operativo</span>
          <h2>Estado actual</h2>
          <p>
            Revisa los turnos de trabajo y las estaciones disponibles para el
            restaurante.
          </p>
        </div>

        <div className="operations-stats-grid">
          <StatCard
            label="Turnos abiertos"
            value={loading ? '...' : stats.openShifts}
            helper="Actualmente en curso"
            tone="success"
          />
          <StatCard
            label="Turnos cerrados"
            value={loading ? '...' : stats.closedShifts}
            helper="Guardados en el historial"
          />
          <StatCard
            label="Estaciones activas"
            value={loading ? '...' : stats.activeStations}
            helper="Disponibles para el KDS"
            tone="success"
          />
          <StatCard
            label="Estaciones inactivas"
            value={loading ? '...' : stats.inactiveStations}
            helper="Fuera de operación"
            tone="warning"
          />
        </div>
      </section>

      <nav
        className="operations-section-navigation"
        aria-label="Áreas de operación"
      >
        {operationSections.map((section) => {
          const count =
            section.id === 'shifts' ? stats.openShifts : stats.activeStations

          return (
            <button
              type="button"
              className={`operations-section-tab ${
                activeSection === section.id ? 'is-active' : ''
              }`}
              onClick={() => handleSectionChange(section.id)}
              key={section.id}
            >
              <span className="operations-section-tab-icon" aria-hidden="true">
                {section.icon}
              </span>
              <span>
                <strong>{section.label}</strong>
                <small>{section.description}</small>
              </span>
              <b>{loading ? '…' : count}</b>
            </button>
          )
        })}
      </nav>

      <section className="operations-card operations-management-card">
        <div className="operations-management-header">
          <div>
            <span className="operations-section-eyebrow">
              Gestión de operación
            </span>
            <h2>
              {activeSection === 'shifts'
                ? 'Turnos registrados'
                : 'Estaciones registradas'}
            </h2>
            <p>{activeSectionData?.description}</p>
          </div>

          <button
            type="button"
            className="operations-primary-button"
            onClick={
              activeSection === 'shifts'
                ? openCreateShiftModal
                : openCreateStationModal
            }
            disabled={saving}
          >
            {activeSection === 'shifts' ? '+ Abrir turno' : '+ Nueva estación'}
          </button>
        </div>

        {activeSection === 'shifts' ? (
          <>
            <div className="operations-filters operations-shift-filters">
              <label>
                Buscar
                <input
                  type="search"
                  value={shiftSearch}
                  onChange={(event) => setShiftSearch(event.target.value)}
                  placeholder="Usuario o nota..."
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
                  <option value="open">Abiertos</option>
                  <option value="closed">Cerrados</option>
                  <option value="all">Todos</option>
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
                    <option key={currentUser.id} value={currentUser.id}>
                      {getUserName(currentUser)}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="operations-results-summary">
              {loading
                ? 'Cargando turnos...'
                : `${filteredShifts.length} de ${shifts.length} turno(s)`}
            </div>

            {loading ? (
              <div className="operations-empty-state">Cargando turnos...</div>
            ) : filteredShifts.length > 0 ? (
              <div className="operations-table" role="table">
                <div
                  className="operations-table-head operations-shift-grid"
                  role="row"
                >
                  <span>Usuario</span>
                  <span>Inicio</span>
                  <span>Duración</span>
                  <span>Órdenes</span>
                  <span>Estado</span>
                  <span>Acciones</span>
                </div>

                <div className="operations-table-body">
                  {filteredShifts.map((shift) => (
                    <article
                      className="operations-table-row operations-shift-grid"
                      key={shift.id}
                    >
                      <div
                        className="operations-identity"
                        data-label="Usuario"
                      >
                        <span className="operations-avatar" aria-hidden="true">
                          {getInitials(shift.user)}
                        </span>
                        <div>
                          <strong>{getUserName(shift.user)}</strong>
                          <small>@{shift.user?.username || 'sin usuario'}</small>
                        </div>
                      </div>

                      <div className="operations-cell" data-label="Inicio">
                        <strong>{formatDateTime(shift.startedAt)}</strong>
                      </div>

                      <div className="operations-cell" data-label="Duración">
                        <strong>
                          {formatDuration(
                            shift.startedAt,
                            shift.endedAt || new Date(),
                          )}
                        </strong>
                        <small>{shift.isOpen ? 'En curso' : 'Finalizado'}</small>
                      </div>

                      <div className="operations-cell" data-label="Órdenes">
                        <strong>{Number(shift.ordersCount ?? 0)}</strong>
                        <small>asociadas</small>
                      </div>

                      <div className="operations-cell" data-label="Estado">
                        <span
                          className={`operations-status ${
                            shift.isOpen ? 'is-active' : 'is-neutral'
                          }`}
                        >
                          {shift.isOpen ? 'Abierto' : 'Cerrado'}
                        </span>
                      </div>

                      <div
                        className="operations-row-actions"
                        data-label="Acciones"
                      >
                        <button
                          type="button"
                          onClick={() => openShiftDetailModal(shift)}
                        >
                          Ver detalle
                        </button>

                        {shift.isOpen && (
                          <>
                            <button
                              type="button"
                              onClick={() => openEditShiftModal(shift)}
                              disabled={saving}
                            >
                              Editar
                            </button>
                            <button
                              type="button"
                              className="is-danger"
                              onClick={() => openEndShiftModal(shift)}
                              disabled={saving}
                            >
                              Cerrar turno
                            </button>
                          </>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            ) : (
              <div className="operations-empty-state">
                No hay turnos que coincidan con los filtros.
              </div>
            )}
          </>
        ) : (
          <>
            <div className="operations-filters operations-station-filters">
              <label>
                Buscar
                <input
                  type="search"
                  value={stationSearch}
                  onChange={(event) => setStationSearch(event.target.value)}
                  placeholder="Código o nombre..."
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
                  <option value="active">Activas</option>
                  <option value="inactive">Inactivas</option>
                  <option value="all">Todas</option>
                </select>
              </label>
            </div>

            <div className="operations-results-summary">
              {loading
                ? 'Cargando estaciones...'
                : `${filteredStations.length} de ${stations.length} estación(es)`}
            </div>

            {loading ? (
              <div className="operations-empty-state">
                Cargando estaciones...
              </div>
            ) : filteredStations.length > 0 ? (
              <div className="operations-table" role="table">
                <div
                  className="operations-table-head operations-station-grid"
                  role="row"
                >
                  <span>Estación</span>
                  <span>Productos</span>
                  <span>Historial</span>
                  <span>Estado</span>
                  <span>Acciones</span>
                </div>

                <div className="operations-table-body">
                  {filteredStations.map((station) => (
                    <article
                      className="operations-table-row operations-station-grid"
                      key={station.id}
                    >
                      <div
                        className="operations-station-identity"
                        data-label="Estación"
                      >
                        <span className="operations-code">{station.code}</span>
                        <div>
                          <strong>{station.name}</strong>
                          <small>Área de preparación</small>
                        </div>
                      </div>

                      <div className="operations-cell" data-label="Productos">
                        <strong>{Number(station.menuItemsCount ?? 0)}</strong>
                        <small>del menú</small>
                      </div>

                      <div className="operations-cell" data-label="Historial">
                        <strong>{Number(station.orderItemsCount ?? 0)}</strong>
                        <small>ítems procesados</small>
                      </div>

                      <div className="operations-cell" data-label="Estado">
                        <span
                          className={`operations-status ${
                            station.isActive ? 'is-active' : 'is-inactive'
                          }`}
                        >
                          {station.isActive ? 'Activa' : 'Inactiva'}
                        </span>
                      </div>

                      <div
                        className="operations-row-actions"
                        data-label="Acciones"
                      >
                        <button
                          type="button"
                          onClick={() => openStationDetailModal(station)}
                        >
                          Ver detalle
                        </button>
                        <button
                          type="button"
                          onClick={() => openEditStationModal(station)}
                          disabled={saving}
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          className={station.isActive ? 'is-danger' : 'is-success'}
                          onClick={() => openStationStatusModal(station)}
                          disabled={saving}
                        >
                          {station.isActive ? 'Desactivar' : 'Activar'}
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            ) : (
              <div className="operations-empty-state">
                No hay estaciones que coincidan con los filtros.
              </div>
            )}
          </>
        )}
      </section>

      {activeModal && (
        <ModalShell
          title={getModalTitle(activeModal)}
          subtitle={getModalSubtitle(activeModal, selectedRecord)}
          wide={
            activeModal === 'create-shift' ||
            activeModal === 'edit-shift'
          }
          onClose={closeModal}
          saving={saving}
        >
          {modalError && (
            <div className="operations-modal-error">{modalError}</div>
          )}

          {(activeModal === 'create-shift' ||
            activeModal === 'edit-shift') && (
            <form
              className="operations-form"
              onSubmit={handleShiftSubmit}
            >
              <section className="operations-form-section">
                <div className="operations-form-section-heading">
                  <span>1</span>
                  <div>
                    <strong>Responsable</strong>
                    <small>
                      Define a quién pertenece el turno de trabajo.
                    </small>
                  </div>
                </div>

                {activeModal === 'edit-shift' ? (
                  <div className="operations-readonly-field">
                    <span>Usuario</span>
                    <strong>{getUserName(selectedRecord?.user)}</strong>
                    <small>
                      El responsable no cambia después de abrir el turno.
                    </small>
                  </div>
                ) : (
                  <label className="operations-field">
                    Usuario
                    <select
                      name="userId"
                      value={shiftForm.userId}
                      onChange={handleShiftFieldChange}
                    >
                      <option value="">Mi usuario actual</option>
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
              </section>

              <section className="operations-form-section">
                <div className="operations-form-section-heading">
                  <span>2</span>
                  <div>
                    <strong>Inicio y notas</strong>
                    <small>
                      Ajusta la hora de inicio y agrega una observación si hace
                      falta.
                    </small>
                  </div>
                </div>

                <div className="operations-form-grid">
                  <label className="operations-field">
                    Inicio
                    <input
                      type="datetime-local"
                      name="startedAt"
                      value={shiftForm.startedAt}
                      onChange={handleShiftFieldChange}
                      required
                    />
                  </label>

                  <label className="operations-field operations-field-full">
                    Notas
                    <textarea
                      name="notes"
                      value={shiftForm.notes}
                      onChange={handleShiftFieldChange}
                      placeholder="Observación opcional"
                      maxLength={255}
                      rows={4}
                    />
                  </label>
                </div>
              </section>

              <ModalActions
                saving={saving}
                onCancel={closeModal}
                primaryLabel={
                  activeModal === 'edit-shift'
                    ? 'Guardar cambios'
                    : 'Abrir turno'
                }
              />
            </form>
          )}

          {activeModal === 'detail-shift' && selectedRecord && (
            <div className="operations-detail-stack">
              <div className="operations-detail-hero">
                <span className="operations-avatar is-large" aria-hidden="true">
                  {getInitials(selectedRecord.user)}
                </span>
                <div>
                  <strong>{getUserName(selectedRecord.user)}</strong>
                  <p>@{selectedRecord.user?.username}</p>
                </div>
                <span
                  className={`operations-status ${
                    selectedRecord.isOpen ? 'is-active' : 'is-neutral'
                  }`}
                >
                  {selectedRecord.isOpen ? 'Abierto' : 'Cerrado'}
                </span>
              </div>

              <div className="operations-detail-grid">
                <DetailItem
                  label="Inicio"
                  value={formatDateTime(selectedRecord.startedAt)}
                />
                <DetailItem
                  label="Cierre"
                  value={
                    selectedRecord.endedAt
                      ? formatDateTime(selectedRecord.endedAt)
                      : 'En curso'
                  }
                />
                <DetailItem
                  label="Duración"
                  value={formatDuration(
                    selectedRecord.startedAt,
                    selectedRecord.endedAt || new Date(),
                  )}
                />
                <DetailItem
                  label="Órdenes"
                  value={String(Number(selectedRecord.ordersCount ?? 0))}
                />
              </div>

              <div className="operations-detail-note">
                <span>Notas</span>
                <p>{selectedRecord.notes || 'Sin observaciones.'}</p>
              </div>

              <div className="operations-modal-actions">
                <button
                  type="button"
                  className="operations-secondary-action"
                  onClick={closeModal}
                >
                  Cerrar
                </button>
                {selectedRecord.isOpen && (
                  <>
                    <button
                      type="button"
                      className="operations-secondary-action"
                      onClick={() => openEditShiftModal(selectedRecord)}
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      className="operations-danger-button"
                      onClick={() => openEndShiftModal(selectedRecord)}
                    >
                      Cerrar turno
                    </button>
                  </>
                )}
              </div>
            </div>
          )}

          {activeModal === 'end-shift' && selectedRecord && (
            <div className="operations-modal-stack">
              <div className="operations-confirmation-card">
                <span className="operations-confirmation-icon">✓</span>
                <div>
                  <strong>
                    ¿Cerrar el turno de {getUserName(selectedRecord.user)}?
                  </strong>
                  <p>
                    Se registrará la hora actual. El backend impedirá el cierre
                    si todavía existen órdenes abiertas.
                  </p>
                </div>
              </div>

              <div className="operations-detail-grid">
                <DetailItem
                  label="Inicio"
                  value={formatDateTime(selectedRecord.startedAt)}
                />
                <DetailItem
                  label="Duración actual"
                  value={formatDuration(
                    selectedRecord.startedAt,
                    new Date(),
                  )}
                />
              </div>

              <label className="operations-field">
                Nota final
                <textarea
                  value={endShiftNotes}
                  onChange={(event) => setEndShiftNotes(event.target.value)}
                  maxLength={255}
                  rows={3}
                  placeholder="Opcional"
                />
              </label>

              <div className="operations-modal-actions">
                <button
                  type="button"
                  className="operations-secondary-action"
                  onClick={closeModal}
                  disabled={saving}
                >
                  Volver
                </button>
                <button
                  type="button"
                  className="operations-danger-button"
                  onClick={handleEndShiftSubmit}
                  disabled={saving}
                >
                  {saving ? 'Cerrando...' : 'Cerrar turno'}
                </button>
              </div>
            </div>
          )}

          {(activeModal === 'create-station' ||
            activeModal === 'edit-station') && (
            <form
              className="operations-form"
              onSubmit={handleStationSubmit}
            >
              <section className="operations-form-section">
                <div className="operations-form-section-heading">
                  <span>1</span>
                  <div>
                    <strong>Identificación</strong>
                    <small>
                      Define un código corto y un nombre fácil de reconocer.
                    </small>
                  </div>
                </div>

                <div className="operations-form-grid">
                  <label className="operations-field">
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
                    <small>Solo letras, números y guion bajo.</small>
                  </label>

                  <label className="operations-field">
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
                </div>
              </section>

              {activeModal === 'create-station' && (
                <section className="operations-form-section">
                  <div className="operations-form-section-heading">
                    <span>2</span>
                    <div>
                      <strong>Estado inicial</strong>
                      <small>
                        Decide si estará disponible para el KDS desde ahora.
                      </small>
                    </div>
                  </div>

                  <label className="operations-switch">
                    <input
                      type="checkbox"
                      name="isActive"
                      checked={stationForm.isActive}
                      onChange={handleStationFieldChange}
                    />
                    <span className="operations-switch-control" />
                    <span>
                      <strong>Estación activa</strong>
                      <small>
                        Puede asociarse y utilizarse en la operación.
                      </small>
                    </span>
                  </label>
                </section>
              )}

              <ModalActions
                saving={saving}
                onCancel={closeModal}
                primaryLabel={
                  activeModal === 'edit-station'
                    ? 'Guardar cambios'
                    : 'Crear estación'
                }
              />
            </form>
          )}

          {activeModal === 'detail-station' && selectedRecord && (
            <div className="operations-detail-stack">
              <div className="operations-detail-hero">
                <span className="operations-code is-large">
                  {selectedRecord.code}
                </span>
                <div>
                  <strong>{selectedRecord.name}</strong>
                  <p>Estación de preparación</p>
                </div>
                <span
                  className={`operations-status ${
                    selectedRecord.isActive ? 'is-active' : 'is-inactive'
                  }`}
                >
                  {selectedRecord.isActive ? 'Activa' : 'Inactiva'}
                </span>
              </div>

              <div className="operations-detail-grid">
                <DetailItem
                  label="Productos asociados"
                  value={String(Number(selectedRecord.menuItemsCount ?? 0))}
                />
                <DetailItem
                  label="Ítems procesados"
                  value={String(Number(selectedRecord.orderItemsCount ?? 0))}
                />
              </div>

              <div className="operations-modal-actions">
                <button
                  type="button"
                  className="operations-secondary-action"
                  onClick={closeModal}
                >
                  Cerrar
                </button>
                <button
                  type="button"
                  className="operations-secondary-action"
                  onClick={() => openEditStationModal(selectedRecord)}
                >
                  Editar
                </button>
                <button
                  type="button"
                  className={
                    selectedRecord.isActive
                      ? 'operations-danger-button'
                      : 'operations-primary-button'
                  }
                  onClick={() => openStationStatusModal(selectedRecord)}
                >
                  {selectedRecord.isActive ? 'Desactivar' : 'Activar'}
                </button>
              </div>
            </div>
          )}

          {activeModal === 'status-station' && selectedRecord && (
            <div className="operations-modal-stack">
              <div className="operations-confirmation-card">
                <span className="operations-confirmation-icon">
                  {selectedRecord.isActive ? '!' : '✓'}
                </span>
                <div>
                  <strong>
                    {selectedRecord.isActive
                      ? `¿Desactivar ${selectedRecord.name}?`
                      : `¿Activar ${selectedRecord.name}?`}
                  </strong>
                  <p>
                    {selectedRecord.isActive
                      ? 'No podrá utilizarse en nuevas operaciones. Si todavía tiene productos activos asociados, el backend rechazará el cambio.'
                      : 'La estación volverá a estar disponible para la operación y el KDS.'}
                  </p>
                </div>
              </div>

              <div className="operations-detail-grid">
                <DetailItem label="Código" value={selectedRecord.code} />
                <DetailItem
                  label="Productos asociados"
                  value={String(Number(selectedRecord.menuItemsCount ?? 0))}
                />
              </div>

              <div className="operations-modal-actions">
                <button
                  type="button"
                  className="operations-secondary-action"
                  onClick={closeModal}
                  disabled={saving}
                >
                  Volver
                </button>
                <button
                  type="button"
                  className={
                    selectedRecord.isActive
                      ? 'operations-danger-button'
                      : 'operations-primary-button'
                  }
                  onClick={handleStationStatusSubmit}
                  disabled={saving}
                >
                  {saving
                    ? 'Guardando...'
                    : selectedRecord.isActive
                      ? 'Desactivar estación'
                      : 'Activar estación'}
                </button>
              </div>
            </div>
          )}
        </ModalShell>
      )}
    </main>
  )
}

function StatCard({ label, value, helper, tone = '' }) {
  return (
    <article
      className={`operations-stat ${tone ? `is-${tone}` : ''}`}
    >
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{helper}</small>
    </article>
  )
}

function ModalShell({
  title,
  subtitle,
  wide = false,
  onClose,
  saving,
  children,
}) {
  return (
    <div
      className="operations-modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <section
        className={`operations-modal ${wide ? 'is-wide' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <header className="operations-modal-header">
          <div>
            <h2>{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <button
            type="button"
            className="operations-modal-close"
            onClick={onClose}
            disabled={saving}
            aria-label="Cerrar ventana"
          >
            ×
          </button>
        </header>

        <div className="operations-modal-body">{children}</div>
      </section>
    </div>
  )
}

function ModalActions({ saving, onCancel, primaryLabel }) {
  return (
    <div className="operations-modal-actions">
      <button
        type="button"
        className="operations-secondary-action"
        onClick={onCancel}
        disabled={saving}
      >
        Cancelar
      </button>
      <button
        type="submit"
        className="operations-primary-button"
        disabled={saving}
      >
        {saving ? 'Guardando...' : primaryLabel}
      </button>
    </div>
  )
}

function DetailItem({ label, value }) {
  return (
    <div className="operations-detail-item">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function getModalTitle(activeModal) {
  const titles = {
    'create-shift': 'Abrir turno',
    'edit-shift': 'Editar turno',
    'detail-shift': 'Detalle del turno',
    'end-shift': 'Cerrar turno',
    'create-station': 'Nueva estación',
    'edit-station': 'Editar estación',
    'detail-station': 'Detalle de la estación',
    'status-station': 'Cambiar estado',
  }

  return titles[activeModal] || 'Operación'
}

function getModalSubtitle(activeModal, record) {
  if (activeModal === 'create-shift') {
    return 'Registra el inicio del turno para un usuario activo.'
  }

  if (
    activeModal === 'edit-shift' ||
    activeModal === 'detail-shift' ||
    activeModal === 'end-shift'
  ) {
    return record ? getUserName(record.user) : ''
  }

  if (activeModal === 'create-station') {
    return 'Crea un área de preparación para el KDS.'
  }

  if (
    activeModal === 'edit-station' ||
    activeModal === 'detail-station' ||
    activeModal === 'status-station'
  ) {
    return record ? `${record.code} · ${record.name}` : ''
  }

  return ''
}

function normalizeList(payload, key) {
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.[key])) return payload[key]
  if (Array.isArray(payload?.items)) return payload.items
  if (Array.isArray(payload?.data)) return payload.data
  return []
}

function normalizeUsers(payload) {
  return normalizeList(payload, 'users')
}

function getUserName(currentUser) {
  if (!currentUser) return 'Usuario sin nombre'

  return (
    currentUser.fullName ||
    `${currentUser.firstName ?? ''} ${currentUser.lastName ?? ''}`.trim() ||
    currentUser.username ||
    `Usuario ${currentUser.id ?? ''}`.trim()
  )
}

function getInitials(currentUser) {
  const name = getUserName(currentUser)
  const words = name.split(/\s+/).filter(Boolean)

  if (words.length === 0) return 'U'
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()

  return `${words[0][0] || ''}${words[1][0] || ''}`.toUpperCase()
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
  if (!value) return '—'

  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return '—'

  return new Intl.DateTimeFormat('es-NI', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

function formatDuration(startValue, endValue) {
  const start = new Date(startValue)
  const end = endValue instanceof Date ? endValue : new Date(endValue)

  if (
    Number.isNaN(start.getTime()) ||
    Number.isNaN(end.getTime()) ||
    end < start
  ) {
    return '—'
  }

  const totalMinutes = Math.floor((end - start) / 60_000)
  const days = Math.floor(totalMinutes / 1440)
  const hours = Math.floor((totalMinutes % 1440) / 60)
  const minutes = totalMinutes % 60

  if (days > 0) {
    return `${days} d ${hours} h`
  }

  if (hours > 0) {
    return `${hours} h ${minutes} min`
  }

  return `${minutes} min`
}

function getErrorMessage(error, fallbackMessage) {
  const responseMessage = error?.response?.data?.message
  if (typeof responseMessage === 'string' && responseMessage.trim()) {
    return responseMessage
  }

  if (typeof error?.message === 'string' && error.message.trim()) {
    return error.message
  }

  return fallbackMessage
}