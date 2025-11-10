const multer = require('multer');
const path = require('path');
const fs = require('fs');

/**
 * Configuration Multer pour l'upload de fichiers
 */

// Créer le dossier uploads s'il n'existe pas
const uploadDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configuration du stockage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Organiser par client
    const clientId = req.user?.clientId || 'public';
    const clientDir = path.join(uploadDir, clientId.toString());

    if (!fs.existsSync(clientDir)) {
      fs.mkdirSync(clientDir, { recursive: true });
    }

    cb(null, clientDir);
  },
  filename: (req, file, cb) => {
    // Générer un nom de fichier unique
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    const basename = path.basename(file.originalname, ext);
    const filename = `${basename}-${uniqueSuffix}${ext}`;

    cb(null, filename);
  },
});

// Filtre pour accepter uniquement les PDF
const fileFilter = (req, file, cb) => {
  const allowedMimeTypes = ['application/pdf'];
  const allowedExtensions = ['.pdf'];

  const ext = path.extname(file.originalname).toLowerCase();
  const mimeType = file.mimetype;

  if (allowedMimeTypes.includes(mimeType) && allowedExtensions.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Seuls les fichiers PDF sont acceptés.'), false);
  }
};

// Configuration de Multer
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB max
  },
});

/**
 * Middleware pour upload d'un seul fichier
 */
const uploadSingle = upload.single('file');

/**
 * Middleware pour upload de plusieurs fichiers
 */
const uploadMultiple = upload.array('files', 10); // Max 10 fichiers

/**
 * Wrapper pour gérer les erreurs Multer
 */
const handleUploadError = (uploadMiddleware) => {
  return (req, res, next) => {
    uploadMiddleware(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        // Erreur Multer
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({
            success: false,
            message: 'Le fichier est trop volumineux. Taille maximale : 10 MB.',
          });
        }
        if (err.code === 'LIMIT_FILE_COUNT') {
          return res.status(400).json({
            success: false,
            message: 'Trop de fichiers. Maximum : 10 fichiers.',
          });
        }
        return res.status(400).json({
          success: false,
          message: `Erreur d'upload : ${err.message}`,
        });
      } else if (err) {
        // Autre erreur (ex: type de fichier non autorisé)
        return res.status(400).json({
          success: false,
          message: err.message,
        });
      }

      // Pas d'erreur, continuer
      next();
    });
  };
};

/**
 * Middleware pour vérifier qu'un fichier a été uploadé
 */
const requireFile = (req, res, next) => {
  if (!req.file && !req.files) {
    return res.status(400).json({
      success: false,
      message: 'Aucun fichier n\'a été fourni.',
    });
  }
  next();
};

module.exports = {
  uploadSingle: handleUploadError(uploadSingle),
  uploadMultiple: handleUploadError(uploadMultiple),
  requireFile,
};
