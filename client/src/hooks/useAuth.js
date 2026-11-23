import { use } from 'react'
import { AuthContext } from '../context/authContextDef.js'

/** Session courante : { user, token, loading, login, register, refreshUser, logout }. */
export function useAuth() {
  return use(AuthContext)
}
