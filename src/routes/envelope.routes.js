const express = require('express');
const router = express.Router();
const envelopeController = require('../controllers/envelopeController');
const { authenticate } = require('../middlewares/auth.middleware');
const { requireUser } = require('../middlewares/rbac.middleware');
const { validateBody } = require('../middlewares/validator.middleware');
const { envelopeSchemas } = require('../utils/validationSchemas');

/**
 * Routes de gestion des enveloppes
 * Base URL: /api/envelopes
 */

/**
 * @swagger
 * /api/envelopes:
 *   post:
 *     summary: Créer une enveloppe de signature
 *     description: Crée une nouvelle enveloppe et envoie les invitations aux signataires
 *     tags: [Envelopes]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - documentId
 *               - recipients
 *             properties:
 *               documentId:
 *                 type: string
 *                 description: ID du document à signer
 *               recipients:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     firstName:
 *                       type: string
 *                     lastName:
 *                       type: string
 *                     email:
 *                       type: string
 *                       format: email
 *                     role:
 *                       type: string
 *                       enum: [SIGNER, APPROVER, CC]
 *               workflow:
 *                 type: object
 *                 properties:
 *                   type:
 *                     type: string
 *                     enum: [SEQUENTIAL, PARALLEL]
 *               message:
 *                 type: string
 *     responses:
 *       201:
 *         description: Enveloppe créée avec succès
 */
router.post(
  '/',
  authenticate,
  requireUser,
  validateBody(envelopeSchemas.create),
  envelopeController.createEnvelope
);

/**
 * @swagger
 * /api/envelopes:
 *   get:
 *     summary: Liste toutes les enveloppes
 *     tags: [Envelopes]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Liste des enveloppes
 */
router.get('/', authenticate, requireUser, envelopeController.getAllEnvelopes);

/**
 * @swagger
 * /api/envelopes/{id}:
 *   get:
 *     summary: Obtenir une enveloppe
 *     tags: [Envelopes]
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
 *         description: Enveloppe trouvée
 */
router.get('/:id', authenticate, requireUser, envelopeController.getEnvelopeById);

/**
 * @swagger
 * /api/envelopes/{id}/cancel:
 *   post:
 *     summary: Annuler une enveloppe
 *     tags: [Envelopes]
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
 *               reason:
 *                 type: string
 *     responses:
 *       200:
 *         description: Enveloppe annulée
 */
router.post('/:id/cancel', authenticate, requireUser, envelopeController.cancelEnvelope);

/**
 * @swagger
 * /api/envelopes/{id}/resend/{recipientId}:
 *   post:
 *     summary: Renvoyer une invitation
 *     tags: [Envelopes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: recipientId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Invitation renvoyée
 */
router.post('/:id/resend/:recipientId', authenticate, requireUser, envelopeController.resendInvitation);

/**
 * @swagger
 * /api/envelopes/{id}/download:
 *   get:
 *     summary: Télécharger le PDF signé
 *     description: Télécharge le PDF final avec toutes les signatures
 *     tags: [Envelopes]
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
 *         description: Redirige vers le PDF signé
 */
router.get('/:id/download', authenticate, requireUser, envelopeController.downloadSignedPDF);

/**
 * @swagger
 * /api/envelopes/{id}:
 *   get:
 *     summary: Obtenir les détails d'une enveloppe
 *     description: Récupère tous les détails d'une enveloppe incluant signatures et champs
 *     tags: [Envelopes]
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
 *         description: Détails de l'enveloppe
 */
router.get('/:id', authenticate, requireUser, envelopeController.getEnvelopeDetails);

module.exports = router;
