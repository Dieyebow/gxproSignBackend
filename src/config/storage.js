const AWS = require('aws-sdk');
const multer = require('multer');
const multerS3 = require('multer-s3');
const path = require('path');

/**
 * Configuration du stockage - Digital Ocean Spaces ou Local
 */

// Déterminer le type de stockage selon les variables d'environnement
const useSpaces = process.env.DO_SPACES_KEY && process.env.DO_SPACES_SECRET;

let spacesEndpoint, s3Client;

if (useSpaces) {
  // Configuration Digital Ocean Spaces
  spacesEndpoint = new AWS.Endpoint(process.env.DO_SPACES_ENDPOINT);

  s3Client = new AWS.S3({
    endpoint: spacesEndpoint,
    accessKeyId: process.env.DO_SPACES_KEY,
    secretAccessKey: process.env.DO_SPACES_SECRET,
    region: process.env.DO_SPACES_REGION || 'tor1',
    httpOptions: {
      timeout: 30000, // 30 secondes
      connectTimeout: 5000, // 5 secondes pour la connexion
    },
    maxRetries: 3,
  });

  console.log('✅ Stockage configuré: Digital Ocean Spaces');
  console.log(`📦 Bucket: ${process.env.DO_SPACES_BUCKET}`);
} else {
  console.log('⚠️  Stockage configuré: Local (uploads/)');
  console.log('💡 Configurez DO_SPACES_KEY et DO_SPACES_SECRET pour utiliser Spaces');
}

/**
 * Configuration Multer pour upload
 * MÉTHODE: Upload temporaire local puis transfert vers Spaces
 */
const getStorageConfig = () => {
  // TOUJOURS utiliser le stockage local temporaire
  // Même si Spaces est configuré, on upload d'abord localement
  // puis on transfert vers Spaces dans le controller
  const fs = require('fs');
  const uploadDir = path.join(__dirname, '../../uploads/temp');

  console.log('🔧 [STORAGE CONFIG] Configuration stockage local temporaire');
  console.log('  Répertoire:', uploadDir);

  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
    console.log('  ✅ Répertoire créé');
  }

  return multer.diskStorage({
    destination: (req, file, cb) => {
      console.log('📦 [DISK STORAGE] destination() appelé');
      console.log('  file.originalname:', file.originalname);

      // Créer un sous-dossier par client si possible
      const clientId = req.user?.clientId || 'temp';
      const clientDir = path.join(uploadDir, clientId.toString());

      if (!fs.existsSync(clientDir)) {
        fs.mkdirSync(clientDir, { recursive: true });
        console.log('  ✅ Sous-dossier client créé:', clientDir);
      }

      console.log('  ✅ Destination:', clientDir);
      cb(null, clientDir);
    },
    filename: (req, file, cb) => {
      console.log('📦 [DISK STORAGE] filename() appelé');

      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      const ext = path.extname(file.originalname);
      const basename = path.basename(file.originalname, ext);
      const filename = `${basename}-${uniqueSuffix}${ext}`;

      console.log('  ✅ Nom de fichier généré:', filename);
      cb(null, filename);
    },
  });
};

/**
 * Utilitaires pour gérer les fichiers
 */
const storageUtils = {
  /**
   * Transférer un fichier local vers Spaces
   */
  uploadToSpaces: async (localFilePath, destinationKey, contentType = 'application/pdf') => {
    if (!useSpaces) {
      console.log('⚠️  Spaces non configuré, fichier reste en local');
      return null;
    }

    try {
      const fs = require('fs');
      console.log('📤 [UPLOAD TO SPACES] Début du transfert');
      console.log('  Fichier local:', localFilePath);
      console.log('  Destination Spaces:', destinationKey);

      // Lire le fichier local
      const fileBuffer = fs.readFileSync(localFilePath);
      console.log('  ✅ Fichier lu:', fileBuffer.length, 'bytes');

      // Upload vers Spaces
      const params = {
        Bucket: process.env.DO_SPACES_BUCKET,
        Key: destinationKey,
        Body: fileBuffer,
        ACL: 'public-read',
        ContentType: contentType,
        Metadata: {
          uploadedAt: new Date().toISOString(),
        },
      };

      console.log('  🚀 Upload vers Spaces...');
      const result = await s3Client.upload(params).promise();

      console.log('  ✅ Upload réussi!');
      console.log('  URL:', result.Location);

      return {
        location: result.Location,
        key: result.Key,
        bucket: result.Bucket,
        etag: result.ETag,
      };
    } catch (error) {
      console.error('❌ [UPLOAD TO SPACES] Erreur:', error);
      console.error('  Message:', error.message);
      console.error('  Code:', error.code);
      throw error;
    }
  },

  /**
   * Supprimer un fichier local
   */
  deleteLocalFile: async (filePath) => {
    try {
      const fs = require('fs');
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log(`✅ Fichier local supprimé: ${filePath}`);
        return true;
      }
      return false;
    } catch (error) {
      console.error(`❌ Erreur suppression locale: ${error.message}`);
      throw error;
    }
  },

  /**
   * Supprimer un fichier
   */
  deleteFile: async (fileKey) => {
    if (useSpaces) {
      // Supprimer de Spaces
      const params = {
        Bucket: process.env.DO_SPACES_BUCKET,
        Key: fileKey,
      };

      try {
        await s3Client.deleteObject(params).promise();
        console.log(`✅ Fichier supprimé de Spaces: ${fileKey}`);
        return true;
      } catch (error) {
        console.error(`❌ Erreur suppression Spaces: ${error.message}`);
        throw error;
      }
    } else {
      // Supprimer du stockage local
      const fs = require('fs');
      try {
        if (fs.existsSync(fileKey)) {
          fs.unlinkSync(fileKey);
          console.log(`✅ Fichier supprimé localement: ${fileKey}`);
          return true;
        }
      } catch (error) {
        console.error(`❌ Erreur suppression locale: ${error.message}`);
        throw error;
      }
    }
  },

  /**
   * Obtenir une URL signée (temporaire) pour accéder à un fichier
   */
  getSignedUrl: async (fileKey, expiresIn = 3600) => {
    if (useSpaces) {
      const params = {
        Bucket: process.env.DO_SPACES_BUCKET,
        Key: fileKey,
        Expires: expiresIn, // Secondes
      };

      try {
        const url = await s3Client.getSignedUrlPromise('getObject', params);
        return url;
      } catch (error) {
        console.error(`❌ Erreur génération URL signée: ${error.message}`);
        throw error;
      }
    } else {
      // Pour le stockage local, retourner le chemin relatif
      return `/uploads/${fileKey}`;
    }
  },

  /**
   * Vérifier si un fichier existe
   */
  fileExists: async (fileKey) => {
    if (useSpaces) {
      const params = {
        Bucket: process.env.DO_SPACES_BUCKET,
        Key: fileKey,
      };

      try {
        await s3Client.headObject(params).promise();
        return true;
      } catch (error) {
        return false;
      }
    } else {
      const fs = require('fs');
      return fs.existsSync(fileKey);
    }
  },
};

module.exports = {
  getStorageConfig,
  storageUtils,
  useSpaces,
  s3Client,
};
