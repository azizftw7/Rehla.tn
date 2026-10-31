import mongoose, { Schema } from 'mongoose';

const reviewSchema = new Schema(
  {
    service: {
      type: Schema.Types.ObjectId,
      ref: 'Service',
      required: [true, 'Le service est obligatoire.'],
    },
    author: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    rating: {
      type: Number,
      required: [true, 'La note est obligatoire.'],
      min: [1, 'La note doit être comprise entre 1 et 5.'],
      max: [5, 'La note doit être comprise entre 1 et 5.'],
      validate: { validator: Number.isInteger, message: 'La note doit être un nombre entier.' },
    },
    comment: {
      type: String,
      trim: true,
      maxlength: [1000, 'Le commentaire ne peut pas dépasser 1000 caractères.'],
    },
    providerReply: {
      text: { type: String, trim: true, maxlength: 1000 },
      repliedAt: Date,
    },
  },
  { timestamps: true, toJSON: { versionKey: false } },
);

// Un seul avis par voyageur et par service.
reviewSchema.index({ service: 1, author: 1 }, { unique: true });

/** Recalcule ratingAverage et ratingCount du service. */
reviewSchema.statics.updateServiceRating = async function (serviceId) {
  const [stats] = await this.aggregate([
    { $match: { service: serviceId } },
    { $group: { _id: '$service', average: { $avg: '$rating' }, count: { $sum: 1 } } },
  ]);
  await mongoose.model('Service').findByIdAndUpdate(serviceId, {
    ratingAverage: stats ? Math.round(stats.average * 10) / 10 : 0,
    ratingCount: stats?.count ?? 0,
  });
};

reviewSchema.post('save', async function () {
  await this.constructor.updateServiceRating(this.service);
});

reviewSchema.post('deleteOne', { document: true, query: false }, async function () {
  await this.constructor.updateServiceRating(this.service);
});

reviewSchema.post('findOneAndDelete', async function (doc) {
  if (doc) await doc.constructor.updateServiceRating(doc.service);
});

export const Review = mongoose.model('Review', reviewSchema);
