import bcrypt from 'bcryptjs';
import mongoose, { Schema } from 'mongoose';

export const ROLES = ['voyageur', 'prestataire', 'admin'];
export const TRAVELER_PROFILES = ['etudiant', 'resident', 'touriste'];
export const USER_STATUSES = ['actif', 'suspendu'];

const SALT_ROUNDS = 10;

const providerSchema = new Schema(
  {
    businessName: { type: String, trim: true, maxlength: 120 },
    activityType: { type: String, trim: true, maxlength: 60 },
    city: { type: String, trim: true, maxlength: 80 },
    phone: { type: String, trim: true, maxlength: 30 },
  },
  { _id: false },
);

const userSchema = new Schema(
  {
    name: {
      type: String,
      required: [true, 'Le nom est obligatoire.'],
      trim: true,
      maxlength: [100, 'Le nom ne peut pas dépasser 100 caractères.'],
    },
    email: {
      type: String,
      required: [true, "L'adresse e-mail est obligatoire."],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "L'adresse e-mail n'est pas valide."],
    },
    password: {
      type: String,
      required: [true, 'Le mot de passe est obligatoire.'],
      minlength: [8, 'Le mot de passe doit contenir au moins 8 caractères.'],
      select: false,
    },
    role: {
      type: String,
      enum: { values: ROLES, message: 'Rôle invalide.' },
      default: 'voyageur',
    },
    // Réservé aux voyageurs.
    profile: {
      type: String,
      enum: { values: TRAVELER_PROFILES, message: 'Profil invalide.' },
    },
    // Réservé aux prestataires.
    provider: { type: providerSchema, default: undefined },
    avatarUrl: { type: String, trim: true },
    status: {
      type: String,
      enum: { values: USER_STATUSES, message: 'Statut invalide.' },
      default: 'actif',
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret) {
        delete ret.password;
        delete ret.__v;
        return ret;
      },
    },
  },
);

const REQUIRED_PROVIDER_FIELDS = {
  businessName: 'Le nom commercial est obligatoire.',
  activityType: "Le type d'activité est obligatoire.",
  city: 'La ville est obligatoire.',
  phone: 'Le numéro de téléphone est obligatoire.',
};

userSchema.pre('validate', function () {
  if (this.role !== 'prestataire') return;
  for (const [field, message] of Object.entries(REQUIRED_PROVIDER_FIELDS)) {
    if (!this.provider?.[field]) this.invalidate(`provider.${field}`, message);
  }
});

// La longueur minimale est vérifiée sur le mot de passe en clair, avant le hachage.
userSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, SALT_ROUNDS);
});

/** Nécessite d'avoir chargé le mot de passe avec .select('+password'). */
userSchema.methods.comparePassword = function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

export const User = mongoose.model('User', userSchema);
