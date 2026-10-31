import { Schema } from 'mongoose';

function isValidLngLat(coordinates) {
  if (!Array.isArray(coordinates) || coordinates.length !== 2) return false;
  const [lng, lat] = coordinates;
  return lng >= -180 && lng <= 180 && lat >= -90 && lat <= 90;
}

/**
 * Point GeoJSON : coordinates = [longitude, latitude] (attention à l'ordre, Leaflet utilise [lat, lng]).
 * Le schéma parent doit déclarer un index 2dsphere sur ce champ.
 */
export const pointSchema = new Schema(
  {
    type: { type: String, enum: ['Point'], default: 'Point', required: true },
    coordinates: {
      type: [Number],
      default: undefined,
      required: [true, 'Les coordonnées sont obligatoires.'],
      validate: {
        validator: isValidLngLat,
        message: 'Coordonnées invalides : [longitude, latitude] attendu.',
      },
    },
  },
  { _id: false },
);
