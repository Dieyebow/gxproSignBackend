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

// Télécharger le PDF signé (doit être avant /:id pour éviter les conflits de routing)
router.get('/:id/download', (req, res, next) => {
  console.log('\n🎯 ROUTE DOWNLOAD MATCHED!');
  console.log('  Path:', req.path);
  console.log('  Params:', req.params);
  console.log('  Headers auth:', req.headers.authorization ? 'Présent' : 'ABSENT');
  next();
}, authenticate, requireUser, envelopeController.downloadSignedPDF);

// Récupérer les détails complets d'une enveloppe (avec signatures et champs)
router.get('/:id/details', authenticate, requireUser, envelopeController.getEnvelopeDetails);

// Récupérer une enveloppe par ID
router.get('/:id', authenticate, requireUser, envelopeController.getEnvelopeById);

// Envoyer une enveloppe (déclenche l'envoi des emails)
router.post('/:id/send', authenticate, requireUser, envelopeController.sendEnvelope);

// Annuler une enveloppe
router.post('/:id/cancel', authenticate, requireUser, envelopeController.cancelEnvelope);

// Supprimer une enveloppe
router.delete('/:id', authenticate, requireUser, envelopeController.deleteEnvelope);

module.exports = router;
