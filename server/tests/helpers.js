import { User } from '../src/models/index.js';
import { signToken } from '../src/utils/token.js';

export const TEST_PASSWORD = 'motdepasse1';

const defaultsByRole = {
  voyageur: { profile: 'touriste' },
  prestataire: {
    provider: {
      businessName: 'Maison Test',
      activityType: 'hebergement',
      city: 'Tozeur',
      phone: '+216 70 000 000',
    },
  },
  admin: {},
};

let counter = 0;

/** Crée un utilisateur en base (mot de passe : TEST_PASSWORD). */
export function createUser(overrides = {}) {
  counter += 1;
  const role = overrides.role ?? 'voyageur';
  return User.create({
    name: `Utilisateur ${counter}`,
    email: `user${counter}@example.com`,
    password: TEST_PASSWORD,
    role,
    ...defaultsByRole[role],
    ...overrides,
  });
}

/** En-tête Authorization pour l'utilisateur donné. */
export function authHeader(user) {
  return { Authorization: `Bearer ${signToken(user)}` };
}
