import { Component } from 'react'
import ErrorFallback from './ErrorFallback.jsx'

/**
 * Attrape les erreurs de rendu de ses enfants et affiche la page « Une erreur est survenue ».
 * - resetKey : quand cette valeur change (ex. l'URL), l'erreur est oubliée et les enfants réaffichés.
 * - standalone : page complète avec logo, pour la protection de dernier recours (hors Layout).
 */
export default class ErrorBoundary extends Component {
  state = { error: null }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    // Journal côté navigateur ; à brancher sur un outil de suivi des erreurs si besoin.
    console.error('Erreur inattendue dans l’interface :', error, info.componentStack)
  }

  componentDidUpdate(previousProps) {
    if (this.state.error && previousProps.resetKey !== this.props.resetKey) {
      this.reset()
    }
  }

  reset = () => this.setState({ error: null })

  render() {
    if (this.state.error) {
      return <ErrorFallback onRetry={this.reset} standalone={this.props.standalone} />
    }
    return this.props.children
  }
}
