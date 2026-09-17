import { useState, useMemo } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useData } from '../../context/DataContext'
import { 
  Check, 
  X, 
  FileText, 
  Search, 
  CheckCircle2, 
  Clock, 
  MapPin, 
  Eye 
} from 'lucide-react'

export default function InstitutionDashboard() {
  const { currentUser } = useAuth()
  const { applications, approveByInstitution, rejectByInstitution } = useData()

  const [searchTerm, setSearchTerm] = useState('')
  const [selectedAppForApproval, setSelectedAppForApproval] = useState(null)
  const [selectedAppForRejection, setSelectedAppForRejection] = useState(null)
  const [proofPreviewUrl, setProofPreviewUrl] = useState(null)

  const [distanceLimitKm, setDistanceLimitKm] = useState(30)
  const [rejectionReason, setRejectionReason] = useState('')

  // Filter by institution ID matching currentUser
  const instApplications = useMemo(() => {
    return applications.filter(app => {
      // If current user is institution, match ID or show all if demo inst
      if (currentUser?.institutionId) {
        return app.institutionId === currentUser.institutionId
      }
      return true
    })
  }, [applications, currentUser])

  // Filtered by search
  const filteredApps = useMemo(() => {
    return instApplications.filter(app => {
      const matchQuery = (app.studentName + ' ' + app.rollNo + ' ' + app.routeFrom + ' ' + app.routeTo).toLowerCase()
      return matchQuery.includes(searchTerm.toLowerCase())
    })
  }, [instApplications, searchTerm])

  const pendingApps = filteredApps.filter(a => a.status === 'pending_institution')
  const completedApps = filteredApps.filter(a => a.status !== 'pending_institution')

  const handleConfirmApproval = async () => {
    if (!selectedAppForApproval) return
    await approveByInstitution(selectedAppForApproval.id, { distanceLimitKm })
    setSelectedAppForApproval(null)
  }

  const handleConfirmRejection = async () => {
    if (!selectedAppForRejection) return
    await rejectByInstitution(selectedAppForRejection.id, rejectionReason)
    setSelectedAppForRejection(null)
    setRejectionReason('')
  }

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-[#1F1E1D] tracking-tight">
            Institution Concession Verification
          </h1>
          <p className="text-xs text-[#6B6862] mt-0.5">
            {currentUser?.institutionName || 'Authorized Institution Desk'} • Academic Verification Desk
          </p>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-[#6B6862] absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search student or roll no..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="anavandi-input w-full pl-9 text-xs py-2"
          />
        </div>
      </div>

      {/* Pending Applications Section */}
      <div className="anavandi-card bg-white overflow-hidden shadow-xs">
        <div className="p-4 border-b border-[#E8E4DC] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-[#C97D1A]" />
            <h2 className="text-sm font-bold text-[#1F1E1D]">
              Applications Awaiting Institutional Approval ({pendingApps.length})
            </h2>
          </div>
          <span className="text-xs text-[#6B6862]">
            Verify enrollment documents before approving
          </span>
        </div>

        {pendingApps.length === 0 ? (
          <div className="p-8 text-center text-xs text-[#6B6862]">
            <CheckCircle2 className="w-8 h-8 text-[#4F7942]/40 mx-auto mb-2" />
            No pending applications for your institution at this moment.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#FAF8F5] text-[#6B6862] border-b border-[#E8E4DC]">
                <tr>
                  <th className="py-3 px-4 font-semibold">Student</th>
                  <th className="py-3 px-4 font-semibold">Roll No</th>
                  <th className="py-3 px-4 font-semibold">Requested Route</th>
                  <th className="py-3 px-4 font-semibold">Proof Document</th>
                  <th className="py-3 px-4 font-semibold">Submitted</th>
                  <th className="py-3 px-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8E4DC]">
                {pendingApps.map((app) => (
                  <tr key={app.id} className="hover:bg-[#FAF8F5]/80 transition-colors">
                    <td className="py-3 px-4 font-medium text-[#1F1E1D]">
                      {app.studentName}
                      <span className="block text-[11px] text-[#6B6862]">{app.studentEmail}</span>
                    </td>
                    <td className="py-3 px-4 font-mono text-[#1F1E1D] font-semibold">
                      {app.rollNo}
                    </td>
                    <td className="py-3 px-4 text-[#1F1E1D]">
                      <div className="flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-[#D97757]" />
                        <span>{app.routeFrom} ➔ {app.routeTo}</span>
                      </div>
                      <span className="text-[10px] text-[#6B6862]">{app.distanceKm || 28} km requested</span>
                    </td>
                    <td className="py-3 px-4">
                      {app.proofUrl ? (
                        <button
                          onClick={() => setProofPreviewUrl(app.proofUrl)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[#FAF8F5] border border-[#E8E4DC] hover:border-[#D97757] rounded text-xs text-[#1F1E1D] transition-colors"
                        >
                          <Eye className="w-3.5 h-3.5 text-[#D97757]" />
                          <span>View Proof</span>
                        </button>
                      ) : (
                        <span className="text-[#99958D]">No proof attached</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-[#6B6862]">
                      {new Date(app.submittedAt).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4 text-right space-x-2">
                      <button
                        onClick={() => {
                          setSelectedAppForApproval(app)
                          setDistanceLimitKm(app.distanceKm || 30)
                        }}
                        className="px-3 py-1.5 bg-[#EFF5ED] text-[#4F7942] hover:bg-[#4F7942] hover:text-white border border-[#4F7942]/30 rounded-md font-semibold text-xs transition-colors inline-flex items-center gap-1"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Approve</span>
                      </button>
                      <button
                        onClick={() => setSelectedAppForRejection(app)}
                        className="px-3 py-1.5 bg-[#FAECE8] text-[#B3492F] hover:bg-[#B3492F] hover:text-white border border-[#B3492F]/30 rounded-md font-semibold text-xs transition-colors inline-flex items-center gap-1"
                      >
                        <X className="w-3.5 h-3.5" />
                        <span>Reject</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* History / Processed Table */}
      {completedApps.length > 0 && (
        <div className="anavandi-card bg-white overflow-hidden shadow-xs">
          <div className="p-4 border-b border-[#E8E4DC]">
            <h3 className="text-sm font-bold text-[#1F1E1D]">Processed Applications</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#FAF8F5] text-[#6B6862] border-b border-[#E8E4DC]">
                <tr>
                  <th className="py-2.5 px-4 font-medium">Student</th>
                  <th className="py-2.5 px-4 font-medium">Roll No</th>
                  <th className="py-2.5 px-4 font-medium">Route</th>
                  <th className="py-2.5 px-4 font-medium">Status</th>
                  <th className="py-2.5 px-4 font-medium">Limit (km)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8E4DC]">
                {completedApps.map((app) => (
                  <tr key={app.id} className="text-[#6B6862]">
                    <td className="py-2.5 px-4 font-medium text-[#1F1E1D]">{app.studentName}</td>
                    <td className="py-2.5 px-4 font-mono">{app.rollNo}</td>
                    <td className="py-2.5 px-4">{app.routeFrom} ➔ {app.routeTo}</td>
                    <td className="py-2.5 px-4">
                      <span className={`px-2 py-0.5 rounded text-[11px] font-medium ${
                        app.status === 'approved' 
                          ? 'bg-[#EFF5ED] text-[#4F7942]' 
                          : app.status === 'rejected'
                          ? 'bg-[#FAECE8] text-[#B3492F]'
                          : 'bg-[#FEF7EB] text-[#C97D1A]'
                      }`}>
                        {app.status === 'pending_admin' ? 'Sent to KSRTC Admin' : app.status}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 font-mono">{app.distanceLimitKm || '-'} km</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Approve Modal with Distance Limit Setting */}
      {selectedAppForApproval && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="anavandi-card bg-white p-6 max-w-md w-full shadow-lg space-y-4">
            <h3 className="text-base font-bold text-[#1F1E1D]">
              Confirm Institution Approval
            </h3>
            <p className="text-xs text-[#6B6862]">
              Approve <strong>{selectedAppForApproval.studentName}</strong> ({selectedAppForApproval.rollNo}) for route <em>{selectedAppForApproval.routeFrom} ➔ {selectedAppForApproval.routeTo}</em>.
            </p>

            <div>
              <label className="block text-xs font-semibold text-[#1F1E1D] mb-1">
                Authorized Daily Travel Distance Limit (km)
              </label>
              <input
                type="number"
                min="5"
                max="120"
                value={distanceLimitKm}
                onChange={(e) => setDistanceLimitKm(e.target.value)}
                className="anavandi-input w-full text-sm font-semibold"
              />
              <p className="text-[11px] text-[#6B6862] mt-1">
                Sets the max subsidized distance allowed per day (round trip).
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setSelectedAppForApproval(null)}
                className="anavandi-btn-secondary text-xs"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmApproval}
                className="anavandi-btn-primary text-xs bg-[#4F7942] hover:bg-[#436738]"
              >
                Forward to KSRTC Admin
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {selectedAppForRejection && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="anavandi-card bg-white p-6 max-w-md w-full shadow-lg space-y-4">
            <h3 className="text-base font-bold text-[#B3492F]">
              Reject Application
            </h3>
            <p className="text-xs text-[#6B6862]">
              Provide a reason to <strong>{selectedAppForRejection.studentName}</strong> so they can update and resubmit.
            </p>

            <div>
              <label className="block text-xs font-semibold text-[#1F1E1D] mb-1">
                Rejection Reason / Notes
              </label>
              <textarea
                rows={3}
                placeholder="e.g. Incomplete ID card upload / Invalid admission number for academic year 2026..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                className="anavandi-input w-full text-xs"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setSelectedAppForRejection(null)}
                className="anavandi-btn-secondary text-xs"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmRejection}
                className="anavandi-btn-primary text-xs bg-[#B3492F] hover:bg-[#993e27]"
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Proof Preview Modal */}
      {proofPreviewUrl && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <div className="anavandi-card bg-white p-4 max-w-2xl w-full max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-[#E8E4DC]">
              <h3 className="text-sm font-bold text-[#1F1E1D] flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-[#D97757]" />
                Enrolment Proof Document
              </h3>
              <button
                onClick={() => setProofPreviewUrl(null)}
                className="p-1 rounded text-[#6B6862] hover:text-[#1F1E1D]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-auto py-4 flex items-center justify-center">
              {proofPreviewUrl.endsWith('.pdf') ? (
                <iframe src={proofPreviewUrl} className="w-full h-96 border rounded-lg" />
              ) : (
                <img
                  src={proofPreviewUrl}
                  alt="Student Proof"
                  className="max-h-96 max-w-full rounded-lg object-contain border border-[#E8E4DC]"
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
