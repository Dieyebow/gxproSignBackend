const multer = require('multer');
const path = require('path');
const { getStorageConfig } = require('../config/storage');

/**
 * Configuration Multer pour l'upload de fichiers
 * Utilise Digital Ocean Spaces ou stockage local selon la configuration
 */

// Utiliser la configuration centralisée de stockage
const storage = getStorageConfig();

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
    console.log('🔧 [UPLOAD MIDDLEWARE] Début de l\'upload');
    console.log('  req.headers:', req.headers);
    console.log('  Content-Type:', req.get('content-type'));

    uploadMiddleware(req, res, (err) => {
      console.log('🔧 [UPLOAD MIDDLEWARE] Callback appelé');
      console.log('  err:', err);
      console.log('  req.file:', req.file);
      console.log('  req.files:', req.files);

      if (err instanceof multer.MulterError) {
        console.error('❌ [UPLOAD MIDDLEWARE] Erreur Multer:', err.code, err.message);
        console.error('  Erreur complète:', err);
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
        console.error('❌ [UPLOAD MIDDLEWARE] Erreur:', err);
        console.error('  Type:', err.constructor.name);
        console.error('  Message:', err.message);
        console.error('  Stack:', err.stack);
        console.error('  Code:', err.code);
        console.error('  Errno:', err.errno);
        // Autre erreur (ex: type de fichier non autorisé)
        return res.status(400).json({
          success: false,
          message: err.message || 'Erreur lors de l\'upload',
          error: err.toString(),
        });
      }

      console.log('✅ [UPLOAD MIDDLEWARE] Upload réussi');
      console.log('  req.file:', JSON.stringify(req.file, null, 2));
      // Pas d'erreur, continuer
      next();
    });
  };
};

/**
 * Middleware pour vérifier qu'un fichier a été uploadé
 */
const requireFile = (req, res, next) => {
  console.log('🔧 [REQUIRE FILE] Vérification du fichier');
  console.log('  req.file:', req.file);
  console.log('  req.files:', req.files);

  if (!req.file && !req.files) {
    console.error('❌ [REQUIRE FILE] Aucun fichier trouvé');
    return res.status(400).json({
      success: false,
      message: 'Aucun fichier n\'a été fourni.',
    });
  }

  console.log('✅ [REQUIRE FILE] Fichier trouvé');
  next();
};

module.exports = {
  uploadSingle: handleUploadError(uploadSingle),
  uploadMultiple: handleUploadError(uploadMultiple),
  requireFile,
};
