/**
 * Erreur métier renvoyée au client au format { message, details }.
 * details : tableau facultatif de { field, message }.
 */
export class ApiError extends Error {
  constructor(status, message, details = []) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }

  static badRequest(message = 'Données invalides.', details) {
    return new ApiError(400, message, details);
  }

  static unauthorized(message = 'Authentification requise.') {
    return new ApiError(401, message);
  }

  static forbidden(message = "Vous n'avez pas les droits pour effectuer cette action.") {
    return new ApiError(403, message);
  }

  static notFound(message = 'Ressource introuvable.') {
    return new ApiError(404, message);
  }

  static conflict(message, details) {
    return new ApiError(409, message, details);
  }
}
