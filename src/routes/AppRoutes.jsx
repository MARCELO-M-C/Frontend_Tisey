import { BrowserRouter, Navigate, Route, Routes } from 'react-router'

import LoginPage from '../pages/LoginPage'
import DashboardPage from '../pages/DashboardPage'
import AdminAccessPage from '../pages/AdminAccessPage'
import UnauthorizedPage from '../pages/UnauthorizedPage'
import AdminRestaurantTablesPage from '../pages/AdminRestaurantTablesPage'
import AdminOperationsPage from '../pages/AdminOperationsPage'
import AdminMenuPage from '../pages/AdminMenuPage'
import ProtectedRoute from '../auth/ProtectedRoute'

export default function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          }
        />

        <Route path="/admin" element={<Navigate to="/admin/access" replace />} />

        <Route
          path="/admin/access"
          element={
            <ProtectedRoute>
              <AdminAccessPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/restaurant-tables"
          element={
            <ProtectedRoute>
              <AdminRestaurantTablesPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/menu"
          element={
            <ProtectedRoute>
              <AdminMenuPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/operations"
          element={
            <ProtectedRoute>
              <AdminOperationsPage />
            </ProtectedRoute>
          }
        />

        <Route path="/unauthorized" element={<UnauthorizedPage />} />

        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
