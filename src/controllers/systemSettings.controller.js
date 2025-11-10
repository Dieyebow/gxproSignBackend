const { SystemSettings, AuditLog } = require('../models');

/**
 * Obtenir les paramètres système
 * GET /api/admin/system-settings
 */
const getSystemSettings = async (req, res) => {
  try {
    console.log('📥 GET /admin/system-settings - Récupération des paramètres système');
    const settings = await SystemSettings.getSettings();
    console.log('✅ Paramètres récupérés:', settings ? 'OK' : 'Créés par défaut');

    return res.status(200).json({
      success: true,
      data: {
        settings,
      },
    });
  } catch (error) {
    console.error('❌ Erreur get system settings:', error);
    return res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des paramètres système.',
      error: error.message,
    });
  }
};

/**
 * Mettre à jour les paramètres généraux
 * PUT /api/admin/system-settings/general
 */
const updateGeneralSettings = async (req, res) => {
  try {
    const { platformName, supportEmail, adminEmail, website } = req.body;

    console.log('📥 PUT /admin/system-settings/general');
    console.log('  Données reçues:', req.body);
    console.log('  Utilisateur:', req.user.email);

    const settings = await SystemSettings.updateSection(
      'general',
      {
        platformName,
        supportEmail,
        adminEmail,
        website,
      },
      req.user._id
    );

    console.log('✅ Paramètres généraux mis à jour dans MongoDB');

    // TODO: Ajouter audit log une fois les enums mis à jour
    // await AuditLog.log({ ... });

    return res.status(200).json({
      success: true,
      message: 'Paramètres généraux mis à jour avec succès.',
      data: {
        settings,
      },
    });
  } catch (error) {
    console.error('Erreur update general settings:', error);
    return res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise à jour des paramètres généraux.',
      error: error.message,
    });
  }
};

/**
 * Mettre à jour les paramètres email
 * PUT /api/admin/system-settings/email
 */
const updateEmailSettings = async (req, res) => {
  try {
    const { fromName, fromEmail, replyToEmail } = req.body;

    console.log('📥 PUT /admin/system-settings/email');
    console.log('  Données reçues:', req.body);

    const settings = await SystemSettings.updateSection(
      'email',
      {
        fromName,
        fromEmail,
        replyToEmail,
      },
      req.user._id
    );

    console.log('✅ Paramètres email mis à jour dans MongoDB');

    // TODO: Ajouter audit log une fois les enums mis à jour
    /*await AuditLog.log({
      action: 'SYSTEM_SETTINGS_UPDATED',
      actor: {
        userId: req.user._id,
        type: 'USER',
        name: `${req.user.firstName} ${req.user.lastName}`,
        email: req.user.email,
      },
      target: {
        type: 'SYSTEM_SETTINGS',
        id: settings._id,
      },
      details: {
        description: 'Paramètres email mis à jour',
        section: 'email',
      },
      context: {
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      },
      result: 'SUCCESS',
    });*/

    return res.status(200).json({
      success: true,
      message: 'Paramètres email mis à jour avec succès.',
      data: {
        settings,
      },
    });
  } catch (error) {
    console.error('Erreur update email settings:', error);
    return res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise à jour des paramètres email.',
      error: error.message,
    });
  }
};

/**
 * Mettre à jour les paramètres documents
 * PUT /api/admin/system-settings/documents
 */
const updateDocumentSettings = async (req, res) => {
  try {
    const { maxFileSize, allowedFormats, defaultExpirationDays } = req.body;

    console.log('📥 PUT /admin/system-settings/documents');
    console.log('  Données reçues:', req.body);

    const settings = await SystemSettings.updateSection(
      'documents',
      {
        maxFileSize,
        allowedFormats,
        defaultExpirationDays,
      },
      req.user._id
    );

    console.log('✅ Paramètres documents mis à jour dans MongoDB');

    // TODO: Ajouter audit log une fois les enums mis à jour
    /*await AuditLog.log({
      action: 'SYSTEM_SETTINGS_UPDATED',
      actor: {
        userId: req.user._id,
        type: 'USER',
        name: `${req.user.firstName} ${req.user.lastName}`,
        email: req.user.email,
      },
      target: {
        type: 'SYSTEM_SETTINGS',
        id: settings._id,
      },
      details: {
        description: 'Paramètres documents mis à jour',
        section: 'documents',
      },
      context: {
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      },
      result: 'SUCCESS',
    });*/

    return res.status(200).json({
      success: true,
      message: 'Paramètres documents mis à jour avec succès.',
      data: {
        settings,
      },
    });
  } catch (error) {
    console.error('Erreur update document settings:', error);
    return res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise à jour des paramètres documents.',
      error: error.message,
    });
  }
};

/**
 * Mettre à jour les paramètres de sécurité
 * PUT /api/admin/system-settings/security
 */
const updateSecuritySettings = async (req, res) => {
  try {
    const {
      sessionTimeout,
      maxLoginAttempts,
      lockoutDuration,
      requireEmailVerification,
      require2FA,
    } = req.body;

    console.log('📥 PUT /admin/system-settings/security');
    console.log('  Données reçues:', req.body);

    const settings = await SystemSettings.updateSection(
      'security',
      {
        sessionTimeout,
        maxLoginAttempts,
        lockoutDuration,
        requireEmailVerification,
        require2FA,
      },
      req.user._id
    );

    console.log('✅ Paramètres sécurité mis à jour dans MongoDB');

    // TODO: Ajouter audit log une fois les enums mis à jour
    /*await AuditLog.log({
      action: 'SYSTEM_SETTINGS_UPDATED',
      actor: {
        userId: req.user._id,
        type: 'USER',
        name: `${req.user.firstName} ${req.user.lastName}`,
        email: req.user.email,
      },
      target: {
        type: 'SYSTEM_SETTINGS',
        id: settings._id,
      },
      details: {
        description: 'Paramètres de sécurité mis à jour',
        section: 'security',
      },
      context: {
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      },
      result: 'SUCCESS',
    });*/

    return res.status(200).json({
      success: true,
      message: 'Paramètres de sécurité mis à jour avec succès.',
      data: {
        settings,
      },
    });
  } catch (error) {
    console.error('Erreur update security settings:', error);
    return res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise à jour des paramètres de sécurité.',
      error: error.message,
    });
  }
};

/**
 * Mettre à jour les limites
 * PUT /api/admin/system-settings/limits
 */
const updateLimitsSettings = async (req, res) => {
  try {
    const { maxUsersPerClient, maxDocumentsPerMonth, maxStoragePerClient } = req.body;

    console.log('📥 PUT /admin/system-settings/limits');
    console.log('  Données reçues:', req.body);

    const settings = await SystemSettings.updateSection(
      'limits',
      {
        maxUsersPerClient,
        maxDocumentsPerMonth,
        maxStoragePerClient,
      },
      req.user._id
    );

    console.log('✅ Paramètres limites mis à jour dans MongoDB');

    // TODO: Ajouter audit log une fois les enums mis à jour
    /*await AuditLog.log({
      action: 'SYSTEM_SETTINGS_UPDATED',
      actor: {
        userId: req.user._id,
        type: 'USER',
        name: `${req.user.firstName} ${req.user.lastName}`,
        email: req.user.email,
      },
      target: {
        type: 'SYSTEM_SETTINGS',
        id: settings._id,
      },
      details: {
        description: 'Limites mises à jour',
        section: 'limits',
      },
      context: {
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      },
      result: 'SUCCESS',
    });*/

    return res.status(200).json({
      success: true,
      message: 'Limites mises à jour avec succès.',
      data: {
        settings,
      },
    });
  } catch (error) {
    console.error('Erreur update limits settings:', error);
    return res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise à jour des limites.',
      error: error.message,
    });
  }
};

module.exports = {
  getSystemSettings,
  updateGeneralSettings,
  updateEmailSettings,
  updateDocumentSettings,
  updateSecuritySettings,
  updateLimitsSettings,
};
