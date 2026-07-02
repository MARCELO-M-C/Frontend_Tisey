import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { useAuth } from '../auth/AuthContext'
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

const menuTabs = [
  {
    id: 'items',
    label: 'Ítems',
    helper: 'Platillos, bebidas y productos disponibles para órdenes.',
  },
  {
    id: 'categories',
    label: 'Categorías',
    helper: 'Agrupa los productos del menú por tipo, prioridad o área.',
  },
  {
    id: 'stations',
    label: 'Estaciones',
    helper: 'Consulta las estaciones KDS usadas por los ítems del menú.',
  },
]

const initialItemForm = {
  id: '',
  name: '',
  basePrice: '',
  categoryId: '',
  stationId: '',
  isActive: true,
}

const initialCategoryForm = {
  id: '',
  name: '',
  sortOrder: '0',
  isActive: true,
}

export default function AdminMenuPage() {
  const { user, logout } = useAuth()

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [activeTab, setActiveTab] = useState('items')

  const [items, setItems] = useState([])
  const [categories, setCategories] = useState([])
  const [stations, setStations] = useState([])

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [itemSearch, setItemSearch] = useState('')
  const [itemStatusFilter, setItemStatusFilter] = useState('all')
  const [itemCategoryFilter, setItemCategoryFilter] = useState('all')
  const [itemStationFilter, setItemStationFilter] = useState('all')

  const [categorySearch, setCategorySearch] = useState('')
  const [categoryStatusFilter, setCategoryStatusFilter] = useState('all')

  const [itemForm, setItemForm] = useState(initialItemForm)
  const [categoryForm, setCategoryForm] = useState(initialCategoryForm)

  useEffect(() => {
    loadMenuData()
  }, [])

  const activeCategories = useMemo(
    () => categories.filter((category) => category.isActive),
    [categories],
  )

  const activeStations = useMemo(
    () => stations.filter((station) => station.isActive),
    [stations],
  )

  const filteredItems = useMemo(() => {
    const normalizedSearch = itemSearch.trim().toLowerCase()

    return items.filter((item) => {
      const name = String(item.name ?? '').toLowerCase()
      const categoryId = String(item.category?.id ?? '')
      const stationId = String(item.station?.id ?? '')

      const matchesSearch = !normalizedSearch || name.includes(normalizedSearch)

      const matchesStatus =
        itemStatusFilter === 'all' ||
        (itemStatusFilter === 'active' && item.isActive) ||
        (itemStatusFilter === 'inactive' && !item.isActive)

      const matchesCategory =
        itemCategoryFilter === 'all' || categoryId === String(itemCategoryFilter)

      const matchesStation =
        itemStationFilter === 'all' || stationId === String(itemStationFilter)

      return matchesSearch && matchesStatus && matchesCategory && matchesStation
    })
  }, [itemSearch, itemStatusFilter, itemCategoryFilter, itemStationFilter, items])

  const filteredCategories = useMemo(() => {
    const normalizedSearch = categorySearch.trim().toLowerCase()

    return categories.filter((category) => {
      const name = String(category.name ?? '').toLowerCase()

      const matchesSearch = !normalizedSearch || name.includes(normalizedSearch)

      const matchesStatus =
        categoryStatusFilter === 'all' ||
        (categoryStatusFilter === 'active' && category.isActive) ||
        (categoryStatusFilter === 'inactive' && !category.isActive)

      return matchesSearch && matchesStatus
    })
  }, [categorySearch, categoryStatusFilter, categories])

  const stats = useMemo(() => {
    const totalItems = items.length
    const activeItems = items.filter((item) => item.isActive).length
    const inactiveItems = items.filter((item) => !item.isActive).length
    const activeCategoryCount = categories.filter((category) => category.isActive).length

    return {
      totalItems,
      activeItems,
      inactiveItems,
      activeCategoryCount,
    }
  }, [items, categories])

  async function loadMenuData() {
    try {
      setLoading(true)
      setError('')

      const [itemsPayload, categoriesPayload, stationsPayload] = await Promise.all([
        getMenuItemsRequest(),
        getMenuCategoriesRequest(),
        getMenuStationsRequest(),
      ])

      setItems(normalizeList(itemsPayload))
      setCategories(normalizeList(categoriesPayload))
      setStations(normalizeList(stationsPayload))
    } catch (requestError) {
      setError(getErrorMessage(requestError, 'No se pudo cargar el menú.'))
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

  function startCreateItem() {
    clearMessages()
    setItemForm(initialItemForm)
    setActiveTab('items')
  }

  function startEditItem(item) {
    clearMessages()

    setItemForm({
      id: item.id,
      name: item.name ?? '',
      basePrice: item.basePrice ?? '',
      categoryId: item.category?.id ?? '',
      stationId: item.station?.id ?? '',
      isActive: Boolean(item.isActive),
    })

    setActiveTab('items')
  }

  function startCreateCategory() {
    clearMessages()
    setCategoryForm(initialCategoryForm)
    setActiveTab('categories')
  }

  function startEditCategory(category) {
    clearMessages()

    setCategoryForm({
      id: category.id,
      name: category.name ?? '',
      sortOrder: String(category.sortOrder ?? 0),
      isActive: Boolean(category.isActive),
    })

    setActiveTab('categories')
  }

  async function handleItemSubmit(event) {
    event.preventDefault()
    clearMessages()

    const isEditing = Boolean(itemForm.id)
    const name = itemForm.name.trim()
    const basePrice = itemForm.basePrice.trim()
    const categoryId = Number(itemForm.categoryId)
    const stationId = Number(itemForm.stationId)

    if (!name) {
      setError('El nombre del ítem es obligatorio.')
      return
    }

    if (!categoryId) {
      setError('Debes seleccionar una categoría.')
      return
    }

    if (!stationId) {
      setError('Debes seleccionar una estación KDS.')
      return
    }

    if (!/^\d+(\.\d{1,2})?$/.test(basePrice) || Number(basePrice) <= 0) {
      setError('El precio debe ser mayor a 0 y puede tener hasta 2 decimales.')
      return
    }

    const basePayload = {
      categoryId,
      stationId,
      name,
      basePrice,
    }

    try {
      setSaving(true)

      if (isEditing) {
        await updateMenuItemRequest(itemForm.id, basePayload)
        setSuccess('Ítem actualizado correctamente.')
      } else {
        await createMenuItemRequest({
          ...basePayload,
          isActive: itemForm.isActive,
        })

        setSuccess('Ítem creado correctamente.')
      }

      setItemForm(initialItemForm)
      await loadMenuData()
    } catch (requestError) {
      setError(getErrorMessage(requestError, 'No se pudo guardar el ítem.'))
    } finally {
      setSaving(false)
    }
  }

  async function handleCategorySubmit(event) {
    event.preventDefault()
    clearMessages()

    const isEditing = Boolean(categoryForm.id)
    const name = categoryForm.name.trim()
    const sortOrder = Number(categoryForm.sortOrder)

    if (!name) {
      setError('El nombre de la categoría es obligatorio.')
      return
    }

    if (!Number.isInteger(sortOrder) || sortOrder < 0 || sortOrder > 9999) {
      setError('El orden debe ser un número entero entre 0 y 9999.')
      return
    }

    const basePayload = {
      name,
      sortOrder,
    }

    try {
      setSaving(true)

      if (isEditing) {
        await updateMenuCategoryRequest(categoryForm.id, basePayload)
        setSuccess('Categoría actualizada correctamente.')
      } else {
        await createMenuCategoryRequest({
          ...basePayload,
          isActive: categoryForm.isActive,
        })

        setSuccess('Categoría creada correctamente.')
      }

      setCategoryForm(initialCategoryForm)
      await loadMenuData()
    } catch (requestError) {
      setError(getErrorMessage(requestError, 'No se pudo guardar la categoría.'))
    } finally {
      setSaving(false)
    }
  }

  async function handleToggleItemStatus(item) {
    clearMessages()

    try {
      setSaving(true)

      await updateMenuItemStatusRequest(item.id, !item.isActive)

      setSuccess(
        item.isActive
          ? 'Ítem desactivado correctamente.'
          : 'Ítem activado correctamente.',
      )

      await loadMenuData()
    } catch (requestError) {
      setError(getErrorMessage(requestError, 'No se pudo cambiar el estado del ítem.'))
    } finally {
      setSaving(false)
    }
  }

  async function handleToggleCategoryStatus(category) {
    clearMessages()

    try {
      setSaving(true)

      await updateMenuCategoryStatusRequest(category.id, !category.isActive)

      setSuccess(
        category.isActive
          ? 'Categoría desactivada correctamente.'
          : 'Categoría activada correctamente.',
      )

      await loadMenuData()
    } catch (requestError) {
      setError(
        getErrorMessage(
          requestError,
          'No se pudo cambiar el estado de la categoría.',
        ),
      )
    } finally {
      setSaving(false)
    }
  }

  const activeTabData = menuTabs.find((tab) => tab.id === activeTab)

  return (
    <main className="menu-page">
      <section className="menu-hero">
        <div>
          <span className="menu-eyebrow">Menú</span>

          <h1>Menú del Restaurante</h1>

          <p>
            Administra platillos, bebidas, precios, categorías y estación KDS
            asignada para la operación del restaurante.
          </p>

          <small className="menu-last-update">
            Sesión: {user?.fullName || user?.username || 'Administrador'}
          </small>
        </div>

        <div className="menu-hero-actions">
          <Link to="/dashboard" className="btn menu-secondary-button">
            Volver al dashboard
          </Link>

          <button type="button" className="btn menu-logout" onClick={logout}>
            Cerrar sesión
          </button>
        </div>
      </section>

      <section className="menu-layout">
        <aside className={`menu-sidebar ${drawerOpen ? 'is-open' : ''}`}>
          <div className="menu-sidebar-header">
            <strong>Menú admin</strong>

            <button
              type="button"
              className="menu-menu-close"
              onClick={() => setDrawerOpen(false)}
              aria-label="Cerrar menú"
            >
              ×
            </button>
          </div>

          <Link className="menu-menu-link" to="/admin/access">
            <span>Usuarios</span>
            <small>Usuarios y Accesos</small>
          </Link>

          <Link className="menu-menu-link" to="/admin/restaurant-tables">
            <span>Restaurante</span>
            <small>Mesas</small>
          </Link>

          <button type="button" className="menu-menu-item is-active">
            <span>Menú</span>
            <small>Productos y categorías</small>
          </button>

          <button type="button" className="menu-menu-item" disabled>
            <span>Órdenes</span>
            <small>Próximo módulo CRUD</small>
          </button>

          <button type="button" className="menu-menu-item" disabled>
            <span>Hospedaje</span>
            <small>Próximo módulo</small>
          </button>

          <button type="button" className="menu-menu-item" disabled>
            <span>Facturación</span>
            <small>Próximo módulo</small>
          </button>
        </aside>

        {drawerOpen && (
          <button
            type="button"
            className="menu-drawer-backdrop"
            onClick={() => setDrawerOpen(false)}
            aria-label="Cerrar menú administrativo"
          />
        )}

        <section className="menu-content">
          <div className="menu-toolbar">
            <button
              type="button"
              className="menu-menu-button"
              onClick={() => setDrawerOpen(true)}
            >
              ☰ Menú
            </button>

            <div>
              <span>Menú</span>
              <strong>Productos y categorías</strong>
            </div>
          </div>

          <section className="menu-card menu-title-card">
            <div className="menu-section-header">
              <div>
                <h2>{activeTabData?.label || 'Menú'}</h2>
                <p>{activeTabData?.helper}</p>
              </div>

              <button
                type="button"
                className="menu-small-button"
                onClick={loadMenuData}
                disabled={loading || saving}
              >
                Actualizar
              </button>
            </div>

            <div className="menu-tabs">
              {menuTabs.map((tab) => (
                <button
                  type="button"
                  className={`menu-tab ${activeTab === tab.id ? 'is-active' : ''}`}
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id)}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </section>

          {error && (
            <section className="menu-alert menu-alert-error">
              {error}
            </section>
          )}

          {success && (
            <section className="menu-alert menu-alert-success">
              {success}
            </section>
          )}

          <section className="menu-stats-grid">
            <article className="menu-stat">
              <span>Ítems totales</span>
              <strong>{loading ? '...' : stats.totalItems}</strong>
              <small>Productos registrados</small>
            </article>

            <article className="menu-stat stat-success">
              <span>Activos</span>
              <strong>{loading ? '...' : stats.activeItems}</strong>
              <small>Disponibles para vender</small>
            </article>

            <article className="menu-stat stat-danger">
              <span>Inactivos</span>
              <strong>{loading ? '...' : stats.inactiveItems}</strong>
              <small>Ocultos para operación</small>
            </article>

            <article className="menu-stat stat-warning">
              <span>Categorías activas</span>
              <strong>{loading ? '...' : stats.activeCategoryCount}</strong>
              <small>Grupos disponibles</small>
            </article>
          </section>

          {activeTab === 'items' && (
            <section className="menu-two-column">
              <article className="menu-card">
                <div className="menu-section-header">
                  <div>
                    <h2>{itemForm.id ? 'Editar ítem' : 'Nuevo ítem'}</h2>
                    <p>
                      Define nombre, precio, categoría y estación KDS.
                    </p>
                  </div>
                </div>

                <form className="menu-form" onSubmit={handleItemSubmit}>
                  <label>
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

                  <div className="menu-form-grid">
                    <label>
                      Precio base
                      <input
                        type="text"
                        name="basePrice"
                        value={itemForm.basePrice}
                        onChange={handleItemFieldChange}
                        placeholder="Ej: 180.00"
                        required
                      />
                    </label>

                    <label>
                      Categoría
                      <select
                        name="categoryId"
                        value={itemForm.categoryId}
                        onChange={handleItemFieldChange}
                        required
                      >
                        <option value="">Selecciona una categoría</option>

                        {activeCategories.map((category) => (
                          <option key={category.id} value={category.id}>
                            {category.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <label>
                    Estación KDS
                    <select
                      name="stationId"
                      value={itemForm.stationId}
                      onChange={handleItemFieldChange}
                      required
                    >
                      <option value="">Selecciona una estación</option>

                      {activeStations.map((station) => (
                        <option key={station.id} value={station.id}>
                          {station.name} ({station.code})
                        </option>
                      ))}
                    </select>
                  </label>

                  {!itemForm.id && (
                    <label className="menu-switch">
                      <input
                        type="checkbox"
                        name="isActive"
                        checked={itemForm.isActive}
                        onChange={handleItemFieldChange}
                      />

                      <span>
                        Crear ítem activo
                        <small>Disponible para tomar órdenes.</small>
                      </span>
                    </label>
                  )}

                  {itemForm.id && (
                    <p className="menu-muted">
                      El estado activo/inactivo se cambia desde el listado para
                      evitar modificaciones accidentales.
                    </p>
                  )}

                  <div className="menu-form-actions">
                    <button
                      type="submit"
                      className="menu-primary-button"
                      disabled={saving}
                    >
                      {saving
                        ? 'Guardando...'
                        : itemForm.id
                          ? 'Guardar cambios'
                          : 'Crear ítem'}
                    </button>

                    {itemForm.id && (
                      <button
                        type="button"
                        className="menu-small-button"
                        onClick={startCreateItem}
                        disabled={saving}
                      >
                        Cancelar edición
                      </button>
                    )}
                  </div>
                </form>
              </article>

              <article className="menu-card">
                <div className="menu-section-header">
                  <div>
                    <h2>Listado de ítems</h2>
                    <p>Busca y filtra productos por estado, categoría o estación.</p>
                  </div>
                </div>

                <div className="menu-filters menu-filters-wide">
                  <label>
                    Buscar
                    <input
                      type="search"
                      value={itemSearch}
                      onChange={(event) => setItemSearch(event.target.value)}
                      placeholder="Nombre del producto"
                    />
                  </label>

                  <label>
                    Estado
                    <select
                      value={itemStatusFilter}
                      onChange={(event) => setItemStatusFilter(event.target.value)}
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
                      onChange={(event) => setItemCategoryFilter(event.target.value)}
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
                      onChange={(event) => setItemStationFilter(event.target.value)}
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

                {loading ? (
                  <div className="menu-empty-state">
                    Cargando ítems...
                  </div>
                ) : filteredItems.length > 0 ? (
                  <div className="menu-list">
                    {filteredItems.map((item) => (
                      <div className="menu-list-item" key={item.id}>
                        <div>
                          <strong>{item.name}</strong>

                          <p>
                            {formatMoney(item.basePrice)}
                            {' · '}
                            {item.category?.name || 'Sin categoría'}
                            {' · '}
                            {item.station?.name || 'Sin estación'}
                          </p>

                          <div className="menu-badges">
                            <span className={item.isActive ? 'badge-success' : 'badge-danger'}>
                              {item.isActive ? 'Activo' : 'Inactivo'}
                            </span>

                            <span>{item.station?.code || 'Sin código KDS'}</span>
                          </div>
                        </div>

                        <div className="menu-row-actions">
                          <button
                            type="button"
                            onClick={() => startEditItem(item)}
                            disabled={saving}
                          >
                            Editar
                          </button>

                          <button
                            type="button"
                            onClick={() => handleToggleItemStatus(item)}
                            disabled={saving}
                          >
                            {item.isActive ? 'Desactivar' : 'Activar'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="menu-empty-state">
                    No hay ítems que coincidan con los filtros.
                  </div>
                )}
              </article>
            </section>
          )}

          {activeTab === 'categories' && (
            <section className="menu-two-column">
              <article className="menu-card">
                <div className="menu-section-header">
                  <div>
                    <h2>{categoryForm.id ? 'Editar categoría' : 'Nueva categoría'}</h2>
                    <p>
                      Ordena y agrupa los productos del menú.
                    </p>
                  </div>
                </div>

                <form className="menu-form" onSubmit={handleCategorySubmit}>
                  <label>
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

                  <label>
                    Orden
                    <input
                      type="number"
                      name="sortOrder"
                      value={categoryForm.sortOrder}
                      onChange={handleCategoryFieldChange}
                      min="0"
                      max="9999"
                    />
                  </label>

                  {!categoryForm.id && (
                    <label className="menu-switch">
                      <input
                        type="checkbox"
                        name="isActive"
                        checked={categoryForm.isActive}
                        onChange={handleCategoryFieldChange}
                      />

                      <span>
                        Crear categoría activa
                        <small>Disponible para asignar productos.</small>
                      </span>
                    </label>
                  )}

                  {categoryForm.id && (
                    <p className="menu-muted">
                      El estado activo/inactivo se cambia desde el listado.
                      No podrás desactivar una categoría que aún tenga ítems activos.
                    </p>
                  )}

                  <div className="menu-form-actions">
                    <button
                      type="submit"
                      className="menu-primary-button"
                      disabled={saving}
                    >
                      {saving
                        ? 'Guardando...'
                        : categoryForm.id
                          ? 'Guardar cambios'
                          : 'Crear categoría'}
                    </button>

                    {categoryForm.id && (
                      <button
                        type="button"
                        className="menu-small-button"
                        onClick={startCreateCategory}
                        disabled={saving}
                      >
                        Cancelar edición
                      </button>
                    )}
                  </div>
                </form>
              </article>

              <article className="menu-card">
                <div className="menu-section-header">
                  <div>
                    <h2>Listado de categorías</h2>
                    <p>Busca, edita o cambia el estado de una categoría.</p>
                  </div>
                </div>

                <div className="menu-filters">
                  <label>
                    Buscar
                    <input
                      type="search"
                      value={categorySearch}
                      onChange={(event) => setCategorySearch(event.target.value)}
                      placeholder="Nombre de categoría"
                    />
                  </label>

                  <label>
                    Estado
                    <select
                      value={categoryStatusFilter}
                      onChange={(event) => setCategoryStatusFilter(event.target.value)}
                    >
                      <option value="all">Todas</option>
                      <option value="active">Activas</option>
                      <option value="inactive">Inactivas</option>
                    </select>
                  </label>
                </div>

                {loading ? (
                  <div className="menu-empty-state">
                    Cargando categorías...
                  </div>
                ) : filteredCategories.length > 0 ? (
                  <div className="menu-list">
                    {filteredCategories.map((category) => (
                      <div className="menu-list-item" key={category.id}>
                        <div>
                          <strong>{category.name}</strong>

                          <p>
                            Orden {category.sortOrder}
                            {' · '}
                            {category.itemsCount} ítem(s)
                          </p>

                          <div className="menu-badges">
                            <span className={category.isActive ? 'badge-success' : 'badge-danger'}>
                              {category.isActive ? 'Activa' : 'Inactiva'}
                            </span>
                          </div>
                        </div>

                        <div className="menu-row-actions">
                          <button
                            type="button"
                            onClick={() => startEditCategory(category)}
                            disabled={saving}
                          >
                            Editar
                          </button>

                          <button
                            type="button"
                            onClick={() => handleToggleCategoryStatus(category)}
                            disabled={saving}
                          >
                            {category.isActive ? 'Desactivar' : 'Activar'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="menu-empty-state">
                    No hay categorías que coincidan con los filtros.
                  </div>
                )}
              </article>
            </section>
          )}

          {activeTab === 'stations' && (
            <section className="menu-card">
              <div className="menu-section-header">
                <div>
                  <h2>Estaciones KDS</h2>
                  <p>
                    Estas estaciones se usan para enviar cada ítem a cocina,
                    barra u otra área de preparación.
                  </p>
                </div>
              </div>

              {loading ? (
                <div className="menu-empty-state">
                  Cargando estaciones...
                </div>
              ) : stations.length > 0 ? (
                <div className="menu-station-grid">
                  {stations.map((station) => (
                    <article className="menu-station-card" key={station.id}>
                      <span>{station.code}</span>
                      <strong>{station.name}</strong>

                      <p>
                        {station.isActive
                          ? 'Disponible para asignar productos.'
                          : 'Estación inactiva.'}
                      </p>

                      <div className="menu-badges">
                        <span className={station.isActive ? 'badge-success' : 'badge-danger'}>
                          {station.isActive ? 'Activa' : 'Inactiva'}
                        </span>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="menu-empty-state">
                  No hay estaciones registradas.
                </div>
              )}
            </section>
          )}
        </section>
      </section>
    </main>
  )
}

function normalizeList(payload) {
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.items)) return payload.items
  if (Array.isArray(payload?.categories)) return payload.categories
  if (Array.isArray(payload?.stations)) return payload.stations
  if (Array.isArray(payload?.data)) return payload.data
  return []
}

function formatMoney(value) {
  const amount = Number(value)

  if (Number.isNaN(amount)) return `C$ ${value}`

  return new Intl.NumberFormat('es-NI', {
    style: 'currency',
    currency: 'NIO',
  }).format(amount)
}

function getErrorMessage(error, fallback) {
  return (
    error?.response?.data?.message ||
    error?.response?.data?.error ||
    error?.message ||
    fallback
  )
}