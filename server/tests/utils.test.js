import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { Destination } from '../src/models/index.js';
import { paginate, paginationQuery } from '../src/utils/pagination.js';
import { escapeRegex, normalizeText, slugify } from '../src/utils/text.js';

describe('utils/text', () => {
  it('retire les accents et met en minuscules', () => {
    expect(normalizeText('  Aïn Draham ')).toBe('ain draham');
    expect(normalizeText('Gabès')).toBe('gabes');
  });

  it('construit un slug', () => {
    expect(slugify('Sidi Bou Saïd')).toBe('sidi-bou-said');
    expect(slugify("L'Île de Djerba !")).toBe('l-ile-de-djerba');
  });

  it('échappe les caractères spéciaux des expressions régulières', () => {
    expect(new RegExp(escapeRegex('a.b(c')).test('a.b(c')).toBe(true);
    expect(new RegExp(escapeRegex('a.b')).test('axb')).toBe(false);
  });
});

describe('utils/pagination', () => {
  const query = z.object(paginationQuery);

  it('applique les valeurs par défaut et convertit les chaînes', () => {
    expect(query.parse({})).toEqual({ page: 1, limit: 20 });
    expect(query.parse({ page: '2', limit: '5' })).toEqual({ page: 2, limit: 5 });
  });

  it('refuse une limite trop grande', () => {
    expect(query.safeParse({ limit: '500' }).success).toBe(false);
  });

  it('renvoie { items, total, page, pages }', async () => {
    await Destination.create(
      ['A', 'B', 'C'].map((name, i) => ({
        name,
        region: 'R',
        location: { type: 'Point', coordinates: [10 + i, 35] },
      })),
    );

    const result = await paginate(Destination, {}, { page: 2, limit: 2, sort: { name: 1 } });

    expect(result.total).toBe(3);
    expect(result.page).toBe(2);
    expect(result.pages).toBe(2);
    expect(result.items.map((d) => d.name)).toEqual(['C']);
  });
});
