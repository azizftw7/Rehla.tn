import { use } from 'react'
import { AuthContext } from '../context/authContextDef.js'

/** Session courante : { user, token, loading, login, register, logout }. */
export function useAuth() {
  return use(AuthContext)
}
