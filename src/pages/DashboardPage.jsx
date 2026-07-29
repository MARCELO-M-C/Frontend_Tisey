import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router'
import { useAuth } from '../auth/AuthContext'
import {
  canUseAnyPermission,
  canUsePermission,
  isAdminUser,
  isManagerUser,
} from '../auth/authHelpers'
import {
  formatWaitingTime,
  getAdminDashboardData,
} from '../services/dashboardService'
import './DashboardPage.css'

const systemSections = [
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

const quickActionDefinitions = [
  {
    title: 'Gestionar órdenes',
    description: 'Crear, revisar y dar seguimiento a las órdenes.',
    to: '/admin/orders',
    icon: '🍽️',
    variant: 'primary',
    permission: 'ADMIN_ORDERS_MANAGE',
  },
  {
    title: 'Ver cocina',
    description: 'Revisar órdenes pendientes y en preparación.',
    to: '/kitchen',
    icon: '👨‍🍳',
    variant: 'warning',
    permission: 'ADMIN_KITCHEN_MANAGE',
  },
  {
    title: 'Facturar',
    description: 'Cobrar órdenes listas o pendientes de pago.',
    to: '/billing',
    icon: '🧾',
    variant: 'success',
    permission: 'ADMIN_BILLING_MANAGE',
  },
  {
    title: 'Usuarios y accesos',
    description: 'Administrar usuarios y permisos individuales.',
    to: '/admin/access',
    icon: '⚙️',
    variant: 'dark',
    permission: 'ADMIN_USERS_MANAGE',
  },
]

const OPERATIONAL_SUMMARY_PERMISSIONS = [
  'ADMIN_ORDERS_MANAGE',
  'ADMIN_KITCHEN_MANAGE',
  'ADMIN_BILLING_MANAGE',
]

export default function DashboardPage() {
  const { user, logout } = useAuth()
  const menuRef = useRef(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [dashboardData, setDashboardData] = useState(null)
  const [loadingDashboard, setLoadingDashboard] = useState(true)
  const [dashboardError, setDashboardError] = useState('')
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null)

  const menuSections = useMemo(
    () =>
      systemSections
        .map((section) => ({
          ...section,
          items: section.items.filter((item) =>
            canUsePermission(user, item.permission),
          ),
        }))
        .filter((section) => section.items.length > 0),
    [user],
  )

  const availableModules = useMemo(
    () => menuSections.flatMap((section) => section.items),
    [menuSections],
  )

  const quickActions = useMemo(
    () =>
      quickActionDefinitions.filter((action) =>
        canUsePermission(user, action.permission),
      ),
    [user],
  )

  const canViewOperationalSummary = canUseAnyPermission(
    user,
    OPERATIONAL_SUMMARY_PERMISSIONS,
  )

  const canManageOrders = canUsePermission(user, 'ADMIN_ORDERS_MANAGE')
  const canViewKitchen = canUsePermission(user, 'ADMIN_KITCHEN_MANAGE')

  useEffect(() => {
    function handlePointerDown(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setMenuOpen(false)
      }
    }

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        setMenuOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  useEffect(() => {
    if (!canViewOperationalSummary) {
      setDashboardData(null)
      setDashboardError('')
      setLoadingDashboard(false)
      setLastUpdatedAt(null)
      return undefined
    }

    let mounted = true

    async function loadDashboard() {
      try {
        if (mounted) setDashboardError('')
        const data = await getAdminDashboardData()

        if (mounted) {
          setDashboardData(data)
          setLastUpdatedAt(new Date())
        }
      } catch {
        if (mounted) {
          setDashboardError('No se pudo cargar el resumen del dashboard.')
        }
      } finally {
        if (mounted) setLoadingDashboard(false)
      }
    }

    setLoadingDashboard(true)
    loadDashboard()
    const intervalId = window.setInterval(loadDashboard, 30000)

    return () => {
      mounted = false
      window.clearInterval(intervalId)
    }
  }, [canViewOperationalSummary])

  const todayStats = [
    {
      label: 'Órdenes de hoy',
      value: dashboardData?.stats.todayOrders ?? 0,
      helper: 'Realizadas por meseros',
      status: 'normal',
    },
    {
      label: 'En cocina',
      value: dashboardData?.stats.kitchenOrders ?? 0,
      helper: 'Pendientes o en preparación',
      status: 'warning',
    },
    {
      label: 'Listas para cobrar',
      value: dashboardData?.stats.readyToBillOrders ?? 0,
      helper: 'Esperando facturación',
      status: 'success',
    },
    {
      label: 'Críticas',
      value: dashboardData?.stats.criticalOrders ?? 0,
      helper: `Más de ${dashboardData?.config.criticalMinutes ?? 30} minutos`,
      status: 'danger',
    },
  ]

  const alerts = dashboardData?.alerts ?? []
  const lateOrders = dashboardData?.lateOrders ?? []
  const waiterSummary = dashboardData?.waiterSummary ?? []
  const isManager = isManagerUser(user) && !isAdminUser(user)

  return (
    <main className="admin-dashboard">
      <section className="dashboard-hero">
        <div>
          <span className="dashboard-eyebrow">Panel principal</span>
          <h1>Hola, {user?.firstName || user?.username || 'Administrador'}</h1>
          <p>
            {isManager
              ? 'Aquí encontrarás únicamente los módulos que la administración habilitó para tu cuenta.'
              : 'Este es el resumen del sistema. Revisa la operación diaria y accede a cada módulo administrativo.'}
          </p>

          {lastUpdatedAt && (
            <small className="dashboard-last-update">
              Última actualización: {formatTime(lastUpdatedAt)}
            </small>
          )}
        </div>

        <div className="dashboard-hero-actions">
          <div className="dashboard-menu-wrapper" ref={menuRef}>
            <button
              type="button"
              className="btn dashboard-menu-button"
              onClick={() => setMenuOpen((current) => !current)}
              aria-expanded={menuOpen}
              aria-controls="dashboard-admin-menu"
            >
              <span className="dashboard-menu-icon">☰</span>
              Menú
            </button>

            {menuOpen && (
              <div className="dashboard-menu-panel" id="dashboard-admin-menu">
                <div className="dashboard-menu-header">
                  <div>
                    <strong>Módulos del sistema</strong>
                    <p>Accede a las áreas habilitadas para tu cuenta.</p>
                  </div>
                  <button
                    type="button"
                    className="dashboard-menu-close"
                    onClick={() => setMenuOpen(false)}
                    aria-label="Cerrar menú"
                  >
                    ×
                  </button>
                </div>

                <div className="dashboard-menu-sections">
                  {menuSections.length > 0 ? (
                    menuSections.map((section) => (
                      <section className="dashboard-menu-section" key={section.title}>
                        <h3>{section.title}</h3>
                        <div className="dashboard-menu-items">
                          {section.items.map((item) => (
                            <Link
                              to={item.to}
                              className="dashboard-menu-item"
                              key={item.title}
                              onClick={() => setMenuOpen(false)}
                            >
                              <span>{item.icon}</span>
                              <div>
                                <strong>{item.title}</strong>
                                <p>{item.description}</p>
                              </div>
                            </Link>
                          ))}
                        </div>
                      </section>
                    ))
                  ) : (
                    <div className="dashboard-menu-empty">
                      No tienes módulos administrativos asignados.
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {canManageOrders && (
            <Link to="/admin/orders" className="btn dashboard-main-button">
              Nueva orden
            </Link>
          )}

          <button type="button" className="btn dashboard-logout" onClick={logout}>
            Cerrar sesión
          </button>
        </div>
      </section>

      {dashboardError && <section className="dashboard-error">{dashboardError}</section>}

      {canViewOperationalSummary && (
        <section className="dashboard-stats-grid">
          {todayStats.map((stat) => (
            <article className={`dashboard-stat stat-${stat.status}`} key={stat.label}>
              <span>{stat.label}</span>
              <strong>{loadingDashboard ? '...' : stat.value}</strong>
              <small>{stat.helper}</small>
            </article>
          ))}
        </section>
      )}

      <section className="dashboard-grid">
        <div className="dashboard-main-column">
          <section className="dashboard-card">
            <div className="dashboard-section-header">
              <div>
                <h2>Accesos rápidos</h2>
                <p>Selecciona una acción para continuar.</p>
              </div>
            </div>

            {quickActions.length > 0 ? (
              <div className="quick-actions-grid">
                {quickActions.map((action) => (
                  <Link
                    to={action.to}
                    className={`quick-action quick-action-${action.variant}`}
                    key={action.title}
                  >
                    <span className="quick-action-icon">{action.icon}</span>
                    <div>
                      <strong>{action.title}</strong>
                      <p>{action.description}</p>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="empty-dashboard-state">
                Tu cuenta puede entrar al panel, pero todavía no tiene módulos administrativos asignados.
              </div>
            )}
          </section>

          {canViewOperationalSummary && (
            <>
              <section className="dashboard-card">
                <div className="dashboard-section-header">
                  <div>
                    <h2>Órdenes con demora</h2>
                    <p>
                      Advertencia desde {dashboardData?.config.warningMinutes ?? 20} min. Crítico
                      desde {dashboardData?.config.criticalMinutes ?? 30} min.
                    </p>
                  </div>
                  {canViewKitchen && (
                    <Link to="/kitchen" className="dashboard-small-link">
                      Ver cocina
                    </Link>
                  )}
                </div>

                {loadingDashboard ? (
                  <div className="empty-dashboard-state">Cargando órdenes...</div>
                ) : lateOrders.length > 0 ? (
                  <div className="late-orders-list">
                    {lateOrders.map((order) => (
                      <div
                        className={`late-order-item late-${order.delayLevel}`}
                        key={order.id}
                      >
                        <div>
                          <strong>{order.orderCode || `Orden #${order.id}`}</strong>
                          <p>
                            {getWaiterName(order)} · {getOrderStatusLabel(order.status)}
                          </p>
                        </div>
                        <span>{formatWaitingTime(order.minutesWaiting)}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="empty-dashboard-state">
                    No hay órdenes demoradas por ahora.
                  </div>
                )}
              </section>

              <section className="dashboard-card">
                <div className="dashboard-section-header">
                  <div>
                    <h2>Órdenes por mesero</h2>
                    <p>Resumen de órdenes realizadas hoy.</p>
                  </div>
                  {canManageOrders && (
                    <Link to="/admin/orders" className="dashboard-small-link">
                      Ver órdenes
                    </Link>
                  )}
                </div>

                {loadingDashboard ? (
                  <div className="empty-dashboard-state">
                    Cargando resumen de meseros...
                  </div>
                ) : waiterSummary.length > 0 ? (
                  <div className="waiter-summary-list">
                    {waiterSummary.map((waiter) => (
                      <div className="waiter-summary-item" key={waiter.id}>
                        <div>
                          <strong>{waiter.name}</strong>
                          <p>{waiter.totalOrders} orden(es) tomadas hoy</p>
                        </div>
                        <div className="waiter-summary-badges">
                          <span>{waiter.kitchenOrders} en cocina</span>
                          <span>{waiter.readyToBillOrders} por cobrar</span>
                          {waiter.delayedOrders > 0 && (
                            <span className="badge-danger-soft">
                              {waiter.delayedOrders} con demora
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="empty-dashboard-state">
                    Todavía no hay órdenes tomadas hoy.
                  </div>
                )}
              </section>
            </>
          )}
        </div>

        <aside className="dashboard-side-column">
          {canViewOperationalSummary ? (
            <section className="dashboard-card">
              <div className="dashboard-section-header">
                <div>
                  <h2>Atención rápida</h2>
                  <p>Revisa estos puntos primero.</p>
                </div>
              </div>

              {loadingDashboard ? (
                <div className="empty-dashboard-state">Cargando alertas...</div>
              ) : (
                <div className="alerts-list">
                  {alerts.map((alert) => (
                    <div
                      className={`dashboard-alert alert-${alert.level}`}
                      key={`${alert.title}-${alert.level}`}
                    >
                      <strong>{alert.title}</strong>
                      <p>{alert.message}</p>
                    </div>
                  ))}
                </div>
              )}
            </section>
          ) : (
            <section className="dashboard-card dashboard-access-summary">
              <h2>Acceso de tu cuenta</h2>
              <p>
                Tienes {availableModules.length} módulo(s) administrativo(s) habilitado(s).
              </p>
              <div className="dashboard-access-list">
                {availableModules.map((module) => (
                  <Link to={module.to} key={module.title}>
                    <span>{module.icon}</span>
                    <div>
                      <strong>{module.title}</strong>
                      <small>{module.description}</small>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}

          <section className="dashboard-card help-card">
            <h2>Guía rápida</h2>
            <div className="help-step">
              <span>1</span>
              <p>Abre “Menú” para ver todos tus módulos habilitados.</p>
            </div>
            <div className="help-step">
              <span>2</span>
              <p>Los accesos de MANAGER dependen de sus permisos individuales.</p>
            </div>
            <div className="help-step">
              <span>3</span>
              <p>Si falta un módulo, solicita al ADMIN que revise tu acceso.</p>
            </div>
          </section>
        </aside>
      </section>
    </main>
  )
}

function getWaiterName(order) {
  return (
    order.waiter?.fullName ||
    order.createdBy?.fullName ||
    order.waiter?.username ||
    order.createdBy?.username ||
    'Sin mesero'
  )
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

function formatTime(date) {
  return new Intl.DateTimeFormat('es-NI', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}
