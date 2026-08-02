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
import {
  createCabinRequest,
  createGuestRequest,
  createLodgingRateRequest,
  createStayRequest,
  getCabinsRequest,
  getCurrentLodgingRateRequest,
  getGuestsRequest,
  getLodgingRatesRequest,
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

const CURRENT_ROUTE = '/admin/lodging'

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
        description: 'Gestiona estadías, cabañas, huéspedes y tarifas.',
        to: CURRENT_ROUTE,
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

const lodgingSections = [
  {
    id: 'stays',
    label: 'Estadías',
    description: 'Reservas, entradas, salidas y cobro estimado.',
    icon: '🗓️',
  },
  {
    id: 'cabins',
    label: 'Cabañas',
    description: 'Capacidad, disponibilidad y estado operativo.',
    icon: '🏡',
  },
  {
    id: 'guests',
    label: 'Huéspedes',
    description: 'Registro e historial básico de las personas.',
    icon: '👥',
  },
  {
    id: 'rates',
    label: 'Tarifas',
    description: 'Precio por persona, edad mínima y vigencias.',
    icon: '💵',
  },
]

const cabinStatuses = [
  { value: 'AVAILABLE', label: 'Disponible' },
  { value: 'OCCUPIED', label: 'Ocupada' },
  { value: 'MAINTENANCE', label: 'Mantenimiento' },
]

const manualCabinStatuses = [
  { value: 'AVAILABLE', label: 'Disponible' },
  { value: 'MAINTENANCE', label: 'Mantenimiento' },
]

const stayStatuses = [
  { value: 'BOOKED', label: 'Reservada' },
  { value: 'CHECKED_IN', label: 'Hospedada' },
  { value: 'CHECKED_OUT', label: 'Finalizada' },
  { value: 'CANCELLED', label: 'Cancelada' },
]

const initialCabinForm = {
  cabinNumber: '',
  name: '',
  capacity: '',
  status: 'AVAILABLE',
  isActive: true,
}

const initialGuestForm = {
  fullName: '',
  idNumber: '',
  originPlace: '',
  birthDate: '',
}

function createInitialStayForm() {
  const today = new Date()

  return {
    cabinId: '',
    primaryGuestId: '',
    checkInDate: toInputDate(today),
    checkOutDate: toInputDate(addDays(today, 1)),
    status: 'BOOKED',
    guestIds: [],
  }
}

function createInitialRateForm() {
  return {
    amountPerPersonPerNight: '',
    minimumChargeableAge: '5',
    effectiveFrom: toInputDate(new Date()),
  }
}

export default function AdminLodgingPage() {
  const { user, logout } = useAuth()
  const menuRef = useRef(null)

  const [menuOpen, setMenuOpen] = useState(false)
  const [activeSection, setActiveSection] = useState('stays')

  const [cabins, setCabins] = useState([])
  const [guests, setGuests] = useState([])
  const [stays, setStays] = useState([])
  const [rates, setRates] = useState([])
  const [currentRate, setCurrentRate] = useState(null)

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [previewRateLoading, setPreviewRateLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [modalError, setModalError] = useState('')

  const [activeModal, setActiveModal] = useState(null)
  const [selectedRecord, setSelectedRecord] = useState(null)
  const [pendingStatus, setPendingStatus] = useState('')

  const [cabinForm, setCabinForm] = useState(initialCabinForm)
  const [guestForm, setGuestForm] = useState(initialGuestForm)
  const [stayForm, setStayForm] = useState(createInitialStayForm)
  const [rateForm, setRateForm] = useState(createInitialRateForm)
  const [previewRate, setPreviewRate] = useState(null)
  const [guestPickerSearch, setGuestPickerSearch] = useState('')

  const [staySearch, setStaySearch] = useState('')
  const [stayStatusFilter, setStayStatusFilter] = useState('all')
  const [stayCabinFilter, setStayCabinFilter] = useState('all')

  const [cabinSearch, setCabinSearch] = useState('')
  const [cabinStatusFilter, setCabinStatusFilter] = useState('all')
  const [cabinActiveFilter, setCabinActiveFilter] = useState('all')

  const [guestSearch, setGuestSearch] = useState('')
  const [rateStatusFilter, setRateStatusFilter] = useState('all')

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

  const closeModal = useCallback(() => {
    if (saving) return

    setActiveModal(null)
    setSelectedRecord(null)
    setPendingStatus('')
    setModalError('')
    setGuestPickerSearch('')
    setPreviewRate(null)
  }, [saving])

  const loadLodgingData = useCallback(
    async ({ preserveMessages = false } = {}) => {
      try {
        setLoading(true)
        setError('')
        if (!preserveMessages) setSuccess('')

        const [
          cabinsPayload,
          guestsPayload,
          staysPayload,
          ratesPayload,
          currentRatePayload,
        ] = await Promise.all([
          getCabinsRequest(),
          getGuestsRequest(),
          getStaysRequest(),
          getLodgingRatesRequest(),
          getCurrentLodgingRateRequest().catch((requestError) => {
            if (requestError?.response?.status === 404) return null
            throw requestError
          }),
        ])

        setCabins(normalizeList(cabinsPayload, 'cabins'))
        setGuests(normalizeList(guestsPayload, 'guests'))
        setStays(normalizeList(staysPayload, 'stays'))
        setRates(normalizeList(ratesPayload, 'rates'))
        setCurrentRate(currentRatePayload)
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
    },
    [],
  )

  useEffect(() => {
    loadLodgingData()
  }, [loadLodgingData])

  useEffect(() => {
    function handlePointerDown(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setMenuOpen(false)
      }
    }

    function handleKeyDown(event) {
      if (event.key !== 'Escape') return

      setMenuOpen(false)

      if (activeModal) {
        closeModal()
      }
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

  useEffect(() => {
    const shouldLoadPreviewRate =
      activeModal === 'create-stay' || activeModal === 'edit-stay'

    if (!shouldLoadPreviewRate || !stayForm.checkInDate) {
      setPreviewRate(null)
      return undefined
    }

    if (
      activeModal === 'edit-stay' &&
      selectedRecord &&
      selectedRecord.checkInDate === stayForm.checkInDate
    ) {
      setPreviewRate({
        id: selectedRecord.lodgingRateId,
        amountPerPersonPerNight:
          selectedRecord.ratePerPersonPerNight,
        minimumChargeableAge:
          selectedRecord.minimumChargeableAge,
        effectiveFrom:
          selectedRecord.lodgingRate?.effectiveFrom ??
          selectedRecord.checkInDate,
      })
      return undefined
    }

    let active = true

    async function loadPreviewRate() {
      try {
        setPreviewRateLoading(true)
        const payload = await getCurrentLodgingRateRequest(
          stayForm.checkInDate,
        )

        if (active) {
          setPreviewRate(payload)
          setModalError('')
        }
      } catch (requestError) {
        if (active) {
          setPreviewRate(null)
          setModalError(
            getErrorMessage(
              requestError,
              'No existe una tarifa vigente para la fecha de entrada.',
            ),
          )
        }
      } finally {
        if (active) setPreviewRateLoading(false)
      }
    }

    loadPreviewRate()

    return () => {
      active = false
    }
  }, [
    activeModal,
    selectedRecord,
    stayForm.checkInDate,
  ])

  const sectionCounts = useMemo(
    () => ({
      stays: stays.length,
      cabins: cabins.length,
      guests: guests.length,
      rates: rates.length,
    }),
    [cabins.length, guests.length, rates.length, stays.length],
  )

  const globalStats = useMemo(
    () => ({
      booked: stays.filter((stay) => stay.status === 'BOOKED').length,
      checkedIn: stays.filter(
        (stay) => stay.status === 'CHECKED_IN',
      ).length,
      availableCabins: cabins.filter(
        (cabin) =>
          cabin.isActive && cabin.status === 'AVAILABLE',
      ).length,
      currentRate: currentRate?.amountPerPersonPerNight ?? null,
    }),
    [cabins, currentRate, stays],
  )

  const filteredStays = useMemo(() => {
    const normalizedSearch = staySearch.trim().toLowerCase()

    return stays.filter((stay) => {
      const searchableValues = [
        stay.primaryGuest?.fullName,
        stay.primaryGuest?.idNumber,
        stay.cabin?.cabinNumber,
        stay.cabin?.name,
        stay.id,
      ]
        .map((value) => String(value ?? '').toLowerCase())
        .join(' ')

      const matchesSearch =
        !normalizedSearch ||
        searchableValues.includes(normalizedSearch)
      const matchesStatus =
        stayStatusFilter === 'all' ||
        stay.status === stayStatusFilter
      const matchesCabin =
        stayCabinFilter === 'all' ||
        String(stay.cabin?.id) === String(stayCabinFilter)

      return matchesSearch && matchesStatus && matchesCabin
    })
  }, [
    staySearch,
    stayStatusFilter,
    stayCabinFilter,
    stays,
  ])

  const filteredCabins = useMemo(() => {
    const normalizedSearch = cabinSearch.trim().toLowerCase()

    return cabins.filter((cabin) => {
      const searchableValues = [
        cabin.cabinNumber,
        cabin.name,
        cabin.id,
      ]
        .map((value) => String(value ?? '').toLowerCase())
        .join(' ')

      const matchesSearch =
        !normalizedSearch ||
        searchableValues.includes(normalizedSearch)
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
    cabinActiveFilter,
    cabinSearch,
    cabinStatusFilter,
    cabins,
  ])

  const filteredGuests = useMemo(() => {
    const normalizedSearch = guestSearch.trim().toLowerCase()

    return guests.filter((guest) => {
      const searchableValues = [
        guest.fullName,
        guest.idNumber,
        guest.originPlace,
        guest.birthDate,
        guest.id,
      ]
        .map((value) => String(value ?? '').toLowerCase())
        .join(' ')

      return (
        !normalizedSearch ||
        searchableValues.includes(normalizedSearch)
      )
    })
  }, [guestSearch, guests])

  const sortedRates = useMemo(
    () =>
      [...rates].sort((left, right) =>
        String(right.effectiveFrom).localeCompare(
          String(left.effectiveFrom),
        ),
      ),
    [rates],
  )

  const filteredRates = useMemo(() => {
    if (rateStatusFilter === 'all') return sortedRates

    return sortedRates.filter(
      (rate) =>
        getRateTimelineState(rate, currentRate) ===
        rateStatusFilter,
    )
  }, [currentRate, rateStatusFilter, sortedRates])

  const selectedCabin = useMemo(
    () =>
      cabins.find(
        (cabin) =>
          String(cabin.id) === String(stayForm.cabinId),
      ) ?? null,
    [cabins, stayForm.cabinId],
  )

  const selectedPrimaryGuest = useMemo(
    () =>
      guests.find(
        (guest) =>
          String(guest.id) ===
          String(stayForm.primaryGuestId),
      ) ?? null,
    [guests, stayForm.primaryGuestId],
  )

  const selectedAdditionalGuests = useMemo(
    () =>
      stayForm.guestIds
        .map((guestId) =>
          guests.find(
            (guest) =>
              String(guest.id) === String(guestId),
          ),
        )
        .filter(Boolean),
    [guests, stayForm.guestIds],
  )

  const selectedStayGuests = useMemo(() => {
    const byId = new Map()

    if (selectedPrimaryGuest) {
      byId.set(
        String(selectedPrimaryGuest.id),
        selectedPrimaryGuest,
      )
    }

    selectedAdditionalGuests.forEach((guest) => {
      byId.set(String(guest.id), guest)
    })

    return [...byId.values()]
  }, [selectedAdditionalGuests, selectedPrimaryGuest])

  const stayPreview = useMemo(() => {
    const nights = calculateNights(
      stayForm.checkInDate,
      stayForm.checkOutDate,
    )
    const minimumChargeableAge = Number(
      previewRate?.minimumChargeableAge ?? 5,
    )
    const chargeableGuests = selectedStayGuests.filter((guest) =>
      isGuestChargeable(
        guest,
        stayForm.checkInDate,
        minimumChargeableAge,
      ),
    )
    const amount = Number(
      previewRate?.amountPerPersonPerNight ?? 0,
    )

    return {
      nights,
      guestsCount: selectedStayGuests.length,
      chargeableGuestsCount: chargeableGuests.length,
      personNightsCount:
        nights * chargeableGuests.length,
      estimatedRoomTotal:
        nights * chargeableGuests.length * amount,
    }
  }, [
    previewRate,
    selectedStayGuests,
    stayForm.checkInDate,
    stayForm.checkOutDate,
  ])

  const selectableCabins = useMemo(
    () =>
      cabins.filter((cabin) => {
        const isCurrentCabin =
          selectedRecord &&
          String(cabin.id) ===
            String(selectedRecord.cabin?.id)

        if (isCurrentCabin) return true
        if (!cabin.isActive) return false
        if (cabin.status === 'MAINTENANCE') return false

        if (
          stayForm.status === 'CHECKED_IN' &&
          cabin.status === 'OCCUPIED'
        ) {
          return false
        }

        return true
      }),
    [cabins, selectedRecord, stayForm.status],
  )

  const guestPickerOptions = useMemo(() => {
    const normalizedSearch =
      guestPickerSearch.trim().toLowerCase()

    return guests.filter((guest) => {
      if (
        String(guest.id) ===
        String(stayForm.primaryGuestId)
      ) {
        return false
      }

      const searchableValues = [
        guest.fullName,
        guest.idNumber,
        guest.originPlace,
      ]
        .map((value) => String(value ?? '').toLowerCase())
        .join(' ')

      return (
        !normalizedSearch ||
        searchableValues.includes(normalizedSearch)
      )
    })
  }, [
    guestPickerSearch,
    guests,
    stayForm.primaryGuestId,
  ])

  function clearMessages() {
    setError('')
    setSuccess('')
    setModalError('')
  }

  function handleSectionChange(sectionId) {
    clearMessages()
    setActiveSection(sectionId)
  }

  function openModal(name, record = null) {
    clearMessages()
    setSelectedRecord(record)
    setPendingStatus('')
    setGuestPickerSearch('')

    if (name === 'create-cabin') {
      setCabinForm(initialCabinForm)
    }

    if (name === 'edit-cabin' && record) {
      setCabinForm({
        cabinNumber: record.cabinNumber ?? '',
        name: record.name ?? '',
        capacity: record.capacity ?? '',
        status: record.status ?? 'AVAILABLE',
        isActive: Boolean(record.isActive),
      })
    }

    if (name === 'cabin-status' && record) {
      setCabinForm((current) => ({
        ...current,
        status:
          record.status === 'MAINTENANCE'
            ? 'MAINTENANCE'
            : 'AVAILABLE',
      }))
    }

    if (name === 'create-guest') {
      setGuestForm(initialGuestForm)
    }

    if (name === 'edit-guest' && record) {
      setGuestForm({
        fullName: record.fullName ?? '',
        idNumber: record.idNumber ?? '',
        originPlace: record.originPlace ?? '',
        birthDate: record.birthDate ?? '',
      })
    }

    if (name === 'create-stay') {
      setStayForm(createInitialStayForm())
      setPreviewRate(currentRate)
    }

    if (name === 'edit-stay' && record) {
      setStayForm({
        cabinId: record.cabin?.id ?? '',
        primaryGuestId:
          record.primaryGuest?.id ?? '',
        checkInDate: record.checkInDate ?? '',
        checkOutDate: record.checkOutDate ?? '',
        status: record.status ?? 'BOOKED',
        guestIds: (record.guests ?? [])
          .filter(
            (guest) =>
              String(guest.id) !==
              String(record.primaryGuest?.id),
          )
          .map((guest) => String(guest.id)),
      })
      setPreviewRate({
        id: record.lodgingRateId,
        amountPerPersonPerNight:
          record.ratePerPersonPerNight,
        minimumChargeableAge:
          record.minimumChargeableAge,
        effectiveFrom:
          record.lodgingRate?.effectiveFrom ??
          record.checkInDate,
      })
    }

    if (name === 'stay-guests' && record) {
      setStayForm({
        cabinId: record.cabin?.id ?? '',
        primaryGuestId:
          record.primaryGuest?.id ?? '',
        checkInDate: record.checkInDate ?? '',
        checkOutDate: record.checkOutDate ?? '',
        status: record.status ?? 'BOOKED',
        guestIds: (record.guests ?? [])
          .filter(
            (guest) =>
              String(guest.id) !==
              String(record.primaryGuest?.id),
          )
          .map((guest) => String(guest.id)),
      })
    }

    if (name === 'create-rate') {
      setRateForm(createInitialRateForm())
    }

    setActiveModal(name)
  }

  function openStayStatusModal(stay, nextStatus) {
    clearMessages()
    setSelectedRecord(stay)
    setPendingStatus(nextStatus)
    setActiveModal('stay-status')
  }

  function handleCabinFieldChange(event) {
    const { name, value, type, checked } = event.target

    setCabinForm((current) => ({
      ...current,
      [name]:
        type === 'checkbox' ? checked : value,
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
            (guestId) =>
              String(guestId) !== String(value),
          ),
        }
      }

      if (name === 'status') {
        const next = {
          ...current,
          status: value,
        }

        if (value === 'CHECKED_IN') {
          const selected = cabins.find(
            (cabin) =>
              String(cabin.id) ===
              String(next.cabinId),
          )

          if (selected?.status === 'OCCUPIED') {
            next.cabinId = ''
          }
        }

        return next
      }

      return {
        ...current,
        [name]: value,
      }
    })
  }

  function handleRateFieldChange(event) {
    const { name, value } = event.target

    setRateForm((current) => ({
      ...current,
      [name]: value,
    }))
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
              (currentId) =>
                currentId !== normalizedId,
            )
          : [...current.guestIds, normalizedId],
      }
    })
  }

  function validateCabinForm() {
    const cabinNumber = Number(cabinForm.cabinNumber)
    const capacity = Number(cabinForm.capacity)
    const name = cabinForm.name.trim()

    if (
      !Number.isInteger(cabinNumber) ||
      cabinNumber < 1 ||
      cabinNumber > 9999
    ) {
      return {
        error:
          'El número de cabaña debe ser un entero entre 1 y 9999.',
      }
    }

    if (
      !Number.isInteger(capacity) ||
      capacity < 1 ||
      capacity > 100
    ) {
      return {
        error:
          'La capacidad debe ser un entero entre 1 y 100.',
      }
    }

    return {
      payload: {
        cabinNumber,
        name: name || null,
        capacity,
      },
    }
  }

  function validateGuestForm() {
    const fullName = guestForm.fullName.trim()
    const idNumber = guestForm.idNumber.trim()
    const originPlace = guestForm.originPlace.trim()
    const birthDate = guestForm.birthDate

    if (!fullName) {
      return {
        error:
          'El nombre completo del huésped es obligatorio.',
      }
    }

    if (fullName.length > 160) {
      return {
        error:
          'El nombre completo no puede superar 160 caracteres.',
      }
    }

    if (idNumber.length > 40) {
      return {
        error:
          'El documento no puede superar 40 caracteres.',
      }
    }

    if (originPlace.length > 120) {
      return {
        error:
          'El lugar de procedencia no puede superar 120 caracteres.',
      }
    }

    if (
      birthDate &&
      (!isValidDateOnly(birthDate) ||
        birthDate > toInputDate(new Date()))
    ) {
      return {
        error:
          'La fecha de nacimiento debe ser válida y no puede estar en el futuro.',
      }
    }

    return {
      payload: {
        fullName,
        idNumber: idNumber || null,
        originPlace: originPlace || null,
        birthDate: birthDate || null,
      },
    }
  }

  function validateStayForm({ includeGuests }) {
    const cabinId = Number(stayForm.cabinId)
    const primaryGuestId = Number(
      stayForm.primaryGuestId,
    )

    if (!cabinId) {
      return {
        error: 'Debes seleccionar una cabaña.',
      }
    }

    if (!primaryGuestId) {
      return {
        error:
          'Debes seleccionar al huésped principal.',
      }
    }

    if (
      !isValidDateOnly(stayForm.checkInDate) ||
      !isValidDateOnly(stayForm.checkOutDate)
    ) {
      return {
        error:
          'Debes indicar fechas de entrada y salida válidas.',
      }
    }

    if (
      stayForm.checkOutDate <=
      stayForm.checkInDate
    ) {
      return {
        error:
          'La fecha de salida debe ser posterior a la fecha de entrada.',
      }
    }

    if (!previewRate) {
      return {
        error:
          'No existe una tarifa vigente para la fecha de entrada.',
      }
    }

    const additionalGuestIds =
      stayForm.guestIds
        .filter(
          (guestId) =>
            String(guestId) !==
            String(primaryGuestId),
        )
        .map(Number)

    const guestIds = [
      ...new Set([
        primaryGuestId,
        ...additionalGuestIds,
      ]),
    ]

    if (
      selectedCabin &&
      guestIds.length > Number(selectedCabin.capacity)
    ) {
      return {
        error: `La cabaña admite un máximo de ${selectedCabin.capacity} huéspedes.`,
      }
    }

    return {
      payload: {
        cabinId,
        primaryGuestId,
        checkInDate: stayForm.checkInDate,
        checkOutDate: stayForm.checkOutDate,
        ...(includeGuests
          ? {
              status: stayForm.status,
              guestIds: additionalGuestIds,
            }
          : {}),
      },
    }
  }

  function validateRateForm() {
    const amount =
      rateForm.amountPerPersonPerNight.trim()
    const minimumAge = Number(
      rateForm.minimumChargeableAge,
    )
    const effectiveFrom = rateForm.effectiveFrom

    if (
      !/^\d+(\.\d{1,2})?$/.test(amount) ||
      Number(amount) <= 0
    ) {
      return {
        error:
          'La tarifa debe ser mayor que cero y tener máximo dos decimales.',
      }
    }

    if (
      !Number.isInteger(minimumAge) ||
      minimumAge < 0 ||
      minimumAge > 120
    ) {
      return {
        error:
          'La edad mínima debe ser un entero entre 0 y 120.',
      }
    }

    if (!isValidDateOnly(effectiveFrom)) {
      return {
        error:
          'La fecha de vigencia debe ser una fecha válida.',
      }
    }

    return {
      payload: {
        amountPerPersonPerNight: amount,
        minimumChargeableAge: minimumAge,
        effectiveFrom,
      },
    }
  }

  async function handleCabinSubmit(event) {
    event.preventDefault()
    setModalError('')

    const validation = validateCabinForm()

    if (validation.error) {
      setModalError(validation.error)
      return
    }

    const isEditing =
      activeModal === 'edit-cabin' &&
      selectedRecord

    try {
      setSaving(true)

      if (isEditing) {
        await updateCabinRequest(
          selectedRecord.id,
          validation.payload,
        )
      } else {
        await createCabinRequest({
          ...validation.payload,
          status: cabinForm.status,
          isActive: cabinForm.isActive,
        })
      }

      const successMessage = isEditing
        ? 'Cabaña actualizada correctamente.'
        : 'Cabaña creada correctamente.'

      closeModalAfterSave()
      setSuccess(successMessage)
      await loadLodgingData({
        preserveMessages: true,
      })
    } catch (requestError) {
      setModalError(
        getErrorMessage(
          requestError,
          'No se pudo guardar la cabaña.',
        ),
      )
    } finally {
      setSaving(false)
    }
  }

  async function handleCabinOperationalStatus() {
    if (!selectedRecord) return

    try {
      setSaving(true)
      setModalError('')

      await updateCabinStatusRequest(
        selectedRecord.id,
        cabinForm.status,
      )

      closeModalAfterSave()
      setSuccess(
        `La cabaña quedó en estado ${getCabinStatusLabel(cabinForm.status).toLowerCase()}.`,
      )
      await loadLodgingData({
        preserveMessages: true,
      })
    } catch (requestError) {
      setModalError(
        getErrorMessage(
          requestError,
          'No se pudo cambiar el estado operativo de la cabaña.',
        ),
      )
    } finally {
      setSaving(false)
    }
  }

  async function handleCabinActiveStatus() {
    if (!selectedRecord) return

    try {
      setSaving(true)
      setModalError('')

      await updateCabinActiveRequest(
        selectedRecord.id,
        !selectedRecord.isActive,
      )

      const successMessage =
        selectedRecord.isActive
          ? 'Cabaña desactivada correctamente.'
          : 'Cabaña activada correctamente.'

      closeModalAfterSave()
      setSuccess(successMessage)
      await loadLodgingData({
        preserveMessages: true,
      })
    } catch (requestError) {
      setModalError(
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
    setModalError('')

    const validation = validateGuestForm()

    if (validation.error) {
      setModalError(validation.error)
      return
    }

    const isEditing =
      activeModal === 'edit-guest' &&
      selectedRecord

    try {
      setSaving(true)

      if (isEditing) {
        await updateGuestRequest(
          selectedRecord.id,
          validation.payload,
        )
      } else {
        await createGuestRequest(validation.payload)
      }

      const successMessage = isEditing
        ? 'Huésped actualizado correctamente.'
        : 'Huésped registrado correctamente.'

      closeModalAfterSave()
      setSuccess(successMessage)
      await loadLodgingData({
        preserveMessages: true,
      })
    } catch (requestError) {
      setModalError(
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
    setModalError('')

    const isCreating =
      activeModal === 'create-stay'
    const validation = validateStayForm({
      includeGuests: isCreating,
    })

    if (validation.error) {
      setModalError(validation.error)
      return
    }

    try {
      setSaving(true)

      if (isCreating) {
        await createStayRequest(validation.payload)
      } else if (selectedRecord) {
        await updateStayRequest(
          selectedRecord.id,
          validation.payload,
        )
      }

      const successMessage = isCreating
        ? 'Estadía creada correctamente.'
        : 'Estadía actualizada correctamente.'

      closeModalAfterSave()
      setSuccess(successMessage)
      await loadLodgingData({
        preserveMessages: true,
      })
    } catch (requestError) {
      setModalError(
        getErrorMessage(
          requestError,
          'No se pudo guardar la estadía.',
        ),
      )
    } finally {
      setSaving(false)
    }
  }

  async function handleStayGuestsSubmit(event) {
    event.preventDefault()

    if (!selectedRecord) return

    const additionalGuestIds =
      stayForm.guestIds
        .filter(
          (guestId) =>
            String(guestId) !==
            String(stayForm.primaryGuestId),
        )
        .map(Number)

    const totalGuests =
      additionalGuestIds.length + 1

    if (
      totalGuests >
      Number(selectedRecord.cabin?.capacity)
    ) {
      setModalError(
        `La cabaña admite un máximo de ${selectedRecord.cabin?.capacity} huéspedes.`,
      )
      return
    }

    try {
      setSaving(true)
      setModalError('')

      await replaceStayGuestsRequest(
        selectedRecord.id,
        additionalGuestIds,
      )

      closeModalAfterSave()
      setSuccess(
        'Huéspedes de la estadía actualizados correctamente.',
      )
      await loadLodgingData({
        preserveMessages: true,
      })
    } catch (requestError) {
      setModalError(
        getErrorMessage(
          requestError,
          'No se pudieron actualizar los huéspedes de la estadía.',
        ),
      )
    } finally {
      setSaving(false)
    }
  }

  async function handleStayStatusSubmit() {
    if (!selectedRecord || !pendingStatus) return

    try {
      setSaving(true)
      setModalError('')

      await updateStayStatusRequest(
        selectedRecord.id,
        pendingStatus,
      )

      closeModalAfterSave()
      setSuccess(
        `Estadía actualizada a ${getStayStatusLabel(pendingStatus).toLowerCase()}.`,
      )
      await loadLodgingData({
        preserveMessages: true,
      })
    } catch (requestError) {
      setModalError(
        getErrorMessage(
          requestError,
          'No se pudo cambiar el estado de la estadía.',
        ),
      )
    } finally {
      setSaving(false)
    }
  }

  async function handleRateSubmit(event) {
    event.preventDefault()
    setModalError('')

    const validation = validateRateForm()

    if (validation.error) {
      setModalError(validation.error)
      return
    }

    try {
      setSaving(true)

      await createLodgingRateRequest(
        validation.payload,
      )

      closeModalAfterSave()
      setSuccess(
        'Nueva tarifa de hospedaje registrada correctamente.',
      )
      await loadLodgingData({
        preserveMessages: true,
      })
    } catch (requestError) {
      setModalError(
        getErrorMessage(
          requestError,
          'No se pudo registrar la nueva tarifa.',
        ),
      )
    } finally {
      setSaving(false)
    }
  }

  function closeModalAfterSave() {
    setActiveModal(null)
    setSelectedRecord(null)
    setPendingStatus('')
    setModalError('')
    setGuestPickerSearch('')
    setPreviewRate(null)
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
            Consulta primero la operación diaria y abre
            únicamente la acción que necesites para cada
            estadía, cabaña, huésped o tarifa.
          </p>
          <small className="lodging-session">
            Sesión:{' '}
            {user?.fullName ||
              user?.username ||
              'Administrador'}
          </small>
        </div>

        <div className="lodging-hero-actions">
          <div
            className="lodging-menu-wrapper"
            ref={menuRef}
          >
            <button
              type="button"
              className="btn lodging-menu-button"
              onClick={() =>
                setMenuOpen((current) => !current)
              }
              aria-expanded={menuOpen}
              aria-controls="lodging-admin-menu"
            >
              <span aria-hidden="true">☰</span>
              Menú
            </button>

            {menuOpen && (
              <div
                className="lodging-menu-panel"
                id="lodging-admin-menu"
              >
                <div className="lodging-menu-header">
                  <div>
                    <strong>
                      Módulos del sistema
                    </strong>
                    <p>
                      Accede a las áreas habilitadas
                      para tu cuenta.
                    </p>
                  </div>
                  <button
                    type="button"
                    className="lodging-menu-close"
                    onClick={() =>
                      setMenuOpen(false)
                    }
                    aria-label="Cerrar menú"
                  >
                    ×
                  </button>
                </div>

                <div className="lodging-menu-sections">
                  {menuSections.map((section) => (
                    <section
                      className="lodging-menu-section"
                      key={section.title}
                    >
                      <h2>{section.title}</h2>
                      <div className="lodging-menu-items">
                        {section.items.map((item) => (
                          <Link
                            to={item.to}
                            className={`lodging-menu-item ${
                              item.to === CURRENT_ROUTE
                                ? 'is-current'
                                : ''
                            }`}
                            key={item.title}
                            onClick={() =>
                              setMenuOpen(false)
                            }
                          >
                            <span aria-hidden="true">
                              {item.icon}
                            </span>
                            <div>
                              <strong>
                                {item.title}
                              </strong>
                              <p>
                                {item.description}
                              </p>
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

      <section className="lodging-card lodging-overview-card">
        <div className="lodging-overview-heading">
          <div>
            <span className="lodging-section-eyebrow">
              Resumen operativo
            </span>
            <h2>Estado actual del hospedaje</h2>
            <p>
              Las cifras se actualizan después de cada
              operación realizada en el módulo.
            </p>
          </div>
        </div>

        <div className="lodging-stats-grid">
          <StatCard
            label="Reservaciones"
            value={globalStats.booked}
            helper="Pendientes de check-in"
          />
          <StatCard
            label="Hospedadas"
            value={globalStats.checkedIn}
            helper="Con check-in realizado"
            tone="success"
          />
          <StatCard
            label="Cabañas disponibles"
            value={globalStats.availableCabins}
            helper="Activas y fuera de mantenimiento"
          />
          <StatCard
            label="Tarifa vigente"
            value={
              globalStats.currentRate
                ? formatCurrency(
                    globalStats.currentRate,
                  )
                : 'Sin tarifa'
            }
            helper="Por persona y por noche"
            tone={
              globalStats.currentRate
                ? 'success'
                : 'warning'
            }
          />
        </div>
      </section>

      <nav
        className="lodging-section-navigation"
        aria-label="Áreas de hospedaje"
      >
        {lodgingSections.map((section) => (
          <button
            type="button"
            className={`lodging-section-tab ${
              activeSection === section.id
                ? 'is-active'
                : ''
            }`}
            onClick={() =>
              handleSectionChange(section.id)
            }
            key={section.id}
          >
            <span
              className="lodging-section-tab-icon"
              aria-hidden="true"
            >
              {section.icon}
            </span>
            <span>
              <strong>{section.label}</strong>
              <small>{section.description}</small>
            </span>
            <b>{sectionCounts[section.id]}</b>
          </button>
        ))}
      </nav>

      {activeSection === 'stays' && (
        <StaysSection
          stays={filteredStays}
          allCabins={cabins}
          loading={loading}
          saving={saving}
          search={staySearch}
          statusFilter={stayStatusFilter}
          cabinFilter={stayCabinFilter}
          onSearchChange={setStaySearch}
          onStatusFilterChange={
            setStayStatusFilter
          }
          onCabinFilterChange={
            setStayCabinFilter
          }
          onCreate={() =>
            openModal('create-stay')
          }
          onDetail={(stay) =>
            openModal('detail-stay', stay)
          }
          onEdit={(stay) =>
            openModal('edit-stay', stay)
          }
          onGuests={(stay) =>
            openModal('stay-guests', stay)
          }
          onStatus={openStayStatusModal}
        />
      )}

      {activeSection === 'cabins' && (
        <CabinsSection
          cabins={filteredCabins}
          loading={loading}
          saving={saving}
          search={cabinSearch}
          statusFilter={cabinStatusFilter}
          activeFilter={cabinActiveFilter}
          onSearchChange={setCabinSearch}
          onStatusFilterChange={
            setCabinStatusFilter
          }
          onActiveFilterChange={
            setCabinActiveFilter
          }
          onCreate={() =>
            openModal('create-cabin')
          }
          onDetail={(cabin) =>
            openModal('detail-cabin', cabin)
          }
          onEdit={(cabin) =>
            openModal('edit-cabin', cabin)
          }
          onOperationalStatus={(cabin) =>
            openModal('cabin-status', cabin)
          }
          onActiveStatus={(cabin) =>
            openModal('cabin-active', cabin)
          }
        />
      )}

      {activeSection === 'guests' && (
        <GuestsSection
          guests={filteredGuests}
          loading={loading}
          saving={saving}
          search={guestSearch}
          onSearchChange={setGuestSearch}
          onCreate={() =>
            openModal('create-guest')
          }
          onDetail={(guest) =>
            openModal('detail-guest', guest)
          }
          onEdit={(guest) =>
            openModal('edit-guest', guest)
          }
        />
      )}

      {activeSection === 'rates' && (
        <RatesSection
          rates={filteredRates}
          currentRate={currentRate}
          loading={loading}
          saving={saving}
          statusFilter={rateStatusFilter}
          onStatusFilterChange={
            setRateStatusFilter
          }
          onCreate={() =>
            openModal('create-rate')
          }
          onDetail={(rate) =>
            openModal('detail-rate', rate)
          }
        />
      )}

      {(activeModal === 'create-cabin' ||
        activeModal === 'edit-cabin') && (
        <LodgingModal
          title={
            activeModal === 'create-cabin'
              ? 'Nueva cabaña'
              : 'Editar cabaña'
          }
          subtitle={
            activeModal === 'create-cabin'
              ? 'Registra su identificación, capacidad y estado inicial.'
              : `Cabaña ${selectedRecord?.cabinNumber ?? ''}`
          }
          onClose={closeModal}
          saving={saving}
        >
          <CabinForm
            form={cabinForm}
            error={modalError}
            saving={saving}
            mode={
              activeModal === 'create-cabin'
                ? 'create'
                : 'edit'
            }
            onChange={handleCabinFieldChange}
            onSubmit={handleCabinSubmit}
            onCancel={closeModal}
          />
        </LodgingModal>
      )}

      {activeModal === 'detail-cabin' &&
        selectedRecord && (
          <LodgingModal
            title="Detalle de la cabaña"
            subtitle={`Cabaña ${selectedRecord.cabinNumber}`}
            onClose={closeModal}
            saving={saving}
          >
            <CabinDetail cabin={selectedRecord} />
            <ModalCloseActions
              onClose={closeModal}
            />
          </LodgingModal>
        )}

      {activeModal === 'cabin-status' &&
        selectedRecord && (
          <LodgingModal
            title="Estado operativo"
            subtitle={`Cabaña ${selectedRecord.cabinNumber}`}
            onClose={closeModal}
            saving={saving}
          >
            {modalError && (
              <div className="lodging-alert lodging-alert-error">
                {modalError}
              </div>
            )}

            <div className="lodging-callout">
              <span aria-hidden="true">ℹ</span>
              <div>
                <strong>
                  La ocupación se controla desde las
                  estadías.
                </strong>
                <p>
                  Usa este cambio únicamente para
                  declarar la cabaña disponible o en
                  mantenimiento. El estado “Ocupada” se
                  asigna automáticamente al registrar un
                  check-in.
                </p>
              </div>
            </div>

            <label className="lodging-field">
              <span>Nuevo estado</span>
              <select
                name="status"
                value={cabinForm.status}
                onChange={handleCabinFieldChange}
              >
                {manualCabinStatuses.map(
                  (status) => (
                    <option
                      value={status.value}
                      key={status.value}
                    >
                      {status.label}
                    </option>
                  ),
                )}
              </select>
            </label>

            <div className="lodging-modal-actions">
              <button
                type="button"
                className="lodging-cancel-button"
                onClick={closeModal}
                disabled={saving}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="lodging-save-button"
                onClick={
                  handleCabinOperationalStatus
                }
                disabled={
                  saving ||
                  (selectedRecord.status ===
                    cabinForm.status)
                }
              >
                {saving
                  ? 'Guardando...'
                  : 'Actualizar estado'}
              </button>
            </div>
          </LodgingModal>
        )}

      {activeModal === 'cabin-active' &&
        selectedRecord && (
          <LodgingModal
            title={
              selectedRecord.isActive
                ? 'Desactivar cabaña'
                : 'Activar cabaña'
            }
            subtitle={`Cabaña ${selectedRecord.cabinNumber}`}
            onClose={closeModal}
            saving={saving}
          >
            {modalError && (
              <div className="lodging-alert lodging-alert-error">
                {modalError}
              </div>
            )}

            <ConfirmationBlock
              danger={selectedRecord.isActive}
              title={
                selectedRecord.isActive
                  ? `¿Desactivar la cabaña ${selectedRecord.cabinNumber}?`
                  : `¿Activar la cabaña ${selectedRecord.cabinNumber}?`
              }
              description={
                selectedRecord.isActive
                  ? 'No podrá usarse en nuevas reservaciones. Si mantiene estadías reservadas o activas, el backend impedirá la desactivación.'
                  : 'Volverá a estar disponible para nuevas reservaciones, siempre que su estado operativo lo permita.'
              }
            />

            <div className="lodging-modal-actions">
              <button
                type="button"
                className="lodging-cancel-button"
                onClick={closeModal}
                disabled={saving}
              >
                Cancelar
              </button>
              <button
                type="button"
                className={
                  selectedRecord.isActive
                    ? 'lodging-danger-button'
                    : 'lodging-save-button'
                }
                onClick={
                  handleCabinActiveStatus
                }
                disabled={saving}
              >
                {saving
                  ? 'Procesando...'
                  : selectedRecord.isActive
                    ? 'Desactivar cabaña'
                    : 'Activar cabaña'}
              </button>
            </div>
          </LodgingModal>
        )}

      {(activeModal === 'create-guest' ||
        activeModal === 'edit-guest') && (
        <LodgingModal
          title={
            activeModal === 'create-guest'
              ? 'Nuevo huésped'
              : 'Editar huésped'
          }
          subtitle={
            activeModal === 'create-guest'
              ? 'Registra la información necesaria para futuras estadías.'
              : selectedRecord?.fullName
          }
          onClose={closeModal}
          saving={saving}
        >
          <GuestForm
            form={guestForm}
            error={modalError}
            saving={saving}
            mode={
              activeModal === 'create-guest'
                ? 'create'
                : 'edit'
            }
            onChange={handleGuestFieldChange}
            onSubmit={handleGuestSubmit}
            onCancel={closeModal}
          />
        </LodgingModal>
      )}

      {activeModal === 'detail-guest' &&
        selectedRecord && (
          <LodgingModal
            title="Detalle del huésped"
            subtitle={selectedRecord.fullName}
            onClose={closeModal}
            saving={saving}
          >
            <GuestDetail guest={selectedRecord} />
            <ModalCloseActions
              onClose={closeModal}
            />
          </LodgingModal>
        )}

      {(activeModal === 'create-stay' ||
        activeModal === 'edit-stay') && (
        <LodgingModal
          title={
            activeModal === 'create-stay'
              ? 'Nueva estadía'
              : 'Editar estadía'
          }
          subtitle={
            activeModal === 'create-stay'
              ? 'Registra fechas, cabaña, huésped principal y acompañantes.'
              : `Estadía #${selectedRecord?.id ?? ''}`
          }
          onClose={closeModal}
          saving={saving}
          wide
        >
          <StayForm
            form={stayForm}
            error={modalError}
            saving={saving}
            mode={
              activeModal === 'create-stay'
                ? 'create'
                : 'edit'
            }
            cabins={selectableCabins}
            guests={guests}
            guestPickerOptions={guestPickerOptions}
            guestPickerSearch={guestPickerSearch}
            selectedCabin={selectedCabin}
            previewRate={previewRate}
            previewRateLoading={previewRateLoading}
            preview={stayPreview}
            onChange={handleStayFieldChange}
            onGuestSearchChange={
              setGuestPickerSearch
            }
            onGuestToggle={
              handleAdditionalGuestToggle
            }
            onSubmit={handleStaySubmit}
            onCancel={closeModal}
          />
        </LodgingModal>
      )}

      {activeModal === 'detail-stay' &&
        selectedRecord && (
          <LodgingModal
            title="Detalle de la estadía"
            subtitle={`Estadía #${selectedRecord.id}`}
            onClose={closeModal}
            saving={saving}
            wide
          >
            <StayDetail stay={selectedRecord} />
            <ModalCloseActions
              onClose={closeModal}
            />
          </LodgingModal>
        )}

      {activeModal === 'stay-guests' &&
        selectedRecord && (
          <LodgingModal
            title="Gestionar acompañantes"
            subtitle={`Estadía #${selectedRecord.id} · ${selectedRecord.primaryGuest?.fullName ?? ''}`}
            onClose={closeModal}
            saving={saving}
            wide
          >
            <form
              className="lodging-form"
              onSubmit={
                handleStayGuestsSubmit
              }
            >
              {modalError && (
                <div className="lodging-alert lodging-alert-error">
                  {modalError}
                </div>
              )}

              <div className="lodging-readonly-grid">
                <ReadOnlyField
                  label="Huésped principal"
                  value={
                    selectedRecord.primaryGuest
                      ?.fullName ?? '—'
                  }
                />
                <ReadOnlyField
                  label="Capacidad de la cabaña"
                  value={`${selectedRecord.cabin?.capacity ?? 0} persona(s)`}
                />
              </div>

              <GuestPicker
                form={stayForm}
                options={guestPickerOptions}
                search={guestPickerSearch}
                onSearchChange={
                  setGuestPickerSearch
                }
                onToggle={
                  handleAdditionalGuestToggle
                }
              />

              <div className="lodging-capacity-summary">
                <strong>
                  {stayForm.guestIds.length + 1} de{' '}
                  {selectedRecord.cabin?.capacity ?? 0}{' '}
                  espacios utilizados
                </strong>
                <p>
                  El huésped principal siempre se
                  incluye. Los menores que no pagan
                  también ocupan capacidad física.
                </p>
              </div>

              <div className="lodging-modal-actions">
                <button
                  type="button"
                  className="lodging-cancel-button"
                  onClick={closeModal}
                  disabled={saving}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="lodging-save-button"
                  disabled={saving}
                >
                  {saving
                    ? 'Guardando...'
                    : 'Actualizar acompañantes'}
                </button>
              </div>
            </form>
          </LodgingModal>
        )}

      {activeModal === 'stay-status' &&
        selectedRecord && (
          <LodgingModal
            title={getStayActionTitle(
              pendingStatus,
            )}
            subtitle={`Estadía #${selectedRecord.id}`}
            onClose={closeModal}
            saving={saving}
          >
            {modalError && (
              <div className="lodging-alert lodging-alert-error">
                {modalError}
              </div>
            )}

            <ConfirmationBlock
              danger={pendingStatus === 'CANCELLED'}
              title={getStayConfirmationTitle(
                pendingStatus,
                selectedRecord,
              )}
              description={getStayConfirmationDescription(
                pendingStatus,
              )}
            />

            <div className="lodging-readonly-grid">
              <ReadOnlyField
                label="Huésped principal"
                value={
                  selectedRecord.primaryGuest
                    ?.fullName ?? '—'
                }
              />
              <ReadOnlyField
                label="Cabaña"
                value={getCabinDisplay(
                  selectedRecord.cabin,
                )}
              />
            </div>

            <div className="lodging-modal-actions">
              <button
                type="button"
                className="lodging-cancel-button"
                onClick={closeModal}
                disabled={saving}
              >
                Volver
              </button>
              <button
                type="button"
                className={
                  pendingStatus === 'CANCELLED'
                    ? 'lodging-danger-button'
                    : 'lodging-save-button'
                }
                onClick={
                  handleStayStatusSubmit
                }
                disabled={saving}
              >
                {saving
                  ? 'Procesando...'
                  : getStayActionTitle(
                      pendingStatus,
                    )}
              </button>
            </div>
          </LodgingModal>
        )}

      {activeModal === 'create-rate' && (
        <LodgingModal
          title="Nueva tarifa"
          subtitle="Registra una nueva vigencia sin modificar el historial anterior."
          onClose={closeModal}
          saving={saving}
        >
          <RateForm
            form={rateForm}
            error={modalError}
            saving={saving}
            currentRate={currentRate}
            onChange={handleRateFieldChange}
            onSubmit={handleRateSubmit}
            onCancel={closeModal}
          />
        </LodgingModal>
      )}

      {activeModal === 'detail-rate' &&
        selectedRecord && (
          <LodgingModal
            title="Detalle de la tarifa"
            subtitle={`Vigente desde ${formatDate(selectedRecord.effectiveFrom)}`}
            onClose={closeModal}
            saving={saving}
          >
            <RateDetail
              rate={selectedRecord}
              currentRate={currentRate}
            />
            <ModalCloseActions
              onClose={closeModal}
            />
          </LodgingModal>
        )}
    </main>
  )
}

function StaysSection({
  stays,
  allCabins,
  loading,
  saving,
  search,
  statusFilter,
  cabinFilter,
  onSearchChange,
  onStatusFilterChange,
  onCabinFilterChange,
  onCreate,
  onDetail,
  onEdit,
  onGuests,
  onStatus,
}) {
  return (
    <section className="lodging-card lodging-management-card">
      <ManagementHeader
        eyebrow="Operación diaria"
        title="Estadías registradas"
        description="Revisa primero cada reservación, su ocupación y el monto estimado antes de realizar una acción."
        buttonLabel="+ Nueva estadía"
        onCreate={onCreate}
        disabled={loading || saving}
      />

      <div className="lodging-filters lodging-stay-filters">
        <label>
          <span>Buscar</span>
          <input
            type="search"
            value={search}
            onChange={(event) =>
              onSearchChange(event.target.value)
            }
            placeholder="Huésped, documento, cabaña o id"
          />
        </label>

        <label>
          <span>Estado</span>
          <select
            value={statusFilter}
            onChange={(event) =>
              onStatusFilterChange(
                event.target.value,
              )
            }
          >
            <option value="all">
              Todos los estados
            </option>
            {stayStatuses.map((status) => (
              <option
                value={status.value}
                key={status.value}
              >
                {status.label}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>Cabaña</span>
          <select
            value={cabinFilter}
            onChange={(event) =>
              onCabinFilterChange(
                event.target.value,
              )
            }
          >
            <option value="all">
              Todas las cabañas
            </option>
            {allCabins.map((cabin) => (
              <option
                value={cabin.id}
                key={cabin.id}
              >
                {getCabinDisplay(cabin)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <ResultSummary
        loading={loading}
        count={stays.length}
        singular="estadía"
        plural="estadías"
      />

      {loading ? (
        <LoadingState text="Cargando estadías..." />
      ) : stays.length > 0 ? (
        <div className="lodging-data-list lodging-stays-list">
          <div
            className="lodging-data-header"
            aria-hidden="true"
          >
            <span>Huésped</span>
            <span>Cabaña</span>
            <span>Fechas</span>
            <span>Personas</span>
            <span>Estimado</span>
            <span>Estado</span>
            <span>Acciones</span>
          </div>

          {stays.map((stay) => {
            const editable =
              stay.status === 'BOOKED' ||
              stay.status === 'CHECKED_IN'

            return (
              <article
                className="lodging-data-row lodging-stay-row"
                key={stay.id}
              >
                <div
                  className="lodging-data-cell lodging-primary-cell"
                  data-label="Huésped"
                >
                  <strong>
                    {stay.primaryGuest?.fullName ??
                      'Sin huésped'}
                  </strong>
                  <small>
                    {stay.primaryGuest?.idNumber
                      ? `Doc. ${stay.primaryGuest.idNumber}`
                      : `Estadía #${stay.id}`}
                  </small>
                </div>

                <div
                  className="lodging-data-cell"
                  data-label="Cabaña"
                >
                  <strong>
                    {getCabinDisplay(stay.cabin)}
                  </strong>
                  <small>
                    Capacidad{' '}
                    {stay.cabin?.capacity ?? '—'}
                  </small>
                </div>

                <div
                  className="lodging-data-cell"
                  data-label="Fechas"
                >
                  <strong>
                    {formatDate(stay.checkInDate)}
                  </strong>
                  <small>
                    Hasta{' '}
                    {formatDate(
                      stay.checkOutDate,
                    )}{' '}
                    · {stay.nightsCount} noche(s)
                  </small>
                </div>

                <div
                  className="lodging-data-cell"
                  data-label="Personas"
                >
                  <strong>
                    {stay.guestsCount} alojada(s)
                  </strong>
                  <small>
                    {stay.chargeableGuestsCount}{' '}
                    cobrable(s)
                  </small>
                </div>

                <div
                  className="lodging-data-cell"
                  data-label="Estimado"
                >
                  <strong>
                    {formatCurrency(
                      stay.estimatedRoomTotal,
                    )}
                  </strong>
                  <small>
                    {formatCurrency(
                      stay.ratePerPersonPerNight,
                    )}{' '}
                    por persona/noche
                  </small>
                </div>

                <div
                  className="lodging-data-cell"
                  data-label="Estado"
                >
                  <StatusBadge
                    value={stay.status}
                    type="stay"
                  />
                  {Number(stay.invoicesCount ?? 0) >
                    0 && (
                    <small className="lodging-lock-note">
                      Con factura asociada
                    </small>
                  )}
                </div>

                <div
                  className="lodging-row-actions"
                  data-label="Acciones"
                >
                  <button
                    type="button"
                    onClick={() =>
                      onDetail(stay)
                    }
                  >
                    Ver detalle
                  </button>
                  <button
                    type="button"
                    onClick={() => onEdit(stay)}
                    disabled={!editable}
                    title={
                      editable
                        ? ''
                        : 'No puede editarse porque está finalizada o cancelada.'
                    }
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      onGuests(stay)
                    }
                    disabled={!editable}
                    title={
                      editable
                        ? ''
                        : 'Los acompañantes no pueden cambiarse en una estadía finalizada o cancelada.'
                    }
                  >
                    Acompañantes
                  </button>

                  {stay.status === 'BOOKED' && (
                    <>
                      <button
                        type="button"
                        className="is-success"
                        onClick={() =>
                          onStatus(
                            stay,
                            'CHECKED_IN',
                          )
                        }
                      >
                        Registrar entrada
                      </button>
                      <button
                        type="button"
                        className="is-danger"
                        onClick={() =>
                          onStatus(
                            stay,
                            'CANCELLED',
                          )
                        }
                      >
                        Cancelar
                      </button>
                    </>
                  )}

                  {stay.status ===
                    'CHECKED_IN' && (
                    <>
                      <button
                        type="button"
                        className="is-success"
                        onClick={() =>
                          onStatus(
                            stay,
                            'CHECKED_OUT',
                          )
                        }
                      >
                        Registrar salida
                      </button>
                      <button
                        type="button"
                        className="is-danger"
                        onClick={() =>
                          onStatus(
                            stay,
                            'CANCELLED',
                          )
                        }
                      >
                        Cancelar
                      </button>
                    </>
                  )}
                </div>
              </article>
            )
          })}
        </div>
      ) : (
        <EmptyState text="No hay estadías que coincidan con los filtros seleccionados." />
      )}
    </section>
  )
}

function CabinsSection({
  cabins,
  loading,
  saving,
  search,
  statusFilter,
  activeFilter,
  onSearchChange,
  onStatusFilterChange,
  onActiveFilterChange,
  onCreate,
  onDetail,
  onEdit,
  onOperationalStatus,
  onActiveStatus,
}) {
  return (
    <section className="lodging-card lodging-management-card">
      <ManagementHeader
        eyebrow="Infraestructura"
        title="Cabañas registradas"
        description="Consulta capacidad, disponibilidad, mantenimiento e historial antes de modificar una cabaña."
        buttonLabel="+ Nueva cabaña"
        onCreate={onCreate}
        disabled={loading || saving}
      />

      <div className="lodging-filters lodging-cabin-filters">
        <label>
          <span>Buscar</span>
          <input
            type="search"
            value={search}
            onChange={(event) =>
              onSearchChange(event.target.value)
            }
            placeholder="Número, nombre o id"
          />
        </label>

        <label>
          <span>Estado operativo</span>
          <select
            value={statusFilter}
            onChange={(event) =>
              onStatusFilterChange(
                event.target.value,
              )
            }
          >
            <option value="all">
              Todos los estados
            </option>
            {cabinStatuses.map((status) => (
              <option
                value={status.value}
                key={status.value}
              >
                {status.label}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>Registro</span>
          <select
            value={activeFilter}
            onChange={(event) =>
              onActiveFilterChange(
                event.target.value,
              )
            }
          >
            <option value="all">
              Activas e inactivas
            </option>
            <option value="active">
              Solo activas
            </option>
            <option value="inactive">
              Solo inactivas
            </option>
          </select>
        </label>
      </div>

      <ResultSummary
        loading={loading}
        count={cabins.length}
        singular="cabaña"
        plural="cabañas"
      />

      {loading ? (
        <LoadingState text="Cargando cabañas..." />
      ) : cabins.length > 0 ? (
        <div className="lodging-data-list lodging-cabins-list">
          <div
            className="lodging-data-header"
            aria-hidden="true"
          >
            <span>Cabaña</span>
            <span>Capacidad</span>
            <span>Estado operativo</span>
            <span>Registro</span>
            <span>Historial</span>
            <span>Acciones</span>
          </div>

          {cabins.map((cabin) => (
            <article
              className="lodging-data-row lodging-cabin-row"
              key={cabin.id}
            >
              <div
                className="lodging-data-cell lodging-primary-cell"
                data-label="Cabaña"
              >
                <strong>
                  Cabaña {cabin.cabinNumber}
                </strong>
                <small>
                  {cabin.name || 'Sin nombre visible'}
                </small>
              </div>

              <div
                className="lodging-data-cell"
                data-label="Capacidad"
              >
                <strong>
                  {cabin.capacity} persona(s)
                </strong>
                <small>Capacidad máxima</small>
              </div>

              <div
                className="lodging-data-cell"
                data-label="Estado operativo"
              >
                <StatusBadge
                  value={cabin.status}
                  type="cabin"
                />
              </div>

              <div
                className="lodging-data-cell"
                data-label="Registro"
              >
                <StatusBadge
                  value={
                    cabin.isActive
                      ? 'ACTIVE'
                      : 'INACTIVE'
                  }
                  type="active"
                />
              </div>

              <div
                className="lodging-data-cell"
                data-label="Historial"
              >
                <strong>
                  {Number(cabin.staysCount ?? 0)}
                </strong>
                <small>estadía(s) asociada(s)</small>
              </div>

              <div
                className="lodging-row-actions"
                data-label="Acciones"
              >
                <button
                  type="button"
                  onClick={() =>
                    onDetail(cabin)
                  }
                >
                  Ver detalle
                </button>
                <button
                  type="button"
                  onClick={() => onEdit(cabin)}
                >
                  Editar
                </button>
                <button
                  type="button"
                  onClick={() =>
                    onOperationalStatus(cabin)
                  }
                >
                  Estado
                </button>
                <button
                  type="button"
                  className={
                    cabin.isActive
                      ? 'is-danger'
                      : 'is-success'
                  }
                  onClick={() =>
                    onActiveStatus(cabin)
                  }
                >
                  {cabin.isActive
                    ? 'Desactivar'
                    : 'Activar'}
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <EmptyState text="No hay cabañas que coincidan con los filtros seleccionados." />
      )}
    </section>
  )
}

function GuestsSection({
  guests,
  loading,
  saving,
  search,
  onSearchChange,
  onCreate,
  onDetail,
  onEdit,
}) {
  return (
    <section className="lodging-card lodging-management-card">
      <ManagementHeader
        eyebrow="Directorio"
        title="Huéspedes registrados"
        description="Consulta la información de cada persona y su historial antes de realizar cambios."
        buttonLabel="+ Nuevo huésped"
        onCreate={onCreate}
        disabled={loading || saving}
      />

      <div className="lodging-filters lodging-single-filter">
        <label>
          <span>Buscar</span>
          <input
            type="search"
            value={search}
            onChange={(event) =>
              onSearchChange(event.target.value)
            }
            placeholder="Nombre, documento, procedencia, fecha o id"
          />
        </label>
      </div>

      <ResultSummary
        loading={loading}
        count={guests.length}
        singular="huésped"
        plural="huéspedes"
      />

      {loading ? (
        <LoadingState text="Cargando huéspedes..." />
      ) : guests.length > 0 ? (
        <div className="lodging-data-list lodging-guests-list">
          <div
            className="lodging-data-header"
            aria-hidden="true"
          >
            <span>Huésped</span>
            <span>Documento</span>
            <span>Procedencia</span>
            <span>Nacimiento</span>
            <span>Historial</span>
            <span>Acciones</span>
          </div>

          {guests.map((guest) => (
            <article
              className="lodging-data-row lodging-guest-row"
              key={guest.id}
            >
              <div
                className="lodging-data-cell lodging-primary-cell"
                data-label="Huésped"
              >
                <strong>{guest.fullName}</strong>
                <small>Registro #{guest.id}</small>
              </div>

              <div
                className="lodging-data-cell"
                data-label="Documento"
              >
                <strong>
                  {guest.idNumber || 'No registrado'}
                </strong>
              </div>

              <div
                className="lodging-data-cell"
                data-label="Procedencia"
              >
                <strong>
                  {guest.originPlace ||
                    'No registrada'}
                </strong>
              </div>

              <div
                className="lodging-data-cell"
                data-label="Nacimiento"
              >
                <strong>
                  {guest.birthDate
                    ? formatDate(guest.birthDate)
                    : 'No registrada'}
                </strong>
                <small>
                  {guest.birthDate
                    ? `${calculateAgeToday(guest.birthDate)} año(s) actualmente`
                    : 'Se cobrará por defecto'}
                </small>
              </div>

              <div
                className="lodging-data-cell"
                data-label="Historial"
              >
                <strong>
                  {Number(guest.staysCount ?? 0)}
                </strong>
                <small>
                  {Number(
                    guest.primaryStaysCount ?? 0,
                  )}{' '}
                  como principal
                </small>
              </div>

              <div
                className="lodging-row-actions"
                data-label="Acciones"
              >
                <button
                  type="button"
                  onClick={() =>
                    onDetail(guest)
                  }
                >
                  Ver detalle
                </button>
                <button
                  type="button"
                  onClick={() => onEdit(guest)}
                >
                  Editar
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <EmptyState text="No hay huéspedes que coincidan con la búsqueda." />
      )}
    </section>
  )
}

function RatesSection({
  rates,
  currentRate,
  loading,
  saving,
  statusFilter,
  onStatusFilterChange,
  onCreate,
  onDetail,
}) {
  return (
    <section className="lodging-card lodging-management-card">
      <ManagementHeader
        eyebrow="Configuración económica"
        title="Tarifas de hospedaje"
        description="Cada nueva tarifa crea una vigencia histórica. Los registros anteriores no se editan ni se eliminan."
        buttonLabel="+ Nueva tarifa"
        onCreate={onCreate}
        disabled={loading || saving}
      />

      <div className="lodging-current-rate-card">
        <div>
          <span>Tarifa aplicable hoy</span>
          <strong>
            {currentRate
              ? formatCurrency(
                  currentRate.amountPerPersonPerNight,
                )
              : 'Sin tarifa configurada'}
          </strong>
          <small>
            {currentRate
              ? `Por persona y por noche · desde ${formatDate(currentRate.effectiveFrom)}`
              : 'Debes registrar una tarifa antes de crear estadías.'}
          </small>
        </div>
        {currentRate && (
          <div className="lodging-rate-age">
            <span>Edad mínima cobrable</span>
            <strong>
              {currentRate.minimumChargeableAge}{' '}
              años
            </strong>
          </div>
        )}
      </div>

      <div className="lodging-filters lodging-rate-filters">
        <label>
          <span>Mostrar</span>
          <select
            value={statusFilter}
            onChange={(event) =>
              onStatusFilterChange(
                event.target.value,
              )
            }
          >
            <option value="all">
              Todo el historial
            </option>
            <option value="current">
              Tarifa vigente
            </option>
            <option value="future">
              Tarifas programadas
            </option>
            <option value="past">
              Tarifas históricas
            </option>
          </select>
        </label>
      </div>

      <ResultSummary
        loading={loading}
        count={rates.length}
        singular="tarifa"
        plural="tarifas"
      />

      {loading ? (
        <LoadingState text="Cargando tarifas..." />
      ) : rates.length > 0 ? (
        <div className="lodging-data-list lodging-rates-list">
          <div
            className="lodging-data-header"
            aria-hidden="true"
          >
            <span>Tarifa</span>
            <span>Edad mínima</span>
            <span>Vigencia</span>
            <span>Situación</span>
            <span>Registro</span>
            <span>Acciones</span>
          </div>

          {rates.map((rate) => {
            const timelineState =
              getRateTimelineState(
                rate,
                currentRate,
              )

            return (
              <article
                className="lodging-data-row lodging-rate-row"
                key={rate.id}
              >
                <div
                  className="lodging-data-cell lodging-primary-cell"
                  data-label="Tarifa"
                >
                  <strong>
                    {formatCurrency(
                      rate.amountPerPersonPerNight,
                    )}
                  </strong>
                  <small>
                    Por persona y por noche
                  </small>
                </div>

                <div
                  className="lodging-data-cell"
                  data-label="Edad mínima"
                >
                  <strong>
                    {rate.minimumChargeableAge}{' '}
                    años
                  </strong>
                  <small>
                    Desde esta edad paga
                  </small>
                </div>

                <div
                  className="lodging-data-cell"
                  data-label="Vigencia"
                >
                  <strong>
                    {formatDate(
                      rate.effectiveFrom,
                    )}
                  </strong>
                </div>

                <div
                  className="lodging-data-cell"
                  data-label="Situación"
                >
                  <StatusBadge
                    value={timelineState}
                    type="rate"
                  />
                </div>

                <div
                  className="lodging-data-cell"
                  data-label="Registro"
                >
                  <strong>
                    {formatDateTime(
                      rate.createdAt,
                    )}
                  </strong>
                </div>

                <div
                  className="lodging-row-actions"
                  data-label="Acciones"
                >
                  <button
                    type="button"
                    onClick={() =>
                      onDetail(rate)
                    }
                  >
                    Ver detalle
                  </button>
                </div>
              </article>
            )
          })}
        </div>
      ) : (
        <EmptyState text="No hay tarifas que coincidan con el filtro seleccionado." />
      )}
    </section>
  )
}

function ManagementHeader({
  eyebrow,
  title,
  description,
  buttonLabel,
  onCreate,
  disabled,
}) {
  return (
    <div className="lodging-management-header">
      <div>
        <span className="lodging-section-eyebrow">
          {eyebrow}
        </span>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>

      <button
        type="button"
        className="btn lodging-primary-button"
        onClick={onCreate}
        disabled={disabled}
      >
        {buttonLabel}
      </button>
    </div>
  )
}

function CabinForm({
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
    <form
      className="lodging-form"
      onSubmit={onSubmit}
    >
      {error && (
        <div className="lodging-alert lodging-alert-error">
          {error}
        </div>
      )}

      <FormSection
        number="1"
        title="Identificación"
        description="Define cómo reconocerás la cabaña dentro del sistema."
      >
        <div className="lodging-form-grid">
          <label className="lodging-field">
            <span>Número de cabaña</span>
            <input
              type="number"
              name="cabinNumber"
              value={form.cabinNumber}
              onChange={onChange}
              min="1"
              max="9999"
              step="1"
              placeholder="Ej: 3"
              required
            />
            <small>
              Debe ser único entre 1 y 9999.
            </small>
          </label>

          <label className="lodging-field">
            <span>Capacidad máxima</span>
            <input
              type="number"
              name="capacity"
              value={form.capacity}
              onChange={onChange}
              min="1"
              max="100"
              step="1"
              placeholder="Ej: 4"
              required
            />
            <small>
              Todos los huéspedes cuentan para la
              capacidad, aunque no paguen.
            </small>
          </label>
        </div>

        <label className="lodging-field">
          <span>Nombre visible</span>
          <input
            type="text"
            name="name"
            value={form.name}
            onChange={onChange}
            maxLength={80}
            placeholder="Ej: Cabaña Mirador"
          />
          <small>
            Opcional. Ayuda a identificarla
            rápidamente.
          </small>
        </label>
      </FormSection>

      {isCreate && (
        <FormSection
          number="2"
          title="Estado inicial"
          description="Define cómo debe incorporarse la cabaña a la operación."
        >
          <label className="lodging-field">
            <span>Estado operativo</span>
            <select
              name="status"
              value={form.status}
              onChange={onChange}
            >
              {manualCabinStatuses.map(
                (status) => (
                  <option
                    value={status.value}
                    key={status.value}
                  >
                    {status.label}
                  </option>
                ),
              )}
            </select>
            <small>
              “Ocupada” se asignará
              automáticamente al registrar un
              check-in.
            </small>
          </label>

          <label className="lodging-switch">
            <input
              type="checkbox"
              name="isActive"
              checked={form.isActive}
              onChange={onChange}
            />
            <span className="lodging-switch-control" />
            <span>
              <strong>Crear cabaña activa</strong>
              <small>
                Permitirá usarla en nuevas
                reservaciones si no está en
                mantenimiento.
              </small>
            </span>
          </label>
        </FormSection>
      )}

      {!isCreate && (
        <div className="lodging-callout">
          <span aria-hidden="true">ℹ</span>
          <div>
            <strong>
              Estado y activación se gestionan por
              separado.
            </strong>
            <p>
              Así se evita mezclar cambios de
              identificación con acciones operativas
              que requieren confirmación.
            </p>
          </div>
        </div>
      )}

      <FormActions
        saving={saving}
        onCancel={onCancel}
        submitLabel={
          isCreate
            ? 'Crear cabaña'
            : 'Guardar cambios'
        }
      />
    </form>
  )
}

function GuestForm({
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
    <form
      className="lodging-form"
      onSubmit={onSubmit}
    >
      {error && (
        <div className="lodging-alert lodging-alert-error">
          {error}
        </div>
      )}

      <FormSection
        number="1"
        title="Identificación"
        description="Registra los datos principales de la persona."
      >
        <label className="lodging-field">
          <span>Nombre completo</span>
          <input
            type="text"
            name="fullName"
            value={form.fullName}
            onChange={onChange}
            maxLength={160}
            placeholder="Ej: María López"
            autoComplete="name"
            required
          />
        </label>

        <div className="lodging-form-grid">
          <label className="lodging-field">
            <span>Documento</span>
            <input
              type="text"
              name="idNumber"
              value={form.idNumber}
              onChange={onChange}
              maxLength={40}
              placeholder="Cédula, pasaporte u otro"
            />
            <small>Opcional.</small>
          </label>

          <label className="lodging-field">
            <span>Lugar de procedencia</span>
            <input
              type="text"
              name="originPlace"
              value={form.originPlace}
              onChange={onChange}
              maxLength={120}
              placeholder="Ej: Managua"
            />
            <small>Opcional.</small>
          </label>
        </div>
      </FormSection>

      <FormSection
        number="2"
        title="Regla de cobro por edad"
        description="La edad se calcula usando la fecha de entrada de cada estadía."
      >
        <label className="lodging-field">
          <span>Fecha de nacimiento</span>
          <input
            type="date"
            name="birthDate"
            value={form.birthDate}
            onChange={onChange}
            max={toInputDate(new Date())}
          />
          <small>
            Si no se registra, el huésped se
            considerará cobrable por defecto.
          </small>
        </label>
      </FormSection>

      <FormActions
        saving={saving}
        onCancel={onCancel}
        submitLabel={
          isCreate
            ? 'Registrar huésped'
            : 'Guardar cambios'
        }
      />
    </form>
  )
}

function StayForm({
  form,
  error,
  saving,
  mode,
  cabins,
  guests,
  guestPickerOptions,
  guestPickerSearch,
  selectedCabin,
  previewRate,
  previewRateLoading,
  preview,
  onChange,
  onGuestSearchChange,
  onGuestToggle,
  onSubmit,
  onCancel,
}) {
  const isCreate = mode === 'create'

  return (
    <form
      className="lodging-form"
      onSubmit={onSubmit}
    >
      {error && (
        <div className="lodging-alert lodging-alert-error">
          {error}
        </div>
      )}

      <FormSection
        number="1"
        title="Fechas y modalidad"
        description="La tarifa aplicable se determina con la fecha de entrada."
      >
        <div className="lodging-form-grid lodging-form-grid-three">
          <label className="lodging-field">
            <span>Entrada</span>
            <input
              type="date"
              name="checkInDate"
              value={form.checkInDate}
              onChange={onChange}
              required
            />
          </label>

          <label className="lodging-field">
            <span>Salida</span>
            <input
              type="date"
              name="checkOutDate"
              value={form.checkOutDate}
              onChange={onChange}
              min={
                form.checkInDate
                  ? toInputDate(
                      addDays(
                        parseDateOnly(
                          form.checkInDate,
                        ),
                        1,
                      ),
                    )
                  : ''
              }
              required
            />
          </label>

          {isCreate ? (
            <label className="lodging-field">
              <span>Estado inicial</span>
              <select
                name="status"
                value={form.status}
                onChange={onChange}
              >
                <option value="BOOKED">
                  Reservada
                </option>
                <option value="CHECKED_IN">
                  Check-in realizado
                </option>
              </select>
            </label>
          ) : (
            <ReadOnlyField
              label="Estado actual"
              value={getStayStatusLabel(
                form.status,
              )}
            />
          )}
        </div>

        <div className="lodging-rate-preview">
          <span aria-hidden="true">💵</span>
          <div>
            <strong>
              {previewRateLoading
                ? 'Consultando tarifa...'
                : previewRate
                  ? `${formatCurrency(previewRate.amountPerPersonPerNight)} por persona y noche`
                  : 'Sin tarifa disponible'}
            </strong>
            <p>
              {previewRate
                ? `Cobran desde los ${previewRate.minimumChargeableAge} años. Vigencia: ${formatDate(previewRate.effectiveFrom)}.`
                : 'No será posible guardar la estadía sin una tarifa vigente para la entrada.'}
            </p>
          </div>
        </div>
      </FormSection>

      <FormSection
        number="2"
        title="Cabaña y huésped principal"
        description="La cabaña debe estar activa, fuera de mantenimiento y sin conflictos de fechas."
      >
        <div className="lodging-form-grid">
          <label className="lodging-field">
            <span>Cabaña</span>
            <select
              name="cabinId"
              value={form.cabinId}
              onChange={onChange}
              required
            >
              <option value="">
                Selecciona una cabaña
              </option>
              {cabins.map((cabin) => (
                <option
                  value={cabin.id}
                  key={cabin.id}
                >
                  {getCabinDisplay(cabin)} ·{' '}
                  {cabin.capacity} persona(s) ·{' '}
                  {getCabinStatusLabel(
                    cabin.status,
                  )}
                </option>
              ))}
            </select>
            <small>
              El backend verificará cruces de fechas
              antes de guardar.
            </small>
          </label>

          <label className="lodging-field">
            <span>Huésped principal</span>
            <select
              name="primaryGuestId"
              value={form.primaryGuestId}
              onChange={onChange}
              required
            >
              <option value="">
                Selecciona al huésped principal
              </option>
              {guests.map((guest) => (
                <option
                  value={guest.id}
                  key={guest.id}
                >
                  {guest.fullName}
                  {guest.idNumber
                    ? ` · ${guest.idNumber}`
                    : ''}
                </option>
              ))}
            </select>
          </label>
        </div>

        {selectedCabin && (
          <div className="lodging-capacity-summary">
            <strong>
              Cabaña para {selectedCabin.capacity}{' '}
              persona(s)
            </strong>
            <p>
              Estado actual:{' '}
              {getCabinStatusLabel(
                selectedCabin.status,
              )}
              . Todos los huéspedes, incluso menores
              no cobrables, ocupan un espacio.
            </p>
          </div>
        )}
      </FormSection>

      {isCreate && (
        <FormSection
          number="3"
          title="Acompañantes"
          description="Selecciona únicamente a las personas adicionales; el huésped principal se incluye automáticamente."
        >
          <GuestPicker
            form={form}
            options={guestPickerOptions}
            search={guestPickerSearch}
            onSearchChange={
              onGuestSearchChange
            }
            onToggle={onGuestToggle}
          />
        </FormSection>
      )}

      <FormSection
        number={isCreate ? '4' : '3'}
        title="Resumen estimado"
        description="El backend recalculará y guardará la tarifa histórica al confirmar."
      >
        <div className="lodging-estimate-grid">
          <EstimateItem
            label="Noches"
            value={preview.nights}
          />
          <EstimateItem
            label="Personas alojadas"
            value={preview.guestsCount}
          />
          <EstimateItem
            label="Personas cobrables"
            value={preview.chargeableGuestsCount}
          />
          <EstimateItem
            label="Persona-noches"
            value={preview.personNightsCount}
          />
          <EstimateItem
            label="Total estimado"
            value={formatCurrency(
              preview.estimatedRoomTotal,
            )}
            emphasized
          />
        </div>

        {!isCreate && (
          <div className="lodging-callout">
            <span aria-hidden="true">ℹ</span>
            <div>
              <strong>
                Los acompañantes se gestionan por
                separado.
              </strong>
              <p>
                Esto evita combinar dos operaciones
                distintas y reduce el riesgo de dejar
                una edición parcialmente aplicada.
              </p>
            </div>
          </div>
        )}
      </FormSection>

      <FormActions
        saving={saving}
        onCancel={onCancel}
        submitLabel={
          isCreate
            ? 'Crear estadía'
            : 'Guardar cambios'
        }
      />
    </form>
  )
}

function GuestPicker({
  form,
  options,
  search,
  onSearchChange,
  onToggle,
}) {
  return (
    <div className="lodging-guest-picker">
      <label className="lodging-field">
        <span>Buscar acompañante</span>
        <input
          type="search"
          value={search}
          onChange={(event) =>
            onSearchChange(event.target.value)
          }
          placeholder="Nombre, documento o procedencia"
        />
      </label>

      <div className="lodging-guest-check-grid">
        {options.length > 0 ? (
          options.map((guest) => {
            const checked =
              form.guestIds.includes(
                String(guest.id),
              )

            return (
              <label
                className={`lodging-check-item ${
                  checked ? 'is-selected' : ''
                }`}
                key={guest.id}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() =>
                    onToggle(guest.id)
                  }
                />
                <span>
                  <strong>
                    {guest.fullName}
                  </strong>
                  <small>
                    {guest.idNumber ||
                      'Sin documento'}
                    {' · '}
                    {guest.birthDate
                      ? formatDate(
                          guest.birthDate,
                        )
                      : 'Sin fecha de nacimiento'}
                  </small>
                </span>
              </label>
            )
          })
        ) : (
          <div className="lodging-empty-state lodging-picker-empty">
            No hay huéspedes disponibles para esta
            búsqueda.
          </div>
        )}
      </div>

      <div className="lodging-selection-summary">
        <strong>
          {form.guestIds.length} acompañante(s)
          seleccionado(s)
        </strong>
      </div>
    </div>
  )
}

function RateForm({
  form,
  error,
  saving,
  currentRate,
  onChange,
  onSubmit,
  onCancel,
}) {
  return (
    <form
      className="lodging-form"
      onSubmit={onSubmit}
    >
      {error && (
        <div className="lodging-alert lodging-alert-error">
          {error}
        </div>
      )}

      {currentRate && (
        <div className="lodging-callout">
          <span aria-hidden="true">ℹ</span>
          <div>
            <strong>
              Tarifa vigente:{' '}
              {formatCurrency(
                currentRate.amountPerPersonPerNight,
              )}
            </strong>
            <p>
              La nueva tarifa no reemplazará este
              registro. Comenzará a aplicarse según
              la fecha de vigencia indicada.
            </p>
          </div>
        </div>
      )}

      <FormSection
        number="1"
        title="Monto y regla de edad"
        description="La tarifa se cobra por cada persona cobrable y por cada noche."
      >
        <div className="lodging-form-grid">
          <label className="lodging-field">
            <span>
              Tarifa por persona y noche
            </span>
            <input
              type="text"
              inputMode="decimal"
              name="amountPerPersonPerNight"
              value={
                form.amountPerPersonPerNight
              }
              onChange={onChange}
              placeholder="Ej: 20.00"
              required
            />
            <small>
              Usa máximo dos decimales.
            </small>
          </label>

          <label className="lodging-field">
            <span>Edad mínima cobrable</span>
            <input
              type="number"
              name="minimumChargeableAge"
              value={
                form.minimumChargeableAge
              }
              onChange={onChange}
              min="0"
              max="120"
              step="1"
              required
            />
            <small>
              La edad se calcula en la fecha de
              entrada.
            </small>
          </label>
        </div>
      </FormSection>

      <FormSection
        number="2"
        title="Inicio de vigencia"
        description="Puedes registrar una tarifa futura para un cambio de precio o temporada."
      >
        <label className="lodging-field">
          <span>Vigente desde</span>
          <input
            type="date"
            name="effectiveFrom"
            value={form.effectiveFrom}
            onChange={onChange}
            required
          />
          <small>
            No puede existir otra tarifa con la misma
            fecha.
          </small>
        </label>
      </FormSection>

      <FormActions
        saving={saving}
        onCancel={onCancel}
        submitLabel="Registrar tarifa"
      />
    </form>
  )
}

function CabinDetail({ cabin }) {
  return (
    <div className="lodging-detail-stack">
      <DetailGrid>
        <DetailItem
          label="Número"
          value={`Cabaña ${cabin.cabinNumber}`}
        />
        <DetailItem
          label="Nombre visible"
          value={cabin.name || 'No registrado'}
        />
        <DetailItem
          label="Capacidad"
          value={`${cabin.capacity} persona(s)`}
        />
        <DetailItem
          label="Estado operativo"
          value={getCabinStatusLabel(
            cabin.status,
          )}
        />
        <DetailItem
          label="Registro"
          value={
            cabin.isActive
              ? 'Activa'
              : 'Inactiva'
          }
        />
        <DetailItem
          label="Estadías asociadas"
          value={Number(cabin.staysCount ?? 0)}
        />
      </DetailGrid>

      <div className="lodging-callout">
        <span aria-hidden="true">💵</span>
        <div>
          <strong>
            La cabaña no posee un precio propio.
          </strong>
          <p>
            Todas las cabañas utilizan la tarifa
            general vigente por persona y por noche.
          </p>
        </div>
      </div>
    </div>
  )
}

function GuestDetail({ guest }) {
  return (
    <div className="lodging-detail-stack">
      <DetailGrid>
        <DetailItem
          label="Nombre completo"
          value={guest.fullName}
        />
        <DetailItem
          label="Documento"
          value={
            guest.idNumber || 'No registrado'
          }
        />
        <DetailItem
          label="Procedencia"
          value={
            guest.originPlace || 'No registrada'
          }
        />
        <DetailItem
          label="Fecha de nacimiento"
          value={
            guest.birthDate
              ? formatDate(guest.birthDate)
              : 'No registrada'
          }
        />
        <DetailItem
          label="Estadías asociadas"
          value={Number(guest.staysCount ?? 0)}
        />
        <DetailItem
          label="Como huésped principal"
          value={Number(
            guest.primaryStaysCount ?? 0,
          )}
        />
        <DetailItem
          label="Registrado"
          value={formatDateTime(
            guest.createdAt,
          )}
        />
      </DetailGrid>

      {!guest.birthDate && (
        <div className="lodging-callout">
          <span aria-hidden="true">ℹ</span>
          <div>
            <strong>
              Sin fecha de nacimiento.
            </strong>
            <p>
              En una nueva estadía se considerará
              cobrable por defecto.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

function StayDetail({ stay }) {
  return (
    <div className="lodging-detail-stack">
      <div className="lodging-detail-heading">
        <StatusBadge
          value={stay.status}
          type="stay"
        />
        <span>
          Creada{' '}
          {formatDateTime(stay.createdAt)}
        </span>
      </div>

      <DetailGrid>
        <DetailItem
          label="Huésped principal"
          value={
            stay.primaryGuest?.fullName ?? '—'
          }
          helper={
            stay.primaryGuest?.idNumber
              ? `Documento: ${stay.primaryGuest.idNumber}`
              : 'Sin documento'
          }
        />
        <DetailItem
          label="Cabaña"
          value={getCabinDisplay(stay.cabin)}
          helper={`Capacidad: ${stay.cabin?.capacity ?? '—'}`}
        />
        <DetailItem
          label="Entrada"
          value={formatDate(stay.checkInDate)}
        />
        <DetailItem
          label="Salida"
          value={formatDate(stay.checkOutDate)}
        />
        <DetailItem
          label="Noches"
          value={stay.nightsCount}
        />
        <DetailItem
          label="Tarifa aplicada"
          value={formatCurrency(
            stay.ratePerPersonPerNight,
          )}
          helper="Por persona y por noche"
        />
        <DetailItem
          label="Edad mínima cobrable"
          value={`${stay.minimumChargeableAge} años`}
        />
        <DetailItem
          label="Total estimado"
          value={formatCurrency(
            stay.estimatedRoomTotal,
          )}
          helper={`${stay.personNightsCount} persona-noches cobrables`}
        />
        <DetailItem
          label="Órdenes asociadas"
          value={Number(stay.ordersCount ?? 0)}
        />
        <DetailItem
          label="Facturas asociadas"
          value={Number(
            stay.invoicesCount ?? 0,
          )}
        />
        <DetailItem
          label="Creada por"
          value={
            stay.createdByUser?.fullName ||
            stay.createdByUser?.username ||
            'No disponible'
          }
        />
      </DetailGrid>

      <section className="lodging-detail-section">
        <div className="lodging-detail-section-heading">
          <div>
            <strong>
              Personas alojadas
            </strong>
            <p>
              {stay.guestsCount} persona(s), de las
              cuales {stay.chargeableGuestsCount} son
              cobrables.
            </p>
          </div>
        </div>

        <div className="lodging-detail-guest-list">
          {(stay.guests ?? []).map((guest) => (
            <article key={guest.id}>
              <div>
                <strong>{guest.fullName}</strong>
                <small>
                  {String(guest.id) ===
                  String(stay.primaryGuest?.id)
                    ? 'Huésped principal'
                    : 'Acompañante'}
                </small>
              </div>
              <div>
                <span>
                  {guest.ageAtCheckIn === null ||
                  typeof guest.ageAtCheckIn ===
                    'undefined'
                    ? 'Edad desconocida'
                    : `${guest.ageAtCheckIn} año(s) al entrar`}
                </span>
                <StatusBadge
                  value={
                    guest.isChargeable
                      ? 'CHARGEABLE'
                      : 'NO_CHARGE'
                  }
                  type="charge"
                />
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  )
}

function RateDetail({ rate, currentRate }) {
  const state = getRateTimelineState(
    rate,
    currentRate,
  )

  return (
    <div className="lodging-detail-stack">
      <DetailGrid>
        <DetailItem
          label="Tarifa"
          value={formatCurrency(
            rate.amountPerPersonPerNight,
          )}
          helper="Por persona y por noche"
        />
        <DetailItem
          label="Edad mínima cobrable"
          value={`${rate.minimumChargeableAge} años`}
        />
        <DetailItem
          label="Vigente desde"
          value={formatDate(
            rate.effectiveFrom,
          )}
        />
        <DetailItem
          label="Situación"
          value={getRateStateLabel(state)}
        />
        <DetailItem
          label="Registrada"
          value={formatDateTime(
            rate.createdAt,
          )}
        />
      </DetailGrid>

      <div className="lodging-callout">
        <span aria-hidden="true">🔒</span>
        <div>
          <strong>
            Registro histórico de solo lectura.
          </strong>
          <p>
            Para cambiar el precio o la edad mínima
            debes crear una nueva tarifa con otra
            fecha de vigencia.
          </p>
        </div>
      </div>
    </div>
  )
}

function LodgingModal({
  title,
  subtitle,
  onClose,
  saving,
  wide = false,
  children,
}) {
  function handleBackdropClick(event) {
    if (
      event.target === event.currentTarget &&
      !saving
    ) {
      onClose()
    }
  }

  return (
    <div
      className="lodging-modal-backdrop"
      role="presentation"
      onMouseDown={handleBackdropClick}
    >
      <section
        className={`lodging-modal ${
          wide ? 'is-wide' : ''
        }`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="lodging-modal-title"
      >
        <header className="lodging-modal-header">
          <div>
            <h2 id="lodging-modal-title">
              {title}
            </h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <button
            type="button"
            className="lodging-modal-close"
            onClick={onClose}
            disabled={saving}
            aria-label="Cerrar ventana"
          >
            ×
          </button>
        </header>

        <div className="lodging-modal-body">
          {children}
        </div>
      </section>
    </div>
  )
}

function FormSection({
  number,
  title,
  description,
  children,
}) {
  return (
    <section className="lodging-form-section">
      <div className="lodging-form-section-heading">
        <span>{number}</span>
        <div>
          <strong>{title}</strong>
          <small>{description}</small>
        </div>
      </div>
      <div className="lodging-form-section-content">
        {children}
      </div>
    </section>
  )
}

function FormActions({
  saving,
  onCancel,
  submitLabel,
}) {
  return (
    <div className="lodging-modal-actions">
      <button
        type="button"
        className="lodging-cancel-button"
        onClick={onCancel}
        disabled={saving}
      >
        Cancelar
      </button>
      <button
        type="submit"
        className="lodging-save-button"
        disabled={saving}
      >
        {saving ? 'Guardando...' : submitLabel}
      </button>
    </div>
  )
}

function ModalCloseActions({ onClose }) {
  return (
    <div className="lodging-modal-actions">
      <button
        type="button"
        className="lodging-cancel-button"
        onClick={onClose}
      >
        Cerrar
      </button>
    </div>
  )
}

function ConfirmationBlock({
  danger,
  title,
  description,
}) {
  return (
    <div className="lodging-confirmation">
      <span
        className={
          danger ? 'is-danger' : 'is-success'
        }
      >
        {danger ? '!' : '✓'}
      </span>
      <div>
        <strong>{title}</strong>
        <p>{description}</p>
      </div>
    </div>
  )
}

function StatCard({
  label,
  value,
  helper,
  tone = '',
}) {
  return (
    <article
      className={`lodging-stat ${
        tone ? `is-${tone}` : ''
      }`}
    >
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{helper}</small>
    </article>
  )
}

function ResultSummary({
  loading,
  count,
  singular,
  plural,
}) {
  return (
    <div className="lodging-result-summary">
      {loading
        ? 'Consultando información...'
        : `${count} ${count === 1 ? singular : plural} visible${count === 1 ? '' : 's'}`}
    </div>
  )
}

function LoadingState({ text }) {
  return (
    <div className="lodging-empty-state">
      {text}
    </div>
  )
}

function EmptyState({ text }) {
  return (
    <div className="lodging-empty-state">
      {text}
    </div>
  )
}

function StatusBadge({ value, type }) {
  const label = getStatusBadgeLabel(value, type)
  const tone = getStatusBadgeTone(value, type)

  return (
    <span
      className={`lodging-status-badge is-${tone}`}
    >
      {label}
    </span>
  )
}

function DetailGrid({ children }) {
  return (
    <div className="lodging-detail-grid">
      {children}
    </div>
  )
}

function DetailItem({
  label,
  value,
  helper = '',
}) {
  return (
    <div className="lodging-detail-item">
      <span>{label}</span>
      <strong>{value ?? '—'}</strong>
      {helper && <small>{helper}</small>}
    </div>
  )
}

function ReadOnlyField({ label, value }) {
  return (
    <div className="lodging-readonly-field">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function EstimateItem({
  label,
  value,
  emphasized = false,
}) {
  return (
    <div
      className={`lodging-estimate-item ${
        emphasized ? 'is-emphasized' : ''
      }`}
    >
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function normalizeList(payload, key) {
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.[key]))
    return payload[key]
  if (Array.isArray(payload?.data))
    return payload.data
  return []
}

function getErrorMessage(
  requestError,
  fallbackMessage,
) {
  return (
    requestError?.response?.data?.message ||
    requestError?.response?.data?.error ||
    requestError?.message ||
    fallbackMessage
  )
}

function getCabinDisplay(cabin) {
  if (!cabin) return 'Cabaña no disponible'

  return cabin.name
    ? `Cabaña ${cabin.cabinNumber} · ${cabin.name}`
    : `Cabaña ${cabin.cabinNumber}`
}

function getCabinStatusLabel(status) {
  return (
    cabinStatuses.find(
      (item) => item.value === status,
    )?.label || status
  )
}

function getStayStatusLabel(status) {
  return (
    stayStatuses.find(
      (item) => item.value === status,
    )?.label || status
  )
}

function getStayActionTitle(status) {
  const labels = {
    CHECKED_IN: 'Registrar entrada',
    CHECKED_OUT: 'Registrar salida',
    CANCELLED: 'Cancelar estadía',
  }

  return labels[status] || 'Cambiar estado'
}

function getStayConfirmationTitle(
  status,
  stay,
) {
  const guestName =
    stay.primaryGuest?.fullName || 'el huésped'

  const labels = {
    CHECKED_IN: `¿Registrar el check-in de ${guestName}?`,
    CHECKED_OUT: `¿Registrar el check-out de ${guestName}?`,
    CANCELLED: `¿Cancelar la estadía de ${guestName}?`,
  }

  return labels[status] || '¿Confirmar el cambio?'
}

function getStayConfirmationDescription(status) {
  const descriptions = {
    CHECKED_IN:
      'La cabaña pasará a ocupada. El sistema volverá a comprobar capacidad, disponibilidad y cruces de fechas.',
    CHECKED_OUT:
      'La estadía quedará finalizada y la cabaña se liberará si no existe otro check-in activo. No puede haber órdenes abiertas.',
    CANCELLED:
      'La reservación dejará de estar activa. No puede haber órdenes abiertas ni una factura de hospedaje emitida.',
  }

  return (
    descriptions[status] ||
    'El cambio se aplicará inmediatamente.'
  )
}

function getRateTimelineState(rate, currentRate) {
  if (
    currentRate &&
    String(rate.id) === String(currentRate.id)
  ) {
    return 'current'
  }

  const today = toInputDate(new Date())

  if (
    String(rate.effectiveFrom) > today
  ) {
    return 'future'
  }

  return 'past'
}

function getRateStateLabel(state) {
  const labels = {
    current: 'Vigente',
    future: 'Programada',
    past: 'Histórica',
  }

  return labels[state] || state
}

function getStatusBadgeLabel(value, type) {
  if (type === 'stay') {
    return getStayStatusLabel(value)
  }

  if (type === 'cabin') {
    return getCabinStatusLabel(value)
  }

  if (type === 'active') {
    return value === 'ACTIVE'
      ? 'Activa'
      : 'Inactiva'
  }

  if (type === 'rate') {
    return getRateStateLabel(value)
  }

  if (type === 'charge') {
    return value === 'CHARGEABLE'
      ? 'Cobrable'
      : 'No cobrable'
  }

  return value
}

function getStatusBadgeTone(value, type) {
  if (type === 'stay') {
    const tones = {
      BOOKED: 'warning',
      CHECKED_IN: 'success',
      CHECKED_OUT: 'neutral',
      CANCELLED: 'danger',
    }

    return tones[value] || 'neutral'
  }

  if (type === 'cabin') {
    const tones = {
      AVAILABLE: 'success',
      OCCUPIED: 'warning',
      MAINTENANCE: 'danger',
    }

    return tones[value] || 'neutral'
  }

  if (type === 'active') {
    return value === 'ACTIVE'
      ? 'success'
      : 'neutral'
  }

  if (type === 'rate') {
    const tones = {
      current: 'success',
      future: 'warning',
      past: 'neutral',
    }

    return tones[value] || 'neutral'
  }

  if (type === 'charge') {
    return value === 'CHARGEABLE'
      ? 'success'
      : 'neutral'
  }

  return 'neutral'
}

function formatCurrency(value) {
  const amount = Number(value)

  if (!Number.isFinite(amount)) return '$0.00'

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount)
}

function formatDate(value) {
  if (!value) return '—'

  const date = parseDateOnly(value)

  if (Number.isNaN(date.getTime())) return String(value)

  return new Intl.DateTimeFormat('es-NI', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date)
}

function formatDateTime(value) {
  if (!value) return '—'

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) return String(value)

  return new Intl.DateTimeFormat('es-NI', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function calculateNights(checkInDate, checkOutDate) {
  if (
    !isValidDateOnly(checkInDate) ||
    !isValidDateOnly(checkOutDate)
  ) {
    return 0
  }

  const difference =
    parseDateOnly(checkOutDate).getTime() -
    parseDateOnly(checkInDate).getTime()

  return Math.max(
    0,
    Math.round(difference / 86400000),
  )
}

function isGuestChargeable(
  guest,
  checkInDate,
  minimumAge,
) {
  if (!guest?.birthDate) return true
  if (!isValidDateOnly(checkInDate)) return true

  return (
    calculateAgeAtDate(
      guest.birthDate,
      checkInDate,
    ) >= minimumAge
  )
}

function calculateAgeAtDate(
  birthDateValue,
  targetDateValue,
) {
  const birthDate = parseDateOnly(
    birthDateValue,
  )
  const targetDate = parseDateOnly(
    targetDateValue,
  )

  let age =
    targetDate.getUTCFullYear() -
    birthDate.getUTCFullYear()

  const targetMonth = targetDate.getUTCMonth()
  const birthMonth = birthDate.getUTCMonth()
  const targetDay = targetDate.getUTCDate()
  const birthDay = birthDate.getUTCDate()

  if (
    targetMonth < birthMonth ||
    (targetMonth === birthMonth &&
      targetDay < birthDay)
  ) {
    age -= 1
  }

  return Math.max(0, age)
}

function calculateAgeToday(birthDate) {
  return calculateAgeAtDate(
    birthDate,
    toInputDate(new Date()),
  )
}

function isValidDateOnly(value) {
  if (
    typeof value !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value)
  ) {
    return false
  }

  const parsed = parseDateOnly(value)

  return (
    !Number.isNaN(parsed.getTime()) &&
    toInputDate(parsed) === value
  )
}

function parseDateOnly(value) {
  return new Date(`${value}T00:00:00.000Z`)
}

function toInputDate(date) {
  return new Date(date).toISOString().slice(0, 10)
}

function addDays(date, days) {
  const result = new Date(date)
  result.setUTCDate(result.getUTCDate() + days)
  return result
}
