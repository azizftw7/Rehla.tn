import { createContext } from 'react'

/**
 * Favoris du voyageur connecté (voir FavoritesProvider dans FavoritesContext.jsx).
 * Valeur par défaut null : sans fournisseur (composant testé seul), le bouton cœur ne s'affiche pas.
 */
export const FavoritesContext = createContext(null)
