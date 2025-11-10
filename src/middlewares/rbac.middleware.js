/**
 * Middleware de contrôle d'accès basé sur les rôles (RBAC)
 * Vérifie si l'utilisateur a le rôle requis pour accéder à une route
 */

/**
 * Vérifie si l'utilisateur a un des rôles autorisés
 * @param  {...string} allowedRoles - Liste des rôles autorisés
 * @returns Middleware function
 */
const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔐 [RBAC MIDDLEWARE] Vérification des rôles');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📍 Route:', req.method, req.originalUrl);
    console.log('👤 Utilisateur:', req.user ? {
      id: req.user._id,
      email: req.user.email,
      role: req.user.role,
      clientId: req.user.clientId
    } : 'NON AUTHENTIFIÉ');
    console.log('🎫 Rôles requis:', allowedRoles);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Vérifier que l'utilisateur est authentifié
    if (!req.user) {
      console.log('❌ RBAC: Utilisateur non authentifié');
      return res.status(401).json({
        success: false,
        message: 'Authentification requise.',
      });
    }

    // Vérifier le rôle
    if (!allowedRoles.includes(req.user.role)) {
      console.log(`❌ RBAC: Accès refusé - Rôle ${req.user.role} non autorisé`);
      console.log(`   Rôles requis: ${allowedRoles.join(', ')}`);
      return res.status(403).json({
        success: false,
        message: 'Accès refusé. Permissions insuffisantes.',
        requiredRoles: allowedRoles,
        userRole: req.user.role,
      });
    }

    console.log(`✅ RBAC: Accès autorisé - Rôle ${req.user.role} valide\n`);
    next();
  };
};

/**
 * Vérifie que l'utilisateur est SuperAdmin
 */
const requireSuperAdmin = requireRole('SUPER_ADMIN');

/**
 * Vérifie que l'utilisateur est Admin B2B ou SuperAdmin
 */
const requireAdmin = requireRole('SUPER_ADMIN', 'ADMIN_B2B');

/**
 * Vérifie que l'utilisateur est au moins User B2B
 */
const requireUser = requireRole('SUPER_ADMIN', 'ADMIN_B2B', 'USER_B2B');

/**
 * Vérifie les permissions spécifiques de l'utilisateur
 * @param {string} resource - Ressource (ex: 'documents', 'users')
 * @param {string} action - Action (ex: 'create', 'read', 'update', 'delete')
 */
const requirePermission = (resource, action) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentification requise.',
      });
    }

    // SuperAdmin a toutes les permissions
    if (req.user.role === 'SUPER_ADMIN') {
      return next();
    }

    // Vérifier les permissions spécifiques
    const hasPermission = req.user.permissions.some(
      (perm) => perm.resource === resource && perm.actions.includes(action)
    );

    if (!hasPermission) {
      return res.status(403).json({
        success: false,
        message: `Permission refusée pour ${action} sur ${resource}.`,
      });
    }

    next();
  };
};

/**
 * Vérifie que l'utilisateur accède à ses propres ressources
 * ou qu'il est admin de son client
 */
const requireOwnerOrAdmin = (userIdField = 'userId') => {
  return (req, res, next) => {
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

    const targetUserId = req.params[userIdField] || req.body[userIdField];

    // Admin B2B peut gérer son client
    if (req.user.role === 'ADMIN_B2B') {
      return next();
    }

    // Utilisateur ne peut accéder qu'à ses propres ressources
    if (targetUserId && targetUserId !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Accès refusé. Vous ne pouvez accéder qu\'à vos propres ressources.',
      });
    }

    next();
  };
};

module.exports = {
  requireRole,
  requireSuperAdmin,
  requireAdmin,
  requireUser,
  requirePermission,
  requireOwnerOrAdmin,
};
