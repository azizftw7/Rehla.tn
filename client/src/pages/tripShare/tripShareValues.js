import { toInputDate } from '../../lib/tripSharesApi.js'

// Valeurs du formulaire « Partager mon déplacement » (US5.3).

export const EMPTY_FORM = {
  destination: '',
  startDate: '',
  endDate: '',
  message: '',
  city: '',
  languages: [],
  visible: { profile: true, city: false, languages: false, photo: false },
}

/** Valeurs du formulaire à partir d'un partage existant (modification). */
export function formFromShare(share) {
  return {
    destination: share.destination?._id || share.destination || '',
    startDate: toInputDate(share.startDate),
    endDate: toInputDate(share.endDate),
    message: share.message || '',
    city: share.city || '',
    languages: share.languages || [],
    visible: { ...EMPTY_FORM.visible, ...share.visible },
  }
}
