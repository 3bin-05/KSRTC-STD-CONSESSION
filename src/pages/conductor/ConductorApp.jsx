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
  Sparkles 
} from 'lucide-react'

export default function ConductorApp() {
  const { currentUser } = useAuth()
  const { passes, trips, logTrip } = useData()

  const [isScanning, setIsScanning] = useState(false)
  const [scanResult, setScanResult] = useState(null) // { verified: boolean, reason?: string, payload?: object }
  const [tripLogged, setTripLogged] = useState(false)
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [cameraError, setCameraError] = useState(null)
  const [offlineQueueCount, setOfflineQueueCount] = useState(0)

  const html5QrCodeRef = useRef(null)
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

  // Start Camera Scanner
  const startScanner = async () => {
    setCameraError(null)
    setScanResult(null)
    setTripLogged(false)
    setIsScanning(true)

    try {
      if (html5QrCodeRef.current) {
        try {
          await html5QrCodeRef.current.stop()
        } catch (_e) {
          // ignore
        }
      }

      const qrCodeScanner = new Html5Qrcode(scannerContainerId)
      html5QrCodeRef.current = qrCodeScanner

      await qrCodeScanner.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: 260, height: 260 },
          aspectRatio: 1.0,
        },
        (decodedText) => {
          handleScanSuccess(decodedText)
        },
        (_errorMessage) => {
          // Continuous scanning ignore
        }
      )
    } catch (err) {
      console.warn('Camera scan failed to start:', err)
      setCameraError('Camera access not granted or not available. You can use the Quick Test Simulator below.')
      setIsScanning(false)
    }
  }

  const stopScanner = async () => {
    if (html5QrCodeRef.current) {
      try {
        await html5QrCodeRef.current.stop()
        html5QrCodeRef.current.clear()
      } catch (_e) {
        // ignore
      }
      html5QrCodeRef.current = null
    }
    setIsScanning(false)
  }

  const handleScanSuccess = async (qrData) => {
    await stopScanner()
    const verification = verifyPassQR(qrData)
    if (verification.valid) {
      setScanResult({
        verified: true,
        payload: verification.payload,
        reason: 'Pass Cryptographically Valid',
      })
    } else {
      setScanResult({
        verified: false,
        reason: verification.reason || 'Verification Failed',
      })
    }
  }

  // Calculate student trips for the scanned pass to show remaining allowance
  const scannedPassStudentTrips = (scanResult?.payload?.studentId)
    ? trips.filter(t => t.studentId === scanResult.payload.studentId)
    : []

  const todayStr = new Date().toISOString().split('T')[0]
  const todayUsedKm = scannedPassStudentTrips
    .filter(t => t.timestamp && t.timestamp.startsWith(todayStr))
    .reduce((sum, t) => sum + (Number(t.distanceKm) || 0), 0)

  const distanceLimit = scanResult?.payload?.distanceLimitKm || 30
  const remainingKm = Math.max(0, distanceLimit - todayUsedKm)

  // 1-Tap Log Trip Action
  const handleLogTrip = async () => {
    if (!scanResult?.payload) return
    const tripData = {
      passId: scanResult.payload.passId,
      studentId: scanResult.payload.studentId,
      studentName: scanResult.payload.name,
      route: scanResult.payload.route,
      distanceKm: Math.round(distanceLimit / 2) || 15,
      conductorId: currentUser?.uid || 'cond-1',
      conductorName: currentUser?.displayName || 'Suresh Kumar',
      timestamp: new Date().toISOString(),
    }

    if (!isOnline) {
      // Offline queue simulation
      setOfflineQueueCount(prev => prev + 1)
    }

    await logTrip(tripData)
    setTripLogged(true)
  }

  // Quick Demo Simulator Handlers (allows verifying with 1 click without camera)
  const testValidPass = () => {
    const validPass = passes[0]
    if (validPass) {
      const qrData = generateStudentQRData(validPass)
      handleScanSuccess(qrData)
    } else {
      alert('No active issued pass found. Please approve an application in Admin portal first!')
    }
  }

  const testFakePass = () => {
    const fakePass = {
      p: {
        passId: 'PAS-999999',
        studentId: 'fake-uid',
        name: 'Counterfeit Pass User',
        route: 'Ernakulam ➔ Aluva',
        validFrom: new Date().toISOString(),
        validUntil: new Date(Date.now() + 1000000).toISOString(),
        rotationSeed: 'fake_seed',
      },
      s: 'invalid_forged_signature_base64_string',
      c: 'FAKECD',
      t: Date.now(),
    }
    handleScanSuccess(JSON.stringify(fakePass))
  }

  const testExpiredScreenshot = () => {
    const validPass = passes[0]
    if (validPass) {
      // Provide valid signature but expired yesterday's daily code
      const qrObject = {
        p: validPass.payload,
        s: validPass.signature,
        c: 'OLD999', // invalid daily code
        t: Date.now() - 86400000,
      }
      handleScanSuccess(JSON.stringify(qrObject))
    } else {
      alert('No active pass found in system to test')
    }
  }

  return (
    <div className="max-w-lg mx-auto min-h-[75vh] flex flex-col justify-between">
      {/* Network Status & Quick Bar */}
      <div className="flex items-center justify-between pb-3 border-b border-[#E8E4DC]">
        <div className="flex items-center gap-2">
          <Bus className="w-4 h-4 text-[#D97757]" />
          <span className="text-xs font-bold text-[#1F1E1D]">Conductor Terminal</span>
        </div>
        <div className="flex items-center gap-2 text-[11px]">
          {isOnline ? (
            <span className="flex items-center gap-1 text-[#4F7942] font-medium">
              <Wifi className="w-3.5 h-3.5" /> Online
            </span>
          ) : (
            <span className="flex items-center gap-1 text-[#C97D1A] font-medium">
              <WifiOff className="w-3.5 h-3.5" /> Offline Mode ({offlineQueueCount} queued)
            </span>
          )}
        </div>
      </div>

      {/* Main Scan Viewport / Result Screens */}
      <div className="my-auto py-4">
        {/* State 1: Verification Result Display (High Contrast Fast Decision Screens) */}
        {scanResult ? (
          scanResult.verified ? (
            /* SUCCESS: Large Green Screen (<500ms decision) */
            <div className="anavandi-card overflow-hidden bg-[#EFF5ED] border-2 border-[#4F7942] p-6 text-center space-y-4 shadow-sm animate-in fade-in">
              <div className="w-16 h-16 rounded-full bg-[#4F7942] text-white flex items-center justify-center mx-auto shadow-sm">
                <Check className="w-10 h-10 stroke-[3]" />
              </div>

              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-[#4F7942] bg-white/80 px-2.5 py-0.5 rounded-full border border-[#4F7942]/30">
                  PASS VERIFIED • GENUINE
                </span>
                <h2 className="text-xl font-bold text-[#1F1E1D] mt-2">
                  {scanResult.payload.name}
                </h2>
                <p className="text-xs text-[#6B6862]">
                  {scanResult.payload.institutionName} • Roll {scanResult.payload.rollNo}
                </p>
              </div>

              {/* Photo & Route */}
              <div className="flex items-center gap-3 bg-white p-3 rounded-xl border border-[#E8E4DC] text-left">
                <img
                  src={scanResult.payload.photoUrl || 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=200&auto=format&fit=crop&q=80'}
                  alt={scanResult.payload.name}
                  className="w-14 h-14 rounded-lg object-cover border border-[#E8E4DC]"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-[#1F1E1D] flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-[#D97757]" />
                    {scanResult.payload.route}
                  </p>
                  <p className="text-[11px] text-[#6B6862] mt-0.5">
                    Valid till {new Date(scanResult.payload.validUntil).toLocaleDateString()}
                  </p>
                </div>
              </div>

              {/* Distance Allowance Today */}
              <div className="bg-white p-3 rounded-xl border border-[#E8E4DC] flex items-center justify-between text-xs">
                <span className="text-[#6B6862]">Remaining Today (as of last sync):</span>
                <span className="font-bold text-[#1F1E1D] text-sm">{remainingKm} / {distanceLimit} km</span>
              </div>

              {/* One-Tap Log Trip */}
              <div className="pt-2 space-y-2">
                {tripLogged ? (
                  <div className="p-2.5 rounded-lg bg-[#4F7942] text-white text-xs font-semibold flex items-center justify-center gap-2">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Trip Logged Successfully!</span>
                  </div>
                ) : (
                  <button
                    onClick={handleLogTrip}
                    className="anavandi-btn-primary w-full py-3 text-sm flex items-center justify-center gap-2 bg-[#1F1E1D] hover:bg-[#333230]"
                  >
                    <Bus className="w-4 h-4" />
                    <span>1-Tap Log This Boarding</span>
                  </button>
                )}

                <button
                  onClick={startScanner}
                  className="anavandi-btn-secondary w-full text-xs py-2"
                >
                  Scan Next Student
                </button>
              </div>
            </div>
          ) : (
            /* FAILURE: Large Red Screen */
            <div className="anavandi-card overflow-hidden bg-[#FAECE8] border-2 border-[#B3492F] p-8 text-center space-y-5 shadow-sm">
              <div className="w-16 h-16 rounded-full bg-[#B3492F] text-white flex items-center justify-center mx-auto shadow-sm">
                <XCircle className="w-10 h-10" />
              </div>

              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-[#B3492F] bg-white/80 px-3 py-1 rounded-full border border-[#B3492F]/30">
                  INVALID CONCESSION PASS
                </span>
                <h2 className="text-lg font-bold text-[#1F1E1D] mt-3">
                  Pass Verification Rejected
                </h2>
                <p className="text-xs text-[#B3492F] font-medium mt-1">
                  {scanResult.reason}
                </p>
              </div>

              <div className="bg-white p-4 rounded-xl border border-[#E8E4DC] text-xs text-[#6B6862]">
                Possible counterfeit pass, expired validity, or stale screenshot. Direct passenger to standard ordinary ticket.
              </div>

              <button
                onClick={startScanner}
                className="anavandi-btn-primary w-full py-2.5 text-xs bg-[#B3492F] hover:bg-[#993e27]"
              >
                Scan Next Passenger
              </button>
            </div>
          )
        ) : isScanning ? (
          /* State 2: Camera Viewport */
          <div className="space-y-4">
            <div className="anavandi-card overflow-hidden bg-black p-2 relative rounded-2xl">
              <div id={scannerContainerId} className="w-full rounded-xl overflow-hidden min-h-[300px]" />
            </div>

            <button
              onClick={stopScanner}
              className="anavandi-btn-secondary w-full text-xs py-2"
            >
              Cancel Camera Scanning
            </button>
          </div>
        ) : (
          /* State 3: Ready to Scan Idle State */
          <div className="anavandi-card p-8 text-center bg-white border border-[#E8E4DC] space-y-5">
            <div className="w-16 h-16 rounded-2xl bg-[#FAF0EC] text-[#D97757] flex items-center justify-center mx-auto">
              <Camera className="w-8 h-8" />
            </div>

            <div>
              <h2 className="text-lg font-bold text-[#1F1E1D]">
                Conductor Scanner Ready
              </h2>
              <p className="text-xs text-[#6B6862] max-w-xs mx-auto mt-1">
                Point at student rotating QR pass. Works completely offline with Ed25519 signature checks.
              </p>
            </div>

            {cameraError && (
              <div className="p-3 rounded-xl bg-[#FEF7EB] border border-[#C97D1A]/20 text-[11px] text-[#1F1E1D] flex items-start gap-2 text-left">
                <AlertTriangle className="w-4 h-4 text-[#C97D1A] flex-shrink-0 mt-0.5" />
                <span>{cameraError}</span>
              </div>
            )}

            <button
              onClick={startScanner}
              className="anavandi-btn-primary w-full py-3.5 text-sm font-semibold flex items-center justify-center gap-2 shadow-sm"
            >
              <Camera className="w-5 h-5" />
              <span>Launch Camera Scanner</span>
            </button>
          </div>
        )}
      </div>

      {/* Simulator Tools for Instant Testing */}
      <div className="mt-4 pt-4 border-t border-[#E8E4DC] space-y-2">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-[#6B6862]">
          <Sparkles className="w-3.5 h-3.5 text-[#D97757]" />
          <span>Quick Simulator (Instant Test Scenarios):</span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={testValidPass}
            className="p-2 rounded-lg bg-[#EFF5ED] border border-[#4F7942]/30 text-[#4F7942] hover:bg-[#4F7942] hover:text-white transition-colors text-xs font-medium"
          >
            ✓ Valid Pass
          </button>
          <button
            onClick={testExpiredScreenshot}
            className="p-2 rounded-lg bg-[#FEF7EB] border border-[#C97D1A]/30 text-[#C97D1A] hover:bg-[#C97D1A] hover:text-white transition-colors text-xs font-medium"
          >
            ✗ Stale Code
          </button>
          <button
            onClick={testFakePass}
            className="p-2 rounded-lg bg-[#FAECE8] border border-[#B3492F]/30 text-[#B3492F] hover:bg-[#B3492F] hover:text-white transition-colors text-xs font-medium"
          >
            ✗ Counterfeit
          </button>
        </div>
      </div>
    </div>
  )
}
