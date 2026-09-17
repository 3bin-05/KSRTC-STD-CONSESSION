import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function AuthGuard({ allowedRoles, children }) {
  const { currentUser, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAF8F5]">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-2 border-[#D97757] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-[#6B6862]">Verifying credentials...</p>
        </div>
      </div>
    )
  }

  if (!currentUser) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  if (allowedRoles && !allowedRoles.includes(currentUser.role)) {
    // Role redirect map
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
