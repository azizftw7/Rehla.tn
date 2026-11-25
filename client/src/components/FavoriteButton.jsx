import { Heart } from 'lucide-react'
import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth.js'
import { useFavorites } from '../hooks/useFavorites.js'
import Icon from './Icon.jsx'
import './FavoriteButton.css'

/**
 * Bouton cœur (US5.1) : ajoute ou retire le service des favoris (aria-pressed).
 * - voyageur connecté : bascule le favori ;
 * - visiteur : redirige vers /connexion, qui ramène ensuite sur la page ;
 * - prestataire ou administrateur : rien n'est affiché (les favoris sont réservés aux voyageurs).
 * variant : « card » (rond, sur la photo d'une carte) ou « detail » (bouton avec libellé).
 */
export default function FavoriteButton({ serviceId, serviceName, variant = 'card' }) {
  const favorites = useFavorites()
  const { user, loading } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  if (!favorites || loading || (user && user.role !== 'voyageur')) return null

  const pressed = Boolean(user) && favorites.isFavorite(serviceId)
  const hint = pressed ? 'Retirer de mes favoris' : 'Ajouter à mes favoris'

  const handleClick = async (event) => {
    // Sur une carte, le lien étiré vers la fiche ne doit pas s'ouvrir.
    event.preventDefault()
    event.stopPropagation()
    if (!user) {
      navigate('/connexion', { state: { from: location } })
      return
    }
    setBusy(true)
    setError(null)
    try {
      await favorites.toggleFavorite(serviceId)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={`favorite-btn favorite-btn--${variant}`}>
      <button
        type="button"
        className="favorite-btn__button"
        aria-pressed={pressed}
        aria-label={`Mettre « ${serviceName} » en favori`}
        title={user ? hint : 'Connectez-vous pour ajouter ce service à vos favoris'}
        disabled={busy}
        onClick={handleClick}
      >
        <Icon icon={Heart} size={variant === 'card' ? 20 : 18} />
        {variant === 'detail' && <span>Favori</span>}
      </button>
      {error && (
        <p className="favorite-btn__error legende" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
