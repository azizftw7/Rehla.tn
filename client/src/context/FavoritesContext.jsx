import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../hooks/useAuth.js'
import { addFavorite, fetchFavoriteIds, removeFavorite } from '../lib/favoritesApi.js'
import { FavoritesContext } from './favoritesContextDef.js'

const EMPTY = new Set()

/**
 * Charge une fois les favoris du voyageur connecté (GET /favorites/ids) pour cocher les cœurs
 * des cartes et de la fiche service, et garde cette liste à jour après chaque ajout ou retrait.
 */
export function FavoritesProvider({ children }) {
  const { user } = useAuth()
  const userId = user?.role === 'voyageur' ? user._id : null
  const [state, setState] = useState({ userId: null, ids: EMPTY })

  useEffect(() => {
    if (!userId) return undefined
    const controller = new AbortController()
    fetchFavoriteIds({ signal: controller.signal })
      .then(({ ids }) => setState({ userId, ids: new Set(ids) }))
      .catch(() => {
        // Liste facultative : en cas d'erreur, les cœurs restent simplement décochés.
      })
    return () => controller.abort()
  }, [userId])

  const ids = state.userId === userId ? state.ids : EMPTY

  const setFavorite = useCallback(
    (serviceId, favorite) =>
      setState((prev) => {
        const next = new Set(prev.userId === userId ? prev.ids : EMPTY)
        if (favorite) next.add(serviceId)
        else next.delete(serviceId)
        return { userId, ids: next }
      }),
    [userId],
  )

  const toggleFavorite = useCallback(
    async (serviceId) => {
      if (ids.has(serviceId)) {
        try {
          await removeFavorite(serviceId)
        } catch (err) {
          // 404 : déjà retiré (autre onglet) ; l'état visé est atteint.
          if (err.status !== 404) throw err
        }
        setFavorite(serviceId, false)
      } else {
        try {
          await addFavorite(serviceId)
        } catch (err) {
          // 409 : déjà en favori (autre onglet).
          if (err.status !== 409) throw err
        }
        setFavorite(serviceId, true)
      }
    },
    [ids, setFavorite],
  )

  const value = useMemo(
    () => ({ isFavorite: (id) => ids.has(id), toggleFavorite, setFavorite }),
    [ids, toggleFavorite, setFavorite],
  )

  return <FavoritesContext value={value}>{children}</FavoritesContext>
}
