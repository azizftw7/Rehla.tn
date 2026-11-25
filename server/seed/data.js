// Données de démonstration (développement uniquement).
// Tous les noms d'établissements, de prestataires et de guides sont FICTIFS.
// Les références entre objets passent par des clés (ex. destination: 'djerba') résolues par seed.js.

const point = (lng, lat) => ({ type: 'Point', coordinates: [lng, lat] });

// Date relative au jour du seed (pour qu'une offre de démo soit toujours en cours).
const daysFromNow = (days) => new Date(Date.now() + days * 24 * 60 * 60 * 1000);

// Le mot de passe des comptes vient de SEED_DEMO_PASSWORD (voir .env.example).
export const users = [
  { key: 'admin', name: 'Admin Rehla', email: 'admin@demo.rehla.tn', role: 'admin' },
  {
    key: 'prestataire1',
    name: 'Nour Ben Salem',
    email: 'prestataire1@demo.rehla.tn',
    role: 'prestataire',
    provider: {
      businessName: 'Nour Évasions',
      activityType: 'hebergement',
      city: 'Djerba',
      phone: '+216 00 000 101',
      approval: 'approuve',
    },
  },
  {
    key: 'prestataire2',
    name: 'Karim Jlassi',
    email: 'prestataire2@demo.rehla.tn',
    role: 'prestataire',
    provider: {
      businessName: 'Sahara Lumière Services',
      activityType: 'activite',
      city: 'Tozeur',
      phone: '+216 00 000 202',
      approval: 'approuve',
    },
  },
  // Demande prestataire à valider par l'administrateur (démo de l'US7.1).
  {
    key: 'prestataire3',
    name: 'Sami Gharbi',
    email: 'prestataire3@demo.rehla.tn',
    role: 'prestataire',
    provider: {
      businessName: 'Dar Yasmine Kerkennah',
      activityType: 'hebergement',
      city: 'Sfax',
      phone: '+216 00 000 303',
      approval: 'en_attente',
    },
  },
  {
    key: 'voyageur1',
    name: 'Amel Trabelsi',
    email: 'voyageur1@demo.rehla.tn',
    role: 'voyageur',
    profile: 'etudiant',
  },
  {
    key: 'voyageur2',
    name: 'Youssef Haddad',
    email: 'voyageur2@demo.rehla.tn',
    role: 'voyageur',
    profile: 'resident',
  },
  {
    key: 'voyageur3',
    name: 'Claire Martin',
    email: 'voyageur3@demo.rehla.tn',
    role: 'voyageur',
    profile: 'touriste',
  },
  // Sprint 3 : plus de voyageurs pour la pagination des avis (US3.5) et les co-voyageurs (US5.4).
  {
    key: 'voyageur4',
    name: 'Mehdi Jaziri',
    email: 'voyageur4@demo.rehla.tn',
    role: 'voyageur',
    profile: 'etudiant',
  },
  {
    key: 'voyageur5',
    name: 'Sofia Rossi',
    email: 'voyageur5@demo.rehla.tn',
    role: 'voyageur',
    profile: 'touriste',
  },
  {
    key: 'voyageur6',
    name: 'Nour Ayari',
    email: 'voyageur6@demo.rehla.tn',
    role: 'voyageur',
    profile: 'resident',
  },
];

// Coordonnées réelles (centre-ville), au format GeoJSON [longitude, latitude].
export const destinations = [
  {
    key: 'djerba',
    name: 'Djerba',
    region: 'Médenine',
    description:
      'Île du golfe de Gabès connue pour ses plages, ses villages aux maisons blanches et le souk de Houmt Souk.',
    location: point(10.8575, 33.8758),
    coverImage: 'https://placehold.co/1200x600?text=Djerba',
  },
  {
    key: 'tozeur',
    name: 'Tozeur',
    region: 'Tozeur',
    description:
      'Porte du désert, au bord du chott el-Jérid : palmeraie, architecture de briques et excursions vers les oasis de montagne.',
    location: point(8.1335, 33.9197),
    coverImage: 'https://placehold.co/1200x600?text=Tozeur',
  },
  {
    key: 'sidi-bou-said',
    name: 'Sidi Bou Saïd',
    region: 'Tunis',
    description:
      'Village perché au-dessus du golfe de Tunis, célèbre pour ses maisons blanches aux portes bleues.',
    location: point(10.3417, 36.8687),
    coverImage: 'https://placehold.co/1200x600?text=Sidi+Bou+Said',
  },
];

export const services = [
  // --- Djerba ---
  {
    key: 'djerba-hebergement',
    type: 'hebergement',
    accommodationType: 'maison-hotes',
    name: 'Menzel des Palmes Bleues',
    description: "Maison d'hôtes de six chambres autour d'un patio, à dix minutes de la plage.",
    destination: 'djerba',
    provider: 'prestataire1',
    location: point(10.872, 33.861),
    address: 'Route de la plage, Djerba',
    price: { amount: 180, unit: 'nuit' },
    photos: ['https://placehold.co/800x500?text=Menzel+des+Palmes+Bleues'],
    contact: { phone: '+216 00 000 111', website: 'https://example.com/menzel-palmes-bleues' },
  },
  {
    key: 'djerba-restaurant',
    type: 'restaurant',
    name: 'Le Filet du Pêcheur Rêveur',
    description: 'Poissons du jour grillés et couscous au poisson, en terrasse.',
    destination: 'djerba',
    provider: 'prestataire1',
    location: point(10.859, 33.878),
    address: 'Port de Houmt Souk, Djerba',
    price: { amount: 45, unit: 'repas' },
    cuisine: 'Poissons et fruits de mer',
  },
  {
    key: 'djerba-activite',
    type: 'activite',
    name: 'Balade en kayak sur la lagune',
    description: 'Sortie de deux heures accompagnée, matériel fourni, débutants bienvenus.',
    destination: 'djerba',
    provider: 'prestataire1',
    location: point(10.98, 33.79),
    address: 'Lagune de Djerba',
    price: { amount: 60, unit: 'personne' },
    activityCategory: 'Sports nautiques',
  },
  {
    key: 'djerba-plage',
    type: 'activite',
    name: 'Plage de Sidi Mahrez',
    description:
      'Grande plage de sable fin aux eaux turquoise, idéale pour la baignade et la promenade.',
    destination: 'djerba',
    provider: 'prestataire1',
    location: point(11.005, 33.854),
    address: 'Zone touristique Midoun, Djerba',
    free: true,
    activityCategory: 'Plage',
  },
  {
    key: 'djerba-evenement',
    type: 'evenement',
    name: 'Nuit des conteurs de Houmt Souk',
    description: 'Contes traditionnels et musique sur la place du souk.',
    destination: 'djerba',
    provider: 'prestataire1',
    location: point(10.8578, 33.8762),
    address: 'Place du souk, Houmt Souk',
    free: true,
    event: {
      eventType: 'Fête locale',
      startDate: '2026-12-12',
      endDate: '2026-12-14',
      hours: '19h – 22h',
    },
  },
  {
    key: 'djerba-guide',
    type: 'guide',
    name: "Slim, guide de l'île",
    description:
      "Visite des villages de l'île, de la synagogue de la Ghriba et des ateliers de potiers.",
    destination: 'djerba',
    provider: 'prestataire1',
    location: point(10.8575, 33.8758),
    price: { amount: 80, unit: 'demi-journée' },
    languages: ['français', 'arabe', 'anglais'],
  },

  // --- Tozeur ---
  {
    key: 'tozeur-hebergement',
    type: 'hebergement',
    accommodationType: 'hotel',
    name: "Lodge Sable d'Or",
    description:
      'Chambres en briques ocre au cœur de la palmeraie, piscine et petit-déjeuner inclus.',
    destination: 'tozeur',
    provider: 'prestataire2',
    location: point(8.128, 33.911),
    address: 'Zone touristique, Tozeur',
    price: { amount: 220, unit: 'nuit' },
  },
  {
    key: 'tozeur-restaurant',
    type: 'restaurant',
    name: 'La Table des Dattiers',
    description: 'Cuisine du Sud tunisien : chorba, mloukhia et desserts aux dattes.',
    destination: 'tozeur',
    provider: 'prestataire2',
    location: point(8.135, 33.92),
    address: 'Avenue principale, Tozeur',
    price: { amount: 35, unit: 'repas' },
    cuisine: 'Tunisienne du Sud',
  },
  {
    key: 'tozeur-activite',
    type: 'activite',
    name: 'Randonnée chamelière dans les dunes',
    description: 'Départ en fin de journée pour admirer le coucher du soleil sur le désert.',
    destination: 'tozeur',
    provider: 'prestataire2',
    location: point(8.05, 33.95),
    price: { amount: 90, unit: 'personne' },
    activityCategory: 'Désert',
  },
  {
    key: 'tozeur-evenement',
    type: 'evenement',
    name: 'Soirée étoilée dans la palmeraie',
    description: "Observation des étoiles commentée et thé à la menthe autour d'un feu.",
    destination: 'tozeur',
    provider: 'prestataire2',
    location: point(8.14, 33.915),
    price: { amount: 25, unit: 'personne' },
    event: {
      eventType: 'Spectacle',
      startDate: '2026-11-20',
      endDate: '2026-11-20',
      hours: '20h – 23h',
    },
  },
  {
    // Événement passé : visible avec un filtre de période antérieur à aujourd'hui.
    key: 'tozeur-festival',
    type: 'evenement',
    name: 'Festival des palmeraies',
    description: 'Musiques du Sud, marché des artisans et courses de dromadaires.',
    destination: 'tozeur',
    provider: 'prestataire2',
    location: point(8.1345, 33.9178),
    address: 'Place Ibn Chabbat, Tozeur',
    price: { amount: 10, unit: 'entrée' },
    event: {
      eventType: 'Festival',
      startDate: '2026-10-16',
      endDate: '2026-10-18',
      hours: '10h – 23h',
    },
  },
  {
    key: 'tozeur-guide',
    type: 'guide',
    name: 'Hédi, guide du Djérid',
    description: 'Excursions vers Chebika, Tamerza et le chott el-Jérid.',
    destination: 'tozeur',
    provider: 'prestataire2',
    location: point(8.1335, 33.9197),
    price: { amount: 120, unit: 'journée' },
    languages: ['français', 'arabe', 'allemand'],
  },

  // --- Sidi Bou Saïd ---
  {
    key: 'sbs-hebergement',
    type: 'hebergement',
    accommodationType: 'dar',
    name: 'La Maison aux Volets Bleus',
    description: 'Quatre chambres avec vue sur le golfe, terrasse sur le toit.',
    destination: 'sidi-bou-said',
    provider: 'prestataire1',
    location: point(10.3425, 36.8694),
    address: 'Rue principale, Sidi Bou Saïd',
    price: { amount: 250, unit: 'nuit' },
  },
  {
    key: 'sbs-restaurant',
    type: 'restaurant',
    name: 'Terrasse du Jasmin Blanc',
    description: 'Cuisine méditerranéenne et pâtisseries tunisiennes face à la mer.',
    destination: 'sidi-bou-said',
    provider: 'prestataire1',
    location: point(10.3438, 36.8679),
    price: { amount: 60, unit: 'repas' },
    cuisine: 'Méditerranéenne',
  },
  {
    key: 'sbs-activite',
    type: 'activite',
    name: 'Atelier de peinture bleu et blanc',
    description: 'Initiation à la peinture des portes et moucharabiehs du village (2 h).',
    destination: 'sidi-bou-said',
    provider: 'prestataire2',
    location: point(10.3412, 36.8691),
    price: { amount: 50, unit: 'personne' },
    activityCategory: 'Culture et artisanat',
  },
  {
    key: 'sbs-evenement',
    type: 'evenement',
    name: 'Concert de malouf au coucher du soleil',
    description: 'Musique arabo-andalouse en plein air.',
    destination: 'sidi-bou-said',
    provider: 'prestataire2',
    location: point(10.3409, 36.8701),
    free: true,
    event: {
      eventType: 'Concert',
      startDate: '2027-01-09',
      endDate: '2027-01-09',
      hours: '17h – 19h',
    },
  },
  {
    key: 'sbs-guide',
    type: 'guide',
    name: 'Leïla, guide de Carthage et Sidi Bou Saïd',
    description: 'Visite du village puis des sites archéologiques de Carthage.',
    destination: 'sidi-bou-said',
    provider: 'prestataire2',
    location: point(10.3417, 36.8687),
    price: { amount: 100, unit: 'demi-journée' },
    languages: ['français', 'arabe', 'anglais', 'italien'],
  },
];

export const offers = [
  {
    service: 'djerba-hebergement',
    title: "Séjour d'hiver : -15 %",
    discountPercent: 15,
    startDate: daysFromNow(-7),
    endDate: daysFromNow(90),
  },
  {
    service: 'tozeur-restaurant',
    title: 'Menu découverte à prix réduit',
    discountedPrice: 28,
    startDate: '2026-11-01',
    endDate: '2026-12-31',
  },
  {
    service: 'sbs-activite',
    title: 'Atelier en famille : -10 %',
    discountPercent: 10,
    startDate: '2026-11-15',
    endDate: '2027-01-15',
  },
];

export const reviews = [
  {
    service: 'djerba-hebergement',
    author: 'voyageur1',
    rating: 5,
    comment: 'Accueil chaleureux et patio magnifique.',
    providerReply: { text: 'Merci, au plaisir de vous revoir !' },
  },
  {
    service: 'djerba-hebergement',
    author: 'voyageur3',
    rating: 4,
    comment: 'Très calme, un peu loin du centre.',
  },
  // US6.4 : quelques avis ont déjà une réponse du prestataire, les autres attendent la sienne.
  {
    service: 'djerba-restaurant',
    author: 'voyageur2',
    rating: 4,
    comment: 'Poisson très frais.',
    providerReply: {
      text: 'Merci Youssef ! Le poisson arrive chaque matin du port de Houmt Souk.',
    },
  },
  {
    service: 'tozeur-activite',
    author: 'voyageur3',
    rating: 5,
    comment: 'Coucher de soleil inoubliable.',
    providerReply: { text: 'Merci Claire, revenez pour la balade de pleine lune !' },
  },
  {
    service: 'tozeur-hebergement',
    author: 'voyageur1',
    rating: 3,
    comment: 'Bien situé, chambres un peu sombres.',
  },
  { service: 'sbs-restaurant', author: 'voyageur2', rating: 5, comment: 'La vue vaut le détour.' },
  {
    service: 'sbs-guide',
    author: 'voyageur3',
    rating: 5,
    comment: 'Leïla connaît chaque pierre de Carthage.',
  },
  // Sprint 3 (US3.5) : 6 avis sur le même hébergement pour montrer la pagination (5 par page).
  {
    service: 'djerba-hebergement',
    author: 'voyageur2',
    rating: 5,
    comment: 'Petit-déjeuner copieux sur la terrasse, on reviendra.',
  },
  {
    service: 'djerba-hebergement',
    author: 'voyageur4',
    rating: 3,
    comment: 'Chambre propre, mais le wifi coupait souvent.',
  },
  { service: 'djerba-hebergement', author: 'voyageur5', rating: 4 },
  {
    service: 'djerba-hebergement',
    author: 'voyageur6',
    rating: 2,
    comment: 'Accueil un peu froid à l’arrivée, chambre correcte sans plus.',
  },
  {
    service: 'djerba-restaurant',
    author: 'voyageur5',
    rating: 5,
    comment: 'Le meilleur couscous au poisson de l’île.',
  },
  { service: 'tozeur-activite', author: 'voyageur4', rating: 4, comment: 'Guide très patient.' },
  // US7.2 : avis publicitaire à supprimer par l'administrateur pendant la démo.
  {
    service: 'sbs-hebergement',
    author: 'voyageur6',
    rating: 1,
    comment: 'PROMO !!! Réservez moins cher ailleurs, écrivez-moi en privé pour le lien.',
  },
];

// Horaires et tarifs indicatifs pour la démo : ils ne proviennent pas des opérateurs.
const DEMO_SOURCE = 'Données de démonstration (à vérifier auprès des opérateurs)';
// Date à laquelle ces données indicatives ont été relevées (et non la date d'exécution du seed).
export const DEMO_SOURCE_UPDATED_AT = new Date('2026-10-01T00:00:00.000Z');

export const transports = [
  {
    type: 'avion',
    from: 'Tunis',
    to: 'Djerba',
    destination: 'djerba',
    price: 150,
    duration: 60,
    schedule: 'Plusieurs vols par jour',
    operator: 'Compagnie aérienne (démo)',
  },
  {
    type: 'louage',
    from: 'Tunis',
    to: 'Djerba',
    destination: 'djerba',
    price: 45,
    duration: 480,
    schedule: 'Départ dès que le louage est complet, de 5h à 18h',
    operator: 'Station de louages de Tunis (démo)',
  },
  {
    type: 'ferry',
    from: 'Jorf',
    to: 'Ajim (Djerba)',
    destination: 'djerba',
    price: 1,
    duration: 20,
    schedule: 'Toutes les 30 minutes, jour et nuit',
    operator: 'Bac de Djerba (démo)',
  },
  {
    type: 'bus',
    from: 'Tunis',
    to: 'Tozeur',
    destination: 'tozeur',
    price: 40,
    duration: 420,
    schedule: 'Départs à 7h et 21h',
    operator: 'Transporteur interurbain (démo)',
  },
  {
    type: 'avion',
    from: 'Tunis',
    to: 'Tozeur',
    destination: 'tozeur',
    price: 140,
    duration: 70,
    schedule: 'Deux vols par semaine',
    operator: 'Compagnie aérienne (démo)',
  },
  {
    type: 'train',
    from: 'Tunis Marine',
    to: 'Sidi Bou Saïd',
    destination: 'sidi-bou-said',
    price: 1,
    duration: 35,
    schedule: 'Toutes les 15 à 20 minutes, de 4h à minuit',
    operator: 'Train de banlieue nord (démo)',
  },
].map((transport) => ({
  ...transport,
  source: DEMO_SOURCE,
  sourceUpdatedAt: DEMO_SOURCE_UPDATED_AT,
}));
