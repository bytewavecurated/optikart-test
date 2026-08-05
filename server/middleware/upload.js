import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    let uploadDir = 'uploads';

    if (file.fieldname === 'productImage' || file.fieldname === 'productImages') {
      uploadDir = 'uploads/products';
    } else if (file.fieldname === 'prescription') {
      uploadDir = 'uploads/prescriptions';
    } else if (file.fieldname === 'storeLogo' || file.fieldname === 'storeBanner') {
      uploadDir = 'uploads/store';
    } else if (file.fieldname === 'avatar') {
      uploadDir = 'uploads/avatars';
    } else if (file.fieldname === 'blogImage' || file.fieldname === 'coverImage') {
      uploadDir = 'uploads/blogs';
    }

    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, file.fieldname + '-' + uniqueSuffix + ext);
  }
});

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
    fileSize: 5 * 1024 * 1024
  }
});

export const uploadProductImages = upload.array('productImages', 10);
export const uploadPrescription = upload.single('prescription');
export const uploadStoreLogo = upload.single('storeLogo');
export const uploadStoreBanner = upload.single('storeBanner');
export const uploadAvatar = upload.single('avatar');
export const uploadBlogImage = upload.single('coverImage');
export const uploadSingleImage = upload.single('image');
