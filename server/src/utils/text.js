/** Minuscules sans accents : « Aïn Draham » → « ain draham ». */
export function normalizeText(value = '') {
  return String(value).normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();
}

/** « Sidi Bou Saïd » → « sidi-bou-said ». */
export function slugify(value = '') {
  return normalizeText(value)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Nom affiché publiquement (avis, partage de voyage) : prénom et initiale du nom.
 * « Amel Ben Salah » → « Amel B. », « Karim » → « Karim ».
 */
export function publicName(fullName = '') {
  const [first = '', ...rest] = String(fullName).trim().split(/\s+/);
  const initial = rest.length > 0 ? `${rest[0].charAt(0).toUpperCase()}.` : '';
  return [first, initial].filter(Boolean).join(' ');
}

/** Échappe une saisie utilisateur avant de l'utiliser dans une RegExp. */
export function escapeRegex(value = '') {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
