import { House, Store } from 'lucide-react'
import { useEffect } from 'react'
import ArchScene from '../../components/ArchScene.jsx'
import Button from '../../components/Button.jsx'
import { useAuth } from '../../hooks/useAuth.js'
import { isApprovedProvider, isRejectedProvider } from '../../lib/providerApproval.js'
import './ProviderPendingPage.css'

/**
 * /prestataire/en-attente : le compte prestataire attend la validation de l'administrateur
 * (ou a été refusé, avec le motif éventuel). Le compte est relu à l'arrivée sur la page :
 * une décision prise entre-temps par l'administrateur s'affiche sans se reconnecter.
 */
export default function ProviderPendingPage() {
  const { user, refreshUser } = useAuth()

  useEffect(() => {
    const controller = new AbortController()
    refreshUser({ signal: controller.signal }).catch(() => {
      // Serveur injoignable : on garde les informations déjà connues.
    })
    return () => controller.abort()
  }, [refreshUser])

  const approved = isApprovedProvider(user)
  const rejected = isRejectedProvider(user)
  const reason = user?.provider?.rejectionReason

  let title = 'Votre demande est en cours de validation'
  let intro = (
    <>
      Merci pour votre inscription{user?.provider?.businessName ? ` (${user.provider.businessName})` : ''}.
      L’équipe Rehla.tn vérifie vos informations avant d’ouvrir votre espace prestataire. Vous
      pourrez ensuite publier vos services. Revenez sur cette page un peu plus tard.
    </>
  )
  if (approved) {
    title = 'Votre compte prestataire est validé'
    intro = 'Bonne nouvelle : vous pouvez maintenant publier vos services sur Rehla.tn.'
  } else if (rejected) {
    title = 'Votre demande a été refusée'
    intro =
      'L’administrateur n’a pas validé votre compte prestataire. Vous pouvez toujours utiliser Rehla.tn pour préparer vos voyages.'
  }

  return (
    <section className="attente-page" aria-labelledby="attente-titre">
      <title>{`${title} — Rehla.tn`}</title>
      <div className="container attente-page__inner">
        <div className="attente-page__texte">
          <header className="attente-page__header">
            <p className="surtitre">Espace prestataire</p>
            <h1 id="attente-titre" className="titre-1">
              {title}
            </h1>
            <p className="texte-l" style={{ color: 'var(--encre-2)' }}>
              {intro}
            </p>
          </header>

          {rejected && (
            <div className="attente-page__motif">
              <h2 className="label">Motif du refus</h2>
              <p className="texte">
                {reason || 'Aucun motif n’a été précisé par l’administrateur.'}
              </p>
            </div>
          )}

          <div className="attente-page__actions">
            {approved ? (
              <Button to="/prestataire/services" variant="primary" size="lg" icon={Store}>
                Accéder à mon espace
              </Button>
            ) : (
              <Button to="/" variant="primary" size="lg" icon={House}>
                Retour à l’accueil
              </Button>
            )}
          </div>
        </div>
        <ArchScene className="attente-page__illustration" />
      </div>
    </section>
  )
}
