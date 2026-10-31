import mongoose, { Schema } from 'mongoose';

export const TRANSPORT_TYPES = ['bus', 'louage', 'train', 'ferry', 'avion'];

const transportSchema = new Schema(
  {
    type: {
      type: String,
      required: [true, 'Le type de transport est obligatoire.'],
      enum: { values: TRANSPORT_TYPES, message: 'Type de transport invalide.' },
    },
    from: { type: String, required: [true, 'La ville de départ est obligatoire.'], trim: true },
    to: { type: String, required: [true, "La ville d'arrivée est obligatoire."], trim: true },
    destination: { type: Schema.Types.ObjectId, ref: 'Destination' },
    price: { type: Number, min: [0, 'Le prix ne peut pas être négatif.'] }, // en dinars
    duration: { type: Number, min: 0 }, // en minutes
    schedule: { type: String, trim: true }, // ex. « Départs à 6h, 10h et 15h »
    operator: { type: String, trim: true },
    // Origine de l'information (site de l'opérateur, saisie manuelle…) et date de mise à jour.
    source: { type: String, trim: true },
    sourceUpdatedAt: { type: Date },
  },
  { timestamps: true, toJSON: { versionKey: false } },
);

transportSchema.index({ destination: 1, type: 1 });

export const Transport = mongoose.model('Transport', transportSchema);
