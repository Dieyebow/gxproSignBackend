const express = require('express');
const router = express.Router();
const clientController = require('../controllers/clientController');
const { authenticate } = require('../middlewares/auth.middleware');
const { requireSuperAdmin } = require('../middlewares/rbac.middleware');
const { validateBody, validateQuery } = require('../middlewares/validator.middleware');
const { clientSchemas } = require('../utils/validationSchemas');

/**
 * Routes de gestion des clients B2B
 * Base URL: /api/clients
 * Toutes les routes nécessitent une authentification SuperAdmin
 */

/**
 * @swagger
 * /api/clients:
 *   get:
 *     summary: Liste tous les clients B2B
 *     description: Récupère la liste de tous les clients avec pagination et filtres (SuperAdmin uniquement)
 *     tags: [Clients]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Numéro de page
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Nombre d'éléments par page
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [ACTIVE, SUSPENDED, INACTIVE]
 *         description: Filtrer par statut
 *       - in: query
 *         name: plan
 *         schema:
 *           type: string
 *           enum: [STARTER, PROFESSIONAL, ENTERPRISE, CUSTOM]
 *         description: Filtrer par plan
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Rechercher dans nom, email ou sous-domaine
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           default: createdAt
 *         description: Champ de tri
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *         description: Ordre de tri
 *     responses:
 *       200:
 *         description: Liste des clients récupérée avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     clients:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Client'
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         page:
 *                           type: integer
 *                         limit:
 *                           type: integer
 *                         total:
 *                           type: integer
 *                         pages:
 *                           type: integer
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 */
router.get('/', authenticate, requireSuperAdmin, clientController.getAllClients);

/**
 * @swagger
 * /api/clients/tenant-info/{tenant}:
 *   get:
 *     summary: Vérifier les informations d'un tenant (route non bloquée par les ad-blockers)
 *     description: Vérifie si un tenant existe et retourne ses informations de base
 *     tags: [Clients]
 *     parameters:
 *       - in: path
 *         name: tenant
 *         required: true
 *         schema:
 *           type: string
 *         description: Identifiant du tenant à vérifier
 *     responses:
 *       200:
 *         description: Information vérifiée
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 available:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Ce tenant est disponible
 */
// Route publique pour vérifier l'existence (utilisée par le frontend au chargement)
// Utilise un nom qui n'est pas bloqué par les extensions de navigateur
router.get('/tenant-info/:subdomain', clientController.checkSubdomainAvailability);

// Ancienne route maintenue pour compatibilité
router.get('/check-subdomain/:subdomain', clientController.checkSubdomainAvailability);

// Route protégée pour les super admins
router.get('/verify-subdomain/:subdomain', authenticate, requireSuperAdmin, clientController.checkSubdomainAvailability);

/**
 * @swagger
 * /api/clients:
 *   post:
 *     summary: Créer un nouveau client B2B
 *     description: Crée un nouveau client B2B avec sous-domaine personnalisé (SuperAdmin uniquement)
 *     tags: [Clients]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - companyName
 *               - subdomain
 *               - email
 *             properties:
 *               companyName:
 *                 type: string
 *                 example: Acme Corporation
 *               subdomain:
 *                 type: string
 *                 pattern: '^[a-z0-9-]+$'
 *                 example: acme
 *                 description: Sous-domaine unique (lettres minuscules, chiffres et tirets uniquement)
 *               email:
 *                 type: string
 *                 format: email
 *                 example: contact@acme.com
 *               contactPerson:
 *                 type: object
 *                 properties:
 *                   firstName:
 *                     type: string
 *                     example: John
 *                   lastName:
 *                     type: string
 *                     example: Doe
 *                   position:
 *                     type: string
 *                     example: CEO
 *               phone:
 *                 type: string
 *                 example: +33612345678
 *               address:
 *                 type: object
 *                 properties:
 *                   street:
 *                     type: string
 *                   city:
 *                     type: string
 *                   state:
 *                     type: string
 *                   postalCode:
 *                     type: string
 *                   country:
 *                     type: string
 *               branding:
 *                 type: object
 *                 properties:
 *                   logo:
 *                     type: string
 *                     description: URL du logo
 *                   primaryColor:
 *                     type: string
 *                     example: "#007bff"
 *                   secondaryColor:
 *                     type: string
 *                     example: "#6c757d"
 *               limits:
 *                 type: object
 *                 properties:
 *                   maxDocumentsPerMonth:
 *                     type: integer
 *                     default: 100
 *                   maxUsers:
 *                     type: integer
 *                     default: 10
 *                   maxStorageGB:
 *                     type: integer
 *                     default: 5
 *               subscription:
 *                 type: object
 *                 properties:
 *                   plan:
 *                     type: string
 *                     enum: [STARTER, PROFESSIONAL, ENTERPRISE, CUSTOM]
 *                     default: STARTER
 *                   billingCycle:
 *                     type: string
 *                     enum: [MONTHLY, YEARLY]
 *                     default: MONTHLY
 *     responses:
 *       201:
 *         description: Client créé avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Client créé avec succès.
 *                 data:
 *                   type: object
 *                   properties:
 *                     client:
 *                       $ref: '#/components/schemas/Client'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       409:
 *         description: Sous-domaine ou email déjà utilisé
 */
// Middleware pour logger les données reçues
const logRequestBody = (req, res, next) => {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🟢 [ROUTE] POST /api/clients - DONNÉES BRUTES REÇUES:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(JSON.stringify(req.body, null, 2));
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Types des champs:');
  console.log('- phone:', typeof req.body.phone, '→', req.body.phone);
  console.log('- address:', typeof req.body.address, '→', req.body.address);
  console.log('- contactPerson:', typeof req.body.contactPerson, '→', JSON.stringify(req.body.contactPerson));
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  next();
};

router.post(
  '/',
  authenticate,
  requireSuperAdmin,
  logRequestBody, // Logger AVANT la validation
  validateBody(clientSchemas.create),
  clientController.createClient
);

/**
 * @swagger
 * /api/clients/{id}:
 *   get:
 *     summary: Obtenir un client par ID
 *     description: Récupère les détails d'un client spécifique avec ses statistiques
 *     tags: [Clients]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID du client
 *     responses:
 *       200:
 *         description: Client trouvé
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     client:
 *                       $ref: '#/components/schemas/Client'
 *                     stats:
 *                       type: object
 *                       properties:
 *                         users:
 *                           type: integer
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 */
// Middleware pour vérifier l'accès au client (SUPER_ADMIN ou ADMIN_B2B de ce client)
const checkClientAccess = (req, res, next) => {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🔍 [CLIENT ACCESS] Vérification accès client');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📍 Client demandé:', req.params.id);
  console.log('👤 Utilisateur:', {
    role: req.user.role,
    clientId: req.user.clientId?.toString()
  });

  // SUPER_ADMIN peut accéder à tous les clients
  if (req.user.role === 'SUPER_ADMIN') {
    console.log('✅ Accès autorisé: SUPER_ADMIN');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    return next();
  }

  // ADMIN_B2B peut accéder uniquement à son propre client
  if (req.user.role === 'ADMIN_B2B') {
    if (req.user.clientId?.toString() === req.params.id) {
      console.log('✅ Accès autorisé: ADMIN_B2B accède à son propre client');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      return next();
    } else {
      console.log('❌ Accès refusé: ADMIN_B2B tente d\'accéder à un autre client');
      console.log(`   Son clientId: ${req.user.clientId?.toString()}`);
      console.log(`   Client demandé: ${req.params.id}`);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      return res.status(403).json({
        success: false,
        message: 'Accès refusé. Vous ne pouvez accéder qu\'aux informations de votre propre société.',
      });
    }
  }

  // Autres rôles non autorisés
  console.log('❌ Accès refusé: Rôle non autorisé');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  return res.status(403).json({
    success: false,
    message: 'Accès refusé. Permissions insuffisantes.',
  });
};

router.get('/:id', authenticate, checkClientAccess, clientController.getClientById);

/**
 * @swagger
 * /api/clients/{id}:
 *   put:
 *     summary: Mettre à jour un client
 *     description: Met à jour les informations d'un client existant
 *     tags: [Clients]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID du client
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               companyName:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *               phone:
 *                 type: string
 *               contactPerson:
 *                 type: object
 *               address:
 *                 type: object
 *               branding:
 *                 type: object
 *               limits:
 *                 type: object
 *               subscription:
 *                 type: object
 *     responses:
 *       200:
 *         description: Client mis à jour avec succès
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       409:
 *         description: Email déjà utilisé
 */
router.put(
  '/:id',
  authenticate,
  requireSuperAdmin,
  validateBody(clientSchemas.update),
  clientController.updateClient
);

/**
 * @swagger
 * /api/clients/{id}:
 *   delete:
 *     summary: Supprimer un client
 *     description: Supprime définitivement un client (uniquement si aucun utilisateur n'est associé)
 *     tags: [Clients]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID du client
 *     responses:
 *       200:
 *         description: Client supprimé avec succès
 *       400:
 *         description: Impossible de supprimer (utilisateurs associés)
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.delete('/:id', authenticate, requireSuperAdmin, clientController.deleteClient);

/**
 * @swagger
 * /api/clients/{id}/suspend:
 *   patch:
 *     summary: Suspendre un client
 *     description: Suspend un client (empêche l'accès à tous les utilisateurs du client)
 *     tags: [Clients]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID du client
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason:
 *                 type: string
 *                 description: Raison de la suspension
 *                 example: Non-paiement
 *     responses:
 *       200:
 *         description: Client suspendu avec succès
 *       400:
 *         description: Le client est déjà suspendu
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.patch('/:id/suspend', authenticate, requireSuperAdmin, clientController.suspendClient);

/**
 * @swagger
 * /api/clients/{id}/activate:
 *   patch:
 *     summary: Activer un client
 *     description: Réactive un client suspendu
 *     tags: [Clients]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID du client
 *     responses:
 *       200:
 *         description: Client activé avec succès
 *       400:
 *         description: Le client est déjà actif
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.patch('/:id/activate', authenticate, requireSuperAdmin, clientController.activateClient);

/**
 * @swagger
 * /api/clients/{id}/stats:
 *   get:
 *     summary: Statistiques du client
 *     description: Récupère les statistiques d'utilisation d'un client
 *     tags: [Clients]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID du client
 *     responses:
 *       200:
 *         description: Statistiques récupérées avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     stats:
 *                       type: object
 *                       properties:
 *                         users:
 *                           type: object
 *                           properties:
 *                             total:
 *                               type: integer
 *                             limit:
 *                               type: integer
 *                             percentage:
 *                               type: number
 *                         documents:
 *                           type: object
 *                         storage:
 *                           type: object
 *                         subscription:
 *                           type: object
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.get('/:id/stats', authenticate, checkClientAccess, clientController.getClientStats);

module.exports = router;
