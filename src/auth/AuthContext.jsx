import { createContext, useContext, useEffect, useState } from 'react'
import { getMeRequest, loginRequest } from '../services/authService'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loadingSession, setLoadingSession] = useState(true)

  useEffect(() => {
    async function loadSession() {
      const token = localStorage.getItem('accessToken')

      if (!token) {
        setLoadingSession(false)
        return
      }

      try {
        const currentUser = await getMeRequest()
        setUser(currentUser)
      } catch {
        localStorage.removeItem('accessToken')
        setUser(null)
      } finally {
        setLoadingSession(false)
      }
    }

    loadSession()
  }, [])

  async function login(credentials) {
    const data = await loginRequest(credentials)

    localStorage.setItem('accessToken', data.accessToken)
    setUser(data.user)

    return data.user
  }

  function logout() {
    localStorage.removeItem('accessToken')
    setUser(null)
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        logout,
        loadingSession,
        isAuthenticated: Boolean(user),
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}