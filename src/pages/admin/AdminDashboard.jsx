import { useState } from 'react'
import { useData } from '../../context/DataContext'
import { 
  Building2, 
  Users, 
  ShieldCheck, 
  Plus, 
  ToggleLeft, 
  ToggleRight, 
  CheckCircle2, 
  MapPin, 
  QrCode,
  Sparkles
} from 'lucide-react'

export default function AdminDashboard() {
  const { 
    institutions, 
    conductors, 
    applications, 
    passes, 
    approveByAdminAndIssuePass, 
    addInstitution, 
    toggleInstitution, 
    addConductor, 
    toggleConductor 
  } = useData()

  const [activeTab, setActiveTab] = useState('approvals') // 'approvals' | 'institutions' | 'conductors'

  // Institution Modal
  const [showInstModal, setShowInstModal] = useState(false)
  const [newInstName, setNewInstName] = useState('')
  const [newInstDomain, setNewInstDomain] = useState('')
  const [newInstDistrict, setNewInstDistrict] = useState('Thiruvananthapuram')

  // Conductor Modal
  const [showCondModal, setShowCondModal] = useState(false)
  const [newCondName, setNewCondName] = useState('')
  const [newCondEmail, setNewCondEmail] = useState('')
  const [newCondDepot, setNewCondDepot] = useState('Trivandrum Central')

  const [issuingId, setIssuingId] = useState(null)
  const [successBanner, setSuccessBanner] = useState('')

  const pendingAdminApps = applications.filter(a => a.status === 'pending_admin')

  const handleCreateInstitution = (e) => {
    e.preventDefault()
    if (!newInstName || !newInstDomain) return
    addInstitution({
      name: newInstName,
      domain: newInstDomain.replace(/^@/, '').toLowerCase().trim(),
      district: newInstDistrict,
    })
    setNewInstName('')
    setNewInstDomain('')
    setShowInstModal(false)
  }

  const handleCreateConductor = (e) => {
    e.preventDefault()
    if (!newCondName || !newCondEmail) return
    addConductor({
      name: newCondName,
      email: newCondEmail.toLowerCase().trim(),
      depot: newCondDepot,
    })
    setNewCondName('')
    setNewCondEmail('')
    setShowCondModal(false)
  }

  const handleIssuePass = async (appId) => {
    setIssuingId(appId)
    try {
      const pass = await approveByAdminAndIssuePass(appId)
      setSuccessBanner(`Digital Pass ${pass.id} cryptographically signed with Ed25519 and issued successfully!`)
      setTimeout(() => setSuccessBanner(''), 6000)
    } finally {
      setIssuingId(null)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-[#1F1E1D] tracking-tight">
            KSRTC State Concession Administration
          </h1>
          <p className="text-xs text-[#6B6862] mt-0.5">
            System Control Panel • Ed25519 Issuance & Master Registries
          </p>
        </div>
      </div>

      {successBanner && (
        <div className="p-4 rounded-xl bg-[#EFF5ED] border border-[#4F7942]/30 text-[#4F7942] text-xs font-medium flex items-center gap-2">
          <Sparkles className="w-4 h-4 flex-shrink-0 text-[#4F7942]" />
          <span>{successBanner}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-[#E8E4DC] gap-6">
        <button
          onClick={() => setActiveTab('approvals')}
          className={`pb-3 text-sm font-semibold flex items-center gap-2 transition-colors relative ${
            activeTab === 'approvals'
              ? 'text-[#D97757]'
              : 'text-[#6B6862] hover:text-[#1F1E1D]'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          <span>Pass Approvals & Issuance</span>
          {pendingAdminApps.length > 0 && (
            <span className="px-1.5 py-0.2 bg-[#D97757] text-white text-[10px] rounded-full font-bold">
              {pendingAdminApps.length}
            </span>
          )}
          {activeTab === 'approvals' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#D97757]" />
          )}
        </button>

        <button
          onClick={() => setActiveTab('institutions')}
          className={`pb-3 text-sm font-semibold flex items-center gap-2 transition-colors relative ${
            activeTab === 'institutions'
              ? 'text-[#D97757]'
              : 'text-[#6B6862] hover:text-[#1F1E1D]'
          }`}
        >
          <Building2 className="w-4 h-4" />
          <span>Institution Registry ({institutions.length})</span>
          {activeTab === 'institutions' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#D97757]" />
          )}
        </button>

        <button
          onClick={() => setActiveTab('conductors')}
          className={`pb-3 text-sm font-semibold flex items-center gap-2 transition-colors relative ${
            activeTab === 'conductors'
              ? 'text-[#D97757]'
              : 'text-[#6B6862] hover:text-[#1F1E1D]'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Conductor Verifiers ({conductors.length})</span>
          {activeTab === 'conductors' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#D97757]" />
          )}
        </button>
      </div>

      {/* Tab 1: Final Pass Approval (Phase 5 & 6) */}
      {activeTab === 'approvals' && (
        <div className="space-y-4">
          <div className="anavandi-card bg-white overflow-hidden shadow-xs">
            <div className="p-4 border-b border-[#E8E4DC] flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-[#1F1E1D]">
                  Institution-Verified Applications Awaiting Final KSRTC Issue ({pendingAdminApps.length})
                </h2>
                <p className="text-xs text-[#6B6862]">
                  Approving signs the pass payload with the Ed25519 system key and publishes rotating seed
                </p>
              </div>
            </div>

            {pendingAdminApps.length === 0 ? (
              <div className="p-8 text-center text-xs text-[#6B6862]">
                <CheckCircle2 className="w-8 h-8 text-[#4F7942]/30 mx-auto mb-2" />
                All verified applications have been processed and issued.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#FAF8F5] text-[#6B6862] border-b border-[#E8E4DC]">
                    <tr>
                      <th className="py-3 px-4 font-semibold">Student</th>
                      <th className="py-3 px-4 font-semibold">Institution</th>
                      <th className="py-3 px-4 font-semibold">Approved Route</th>
                      <th className="py-3 px-4 font-semibold">Distance Limit</th>
                      <th className="py-3 px-4 font-semibold text-right">Cryptographic Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E8E4DC]">
                    {pendingAdminApps.map((app) => (
                      <tr key={app.id} className="hover:bg-[#FAF8F5]/80 transition-colors">
                        <td className="py-3 px-4 font-medium text-[#1F1E1D]">
                          {app.studentName}
                          <span className="block text-[11px] text-[#6B6862]">Roll: {app.rollNo}</span>
                        </td>
                        <td className="py-3 px-4 text-[#1F1E1D]">
                          {app.institutionName}
                        </td>
                        <td className="py-3 px-4 text-[#1F1E1D]">
                          <div className="flex items-center gap-1 font-medium">
                            <MapPin className="w-3 h-3 text-[#D97757]" />
                            <span>{app.routeFrom} ➔ {app.routeTo}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4 font-mono font-semibold text-[#1F1E1D]">
                          {app.distanceLimitKm || 30} km/day
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => handleIssuePass(app.id)}
                            disabled={issuingId === app.id}
                            className="px-3.5 py-1.5 bg-[#D97757] hover:bg-[#C86646] text-white rounded-md font-semibold text-xs transition-colors inline-flex items-center gap-1.5 shadow-xs"
                          >
                            <QrCode className="w-3.5 h-3.5" />
                            <span>{issuingId === app.id ? 'Signing Pass...' : 'Issue & Sign Pass'}</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Recently Issued Passes */}
          {passes.length > 0 && (
            <div className="anavandi-card bg-white overflow-hidden shadow-xs">
              <div className="p-4 border-b border-[#E8E4DC]">
                <h3 className="text-sm font-bold text-[#1F1E1D]">Active Issued Passes ({passes.length})</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#FAF8F5] text-[#6B6862] border-b border-[#E8E4DC]">
                    <tr>
                      <th className="py-2.5 px-4 font-medium">Pass ID</th>
                      <th className="py-2.5 px-4 font-medium">Student</th>
                      <th className="py-2.5 px-4 font-medium">Route</th>
                      <th className="py-2.5 px-4 font-medium">Validity</th>
                      <th className="py-2.5 px-4 font-medium">Digital Signature</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E8E4DC]">
                    {passes.map((pass) => (
                      <tr key={pass.id} className="text-[#6B6862]">
                        <td className="py-2.5 px-4 font-mono font-bold text-[#D97757]">{pass.id}</td>
                        <td className="py-2.5 px-4 font-medium text-[#1F1E1D]">{pass.payload.name}</td>
                        <td className="py-2.5 px-4">{pass.payload.route}</td>
                        <td className="py-2.5 px-4">
                          Until {new Date(pass.payload.validUntil).toLocaleDateString()}
                        </td>
                        <td className="py-2.5 px-4 font-mono text-[10px] truncate max-w-[140px]">
                          {pass.signature.slice(0, 16)}...
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Institution Management (Phase 5 Section 1) */}
      {activeTab === 'institutions' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-xs text-[#6B6862]">
              Students can only select an institution if their registered email matches the approved domain.
            </p>
            <button
              onClick={() => setShowInstModal(true)}
              className="anavandi-btn-primary text-xs flex items-center gap-1.5 py-1.5 px-3"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Institution</span>
            </button>
          </div>

          <div className="anavandi-card bg-white overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#FAF8F5] text-[#6B6862] border-b border-[#E8E4DC]">
                  <tr>
                    <th className="py-3 px-4 font-semibold">Institution Name</th>
                    <th className="py-3 px-4 font-semibold">Email Domain Filter</th>
                    <th className="py-3 px-4 font-semibold">District</th>
                    <th className="py-3 px-4 font-semibold">Status</th>
                    <th className="py-3 px-4 font-semibold text-right">Toggle Active</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E8E4DC]">
                  {institutions.map((inst) => (
                    <tr key={inst.id} className="hover:bg-[#FAF8F5]/80 transition-colors">
                      <td className="py-3 px-4 font-medium text-[#1F1E1D]">
                        {inst.name}
                      </td>
                      <td className="py-3 px-4 font-mono text-[#D97757] font-semibold">
                        @{inst.domain}
                      </td>
                      <td className="py-3 px-4 text-[#6B6862]">{inst.district}</td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded text-[11px] font-medium ${
                          inst.active 
                            ? 'bg-[#EFF5ED] text-[#4F7942]' 
                            : 'bg-[#FAECE8] text-[#B3492F]'
                        }`}>
                          {inst.active ? 'Active' : 'Disabled'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => toggleInstitution(inst.id)}
                          className={`p-1.5 rounded transition-colors ${
                            inst.active ? 'text-[#4F7942] hover:bg-[#EFF5ED]' : 'text-[#6B6862] hover:bg-[#FAF8F5]'
                          }`}
                          title={inst.active ? 'Deactivate institution' : 'Activate institution'}
                        >
                          {inst.active ? <ToggleRight className="w-6 h-6" /> : <ToggleLeft className="w-6 h-6" />}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Conductor Management (Phase 5 Section 2) */}
      {activeTab === 'conductors' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-xs text-[#6B6862]">
              Conductor accounts are authorized to use the offline PWA QR verification camera.
            </p>
            <button
              onClick={() => setShowCondModal(true)}
              className="anavandi-btn-primary text-xs flex items-center gap-1.5 py-1.5 px-3"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Conductor</span>
            </button>
          </div>

          <div className="anavandi-card bg-white overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#FAF8F5] text-[#6B6862] border-b border-[#E8E4DC]">
                  <tr>
                    <th className="py-3 px-4 font-semibold">Conductor Name</th>
                    <th className="py-3 px-4 font-semibold">Official Email</th>
                    <th className="py-3 px-4 font-semibold">Depot / Station</th>
                    <th className="py-3 px-4 font-semibold">Status</th>
                    <th className="py-3 px-4 font-semibold text-right">Toggle Access</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E8E4DC]">
                  {conductors.map((cond) => (
                    <tr key={cond.id} className="hover:bg-[#FAF8F5]/80 transition-colors">
                      <td className="py-3 px-4 font-medium text-[#1F1E1D]">
                        {cond.name}
                      </td>
                      <td className="py-3 px-4 font-mono text-[#6B6862]">
                        {cond.email}
                      </td>
                      <td className="py-3 px-4 text-[#1F1E1D]">{cond.depot}</td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded text-[11px] font-medium ${
                          cond.active 
                            ? 'bg-[#EFF5ED] text-[#4F7942]' 
                            : 'bg-[#FAECE8] text-[#B3492F]'
                        }`}>
                          {cond.active ? 'Authorized' : 'Suspended'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => toggleConductor(cond.id)}
                          className={`p-1.5 rounded transition-colors ${
                            cond.active ? 'text-[#4F7942] hover:bg-[#EFF5ED]' : 'text-[#6B6862] hover:bg-[#FAF8F5]'
                          }`}
                          title={cond.active ? 'Suspend access' : 'Authorize access'}
                        >
                          {cond.active ? <ToggleRight className="w-6 h-6" /> : <ToggleLeft className="w-6 h-6" />}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Add Institution Modal */}
      {showInstModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="anavandi-card bg-white p-6 max-w-md w-full shadow-lg space-y-4">
            <h3 className="text-base font-bold text-[#1F1E1D]">Add Approved Institution</h3>
            <form onSubmit={handleCreateInstitution} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-[#1F1E1D] mb-1">Institution Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Sree Chitra Thirunal College of Engineering"
                  value={newInstName}
                  onChange={(e) => setNewInstName(e.target.value)}
                  className="anavandi-input w-full text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#1F1E1D] mb-1">Official Email Domain</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. sctce.ac.in"
                  value={newInstDomain}
                  onChange={(e) => setNewInstDomain(e.target.value)}
                  className="anavandi-input w-full text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#1F1E1D] mb-1">District</label>
                <input
                  type="text"
                  required
                  value={newInstDistrict}
                  onChange={(e) => setNewInstDistrict(e.target.value)}
                  className="anavandi-input w-full text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowInstModal(false)}
                  className="anavandi-btn-secondary text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="anavandi-btn-primary text-xs"
                >
                  Register Institution
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Conductor Modal */}
      {showCondModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="anavandi-card bg-white p-6 max-w-md w-full shadow-lg space-y-4">
            <h3 className="text-base font-bold text-[#1F1E1D]">Add KSRTC Conductor</h3>
            <form onSubmit={handleCreateConductor} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-[#1F1E1D] mb-1">Conductor Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Vijayan Nair"
                  value={newCondName}
                  onChange={(e) => setNewCondName(e.target.value)}
                  className="anavandi-input w-full text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#1F1E1D] mb-1">Conductor Email</label>
                <input
                  type="email"
                  required
                  placeholder="e.g. vijayan.cond@ksrtc.gov.in"
                  value={newCondEmail}
                  onChange={(e) => setNewCondEmail(e.target.value)}
                  className="anavandi-input w-full text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#1F1E1D] mb-1">Depot / Station</label>
                <input
                  type="text"
                  required
                  value={newCondDepot}
                  onChange={(e) => setNewCondDepot(e.target.value)}
                  className="anavandi-input w-full text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCondModal(false)}
                  className="anavandi-btn-secondary text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="anavandi-btn-primary text-xs"
                >
                  Authorize Conductor
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
