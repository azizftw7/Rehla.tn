import multer from 'multer';
import { ApiError } from '../utils/ApiError.js';

export const MAX_PHOTOS = 5;
export const MAX_PHOTO_SIZE = 5 * 1024 * 1024; // 5 Mo
export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

const MULTER_MESSAGES = {
  LIMIT_FILE_SIZE: 'Chaque photo doit peser au plus 5 Mo.',
  LIMIT_FILE_COUNT: `Vous pouvez envoyer au plus ${MAX_PHOTOS} photos.`,
  LIMIT_UNEXPECTED_FILE: `Vous pouvez envoyer au plus ${MAX_PHOTOS} photos (champ « photos »).`,
  LIMIT_FIELD_COUNT: 'Le formulaire contient trop de champs.',
  LIMIT_FIELD_VALUE: 'Un des champs du formulaire est trop long.',
  LIMIT_PART_COUNT: 'Le formulaire contient trop de champs.',
};

const photosUpload = multer({
  // Les fichiers restent en mémoire : ils sont envoyés directement à Cloudinary.
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_PHOTO_SIZE, files: MAX_PHOTOS, fields: 40, fieldSize: 10 * 1024 },
  fileFilter(_req, file, cb) {
    if (ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        ApiError.badRequest('Format de photo non accepté.', [
          {
            field: 'photos',
            message: `« ${file.originalname} » n'est pas une image JPEG, PNG ou WebP.`,
          },
        ]),
      );
    }
  },
}).array('photos', MAX_PHOTOS);

/** Lit un formulaire multipart (champ « photos », 5 images de 5 Mo max) et traduit les erreurs. */
export function uploadPhotos(req, res, next) {
  photosUpload(req, res, (err) => {
    if (!err) return next();
    if (err instanceof multer.MulterError) {
      const message = MULTER_MESSAGES[err.code] ?? 'Le formulaire envoyé est invalide.';
      return next(ApiError.badRequest(message, [{ field: 'photos', message }]));
    }
    next(err);
  });
}
