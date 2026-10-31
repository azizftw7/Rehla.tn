import mongoose, { Schema } from 'mongoose';
import { normalizeText, slugify } from '../utils/text.js';
import { pointSchema } from './pointSchema.js';

const destinationSchema = new Schema(
  {
    name: {
      type: String,
      required: [true, 'Le nom de la destination est obligatoire.'],
      trim: true,
      maxlength: 100,
    },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    // Gouvernorat.
    region: { type: String, required: [true, 'La région est obligatoire.'], trim: true },
    description: { type: String, trim: true, maxlength: 5000 },
    location: { type: pointSchema, required: [true, 'La localisation est obligatoire.'] },
    coverImage: { type: String, trim: true },
    // Nom en minuscules et sans accents, pour la recherche (« ain » trouve « Aïn Draham »).
    nameNormalized: { type: String, index: true },
  },
  { timestamps: true, toJSON: { versionKey: false } },
);

destinationSchema.index({ location: '2dsphere' });

destinationSchema.pre('validate', function () {
  if (this.isModified('name') || !this.nameNormalized) {
    this.nameNormalized = normalizeText(this.name);
  }
  if (!this.slug && this.name) {
    this.slug = slugify(this.name);
  }
});

export const Destination = mongoose.model('Destination', destinationSchema);
