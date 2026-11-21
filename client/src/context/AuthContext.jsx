import { useCallback, useEffect, useMemo, useState } from 'react'
import { apiGet, apiPost, getStoredToken, setStoredToken, setUnauthorizedHandler } from '../lib/api.js'
import { AuthContext } from './authContextDef.js'

const LOGGED_OUT = { token: null, user: null, checking: false }

/**
 * Fournit la session : user, token (localStorage « rehla-token »), login, register, refreshUser, logout.
 * Au démarrage, si un token est stocké, l'utilisateur est rechargé depuis GET /users/me.
 */
export function AuthProvider({ children }) {
  const [session, setSession] = useState(() => {
    const token = getStoredToken()
    return { token, user: null, checking: Boolean(token) }
  })

  // Un 401 sur une requête authentifiée (token expiré, compte supprimé) déconnecte l'utilisateur.
  useEffect(() => setUnauthorizedHandler(() => setSession(LOGGED_OUT)), [])

  useEffect(() => {
    if (!session.checking) return undefined
    const controller = new AbortController()

    apiGet('/users/me', { signal: controller.signal })
      .then(({ user }) => setSession((prev) => ({ ...prev, user, checking: false })))
      .catch((err) => {
        if (err.name === 'AbortError') return
        // 401 : déjà déconnecté par le gestionnaire ci-dessus. Serveur injoignable : le token est
        // gardé pour réessayer au prochain chargement, mais l'interface reste celle d'un visiteur.
        setSession((prev) => ({ ...prev, checking: false }))
      })

    return () => controller.abort()
  }, [session.checking])

  const startSession = useCallback(({ token, user }) => {
    setStoredToken(token)
    setSession({ token, user, checking: false })
    return user
  }, [])

  const login = useCallback(
    async (credentials) => startSession(await apiPost('/auth/login', credentials)),
    [startSession],
  )

  const register = useCallback(
    async (data) => startSession(await apiPost('/auth/register', data)),
    [startSession],
  )

  // Relit le compte (ex. la page « demande en attente » vérifie si l'admin a validé le compte).
  const refreshUser = useCallback(async (options) => {
    const { user } = await apiGet('/users/me', options)
    setSession((prev) => (prev.token ? { ...prev, user } : prev))
    return user
  }, [])

  const logout = useCallback(() => {
    setStoredToken(null)
    setSession(LOGGED_OUT)
  }, [])

  const value = useMemo(
    () => ({
      user: session.user,
      token: session.token,
      loading: session.checking,
      login,
      register,
      refreshUser,
      logout,
    }),
    [session, login, register, refreshUser, logout],
  )

  return <AuthContext value={value}>{children}</AuthContext>
}
