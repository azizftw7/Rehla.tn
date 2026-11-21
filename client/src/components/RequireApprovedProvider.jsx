import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth.js'
import { isApprovedProvider } from '../lib/providerApproval.js'

/**
 * Ferme l'espace prestataire tant que l'administrateur n'a pas approuvé le compte :
 * redirection vers /prestataire/en-attente. À placer sous <ProtectedRoute roles={['prestataire']} />.
 */
export default function RequireApprovedProvider({ children }) {
  const { user } = useAuth()
  if (!isApprovedProvider(user)) return <Navigate to="/prestataire/en-attente" replace />
  return children ?? <Outlet />
}
