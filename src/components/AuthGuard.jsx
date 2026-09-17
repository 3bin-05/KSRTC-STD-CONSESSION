import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function AuthGuard({ allowedRoles, children }) {
  const { currentUser, loading } = useAuth()
  const location = useLocation()

  // Show a spinner while Firebase is resolving the auth session.
  // This prevents a flash redirect to /login on page refresh when the user IS logged in.
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAF8F5]">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-2 border-[#D97757] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-[#6B6862]">Loading ANAVANDI...</p>
        </div>
      </div>
    )
  }

  // Not authenticated — redirect to login, remembering where they came from
  if (!currentUser) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  // Authenticated but wrong role — redirect to their correct portal
  if (allowedRoles && !allowedRoles.includes(currentUser.role)) {
    const roleRoutes = {
      student: '/student',
      institution: '/institution',
      conductor: '/conductor',
      admin: '/admin',
    }
    const targetRoute = roleRoutes[currentUser.role] || '/login'
    return <Navigate to={targetRoute} replace />
  }

  return children
}
