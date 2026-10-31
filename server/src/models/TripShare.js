import mongoose, { Schema } from 'mongoose';

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Champs du voyageur qu'on peut afficher sur un partage de déplacement.
 * Ne jamais y ajouter l'e-mail ni le téléphone.
 */
export const TRIP_SHARE_PUBLIC_USER_FIELDS = 'name profile avatarUrl';

const tripShareSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    destination: {
      type: Schema.Types.ObjectId,
      ref: 'Destination',
      required: [true, 'La destination est obligatoire.'],
    },
    startDate: { type: Date, required: [true, 'La date de départ est obligatoire.'] },
    endDate: { type: Date, required: [true, 'La date de retour est obligatoire.'] },
    message: {
      type: String,
      trim: true,
      maxlength: [200, 'Le message ne peut pas dépasser 200 caractères.'],
    },
    // Informations que le voyageur choisit de montrer (masquées par défaut sauf le profil).
    city: { type: String, trim: true, maxlength: 80 },
    languages: { type: [String], default: undefined },
    visible: {
      profile: { type: Boolean, default: true },
      city: { type: Boolean, default: false },
      languages: { type: Boolean, default: false },
      photo: { type: Boolean, default: false },
    },
    // Fin du jour de retour : MongoDB supprime le document après cette date (index TTL).
    expiresAt: { type: Date },
  },
  { timestamps: true, toJSON: { versionKey: false } },
);

tripShareSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
tripShareSchema.index({ destination: 1, startDate: 1 });

tripShareSchema.pre('validate', function () {
  if (this.startDate && this.endDate && this.endDate < this.startDate) {
    this.invalidate('endDate', 'La date de retour doit être postérieure à la date de départ.');
  }
  if (this.endDate) {
    this.expiresAt = new Date(this.endDate.getTime() + ONE_DAY_MS);
  }
});

export const TripShare = mongoose.model('TripShare', tripShareSchema);
