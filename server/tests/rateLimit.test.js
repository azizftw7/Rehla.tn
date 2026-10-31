import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import app from '../src/app.js';
import { env } from '../src/config/env.js';

describe('Limitation des tentatives sur /api/auth', () => {
  const originalNodeEnv = env.nodeEnv;
  afterEach(() => {
    env.nodeEnv = originalNodeEnv;
  });

  it('renvoie 429 avec un message JSON après 20 requêtes', async () => {
    // La limite est désactivée pendant les tests : on la réactive pour ce cas.
    env.nodeEnv = 'development';

    for (let i = 0; i < 20; i += 1) {
      const res = await request(app).post('/api/auth/register').send({});
      expect(res.status).toBe(400);
    }
    const res = await request(app).post('/api/auth/register').send({});

    expect(res.status).toBe(429);
    expect(res.body).toEqual({
      message: 'Trop de tentatives. Réessayez dans quelques minutes.',
      details: [],
    });
  });
});
