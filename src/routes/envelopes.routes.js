const express = require('express');
const router = express.Router();
const envelopeController = require('../controllers/envelope.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { requireUser } = require('../middlewares/rbac.middleware');

/**
 * Routes pour les enveloppes
 * Base URL: /api/envelopes
 */

// Créer une nouvelle enveloppe
router.post('/', authenticate, requireUser, envelopeController.createEnvelope);

// Récupérer toutes les enveloppes
router.get('/', authenticate, requireUser, envelopeController.getEnvelopes);

// Récupérer une enveloppe par ID
router.get('/:id', authenticate, requireUser, envelopeController.getEnvelopeById);

// Envoyer une enveloppe (déclenche l'envoi des emails)
router.post('/:id/send', authenticate, requireUser, envelopeController.sendEnvelope);

// Annuler une enveloppe
router.post('/:id/cancel', authenticate, requireUser, envelopeController.cancelEnvelope);

// Supprimer une enveloppe
router.delete('/:id', authenticate, requireUser, envelopeController.deleteEnvelope);

module.exports = router;
