/**
 * Page de test, disponible en développement uniquement (/test-erreur) :
 * déclenche volontairement une erreur pour vérifier l'affichage de l'ErrorBoundary.
 */
export default function CrashTestPage() {
  throw new Error('Erreur de test volontaire (/test-erreur).')
}
