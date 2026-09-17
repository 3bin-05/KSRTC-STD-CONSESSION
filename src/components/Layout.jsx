import { Outlet, Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Bus, LogOut, Layers } from 'lucide-react'

export default function Layout() {
  const { currentUser, logout, switchRoleDemo } = useAuth()
  const navigate = useNavigate()

  const handleRoleChange = (role) => {
    switchRoleDemo(role)
    const targetMap = {
      student: '/student',
      institution: '/institution',
      conductor: '/conductor',
      admin: '/admin',
    }
    navigate(targetMap[role] || '/')
  }

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  // Active role badge color
  const getRoleBadge = (role) => {
    switch (role) {
      case 'student':
        return { label: 'Student Wallet', color: 'bg-[#EFF5ED] text-[#4F7942] border-[#4F7942]/20' }
      case 'institution':
        return { label: 'Institution Desk', color: 'bg-[#FEF7EB] text-[#C97D1A] border-[#C97D1A]/20' }
      case 'conductor':
        return { label: 'Conductor Verifier', color: 'bg-[#FAF0EC] text-[#D97757] border-[#D97757]/20' }
      case 'admin':
        return { label: 'State Admin', color: 'bg-[#FAF8F5] text-[#1F1E1D] border-[#1F1E1D]/20' }
      default:
        return { label: role, color: 'bg-white text-[#6B6862] border-[#E8E4DC]' }
    }
  }

  const roleInfo = getRoleBadge(currentUser?.role)

  return (
    <div className="min-h-screen flex flex-col bg-[#FAF8F5] text-[#1F1E1D]">
      {/* Top Demo Role Switcher Bar */}
      <div className="bg-[#1F1E1D] text-[#FAF8F5] text-xs py-1.5 px-4">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Layers className="w-3.5 h-3.5 text-[#D97757]" />
            <span className="font-medium text-[#FAF8F5]/80">Demo Role Switcher:</span>
          </div>
          <div className="flex items-center gap-1.5 overflow-x-auto py-0.5">
            {['student', 'institution', 'conductor', 'admin'].map((roleKey) => {
              const isActive = currentUser?.role === roleKey
              return (
                <button
                  key={roleKey}
                  onClick={() => handleRoleChange(roleKey)}
                  className={`px-2.5 py-0.5 rounded text-xs font-medium transition-colors capitalize ${
                    isActive
                      ? 'bg-[#D97757] text-white shadow-sm'
                      : 'bg-white/10 hover:bg-white/20 text-[#FAF8F5]/80'
                  }`}
                >
                  {roleKey}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Main Header */}
      <header className="bg-white border-b border-[#E8E4DC] sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/" className="flex items-center gap-2.5 group">
              <div className="w-9 h-9 rounded-xl bg-[#D97757] text-white flex items-center justify-center shadow-xs">
                <Bus className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-base tracking-tight text-[#1F1E1D] group-hover:text-[#D97757] transition-colors">
                    ANAVANDI
                  </span>
                  <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 bg-[#FAF8F5] border border-[#E8E4DC] text-[#6B6862] rounded">
                    KSRTC
                  </span>
                </div>
                <p className="text-[11px] text-[#6B6862] -mt-0.5 font-normal">
                  Digital Student Concession
                </p>
              </div>
            </Link>
          </div>

          {currentUser ? (
            <div className="flex items-center gap-3">
              <div className="hidden sm:flex flex-col text-right">
                <span className="text-xs font-medium text-[#1F1E1D] truncate max-w-[180px]">
                  {currentUser.displayName || currentUser.email}
                </span>
                <span className="text-[11px] text-[#6B6862]">
                  {currentUser.institutionName || currentUser.email}
                </span>
              </div>

              <div className={`text-xs px-2.5 py-1 rounded-full border font-medium ${roleInfo.color}`}>
                {roleInfo.label}
              </div>

              <button
                onClick={handleLogout}
                className="p-2 rounded-lg text-[#6B6862] hover:text-[#B3492F] hover:bg-[#FAECE8] transition-colors"
                title="Sign out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <Link
              to="/login"
              className="anavandi-btn-primary text-xs py-1.5 px-3.5"
            >
              Sign In
            </Link>
          )}
        </div>
      </header>

      {/* Main Page Body */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-6">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-[#E8E4DC] py-4 text-xs text-[#6B6862]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-center sm:text-left">
          <p>
            Kerala State Road Transport Corporation (KSRTC) • Student Concession Portal
          </p>
          <p className="text-[11px] text-[#99958D]">
            Ed25519 Cryptographic Verification & Rotating Dynamic Pass
          </p>
        </div>
      </footer>
    </div>
  )
}
