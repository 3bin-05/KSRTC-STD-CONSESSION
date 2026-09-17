import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function HomeRedirect() {
  const { currentUser, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAF8F5]">
        <div className="w-8 h-8 border-2 border-[#D97757] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!currentUser) {
    return <Navigate to="/login" replace />
  }

  const roleMap = {
    student: '/student',
    institution: '/institution',
    conductor: '/conductor',
    admin: '/admin',
  }

  return <Navigate to={roleMap[currentUser.role] || '/login'} replace />
}
