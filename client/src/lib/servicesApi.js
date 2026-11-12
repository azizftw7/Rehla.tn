import { apiGet } from './api.js'

export function formatServicePrice(service) {
  if (service.free) {
    return { main: 'Gratuit', unit: '' }
  }
  if (service.price?.amount != null) {
    return {
      main: `${service.price.amount} DT`,
      unit: service.price.unit ? `/ ${service.price.unit}` : '',
    }
  }
  return { main: 'Sur demande', unit: '' }
}

export function fetchServices(params = {}, options = {}) {
  const searchParams = new URLSearchParams()

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      searchParams.set(key, String(value))
    }
  })

  const query = searchParams.toString()
  return apiGet(`/services${query ? `?${query}` : ''}`, options)
}

export function fetchServiceById(id, options = {}) {
  return apiGet(`/services/${encodeURIComponent(id)}`, options)
}

export function fetchDestinationsList(options = {}) {
  return apiGet('/destinations?limit=100', options)
}