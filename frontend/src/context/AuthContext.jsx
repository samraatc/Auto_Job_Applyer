import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { apiJson, api } from '../api/client'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser]         = useState(null)      // { username, email, role }
  const [authChecked, setAuthChecked] = useState(false)

  const fetchMe = useCallback(async () => {
    try {
      const data = await apiJson('/api/auth/me')
      setUser(data)
    } catch {
      setUser(null)
    } finally {
      setAuthChecked(true)
    }
  }, [])

  useEffect(() => {
    fetchMe()
    const onUnauth = () => setUser(null)
    window.addEventListener('aja:unauthenticated', onUnauth)
    return () => window.removeEventListener('aja:unauthenticated', onUnauth)
  }, [fetchMe])

  const login = async (username, password) => {
    const data = await apiJson('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    })
    if (data.token) {
      localStorage.setItem('aja_token', data.token)
    }
    await fetchMe()
  }

  const register = async (username, email, password) => {
    const data = await apiJson('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, email, password }),
    })
    if (data.token) {
      localStorage.setItem('aja_token', data.token)
    }
    await fetchMe()
  }

  const logout = async () => {
    try { await api('/api/auth/logout', { method: 'POST' }) } catch {}
    localStorage.removeItem('aja_token')
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, authChecked, login, register, logout, refreshUser: fetchMe }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
