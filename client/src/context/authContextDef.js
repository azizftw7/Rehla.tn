import { createContext } from 'react'

function missingProvider() {
  throw new Error('AuthProvider est absent : enveloppez l’application dans <AuthProvider>.')
}

/**
 * Session de l'utilisateur (voir AuthProvider dans AuthContext.jsx).
 * Valeur par défaut : visiteur non connecté (utile pour tester un composant seul).
 */
export const AuthContext = createContext({
  user: null,
  token: null,
  loading: false,
  login: missingProvider,
  register: missingProvider,
  logout: () => {},
})
