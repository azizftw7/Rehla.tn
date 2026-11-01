// Client HTTP minimal pour l'API Rehla.tn.
// Les erreurs du back-end ont la forme { message, details } (voir server/src/middlewares/errorHandler.js).

export const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace(
  /\/$/,
  '',
)

export class ApiError extends Error {
  constructor(message, status = 0, details = []) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.details = details
  }
}

export async function apiGet(path, { signal } = {}) {
  let response
  try {
    response = await fetch(`${API_URL}${path}`, {
      signal,
      headers: { Accept: 'application/json' },
    })
  } catch (err) {
    if (err.name === 'AbortError') throw err
    throw new ApiError(
      'Impossible de joindre le serveur. Vérifiez votre connexion puis réessayez.',
    )
  }

  const body = await response.json().catch(() => null)
  if (!response.ok) {
    throw new ApiError(
      body?.message ?? 'Une erreur est survenue. Réessayez plus tard.',
      response.status,
      body?.details ?? [],
    )
  }
  return body
}
