const { Client } = require('../models');

/**
 * Middleware Multi-Tenant
 * Isole les données par client (clientId)
 * Injecte automatiquement le clientId dans les requêtes
 */

/**
 * Extrait et vérifie le client depuis le sous-domaine ou le header
 */
const extractTenant = async (req, res, next) => {
  try {
    let subdomain = null;
    let client = null;

    // Méthode 1 : Extraction depuis le sous-domaine
    const host = req.get('host') || '';
    const parts = host.split('.');

    // Format attendu : [subdomain].gxprosign.com
    if (parts.length >= 3) {
      subdomain = parts[0];
    }

    // Méthode 2 : Header personnalisé (pour les tests)
    const tenantHeader = req.get('X-Tenant-Subdomain');
    if (tenantHeader) {
      subdomain = tenantHeader;
    }

    // Méthode 3 : Query parameter (pour les tests)
    if (req.query.subdomain) {
      subdomain = req.query.subdomain;
    }

    // Si un sous-domaine est trouvé, récupérer le client
    if (subdomain && subdomain !== 'admin' && subdomain !== 'www') {
      client = await Client.findBySubdomain(subdomain);

      if (!client) {
        return res.status(404).json({
          success: false,
          message: 'Client non trouvé.',
          subdomain,
        });
      }

      if (client.status !== 'ACTIVE') {
        return res.status(403).json({
          success: false,
          message: 'Ce compte client est suspendu.',
        });
      }

      // Ajouter le client à la requête
      req.client = client;
      req.clientId = client._id;
    }

    next();
  } catch (error) {
    console.error('Erreur middleware tenant:', error);
    return res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la vérification du tenant.',
    });
  }
};

/**
 * Injecte automatiquement le clientId dans les filtres de requête
 * Empêche les utilisateurs d'accéder aux données d'autres clients
 */
const enforceClientIsolation = (req, res, next) => {
  // SuperAdmin peut voir tous les clients
  if (req.user && req.user.role === 'SUPER_ADMIN') {
    return next();
  }

  // Pour les autres utilisateurs, forcer le clientId
  if (req.user && req.user.clientId) {
    // Injecter dans les query params
    if (!req.query.clientId) {
      req.query.clientId = req.user.clientId.toString();
    }

    // Injecter dans le body (pour POST/PUT)
    if (req.method === 'POST' || req.method === 'PUT') {
      if (!req.body.clientId) {
        req.body.clientId = req.user.clientId;
      }
    }

    // Vérifier que l'utilisateur n'essaie pas d'accéder à un autre client
    if (req.query.clientId && req.query.clientId !== req.user.clientId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Accès refusé. Vous ne pouvez pas accéder aux données d\'un autre client.',
      });
    }

    if (req.body.clientId && req.body.clientId.toString() !== req.user.clientId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Accès refusé. Vous ne pouvez pas modifier les données d\'un autre client.',
      });
    }
  }

  next();
};

/**
 * Vérifie que l'utilisateur appartient au client de la requête
 */
const requireSameClient = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentification requise.',
    });
  }

  // SuperAdmin peut tout faire
  if (req.user.role === 'SUPER_ADMIN') {
    return next();
  }

  // Vérifier que le client correspond
  const requestClientId = req.params.clientId || req.body.clientId || req.query.clientId;

  if (requestClientId && requestClientId !== req.user.clientId.toString()) {
    return res.status(403).json({
      success: false,
      message: 'Accès refusé. Vous n\'appartenez pas à ce client.',
    });
  }

  next();
};

/**
 * Vérifie que le client n'a pas dépassé ses limites
 */
const checkClientLimits = (limitType) => {
  return async (req, res, next) => {
    try {
      if (!req.user || req.user.role === 'SUPER_ADMIN') {
        return next();
      }

      const { Client } = require('../models');
      const client = await Client.findById(req.user.clientId);

      if (!client) {
        return res.status(404).json({
          success: false,
          message: 'Client non trouvé.',
        });
      }

      // Vérifier les limites selon le type
      switch (limitType) {
        case 'documents':
          if (!client.canCreateDocument()) {
            return res.status(403).json({
              success: false,
              message: `Limite mensuelle de documents atteinte (${client.limits.maxDocumentsPerMonth}).`,
              limit: client.limits.maxDocumentsPerMonth,
              current: client.limits.currentMonthDocuments,
            });
          }
          break;

        case 'users':
          if (!client.canAddUser()) {
            return res.status(403).json({
              success: false,
              message: `Limite d'utilisateurs atteinte (${client.limits.maxUsers}).`,
              limit: client.limits.maxUsers,
              current: client.limits.currentUsers,
            });
          }
          break;

        default:
          break;
      }

      next();
    } catch (error) {
      console.error('Erreur vérification limites:', error);
      return res.status(500).json({
        success: false,
        message: 'Erreur lors de la vérification des limites.',
      });
    }
  };
};

module.exports = {
  extractTenant,
  enforceClientIsolation,
  requireSameClient,
  checkClientLimits,
};
