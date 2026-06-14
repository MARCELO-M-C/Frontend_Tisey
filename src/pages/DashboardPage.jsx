import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { useAuth } from '../auth/AuthContext'
import { getAdminDashboardData, formatWaitingTime } from '../services/dashboardService'
import './DashboardPage.css'

const quickActions = [
  {
    title: 'Tomar orden',
    description: 'Crear una nueva orden para mesa o cliente.',
    to: '/orders',
    icon: '🍽️',
    variant: 'primary',
  },
  {
    title: 'Ver cocina',
    description: 'Revisar órdenes pendientes en KDS.',
    to: '/kitchen',
    icon: '👨‍🍳',
    variant: 'warning',
  },
  {
    title: 'Facturar',
    description: 'Cobrar órdenes listas o pendientes de pago.',
    to: '/billing',
    icon: '🧾',
    variant: 'success',
  },
  {
    title: 'Administrar',
    description: 'Productos, usuarios, órdenes y configuración.',
    to: '/admin',
    icon: '⚙️',
    variant: 'dark',
  },
]

export default function DashboardPage() {
  const { user, logout } = useAuth()

  const [dashboardData, setDashboardData] = useState(null)
  const [loadingDashboard, setLoadingDashboard] = useState(true)
  const [dashboardError, setDashboardError] = useState('')
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null)

  useEffect(() => {
    async function loadDashboard() {
      try {
        setDashboardError('')

        const data = await getAdminDashboardData()

        setDashboardData(data)
        setLastUpdatedAt(new Date())
      } catch {
        setDashboardError('No se pudo cargar el resumen del dashboard.')
      } finally {
        setLoadingDashboard(false)
      }
    }

    loadDashboard()

    const intervalId = window.setInterval(loadDashboard, 30000)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [])

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

  return (
    <main className="admin-dashboard">
      <section className="dashboard-hero">
        <div>
          <span className="dashboard-eyebrow">Panel principal</span>

          <h1>Hola, {user?.firstName || user?.username || 'Administrador'}</h1>

          <p>
            Este es el resumen del restaurante. Aquí puedes revisar órdenes,
            cocina, facturación y alertas importantes sin cambiar de pestaña.
          </p>

          {lastUpdatedAt && (
            <small className="dashboard-last-update">
              Última actualización: {formatTime(lastUpdatedAt)}
            </small>
          )}
        </div>

        <div className="dashboard-hero-actions">
          <Link to="/orders" className="btn dashboard-main-button">
            Nueva orden
          </Link>

          <button type="button" className="btn dashboard-logout" onClick={logout}>
            Cerrar sesión
          </button>
        </div>
      </section>

      {dashboardError && (
        <section className="dashboard-error">
          {dashboardError}
        </section>
      )}

      <section className="dashboard-stats-grid">
        {todayStats.map((stat) => (
          <article className={`dashboard-stat stat-${stat.status}`} key={stat.label}>
            <span>{stat.label}</span>
            <strong>{loadingDashboard ? '...' : stat.value}</strong>
            <small>{stat.helper}</small>
          </article>
        ))}
      </section>

      <section className="dashboard-grid">
        <div className="dashboard-main-column">
          <section className="dashboard-card">
            <div className="dashboard-section-header">
              <div>
                <h2>Accesos rápidos</h2>
                <p>Selecciona una acción para continuar.</p>
              </div>
            </div>

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
          </section>

          <section className="dashboard-card">
            <div className="dashboard-section-header">
              <div>
                <h2>Órdenes con demora</h2>
                <p>
                  Advertencia desde {dashboardData?.config.warningMinutes ?? 20} min.
                  Crítico desde {dashboardData?.config.criticalMinutes ?? 30} min.
                </p>
              </div>

              <Link to="/kitchen" className="dashboard-small-link">
                Ver cocina
              </Link>
            </div>

            {loadingDashboard ? (
              <div className="empty-dashboard-state">
                Cargando órdenes...
              </div>
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
                        {getWaiterName(order)}
                        {' · '}
                        {getOrderStatusLabel(order.status)}
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

              <Link to="/orders" className="dashboard-small-link">
                Ver órdenes
              </Link>
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
        </div>

        <aside className="dashboard-side-column">
          <section className="dashboard-card">
            <div className="dashboard-section-header">
              <div>
                <h2>Atención rápida</h2>
                <p>Revisa estos puntos primero.</p>
              </div>
            </div>

            {loadingDashboard ? (
              <div className="empty-dashboard-state">
                Cargando alertas...
              </div>
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

          <section className="dashboard-card help-card">
            <h2>Guía rápida</h2>

            <div className="help-step">
              <span>1</span>
              <p>Para una nueva venta, entra en “Tomar orden”.</p>
            </div>

            <div className="help-step">
              <span>2</span>
              <p>Cocina revisa y prepara las órdenes desde “Ver cocina”.</p>
            </div>

            <div className="help-step">
              <span>3</span>
              <p>Cuando la orden esté lista, entra en “Facturar”.</p>
            </div>

            <div className="help-step">
              <span>4</span>
              <p>Las órdenes demoradas aparecerán con alerta amarilla o roja.</p>
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