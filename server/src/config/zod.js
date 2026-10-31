import { z } from 'zod';

// Messages par défaut de zod en français (les schémas précisent leurs propres messages quand c'est utile).
z.config(z.locales.fr());
