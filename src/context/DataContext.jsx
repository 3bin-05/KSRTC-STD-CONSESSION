import { createContext, useContext, useState, useEffect } from 'react'
import { 
  db, 
  collection, 
  onSnapshot,
  addDoc, 
  doc, 
  updateDoc, 
  setDoc,
  isConfigured 
} from '../lib/firebase'
import { signPassPayload } from '../lib/crypto'

const DataContext = createContext(null)

const INITIAL_INSTITUTIONS = [
  { id: 'inst-1', name: 'Government Engineering College Barton Hill', domain: 'gecbh.ac.in', active: true, district: 'Thiruvananthapuram' },
  { id: 'inst-2', name: 'College of Engineering Trivandrum (CET)', domain: 'cet.ac.in', active: true, district: 'Thiruvananthapuram' },
  { id: 'inst-3', name: 'Mar Ivanios College', domain: 'marivanioscollege.ac.in', active: true, district: 'Thiruvananthapuram' },
  { id: 'inst-4', name: 'Government Model Engineering College (MEC)', domain: 'mec.ac.in', active: true, district: 'Ernakulam' },
]

const INITIAL_CONDUCTORS = [
  { id: 'cond-1', name: 'Suresh Kumar', email: 'conductor104@ksrtc.gov.in', depot: 'Trivandrum Central', active: true },
  { id: 'cond-2', name: 'Ratheesh K.', email: 'conductor210@ksrtc.gov.in', depot: 'Attingal Depot', active: true },
]

export function DataProvider({ children }) {
  const [institutions, setInstitutions] = useState(() => {
    const saved = localStorage.getItem('anavandi_institutions')
    return saved ? JSON.parse(saved) : INITIAL_INSTITUTIONS
  })

  const [conductors, setConductors] = useState(() => {
    const saved = localStorage.getItem('anavandi_conductors')
    return saved ? JSON.parse(saved) : INITIAL_CONDUCTORS
  })

  const [applications, setApplications] = useState(() => {
    const saved = localStorage.getItem('anavandi_applications')
    return saved ? JSON.parse(saved) : [
      {
        id: 'app-demo-1',
        studentId: 'student-demo-uid',
        studentName: 'Arun Kumar',
        studentEmail: 'arun.kumar@gecbh.ac.in',
        rollNo: 'B21CS104',
        institutionId: 'inst-1',
        institutionName: 'Government Engineering College Barton Hill',
        routeFrom: 'Neyyattinkara',
        routeTo: 'Kunnukuzhy (Barton Hill)',
        distanceKm: 28,
        proofUrl: 'https://images.unsplash.com/photo-1588072432836-e10032774350?w=600&auto=format&fit=crop&q=80',
        photoUrl: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=400&auto=format&fit=crop&q=80',
        status: 'pending_institution',
        submittedAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        history: [{ status: 'pending_institution', actorId: 'student-demo-uid', timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), note: 'Application submitted' }],
      }
    ]
  })

  const [passes, setPasses] = useState(() => {
    const saved = localStorage.getItem('anavandi_passes')
    return saved ? JSON.parse(saved) : []
  })

  const [trips, setTrips] = useState(() => {
    const saved = localStorage.getItem('anavandi_trips')
    return saved ? JSON.parse(saved) : []
  })

  // Helper to merge remote + local by id, preferring the freshest (by history length / timestamps)
  const mergeByIdPreferFresh = (prev, remote, getFreshness) => {
    const map = new Map()
    // Seed with remote first
    remote.forEach(doc => map.set(doc.id, doc))
    prev.forEach(localDoc => {
      const existing = map.get(localDoc.id)
      if (!existing) {
        map.set(localDoc.id, localDoc)
      } else {
        // Both have same id — keep the fresher
        const aFresh = getFreshness(existing)
        const bFresh = getFreshness(localDoc)
        if (bFresh > aFresh) map.set(localDoc.id, localDoc)
      }
    })
    return Array.from(map.values())
  }

  // Live Firestore Real-Time Subscriptions when Firebase is configured
  useEffect(() => {
    if (!isConfigured || !db) return

    const unsubscribes = []

    try {
      // 1. Applications Listener — merges remote + local, keeps optimistic local updates until confirmed
      const unsubApps = onSnapshot(collection(db, 'applications'), (snapshot) => {
        const remoteApps = snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }))
        if (snapshot.empty && remoteApps.length === 0) return
        setApplications(prev => mergeByIdPreferFresh(prev, remoteApps, (doc) => {
          const hLen = Array.isArray(doc.history) ? doc.history.length : 0
          const t = new Date(doc.adminApprovedAt || doc.institutionApprovedAt || doc.submittedAt || 0).getTime()
          return hLen * 1e13 + t
        }))
      }, (err) => console.warn('Firestore Applications sync note:', err.message))
      unsubscribes.push(unsubApps)

      // 2. Passes Listener — merges like applications so optimistic local passes aren't clobbered by stale snapshot
      const unsubPasses = onSnapshot(collection(db, 'passes'), (snapshot) => {
        const remotePasses = snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }))
        if (snapshot.empty && remotePasses.length === 0) return
        setPasses(prev => mergeByIdPreferFresh(prev, remotePasses, (doc) => new Date(doc.createdAt || 0).getTime()))
      }, (err) => console.warn('Firestore Passes sync note:', err.message))
      unsubscribes.push(unsubPasses)

      // 3. Trips Listener
      const unsubTrips = onSnapshot(collection(db, 'trips'), (snapshot) => {
        if (!snapshot.empty) {
          const remoteTrips = snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }))
          setTrips(remoteTrips)
        }
      }, (err) => console.warn('Firestore Trips sync note:', err.message))
      unsubscribes.push(unsubTrips)

      // 4. Institutions Listener
      const unsubInsts = onSnapshot(collection(db, 'institutions'), (snapshot) => {
        if (!snapshot.empty) {
          const remoteInsts = snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }))
          setInstitutions(remoteInsts)
        }
      }, (err) => console.warn('Firestore Institutions sync note:', err.message))
      unsubscribes.push(unsubInsts)

      // 5. Conductors Listener
      const unsubConds = onSnapshot(collection(db, 'conductors'), (snapshot) => {
        if (!snapshot.empty) {
          const remoteConds = snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }))
          setConductors(remoteConds)
        }
      }, (err) => console.warn('Firestore Conductors sync note:', err.message))
      unsubscribes.push(unsubConds)
    } catch (e) {
      console.warn('Firestore listener setup warning:', e)
    }

    return () => {
      unsubscribes.forEach(unsub => {
        if (typeof unsub === 'function') unsub()
      })
    }
  }, [])

  // Sync to LocalStorage as offline cache
  useEffect(() => {
    localStorage.setItem('anavandi_institutions', JSON.stringify(institutions))
  }, [institutions])

  useEffect(() => {
    localStorage.setItem('anavandi_conductors', JSON.stringify(conductors))
  }, [conductors])

  useEffect(() => {
    localStorage.setItem('anavandi_applications', JSON.stringify(applications))
  }, [applications])

  useEffect(() => {
    localStorage.setItem('anavandi_passes', JSON.stringify(passes))
  }, [passes])

  useEffect(() => {
    localStorage.setItem('anavandi_trips', JSON.stringify(trips))
  }, [trips])

  // Helper: create a history entry
  const _historyEntry = (status, actorId, note = '') => ({
    status,
    actorId,
    timestamp: new Date().toISOString(),
    note,
  })

  // --- Student Application Actions ---
  const submitApplication = async (appData) => {
    const newApp = {
      ...appData,
      id: 'app_' + Date.now(),
      status: 'pending_institution',
      submittedAt: new Date().toISOString(),
      history: [_historyEntry('pending_institution', appData.studentId, 'Application submitted')],
    }

    if (isConfigured && db) {
      try {
        const docRef = await addDoc(collection(db, 'applications'), newApp)
        newApp.id = docRef.id
      } catch (e) {
        console.warn('Error submitting application to Firestore:', e)
      }
    }

    setApplications(prev => [newApp, ...prev.filter(a => a.studentId !== appData.studentId || a.status === 'rejected_by_institution' || a.status === 'rejected_by_admin' || a.status === 'rejected')])
    return newApp
  }

  // --- Institution Actions ---
  const approveByInstitution = async (appId, { distanceLimitKm }) => {
    const entry = _historyEntry('pending_admin', 'institution', 'Approved by institution')
    const patch = {
      status: 'pending_admin',
      distanceLimitKm: Number(distanceLimitKm) || 30,
      institutionApprovedAt: new Date().toISOString(),
    }

    if (isConfigured && db) {
      try {
        await updateDoc(doc(db, 'applications', appId), {
          ...patch,
          history: applications.find(a => a.id === appId)
            ? [...(applications.find(a => a.id === appId).history || []), entry]
            : [entry],
        })
      } catch (_e) {
        // Fallback if document key is custom or offline
      }
    }

    setApplications(prev => prev.map(app => {
      if (app.id === appId) {
        return { ...app, ...patch, history: [...(app.history || []), entry] }
      }
      return app
    }))
  }

  const rejectByInstitution = async (appId, reason) => {
    const entry = _historyEntry('rejected_by_institution', 'institution', reason || 'Enrolment proof verification failed')
    const patch = {
      status: 'rejected_by_institution',
      rejectionReason: reason || 'Enrolment proof verification failed',
      rejectedAt: new Date().toISOString(),
      rejectedBy: 'institution',
    }

    if (isConfigured && db) {
      try {
        await updateDoc(doc(db, 'applications', appId), {
          ...patch,
          history: applications.find(a => a.id === appId)
            ? [...(applications.find(a => a.id === appId).history || []), entry]
            : [entry],
        })
      } catch (_e) {
        // Fallback
      }
    }

    setApplications(prev => prev.map(app => {
      if (app.id === appId) {
        return { ...app, ...patch, history: [...(app.history || []), entry] }
      }
      return app
    }))
  }

  // --- Admin Actions ---
  const rejectByAdmin = async (appId, reason) => {
    const entry = _historyEntry('rejected_by_admin', 'admin', reason || 'Application does not meet admin criteria')
    const patch = {
      status: 'rejected_by_admin',
      rejectionReason: reason || 'Application does not meet admin criteria',
      rejectedAt: new Date().toISOString(),
      rejectedBy: 'admin',
    }

    if (isConfigured && db) {
      try {
        await updateDoc(doc(db, 'applications', appId), {
          ...patch,
          history: applications.find(a => a.id === appId)
            ? [...(applications.find(a => a.id === appId).history || []), entry]
            : [entry],
        })
      } catch (_e) {
        // Fallback
      }
    }

    setApplications(prev => prev.map(app => {
      if (app.id === appId) {
        return { ...app, ...patch, history: [...(app.history || []), entry] }
      }
      return app
    }))
  }

  const approveByAdminAndIssuePass = async (appId) => {
    const app = applications.find(a => a.id === appId)
    if (!app) return

    // Generate Pass Details (Phase 6 Signing)
    const validFrom = new Date().toISOString()
    const validUntil = new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString() // 6 months
    const rotationSeed = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)

    const payload = {
      passId: 'PAS-' + Date.now().toString().slice(-6),
      studentId: app.studentId,
      name: app.studentName,
      photoUrl: app.photoUrl || 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=200&auto=format&fit=crop&q=80',
      rollNo: app.rollNo,
      institutionName: app.institutionName,
      route: `${app.routeFrom} ⇄ ${app.routeTo}`,
      routeFrom: app.routeFrom,
      routeTo: app.routeTo,
      distanceLimitKm: app.distanceLimitKm || 30,
      validFrom,
      validUntil,
      rotationSeed,
    }

    const { signature, publicKey } = signPassPayload(payload)

    const newPass = {
      id: payload.passId,
      applicationId: app.id,
      studentId: app.studentId,
      payload,
      signature,
      publicKey,
      createdAt: new Date().toISOString(),
    }

    const approvalEntry = _historyEntry('approved', 'admin', `Pass ${newPass.id} issued`)

    if (isConfigured && db) {
      try {
        await setDoc(doc(db, 'passes', newPass.id), newPass)
        await updateDoc(doc(db, 'applications', appId), {
          status: 'approved',
          passId: newPass.id,
          adminApprovedAt: new Date().toISOString(),
          history: [...(app.history || []), approvalEntry],
        })
      } catch (e) {
        console.warn('Error saving pass to Firestore:', e)
      }
    }

    // Update Application Status in state
    setApplications(prev => prev.map(a => a.id === appId ? { ...a, status: 'approved', passId: newPass.id, history: [...(a.history || []), approvalEntry] } : a))
    setPasses(prev => [newPass, ...prev.filter(p => p.studentId !== app.studentId)])
    return newPass
  }

  // --- Resubmission: create fresh app from rejected one ---
  const resubmitApplication = async (rejectedAppId, updatedData = {}) => {
    const rejected = applications.find(a => a.id === rejectedAppId)
    if (!rejected) return null

    const newApp = {
      id: 'app_' + Date.now(),
      studentId: rejected.studentId,
      studentName: updatedData.studentName || rejected.studentName,
      studentEmail: updatedData.studentEmail || rejected.studentEmail,
      rollNo: updatedData.rollNo || rejected.rollNo,
      institutionId: updatedData.institutionId || rejected.institutionId,
      institutionName: updatedData.institutionName || rejected.institutionName,
      routeFrom: updatedData.routeFrom || rejected.routeFrom,
      routeTo: updatedData.routeTo || rejected.routeTo,
      distanceKm: updatedData.distanceKm || rejected.distanceKm,
      proofUrl: updatedData.proofUrl || rejected.proofUrl,
      photoUrl: updatedData.photoUrl || rejected.photoUrl,
      status: 'pending_institution',
      submittedAt: new Date().toISOString(),
      previousApplicationId: rejectedAppId,
      history: [_historyEntry('pending_institution', rejected.studentId, `Resubmitted from ${rejectedAppId}`)],
    }

    if (isConfigured && db) {
      try {
        const docRef = await addDoc(collection(db, 'applications'), newApp)
        newApp.id = docRef.id
      } catch (e) {
        console.warn('Error resubmitting application to Firestore:', e)
      }
    }

    setApplications(prev => [newApp, ...prev])
    return newApp
  }

  const addInstitution = async (instData) => {
    const newInst = {
      id: 'inst-' + Date.now(),
      active: true,
      ...instData,
    }

    if (isConfigured && db) {
      try {
        const docRef = await addDoc(collection(db, 'institutions'), newInst)
        newInst.id = docRef.id
      } catch (e) {
        console.warn('Error adding institution to Firestore:', e)
      }
    }

    setInstitutions(prev => [newInst, ...prev])
    return newInst
  }

  const toggleInstitution = async (id) => {
    const target = institutions.find(i => i.id === id)
    if (!target) return
    const newStatus = !target.active

    if (isConfigured && db) {
      try {
        await updateDoc(doc(db, 'institutions', id), { active: newStatus })
      } catch (_e) {
        // Fallback
      }
    }

    setInstitutions(prev => prev.map(inst => inst.id === id ? { ...inst, active: newStatus } : inst))
  }

  const addConductor = async (condData) => {
    const newCond = {
      id: 'cond-' + Date.now(),
      active: true,
      ...condData,
    }

    if (isConfigured && db) {
      try {
        const docRef = await addDoc(collection(db, 'conductors'), newCond)
        newCond.id = docRef.id
      } catch (e) {
        console.warn('Error adding conductor to Firestore:', e)
      }
    }

    setConductors(prev => [newCond, ...prev])
    return newCond
  }

  const toggleConductor = async (id) => {
    const target = conductors.find(c => c.id === id)
    if (!target) return
    const newStatus = !target.active

    if (isConfigured && db) {
      try {
        await updateDoc(doc(db, 'conductors', id), { active: newStatus })
      } catch (_e) {
        // Fallback
      }
    }

    setConductors(prev => prev.map(c => c.id === id ? { ...c, active: newStatus } : c))
  }

  // --- Conductor Trip Logging ---
  const logTrip = async (tripData) => {
    const newTrip = {
      id: 'trip-' + Date.now(),
      timestamp: new Date().toISOString(),
      synced: true,
      ...tripData,
    }

    if (isConfigured && db) {
      try {
        const docRef = await addDoc(collection(db, 'trips'), newTrip)
        newTrip.id = docRef.id
      } catch (e) {
        console.warn('Error logging trip to Firestore:', e)
      }
    }

    setTrips(prev => [newTrip, ...prev])
    return newTrip
  }

  return (
    <DataContext.Provider
      value={{
        institutions,
        conductors,
        applications,
        passes,
        trips,
        submitApplication,
        approveByInstitution,
        rejectByInstitution,
        rejectByAdmin,
        approveByAdminAndIssuePass,
        resubmitApplication,
        addInstitution,
        toggleInstitution,
        addConductor,
        toggleConductor,
        logTrip,
      }}
    >
      {children}
    </DataContext.Provider>
  )
}

export function useData() {
  const context = useContext(DataContext)
  if (!context) {
    throw new Error('useData must be used within a DataProvider')
  }
  return context
}
