const jwt = require('jsonwebtoken');
const { User } = require('../models');

/**
 * Middleware d'authentification JWT
 * Vérifie le token dans le header Authorization
 * Charge l'utilisateur et l'ajoute à req.user
 */
const authenticate = async (req, res, next) => {
  try {
    console.log('🔐 [AUTH MIDDLEWARE] Vérification authentification');
    console.log('  Route:', req.method, req.path);

    // 1. Extraire le token du header
    const authHeader = req.headers.authorization;
    console.log('  Authorization header:', authHeader ? authHeader.substring(0, 20) + '...' : 'ABSENT');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('  ❌ Pas de token - Rejet');
      return res.status(401).json({
        success: false,
        message: 'Accès refusé. Aucun token fourni.',
      });
    }

    console.log('  ✅ Token présent');

    const token = authHeader.substring(7); // Enlever "Bearer "

    // 2. Vérifier le token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          message: 'Token expiré. Veuillez vous reconnecter.',
          code: 'TOKEN_EXPIRED',
        });
      }
      return res.status(401).json({
        success: false,
        message: 'Token invalide.',
      });
    }

    console.log('  ✅ Token décodé - User ID:', decoded.id);

    // 3. Récupérer l'utilisateur
    const user = await User.findById(decoded.id);

    if (!user) {
      console.log('  ❌ Utilisateur non trouvé dans la DB');
      return res.status(401).json({
        success: false,
        message: 'Utilisateur non trouvé.',
      });
    }

    console.log('  ✅ Utilisateur trouvé:', user.email);

    // 4. Vérifier si le compte est actif
    if (user.status !== 'ACTIVE') {
      return res.status(403).json({
        success: false,
        message: 'Compte suspendu ou inactif.',
      });
    }

    // 5. Vérifier si le compte est verrouillé
    if (user.isLocked()) {
      const minutesLeft = Math.ceil((user.security.lockedUntil - Date.now()) / 60000);
      return res.status(403).json({
        success: false,
        message: `Compte verrouillé suite à plusieurs tentatives échouées. Réessayez dans ${minutesLeft} minute(s).`,
      });
    }

    // 6. Ajouter l'utilisateur à la requête
    req.user = user;
    console.log('  ✅ Authentification réussie - Passage au next()');
    next();
  } catch (error) {
    console.error('Erreur middleware auth:', error);
    return res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de l\'authentification.',
    });
  }
};

/**
 * Middleware optionnel - ne bloque pas si pas de token
 * Utile pour les routes publiques qui peuvent bénéficier de l'auth
 */
const authenticateOptional = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next();
    }

    const token = authHeader.substring(7);

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id);

      if (user && user.status === 'ACTIVE') {
        req.user = user;
      }
    } catch (error) {
      // Ignore les erreurs, c'est optionnel
    }

    next();
  } catch (error) {
    next();
  }
};

module.exports = {
  authenticate,
  authenticateOptional,
};
