const express = require('express');
const router = express.Router();
const documentController = require('../controllers/documentController');
const { authenticate } = require('../middlewares/auth.middleware');
const { requireUser } = require('../middlewares/rbac.middleware');
const { uploadSingle, requireFile } = require('../middlewares/upload.middleware');
const { validateBody } = require('../middlewares/validator.middleware');
const { documentSchemas } = require('../utils/validationSchemas');

/**
 * Routes de gestion des documents
 * Base URL: /api/documents
 */

/**
 * @swagger
 * /api/documents:
 *   post:
 *     summary: Upload un document PDF
 *     description: Upload un nouveau document PDF (Admin B2B ou User B2B)
 *     tags: [Documents]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - file
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: Fichier PDF (max 10 MB)
 *               title:
 *                 type: string
 *                 description: Titre du document
 *               description:
 *                 type: string
 *                 description: Description
 *               folder:
 *                 type: string
 *                 description: Dossier de classement
 *               tags:
 *                 type: string
 *                 description: Tags séparés par des virgules
 *               isTemplate:
 *                 type: boolean
 *                 description: Est-ce un modèle réutilisable
 *     responses:
 *       201:
 *         description: Document uploadé avec succès
 *       400:
 *         description: Fichier manquant ou invalide
 *       403:
 *         description: Limite mensuelle atteinte
 */
router.post(
  '/',
  authenticate,
  requireUser,
  uploadSingle,
  requireFile,
  documentController.uploadDocument
);

/**
 * @swagger
 * /api/documents:
 *   get:
 *     summary: Liste tous les documents
 *     description: Récupère la liste des documents avec pagination et filtres
 *     tags: [Documents]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [DRAFT, SENT, IN_PROGRESS, COMPLETED, CANCELLED]
 *       - in: query
 *         name: folder
 *         schema:
 *           type: string
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *       - in: query
 *         name: isTemplate
 *         schema:
 *           type: boolean
 *     responses:
 *       200:
 *         description: Liste des documents
 */
router.get('/', authenticate, requireUser, documentController.getAllDocuments);

/**
 * @swagger
 * /api/documents/{id}:
 *   get:
 *     summary: Obtenir un document par ID
 *     description: Récupère les détails d'un document spécifique
 *     tags: [Documents]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Document trouvé
 *       404:
 *         description: Document non trouvé
 */
router.get('/:id', authenticate, requireUser, documentController.getDocumentById);

/**
 * @swagger
 * /api/documents/{id}/download:
 *   get:
 *     summary: Télécharger un document
 *     description: Télécharge le fichier PDF original
 *     tags: [Documents]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Fichier téléchargé
 *         content:
 *           application/pdf:
 *             schema:
 *               type: string
 *               format: binary
 */
router.get('/:id/download', authenticate, requireUser, documentController.downloadDocument);

/**
 * @swagger
 * /api/documents/{id}:
 *   put:
 *     summary: Mettre à jour un document
 *     description: Met à jour les métadonnées d'un document
 *     tags: [Documents]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               folder:
 *                 type: string
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Document mis à jour
 */
router.put(
  '/:id',
  authenticate,
  requireUser,
  validateBody(documentSchemas.update),
  documentController.updateDocument
);

/**
 * @swagger
 * /api/documents/{id}:
 *   delete:
 *     summary: Supprimer un document
 *     description: Supprime définitivement un document et son fichier
 *     tags: [Documents]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Document supprimé
 */
router.delete('/:id', authenticate, requireUser, documentController.deleteDocument);

module.exports = router;
