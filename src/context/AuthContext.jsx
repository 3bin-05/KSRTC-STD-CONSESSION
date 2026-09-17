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

// Default seed demo users for instant testing across all 4 roles
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
  const [currentUser, setCurrentUser] = useState(() => {
    const saved = localStorage.getItem('anavandi_active_user')
    return saved ? JSON.parse(saved) : DEMO_ACCOUNTS[0] // Start as student by default
  })
  const [loading, setLoading] = useState(false)

  // Sync to local storage
  useEffect(() => {
    if (currentUser) {
      localStorage.setItem('anavandi_active_user', JSON.stringify(currentUser))
    } else {
      localStorage.removeItem('anavandi_active_user')
    }
  }, [currentUser])

  // Real Firebase Auth listener if active
  useEffect(() => {
    if (!isConfigured || !auth) return

    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser) {
        try {
          const userDocRef = doc(db, 'users', fbUser.uid)
          const userDoc = await getDoc(userDocRef)
          if (userDoc.exists()) {
            setCurrentUser({ uid: fbUser.uid, ...userDoc.data() })
          } else {
            // New user defaults to student
            const newUser = {
              uid: fbUser.uid,
              email: fbUser.email,
              displayName: fbUser.displayName || fbUser.email.split('@')[0],
              role: 'student',
              createdAt: new Date().toISOString(),
            }
            await setDoc(userDocRef, newUser)
            setCurrentUser(newUser)
          }
        } catch (e) {
          console.error('Error fetching user profile:', e)
        }
      }
    })

    return unsubscribe
  }, [])

  // Login handler
  const login = async (email, password) => {
    setLoading(true)
    try {
      if (isConfigured && auth) {
        const cred = await signInWithEmailAndPassword(auth, email, password)
        const userDoc = await getDoc(doc(db, 'users', cred.user.uid))
        const userData = userDoc.exists() ? userDoc.data() : { role: 'student' }
        setCurrentUser({ uid: cred.user.uid, email, ...userData })
      } else {
        // Find in demo accounts or create custom session
        const found = DEMO_ACCOUNTS.find(a => a.email.toLowerCase() === email.toLowerCase())
        if (found) {
          setCurrentUser(found)
        } else {
          // Custom student email login
          const domain = email.split('@')[1] || ''
          const newCustomUser = {
            uid: 'usr_' + Date.now(),
            email,
            displayName: email.split('@')[0],
            role: 'student',
            domain,
          }
          setCurrentUser(newCustomUser)
        }
      }
    } finally {
      setLoading(false)
    }
  }

  // Register Student handler
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
        setCurrentUser(userData)
      } else {
        const newStudent = {
          uid: 'student_' + Date.now(),
          email,
          displayName,
          rollNo,
          institutionId,
          institutionName,
          role: 'student',
          photoUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${displayName}`,
          createdAt: new Date().toISOString(),
        }
        setCurrentUser(newStudent)
      }
    } finally {
      setLoading(false)
    }
  }

  // Google Sign-In for Student
  const loginWithGoogle = async () => {
    setLoading(true)
    try {
      if (isConfigured && auth) {
        const provider = new GoogleAuthProvider()
        const cred = await signInWithPopup(auth, provider)
        const userDocRef = doc(db, 'users', cred.user.uid)
        const userDoc = await getDoc(userDocRef)
        if (userDoc.exists()) {
          setCurrentUser({ uid: cred.user.uid, ...userDoc.data() })
        } else {
          const newUser = {
            uid: cred.user.uid,
            email: cred.user.email,
            displayName: cred.user.displayName,
            photoUrl: cred.user.photoURL,
            role: 'student',
            createdAt: new Date().toISOString(),
          }
          await setDoc(userDocRef, newUser)
          setCurrentUser(newUser)
        }
      } else {
        // Demo Google sign-in
        const googleDemoUser = {
          uid: 'student_google_' + Date.now(),
          email: 'kiran.v@gecbh.ac.in',
          displayName: 'Kiran Varma',
          role: 'student',
          rollNo: 'B22CS089',
          institutionId: 'inst-1',
          institutionName: 'Government Engineering College Barton Hill',
          photoUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80',
        }
        setCurrentUser(googleDemoUser)
      }
    } finally {
      setLoading(false)
    }
  }

  const switchRoleDemo = (roleOrAccount) => {
    if (typeof roleOrAccount === 'string') {
      const found = DEMO_ACCOUNTS.find(a => a.role === roleOrAccount)
      if (found) setCurrentUser(found)
    } else {
      setCurrentUser(roleOrAccount)
    }
  }

  const logout = async () => {
    if (isConfigured && auth) {
      await fbSignOut(auth)
    }
    setCurrentUser(null)
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
