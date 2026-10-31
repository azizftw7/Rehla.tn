import mongoose, { Schema } from 'mongoose';
import { pointSchema } from './pointSchema.js';

export const SERVICE_TYPES = ['hebergement', 'restaurant', 'activite', 'evenement', 'guide'];

const serviceSchema = new Schema(
  {
    type: {
      type: String,
      required: [true, 'Le type de service est obligatoire.'],
      enum: { values: SERVICE_TYPES, message: 'Type de service invalide.' },
    },
    name: {
      type: String,
      required: [true, 'Le nom du service est obligatoire.'],
      trim: true,
      maxlength: 120,
    },
    description: { type: String, trim: true, maxlength: 5000 },
    destination: {
      type: Schema.Types.ObjectId,
      ref: 'Destination',
      required: [true, 'La destination est obligatoire.'],
    },
    provider: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Le prestataire est obligatoire.'],
    },
    location: { type: pointSchema, required: [true, 'La localisation est obligatoire.'] },
    address: { type: String, trim: true, maxlength: 250 },

    // Soit un prix, soit free = true.
    price: {
      amount: { type: Number, min: [0, 'Le prix ne peut pas être négatif.'] },
      // Ex. « nuit », « personne », « repas » (montant en dinars tunisiens).
      unit: { type: String, trim: true, maxlength: 30 },
    },
    free: { type: Boolean, default: false },

    photos: { type: [String], default: [] },
    videoUrl: { type: String, trim: true },
    contact: {
      phone: { type: String, trim: true, maxlength: 30 },
      website: { type: String, trim: true },
    },

    // Champs propres à chaque type.
    cuisine: { type: String, trim: true }, // restaurant
    activityCategory: { type: String, trim: true }, // activite
    event: {
      // evenement
      startDate: Date,
      endDate: Date,
      hours: { type: String, trim: true }, // ex. « 20h – 23h »
    },
    languages: { type: [String], default: undefined }, // guide

    hidden: { type: Boolean, default: false },
    ratingAverage: { type: Number, default: 0, min: 0, max: 5 },
    ratingCount: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true, toJSON: { versionKey: false } },
);

serviceSchema.index({ location: '2dsphere' });
serviceSchema.index({ destination: 1, type: 1 });
serviceSchema.index({ provider: 1 });

serviceSchema.pre('validate', function () {
  if (!this.free && this.price?.amount == null) {
    this.invalidate('price.amount', 'Indiquez un prix ou précisez que le service est gratuit.');
  }
  if (this.type === 'evenement') {
    if (!this.event?.startDate) {
      this.invalidate('event.startDate', "La date de début de l'événement est obligatoire.");
    } else if (this.event.endDate && this.event.endDate < this.event.startDate) {
      this.invalidate('event.endDate', 'La date de fin doit être postérieure à la date de début.');
    }
  }
});

export const Service = mongoose.model('Service', serviceSchema);
