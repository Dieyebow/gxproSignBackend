const express = require('express');
const router = express.Router();
const documentController = require('../controllers/document.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { requireUser } = require('../middlewares/rbac.middleware');
const { uploadSingleDocument } = require('../middlewares/document.upload.middleware');

/**
 * Routes pour les documents
 * Base URL: /api/documents
 */

// Upload un nouveau document
router.post('/upload', authenticate, requireUser, uploadSingleDocument, documentController.uploadDocument);

// Récupérer tous les documents
router.get('/', authenticate, requireUser, documentController.getDocuments);

// Récupérer un document par ID
router.get('/:id', authenticate, requireUser, documentController.getDocumentById);

// Mettre à jour un document
router.put('/:id', authenticate, requireUser, documentController.updateDocument);

// Archiver un document
router.post('/:id/archive', authenticate, requireUser, documentController.archiveDocument);

// Supprimer un document
router.delete('/:id', authenticate, requireUser, documentController.deleteDocument);

module.exports = router;
