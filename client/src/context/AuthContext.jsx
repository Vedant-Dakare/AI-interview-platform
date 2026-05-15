import { createContext, useContext, useMemo, useState, useEffect, useCallback } from 'react'
import { getCurrentUser, logout as apiLogout } from '../services/authApi'

const AuthContext = createContext(null)

function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [isInitializing, setIsInitializing] = useState(true)

  const refreshSession = useCallback(async () => {
    try {
      const response = await getCurrentUser()
      const currentUser = response?.data?.user || null
      setUser(currentUser)
      if (currentUser) {
        console.log('[Auth] Session restored', { userId: currentUser.id, provider: currentUser.provider })
      }
    } catch {
      setUser(null)
      console.warn('[Auth] No active session')
    } finally {
      setIsInitializing(false)
    }
  }, [])

  useEffect(() => {
    refreshSession()
  }, [refreshSession])

  const setSession = (authPayload) => {
    if (!authPayload?.user) {
      return
    }

    setUser(authPayload.user)
  }

  const logout = async () => {
    await apiLogout()
    setUser(null)
  }

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: Boolean(user),
      isInitializing,
      setSession,
      logout,
      refreshSession,
    }),
    [user, isInitializing, refreshSession],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export { AuthProvider, useAuth }
