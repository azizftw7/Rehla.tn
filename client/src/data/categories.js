import { BedDouble, Bus, CalendarDays, Compass, Languages, UtensilsCrossed } from 'lucide-react'

/**
 * Les 6 catégories affichées sur la carte.
 * `type` correspond aux types de service de l'API (Service.type), plus « transport ».
 * `color` est le nom de la variable CSS de la catégorie (tokens.css).
 */
export const CATEGORIES = [
  {
    type: 'hebergement',
    label: 'Hébergement',
    title: 'Hébergements',
    icon: BedDouble,
    color: '--cat-hebergement',
    text: 'Hôtels, maisons d’hôtes et dars pour toutes les envies et tous les budgets.',
  },
  {
    type: 'restaurant',
    label: 'Restaurant',
    title: 'Restaurants',
    icon: UtensilsCrossed,
    color: '--cat-restaurant',
    text: 'Poisson grillé sur le port, couscous du vendredi ou café avec vue : où bien manger.',
  },
  {
    type: 'activite',
    label: 'Activité',
    title: 'Activités',
    icon: Compass,
    color: '--cat-activite',
    text: 'Kayak, randonnée dans les dunes, ateliers d’artisanat : de quoi remplir vos journées.',
  },
  {
    type: 'evenement',
    label: 'Événement',
    title: 'Événements',
    icon: CalendarDays,
    color: '--cat-evenement',
    text: 'Festivals, concerts et fêtes locales aux dates de votre séjour.',
  },
  {
    type: 'guide',
    label: 'Guide',
    title: 'Guides locaux',
    icon: Languages,
    color: '--cat-guide',
    text: 'Des guides qui parlent votre langue pour découvrir les lieux autrement.',
  },
  {
    type: 'transport',
    label: 'Transport',
    title: 'Transports',
    icon: Bus,
    color: '--cat-transport',
    text: 'Bus, louages, trains, ferries et vols pour rejoindre votre destination.',
  },
]
