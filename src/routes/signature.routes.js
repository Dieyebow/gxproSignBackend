const express = require('express');
const router = express.Router();
const signatureController = require('../controllers/signatureController');

/**
 * Routes publiques pour la signature (via token)
 * Base URL: /api/sign
 * Ces routes sont PUBLIQUES (pas d'authentification requise)
 */

/**
 * @swagger
 * /api/sign/{token}:
 *   get:
 *     summary: Obtenir les informations de signature
 *     description: Récupère le document et les champs à signer (accès public via token unique)
 *     tags: [Signatures]
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *         description: Token unique reçu par email
 *     responses:
 *       200:
 *         description: Informations de signature
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     envelope:
 *                       type: object
 *                     document:
 *                       type: object
 *                     recipient:
 *                       type: object
 *                     fields:
 *                       type: array
 *       404:
 *         description: Lien invalide ou expiré
 *       410:
 *         description: Lien expiré
 */
router.get('/:token', signatureController.getSignatureInfo);

/**
 * @swagger
 * /api/sign/{token}:
 *   post:
 *     summary: Signer le document
 *     description: Enregistre la signature du signataire
 *     tags: [Signatures]
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - signatureData
 *             properties:
 *               signatureData:
 *                 type: object
 *                 properties:
 *                   method:
 *                     type: string
 *                     enum: [DRAW, TEXT, UPLOAD]
 *                   data:
 *                     type: string
 *                     description: Base64 de la signature
 *               fields:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     fieldId:
 *                       type: string
 *                     value:
 *                       type: string
 *               geolocation:
 *                 type: object
 *                 properties:
 *                   latitude:
 *                     type: number
 *                   longitude:
 *                     type: number
 *     responses:
 *       200:
 *         description: Signature enregistrée
 *       400:
 *         description: Document déjà signé
 *       404:
 *         description: Lien invalide
 */
router.post('/:token', signatureController.signDocument);

/**
 * @swagger
 * /api/sign/{token}/decline:
 *   post:
 *     summary: Refuser de signer
 *     description: Refuse de signer le document
 *     tags: [Signatures]
 *     parameters:
 *       - in: path
 *         name: token
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
 *                 description: Raison du refus
 *     responses:
 *       200:
 *         description: Refus enregistré
 */
router.post('/:token/decline', signatureController.declineSignature);

module.exports = router;
