import { MessageSquareText, Sparkles, Store } from 'lucide-react'
import Button from '../../components/Button.jsx'
import Icon from '../../components/Icon.jsx'
import { useAuth } from '../../hooks/useAuth.js'
import { canBecomeProvider } from '../../lib/providerApproval.js'

const POINTS = [
  { icon: Store, text: 'Publiez vos services, vos photos et vos tarifs.' },
  { icon: Sparkles, text: 'Mettez en avant vos offres du moment.' },
  { icon: MessageSquareText, text: 'Répondez aux avis des voyageurs.' },
]

/**
 * Section « Prestataires » de l'accueil : « Devenir prestataire » pour un visiteur ou un voyageur,
 * « Mon espace prestataire » pour un prestataire connecté ; masquée pour l'administrateur.
 */
export default function ProviderSection() {
  const session = useAuth()
  const { user } = session
  if (user?.role === 'admin') return null

  return (
    <section className="section" aria-labelledby="prestataires-titre">
      <div className="container">
        <div className="prestataires">
          <div className="prestataires__texte">
            <p className="surtitre">Prestataires</p>
            <h2 id="prestataires-titre" className="titre-1">
              Faites découvrir votre adresse aux voyageurs
            </h2>
            <p className="texte-l">
              Hébergeur, restaurateur, guide ou organisateur d’activités : apparaissez sur la carte
              de votre ville. Les voyageurs vous contactent directement, sans réservation ni
              commission sur le site.
            </p>
          </div>

          <ul role="list" className="prestataires__points">
            {POINTS.map((point) => (
              <li key={point.text}>
                <Icon icon={point.icon} size={22} />
                {point.text}
              </li>
            ))}
          </ul>

          {user?.role === 'prestataire' ? (
            <Button to="/prestataire/services" variant="accent" size="lg" icon={Store}>
              Mon espace prestataire
            </Button>
          ) : (
            canBecomeProvider(session) && (
              <Button to="/inscription?role=prestataire" variant="accent" size="lg">
                Devenir prestataire
              </Button>
            )
          )}
        </div>
      </div>
    </section>
  )
}
