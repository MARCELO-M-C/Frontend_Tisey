import { BrowserRouter, Navigate, Route, Routes } from 'react-router'
import LoginPage from '../pages/LoginPage'
import DashboardPage from '../pages/DashboardPage'
import AdminAccessPage from '../pages/AdminAccessPage'
import UnauthorizedPage from '../pages/UnauthorizedPage'
import AdminRestaurantTablesPage from '../pages/AdminRestaurantTablesPage'
import AdminOperationsPage from '../pages/AdminOperationsPage'
import AdminLodgingPage from '../pages/AdminLodgingPage'
import AdminMenuPage from '../pages/AdminMenuPage'
import AdminOrdersPage from '../pages/AdminOrdersPage'
import BillingPage from '../pages/BillingPage'
import KitchenPage from '../pages/KitchenPage'
import WaiterOrdersPage from '../pages/WaiterOrdersPage'
import RoleHomeRedirect from '../auth/RoleHomeRedirect'
import ProtectedRoute from '../auth/ProtectedRoute'

const ADMIN_ROLES = ['ADMIN', 'ADMINISTRADOR', 'ADMINISTRATOR']
const MANAGER_ROLES = ['MANAGER', 'GERENTE', 'ENCARGADO']

const DASHBOARD_ROLES = [...ADMIN_ROLES, ...MANAGER_ROLES]

const BILLING_ROLES = [
  ...ADMIN_ROLES,
  'CAJA',
  'CAJERO',
  'CAJERA',
  'CASHIER',
]

const KITCHEN_ROLES = [
  ...ADMIN_ROLES,
  'COCINA',
  'COCINERO',
  'COCINERA',
  'KITCHEN',
]

const WAITER_ROLES = [
  ...ADMIN_ROLES,
  'MESERO',
  'MESERA',
  'WAITER',
  'SERVER',
]

export default function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        <Route
          path="/dashboard"
          element={
            <ProtectedRoute allowedRoles={DASHBOARD_ROLES}>
              <DashboardPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin"
          element={
            <ProtectedRoute requiredPermissions={['ADMIN_USERS_MANAGE']}>
              <Navigate to="/admin/access" replace />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/access"
          element={
            <ProtectedRoute requiredPermissions={['ADMIN_USERS_MANAGE']}>
              <AdminAccessPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/restaurant-tables"
          element={
            <ProtectedRoute requiredPermissions={['ADMIN_TABLES_MANAGE']}>
              <AdminRestaurantTablesPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/menu"
          element={
            <ProtectedRoute requiredPermissions={['ADMIN_MENU_MANAGE']}>
              <AdminMenuPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/operations"
          element={
            <ProtectedRoute
              requiredPermissions={['ADMIN_SHIFTS_&_STATIONS_MANAGE']}
            >
              <AdminOperationsPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/lodging"
          element={
            <ProtectedRoute requiredPermissions={['ADMIN_LODGING_MANAGE']}>
              <AdminLodgingPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/orders"
          element={
            <ProtectedRoute requiredPermissions={['ADMIN_ORDERS_MANAGE']}>
              <AdminOrdersPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/orders"
          element={
            <ProtectedRoute
              allowedRoles={WAITER_ROLES}
              requiredPermissions={['ADMIN_ORDERS_MANAGE']}
              accessMode="any"
            >
              <WaiterOrdersPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/billing"
          element={
            <ProtectedRoute
              allowedRoles={BILLING_ROLES}
              requiredPermissions={['ADMIN_BILLING_MANAGE']}
              accessMode="any"
            >
              <BillingPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/kitchen"
          element={
            <ProtectedRoute
              allowedRoles={KITCHEN_ROLES}
              requiredPermissions={['ADMIN_KITCHEN_MANAGE']}
              accessMode="any"
            >
              <KitchenPage />
            </ProtectedRoute>
          }
        />

        <Route path="/unauthorized" element={<UnauthorizedPage />} />
        <Route path="/" element={<RoleHomeRedirect />} />
        <Route path="*" element={<RoleHomeRedirect />} />
      </Routes>
    </BrowserRouter>
  )
}
