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

/** Échappe une saisie utilisateur avant de l'utiliser dans une RegExp. */
export function escapeRegex(value = '') {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
