const express = require('express');
const router = express.Router();
const systemSettingsController = require('../controllers/systemSettings.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { requireSuperAdmin } = require('../middlewares/rbac.middleware');

/**
 * Toutes les routes nécessitent authentification + rôle SUPER_ADMIN
 */
router.use(authenticate);
router.use(requireSuperAdmin);

/**
 * @route   GET /api/admin/system-settings
 * @desc    Obtenir les paramètres système
 * @access  Super Admin
 */
router.get('/', systemSettingsController.getSystemSettings);

/**
 * @route   PUT /api/admin/system-settings/general
 * @desc    Mettre à jour les paramètres généraux
 * @access  Super Admin
 */
router.put('/general', systemSettingsController.updateGeneralSettings);

/**
 * @route   PUT /api/admin/system-settings/email
 * @desc    Mettre à jour les paramètres email
 * @access  Super Admin
 */
router.put('/email', systemSettingsController.updateEmailSettings);

/**
 * @route   PUT /api/admin/system-settings/documents
 * @desc    Mettre à jour les paramètres documents
 * @access  Super Admin
 */
router.put('/documents', systemSettingsController.updateDocumentSettings);

/**
 * @route   PUT /api/admin/system-settings/security
 * @desc    Mettre à jour les paramètres de sécurité
 * @access  Super Admin
 */
router.put('/security', systemSettingsController.updateSecuritySettings);

/**
 * @route   PUT /api/admin/system-settings/limits
 * @desc    Mettre à jour les limites
 * @access  Super Admin
 */
router.put('/limits', systemSettingsController.updateLimitsSettings);

module.exports = router;
