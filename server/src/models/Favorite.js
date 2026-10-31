import mongoose, { Schema } from 'mongoose';

const favoriteSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    service: {
      type: Schema.Types.ObjectId,
      ref: 'Service',
      required: [true, 'Le service est obligatoire.'],
    },
  },
  { timestamps: true, toJSON: { versionKey: false } },
);

favoriteSchema.index({ user: 1, service: 1 }, { unique: true });

export const Favorite = mongoose.model('Favorite', favoriteSchema);
