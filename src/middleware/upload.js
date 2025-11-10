const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Create upload directories if they don't exist
const uploadDir = path.join(__dirname, '../../uploads');
const avatarsDir = path.join(uploadDir, 'avatars');

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

if (!fs.existsSync(avatarsDir)) {
  fs.mkdirSync(avatarsDir, { recursive: true });
}

// Storage configuration for avatars
const avatarStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, avatarsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname);
    cb(null, `avatar-${req.user._id}-${uniqueSuffix}${ext}`);
  },
});

// File filter for images only
const imageFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);

  if (extname && mimetype) {
    return cb(null, true);
  } else {
    cb(new Error('Seules les images sont autorisées (JPEG, PNG, GIF)'));
  }
};

// Avatar upload middleware
const uploadAvatar = multer({
  storage: avatarStorage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB max
  },
  fileFilter: imageFilter,
}).single('avatar');

module.exports = {
  uploadAvatar,
};
