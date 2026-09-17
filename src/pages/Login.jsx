import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useData } from '../context/DataContext'
import { Bus, Mail, Lock, User, GraduationCap, ArrowRight, AlertCircle } from 'lucide-react'

export default function Login() {
  const [isRegistering, setIsRegistering] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [rollNo, setRollNo] = useState('')
  const [selectedInstitutionId, setSelectedInstitutionId] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const { login, registerStudent, loginWithGoogle, currentUser, DEMO_ACCOUNTS, isConfigured } = useAuth()
  const { institutions } = useData()
  const navigate = useNavigate()
  const location = useLocation()

  const activeInstitutions = institutions.filter(i => i.active)

  const roleRedirect = (role) => {
    const map = { student: '/student', institution: '/institution', conductor: '/conductor', admin: '/admin' }
    return map[role] || '/student'
  }

  // When currentUser is set (by Firebase listener or demo login), navigate to the correct portal
  useEffect(() => {
    if (currentUser) {
      const from = location.state?.from?.pathname
      navigate(from || roleRedirect(currentUser.role), { replace: true })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      if (isRegistering) {
        if (!displayName || !rollNo || !selectedInstitutionId) {
          throw new Error('Please fill in all registration fields.')
        }

        const chosenInst = institutions.find(i => i.id === selectedInstitutionId)

        // Domain validation check if institution domain is defined
        if (chosenInst && chosenInst.domain) {
          const userDomain = email.split('@')[1] || ''
          if (!userDomain.toLowerCase().endsWith(chosenInst.domain.toLowerCase())) {
            throw new Error(`Your email domain (@${userDomain}) does not match ${chosenInst.name}'s official domain (@${chosenInst.domain}).`)
          }
        }

        await registerStudent({
          email,
          password,
          displayName,
          rollNo,
          institutionId: chosenInst?.id,
          institutionName: chosenInst?.name,
        })
        // Navigation handled by the useEffect above when currentUser updates
      } else {
        await login(email, password)
        // Navigation handled by the useEffect above when currentUser updates
      }
    } catch (err) {
      setError(err.message || 'Authentication failed. Please check your credentials.')
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleSignIn = async () => {
    setError('')
    setLoading(true)
    try {
      await loginWithGoogle()
      // Navigation handled by the useEffect above when currentUser updates
    } catch (err) {
      setError(err.message || 'Google sign-in failed.')
    } finally {
      setLoading(false)
    }
  }

  // Quick demo login — only shown when Firebase is not configured
  const handleDemoLogin = async (demoAccount) => {
    setError('')
    setLoading(true)
    try {
      await login(demoAccount.email, 'demo')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-[80vh] flex flex-col justify-center items-center py-6">
      <div className="w-full max-w-md">
        {/* Header Branding */}
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-2xl bg-[#D97757] text-white flex items-center justify-center mx-auto mb-3 shadow-xs">
            <Bus className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-[#1F1E1D]">
            {isRegistering ? 'Student Registration' : 'Sign In to ANAVANDI'}
          </h1>
          <p className="text-sm text-[#6B6862] mt-1">
            {isRegistering
              ? 'Apply for and manage your subsidized KSRTC digital bus pass'
              : 'Kerala State Road Transport Corporation Student Concession'}
          </p>
        </div>

        {/* Card */}
        <div className="anavandi-card p-6 sm:p-8 bg-white shadow-xs">
          {error && (
            <div className="mb-5 p-3 rounded-lg bg-[#FAECE8] border border-[#B3492F]/20 text-[#B3492F] text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {isRegistering && (
              <>
                <div>
                  <label className="block text-xs font-medium text-[#1F1E1D] mb-1">
                    Full Student Name
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-[#6B6862] absolute left-3 top-3" />
                    <input
                      type="text"
                      required
                      placeholder="e.g. Arun Kumar"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      className="anavandi-input w-full pl-9 text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#1F1E1D] mb-1">
                    College / School Roll Number
                  </label>
                  <div className="relative">
                    <GraduationCap className="w-4 h-4 text-[#6B6862] absolute left-3 top-3" />
                    <input
                      type="text"
                      required
                      placeholder="e.g. B21CS104"
                      value={rollNo}
                      onChange={(e) => setRollNo(e.target.value)}
                      className="anavandi-input w-full pl-9 text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#1F1E1D] mb-1">
                    Educational Institution
                  </label>
                  <select
                    required
                    value={selectedInstitutionId}
                    onChange={(e) => setSelectedInstitutionId(e.target.value)}
                    className="anavandi-input w-full text-sm"
                  >
                    <option value="">Select your approved institution...</option>
                    {activeInstitutions.map((inst) => (
                      <option key={inst.id} value={inst.id}>
                        {inst.name} ({inst.domain ? `@${inst.domain}` : inst.district})
                      </option>
                    ))}
                  </select>
                </div>
              </>
            )}

            <div>
              <label className="block text-xs font-medium text-[#1F1E1D] mb-1">
                {isRegistering ? 'Institutional Email Address' : 'Email Address'}
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-[#6B6862] absolute left-3 top-3" />
                <input
                  type="email"
                  required
                  placeholder={isRegistering ? 'arun@gecbh.ac.in' : 'name@example.com'}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="anavandi-input w-full pl-9 text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#1F1E1D] mb-1">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-[#6B6862] absolute left-3 top-3" />
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="anavandi-input w-full pl-9 text-sm"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="anavandi-btn-primary w-full flex items-center justify-center gap-2 mt-2"
            >
              <span>{isRegistering ? 'Create Student Account' : 'Sign In'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Social / Google Sign-in (for Students) */}
          <div className="mt-6 pt-6 border-t border-[#E8E4DC]">
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="anavandi-btn-secondary w-full flex items-center justify-center gap-2 text-xs"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>Continue with Google</span>
            </button>
          </div>

          {/* Toggle between Login and Student Register */}
          <div className="mt-6 text-center text-xs text-[#6B6862]">
            {isRegistering ? (
              <p>
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => { setIsRegistering(false); setError(''); }}
                  className="text-[#D97757] font-semibold hover:underline"
                >
                  Sign in
                </button>
              </p>
            ) : (
              <p>
                New student?{' '}
                <button
                  type="button"
                  onClick={() => { setIsRegistering(true); setError(''); }}
                  className="text-[#D97757] font-semibold hover:underline"
                >
                  Register here
                </button>
              </p>
            )}
          </div>
        </div>

        {/* Demo Quick-Login — shown only when Firebase is not configured */}
        {!isConfigured && (
          <div className="mt-5 p-4 rounded-xl bg-[#FAF8F5] border border-[#E8E4DC]">
            <p className="text-xs font-semibold text-[#6B6862] mb-2.5 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#D97757] inline-block" />
              Demo Mode — Quick Login
            </p>
            <div className="grid grid-cols-2 gap-2">
              {DEMO_ACCOUNTS.map((account) => {
                const roleLabels = {
                  student: '🎓 Student',
                  institution: '🏫 Institution',
                  conductor: '🚍 Conductor',
                  admin: '🛡️ Admin',
                }
                return (
                  <button
                    key={account.uid}
                    type="button"
                    onClick={() => handleDemoLogin(account)}
                    disabled={loading}
                    className="text-left p-2.5 rounded-lg border border-[#E8E4DC] bg-white hover:border-[#D97757]/40 hover:bg-[#FAF8F5] transition-colors disabled:opacity-50"
                  >
                    <p className="text-xs font-semibold text-[#1F1E1D]">{roleLabels[account.role]}</p>
                    <p className="text-[10px] text-[#6B6862] truncate mt-0.5">{account.displayName}</p>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        <div className="mt-4 text-center text-xs text-[#6B6862]">
          <p>Institution, Conductor & Admin staff are provisioned by Department Admins.</p>
        </div>
      </div>
    </div>
  )
}
