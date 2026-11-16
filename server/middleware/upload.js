import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/*
 * memoryStorage, deliberately: this app's rule is that user files belong in the
 * storage service (services/storage.js), and a disk temp file created by multer
 * *is* a local copy - written whatever the deployment was configured to do, and
 * left behind if the route then refused the file. The routes below hand the
 * buffer to saveUpload(), which owns the folder whitelist, the generated name,
 * the type policy and the Cloudinary-or-local decision in one place.
 *
 * `limits` stays here because the byte cap protects the request body from a
 * hostile upload before any of that runs.
 */
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif|webp|pdf/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);

  if (extname && mimetype) {
    cb(null, true);
  } else {
    cb(new Error('Only image files (JPEG, PNG, GIF, WebP) and PDF files are allowed.'), false);
  }
};

export const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
});

export const uploadProductImages = upload.array('productImages', 10);
export const uploadPrescription = upload.single('prescription');
export const uploadStoreLogo = upload.single('storeLogo');
export const uploadStoreBanner = upload.single('storeBanner');
export const uploadAvatar = upload.single('avatar');
export const uploadBlogImage = upload.single('coverImage');
export const uploadSingleImage = upload.single('image');
