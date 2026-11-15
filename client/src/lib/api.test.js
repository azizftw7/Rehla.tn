import { describe, expect, it, vi } from 'vitest'
import { jsonResponse } from '../test/utils.jsx'
import {
  API_URL,
  apiDelete,
  apiGet,
  apiPatch,
  apiPost,
  apiPut,
  ApiError,
  setUnauthorizedHandler,
  TOKEN_STORAGE_KEY,
} from './api.js'

function stubFetch(response) {
  const fetchMock = vi.fn(() =>
    response instanceof Error ? Promise.reject(response) : Promise.resolve(response),
  )
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

describe('client HTTP', () => {
  it('envoie le corps en JSON avec la bonne méthode', async () => {
    const fetchMock = stubFetch(jsonResponse({ ok: true }, 201))

    await expect(apiPost('/auth/login', { email: 'a@b.tn' })).resolves.toEqual({ ok: true })

    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe(`${API_URL}/auth/login`)
    expect(options.method).toBe('POST')
    expect(options.headers['Content-Type']).toBe('application/json')
    expect(options.headers.Authorization).toBeUndefined()
    expect(JSON.parse(options.body)).toEqual({ email: 'a@b.tn' })
  })

  it('ajoute le token stocké à toutes les méthodes', async () => {
    localStorage.setItem(TOKEN_STORAGE_KEY, 'jeton-123')
    const fetchMock = stubFetch(jsonResponse({}))

    await apiGet('/users/me')
    await apiPut('/users/me', { name: 'Nour' })
    await apiPatch('/x', {})
    await apiDelete('/x')

    expect(fetchMock.mock.calls.map(([, options]) => options.method)).toEqual([
      'GET',
      'PUT',
      'PATCH',
      'DELETE',
    ])
    fetchMock.mock.calls.forEach(([, options]) => {
      expect(options.headers.Authorization).toBe('Bearer jeton-123')
    })
    expect(fetchMock.mock.calls[0][1].body).toBeUndefined()
  })

  it('transmet le message et les détails d’une erreur du serveur', async () => {
    const details = [{ field: 'email', message: 'Cette adresse e-mail est déjà utilisée.' }]
    stubFetch(jsonResponse({ message: 'Cette adresse e-mail est déjà utilisée.', details }, 409))

    const error = await apiPost('/auth/register', {}).catch((err) => err)

    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ status: 409, details })
  })

  it('un 401 sur une requête authentifiée supprime le token et prévient l’application', async () => {
    localStorage.setItem(TOKEN_STORAGE_KEY, 'jeton-expire')
    const onUnauthorized = vi.fn()
    const unsubscribe = setUnauthorizedHandler(onUnauthorized)
    stubFetch(jsonResponse({ message: 'Votre session a expiré. Reconnectez-vous.' }, 401))

    await expect(apiGet('/users/me')).rejects.toMatchObject({ status: 401 })

    expect(localStorage.getItem(TOKEN_STORAGE_KEY)).toBeNull()
    expect(onUnauthorized).toHaveBeenCalledTimes(1)
    unsubscribe()
  })

  it('un 401 sans token (mauvais mot de passe) ne déclenche pas de déconnexion', async () => {
    const onUnauthorized = vi.fn()
    const unsubscribe = setUnauthorizedHandler(onUnauthorized)
    stubFetch(jsonResponse({ message: 'E-mail ou mot de passe incorrect.' }, 401))

    await expect(apiPost('/auth/login', {})).rejects.toThrow('E-mail ou mot de passe incorrect.')
    expect(onUnauthorized).not.toHaveBeenCalled()
    unsubscribe()
  })

  it('signale clairement un serveur injoignable', async () => {
    stubFetch(new TypeError('Failed to fetch'))

    await expect(apiPost('/auth/login', {})).rejects.toThrow(
      'Impossible de joindre le serveur. Vérifiez votre connexion puis réessayez.',
    )
  })
})
