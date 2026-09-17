import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { DataProvider } from './context/DataContext'
import Layout from './components/Layout'
import AuthGuard from './components/AuthGuard'

// Pages
import Login from './pages/Login'
import HomeRedirect from './pages/HomeRedirect'
import StudentPortal from './pages/student/StudentPortal'
import InstitutionDashboard from './pages/institution/InstitutionDashboard'
import AdminDashboard from './pages/admin/AdminDashboard'
import ConductorApp from './pages/conductor/ConductorApp'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <DataProvider>
          <Routes>
            {/* Public Auth Route */}
            <Route path="/login" element={<Login />} />

            {/* Main Application with Shared Header & Demo Switcher */}
            <Route element={<Layout />}>
              <Route path="/" element={<HomeRedirect />} />

              {/* Student Portal */}
              <Route
                path="/student/*"
                element={
                  <AuthGuard allowedRoles={['student']}>
                    <StudentPortal />
                  </AuthGuard>
                }
              />

              {/* Institution Portal */}
              <Route
                path="/institution/*"
                element={
                  <AuthGuard allowedRoles={['institution']}>
                    <InstitutionDashboard />
                  </AuthGuard>
                }
              />

              {/* Admin Portal */}
              <Route
                path="/admin/*"
                element={
                  <AuthGuard allowedRoles={['admin']}>
                    <AdminDashboard />
                  </AuthGuard>
                }
              />

              {/* Conductor Verifier PWA */}
              <Route
                path="/conductor/*"
                element={
                  <AuthGuard allowedRoles={['conductor']}>
                    <ConductorApp />
                  </AuthGuard>
                }
              />
            </Route>

            {/* Catch-all fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </DataProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
