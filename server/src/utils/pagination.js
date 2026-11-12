import { z } from 'zod';

export const MAX_LIMIT = 100;

export const paginationQuery = {
  page: z.coerce
    .number({ error: 'La page doit être un nombre.' })
    .int('La page doit être un nombre entier.')
    .min(1, 'La page doit être supérieure ou égale à 1.')
    .default(1),
  limit: z.coerce
    .number({ error: 'La limite doit être un nombre.' })
    .int('La limite doit être un nombre entier.')
    .min(1, 'La limite doit être supérieure ou égale à 1.')
    .max(MAX_LIMIT, `La limite ne peut pas dépasser ${MAX_LIMIT}.`)
    .default(20),
};

export async function paginate(
  Model,
  filter,
  { page = 1, limit = 20, sort = { _id: 1 }, select, populate } = {},
) {
  let query = Model.find(filter)
    .select(select)
    .sort(sort)
    .skip((page - 1) * limit)
    .limit(limit);

  if (populate) {
    query = query.populate(populate);
  }

  const [items, total] = await Promise.all([
    query,
    Model.countDocuments(filter),
  ]);
  return { items, total, page, pages: Math.ceil(total / limit) };
}