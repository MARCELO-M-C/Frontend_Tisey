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
  createMenuCategoryRequest,
  createMenuItemRequest,
  getMenuCategoriesRequest,
  getMenuItemsRequest,
  getMenuStationsRequest,
  updateMenuCategoryRequest,
  updateMenuCategoryStatusRequest,
  updateMenuItemRequest,
  updateMenuItemStatusRequest,
} from '../services/menuService'
import './AdminMenuPage.css'

const CURRENT_ROUTE = '/admin/menu'

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
        description: 'Gestiona productos, categorías y disponibilidad.',
        to: CURRENT_ROUTE,
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

const menuSections = [
  {
    id: 'items',
    label: 'Productos',
    description: 'Platillos, bebidas y productos disponibles para las órdenes.',
    icon: '🍽️',
  },
  {
    id: 'categories',
    label: 'Categorías',
    description: 'Organiza los productos para encontrarlos con facilidad.',
    icon: '🗂️',
  },
]

const initialItemForm = {
  name: '',
  basePrice: '',
  categoryId: '',
  stationId: '',
  isActive: true,
}

const initialCategoryForm = {
  name: '',
  isActive: true,
}

export default function AdminMenuPage() {
  const { user, logout } = useAuth()
  const menuRef = useRef(null)

  const [menuOpen, setMenuOpen] = useState(false)
  const [activeSection, setActiveSection] = useState('items')

  const [items, setItems] = useState([])
  const [categories, setCategories] = useState([])
  const [stations, setStations] = useState([])

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [modalError, setModalError] = useState('')

  const [activeModal, setActiveModal] = useState(null)
  const [selectedRecord, setSelectedRecord] = useState(null)
  const [itemForm, setItemForm] = useState(initialItemForm)
  const [categoryForm, setCategoryForm] = useState(initialCategoryForm)

  const [itemSearch, setItemSearch] = useState('')
  const [itemStatusFilter, setItemStatusFilter] = useState('all')
  const [itemCategoryFilter, setItemCategoryFilter] = useState('all')
  const [itemStationFilter, setItemStationFilter] = useState('all')

  const [categorySearch, setCategorySearch] = useState('')
  const [categoryStatusFilter, setCategoryStatusFilter] = useState('all')

  const visibleMenuSections = useMemo(
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

  const activeCategories = useMemo(
    () => categories.filter((category) => category.isActive),
    [categories],
  )

  const activeStations = useMemo(
    () => stations.filter((station) => station.isActive),
    [stations],
  )

  const selectedItemCategoryOptions = useMemo(
    () =>
      includeSelectedInactiveOption(
        activeCategories,
        categories,
        itemForm.categoryId,
      ),
    [activeCategories, categories, itemForm.categoryId],
  )

  const selectedItemStationOptions = useMemo(
    () =>
      includeSelectedInactiveOption(
        activeStations,
        stations,
        itemForm.stationId,
      ),
    [activeStations, stations, itemForm.stationId],
  )

  const filteredItems = useMemo(() => {
    const search = itemSearch.trim().toLowerCase()

    return items.filter((item) => {
      const name = String(item.name ?? '').toLowerCase()
      const categoryName = String(item.category?.name ?? '').toLowerCase()
      const stationName = String(item.station?.name ?? '').toLowerCase()
      const stationCode = String(item.station?.code ?? '').toLowerCase()

      const matchesSearch =
        !search ||
        name.includes(search) ||
        categoryName.includes(search) ||
        stationName.includes(search) ||
        stationCode.includes(search)

      const matchesStatus =
        itemStatusFilter === 'all' ||
        (itemStatusFilter === 'active' && item.isActive) ||
        (itemStatusFilter === 'inactive' && !item.isActive)

      const matchesCategory =
        itemCategoryFilter === 'all' ||
        String(item.category?.id) === String(itemCategoryFilter)

      const matchesStation =
        itemStationFilter === 'all' ||
        String(item.station?.id) === String(itemStationFilter)

      return (
        matchesSearch &&
        matchesStatus &&
        matchesCategory &&
        matchesStation
      )
    })
  }, [
    itemSearch,
    itemStatusFilter,
    itemCategoryFilter,
    itemStationFilter,
    items,
  ])

  const filteredCategories = useMemo(() => {
    const search = categorySearch.trim().toLowerCase()

    return categories.filter((category) => {
      const name = String(category.name ?? '').toLowerCase()

      const matchesSearch = !search || name.includes(search)

      const matchesStatus =
        categoryStatusFilter === 'all' ||
        (categoryStatusFilter === 'active' && category.isActive) ||
        (categoryStatusFilter === 'inactive' && !category.isActive)

      return matchesSearch && matchesStatus
    })
  }, [categorySearch, categoryStatusFilter, categories])

  const stats = useMemo(
    () => ({
      activeItems: items.filter((item) => item.isActive).length,
      inactiveItems: items.filter((item) => !item.isActive).length,
      activeCategories: categories.filter((category) => category.isActive)
        .length,
      inactiveCategories: categories.filter((category) => !category.isActive)
        .length,
    }),
    [items, categories],
  )

  const loadMenuData = useCallback(
    async ({ preserveMessages = false } = {}) => {
      try {
        setLoading(true)
        setError('')
        if (!preserveMessages) setSuccess('')

        const [itemsPayload, categoriesPayload, stationsPayload] =
          await Promise.all([
            getMenuItemsRequest(),
            getMenuCategoriesRequest(),
            getMenuStationsRequest(),
          ])

        setItems(normalizeList(itemsPayload, 'items'))
        setCategories(normalizeList(categoriesPayload, 'categories'))
        setStations(normalizeList(stationsPayload, 'stations'))
      } catch (requestError) {
        setError(
          getErrorMessage(
            requestError,
            'No se pudo cargar la información del menú.',
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
    setItemForm(initialItemForm)
    setCategoryForm(initialCategoryForm)
  }, [saving])

  useEffect(() => {
    loadMenuData()
  }, [loadMenuData])

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

  function handleItemFieldChange(event) {
    const { name, value, type, checked } = event.target

    setItemForm((current) => ({
      ...current,
      [name]: type === 'checkbox' ? checked : value,
    }))
  }

  function handleCategoryFieldChange(event) {
    const { name, value, type, checked } = event.target

    setCategoryForm((current) => ({
      ...current,
      [name]: type === 'checkbox' ? checked : value,
    }))
  }

  function openCreateItemModal() {
    clearPageMessages()
    setModalError('')
    setSelectedRecord(null)
    setItemForm(initialItemForm)
    setActiveModal('create-item')
  }

  function openEditItemModal(item) {
    clearPageMessages()
    setModalError('')
    setSelectedRecord(item)
    setItemForm({
      name: item.name ?? '',
      basePrice: item.basePrice ?? '',
      categoryId: String(item.category?.id ?? ''),
      stationId: String(item.station?.id ?? ''),
      isActive: Boolean(item.isActive),
    })
    setActiveModal('edit-item')
  }

  function openItemDetailModal(item) {
    clearPageMessages()
    setModalError('')
    setSelectedRecord(item)
    setActiveModal('detail-item')
  }

  function openItemStatusModal(item) {
    clearPageMessages()
    setModalError('')
    setSelectedRecord(item)
    setActiveModal('status-item')
  }

  function openCreateCategoryModal() {
    clearPageMessages()
    setModalError('')
    setSelectedRecord(null)
    setCategoryForm(initialCategoryForm)
    setActiveModal('create-category')
  }

  function openEditCategoryModal(category) {
    clearPageMessages()
    setModalError('')
    setSelectedRecord(category)
    setCategoryForm({
      name: category.name ?? '',
      isActive: Boolean(category.isActive),
    })
    setActiveModal('edit-category')
  }

  function openCategoryDetailModal(category) {
    clearPageMessages()
    setModalError('')
    setSelectedRecord(category)
    setActiveModal('detail-category')
  }

  function openCategoryStatusModal(category) {
    clearPageMessages()
    setModalError('')
    setSelectedRecord(category)
    setActiveModal('status-category')
  }

  async function handleItemSubmit(event) {
    event.preventDefault()
    setModalError('')

    const name = itemForm.name.trim()
    const basePrice = itemForm.basePrice.trim()
    const categoryId = Number(itemForm.categoryId)
    const stationId = Number(itemForm.stationId)

    if (!name) {
      setModalError('El nombre del producto es obligatorio.')
      return
    }

    if (!categoryId) {
      setModalError('Selecciona una categoría.')
      return
    }

    if (!stationId) {
      setModalError('Selecciona una estación.')
      return
    }

    if (!/^\d+(\.\d{1,2})?$/.test(basePrice) || Number(basePrice) <= 0) {
      setModalError('El precio debe ser mayor a 0 y usar hasta 2 decimales.')
      return
    }

    const selectedCategory = categories.find(
      (category) => String(category.id) === String(itemForm.categoryId),
    )
    const selectedStation = stations.find(
      (station) => String(station.id) === String(itemForm.stationId),
    )

    if (!selectedCategory?.isActive) {
      setModalError('Selecciona una categoría activa.')
      return
    }

    if (!selectedStation?.isActive) {
      setModalError('Selecciona una estación activa.')
      return
    }

    const isEditing = activeModal === 'edit-item' && selectedRecord

    try {
      setSaving(true)

      const basePayload = {
        categoryId,
        stationId,
        name,
        basePrice,
      }

      if (isEditing) {
        await updateMenuItemRequest(selectedRecord.id, basePayload)
      } else {
        await createMenuItemRequest({
          ...basePayload,
          isActive: itemForm.isActive,
        })
      }

      const successMessage = isEditing
        ? 'Producto actualizado correctamente.'
        : 'Producto creado correctamente.'

      setActiveModal(null)
      setSelectedRecord(null)
      setModalError('')
      setItemForm(initialItemForm)
      setSuccess(successMessage)
      await loadMenuData({ preserveMessages: true })
    } catch (requestError) {
      setModalError(
        getErrorMessage(requestError, 'No se pudo guardar el producto.'),
      )
    } finally {
      setSaving(false)
    }
  }

  async function handleItemStatusSubmit() {
    if (!selectedRecord) return

    const nextStatus = !selectedRecord.isActive

    if (
      nextStatus &&
      (!selectedRecord.category?.isActive ||
        !selectedRecord.station?.isActive)
    ) {
      setModalError(
        'Para activar este producto, su categoría y estación deben estar activas.',
      )
      return
    }

    try {
      setSaving(true)
      setModalError('')

      await updateMenuItemStatusRequest(selectedRecord.id, nextStatus)

      setActiveModal(null)
      setSelectedRecord(null)
      setSuccess(
        nextStatus
          ? 'Producto activado correctamente.'
          : 'Producto desactivado correctamente.',
      )
      await loadMenuData({ preserveMessages: true })
    } catch (requestError) {
      setModalError(
        getErrorMessage(
          requestError,
          'No se pudo cambiar el estado del producto.',
        ),
      )
    } finally {
      setSaving(false)
    }
  }

  async function handleCategorySubmit(event) {
    event.preventDefault()
    setModalError('')

    const name = categoryForm.name.trim()

    if (!name) {
      setModalError('El nombre de la categoría es obligatorio.')
      return
    }

    const isEditing = activeModal === 'edit-category' && selectedRecord

    try {
      setSaving(true)

      const basePayload = {
        name,
      }

      if (isEditing) {
        await updateMenuCategoryRequest(selectedRecord.id, basePayload)
      } else {
        await createMenuCategoryRequest({
          ...basePayload,
          isActive: categoryForm.isActive,
        })
      }

      const successMessage = isEditing
        ? 'Categoría actualizada correctamente.'
        : 'Categoría creada correctamente.'

      setActiveModal(null)
      setSelectedRecord(null)
      setModalError('')
      setCategoryForm(initialCategoryForm)
      setSuccess(successMessage)
      await loadMenuData({ preserveMessages: true })
    } catch (requestError) {
      setModalError(
        getErrorMessage(requestError, 'No se pudo guardar la categoría.'),
      )
    } finally {
      setSaving(false)
    }
  }

  async function handleCategoryStatusSubmit() {
    if (!selectedRecord) return

    try {
      setSaving(true)
      setModalError('')

      const nextStatus = !selectedRecord.isActive
      await updateMenuCategoryStatusRequest(selectedRecord.id, nextStatus)

      setActiveModal(null)
      setSelectedRecord(null)
      setSuccess(
        nextStatus
          ? 'Categoría activada correctamente.'
          : 'Categoría desactivada correctamente.',
      )
      await loadMenuData({ preserveMessages: true })
    } catch (requestError) {
      setModalError(
        getErrorMessage(
          requestError,
          'No se pudo cambiar el estado de la categoría.',
        ),
      )
    } finally {
      setSaving(false)
    }
  }

  const activeSectionData = menuSections.find(
    (section) => section.id === activeSection,
  )

  const currentCategoryActiveItems = selectedRecord
    ? items.filter(
        (item) =>
          String(item.category?.id) === String(selectedRecord.id) &&
          item.isActive,
      ).length
    : 0

  return (
    <main className="admin-menu-page">
      <section className="admin-menu-hero">
        <div>
          <span className="admin-menu-eyebrow">Restaurante</span>
          <h1>Menú del Restaurante</h1>
          <p>
            Gestiona productos, precios, categorías y disponibilidad del menú
            del restaurante.
          </p>
          <small className="admin-menu-session">
            Sesión: {user?.fullName || user?.username || 'Administrador'}
          </small>
        </div>

        <div className="admin-menu-hero-actions">
          <div className="admin-menu-system-wrapper" ref={menuRef}>
            <button
              type="button"
              className="btn admin-menu-system-button"
              onClick={() => setMenuOpen((current) => !current)}
              aria-expanded={menuOpen}
              aria-controls="admin-menu-system-panel"
            >
              <span aria-hidden="true">☰</span>
              Menú
            </button>

            {menuOpen && (
              <div
                className="admin-menu-system-panel"
                id="admin-menu-system-panel"
              >
                <div className="admin-menu-system-header">
                  <div>
                    <strong>Módulos del sistema</strong>
                    <p>Accede a las áreas habilitadas para tu cuenta.</p>
                  </div>

                  <button
                    type="button"
                    className="admin-menu-system-close"
                    onClick={() => setMenuOpen(false)}
                    aria-label="Cerrar menú"
                  >
                    ×
                  </button>
                </div>

                <div className="admin-menu-system-sections">
                  {visibleMenuSections.map((section) => (
                    <section
                      className="admin-menu-system-section"
                      key={section.title}
                    >
                      <h2>{section.title}</h2>

                      <div className="admin-menu-system-items">
                        {section.items.map((item) => (
                          <Link
                            to={item.to}
                            className={`admin-menu-system-item ${
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
            className="btn admin-menu-secondary-button"
          >
            Volver al dashboard
          </Link>

          <button
            type="button"
            className="btn admin-menu-logout"
            onClick={logout}
          >
            Cerrar sesión
          </button>
        </div>
      </section>

      {error && (
        <section className="admin-menu-alert admin-menu-alert-error">
          {error}
        </section>
      )}

      {success && (
        <section className="admin-menu-alert admin-menu-alert-success">
          {success}
        </section>
      )}

      <section className="admin-menu-card admin-menu-overview-card">
        <div className="admin-menu-overview-heading">
          <span className="admin-menu-section-eyebrow">Resumen del menú</span>
          <h2>Estado actual</h2>
          <p>
            Consulta disponibilidad y organización antes de realizar cambios.
          </p>
        </div>

        <div className="admin-menu-stats-grid">
          <StatCard
            label="Productos activos"
            value={loading ? '...' : stats.activeItems}
            helper="Disponibles para órdenes"
            tone="success"
          />
          <StatCard
            label="Productos inactivos"
            value={loading ? '...' : stats.inactiveItems}
            helper="Fuera de venta"
            tone="warning"
          />
          <StatCard
            label="Categorías activas"
            value={loading ? '...' : stats.activeCategories}
            helper="Grupos disponibles"
          />
          <StatCard
            label="Categorías inactivas"
            value={loading ? '...' : stats.inactiveCategories}
            helper="Fuera de uso"
          />
        </div>
      </section>

      <nav
        className="admin-menu-section-navigation"
        aria-label="Áreas del menú"
      >
        {menuSections.map((section) => {
          const count =
            section.id === 'items' ? items.length : categories.length

          return (
            <button
              type="button"
              className={`admin-menu-section-tab ${
                activeSection === section.id ? 'is-active' : ''
              }`}
              onClick={() => handleSectionChange(section.id)}
              key={section.id}
            >
              <span
                className="admin-menu-section-tab-icon"
                aria-hidden="true"
              >
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

      <section className="admin-menu-card admin-menu-management-card">
        <div className="admin-menu-management-header">
          <div>
            <span className="admin-menu-section-eyebrow">
              Gestión del menú
            </span>
            <h2>
              {activeSection === 'items'
                ? 'Productos registrados'
                : 'Categorías registradas'}
            </h2>
            <p>{activeSectionData?.description}</p>
          </div>

          {activeSection === 'items' && (
            <button
              type="button"
              className="admin-menu-primary-button"
              onClick={openCreateItemModal}
              disabled={saving}
            >
              + Nuevo producto
            </button>
          )}

          {activeSection === 'categories' && (
            <button
              type="button"
              className="admin-menu-primary-button"
              onClick={openCreateCategoryModal}
              disabled={saving}
            >
              + Nueva categoría
            </button>
          )}
        </div>

        {activeSection === 'items' && (
          <>
            <div className="admin-menu-filters admin-menu-item-filters">
              <label>
                Buscar
                <input
                  type="search"
                  value={itemSearch}
                  onChange={(event) => setItemSearch(event.target.value)}
                  placeholder="Producto, categoría o estación..."
                />
              </label>

              <label>
                Estado
                <select
                  value={itemStatusFilter}
                  onChange={(event) =>
                    setItemStatusFilter(event.target.value)
                  }
                >
                  <option value="all">Todos</option>
                  <option value="active">Activos</option>
                  <option value="inactive">Inactivos</option>
                </select>
              </label>

              <label>
                Categoría
                <select
                  value={itemCategoryFilter}
                  onChange={(event) =>
                    setItemCategoryFilter(event.target.value)
                  }
                >
                  <option value="all">Todas</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Estación
                <select
                  value={itemStationFilter}
                  onChange={(event) =>
                    setItemStationFilter(event.target.value)
                  }
                >
                  <option value="all">Todas</option>
                  {stations.map((station) => (
                    <option key={station.id} value={station.id}>
                      {station.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="admin-menu-results-summary">
              {loading
                ? 'Cargando productos...'
                : `${filteredItems.length} de ${items.length} producto(s)`}
            </div>

            {loading ? (
              <div className="admin-menu-empty-state">
                Cargando productos...
              </div>
            ) : filteredItems.length > 0 ? (
              <div className="admin-menu-table" role="table">
                <div
                  className="admin-menu-table-head admin-menu-item-grid"
                  role="row"
                >
                  <span>Producto</span>
                  <span>Precio</span>
                  <span>Categoría</span>
                  <span>Estación</span>
                  <span>Estado</span>
                  <span>Acciones</span>
                </div>

                <div className="admin-menu-table-body">
                  {filteredItems.map((item) => (
                    <article
                      className="admin-menu-table-row admin-menu-item-grid"
                      key={item.id}
                    >
                      <div
                        className="admin-menu-product-identity"
                        data-label="Producto"
                      >
                        <span
                          className="admin-menu-product-icon"
                          aria-hidden="true"
                        >
                          🍴
                        </span>
                        <div>
                          <strong>{item.name}</strong>
                          <small>
                            Actualizado {formatShortDate(item.updatedAt || item.createdAt)}
                          </small>
                        </div>
                      </div>

                      <div className="admin-menu-cell" data-label="Precio">
                        <strong>{formatMoney(item.basePrice)}</strong>
                      </div>

                      <div
                        className="admin-menu-cell"
                        data-label="Categoría"
                      >
                        <strong>{item.category?.name || 'Sin categoría'}</strong>
                        {!item.category?.isActive && (
                          <small className="is-warning-text">
                            Categoría inactiva
                          </small>
                        )}
                      </div>

                      <div className="admin-menu-cell" data-label="Estación">
                        <strong>{item.station?.name || 'Sin estación'}</strong>
                        <small>
                          {item.station?.code || 'Sin código'}
                          {!item.station?.isActive ? ' · Inactiva' : ''}
                        </small>
                      </div>

                      <div className="admin-menu-cell" data-label="Estado">
                        <span
                          className={`admin-menu-status ${
                            item.isActive ? 'is-active' : 'is-inactive'
                          }`}
                        >
                          {item.isActive ? 'Activo' : 'Inactivo'}
                        </span>
                      </div>

                      <div
                        className="admin-menu-row-actions"
                        data-label="Acciones"
                      >
                        <button
                          type="button"
                          onClick={() => openItemDetailModal(item)}
                        >
                          Ver detalle
                        </button>

                        <button
                          type="button"
                          onClick={() => openEditItemModal(item)}
                          disabled={saving}
                        >
                          Editar
                        </button>

                        <button
                          type="button"
                          className={item.isActive ? 'is-danger' : 'is-success'}
                          onClick={() => openItemStatusModal(item)}
                          disabled={saving}
                        >
                          {item.isActive ? 'Desactivar' : 'Activar'}
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            ) : (
              <div className="admin-menu-empty-state">
                No hay productos que coincidan con los filtros.
              </div>
            )}
          </>
        )}

        {activeSection === 'categories' && (
          <>
            <div className="admin-menu-filters admin-menu-category-filters">
              <label>
                Buscar
                <input
                  type="search"
                  value={categorySearch}
                  onChange={(event) =>
                    setCategorySearch(event.target.value)
                  }
                  placeholder="Nombre de categoría..."
                />
              </label>

              <label>
                Estado
                <select
                  value={categoryStatusFilter}
                  onChange={(event) =>
                    setCategoryStatusFilter(event.target.value)
                  }
                >
                  <option value="all">Todas</option>
                  <option value="active">Activas</option>
                  <option value="inactive">Inactivas</option>
                </select>
              </label>
            </div>

            <div className="admin-menu-results-summary">
              {loading
                ? 'Cargando categorías...'
                : `${filteredCategories.length} de ${categories.length} categoría(s)`}
            </div>

            {loading ? (
              <div className="admin-menu-empty-state">
                Cargando categorías...
              </div>
            ) : filteredCategories.length > 0 ? (
              <div className="admin-menu-table" role="table">
                <div
                  className="admin-menu-table-head admin-menu-category-grid"
                  role="row"
                >
                  <span>Categoría</span>
                  <span>Productos</span>
                  <span>Estado</span>
                  <span>Acciones</span>
                </div>

                <div className="admin-menu-table-body">
                  {filteredCategories.map((category) => {
                    const activeItemsCount = items.filter(
                      (item) =>
                        String(item.category?.id) === String(category.id) &&
                        item.isActive,
                    ).length

                    return (
                      <article
                        className="admin-menu-table-row admin-menu-category-grid"
                        key={category.id}
                      >
                        <div
                          className="admin-menu-category-identity"
                          data-label="Categoría"
                        >
                          <span
                            className="admin-menu-category-icon"
                            aria-hidden="true"
                          >
                            🗂️
                          </span>
                          <div>
                            <strong>{category.name}</strong>
                            <small>
                              {activeItemsCount} activo(s)
                            </small>
                          </div>
                        </div>

                        <div
                          className="admin-menu-cell"
                          data-label="Productos"
                        >
                          <strong>{Number(category.itemsCount ?? 0)}</strong>
                          <small>registrados</small>
                        </div>

                        <div className="admin-menu-cell" data-label="Estado">
                          <span
                            className={`admin-menu-status ${
                              category.isActive
                                ? 'is-active'
                                : 'is-inactive'
                            }`}
                          >
                            {category.isActive ? 'Activa' : 'Inactiva'}
                          </span>
                        </div>

                        <div
                          className="admin-menu-row-actions"
                          data-label="Acciones"
                        >
                          <button
                            type="button"
                            onClick={() =>
                              openCategoryDetailModal(category)
                            }
                          >
                            Ver detalle
                          </button>

                          <button
                            type="button"
                            onClick={() => openEditCategoryModal(category)}
                            disabled={saving}
                          >
                            Editar
                          </button>

                          <button
                            type="button"
                            className={
                              category.isActive ? 'is-danger' : 'is-success'
                            }
                            onClick={() =>
                              openCategoryStatusModal(category)
                            }
                            disabled={saving}
                          >
                            {category.isActive ? 'Desactivar' : 'Activar'}
                          </button>
                        </div>
                      </article>
                    )
                  })}
                </div>
              </div>
            ) : (
              <div className="admin-menu-empty-state">
                No hay categorías que coincidan con los filtros.
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
            activeModal === 'create-item' ||
            activeModal === 'edit-item' ||
            activeModal === 'detail-item'
          }
          onClose={closeModal}
          saving={saving}
        >
          {modalError && (
            <div className="admin-menu-modal-error">{modalError}</div>
          )}

          {(activeModal === 'create-item' ||
            activeModal === 'edit-item') && (
            <form
              className="admin-menu-form"
              onSubmit={handleItemSubmit}
            >
              <section className="admin-menu-form-section">
                <div className="admin-menu-form-section-heading">
                  <span>1</span>
                  <div>
                    <strong>Producto y precio</strong>
                    <small>
                      Usa un nombre fácil de reconocer al tomar una orden.
                    </small>
                  </div>
                </div>

                <div className="admin-menu-form-grid">
                  <label className="admin-menu-field admin-menu-field-full">
                    Nombre
                    <input
                      type="text"
                      name="name"
                      value={itemForm.name}
                      onChange={handleItemFieldChange}
                      placeholder="Ej: Pollo jalapeño"
                      maxLength={120}
                      required
                    />
                  </label>

                  <label className="admin-menu-field">
                    Precio
                    <input
                      type="text"
                      name="basePrice"
                      value={itemForm.basePrice}
                      onChange={handleItemFieldChange}
                      placeholder="Ej: 180.00"
                      inputMode="decimal"
                      required
                    />
                    <small>Precio base en córdobas.</small>
                  </label>
                </div>
              </section>

              <section className="admin-menu-form-section">
                <div className="admin-menu-form-section-heading">
                  <span>2</span>
                  <div>
                    <strong>Organización</strong>
                    <small>
                      Define dónde aparece y dónde se prepara el producto.
                    </small>
                  </div>
                </div>

                <div className="admin-menu-form-grid">
                  <label className="admin-menu-field">
                    Categoría
                    <select
                      name="categoryId"
                      value={itemForm.categoryId}
                      onChange={handleItemFieldChange}
                      required
                    >
                      <option value="">Selecciona una categoría</option>
                      {selectedItemCategoryOptions.map((category) => (
                        <option
                          key={category.id}
                          value={category.id}
                          disabled={!category.isActive}
                        >
                          {category.name}
                          {!category.isActive ? ' (Inactiva)' : ''}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="admin-menu-field">
                    Estación
                    <select
                      name="stationId"
                      value={itemForm.stationId}
                      onChange={handleItemFieldChange}
                      required
                    >
                      <option value="">Selecciona una estación</option>
                      {selectedItemStationOptions.map((station) => (
                        <option
                          key={station.id}
                          value={station.id}
                          disabled={!station.isActive}
                        >
                          {station.name} ({station.code})
                          {!station.isActive ? ' · Inactiva' : ''}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </section>

              {activeModal === 'create-item' && (
                <section className="admin-menu-form-section">
                  <div className="admin-menu-form-section-heading">
                    <span>3</span>
                    <div>
                      <strong>Estado inicial</strong>
                      <small>
                        Decide si estará disponible para órdenes desde ahora.
                      </small>
                    </div>
                  </div>

                  <label className="admin-menu-switch">
                    <input
                      type="checkbox"
                      name="isActive"
                      checked={itemForm.isActive}
                      onChange={handleItemFieldChange}
                    />
                    <span className="admin-menu-switch-control" />
                    <span>
                      <strong>Producto activo</strong>
                      <small>Disponible para tomar órdenes.</small>
                    </span>
                  </label>
                </section>
              )}

              <ModalActions
                saving={saving}
                onCancel={closeModal}
                primaryLabel={
                  activeModal === 'edit-item'
                    ? 'Guardar cambios'
                    : 'Crear producto'
                }
              />
            </form>
          )}

          {activeModal === 'detail-item' && selectedRecord && (
            <div className="admin-menu-detail-stack">
              <div className="admin-menu-detail-hero">
                <span
                  className="admin-menu-product-icon is-large"
                  aria-hidden="true"
                >
                  🍴
                </span>

                <div>
                  <strong>{selectedRecord.name}</strong>
                  <p>{formatMoney(selectedRecord.basePrice)}</p>
                </div>

                <span
                  className={`admin-menu-status ${
                    selectedRecord.isActive
                      ? 'is-active'
                      : 'is-inactive'
                  }`}
                >
                  {selectedRecord.isActive ? 'Activo' : 'Inactivo'}
                </span>
              </div>

              <div className="admin-menu-detail-grid">
                <DetailItem
                  label="Categoría"
                  value={selectedRecord.category?.name || 'Sin categoría'}
                  helper={
                    selectedRecord.category?.isActive
                      ? 'Activa'
                      : 'Categoría inactiva'
                  }
                />
                <DetailItem
                  label="Estación"
                  value={selectedRecord.station?.name || 'Sin estación'}
                  helper={
                    selectedRecord.station
                      ? `${selectedRecord.station.code} · ${
                          selectedRecord.station.isActive
                            ? 'Activa'
                            : 'Inactiva'
                        }`
                      : ''
                  }
                />
                <DetailItem
                  label="Creado"
                  value={formatDateTime(selectedRecord.createdAt)}
                />
                <DetailItem
                  label="Último cambio"
                  value={
                    selectedRecord.updatedAt
                      ? formatDateTime(selectedRecord.updatedAt)
                      : 'Sin cambios posteriores'
                  }
                />
              </div>

              {(!selectedRecord.category?.isActive ||
                !selectedRecord.station?.isActive) && (
                <div className="admin-menu-warning-card">
                  <strong>Revisa su configuración</strong>
                  <p>
                    Este producto está relacionado con una categoría o estación
                    inactiva. No conviene activarlo hasta corregir esa relación.
                  </p>
                </div>
              )}

              <div className="admin-menu-modal-actions">
                <button
                  type="button"
                  className="admin-menu-secondary-action"
                  onClick={closeModal}
                >
                  Cerrar
                </button>

                <button
                  type="button"
                  className="admin-menu-secondary-action"
                  onClick={() => openEditItemModal(selectedRecord)}
                >
                  Editar
                </button>

                <button
                  type="button"
                  className={
                    selectedRecord.isActive
                      ? 'admin-menu-danger-button'
                      : 'admin-menu-primary-button'
                  }
                  onClick={() => openItemStatusModal(selectedRecord)}
                >
                  {selectedRecord.isActive ? 'Desactivar' : 'Activar'}
                </button>
              </div>
            </div>
          )}

          {activeModal === 'status-item' && selectedRecord && (
            <div className="admin-menu-modal-stack">
              <div className="admin-menu-confirmation-card">
                <span className="admin-menu-confirmation-icon">
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
                      ? 'Dejará de estar disponible al tomar nuevas órdenes.'
                      : 'Volverá a estar disponible para nuevas órdenes.'}
                  </p>
                </div>
              </div>

              <div className="admin-menu-detail-grid">
                <DetailItem
                  label="Precio"
                  value={formatMoney(selectedRecord.basePrice)}
                />
                <DetailItem
                  label="Categoría"
                  value={selectedRecord.category?.name || 'Sin categoría'}
                  helper={
                    selectedRecord.category?.isActive ? 'Activa' : 'Inactiva'
                  }
                />
                <DetailItem
                  label="Estación"
                  value={selectedRecord.station?.name || 'Sin estación'}
                  helper={
                    selectedRecord.station?.isActive ? 'Activa' : 'Inactiva'
                  }
                />
              </div>

              {!selectedRecord.isActive &&
                (!selectedRecord.category?.isActive ||
                  !selectedRecord.station?.isActive) && (
                  <div className="admin-menu-warning-card">
                    <strong>No se puede activar desde esta pantalla</strong>
                    <p>
                      Activa primero la categoría y la estación vinculadas, o
                      edita el producto para asignarle otras activas.
                    </p>
                  </div>
                )}

              <div className="admin-menu-modal-actions">
                <button
                  type="button"
                  className="admin-menu-secondary-action"
                  onClick={closeModal}
                  disabled={saving}
                >
                  Volver
                </button>

                <button
                  type="button"
                  className={
                    selectedRecord.isActive
                      ? 'admin-menu-danger-button'
                      : 'admin-menu-primary-button'
                  }
                  onClick={handleItemStatusSubmit}
                  disabled={
                    saving ||
                    (!selectedRecord.isActive &&
                      (!selectedRecord.category?.isActive ||
                        !selectedRecord.station?.isActive))
                  }
                >
                  {saving
                    ? 'Guardando...'
                    : selectedRecord.isActive
                      ? 'Desactivar producto'
                      : 'Activar producto'}
                </button>
              </div>
            </div>
          )}

          {(activeModal === 'create-category' ||
            activeModal === 'edit-category') && (
            <form
              className="admin-menu-form"
              onSubmit={handleCategorySubmit}
            >
              <section className="admin-menu-form-section">
                <div className="admin-menu-form-section-heading">
                  <span>1</span>
                  <div>
                    <strong>Datos de la categoría</strong>
                    <small>
                      Usa un nombre breve y fácil de reconocer.
                    </small>
                  </div>
                </div>

                <div className="admin-menu-form-grid">
                  <label className="admin-menu-field admin-menu-field-full">
                    Nombre
                    <input
                      type="text"
                      name="name"
                      value={categoryForm.name}
                      onChange={handleCategoryFieldChange}
                      placeholder="Ej: Bebidas calientes"
                      maxLength={80}
                      required
                    />
                  </label>
                </div>
              </section>

              {activeModal === 'create-category' && (
                <section className="admin-menu-form-section">
                  <div className="admin-menu-form-section-heading">
                    <span>2</span>
                    <div>
                      <strong>Estado inicial</strong>
                      <small>
                        Decide si estará disponible para asignar productos.
                      </small>
                    </div>
                  </div>

                  <label className="admin-menu-switch">
                    <input
                      type="checkbox"
                      name="isActive"
                      checked={categoryForm.isActive}
                      onChange={handleCategoryFieldChange}
                    />
                    <span className="admin-menu-switch-control" />
                    <span>
                      <strong>Categoría activa</strong>
                      <small>Disponible para nuevos productos.</small>
                    </span>
                  </label>
                </section>
              )}

              <ModalActions
                saving={saving}
                onCancel={closeModal}
                primaryLabel={
                  activeModal === 'edit-category'
                    ? 'Guardar cambios'
                    : 'Crear categoría'
                }
              />
            </form>
          )}

          {activeModal === 'detail-category' && selectedRecord && (
            <div className="admin-menu-detail-stack">
              <div className="admin-menu-detail-hero">
                <span
                  className="admin-menu-category-icon is-large"
                  aria-hidden="true"
                >
                  🗂️
                </span>

                <div>
                  <strong>{selectedRecord.name}</strong>
                  <p>Categoría del menú</p>
                </div>

                <span
                  className={`admin-menu-status ${
                    selectedRecord.isActive
                      ? 'is-active'
                      : 'is-inactive'
                  }`}
                >
                  {selectedRecord.isActive ? 'Activa' : 'Inactiva'}
                </span>
              </div>

              <div className="admin-menu-detail-grid">
                <DetailItem
                  label="Productos registrados"
                  value={String(Number(selectedRecord.itemsCount ?? 0))}
                />
                <DetailItem
                  label="Productos activos"
                  value={String(currentCategoryActiveItems)}
                />
              </div>

              <div className="admin-menu-modal-actions">
                <button
                  type="button"
                  className="admin-menu-secondary-action"
                  onClick={closeModal}
                >
                  Cerrar
                </button>

                <button
                  type="button"
                  className="admin-menu-secondary-action"
                  onClick={() => openEditCategoryModal(selectedRecord)}
                >
                  Editar
                </button>

                <button
                  type="button"
                  className={
                    selectedRecord.isActive
                      ? 'admin-menu-danger-button'
                      : 'admin-menu-primary-button'
                  }
                  onClick={() =>
                    openCategoryStatusModal(selectedRecord)
                  }
                >
                  {selectedRecord.isActive ? 'Desactivar' : 'Activar'}
                </button>
              </div>
            </div>
          )}

          {activeModal === 'status-category' && selectedRecord && (
            <div className="admin-menu-modal-stack">
              <div className="admin-menu-confirmation-card">
                <span className="admin-menu-confirmation-icon">
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
                      ? 'Dejará de estar disponible para asignar productos nuevos.'
                      : 'Volverá a estar disponible para organizar productos.'}
                  </p>
                </div>
              </div>

              <div className="admin-menu-detail-grid">
                <DetailItem
                  label="Productos registrados"
                  value={String(Number(selectedRecord.itemsCount ?? 0))}
                />
                <DetailItem
                  label="Productos activos"
                  value={String(currentCategoryActiveItems)}
                />
              </div>

              {selectedRecord.isActive &&
                currentCategoryActiveItems > 0 && (
                  <div className="admin-menu-warning-card">
                    <strong>Hay productos activos</strong>
                    <p>
                      El backend no permite desactivar una categoría mientras
                      tenga productos activos. Desactívalos o muévelos primero.
                    </p>
                  </div>
                )}

              <div className="admin-menu-modal-actions">
                <button
                  type="button"
                  className="admin-menu-secondary-action"
                  onClick={closeModal}
                  disabled={saving}
                >
                  Volver
                </button>

                <button
                  type="button"
                  className={
                    selectedRecord.isActive
                      ? 'admin-menu-danger-button'
                      : 'admin-menu-primary-button'
                  }
                  onClick={handleCategoryStatusSubmit}
                  disabled={
                    saving ||
                    (selectedRecord.isActive &&
                      currentCategoryActiveItems > 0)
                  }
                >
                  {saving
                    ? 'Guardando...'
                    : selectedRecord.isActive
                      ? 'Desactivar categoría'
                      : 'Activar categoría'}
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
      className={`admin-menu-stat ${tone ? `is-${tone}` : ''}`}
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
      className="admin-menu-modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <section
        className={`admin-menu-modal ${wide ? 'is-wide' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <header className="admin-menu-modal-header">
          <div>
            <h2>{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>

          <button
            type="button"
            className="admin-menu-modal-close"
            onClick={onClose}
            disabled={saving}
            aria-label="Cerrar ventana"
          >
            ×
          </button>
        </header>

        <div className="admin-menu-modal-body">{children}</div>
      </section>
    </div>
  )
}

function ModalActions({ saving, onCancel, primaryLabel }) {
  return (
    <div className="admin-menu-modal-actions">
      <button
        type="button"
        className="admin-menu-secondary-action"
        onClick={onCancel}
        disabled={saving}
      >
        Cancelar
      </button>

      <button
        type="submit"
        className="admin-menu-primary-button"
        disabled={saving}
      >
        {saving ? 'Guardando...' : primaryLabel}
      </button>
    </div>
  )
}

function DetailItem({ label, value, helper = '' }) {
  return (
    <div className="admin-menu-detail-item">
      <span>{label}</span>
      <strong>{value}</strong>
      {helper && <small>{helper}</small>}
    </div>
  )
}

function getModalTitle(activeModal) {
  const titles = {
    'create-item': 'Nuevo producto',
    'edit-item': 'Editar producto',
    'detail-item': 'Detalle del producto',
    'status-item': 'Cambiar estado',
    'create-category': 'Nueva categoría',
    'edit-category': 'Editar categoría',
    'detail-category': 'Detalle de la categoría',
    'status-category': 'Cambiar estado',
  }

  return titles[activeModal] || 'Menú'
}

function getModalSubtitle(activeModal, record) {
  if (activeModal === 'create-item') {
    return 'Registra un producto para el menú del restaurante.'
  }

  if (
    activeModal === 'edit-item' ||
    activeModal === 'detail-item' ||
    activeModal === 'status-item'
  ) {
    return record?.name || ''
  }

  if (activeModal === 'create-category') {
    return 'Crea un grupo para organizar los productos.'
  }

  if (
    activeModal === 'edit-category' ||
    activeModal === 'detail-category' ||
    activeModal === 'status-category'
  ) {
    return record?.name || ''
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

function includeSelectedInactiveOption(
  activeOptions,
  allOptions,
  selectedId,
) {
  if (!selectedId) return activeOptions

  const selected = allOptions.find(
    (option) => String(option.id) === String(selectedId),
  )

  if (!selected || selected.isActive) return activeOptions

  return [selected, ...activeOptions]
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

function formatDateTime(value) {
  if (!value) return '—'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'

  return new Intl.DateTimeFormat('es-NI', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

function formatShortDate(value) {
  if (!value) return '—'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'

  return new Intl.DateTimeFormat('es-NI', {
    dateStyle: 'medium',
  }).format(date)
}

function getErrorMessage(error, fallback) {
  return (
    error?.response?.data?.message ||
    error?.response?.data?.error ||
    error?.message ||
    fallback
  )
}