const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');
const { authenticate } = require('../middlewares/auth.middleware');
const { requireUser, requireSuperAdmin } = require('../middlewares/rbac.middleware');

/**
 * @swagger
 * /api/dashboard/overview:
 *   get:
 *     summary: Statistiques globales du dashboard
 *     description: |
 *       Récupère les statistiques d'aperçu du dashboard
 *       - **SuperAdmin**: Voit les statistiques globales de tous les clients
 *       - **Admin B2B / User B2B**: Voit les statistiques de leur client uniquement
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
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
 *                     overview:
 *                       type: object
 *                       properties:
 *                         totalClients:
 *                           type: number
 *                           description: Nombre total de clients (SuperAdmin uniquement)
 *                           example: 15
 *                         totalUsers:
 *                           type: number
 *                           example: 245
 *                         totalDocuments:
 *                           type: number
 *                           example: 1847
 *                         totalEnvelopes:
 *                           type: number
 *                           example: 982
 *                         totalSignatures:
 *                           type: number
 *                           example: 2156
 *                         activeUsers:
 *                           type: number
 *                           description: Utilisateurs connectés dans les 30 derniers jours
 *                           example: 187
 *                         completionRate:
 *                           type: number
 *                           format: float
 *                           description: Taux de complétion des enveloppes (%)
 *                           example: 87.45
 *                         totalStorageGB:
 *                           type: number
 *                           format: float
 *                           description: Espace de stockage utilisé en GB
 *                           example: 12.34
 *                     envelopes:
 *                       type: object
 *                       description: Répartition des enveloppes par statut
 *                       properties:
 *                         DRAFT:
 *                           type: number
 *                           example: 45
 *                         SENT:
 *                           type: number
 *                           example: 123
 *                         IN_PROGRESS:
 *                           type: number
 *                           example: 89
 *                         COMPLETED:
 *                           type: number
 *                           example: 658
 *                         CANCELLED:
 *                           type: number
 *                           example: 34
 *                         EXPIRED:
 *                           type: number
 *                           example: 33
 *                     recentActivity:
 *                       type: array
 *                       description: 10 dernières actions (audit logs)
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                           action:
 *                             type: string
 *                             example: USER_LOGIN
 *                           description:
 *                             type: string
 *                             example: Connexion réussie
 *                           user:
 *                             type: object
 *                             properties:
 *                               name:
 *                                 type: string
 *                                 example: Jean Dupont
 *                               email:
 *                                 type: string
 *                                 example: jean.dupont@acme.com
 *                           ipAddress:
 *                             type: string
 *                             example: 192.168.1.100
 *                           timestamp:
 *                             type: string
 *                             format: date-time
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         description: Erreur serveur
 */
router.get('/overview', authenticate, requireUser, dashboardController.getOverviewStats);

/**
 * @swagger
 * /api/dashboard/trends:
 *   get:
 *     summary: Tendances mensuelles
 *     description: |
 *       Récupère les données mensuelles des 12 derniers mois pour générer des graphiques
 *       - Documents uploadés par mois
 *       - Enveloppes créées par mois
 *       - Signatures complétées par mois
 *       - Nouveaux utilisateurs par mois
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Tendances récupérées avec succès
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
 *                     documents:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           month:
 *                             type: string
 *                             example: Jan 2025
 *                           year:
 *                             type: number
 *                             example: 2025
 *                           monthNumber:
 *                             type: number
 *                             example: 1
 *                           count:
 *                             type: number
 *                             example: 145
 *                     envelopes:
 *                       type: array
 *                       items:
 *                         type: object
 *                     signatures:
 *                       type: array
 *                       items:
 *                         type: object
 *                     users:
 *                       type: array
 *                       items:
 *                         type: object
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         description: Erreur serveur
 */
router.get('/trends', authenticate, requireUser, dashboardController.getMonthlyTrends);

/**
 * @swagger
 * /api/dashboard/clients/{id}/stats:
 *   get:
 *     summary: Statistiques détaillées d'un client
 *     description: |
 *       Récupère les statistiques détaillées pour un client spécifique
 *       **SuperAdmin uniquement**
 *
 *       Inclut:
 *       - Statistiques d'utilisation
 *       - Limites du plan d'abonnement
 *       - Pourcentage d'utilisation vs limites
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID du client
 *         example: 68f941c514f7143c35bb0a20
 *     responses:
 *       200:
 *         description: Statistiques du client récupérées avec succès
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
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                         companyName:
 *                           type: string
 *                           example: Acme Corporation
 *                         subdomain:
 *                           type: string
 *                           example: acme
 *                         status:
 *                           type: string
 *                           enum: [ACTIVE, SUSPENDED, INACTIVE]
 *                         subscription:
 *                           type: object
 *                     statistics:
 *                       type: object
 *                       properties:
 *                         totalUsers:
 *                           type: number
 *                           example: 25
 *                         activeUsers:
 *                           type: number
 *                           example: 18
 *                         totalDocuments:
 *                           type: number
 *                           example: 347
 *                         documentsThisMonth:
 *                           type: number
 *                           example: 42
 *                         totalEnvelopes:
 *                           type: number
 *                           example: 156
 *                         totalSignatures:
 *                           type: number
 *                           example: 289
 *                         completionRate:
 *                           type: number
 *                           example: 85.5
 *                         storageUsedGB:
 *                           type: number
 *                           example: 3.47
 *                     limits:
 *                       type: object
 *                       properties:
 *                         maxDocumentsPerMonth:
 *                           type: number
 *                           example: 100
 *                         maxUsers:
 *                           type: number
 *                           example: 50
 *                         maxStorageGB:
 *                           type: number
 *                           example: 10
 *                     usagePercentage:
 *                       type: object
 *                       properties:
 *                         documents:
 *                           type: number
 *                           description: Pourcentage d'utilisation des documents ce mois
 *                           example: 42
 *                         users:
 *                           type: number
 *                           description: Pourcentage d'utilisation des utilisateurs
 *                           example: 50
 *                         storage:
 *                           type: number
 *                           description: Pourcentage d'utilisation du stockage
 *                           example: 34.7
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       500:
 *         description: Erreur serveur
 */
router.get('/clients/:id/stats', authenticate, requireSuperAdmin, dashboardController.getClientStats);

/**
 * @swagger
 * /api/dashboard/analytics/signatures:
 *   get:
 *     summary: Analytics détaillées des signatures
 *     description: |
 *       Récupère des analytics avancées sur les signatures:
 *       - Répartition par méthode de signature (DRAW, TYPE, UPLOAD, BIOMETRIC)
 *       - Temps moyen pour signer (min, max, moyenne)
 *       - Répartition par type d'appareil (desktop, mobile, tablet)
 *       - Taux de refus
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Analytics récupérées avec succès
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
 *                     signatureMethods:
 *                       type: object
 *                       properties:
 *                         DRAW:
 *                           type: number
 *                           example: 456
 *                         TYPE:
 *                           type: number
 *                           example: 234
 *                         UPLOAD:
 *                           type: number
 *                           example: 89
 *                         BIOMETRIC:
 *                           type: number
 *                           example: 12
 *                     timeToSign:
 *                       type: object
 *                       properties:
 *                         avgHours:
 *                           type: number
 *                           format: float
 *                           description: Temps moyen en heures
 *                           example: 24.5
 *                         minHours:
 *                           type: number
 *                           format: float
 *                           example: 0.25
 *                         maxHours:
 *                           type: number
 *                           format: float
 *                           example: 168.5
 *                         totalSignatures:
 *                           type: number
 *                           example: 791
 *                     deviceTypes:
 *                       type: object
 *                       properties:
 *                         desktop:
 *                           type: number
 *                           example: 512
 *                         mobile:
 *                           type: number
 *                           example: 234
 *                         tablet:
 *                           type: number
 *                           example: 34
 *                         unknown:
 *                           type: number
 *                           example: 11
 *                     declineRate:
 *                       type: number
 *                       format: float
 *                       description: Taux de refus en pourcentage
 *                       example: 3.2
 *                     declineCount:
 *                       type: number
 *                       example: 32
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         description: Erreur serveur
 */
router.get('/analytics/signatures', authenticate, requireUser, dashboardController.getSignatureAnalytics);

/**
 * @swagger
 * /api/dashboard/activity/users:
 *   get:
 *     summary: Rapport d'activité utilisateurs
 *     description: |
 *       Récupère les utilisateurs les plus actifs:
 *       - Top 10 utilisateurs par nombre de documents uploadés
 *       - Top 10 utilisateurs par nombre d'enveloppes envoyées
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Activité utilisateurs récupérée avec succès
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
 *                     topUsersByDocuments:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           userId:
 *                             type: string
 *                           name:
 *                             type: string
 *                             example: Jean Dupont
 *                           email:
 *                             type: string
 *                             example: jean.dupont@acme.com
 *                           role:
 *                             type: string
 *                             example: ADMIN_B2B
 *                           documentCount:
 *                             type: number
 *                             example: 145
 *                     topUsersByEnvelopes:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           userId:
 *                             type: string
 *                           name:
 *                             type: string
 *                           email:
 *                             type: string
 *                           role:
 *                             type: string
 *                           envelopeCount:
 *                             type: number
 *                             example: 89
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         description: Erreur serveur
 */
router.get('/activity/users', authenticate, requireUser, dashboardController.getUserActivity);

module.exports = router;
