import { cloudinary, isCloudinaryConfigured } from '../config/cloudinary.js';
import { ApiError } from './ApiError.js';

export const SERVICES_FOLDER = 'rehla/services';

const UPLOAD_UNAVAILABLE =
  "L'envoi des photos est momentanément indisponible. Réessayez dans quelques instants.";

/** Envoie un fichier en mémoire (buffer) vers Cloudinary et renvoie son URL https. */
export function uploadImage(buffer, folder = SERVICES_FOLDER) {
  if (!isCloudinaryConfigured()) {
    return Promise.reject(new ApiError(503, UPLOAD_UNAVAILABLE));
  }
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, resource_type: 'image' },
      (error, result) => {
        if (error || !result) {
          if (error) console.error('[Cloudinary]', error.message ?? error);
          reject(new ApiError(503, UPLOAD_UNAVAILABLE));
          return;
        }
        resolve(result.secure_url);
      },
    );
    stream.end(buffer);
  });
}

/** Envoie plusieurs fichiers multer (memoryStorage) et renvoie leurs URL, dans l'ordre. */
export function uploadImages(files = [], folder = SERVICES_FOLDER) {
  return Promise.all(files.map((file) => uploadImage(file.buffer, folder)));
}

const CLOUDINARY_URL =
  /^https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\/(?:v\d+\/)?(.+)\.[a-z0-9]+$/i;

/**
 * Identifiant Cloudinary (public_id) d'une photo envoyée par Rehla.tn, ou null pour une autre URL
 * (ex. photo du seed hébergée ailleurs) : on ne supprime que nos propres fichiers.
 * https://res.cloudinary.com/<cloud>/image/upload/v123/rehla/services/abc.png → rehla/services/abc
 */
export function publicIdFromUrl(url, folder = SERVICES_FOLDER) {
  if (typeof url !== 'string') return null;
  const publicId = CLOUDINARY_URL.exec(url)?.[1];
  return publicId?.startsWith(`${folder}/`) ? publicId : null;
}

/**
 * Supprime des photos sur Cloudinary sans jamais faire échouer la requête :
 * la fiche est déjà à jour, une photo restée sur Cloudinary est seulement journalisée.
 */
export async function deleteImages(urls = []) {
  const publicIds = urls.map((url) => publicIdFromUrl(url)).filter(Boolean);
  if (publicIds.length === 0 || !isCloudinaryConfigured()) return;
  const results = await Promise.allSettled(
    publicIds.map((publicId) => cloudinary.uploader.destroy(publicId, { resource_type: 'image' })),
  );
  results.forEach((result, index) => {
    if (result.status === 'rejected') {
      console.error(
        `[Cloudinary] Suppression impossible de ${publicIds[index]} :`,
        result.reason?.message ?? result.reason,
      );
    }
  });
}
