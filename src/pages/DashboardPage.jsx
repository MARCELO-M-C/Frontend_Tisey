import { Link } from 'react-router'
import { useAuth } from '../auth/AuthContext'
import './DashboardPage.css'

const todayStats = [
  {
    label: 'Órdenes activas',
    value: '8',
    helper: 'En proceso ahora',
    status: 'normal',
  },
  {
    label: 'En cocina',
    value: '5',
    helper: 'Pendientes de preparar',
    status: 'warning',
  },
  {
    label: 'Listas para cobrar',
    value: '3',
    helper: 'Esperando facturación',
    status: 'success',
  },
  {
    label: 'Ventas de hoy',
    value: 'C$ 4,850',
    helper: 'Total acumulado',
    status: 'normal',
  },
]

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
    description: 'Productos, usuarios, mesas y configuración.',
    to: '/admin',
    icon: '⚙️',
    variant: 'dark',
  },
]

const alerts = [
  {
    title: 'Mesa 4',
    message: 'Tiene una orden en cocina desde hace 18 minutos.',
    level: 'warning',
  },
  {
    title: 'Caja',
    message: 'Hay 3 órdenes listas para cobrar.',
    level: 'success',
  },
  {
    title: 'Inventario',
    message: 'Revisar productos con baja disponibilidad.',
    level: 'info',
  },
]

const tableStatus = [
  { name: 'Mesa 1', status: 'Libre' },
  { name: 'Mesa 2', status: 'Ocupada' },
  { name: 'Mesa 3', status: 'Libre' },
  { name: 'Mesa 4', status: 'En cocina' },
  { name: 'Mesa 5', status: 'Por cobrar' },
  { name: 'Mesa 6', status: 'Ocupada' },
]

export default function DashboardPage() {
  const { user, logout } = useAuth()

  return (
    <main className="admin-dashboard">
      <section className="dashboard-hero">
        <div>
          <span className="dashboard-eyebrow">Panel principal</span>
          <h1>Hola, {user?.firstName || user?.username || 'Administrador'}</h1>
          <p>
            Este es el resumen general del restaurante. Desde aquí puedes entrar
            rápido a órdenes, cocina, facturación y administración.
          </p>
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

      <section className="dashboard-stats-grid">
        {todayStats.map((stat) => (
          <article className={`dashboard-stat stat-${stat.status}`} key={stat.label}>
            <span>{stat.label}</span>
            <strong>{stat.value}</strong>
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
                <h2>Estado de mesas</h2>
                <p>Vista rápida para saber qué necesita atención.</p>
              </div>

              <Link to="/orders" className="dashboard-small-link">
                Ver órdenes
              </Link>
            </div>

            <div className="table-status-grid">
              {tableStatus.map((table) => (
                <div className="table-status-item" key={table.name}>
                  <strong>{table.name}</strong>
                  <span className={getTableStatusClass(table.status)}>
                    {table.status}
                  </span>
                </div>
              ))}
            </div>
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

            <div className="alerts-list">
              {alerts.map((alert) => (
                <div className={`dashboard-alert alert-${alert.level}`} key={alert.title}>
                  <strong>{alert.title}</strong>
                  <p>{alert.message}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="dashboard-card help-card">
            <h2>Guía rápida</h2>

            <div className="help-step">
              <span>1</span>
              <p>Para una nueva venta, entra en “Tomar orden”.</p>
            </div>

            <div className="help-step">
              <span>2</span>
              <p>Cocina revisa las órdenes desde “Ver cocina”.</p>
            </div>

            <div className="help-step">
              <span>3</span>
              <p>Cuando la orden esté lista, entra en “Facturar”.</p>
            </div>
          </section>
        </aside>
      </section>
    </main>
  )
}

function getTableStatusClass(status) {
  if (status === 'Libre') return 'table-badge table-free'
  if (status === 'Ocupada') return 'table-badge table-busy'
  if (status === 'En cocina') return 'table-badge table-kitchen'
  if (status === 'Por cobrar') return 'table-badge table-billing'

  return 'table-badge'
}