import { createContext, useContext, useState, useEffect } from 'react'
import { 
  auth, 
  db, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut as fbSignOut, 
  onAuthStateChanged,
  doc, 
  getDoc, 
  setDoc,
  isConfigured
} from '../lib/firebase'

const AuthContext = createContext(null)

// Demo accounts — only used when Firebase is NOT configured (offline/demo mode)
export const DEMO_ACCOUNTS = [
  {
    uid: 'student-demo-uid',
    email: 'arun.kumar@gecbh.ac.in',
    displayName: 'Arun Kumar',
    role: 'student',
    rollNo: 'B21CS104',
    institutionId: 'inst-1',
    institutionName: 'Government Engineering College Barton Hill',
    photoUrl: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=200&auto=format&fit=crop&q=80',
  },
  {
    uid: 'inst-demo-uid',
    email: 'principal@gecbh.ac.in',
    displayName: 'GEC Barton Hill (Verification Officer)',
    role: 'institution',
    institutionId: 'inst-1',
    institutionName: 'Government Engineering College Barton Hill',
    institutionDomain: 'gecbh.ac.in',
  },
  {
    uid: 'conductor-demo-uid',
    email: 'conductor104@ksrtc.gov.in',
    displayName: 'Suresh Kumar (Conductor #104)',
    role: 'conductor',
    depot: 'Trivandrum Central',
  },
  {
    uid: 'admin-demo-uid',
    email: 'admin@ksrtc.kerala.gov.in',
    displayName: 'KSRTC Chief Traffic Officer',
    role: 'admin',
    department: 'Student Concession Section',
  },
]

export function AuthProvider({ children }) {
  // Always start null — auth state is resolved by Firebase listener or explicit login
  const [currentUser, setCurrentUser] = useState(null)
  // loading=true while we check Firebase Auth session (prevents flash to /login)
  const [loading, setLoading] = useState(true)

  // Firebase Auth state listener — the single source of truth for logged-in state
  useEffect(() => {
    if (isConfigured && auth) {
      // With real Firebase: wait for Auth SDK to restore session
      const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
        if (fbUser) {
          try {
            const userDocRef = doc(db, 'users', fbUser.uid)
            const userDoc = await getDoc(userDocRef)
            if (userDoc.exists()) {
              setCurrentUser({ uid: fbUser.uid, ...userDoc.data() })
            } else {
              // New Firebase user — create their Firestore profile
              const newUser = {
                uid: fbUser.uid,
                email: fbUser.email,
                displayName: fbUser.displayName || fbUser.email.split('@')[0],
                photoUrl: fbUser.photoURL || null,
                role: 'student',
                createdAt: new Date().toISOString(),
              }
              await setDoc(userDocRef, newUser)
              setCurrentUser(newUser)
            }
          } catch (e) {
            console.error('Error fetching user profile:', e)
            setCurrentUser(null)
          }
        } else {
          // Firebase says no user is logged in
          setCurrentUser(null)
        }
        // Auth check complete — stop showing loading spinner
        setLoading(false)
      })
      return unsubscribe
    } else {
      // Demo mode (no Firebase configured) — check if user previously logged in via demo login
      const saved = localStorage.getItem('anavandi_demo_session')
      if (saved) {
        try {
          setCurrentUser(JSON.parse(saved))
        } catch (_e) {
          setCurrentUser(null)
        }
      }
      setLoading(false)
    }
  }, [])

  // Persist demo sessions to localStorage (only in demo mode)
  useEffect(() => {
    if (isConfigured) return // Firebase handles its own session persistence
    if (currentUser) {
      localStorage.setItem('anavandi_demo_session', JSON.stringify(currentUser))
    } else {
      localStorage.removeItem('anavandi_demo_session')
    }
  }, [currentUser])

  // --- Login ---
  const login = async (email, password) => {
    setLoading(true)
    try {
      if (isConfigured && auth) {
        // Real Firebase login — onAuthStateChanged above will set currentUser
        await signInWithEmailAndPassword(auth, email, password)
        // Don't call setCurrentUser here — the listener handles it
      } else {
        // Demo mode: match against demo accounts
        const found = DEMO_ACCOUNTS.find(a => a.email.toLowerCase() === email.toLowerCase())
        if (found) {
          setCurrentUser(found)
        } else {
          throw new Error('Account not found. Use one of the demo emails shown on the login page.')
        }
      }
    } finally {
      setLoading(false)
    }
  }

  // --- Register Student ---
  const registerStudent = async ({ email, password, displayName, rollNo, institutionId, institutionName }) => {
    setLoading(true)
    try {
      if (isConfigured && auth) {
        const cred = await createUserWithEmailAndPassword(auth, email, password)
        const userData = {
          uid: cred.user.uid,
          email,
          displayName,
          rollNo,
          institutionId,
          institutionName,
          role: 'student',
          createdAt: new Date().toISOString(),
        }
        await setDoc(doc(db, 'users', cred.user.uid), userData)
        // onAuthStateChanged will pick this up and set currentUser
      } else {
        // Demo mode: create a local student session
        const newStudent = {
          uid: 'student_' + Date.now(),
          email,
          displayName,
          rollNo,
          institutionId,
          institutionName,
          role: 'student',
          photoUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(displayName)}`,
          createdAt: new Date().toISOString(),
        }
        setCurrentUser(newStudent)
      }
    } finally {
      setLoading(false)
    }
  }

  // --- Google Sign-In ---
  const loginWithGoogle = async () => {
    setLoading(true)
    try {
      if (isConfigured && auth) {
        const provider = new GoogleAuthProvider()
        provider.setCustomParameters({ prompt: 'select_account' })
        await signInWithPopup(auth, provider)
        // onAuthStateChanged handles setCurrentUser
      } else {
        // Demo Google sign-in
        setCurrentUser({
          uid: 'student_google_' + Date.now(),
          email: 'kiran.v@gecbh.ac.in',
          displayName: 'Kiran Varma',
          role: 'student',
          rollNo: 'B22CS089',
          institutionId: 'inst-1',
          institutionName: 'Government Engineering College Barton Hill',
          photoUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80',
        })
      }
    } finally {
      setLoading(false)
    }
  }

  // --- Demo Role Switcher (only relevant after user has logged in) ---
  const switchRoleDemo = (roleOrAccount) => {
    if (typeof roleOrAccount === 'string') {
      const found = DEMO_ACCOUNTS.find(a => a.role === roleOrAccount)
      if (found) setCurrentUser(found)
    } else {
      setCurrentUser(roleOrAccount)
    }
  }

  // --- Logout ---
  const logout = async () => {
    if (isConfigured && auth) {
      await fbSignOut(auth)
      // onAuthStateChanged will set currentUser to null
    } else {
      setCurrentUser(null)
    }
    localStorage.removeItem('anavandi_demo_session')
  }

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        loading,
        login,
        registerStudent,
        loginWithGoogle,
        logout,
        switchRoleDemo,
        DEMO_ACCOUNTS,
        isConfigured,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
