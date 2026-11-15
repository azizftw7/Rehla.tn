// Client HTTP minimal pour l'API Rehla.tn.
// Les erreurs du back-end ont la forme { message, details } (voir server/src/middlewares/errorHandler.js).

export const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace(
  /\/$/,
  '',
)

/** Clé localStorage du token JWT. */
export const TOKEN_STORAGE_KEY = 'rehla-token'

export class ApiError extends Error {
  constructor(message, status = 0, details = []) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.details = details
  }
}

// ---------- Token (localStorage peut être indisponible : navigation privée, stockage bloqué) ----------

export function getStoredToken() {
  try {
    return localStorage.getItem(TOKEN_STORAGE_KEY)
  } catch {
    return null
  }
}

export function setStoredToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_STORAGE_KEY, token)
    else localStorage.removeItem(TOKEN_STORAGE_KEY)
  } catch {
    // Le token reste alors en mémoire seulement (AuthContext).
  }
}

// Appelé quand le serveur refuse le token (401) : AuthContext y branche la déconnexion.
let unauthorizedHandler = null

export function setUnauthorizedHandler(handler) {
  unauthorizedHandler = handler
  return () => {
    if (unauthorizedHandler === handler) unauthorizedHandler = null
  }
}

/**
 * Requête JSON vers l'API. Ajoute « Authorization: Bearer <token> » si un token est stocké.
 * Un 401 sur une requête authentifiée supprime le token et déconnecte l'utilisateur.
 */
export async function apiRequest(method, path, { body, signal } = {}) {
  const token = getStoredToken()
  const headers = { Accept: 'application/json' }
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (token) headers.Authorization = `Bearer ${token}`

  let response
  try {
    response = await fetch(`${API_URL}${path}`, {
      method,
      signal,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch (err) {
    if (err.name === 'AbortError') throw err
    throw new ApiError(
      'Impossible de joindre le serveur. Vérifiez votre connexion puis réessayez.',
    )
  }

  const data = await response.json().catch(() => null)
  if (!response.ok) {
    if (response.status === 401 && token) {
      setStoredToken(null)
      unauthorizedHandler?.()
    }
    throw new ApiError(
      data?.message ?? 'Une erreur est survenue. Réessayez plus tard.',
      response.status,
      data?.details ?? [],
    )
  }
  return data
}

export const apiGet = (path, options) => apiRequest('GET', path, options)
export const apiPost = (path, body, options) => apiRequest('POST', path, { ...options, body })
export const apiPut = (path, body, options) => apiRequest('PUT', path, { ...options, body })
export const apiPatch = (path, body, options) => apiRequest('PATCH', path, { ...options, body })
export const apiDelete = (path, options) => apiRequest('DELETE', path, options)
