import { Bus, CarFront, Plane, Ship, TrainFront } from 'lucide-react'

/** Types de transport de l'API (Transport.type), dans l'ordre d'affichage des filtres. */
export const TRANSPORT_TYPES = [
  { value: 'bus', label: 'Bus', title: 'Bus', icon: Bus },
  { value: 'louage', label: 'Louage', title: 'Louages', icon: CarFront },
  { value: 'train', label: 'Train', title: 'Trains', icon: TrainFront },
  { value: 'ferry', label: 'Ferry', title: 'Ferries', icon: Ship },
  { value: 'avion', label: 'Avion', title: 'Avions', icon: Plane },
]

export const TRANSPORT_TYPE_MAP = Object.fromEntries(TRANSPORT_TYPES.map((t) => [t.value, t]))
