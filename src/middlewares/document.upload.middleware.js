const multer = require('multer');
const path = require('path');
const { getStorageConfig } = require('../config/storage');

// Utiliser la configuration centralisée de stockage
// Digital Ocean Spaces ou stockage local selon les variables d'environnement
const storage = getStorageConfig();

// Filtrer les types de fichiers
const fileFilter = (req, file, cb) => {
  const allowedMimes = [
    'application/pdf',
    'application/msword', // .doc
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
  ];

  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new Error(
        'Type de fichier non autorisé. Seuls les PDF, DOC et DOCX sont acceptés.'
      ),
      false
    );
  }
};

// Configuration de multer
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50 MB
  },
});

// Middleware pour upload d'un seul fichier
const uploadSingleDocument = upload.single('document');

// Wrapper pour gérer les erreurs multer
const handleUploadErrors = (req, res, next) => {
  uploadSingleDocument(req, res, function (err) {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          success: false,
          message: 'Le fichier est trop volumineux. Taille maximale: 50 MB',
        });
      }
      return res.status(400).json({
        success: false,
        message: `Erreur d'upload: ${err.message}`,
      });
    } else if (err) {
      return res.status(400).json({
        success: false,
        message: err.message,
      });
    }
    next();
  });
};

module.exports = {
  uploadSingleDocument: handleUploadErrors,
};
