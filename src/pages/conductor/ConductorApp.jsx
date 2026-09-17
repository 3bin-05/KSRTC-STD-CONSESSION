import { useState, useEffect, useRef } from 'react'
import { Html5Qrcode } from 'html5-qrcode'
import { verifyPassQR, generateStudentQRData } from '../../lib/crypto'
import { useAuth } from '../../context/AuthContext'
import { useData } from '../../context/DataContext'
import {
  Camera,
  CheckCircle2,
  XCircle,
  Bus,
  MapPin,
  Check,
  AlertTriangle,
  Wifi,
  WifiOff,
  Sparkles,
  Upload,
  SwitchCamera,
  Gauge,
  Clock3
} from 'lucide-react'

export default function ConductorApp() {
  const { currentUser } = useAuth()
  const { passes, trips, logTrip } = useData()

  const [isScanning, setIsScanning] = useState(false)
  const [scanResult, setScanResult] = useState(null) // { verified, reason, payload }
  const [tripLogged, setTripLogged] = useState(false)
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [cameraError, setCameraError] = useState(null)
  const [offlineQueueCount, setOfflineQueueCount] = useState(0)
  const [cameras, setCameras] = useState([])
  const [selectedCameraId, setSelectedCameraId] = useState(null)
  const [tripDistance, setTripDistance] = useState(14)
  const [quotaOverride, setQuotaOverride] = useState(false)

  const html5QrCodeRef = useRef(null)
  const fileInputRef = useRef(null)
  const scannerContainerId = 'conductor-qr-reader'

  // Monitor online/offline status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  // Cleanup scanner on unmount
  useEffect(() => {
    return () => {
      if (html5QrCodeRef.current) {
        html5QrCodeRef.current.stop().catch(() => {})
        try { html5QrCodeRef.current.clear() } catch(_e) {}
      }
    }
  }, [])

  // Enumerate cameras (requires permission on some browsers)
  const enumerateCameras = async () => {
    try {
      const devices = await Html5Qrcode.getCameras()
      if (devices && devices.length) {
        setCameras(devices)
        if (!selectedCameraId) {
          // Prefer back/environment camera
          const back = devices.find(d => /back|rear|environment/i.test(d.label))
          setSelectedCameraId(back ? back.id : devices[0].id)
        }
      }
    } catch (_e) {
      // No cameras or permission not yet granted — will be handled on start
    }
  }

  // Explicit permission request helper — gives clearer error messages
  const requestCameraPermission = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('Camera API not supported in this browser. Use Chrome/Edge on HTTPS or localhost.')
    }
    // Trigger permission prompt
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
    // Immediately release — Html5Qrcode will re-acquire
    stream.getTracks().forEach(t => t.stop())
  }

  // Start Camera Scanner — robust permission + fallback handling
  const startScanner = async (cameraIdOverride = null) => {
    setCameraError(null)
    setScanResult(null)
    setTripLogged(false)
    setQuotaOverride(false)
    setIsScanning(true)

    try {
      if (html5QrCodeRef.current) {
        try { await html5QrCodeRef.current.stop() } catch(_e) {}
        try { html5QrCodeRef.current.clear() } catch(_e) {}
      }

      // Ensure we have permission before enumerating
      try {
        await requestCameraPermission()
      } catch (permErr) {
        const msg = permErr?.name === 'NotAllowedError'
          ? 'Camera permission denied. Please allow camera access in browser settings and reload.'
          : permErr?.name === 'NotFoundError'
          ? 'No camera found on this device. Use image upload below or simulator.'
          : permErr?.message || 'Camera access not granted. Use image upload fallback below.'
        throw new Error(msg)
      }

      await enumerateCameras()

      const qrCodeScanner = new Html5Qrcode(scannerContainerId)
      html5QrCodeRef.current = qrCodeScanner

      const cameraConfig = cameraIdOverride || selectedCameraId
        ? { deviceId: { exact: cameraIdOverride || selectedCameraId } }
        : { facingMode: 'environment' }

      await qrCodeScanner.start(
        cameraConfig,
        { fps: 10, qrbox: { width: 260, height: 260 }, aspectRatio: 1.0 },
        (decodedText) => handleScanSuccess(decodedText),
        () => { /* per-frame decode errors ignored */ }
      )

      // Re-enumerate after start to get labels (labels are empty until permission granted)
      enumerateCameras()
    } catch (err) {
      console.warn('Camera scan failed to start:', err)
      const secureContext = window.isSecureContext
      let hint = err.message || 'Camera access not granted or not available. You can use image upload or Quick Test Simulator below.'
      if (!secureContext) hint = 'Camera requires HTTPS or localhost. Open via https:// or http://localhost — or use image upload/simulation.'
      setCameraError(hint)
      setIsScanning(false)
    }
  }

  const stopScanner = async () => {
    if (html5QrCodeRef.current) {
      try { await html5QrCodeRef.current.stop() } catch(_e) {}
      try { html5QrCodeRef.current.clear() } catch(_e) {}
      html5QrCodeRef.current = null
    }
    setIsScanning(false)
  }

  const handleScanSuccess = async (qrData) => {
    await stopScanner()
    const verification = verifyPassQR(qrData)
    if (verification.valid) {
      const limit = verification.payload?.distanceLimitKm || 30
      setTripDistance(Math.round(limit / 2) || 14)
      setScanResult({ verified: true, payload: verification.payload, reason: 'Pass Cryptographically Valid' })
    } else {
      setScanResult({ verified: false, reason: verification.reason || 'Verification Failed' })
    }
  }

  // Fallback: scan from uploaded image file (useful on desktop or when camera blocked)
  const handleFileScan = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setCameraError(null)
    try {
      // Html5Qrcode.scanFile is static helper that decodes without needing video
      const decoded = await Html5Qrcode.scanFile(file, true)
      handleScanSuccess(decoded)
    } catch (err) {
      setCameraError('Could not read QR from image: ' + (err?.message || 'no QR found. Try a clearer photo.'))
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  // --- Daily travel quota computation for scanned student ---
  const scannedPayload = scanResult?.payload
  const scannedPassStudentTrips = scannedPayload
    ? trips.filter(t => t.studentId === scannedPayload.studentId || (scannedPayload.passId && t.passId === scannedPayload.passId))
    : []

  const todayStr = new Date().toISOString().split('T')[0]
  const todayTrips = scannedPassStudentTrips.filter(t => t.timestamp && t.timestamp.startsWith(todayStr))
  const todayUsedKm = todayTrips.reduce((sum, t) => sum + (Number(t.distanceKm) || 0), 0)
  const distanceLimit = scannedPayload?.distanceLimitKm || 30
  const remainingKm = Math.max(0, distanceLimit - todayUsedKm)
  const usagePct = distanceLimit > 0 ? Math.min(100, Math.round((todayUsedKm / distanceLimit) * 100)) : 0
  const isQuotaExceeded = todayUsedKm >= distanceLimit
  const wouldExceed = !isQuotaExceeded && (todayUsedKm + Number(tripDistance || 0) > distanceLimit)
  const quotaStatus = isQuotaExceeded ? 'exceeded' : usagePct >= 80 ? 'warning' : 'ok'

  // 1-Tap Log Trip with quota check
  const handleLogTrip = async () => {
    if (!scanResult?.payload) return
    const dist = Number(tripDistance) || 0
    if (dist <= 0 || dist > 120) return
    if (isQuotaExceeded && !quotaOverride) return

    const tripData = {
      passId: scanResult.payload.passId,
      studentId: scanResult.payload.studentId,
      studentName: scanResult.payload.name,
      route: scanResult.payload.route,
      distanceKm: dist,
      conductorId: currentUser?.uid || 'cond-1',
      conductorName: currentUser?.displayName || 'Suresh Kumar',
      timestamp: new Date().toISOString(),
    }

    if (!isOnline) setOfflineQueueCount(prev => prev + 1)

    await logTrip(tripData)
    setTripLogged(true)
  }

  // Simulators
  const testValidPass = () => {
    const validPass = passes[0]
    if (validPass) handleScanSuccess(generateStudentQRData(validPass))
    else alert('No active issued pass found. Approve an application in Admin portal first!')
  }
  const testFakePass = () => {
    handleScanSuccess(JSON.stringify({ p: { passId: 'PAS-999999', studentId: 'fake-uid', name: 'Counterfeit User', route: 'Ernakulam ➔ Aluva', validFrom: new Date().toISOString(), validUntil: new Date(Date.now()+ 1e6).toISOString(), rotationSeed: 'fake_seed' }, s: 'invalid_forged_signature_base64', c: 'FAKECD', t: Date.now() }))
  }
  const testExpiredScreenshot = () => {
    const validPass = passes[0]
    if (validPass) handleScanSuccess(JSON.stringify({ p: validPass.payload, s: validPass.signature, c: 'OLD999', t: Date.now()-86400000 }))
    else alert('No active pass found to test')
  }

  return (
    <div className="max-w-lg mx-auto min-h-[75vh] flex flex-col justify-between">
      {/* Network Status Bar */}
      <div className="flex items-center justify-between pb-3 border-b border-[#E8E4DC]">
        <div className="flex items-center gap-2">
          <Bus className="w-4 h-4 text-[#D97757]" />
          <span className="text-xs font-bold text-[#1F1E1D]">Conductor Terminal</span>
        </div>
        <div className="flex items-center gap-2 text-[11px]">
          {isOnline ? (
            <span className="flex items-center gap-1 text-[#4F7942] font-medium"><Wifi className="w-3.5 h-3.5" /> Online</span>
          ) : (
            <span className="flex items-center gap-1 text-[#C97D1A] font-medium"><WifiOff className="w-3.5 h-3.5" /> Offline Mode ({offlineQueueCount} queued)</span>
          )}
        </div>
      </div>

      <div className="my-auto py-4">
        {scanResult ? (
          scanResult.verified ? (
            <div className="anavandi-card overflow-hidden bg-[#EFF5ED] border-2 border-[#4F7942] p-5 text-center space-y-4 shadow-sm animate-in fade-in">
              <div className="w-16 h-16 rounded-full bg-[#4F7942] text-white flex items-center justify-center mx-auto shadow-sm">
                <Check className="w-10 h-10 stroke-[3]" />
              </div>
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-[#4F7942] bg-white/80 px-2.5 py-0.5 rounded-full border border-[#4F7942]/30">PASS VERIFIED • GENUINE</span>
                <h2 className="text-xl font-bold text-[#1F1E1D] mt-2">{scanResult.payload.name}</h2>
                <p className="text-xs text-[#6B6862]">{scanResult.payload.institutionName} • Roll {scanResult.payload.rollNo}</p>
              </div>

              <div className="flex items-center gap-3 bg-white p-3 rounded-xl border border-[#E8E4DC] text-left">
                <img src={scanResult.payload.photoUrl || 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=200&auto=format&fit=crop&q=80'} alt={scanResult.payload.name} className="w-14 h-14 rounded-lg object-cover border border-[#E8E4DC]" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-[#1F1E1D] flex items-center gap-1"><MapPin className="w-3.5 h-3.5 text-[#D97757]" />{scanResult.payload.route}</p>
                  <p className="text-[11px] text-[#6B6862] mt-0.5">Valid till {new Date(scanResult.payload.validUntil).toLocaleDateString()} • {scanResult.payload.passId}</p>
                </div>
              </div>

              {/* Daily quota panel — core requirement */}
              <div className={`p-3.5 rounded-xl border text-left space-y-2.5 ${quotaStatus === 'exceeded' ? 'bg-[#FAECE8] border-[#B3492F]/30' : quotaStatus === 'warning' ? 'bg-[#FEF7EB] border-[#C97D1A]/30' : 'bg-white border-[#E8E4DC]'}`}>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#1F1E1D] flex items-center gap-1.5"><Gauge className="w-3.5 h-3.5 text-[#6B6862]" /> Daily Travel Quota</span>
                  <span className={`text-[11px] px-2 py-0.5 rounded-full font-bold border ${quotaStatus === 'exceeded' ? 'bg-[#B3492F] text-white border-[#B3492F]' : quotaStatus === 'warning' ? 'bg-[#C97D1A] text-white border-[#C97D1A]' : 'bg-[#EFF5ED] text-[#4F7942] border-[#4F7942]/20'}`}>
                    {isQuotaExceeded ? 'LIMIT EXCEEDED' : quotaStatus === 'warning' ? 'NEARING LIMIT' : 'OK'}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="bg-[#FAF8F5] rounded-lg p-2 border border-[#E8E4DC]/60">
                    <p className="text-[10px] text-[#6B6862] uppercase tracking-wide">Limit</p>
                    <p className="text-sm font-bold text-[#1F1E1D]">{distanceLimit} km</p>
                  </div>
                  <div className="bg-[#FAF8F5] rounded-lg p-2 border border-[#E8E4DC]/60">
                    <p className="text-[10px] text-[#6B6862] uppercase tracking-wide">Used Today</p>
                    <p className={`text-sm font-bold ${quotaStatus === 'exceeded' ? 'text-[#B3492F]' : 'text-[#1F1E1D]'}`}>{todayUsedKm} km</p>
                    <p className="text-[10px] text-[#6B6862]">{todayTrips.length} trips</p>
                  </div>
                  <div className="bg-[#FAF8F5] rounded-lg p-2 border border-[#E8E4DC]/60">
                    <p className="text-[10px] text-[#6B6862] uppercase tracking-wide">Remaining</p>
                    <p className={`text-sm font-bold ${remainingKm === 0 ? 'text-[#B3492F]' : 'text-[#4F7942]'}`}>{remainingKm} km</p>
                    <p className="text-[10px] text-[#6B6862]">{usagePct}% used</p>
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="h-2.5 bg-[#E8E4DC] rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${quotaStatus === 'exceeded' ? 'bg-[#B3492F]' : quotaStatus === 'warning' ? 'bg-[#C97D1A]' : 'bg-[#4F7942]'}`} style={{ width: `${usagePct}%` }} />
                  </div>
                  <div className="flex justify-between text-[10px] text-[#6B6862]">
                    <span>0 km</span><span>{distanceLimit} km</span>
                  </div>
                </div>

                {todayTrips.length > 0 && (
                  <div className="pt-1">
                    <p className="text-[11px] font-semibold text-[#6B6862] flex items-center gap-1 mb-1"><Clock3 className="w-3 h-3" /> Today’s boardings</p>
                    <div className="space-y-1 max-h-20 overflow-auto pr-1">
                      {todayTrips.slice(0, 5).map(t => (
                        <div key={t.id} className="flex justify-between text-[11px] bg-[#FAF8F5] px-2 py-1 rounded border border-[#E8E4DC]/50">
                          <span className="text-[#6B6862]">{new Date(t.timestamp).toLocaleTimeString()} • {t.route || '—'}</span>
                          <span className="font-bold text-[#1F1E1D]">+{t.distanceKm} km</span>
                        </div>
                      ))}
                      {todayTrips.length > 5 && <p className="text-[10px] text-[#6B6862] text-center">+{todayTrips.length - 5} more</p>}
                    </div>
                  </div>
                )}

                {isQuotaExceeded ? (
                  <div className="flex gap-2 items-start p-2.5 rounded-lg bg-white border border-[#B3492F]/20 text-xs text-[#B3492F]">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <div className="text-left">
                      <p className="font-semibold">Daily quota exceeded — no further concession travel today.</p>
                      <p className="text-[#6B6862]">Used {todayUsedKm} / {distanceLimit} km. Advise ordinary ticket. Override only if authorized.</p>
                    </div>
                  </div>
                ) : wouldExceed ? (
                  <div className="flex gap-2 items-start p-2.5 rounded-lg bg-white border border-[#C97D1A]/30 text-xs text-[#C97D1A]">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <span>This {tripDistance} km boarding would exceed limit ({todayUsedKm} + {tripDistance} = {todayUsedKm + Number(tripDistance)} &gt; {distanceLimit} km).</span>
                  </div>
                ) : null}
              </div>

              <div className="pt-1 space-y-2">
                {tripLogged ? (
                  <div className="p-2.5 rounded-lg bg-[#4F7942] text-white text-xs font-semibold flex items-center justify-center gap-2"><CheckCircle2 className="w-4 h-4" /><span>Trip Logged Successfully!</span></div>
                ) : (
                  <>
                    <div className="flex gap-2 items-end bg-white p-2.5 rounded-xl border border-[#E8E4DC] text-left">
                      <div className="flex-1">
                        <label className="block text-[11px] font-semibold text-[#1F1E1D] mb-1">Trip distance for this boarding (km)</label>
                        <input type="number" min={1} max={120} value={tripDistance} onChange={e => setTripDistance(e.target.value)} className="anavandi-input w-full text-sm py-2" />
                      </div>
                      <button
                        onClick={handleLogTrip}
                        disabled={isQuotaExceeded && !quotaOverride || Number(tripDistance) <=0}
                        className={`px-4 py-2.5 rounded-lg font-semibold text-xs flex items-center gap-1.5 whitespace-nowrap transition-colors ${isQuotaExceeded && !quotaOverride ? 'bg-[#E8E4DC] text-[#99958D] cursor-not-allowed' : wouldExceed ? 'bg-[#C97D1A] hover:bg-[#b06e17] text-white' : 'bg-[#1F1E1D] hover:bg-[#333230] text-white'}`}
                      >
                        <Bus className="w-4 h-4" /><span>{wouldExceed ? 'Log (Over Limit)' : '1-Tap Log Boarding'}</span>
                      </button>
                    </div>
                    {isQuotaExceeded && (
                      <label className="flex items-center gap-2 text-xs text-[#6B6862] bg-white px-2 py-1.5 rounded-lg border border-[#E8E4DC] cursor-pointer">
                        <input type="checkbox" checked={quotaOverride} onChange={e => setQuotaOverride(e.target.checked)} />
                        <span>Conductor override — allow logging despite exceeded quota (audit logged)</span>
                      </label>
                    )}
                  </>
                )}
                <button onClick={() => startScanner()} className="anavandi-btn-secondary w-full text-xs py-2">Scan Next Student</button>
              </div>
            </div>
          ) : (
            <div className="anavandi-card overflow-hidden bg-[#FAECE8] border-2 border-[#B3492F] p-8 text-center space-y-5 shadow-sm">
              <div className="w-16 h-16 rounded-full bg-[#B3492F] text-white flex items-center justify-center mx-auto shadow-sm"><XCircle className="w-10 h-10" /></div>
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-[#B3492F] bg-white/80 px-3 py-1 rounded-full border border-[#B3492F]/30">INVALID CONCESSION PASS</span>
                <h2 className="text-lg font-bold text-[#1F1E1D] mt-3">Pass Verification Rejected</h2>
                <p className="text-xs text-[#B3492F] font-medium mt-1">{scanResult.reason}</p>
              </div>
              <div className="bg-white p-4 rounded-xl border border-[#E8E4DC] text-xs text-[#6B6862]">Possible counterfeit, expired validity, or stale screenshot. Daily HMAC check failed or Ed25519 signature invalid. Direct passenger to standard ticket.</div>
              <button onClick={() => startScanner()} className="anavandi-btn-primary w-full py-2.5 text-xs bg-[#B3492F] hover:bg-[#993e27]">Scan Next Passenger</button>
            </div>
          )
        ) : isScanning ? (
          <div className="space-y-3">
            <div className="anavandi-card overflow-hidden bg-black p-2 relative rounded-2xl">
              <div id={scannerContainerId} className="w-full rounded-xl overflow-hidden min-h-[300px] bg-black" />
            </div>
            {cameras.length > 1 && (
              <div className="flex items-center gap-2 bg-white border border-[#E8E4DC] rounded-lg p-2">
                <SwitchCamera className="w-4 h-4 text-[#6B6862]" />
                <select value={selectedCameraId || ''} onChange={e => { setSelectedCameraId(e.target.value); startScanner(e.target.value) }} className="flex-1 text-xs bg-transparent outline-none">
                  {cameras.map(c => <option key={c.id} value={c.id}>{c.label || `Camera ${c.id.slice(0,6)}`}</option>)}
                </select>
              </div>
            )}
            <button onClick={stopScanner} className="anavandi-btn-secondary w-full text-xs py-2">Cancel Camera Scanning</button>
          </div>
        ) : (
          <div className="anavandi-card p-6 text-center bg-white border border-[#E8E4DC] space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-[#FAF0EC] text-[#D97757] flex items-center justify-center mx-auto"><Camera className="w-8 h-8" /></div>
            <div>
              <h2 className="text-lg font-bold text-[#1F1E1D]">Conductor Scanner Ready</h2>
              <p className="text-xs text-[#6B6862] max-w-xs mx-auto mt-1">Point at student rotating QR. Offline Ed25519 + HMAC daily-code + daily quota check. Requires HTTPS or localhost for camera.</p>
            </div>
            {cameraError && (
              <div className="p-3 rounded-xl bg-[#FEF7EB] border border-[#C97D1A]/20 text-[11px] text-[#1F1E1D] flex items-start gap-2 text-left">
                <AlertTriangle className="w-4 h-4 text-[#C97D1A] flex-shrink-0 mt-0.5" /><span>{cameraError}</span>
              </div>
            )}
            <button onClick={() => startScanner()} className="anavandi-btn-primary w-full py-3.5 text-sm font-semibold flex items-center justify-center gap-2 shadow-sm">
              <Camera className="w-5 h-5" /><span>Launch Camera Scanner</span>
            </button>

            <div className="relative py-1">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-[#E8E4DC]" /></div>
              <div className="relative flex justify-center"><span className="bg-white px-2 text-[11px] text-[#6B6862]">or upload QR image</span></div>
            </div>

            <div className="flex gap-2">
              <label className="flex-1 anavandi-btn-secondary text-xs py-2.5 flex items-center justify-center gap-1.5 cursor-pointer">
                <Upload className="w-4 h-4" /><span>Choose QR Image</span>
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileScan} />
              </label>
              {cameras.length === 0 && (
                <button onClick={enumerateCameras} className="anavandi-btn-secondary text-xs px-3 py-2.5">Detect Cameras</button>
              )}
            </div>
            <p className="text-[10px] text-[#99958D]">Tip: On desktop without camera, use simulator below or upload a screenshot of the student QR.</p>
          </div>
        )}
      </div>

      <div className="mt-4 pt-4 border-t border-[#E8E4DC] space-y-2">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-[#6B6862]"><Sparkles className="w-3.5 h-3.5 text-[#D97757]" /><span>Quick Simulator (Instant Test Scenarios):</span></div>
        <div className="grid grid-cols-3 gap-2">
          <button onClick={testValidPass} className="p-2 rounded-lg bg-[#EFF5ED] border border-[#4F7942]/30 text-[#4F7942] hover:bg-[#4F7942] hover:text-white transition-colors text-xs font-medium">✓ Valid Pass</button>
          <button onClick={testExpiredScreenshot} className="p-2 rounded-lg bg-[#FEF7EB] border border-[#C97D1A]/30 text-[#C97D1A] hover:bg-[#C97D1A] hover:text-white transition-colors text-xs font-medium">✗ Stale Code</button>
          <button onClick={testFakePass} className="p-2 rounded-lg bg-[#FAECE8] border border-[#B3492F]/30 text-[#B3492F] hover:bg-[#B3492F] hover:text-white transition-colors text-xs font-medium">✗ Counterfeit</button>
        </div>
      </div>
    </div>
  )
}
