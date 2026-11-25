import { use } from 'react'
import { FavoritesContext } from '../context/favoritesContextDef.js'

/** { isFavorite(id), toggleFavorite(id), setFavorite(id, bool) } ou null sans FavoritesProvider. */
export function useFavorites() {
  return use(FavoritesContext)
}
