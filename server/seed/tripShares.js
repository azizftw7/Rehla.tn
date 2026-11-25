// Partages de voyage de démonstration (US5.3, US5.4). Développement uniquement.
// Dans un fichier à part : les dates dépendent du jour du seed.

/** Minuit UTC, `days` jours après le jour du seed (dates de séjour toujours à venir). */
export const dayFromToday = (days) => {
  const today = new Date();
  return new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() + days));
};

// US5.3 / US5.4 : partages de voyage. start / end : jours après le seed.
// voyageur1 (Djerba, J+12 → J+18) voit 4 co-voyageurs ; seul voyageur2 a 3 jours ou plus en commun.
export const tripShares = [
  {
    user: 'voyageur1',
    destination: 'djerba',
    start: 12,
    end: 18,
    message: 'Quelqu’un pour partager un louage depuis Tunis et visiter Houmt Souk ?',
    city: 'Tunis',
    languages: ['Français', 'Arabe', 'Anglais'],
    visible: { profile: true, city: true, languages: true, photo: false },
  },
  {
    user: 'voyageur2',
    destination: 'djerba',
    start: 14,
    end: 20,
    message: 'Partant pour une sortie en kayak sur la lagune, à plusieurs c’est mieux !',
    city: 'Sfax',
    languages: ['Arabe', 'Français'],
    visible: { profile: true, city: true, languages: true, photo: false },
  },
  {
    user: 'voyageur4',
    destination: 'djerba',
    start: 10,
    end: 13,
    message: 'Étudiant, je cherche des compagnons pour la Nuit des conteurs.',
    city: 'Sousse',
    languages: ['Arabe', 'Anglais'],
    visible: { profile: true, city: false, languages: true, photo: false },
  },
  {
    user: 'voyageur5',
    destination: 'djerba',
    start: 17,
    end: 24,
    message: 'Première fois en Tunisie : qui veut goûter le couscous au poisson ?',
    city: 'Milan',
    languages: ['Italien', 'Anglais', 'Français'],
    visible: { profile: true, city: true, languages: true, photo: false },
  },
  // Partage minimal : seuls le prénom, l'initiale et les dates sont visibles.
  {
    user: 'voyageur6',
    destination: 'djerba',
    start: 15,
    end: 16,
    visible: { profile: false, city: false, languages: false, photo: false },
  },
  {
    user: 'voyageur3',
    destination: 'tozeur',
    start: 12,
    end: 18,
    message: 'Je cherche du monde pour la randonnée chamelière au coucher du soleil.',
    city: 'Lyon',
    languages: ['Français', 'Anglais'],
    visible: { profile: true, city: true, languages: true, photo: false },
  },
];
