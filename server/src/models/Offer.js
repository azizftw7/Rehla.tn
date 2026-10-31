import mongoose, { Schema } from 'mongoose';

const offerSchema = new Schema(
  {
    service: {
      type: Schema.Types.ObjectId,
      ref: 'Service',
      required: [true, 'Le service est obligatoire.'],
    },
    title: {
      type: String,
      required: [true, "Le titre de l'offre est obligatoire."],
      trim: true,
      maxlength: 120,
    },
    // Renseigner l'un ou l'autre.
    discountPercent: {
      type: Number,
      min: [1, 'La réduction doit être comprise entre 1 et 100 %.'],
      max: [100, 'La réduction doit être comprise entre 1 et 100 %.'],
    },
    discountedPrice: { type: Number, min: [0, 'Le prix réduit ne peut pas être négatif.'] },
    startDate: { type: Date, required: [true, 'La date de début est obligatoire.'] },
    endDate: { type: Date, required: [true, 'La date de fin est obligatoire.'] },
  },
  { timestamps: true, toJSON: { versionKey: false } },
);

offerSchema.index({ service: 1, endDate: 1 });

offerSchema.pre('validate', function () {
  const hasPercent = this.discountPercent != null;
  const hasPrice = this.discountedPrice != null;
  if (hasPercent === hasPrice) {
    this.invalidate(
      'discountPercent',
      'Indiquez soit un pourcentage de réduction, soit un prix réduit (pas les deux).',
    );
  }
  if (this.startDate && this.endDate && this.endDate < this.startDate) {
    this.invalidate('endDate', 'La date de fin doit être postérieure à la date de début.');
  }
});

export const Offer = mongoose.model('Offer', offerSchema);
