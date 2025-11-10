const { Client } = require('../models');

/**
 * Middleware pour extraire et valider le sous-domaine
 * Permet aux clients de se connecter via leur sous-domaine personnalisé
 * Ex: peelo.gxprosign.com ou peelo.localhost (en dev)
 */
const extractSubdomain = async (req, res, next) => {
  try {
    const host = req.get('host') || '';

    // 🔍 DEBUG LOGGING
    console.log('🌐 SUBDOMAIN MIDDLEWARE:');
    console.log('  Host header:', host);
    console.log('  Request URL:', req.originalUrl);
    console.log('  Request path:', req.path);
    console.log('  Request baseUrl:', req.baseUrl);

    // ⚠️ EXCEPTION: Ne pas bloquer la route de vérification de sous-domaine
    // Cette route doit pouvoir répondre même si le sous-domaine n'existe pas
    const isCheckSubdomainRoute = req.originalUrl.includes('/api/clients/check-subdomain/');
    console.log('  Is check-subdomain route?', isCheckSubdomainRoute);

    if (isCheckSubdomainRoute) {
      console.log('  ⏭️  Route de vérification - bypass validation');
      return next();
    }

    // Extraire le sous-domaine
    // Format attendu: subdomain.domain.tld ou subdomain.localhost
    const parts = host.split('.');

    console.log('  Host parts:', parts);
    console.log('  Parts count:', parts.length);

    // Si on a au moins 2 parties (subdomain.domain ou subdomain.localhost)
    if (parts.length >= 2) {
      const potentialSubdomain = parts[0];
      console.log('  Potential subdomain:', potentialSubdomain);

      // Ignorer certains sous-domaines réservés
      const reservedSubdomains = ['www', 'api', 'admin', 'app', 'localhost'];

      if (!reservedSubdomains.includes(potentialSubdomain) && potentialSubdomain !== 'localhost') {
        // Vérifier si le sous-domaine existe dans la base
        const client = await Client.findOne({
          subdomain: potentialSubdomain,
          status: 'ACTIVE',
        }).select('_id subdomain companyName email status');

        if (client) {
          // Attacher le client à la requête
          req.clientSubdomain = {
            subdomain: potentialSubdomain,
            clientId: client._id,
            companyName: client.companyName,
            email: client.email,
          };

          console.log(`🏢 Sous-domaine détecté: ${potentialSubdomain} -> Client: ${client.companyName}`);
        } else {
          // Sous-domaine détecté mais n'existe pas dans la base = 404
          console.log(`❌ Sous-domaine inexistant: ${potentialSubdomain}`);
          return res.status(404).json({
            success: false,
            message: `Le sous-domaine "${potentialSubdomain}" n'existe pas ou est inactif.`,
            error: 'SUBDOMAIN_NOT_FOUND',
          });
        }
      } else {
        console.log(`  ✅ Reserved/skipped subdomain: ${potentialSubdomain}`);
      }
    } else {
      console.log('  ✅ No subdomain detected (plain domain)');
    }

    next();
  } catch (error) {
    console.error('Erreur extraction sous-domaine:', error);
    next();
  }
};

/**
 * Middleware pour forcer l'authentification via sous-domaine
 * Utilisé sur les routes qui nécessitent un sous-domaine client
 */
const requireSubdomain = (req, res, next) => {
  if (!req.clientSubdomain) {
    return res.status(400).json({
      success: false,
      message: 'Sous-domaine client requis. Veuillez accéder via votre sous-domaine personnalisé (ex: votreentreprise.gxprosign.com)',
    });
  }
  next();
};

module.exports = {
  extractSubdomain,
  requireSubdomain,
};
