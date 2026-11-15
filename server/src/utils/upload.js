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
