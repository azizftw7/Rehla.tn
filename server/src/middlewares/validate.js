import { ApiError } from '../utils/ApiError.js';

export function formatZodIssues(error) {
  return error.issues.map((issue) => ({ field: issue.path.join('.'), message: issue.message }));
}

/**
 * Valide req.body / req.query / req.params avec des schémas zod.
 * Les données validées (et converties) sont placées dans req.validated,
 * car req.query est en lecture seule sous Express 5.
 */
export function validate(schemas) {
  return (req, _res, next) => {
    req.validated ??= {};
    for (const key of ['params', 'query', 'body']) {
      if (!schemas[key]) continue;
      const result = schemas[key].safeParse(req[key] ?? {});
      if (!result.success) {
        return next(ApiError.badRequest('Données invalides.', formatZodIssues(result.error)));
      }
      req.validated[key] = result.data;
    }
    next();
  };
}
