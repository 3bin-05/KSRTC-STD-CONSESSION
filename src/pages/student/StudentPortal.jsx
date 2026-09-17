import { useState, useMemo } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useData } from '../../context/DataContext'
import FileUpload from '../../components/FileUpload'
import { computeDailyCode, generateStudentQRData } from '../../lib/crypto'
import { QRCodeSVG } from 'qrcode.react'
import { 
  CreditCard, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  MapPin, 
  Calendar, 
  RotateCw, 
  History, 
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  Bus,
} from 'lucide-react'

export default function StudentPortal() {
  const { currentUser } = useAuth()
  const { institutions, applications, passes, trips, submitApplication, resubmitApplication } = useData()

  // Find active pass for current student
  const activePass = useMemo(() => {
    return passes.find(p => p.studentId === currentUser?.uid)
  }, [passes, currentUser])

  // Find latest application for current student (most recently submitted)
  const currentApp = useMemo(() => {
    const studentApps = applications.filter(a => a.studentId === currentUser?.uid)
    if (studentApps.length === 0) return null
    return studentApps.sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt))[0]
  }, [applications, currentUser])

  // Form states
  const [isApplying, setIsApplying] = useState(false)
  const [activeTab, setActiveTab] = useState('pass') // 'pass' | 'history'

  const [formData, setFormData] = useState({
    studentName: currentUser?.displayName || '',
    studentEmail: currentUser?.email || '',
    rollNo: currentUser?.rollNo || '',
    institutionId: currentUser?.institutionId || institutions[0]?.id || '',
    routeFrom: 'Neyyattinkara',
    routeTo: 'Kunnukuzhy (Barton Hill)',
    distanceKm: 28,
    proofUrl: '',
    photoUrl: currentUser?.photoUrl || 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=400&auto=format&fit=crop&q=80',
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [resubmittingFrom, setResubmittingFrom] = useState(null)

  // Calculate renewal window: if validity expires in <= 14 days
  const isRenewalDue = useMemo(() => {
    if (!activePass?.payload?.validUntil) return false
    const nowTime = new Date().getTime()
    const diffDays = (new Date(activePass.payload.validUntil).getTime() - nowTime) / (1000 * 60 * 60 * 24)
    return diffDays <= 14
  }, [activePass])

  // Calculate student trips and distance used today
  const studentTrips = useMemo(() => {
    return trips.filter(t => t.studentId === currentUser?.uid || (activePass && t.passId === activePass.id))
  }, [trips, currentUser, activePass])

  const todayStr = new Date().toISOString().split('T')[0]
  const todayTrips = useMemo(() => {
    return studentTrips.filter(t => t.timestamp && t.timestamp.startsWith(todayStr))
  }, [studentTrips, todayStr])

  const distanceUsedToday = todayTrips.reduce((sum, t) => sum + (Number(t.distanceKm) || 0), 0)
  const dailyDistanceLimit = activePass?.payload?.distanceLimitKm || 30
  const isApproachingLimit = distanceUsedToday >= (dailyDistanceLimit * 0.8)
  const isLimitExceeded = distanceUsedToday >= dailyDistanceLimit

  const handleApplySubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (!formData.proofUrl) {
      setError('Please upload your institutional enrolment / fee receipt proof.')
      return
    }

    setSubmitting(true)
    try {
      const chosenInst = institutions.find(i => i.id === formData.institutionId)
      const appPayload = {
        studentId: currentUser.uid,
        studentName: formData.studentName,
        studentEmail: currentUser.email,
        rollNo: formData.rollNo,
        institutionId: formData.institutionId,
        institutionName: chosenInst?.name || 'Approved Institution',
        routeFrom: formData.routeFrom,
        routeTo: formData.routeTo,
        distanceKm: Number(formData.distanceKm) || 25,
        proofUrl: formData.proofUrl,
        photoUrl: formData.photoUrl,
      }

      if (resubmittingFrom) {
        await resubmitApplication(resubmittingFrom, appPayload)
        setResubmittingFrom(null)
      } else {
        await submitApplication(appPayload)
      }
      setIsApplying(false)
    } catch (err) {
      setError(err.message || 'Failed to submit application')
    } finally {
      setSubmitting(false)
    }
  }

  const handleStartRenewal = () => {
    if (activePass) {
      setFormData({
        studentName: activePass.payload.name,
        studentEmail: currentUser.email,
        rollNo: activePass.payload.rollNo || '',
        institutionId: currentUser.institutionId || institutions[0]?.id || '',
        routeFrom: activePass.payload.routeFrom || 'Neyyattinkara',
        routeTo: activePass.payload.routeTo || 'Kunnukuzhy',
        distanceKm: activePass.payload.distanceLimitKm || 28,
        proofUrl: '',
        photoUrl: activePass.payload.photoUrl,
      })
    }
    setIsApplying(true)
  }

  const handleResubmit = (app) => {
    setResubmittingFrom(app.id)
    setFormData({
      studentName: app.studentName || '',
      studentEmail: app.studentEmail || currentUser?.email || '',
      rollNo: app.rollNo || '',
      institutionId: app.institutionId || institutions[0]?.id || '',
      routeFrom: app.routeFrom || 'Neyyattinkara',
      routeTo: app.routeTo || 'Kunnukuzhy',
      distanceKm: app.distanceKm || 28,
      proofUrl: app.proofUrl || '',
      photoUrl: app.photoUrl || currentUser?.photoUrl || 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=400&auto=format&fit=crop&q=80',
    })
    setIsApplying(true)
  }

  // Application Stage Progress component
  const renderProgressIndicator = (status) => {
    const stages = [
      { key: 'pending_institution', label: '1. Institution Verification' },
      { key: 'pending_admin', label: '2. KSRTC Admin Approval' },
      { key: 'approved', label: '3. Digital Pass Issued' },
    ]

    let activeIdx = 0
    if (status === 'pending_admin') activeIdx = 1
    if (status === 'approved') activeIdx = 2
    const isRejected = status === 'rejected_by_institution' || status === 'rejected_by_admin' || status === 'rejected'

    const rejectedByLabel = status === 'rejected_by_institution' || status === 'rejected' ? 'Institution' : 'KSRTC Admin'

    return (
      <div className="anavandi-card p-6 bg-white mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-[#1F1E1D] flex items-center gap-2">
            <Clock className="w-4 h-4 text-[#D97757]" />
            Application Progress Tracker
          </h2>
          <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${
            status === 'approved'
              ? 'bg-[#EFF5ED] text-[#4F7942]'
              : isRejected
              ? 'bg-[#FAECE8] text-[#B3492F]'
              : 'bg-[#FEF7EB] text-[#C97D1A]'
          }`}>
            {status === 'approved' ? 'Approved & Issued' : isRejected ? `Rejected by ${rejectedByLabel}` : 'Under Review'}
          </span>
        </div>

        {isRejected ? (
          <div className="p-4 rounded-xl bg-[#FAECE8] border border-[#B3492F]/20 text-[#B3492F] space-y-1">
            <p className="font-semibold text-xs flex items-center gap-1.5">
              <XCircle className="w-4 h-4" /> Application Rejected by {rejectedByLabel}
            </p>
            <p className="text-xs text-[#1F1E1D]">
              Reason: {currentApp?.rejectionReason || 'Application did not meet the criteria. Please resubmit with updated details.'}
            </p>
            <button
              onClick={() => handleResubmit(currentApp)}
              className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-[#B3492F] hover:underline"
            >
              Resubmit Application →
            </button>
          </div>
        ) : (
          <div className="relative mt-4">
            {/* Connecting Bar */}
            <div className="absolute top-4 left-4 right-4 h-0.5 bg-[#E8E4DC] -z-0" />
            <div
              className="absolute top-4 left-4 h-0.5 bg-[#4F7942] transition-all duration-300 -z-0"
              style={{ width: `${activeIdx === 2 ? 100 : activeIdx === 1 ? 50 : 0}%` }}
            />

            <div className="grid grid-cols-3 relative z-10 text-center">
              {stages.map((stg, idx) => {
                const isCompleted = idx <= activeIdx
                const isCurrent = idx === activeIdx
                return (
                  <div key={stg.key} className="flex flex-col items-center">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold border-2 transition-all ${
                      isCompleted 
                        ? 'bg-[#4F7942] border-[#4F7942] text-white' 
                        : isCurrent 
                        ? 'bg-white border-[#D97757] text-[#D97757]' 
                        : 'bg-white border-[#E8E4DC] text-[#6B6862]'
                    }`}>
                      {isCompleted ? <CheckCircle2 className="w-4 h-4" /> : idx + 1}
                    </div>
                    <span className={`text-xs mt-2 max-w-[120px] font-medium leading-tight ${
                      isCurrent ? 'text-[#1F1E1D] font-bold' : isCompleted ? 'text-[#4F7942]' : 'text-[#6B6862]'
                    }`}>
                      {stg.label}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    )
  }

  // --- No Application State / Application Form ---
  if (!currentApp && !activePass && !isApplying) {
    return (
      <div className="max-w-2xl mx-auto py-8">
        <div className="anavandi-card p-8 text-center bg-white">
          <div className="w-14 h-14 rounded-2xl bg-[#FAF0EC] text-[#D97757] flex items-center justify-center mx-auto mb-4">
            <Bus className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-bold text-[#1F1E1D] tracking-tight">
            Apply for KSRTC Student Concession
          </h2>
          <p className="text-sm text-[#6B6862] max-w-md mx-auto mt-2 leading-relaxed">
            Get your government-subsidized digital bus concession pass with instantaneous rotating QR verification across all KSRTC fast-passenger & ordinary buses.
          </p>

          <button
            onClick={() => setIsApplying(true)}
            className="anavandi-btn-primary mt-6 inline-flex items-center gap-2 text-sm"
          >
            <span>Start New Application</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    )
  }

  // --- Application Form View ---
  if (isApplying) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-[#1F1E1D]">
              {isRenewalDue ? 'Renew Student Concession Pass' : 'Concession Application Form'}
            </h1>
            <p className="text-xs text-[#6B6862]">
              All details are certified by your college authority and KSRTC zonal office
            </p>
          </div>
          {currentApp && (
            <button
              onClick={() => { setIsApplying(false); setResubmittingFrom(null) }}
              className="text-xs text-[#6B6862] hover:text-[#1F1E1D]"
            >
              Cancel
            </button>
          )}
        </div>

        <div className="anavandi-card p-6 sm:p-8 bg-white">
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-[#FAECE8] text-[#B3492F] text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleApplySubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-[#1F1E1D] mb-1">
                  Full Student Name
                </label>
                <input
                  type="text"
                  required
                  value={formData.studentName}
                  onChange={(e) => setFormData({ ...formData, studentName: e.target.value })}
                  className="anavandi-input w-full text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#1F1E1D] mb-1">
                  Institution Roll / Reg No.
                </label>
                <input
                  type="text"
                  required
                  value={formData.rollNo}
                  onChange={(e) => setFormData({ ...formData, rollNo: e.target.value })}
                  className="anavandi-input w-full text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#1F1E1D] mb-1">
                Approved Educational Institution
              </label>
              <select
                required
                value={formData.institutionId}
                onChange={(e) => setFormData({ ...formData, institutionId: e.target.value })}
                className="anavandi-input w-full text-sm"
              >
                {institutions.filter(i => i.active).map(inst => (
                  <option key={inst.id} value={inst.id}>
                    {inst.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-[#1F1E1D] mb-1">
                  Travel Route: From (Boarding Stop)
                </label>
                <div className="relative">
                  <MapPin className="w-4 h-4 text-[#D97757] absolute left-3 top-3" />
                  <input
                    type="text"
                    required
                    placeholder="e.g. Neyyattinkara"
                    value={formData.routeFrom}
                    onChange={(e) => setFormData({ ...formData, routeFrom: e.target.value })}
                    className="anavandi-input w-full pl-9 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#1F1E1D] mb-1">
                  Travel Route: To (Destination Stop)
                </label>
                <div className="relative">
                  <MapPin className="w-4 h-4 text-[#4F7942] absolute left-3 top-3" />
                  <input
                    type="text"
                    required
                    placeholder="e.g. Kunnukuzhy / PMG"
                    value={formData.routeTo}
                    onChange={(e) => setFormData({ ...formData, routeTo: e.target.value })}
                    className="anavandi-input w-full pl-9 text-sm"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#1F1E1D] mb-1">
                Estimated One-Way Route Distance (km)
              </label>
              <input
                type="number"
                min="1"
                max="100"
                required
                value={formData.distanceKm}
                onChange={(e) => setFormData({ ...formData, distanceKm: e.target.value })}
                className="anavandi-input w-full text-sm"
              />
            </div>

            {/* Cloudinary Document Proof Upload Component */}
            <div className="pt-2">
              <FileUpload
                label="Current Academic Year Enrolment Proof / Fee Receipt"
                helperText="Upload official college ID card, bonafide certificate, or fee receipt (PDF, PNG, JPG)"
                required={true}
                value={formData.proofUrl}
                onChange={(url) => setFormData({ ...formData, proofUrl: url })}
              />
            </div>

            <div className="pt-4 flex items-center justify-end gap-3">
              {currentApp && (
                <button
                  type="button"
                  onClick={() => { setIsApplying(false); setResubmittingFrom(null) }}
                  className="anavandi-btn-secondary text-sm"
                >
                  Cancel
                </button>
              )}
              <button
                type="submit"
                disabled={submitting}
                className="anavandi-btn-primary text-sm flex items-center gap-2"
              >
                <span>{submitting ? 'Submitting Application...' : 'Submit for Verification'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </form>
        </div>
      </div>
    )
  }

  // --- Main Student View (Status & Wallet Pass) ---
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Progress Timeline if pending or rejected */}
      {currentApp && currentApp.status !== 'approved' && !isApplying && (
        renderProgressIndicator(currentApp.status)
      )}

      {/* When approved, show Digital Wallet Pass */}
      {activePass && (
        <div className="space-y-6">
          {/* Renewal Banner if within 14 days */}
          {isRenewalDue && (
            <div className="p-4 rounded-xl bg-[#FEF7EB] border border-[#C97D1A]/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <RotateCw className="w-5 h-5 text-[#C97D1A] animate-spin-slow" />
                <div>
                  <p className="text-sm font-semibold text-[#1F1E1D]">
                    Concession Pass Renewal Window Open
                  </p>
                  <p className="text-xs text-[#6B6862]">
                    Your pass expires on {new Date(activePass.payload.validUntil).toLocaleDateString()}. Renew now to avoid travel interruption.
                  </p>
                </div>
              </div>
              <button
                onClick={handleStartRenewal}
                className="anavandi-btn-primary text-xs py-2 px-4 whitespace-nowrap"
              >
                Renew Concession
              </button>
            </div>
          )}

          {/* Daily limit gentle warning */}
          {(isApproachingLimit || isLimitExceeded) && (
            <div className={`p-3.5 rounded-xl border flex items-center gap-3 text-xs text-[#1F1E1D] ${
              isLimitExceeded
                ? 'bg-[#FAECE8] border-[#B3492F]/20'
                : 'bg-[#FEF7EB] border-[#C97D1A]/20'
            }`}>
              <AlertTriangle className={`w-4 h-4 flex-shrink-0 ${isLimitExceeded ? 'text-[#B3492F]' : 'text-[#C97D1A]'}`} />
              <div>
                <span className="font-semibold">
                  {isLimitExceeded ? 'Daily Travel Limit Reached: ' : 'Daily Travel Limit Notice: '}
                </span>
                You have used {distanceUsedToday} km of your daily {dailyDistanceLimit} km allowance today.
              </div>
            </div>
          )}

          {/* Tab Selection: Digital Pass Card vs Trip History */}
          <div className="flex border-b border-[#E8E4DC] gap-6">
            <button
              onClick={() => setActiveTab('pass')}
              className={`pb-3 text-sm font-semibold flex items-center gap-2 transition-colors relative ${
                activeTab === 'pass'
                  ? 'text-[#D97757]'
                  : 'text-[#6B6862] hover:text-[#1F1E1D]'
              }`}
            >
              <CreditCard className="w-4 h-4" />
              <span>Digital Concession Card</span>
              {activeTab === 'pass' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#D97757]" />
              )}
            </button>

            <button
              onClick={() => setActiveTab('history')}
              className={`pb-3 text-sm font-semibold flex items-center gap-2 transition-colors relative ${
                activeTab === 'history'
                  ? 'text-[#D97757]'
                  : 'text-[#6B6862] hover:text-[#1F1E1D]'
              }`}
            >
              <History className="w-4 h-4" />
              <span>Trip Logs & Usage ({studentTrips.length})</span>
              {activeTab === 'history' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#D97757]" />
              )}
            </button>
          </div>

          {activeTab === 'pass' ? (
            /* Digital Wallet Object Pass */
            <div className="max-w-md mx-auto">
              <div className="anavandi-card overflow-hidden bg-white border border-[#E8E4DC] shadow-sm relative">
                {/* Top Bus Pattern Accent Strip */}
                <div className="h-2 bg-[#D97757] w-full" />

                <div className="p-6 space-y-5">
                  {/* Card Header */}
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-sm text-[#1F1E1D] tracking-tight">KSRTC DIGITAL PASS</span>
                        <span className="text-[10px] px-1.5 py-0.2 bg-[#EFF5ED] text-[#4F7942] rounded font-medium border border-[#4F7942]/20">
                          Active
                        </span>
                      </div>
                      <p className="text-[11px] text-[#6B6862]">Government of Kerala Concession</p>
                    </div>
                    <div className="text-right">
                      <span className="text-[11px] font-mono text-[#6B6862] font-semibold">{activePass.id}</span>
                    </div>
                  </div>

                  {/* Student Photo & Bio */}
                  <div className="flex items-center gap-4 bg-[#FAF8F5] p-3.5 rounded-xl border border-[#E8E4DC]">
                    <img
                      src={activePass.payload.photoUrl || 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=200&auto=format&fit=crop&q=80'}
                      alt={activePass.payload.name}
                      className="w-16 h-16 rounded-lg object-cover border border-[#E8E4DC]"
                    />
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-sm text-[#1F1E1D] truncate">
                        {activePass.payload.name}
                      </h3>
                      <p className="text-xs text-[#6B6862] truncate">
                        Roll: {activePass.payload.rollNo || 'B21CS104'}
                      </p>
                      <p className="text-[11px] text-[#6B6862] truncate">
                        {activePass.payload.institutionName}
                      </p>
                    </div>
                  </div>

                  {/* Route & Limits */}
                  <div className="space-y-2 text-xs">
                    <div className="flex items-center justify-between py-1.5 border-b border-[#E8E4DC]">
                      <span className="text-[#6B6862] flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-[#D97757]" /> Approved Route
                      </span>
                      <span className="font-semibold text-[#1F1E1D] text-right">
                        {activePass.payload.route}
                      </span>
                    </div>

                    <div className="flex items-center justify-between py-1.5 border-b border-[#E8E4DC]">
                      <span className="text-[#6B6862] flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-[#6B6862]" /> Validity
                      </span>
                      <span className="font-medium text-[#1F1E1D]">
                        Until {new Date(activePass.payload.validUntil).toLocaleDateString()}
                      </span>
                    </div>

                    <div className="flex items-center justify-between py-1.5">
                      <span className="text-[#6B6862]">Daily Distance Limit</span>
                      <span className="font-medium text-[#1F1E1D]">
                        {dailyDistanceLimit} km / day
                      </span>
                    </div>
                  </div>

                  {/* Anti-Copy Rotating QR Section */}
                  <div className="bg-[#FAF8F5] p-4 rounded-xl border border-[#D97757]/30 text-center space-y-3">
                    <div className="inline-block p-2 bg-white rounded-lg border border-[#E8E4DC]">
                      <QRCodeSVG
                        value={generateStudentQRData(activePass)}
                        size={170}
                        level="M"
                        includeMargin={true}
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-center gap-2">
                        <span className="text-[11px] text-[#6B6862]">Rotating Day Code:</span>
                        <span className="font-mono font-bold text-xs px-2 py-0.5 bg-white border border-[#E8E4DC] rounded text-[#D97757]">
                          {computeDailyCode(activePass.payload.rotationSeed)}
                        </span>
                      </div>
                      <p className="text-[10px] text-[#6B6862] mt-1">
                        Ed25519 Signed • Screenshot protection active
                      </p>
                    </div>
                  </div>
                </div>

                {/* Footer note */}
                <div className="bg-[#FAF8F5] px-6 py-2.5 border-t border-[#E8E4DC] text-[10px] text-[#6B6862] flex items-center justify-between">
                  <span>Show this screen to bus conductor</span>
                  <span className="flex items-center gap-1 text-[#4F7942] font-medium">
                    <ShieldCheck className="w-3.5 h-3.5" /> Authenticated
                  </span>
                </div>
              </div>
            </div>
          ) : (
            /* Trip History Tab */
            <div className="anavandi-card bg-white overflow-hidden">
              <div className="p-4 border-b border-[#E8E4DC] flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-[#1F1E1D]">Travel & Trip Logs</h3>
                  <p className="text-xs text-[#6B6862]">
                    Recorded by KSRTC conductors during route verifications
                  </p>
                </div>
                <div className="text-xs font-medium px-3 py-1 bg-[#FAF8F5] border border-[#E8E4DC] rounded-lg text-[#1F1E1D]">
                  Today: {distanceUsedToday} / {dailyDistanceLimit} km used
                </div>
              </div>

              {studentTrips.length === 0 ? (
                <div className="p-8 text-center text-[#6B6862] text-xs">
                  <Bus className="w-8 h-8 text-[#E8E4DC] mx-auto mb-2" />
                  No recorded trips yet. Trips logged by bus conductors will appear here in real-time.
                </div>
              ) : (
                <div className="divide-y divide-[#E8E4DC]">
                  {studentTrips.map((trip) => (
                    <div key={trip.id} className="p-4 flex items-center justify-between hover:bg-[#FAF8F5] transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-[#FAF0EC] text-[#D97757] flex items-center justify-center flex-shrink-0">
                          <Bus className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-[#1F1E1D]">{trip.route || activePass.payload.route}</p>
                          <p className="text-[11px] text-[#6B6862]">
                            {new Date(trip.timestamp).toLocaleString()} • Conductor: {trip.conductorName || 'KSRTC Officer'}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-bold text-[#1F1E1D]">+{trip.distanceKm || 28} km</span>
                        <p className="text-[10px] text-[#4F7942] font-medium">Logged</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
