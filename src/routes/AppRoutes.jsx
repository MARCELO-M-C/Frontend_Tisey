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
import RoleHomeRedirect from '../auth/RoleHomeRedirect'
import ProtectedRoute from '../auth/ProtectedRoute'

const ADMIN_ROLES = ['ADMIN', 'ADMINISTRADOR']

const BILLING_ROLES = [
  'ADMIN',
  'ADMINISTRADOR',
  'CAJA',
  'CASHIER',
]

export default function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        <Route
          path="/dashboard"
          element={
            <ProtectedRoute allowedRoles={ADMIN_ROLES}>
              <DashboardPage />
            </ProtectedRoute>
          }
        />

        <Route path="/admin" element={<Navigate to="/admin/access" replace />} />

        <Route
          path="/admin/access"
          element={
            <ProtectedRoute allowedRoles={BILLING_ROLES}>
              <AdminAccessPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/restaurant-tables"
          element={
            <ProtectedRoute allowedRoles={BILLING_ROLES}>
              <AdminRestaurantTablesPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/menu"
          element={
            <ProtectedRoute allowedRoles={BILLING_ROLES}>
              <AdminMenuPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/operations"
          element={
            <ProtectedRoute allowedRoles={BILLING_ROLES}>
              <AdminOperationsPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/lodging"
          element={
            <ProtectedRoute allowedRoles={BILLING_ROLES}>
              <AdminLodgingPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/orders"
          element={
            <ProtectedRoute allowedRoles={BILLING_ROLES}>
              <AdminOrdersPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/billing"
          element={
            <ProtectedRoute allowedRoles={BILLING_ROLES}>
              <BillingPage />
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
