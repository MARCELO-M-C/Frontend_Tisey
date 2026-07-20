import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { useAuth } from '../auth/AuthContext'
import {
  createCabinRequest,
  createGuestRequest,
  createStayRequest,
  getCabinsRequest,
  getGuestsRequest,
  getStaysRequest,
  replaceStayGuestsRequest,
  updateCabinActiveRequest,
  updateCabinRequest,
  updateCabinStatusRequest,
  updateGuestRequest,
  updateStayRequest,
  updateStayStatusRequest,
} from '../services/lodgingService'
import './AdminLodgingPage.css'

const lodgingTabs = [
  {
    id: 'cabins',
    label: 'Cabañas',
    helper: 'Capacidad, precio, disponibilidad y estado operativo.',
  },
  {
    id: 'guests',
    label: 'Huéspedes',
    helper: 'Registro e información básica de los huéspedes.',
  },
  {
    id: 'stays',
    label: 'Estadías',
    helper: 'Reservas, entradas, salidas y huéspedes asociados.',
  },
]

const cabinStatuses = [
  {
    value: 'AVAILABLE',
    label: 'Disponible',
  },
  {
    value: 'OCCUPIED',
    label: 'Ocupada',
  },
  {
    value: 'MAINTENANCE',
    label: 'Mantenimiento',
  },
]

const stayStatuses = [
  {
    value: 'BOOKED',
    label: 'Reservada',
  },
  {
    value: 'CHECKED_IN',
    label: 'Hospedada',
  },
  {
    value: 'CHECKED_OUT',
    label: 'Finalizada',
  },
  {
    value: 'CANCELLED',
    label: 'Cancelada',
  },
]

const initialCabinForm = {
  id: '',
  cabinNumber: '',
  name: '',
  capacity: '',
  basePricePerNight: '',
  status: 'AVAILABLE',
  isActive: true,
}

const initialGuestForm = {
  id: '',
  fullName: '',
  idNumber: '',
  originPlace: '',
}

function createInitialStayForm() {
  const today = new Date()

  return {
    id: '',
    cabinId: '',
    primaryGuestId: '',
    checkInDate: toInputDate(today),
    checkOutDate: toInputDate(addDays(today, 1)),
    status: 'BOOKED',
    guestIds: [],
  }
}

export default function AdminLodgingPage() {
  const { user, logout } = useAuth()

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [activeTab, setActiveTab] = useState('cabins')

  const [cabins, setCabins] = useState([])
  const [guests, setGuests] = useState([])
  const [stays, setStays] = useState([])

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [cabinForm, setCabinForm] = useState(initialCabinForm)
  const [guestForm, setGuestForm] = useState(initialGuestForm)
  const [stayForm, setStayForm] = useState(createInitialStayForm)

  const [cabinSearch, setCabinSearch] = useState('')
  const [cabinStatusFilter, setCabinStatusFilter] = useState('all')
  const [cabinActiveFilter, setCabinActiveFilter] = useState('all')

  const [guestSearch, setGuestSearch] = useState('')

  const [staySearch, setStaySearch] = useState('')
  const [stayStatusFilter, setStayStatusFilter] = useState('all')
  const [stayCabinFilter, setStayCabinFilter] = useState('all')

  useEffect(() => {
    loadLodgingData()
  }, [])

  const activeTabData = lodgingTabs.find((tab) => tab.id === activeTab)

  const selectableCabins = useMemo(() => {
    return cabins.filter((cabin) => {
      const isCurrentCabin =
        cabinForm.id &&
        String(cabin.id) === String(stayForm.cabinId)

      return (
        isCurrentCabin ||
        (cabin.isActive && cabin.status !== 'MAINTENANCE')
      )
    })
  }, [cabins, cabinForm.id, stayForm.cabinId])

  const additionalGuestOptions = useMemo(() => {
    return guests.filter(
      (guest) =>
        String(guest.id) !== String(stayForm.primaryGuestId),
    )
  }, [guests, stayForm.primaryGuestId])

  const filteredCabins = useMemo(() => {
    const normalizedSearch = cabinSearch.trim().toLowerCase()

    return cabins.filter((cabin) => {
      const number = String(cabin.cabinNumber ?? '').toLowerCase()
      const name = String(cabin.name ?? '').toLowerCase()

      const matchesSearch =
        !normalizedSearch ||
        number.includes(normalizedSearch) ||
        name.includes(normalizedSearch)

      const matchesStatus =
        cabinStatusFilter === 'all' ||
        cabin.status === cabinStatusFilter

      const matchesActive =
        cabinActiveFilter === 'all' ||
        (cabinActiveFilter === 'active' && cabin.isActive) ||
        (cabinActiveFilter === 'inactive' && !cabin.isActive)

      return matchesSearch && matchesStatus && matchesActive
    })
  }, [
    cabins,
    cabinSearch,
    cabinStatusFilter,
    cabinActiveFilter,
  ])

  const filteredGuests = useMemo(() => {
    const normalizedSearch = guestSearch.trim().toLowerCase()

    return guests.filter((guest) => {
      const fullName = String(guest.fullName ?? '').toLowerCase()
      const idNumber = String(guest.idNumber ?? '').toLowerCase()
      const originPlace = String(guest.originPlace ?? '').toLowerCase()

      return (
        !normalizedSearch ||
        fullName.includes(normalizedSearch) ||
        idNumber.includes(normalizedSearch) ||
        originPlace.includes(normalizedSearch)
      )
    })
  }, [guests, guestSearch])

  const filteredStays = useMemo(() => {
    const normalizedSearch = staySearch.trim().toLowerCase()

    return stays.filter((stay) => {
      const guestName = String(
        stay.primaryGuest?.fullName ?? '',
      ).toLowerCase()

      const guestDocument = String(
        stay.primaryGuest?.idNumber ?? '',
      ).toLowerCase()

      const cabinNumber = String(
        stay.cabin?.cabinNumber ?? '',
      ).toLowerCase()

      const cabinName = String(
        stay.cabin?.name ?? '',
      ).toLowerCase()

      const matchesSearch =
        !normalizedSearch ||
        guestName.includes(normalizedSearch) ||
        guestDocument.includes(normalizedSearch) ||
        cabinNumber.includes(normalizedSearch) ||
        cabinName.includes(normalizedSearch)

      const matchesStatus =
        stayStatusFilter === 'all' ||
        stay.status === stayStatusFilter

      const matchesCabin =
        stayCabinFilter === 'all' ||
        String(stay.cabin?.id) === String(stayCabinFilter)

      return matchesSearch && matchesStatus && matchesCabin
    })
  }, [
    stays,
    staySearch,
    stayStatusFilter,
    stayCabinFilter,
  ])

  const stats = useMemo(() => {
    return {
      availableCabins: cabins.filter(
        (cabin) =>
          cabin.isActive && cabin.status === 'AVAILABLE',
      ).length,

      occupiedCabins: cabins.filter(
        (cabin) => cabin.status === 'OCCUPIED',
      ).length,

      bookedStays: stays.filter(
        (stay) => stay.status === 'BOOKED',
      ).length,

      checkedInStays: stays.filter(
        (stay) => stay.status === 'CHECKED_IN',
      ).length,
    }
  }, [cabins, stays])

  async function loadLodgingData() {
    try {
      setLoading(true)
      setError('')

      const [
        cabinsPayload,
        guestsPayload,
        staysPayload,
      ] = await Promise.all([
        getCabinsRequest(),
        getGuestsRequest(),
        getStaysRequest(),
      ])

      setCabins(normalizeList(cabinsPayload, 'cabins'))
      setGuests(normalizeList(guestsPayload, 'guests'))
      setStays(normalizeList(staysPayload, 'stays'))
    } catch (requestError) {
      setError(
        getErrorMessage(
          requestError,
          'No se pudo cargar la información de hospedaje.',
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

  function handleCabinFieldChange(event) {
    const { name, value, type, checked } = event.target

    setCabinForm((current) => ({
      ...current,
      [name]: type === 'checkbox' ? checked : value,
    }))
  }

  function handleGuestFieldChange(event) {
    const { name, value } = event.target

    setGuestForm((current) => ({
      ...current,
      [name]: value,
    }))
  }

  function handleStayFieldChange(event) {
    const { name, value } = event.target

    setStayForm((current) => {
      if (name === 'primaryGuestId') {
        return {
          ...current,
          primaryGuestId: value,
          guestIds: current.guestIds.filter(
            (guestId) => String(guestId) !== String(value),
          ),
        }
      }

      return {
        ...current,
        [name]: value,
      }
    })
  }

  function handleAdditionalGuestToggle(guestId) {
    const normalizedId = String(guestId)

    setStayForm((current) => {
      const alreadySelected =
        current.guestIds.includes(normalizedId)

      return {
        ...current,
        guestIds: alreadySelected
          ? current.guestIds.filter(
              (currentId) => currentId !== normalizedId,
            )
          : [...current.guestIds, normalizedId],
      }
    })
  }

  function startCreateCabin() {
    clearMessages()
    setCabinForm(initialCabinForm)
    setActiveTab('cabins')
  }

  function startEditCabin(cabin) {
    clearMessages()

    setCabinForm({
      id: cabin.id,
      cabinNumber: cabin.cabinNumber ?? '',
      name: cabin.name ?? '',
      capacity: cabin.capacity ?? '',
      basePricePerNight: cabin.basePricePerNight ?? '',
      status: cabin.status ?? 'AVAILABLE',
      isActive: Boolean(cabin.isActive),
    })

    setActiveTab('cabins')
    scrollToTop()
  }

  function startCreateGuest() {
    clearMessages()
    setGuestForm(initialGuestForm)
    setActiveTab('guests')
  }

  function startEditGuest(guest) {
    clearMessages()

    setGuestForm({
      id: guest.id,
      fullName: guest.fullName ?? '',
      idNumber: guest.idNumber ?? '',
      originPlace: guest.originPlace ?? '',
    })

    setActiveTab('guests')
    scrollToTop()
  }

  function startCreateStay() {
    clearMessages()
    setStayForm(createInitialStayForm())
    setActiveTab('stays')
  }

  function startEditStay(stay) {
    clearMessages()

    const additionalGuestIds = (stay.guests ?? [])
      .filter(
        (guest) =>
          String(guest.id) !==
          String(stay.primaryGuest?.id),
      )
      .map((guest) => String(guest.id))

    setStayForm({
      id: stay.id,
      cabinId: stay.cabin?.id ?? '',
      primaryGuestId: stay.primaryGuest?.id ?? '',
      checkInDate: stay.checkInDate ?? '',
      checkOutDate: stay.checkOutDate ?? '',
      status: stay.status ?? 'BOOKED',
      guestIds: additionalGuestIds,
    })

    setActiveTab('stays')
    scrollToTop()
  }

  async function handleCabinSubmit(event) {
    event.preventDefault()
    clearMessages()

    const isEditing = Boolean(cabinForm.id)

    const cabinNumber = Number(cabinForm.cabinNumber)
    const capacity = Number(cabinForm.capacity)
    const name = cabinForm.name.trim()
    const basePrice = cabinForm.basePricePerNight.trim()

    if (
      !Number.isInteger(cabinNumber) ||
      cabinNumber < 1 ||
      cabinNumber > 9999
    ) {
      setError(
        'El número de cabaña debe ser un entero entre 1 y 9999.',
      )
      return
    }

    if (
      !Number.isInteger(capacity) ||
      capacity < 1 ||
      capacity > 100
    ) {
      setError(
        'La capacidad debe ser un entero entre 1 y 100.',
      )
      return
    }

    if (
      basePrice &&
      (!/^\d+(\.\d{1,2})?$/.test(basePrice) ||
        Number(basePrice) <= 0)
    ) {
      setError(
        'El precio debe ser mayor a cero y tener máximo dos decimales.',
      )
      return
    }

    const payload = {
      cabinNumber,
      name: name || null,
      capacity,
      basePricePerNight: basePrice || null,
    }

    try {
      setSaving(true)

      if (isEditing) {
        await updateCabinRequest(cabinForm.id, payload)
        setSuccess('Cabaña actualizada correctamente.')
      } else {
        await createCabinRequest({
          ...payload,
          status: cabinForm.status,
          isActive: cabinForm.isActive,
        })

        setSuccess('Cabaña creada correctamente.')
      }

      setCabinForm(initialCabinForm)
      await loadLodgingData()
    } catch (requestError) {
      setError(
        getErrorMessage(
          requestError,
          'No se pudo guardar la cabaña.',
        ),
      )
    } finally {
      setSaving(false)
    }
  }

  async function handleCabinStatusChange(cabin, nextStatus) {
    clearMessages()

    if (nextStatus === cabin.status) return

    try {
      setSaving(true)

      await updateCabinStatusRequest(cabin.id, nextStatus)

      setSuccess(
        `Estado actualizado a ${getCabinStatusLabel(nextStatus)}.`,
      )

      await loadLodgingData()
    } catch (requestError) {
      setError(
        getErrorMessage(
          requestError,
          'No se pudo cambiar el estado de la cabaña.',
        ),
      )
    } finally {
      setSaving(false)
    }
  }

  async function handleToggleCabinActive(cabin) {
    clearMessages()

    const action = cabin.isActive ? 'desactivar' : 'activar'

    const confirmed = window.confirm(
      `¿Deseas ${action} la cabaña ${cabin.cabinNumber}?`,
    )

    if (!confirmed) return

    try {
      setSaving(true)

      await updateCabinActiveRequest(
        cabin.id,
        !cabin.isActive,
      )

      setSuccess(
        cabin.isActive
          ? 'Cabaña desactivada correctamente.'
          : 'Cabaña activada correctamente.',
      )

      await loadLodgingData()
    } catch (requestError) {
      setError(
        getErrorMessage(
          requestError,
          'No se pudo cambiar el estado activo de la cabaña.',
        ),
      )
    } finally {
      setSaving(false)
    }
  }

  async function handleGuestSubmit(event) {
    event.preventDefault()
    clearMessages()

    const isEditing = Boolean(guestForm.id)
    const fullName = guestForm.fullName.trim()
    const idNumber = guestForm.idNumber.trim()
    const originPlace = guestForm.originPlace.trim()

    if (!fullName) {
      setError('El nombre completo del huésped es obligatorio.')
      return
    }

    try {
      setSaving(true)

      const payload = {
        fullName,
        idNumber: idNumber || null,
        originPlace: originPlace || null,
      }

      if (isEditing) {
        await updateGuestRequest(guestForm.id, payload)
        setSuccess('Huésped actualizado correctamente.')
      } else {
        await createGuestRequest(payload)
        setSuccess('Huésped registrado correctamente.')
      }

      setGuestForm(initialGuestForm)
      await loadLodgingData()
    } catch (requestError) {
      setError(
        getErrorMessage(
          requestError,
          'No se pudo guardar el huésped.',
        ),
      )
    } finally {
      setSaving(false)
    }
  }

  async function handleStaySubmit(event) {
    event.preventDefault()
    clearMessages()

    const isEditing = Boolean(stayForm.id)

    const cabinId = Number(stayForm.cabinId)
    const primaryGuestId = Number(stayForm.primaryGuestId)

    if (!cabinId) {
      setError('Debes seleccionar una cabaña.')
      return
    }

    if (!primaryGuestId) {
      setError('Debes seleccionar al huésped principal.')
      return
    }

    if (!stayForm.checkInDate || !stayForm.checkOutDate) {
      setError('Debes indicar las fechas de entrada y salida.')
      return
    }

    if (stayForm.checkOutDate <= stayForm.checkInDate) {
      setError(
        'La fecha de salida debe ser posterior a la fecha de entrada.',
      )
      return
    }

    const selectedCabin = cabins.find(
      (cabin) => String(cabin.id) === String(cabinId),
    )

    const additionalGuestIds = stayForm.guestIds
      .filter(
        (guestId) =>
          String(guestId) !== String(primaryGuestId),
      )
      .map(Number)

    const uniqueGuestIds = [
      ...new Set([primaryGuestId, ...additionalGuestIds]),
    ]

    if (
      selectedCabin &&
      uniqueGuestIds.length > Number(selectedCabin.capacity)
    ) {
      setError(
        `La cabaña permite máximo ${selectedCabin.capacity} huésped(es).`,
      )
      return
    }

    const payload = {
      cabinId,
      primaryGuestId,
      checkInDate: stayForm.checkInDate,
      checkOutDate: stayForm.checkOutDate,
    }

    try {
      setSaving(true)

      if (isEditing) {
        await updateStayRequest(stayForm.id, payload)

        await replaceStayGuestsRequest(
          stayForm.id,
          additionalGuestIds,
        )

        setSuccess('Estadía actualizada correctamente.')
      } else {
        await createStayRequest({
          ...payload,
          status: stayForm.status,
          guestIds: additionalGuestIds,
        })

        setSuccess('Estadía creada correctamente.')
      }

      setStayForm(createInitialStayForm())
      await loadLodgingData()
    } catch (requestError) {
      setError(
        getErrorMessage(
          requestError,
          'No se pudo guardar la estadía.',
        ),
      )
    } finally {
      setSaving(false)
    }
  }

  async function handleStayStatusChange(stay, nextStatus) {
    clearMessages()

    const confirmationMessages = {
      CHECKED_IN: '¿Deseas registrar el check-in de esta estadía?',
      CHECKED_OUT: '¿Deseas registrar el check-out de esta estadía?',
      CANCELLED: '¿Deseas cancelar esta estadía?',
    }

    const confirmed = window.confirm(
      confirmationMessages[nextStatus] ||
        '¿Deseas cambiar el estado de la estadía?',
    )

    if (!confirmed) return

    try {
      setSaving(true)

      await updateStayStatusRequest(stay.id, nextStatus)

      setSuccess(
        `Estadía actualizada a ${getStayStatusLabel(nextStatus)}.`,
      )

      if (String(stayForm.id) === String(stay.id)) {
        setStayForm(createInitialStayForm())
      }

      await loadLodgingData()
    } catch (requestError) {
      setError(
        getErrorMessage(
          requestError,
          'No se pudo cambiar el estado de la estadía.',
        ),
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="lodging-page">
      <section className="lodging-hero">
        <div>
          <span className="lodging-eyebrow">
            Hospedaje
          </span>

          <h1>Gestión de Hospedaje</h1>

          <p>
            Administra cabañas, huéspedes, reservaciones,
            entradas y salidas desde una misma vista.
          </p>

          <small className="lodging-session">
            Sesión:{' '}
            {user?.fullName ||
              user?.username ||
              'Administrador'}
          </small>
        </div>

        <div className="lodging-hero-actions">
          <Link
            to="/dashboard"
            className="btn lodging-secondary-button"
          >
            Volver al dashboard
          </Link>

          <button
            type="button"
            className="btn lodging-logout"
            onClick={logout}
          >
            Cerrar sesión
          </button>
        </div>
      </section>

      <section className="lodging-layout">
        <aside
          className={`lodging-sidebar ${
            drawerOpen ? 'is-open' : ''
          }`}
        >
          <div className="lodging-sidebar-header">
            <strong>Menú admin</strong>

            <button
              type="button"
              className="lodging-menu-close"
              onClick={() => setDrawerOpen(false)}
              aria-label="Cerrar menú"
            >
              ×
            </button>
          </div>

          <Link
            className="lodging-menu-link"
            to="/admin/access"
          >
            <span>Usuarios</span>
            <small>Usuarios y accesos</small>
          </Link>

          <Link
            className="lodging-menu-link"
            to="/admin/restaurant-tables"
          >
            <span>Restaurante</span>
            <small>Mesas</small>
          </Link>

          <Link
            className="lodging-menu-link"
            to="/admin/menu"
          >
            <span>Menú</span>
            <small>Productos y categorías</small>
          </Link>

          <Link
            className="lodging-menu-link"
            to="/admin/operations"
          >
            <span>Operación</span>
            <small>Turnos y estaciones</small>
          </Link>

          <button
            type="button"
            className="lodging-menu-item is-active"
          >
            <span>Hospedaje</span>
            <small>Cabañas, huéspedes y estadías</small>
          </button>

          <button
            type="button"
            className="lodging-menu-item"
            disabled
          >
            <span>Facturación</span>
            <small>Próximo módulo</small>
          </button>
        </aside>

        {drawerOpen && (
          <button
            type="button"
            className="lodging-drawer-backdrop"
            onClick={() => setDrawerOpen(false)}
            aria-label="Cerrar menú administrativo"
          />
        )}

        <section className="lodging-content">
          <div className="lodging-toolbar">
            <button
              type="button"
              className="lodging-menu-button"
              onClick={() => setDrawerOpen(true)}
            >
              ☰ Menú
            </button>

            <div>
              <span>Hospedaje</span>
              <strong>
                Cabañas, huéspedes y estadías
              </strong>
            </div>
          </div>

          <section className="lodging-card lodging-title-card">
            <div className="lodging-section-header">
              <div>
                <h2>
                  {activeTabData?.label || 'Hospedaje'}
                </h2>

                <p>{activeTabData?.helper}</p>
              </div>

              <button
                type="button"
                className="lodging-small-button"
                onClick={loadLodgingData}
                disabled={loading || saving}
              >
                Actualizar
              </button>
            </div>

            <div className="lodging-tabs">
              {lodgingTabs.map((tab) => (
                <button
                  type="button"
                  className={`lodging-tab ${
                    activeTab === tab.id
                      ? 'is-active'
                      : ''
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
            <section className="lodging-alert lodging-alert-error">
              {error}
            </section>
          )}

          {success && (
            <section className="lodging-alert lodging-alert-success">
              {success}
            </section>
          )}

          <section className="lodging-stats-grid">
            <article className="lodging-stat stat-success">
              <span>Cabañas disponibles</span>
              <strong>
                {loading ? '...' : stats.availableCabins}
              </strong>
              <small>Activas y listas para reservar</small>
            </article>

            <article className="lodging-stat stat-warning">
              <span>Cabañas ocupadas</span>
              <strong>
                {loading ? '...' : stats.occupiedCabins}
              </strong>
              <small>Actualmente con huéspedes</small>
            </article>

            <article className="lodging-stat">
              <span>Reservaciones</span>
              <strong>
                {loading ? '...' : stats.bookedStays}
              </strong>
              <small>Pendientes de check-in</small>
            </article>

            <article className="lodging-stat stat-danger">
              <span>Estadías activas</span>
              <strong>
                {loading ? '...' : stats.checkedInStays}
              </strong>
              <small>Huéspedes alojados</small>
            </article>
          </section>

          {activeTab === 'cabins' && (
            <section className="lodging-two-column">
              <article className="lodging-card">
                <div className="lodging-section-header">
                  <div>
                    <h2>
                      {cabinForm.id
                        ? 'Editar cabaña'
                        : 'Nueva cabaña'}
                    </h2>

                    <p>
                      Define número, capacidad y precio
                      base por noche.
                    </p>
                  </div>
                </div>

                <form
                  className="lodging-form"
                  onSubmit={handleCabinSubmit}
                >
                  <div className="lodging-form-grid">
                    <label>
                      Número de cabaña
                      <input
                        type="number"
                        name="cabinNumber"
                        value={cabinForm.cabinNumber}
                        onChange={handleCabinFieldChange}
                        min="1"
                        max="9999"
                        required
                      />
                    </label>

                    <label>
                      Capacidad
                      <input
                        type="number"
                        name="capacity"
                        value={cabinForm.capacity}
                        onChange={handleCabinFieldChange}
                        min="1"
                        max="100"
                        required
                      />
                    </label>
                  </div>

                  <label>
                    Nombre
                    <input
                      type="text"
                      name="name"
                      value={cabinForm.name}
                      onChange={handleCabinFieldChange}
                      placeholder="Ej: Cabaña El Mirador"
                      maxLength={80}
                    />
                  </label>

                  <label>
                    Precio base por noche
                    <input
                      type="text"
                      name="basePricePerNight"
                      value={cabinForm.basePricePerNight}
                      onChange={handleCabinFieldChange}
                      placeholder="Ej: 1200.00"
                    />
                  </label>

                  {!cabinForm.id && (
                    <>
                      <label>
                        Estado inicial
                        <select
                          name="status"
                          value={cabinForm.status}
                          onChange={handleCabinFieldChange}
                        >
                          {cabinStatuses.map((status) => (
                            <option
                              key={status.value}
                              value={status.value}
                            >
                              {status.label}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="lodging-switch">
                        <input
                          type="checkbox"
                          name="isActive"
                          checked={cabinForm.isActive}
                          onChange={handleCabinFieldChange}
                        />

                        <span>
                          Crear cabaña activa
                          <small>
                            Disponible para nuevas estadías.
                          </small>
                        </span>
                      </label>
                    </>
                  )}

                  {cabinForm.id && (
                    <p className="lodging-muted">
                      El estado operativo y la activación
                      se cambian desde el listado.
                    </p>
                  )}

                  <div className="lodging-form-actions">
                    <button
                      type="submit"
                      className="lodging-primary-button"
                      disabled={saving}
                    >
                      {saving
                        ? 'Guardando...'
                        : cabinForm.id
                          ? 'Guardar cambios'
                          : 'Crear cabaña'}
                    </button>

                    {cabinForm.id && (
                      <button
                        type="button"
                        className="lodging-small-button"
                        onClick={startCreateCabin}
                        disabled={saving}
                      >
                        Cancelar edición
                      </button>
                    )}
                  </div>
                </form>
              </article>

              <article className="lodging-card">
                <div className="lodging-section-header">
                  <div>
                    <h2>Listado de cabañas</h2>

                    <p>
                      Busca y filtra por estado operativo.
                    </p>
                  </div>
                </div>

                <div className="lodging-filters lodging-cabin-filters">
                  <label>
                    Buscar
                    <input
                      type="search"
                      value={cabinSearch}
                      onChange={(event) =>
                        setCabinSearch(event.target.value)
                      }
                      placeholder="Número o nombre"
                    />
                  </label>

                  <label>
                    Estado
                    <select
                      value={cabinStatusFilter}
                      onChange={(event) =>
                        setCabinStatusFilter(
                          event.target.value,
                        )
                      }
                    >
                      <option value="all">
                        Todos
                      </option>

                      {cabinStatuses.map((status) => (
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
                    Activación
                    <select
                      value={cabinActiveFilter}
                      onChange={(event) =>
                        setCabinActiveFilter(
                          event.target.value,
                        )
                      }
                    >
                      <option value="all">
                        Todas
                      </option>
                      <option value="active">
                        Activas
                      </option>
                      <option value="inactive">
                        Inactivas
                      </option>
                    </select>
                  </label>
                </div>

                {loading ? (
                  <div className="lodging-empty-state">
                    Cargando cabañas...
                  </div>
                ) : filteredCabins.length > 0 ? (
                  <div className="lodging-list">
                    {filteredCabins.map((cabin) => (
                      <div
                        className="lodging-list-item"
                        key={cabin.id}
                      >
                        <div className="lodging-list-main">
                          <strong>
                            Cabaña {cabin.cabinNumber}
                          </strong>

                          <p>
                            {cabin.name || 'Sin nombre'}
                            {' · '}
                            {cabin.capacity} persona(s)
                          </p>

                          <p>
                            {cabin.basePricePerNight
                              ? `${formatMoney(
                                  cabin.basePricePerNight,
                                )} por noche`
                              : 'Precio sin definir'}
                          </p>

                          <div className="lodging-badges">
                            <span
                              className={getCabinStatusClass(
                                cabin.status,
                              )}
                            >
                              {getCabinStatusLabel(
                                cabin.status,
                              )}
                            </span>

                            <span
                              className={
                                cabin.isActive
                                  ? 'badge-success'
                                  : 'badge-danger'
                              }
                            >
                              {cabin.isActive
                                ? 'Activa'
                                : 'Inactiva'}
                            </span>

                            <span>
                              {Number(
                                cabin.staysCount ?? 0,
                              )}{' '}
                              estadía(s)
                            </span>
                          </div>

                          <label className="lodging-inline-select">
                            Estado operativo
                            <select
                              value={cabin.status}
                              onChange={(event) =>
                                handleCabinStatusChange(
                                  cabin,
                                  event.target.value,
                                )
                              }
                              disabled={saving}
                            >
                              {cabinStatuses.map(
                                (status) => (
                                  <option
                                    key={status.value}
                                    value={status.value}
                                  >
                                    {status.label}
                                  </option>
                                ),
                              )}
                            </select>
                          </label>
                        </div>

                        <div className="lodging-row-actions">
                          <button
                            type="button"
                            onClick={() =>
                              startEditCabin(cabin)
                            }
                            disabled={saving}
                          >
                            Editar
                          </button>

                          <button
                            type="button"
                            className={
                              cabin.isActive
                                ? 'danger-action'
                                : ''
                            }
                            onClick={() =>
                              handleToggleCabinActive(cabin)
                            }
                            disabled={saving}
                          >
                            {cabin.isActive
                              ? 'Desactivar'
                              : 'Activar'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="lodging-empty-state">
                    No hay cabañas que coincidan con
                    los filtros.
                  </div>
                )}
              </article>
            </section>
          )}

          {activeTab === 'guests' && (
            <section className="lodging-two-column">
              <article className="lodging-card">
                <div className="lodging-section-header">
                  <div>
                    <h2>
                      {guestForm.id
                        ? 'Editar huésped'
                        : 'Nuevo huésped'}
                    </h2>

                    <p>
                      Registra la información principal del
                      huésped.
                    </p>
                  </div>
                </div>

                <form
                  className="lodging-form"
                  onSubmit={handleGuestSubmit}
                >
                  <label>
                    Nombre completo
                    <input
                      type="text"
                      name="fullName"
                      value={guestForm.fullName}
                      onChange={handleGuestFieldChange}
                      placeholder="Nombre y apellidos"
                      maxLength={160}
                      required
                    />
                  </label>

                  <label>
                    Documento de identidad
                    <input
                      type="text"
                      name="idNumber"
                      value={guestForm.idNumber}
                      onChange={handleGuestFieldChange}
                      placeholder="Cédula o pasaporte"
                      maxLength={40}
                    />
                  </label>

                  <label>
                    Lugar de procedencia
                    <input
                      type="text"
                      name="originPlace"
                      value={guestForm.originPlace}
                      onChange={handleGuestFieldChange}
                      placeholder="Ciudad o país"
                      maxLength={120}
                    />
                  </label>

                  <div className="lodging-form-actions">
                    <button
                      type="submit"
                      className="lodging-primary-button"
                      disabled={saving}
                    >
                      {saving
                        ? 'Guardando...'
                        : guestForm.id
                          ? 'Guardar cambios'
                          : 'Registrar huésped'}
                    </button>

                    {guestForm.id && (
                      <button
                        type="button"
                        className="lodging-small-button"
                        onClick={startCreateGuest}
                        disabled={saving}
                      >
                        Cancelar edición
                      </button>
                    )}
                  </div>
                </form>
              </article>

              <article className="lodging-card">
                <div className="lodging-section-header">
                  <div>
                    <h2>Listado de huéspedes</h2>

                    <p>
                      Busca por nombre, documento o lugar
                      de procedencia.
                    </p>
                  </div>
                </div>

                <div className="lodging-filters lodging-single-filter">
                  <label>
                    Buscar
                    <input
                      type="search"
                      value={guestSearch}
                      onChange={(event) =>
                        setGuestSearch(event.target.value)
                      }
                      placeholder="Nombre, documento o procedencia"
                    />
                  </label>
                </div>

                {loading ? (
                  <div className="lodging-empty-state">
                    Cargando huéspedes...
                  </div>
                ) : filteredGuests.length > 0 ? (
                  <div className="lodging-list">
                    {filteredGuests.map((guest) => (
                      <div
                        className="lodging-list-item"
                        key={guest.id}
                      >
                        <div>
                          <strong>{guest.fullName}</strong>

                          <p>
                            {guest.idNumber ||
                              'Sin documento registrado'}
                          </p>

                          <p>
                            {guest.originPlace ||
                              'Procedencia sin registrar'}
                          </p>

                          <div className="lodging-badges">
                            <span>
                              {Number(
                                guest.staysCount ?? 0,
                              )}{' '}
                              estadía(s)
                            </span>

                            <span>
                              {Number(
                                guest.primaryStaysCount ?? 0,
                              )}{' '}
                              como principal
                            </span>
                          </div>
                        </div>

                        <div className="lodging-row-actions">
                          <button
                            type="button"
                            onClick={() =>
                              startEditGuest(guest)
                            }
                            disabled={saving}
                          >
                            Editar
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="lodging-empty-state">
                    No hay huéspedes que coincidan con
                    la búsqueda.
                  </div>
                )}
              </article>
            </section>
          )}

          {activeTab === 'stays' && (
            <section className="lodging-two-column">
              <article className="lodging-card">
                <div className="lodging-section-header">
                  <div>
                    <h2>
                      {stayForm.id
                        ? 'Editar estadía'
                        : 'Nueva estadía'}
                    </h2>

                    <p>
                      Asigna una cabaña, huésped principal
                      y fechas.
                    </p>
                  </div>
                </div>

                <form
                  className="lodging-form"
                  onSubmit={handleStaySubmit}
                >
                  <label>
                    Cabaña
                    <select
                      name="cabinId"
                      value={stayForm.cabinId}
                      onChange={handleStayFieldChange}
                      required
                    >
                      <option value="">
                        Selecciona una cabaña
                      </option>

                      {selectableCabins.map((cabin) => (
                        <option
                          key={cabin.id}
                          value={cabin.id}
                        >
                          Cabaña {cabin.cabinNumber}
                          {cabin.name
                            ? ` - ${cabin.name}`
                            : ''}
                          {' · '}
                          {cabin.capacity} persona(s)
                          {' · '}
                          {getCabinStatusLabel(
                            cabin.status,
                          )}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label>
                    Huésped principal
                    <select
                      name="primaryGuestId"
                      value={stayForm.primaryGuestId}
                      onChange={handleStayFieldChange}
                      required
                    >
                      <option value="">
                        Selecciona un huésped
                      </option>

                      {guests.map((guest) => (
                        <option
                          key={guest.id}
                          value={guest.id}
                        >
                          {guest.fullName}
                          {guest.idNumber
                            ? ` - ${guest.idNumber}`
                            : ''}
                        </option>
                      ))}
                    </select>
                  </label>

                  <div className="lodging-form-grid">
                    <label>
                      Fecha de entrada
                      <input
                        type="date"
                        name="checkInDate"
                        value={stayForm.checkInDate}
                        onChange={handleStayFieldChange}
                        required
                      />
                    </label>

                    <label>
                      Fecha de salida
                      <input
                        type="date"
                        name="checkOutDate"
                        value={stayForm.checkOutDate}
                        onChange={handleStayFieldChange}
                        required
                      />
                    </label>
                  </div>

                  {!stayForm.id ? (
                    <label>
                      Estado inicial
                      <select
                        name="status"
                        value={stayForm.status}
                        onChange={handleStayFieldChange}
                      >
                        <option value="BOOKED">
                          Reservada
                        </option>

                        <option value="CHECKED_IN">
                          Registrar entrada inmediata
                        </option>
                      </select>
                    </label>
                  ) : (
                    <div className="lodging-readonly-field">
                      <span>Estado actual</span>
                      <strong>
                        {getStayStatusLabel(
                          stayForm.status,
                        )}
                      </strong>

                      <small>
                        El estado se cambia desde el listado.
                      </small>
                    </div>
                  )}

                  <fieldset className="lodging-check-group">
                    <legend>
                      Huéspedes adicionales
                    </legend>

                    {!stayForm.primaryGuestId ? (
                      <p className="lodging-muted">
                        Selecciona primero al huésped
                        principal.
                      </p>
                    ) : additionalGuestOptions.length > 0 ? (
                      <div className="lodging-guest-check-grid">
                        {additionalGuestOptions.map(
                          (guest) => {
                            const guestId = String(
                              guest.id,
                            )

                            return (
                              <label
                                className="lodging-check-item"
                                key={guest.id}
                              >
                                <input
                                  type="checkbox"
                                  checked={stayForm.guestIds.includes(
                                    guestId,
                                  )}
                                  onChange={() =>
                                    handleAdditionalGuestToggle(
                                      guestId,
                                    )
                                  }
                                />

                                <span>
                                  <strong>
                                    {guest.fullName}
                                  </strong>

                                  <small>
                                    {guest.idNumber ||
                                      'Sin documento'}
                                  </small>
                                </span>
                              </label>
                            )
                          },
                        )}
                      </div>
                    ) : (
                      <p className="lodging-muted">
                        No hay otros huéspedes registrados.
                      </p>
                    )}
                  </fieldset>

                  <div className="lodging-capacity-note">
                    <span>Ocupación seleccionada</span>

                    <strong>
                      {1 + stayForm.guestIds.length}{' '}
                      huésped(es)
                    </strong>
                  </div>

                  <div className="lodging-form-actions">
                    <button
                      type="submit"
                      className="lodging-primary-button"
                      disabled={saving}
                    >
                      {saving
                        ? 'Guardando...'
                        : stayForm.id
                          ? 'Guardar cambios'
                          : 'Crear estadía'}
                    </button>

                    {stayForm.id && (
                      <button
                        type="button"
                        className="lodging-small-button"
                        onClick={startCreateStay}
                        disabled={saving}
                      >
                        Cancelar edición
                      </button>
                    )}
                  </div>
                </form>
              </article>

              <article className="lodging-card">
                <div className="lodging-section-header">
                  <div>
                    <h2>Listado de estadías</h2>

                    <p>
                      Consulta reservas, alojamientos y
                      salidas.
                    </p>
                  </div>
                </div>

                <div className="lodging-filters lodging-stay-filters">
                  <label>
                    Buscar
                    <input
                      type="search"
                      value={staySearch}
                      onChange={(event) =>
                        setStaySearch(event.target.value)
                      }
                      placeholder="Huésped o cabaña"
                    />
                  </label>

                  <label>
                    Estado
                    <select
                      value={stayStatusFilter}
                      onChange={(event) =>
                        setStayStatusFilter(
                          event.target.value,
                        )
                      }
                    >
                      <option value="all">
                        Todos
                      </option>

                      {stayStatuses.map((status) => (
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
                    Cabaña
                    <select
                      value={stayCabinFilter}
                      onChange={(event) =>
                        setStayCabinFilter(
                          event.target.value,
                        )
                      }
                    >
                      <option value="all">
                        Todas
                      </option>

                      {cabins.map((cabin) => (
                        <option
                          key={cabin.id}
                          value={cabin.id}
                        >
                          Cabaña {cabin.cabinNumber}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                {loading ? (
                  <div className="lodging-empty-state">
                    Cargando estadías...
                  </div>
                ) : filteredStays.length > 0 ? (
                  <div className="lodging-list">
                    {filteredStays.map((stay) => (
                      <div
                        className="lodging-list-item"
                        key={stay.id}
                      >
                        <div className="lodging-list-main">
                          <strong>
                            {stay.primaryGuest?.fullName ||
                              'Sin huésped principal'}
                          </strong>

                          <p>
                            Cabaña{' '}
                            {stay.cabin?.cabinNumber ||
                              'sin número'}
                            {stay.cabin?.name
                              ? ` · ${stay.cabin.name}`
                              : ''}
                          </p>

                          <p>
                            {formatDateOnly(
                              stay.checkInDate,
                            )}
                            {' → '}
                            {formatDateOnly(
                              stay.checkOutDate,
                            )}
                            {' · '}
                            {calculateNights(
                              stay.checkInDate,
                              stay.checkOutDate,
                            )}{' '}
                            noche(s)
                          </p>

                          <p>
                            {Number(
                              stay.guestsCount ?? 0,
                            )}{' '}
                            huésped(es)
                            {' · '}
                            {Number(
                              stay.ordersCount ?? 0,
                            )}{' '}
                            orden(es)
                            {' · '}
                            {Number(
                              stay.invoicesCount ?? 0,
                            )}{' '}
                            factura(s)
                          </p>

                          <div className="lodging-badges">
                            <span
                              className={getStayStatusClass(
                                stay.status,
                              )}
                            >
                              {getStayStatusLabel(
                                stay.status,
                              )}
                            </span>

                            {stay.createdByUser && (
                              <span>
                                Registrada por{' '}
                                {stay.createdByUser.fullName ||
                                  stay.createdByUser
                                    .username}
                              </span>
                            )}
                          </div>

                          {(stay.guests ?? []).length > 1 && (
                            <div className="lodging-guest-summary">
                              <span>
                                Huéspedes asociados:
                              </span>

                              <p>
                                {stay.guests
                                  .map(
                                    (guest) =>
                                      guest.fullName,
                                  )
                                  .join(', ')}
                              </p>
                            </div>
                          )}
                        </div>

                        <div className="lodging-row-actions">
                          {(stay.status === 'BOOKED' ||
                            stay.status ===
                              'CHECKED_IN') && (
                            <button
                              type="button"
                              onClick={() =>
                                startEditStay(stay)
                              }
                              disabled={saving}
                            >
                              Editar
                            </button>
                          )}

                          {stay.status === 'BOOKED' && (
                            <button
                              type="button"
                              className="success-action"
                              onClick={() =>
                                handleStayStatusChange(
                                  stay,
                                  'CHECKED_IN',
                                )
                              }
                              disabled={saving}
                            >
                              Check-in
                            </button>
                          )}

                          {stay.status ===
                            'CHECKED_IN' && (
                            <button
                              type="button"
                              className="success-action"
                              onClick={() =>
                                handleStayStatusChange(
                                  stay,
                                  'CHECKED_OUT',
                                )
                              }
                              disabled={saving}
                            >
                              Check-out
                            </button>
                          )}

                          {(stay.status === 'BOOKED' ||
                            stay.status ===
                              'CHECKED_IN') && (
                            <button
                              type="button"
                              className="danger-action"
                              onClick={() =>
                                handleStayStatusChange(
                                  stay,
                                  'CANCELLED',
                                )
                              }
                              disabled={saving}
                            >
                              Cancelar
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="lodging-empty-state">
                    No hay estadías que coincidan con
                    los filtros.
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

function normalizeList(payload, key) {
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.[key])) return payload[key]
  if (Array.isArray(payload?.items)) return payload.items
  if (Array.isArray(payload?.data)) return payload.data
  return []
}

function getCabinStatusLabel(status) {
  const labels = {
    AVAILABLE: 'Disponible',
    OCCUPIED: 'Ocupada',
    MAINTENANCE: 'Mantenimiento',
  }

  return labels[status] || status
}

function getCabinStatusClass(status) {
  const classes = {
    AVAILABLE: 'badge-success',
    OCCUPIED: 'badge-warning',
    MAINTENANCE: 'badge-danger',
  }

  return classes[status] || 'badge-neutral'
}

function getStayStatusLabel(status) {
  const labels = {
    BOOKED: 'Reservada',
    CHECKED_IN: 'Hospedada',
    CHECKED_OUT: 'Finalizada',
    CANCELLED: 'Cancelada',
  }

  return labels[status] || status
}

function getStayStatusClass(status) {
  const classes = {
    BOOKED: 'badge-warning',
    CHECKED_IN: 'badge-success',
    CHECKED_OUT: 'badge-neutral',
    CANCELLED: 'badge-danger',
  }

  return classes[status] || 'badge-neutral'
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

function formatDateOnly(value) {
  if (!value) return 'Sin fecha'

  const date = new Date(`${value}T00:00:00.000Z`)

  if (Number.isNaN(date.getTime())) return value

  return new Intl.DateTimeFormat('es-NI', {
    dateStyle: 'medium',
    timeZone: 'UTC',
  }).format(date)
}

function calculateNights(checkInDate, checkOutDate) {
  if (!checkInDate || !checkOutDate) return 0

  const start = new Date(`${checkInDate}T00:00:00.000Z`)
  const end = new Date(`${checkOutDate}T00:00:00.000Z`)

  if (
    Number.isNaN(start.getTime()) ||
    Number.isNaN(end.getTime()) ||
    end <= start
  ) {
    return 0
  }

  return Math.round(
    (end.getTime() - start.getTime()) / 86_400_000,
  )
}

function toInputDate(date) {
  const localDate = new Date(
    date.getTime() - date.getTimezoneOffset() * 60_000,
  )

  return localDate.toISOString().slice(0, 10)
}

function addDays(date, days) {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
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