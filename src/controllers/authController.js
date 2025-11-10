const { User, AuditLog } = require('../models');
const crypto = require('crypto');

/**
 * Controller d'authentification
 * Gère login, register, refresh token, mot de passe oublié, etc.
 */

/**
 * Inscription d'un nouvel utilisateur
 * POST /api/auth/register
 */
const register = async (req, res) => {
  try {
    const { firstName, lastName, email, password, role, clientId } = req.body;

    // Vérifier si l'email existe déjà
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'Cet email est déjà utilisé.',
      });
    }

    // Vérifier que seul le SuperAdmin ou Admin B2B peut créer des utilisateurs
    if (req.user) {
      if (req.user.role !== 'SUPER_ADMIN' && req.user.role !== 'ADMIN_B2B') {
        return res.status(403).json({
          success: false,
          message: 'Vous n\'avez pas les permissions pour créer un utilisateur.',
        });
      }

      // Si Admin B2B, le nouvel utilisateur doit appartenir au même client
      if (req.user.role === 'ADMIN_B2B') {
        if (clientId && clientId !== req.user.clientId.toString()) {
          return res.status(403).json({
            success: false,
            message: 'Vous ne pouvez créer des utilisateurs que pour votre client.',
          });
        }
      }
    }

    // Créer l'utilisateur
    const user = await User.create({
      firstName,
      lastName,
      email,
      password, // Sera hashé automatiquement par le hook pre-save
      role: role || 'USER_B2B',
      clientId: clientId || req.user?.clientId,
      emailVerified: false,
      status: 'ACTIVE',
    });

    // Log l'action
    if (req.user) {
      await AuditLog.log({
        clientId: user.clientId,
        action: 'USER_CREATED',
        actor: {
          userId: req.user._id,
          type: 'USER',
          name: `${req.user.firstName} ${req.user.lastName}`,
          email: req.user.email,
        },
        target: {
          type: 'USER',
          id: user._id,
          name: `${user.firstName} ${user.lastName}`,
        },
        details: {
          description: `Utilisateur ${user.email} créé`,
        },
        context: {
          ipAddress: req.ip,
          userAgent: req.get('user-agent'),
        },
      });
    }

    // Retourner l'utilisateur (sans le mot de passe)
    return res.status(201).json({
      success: true,
      message: 'Utilisateur créé avec succès.',
      data: {
        user: user.toJSON(),
      },
    });
  } catch (error) {
    console.error('Erreur register:', error);
    return res.status(500).json({
      success: false,
      message: 'Erreur lors de la création de l\'utilisateur.',
      error: error.message,
    });
  }
};

/**
 * Connexion
 * POST /api/auth/login
 */
const login = async (req, res) => {
  try {
    // 🔍 DEBUG LOGGING - VOIR TOUT LE BODY
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔐 LOGIN ATTEMPT:');
    console.log('  📦 FULL req.body:', JSON.stringify(req.body, null, 2));
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    const { email, password, subdomain } = req.body;

    console.log('  📧 Email:', email);
    console.log('  🔑 Has password:', !!password);
    console.log('  🏷️  Subdomain from frontend:', subdomain || 'None (Super Admin domain)');

    // Si subdomain fourni, récupérer le client correspondant
    let clientId = null;
    if (subdomain) {
      const { Client } = require('../models');
      const client = await Client.findOne({ subdomain, status: 'ACTIVE' });

      if (!client) {
        console.log('  ❌ SUBDOMAIN NOT FOUND:', subdomain);
        return res.status(404).json({
          success: false,
          message: `Le sous-domaine "${subdomain}" n'existe pas ou est inactif.`,
          code: 'SUBDOMAIN_NOT_FOUND',
        });
      }

      clientId = client._id;
      console.log('  🏢 Client found:', client.companyName, '-', clientId);
    }

    // Si connexion via sous-domaine client, vérifier que l'utilisateur appartient au client
    let query = { email };
    if (clientId) {
      query.clientId = clientId;
    }

    console.log('  🔍 MongoDB Query:', JSON.stringify(query));

    // Récupérer l'utilisateur avec le mot de passe
    const user = await User.findOne(query).select('+password');

    console.log('  👤 User found:', !!user);
    if (user) {
      console.log('  📋 User details:');
      console.log('    - ID:', user._id);
      console.log('    - Email:', user.email);
      console.log('    - Role:', user.role);
      console.log('    - ClientId:', user.clientId || 'None (Super Admin)');
      console.log('    - Status:', user.status);
    }
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: subdomain
          ? 'Email ou mot de passe incorrect pour ce client.'
          : 'Email ou mot de passe incorrect.',
      });
    }

    // 🔒 SÉCURITÉ: Vérifier que les utilisateurs B2B se connectent via leur sous-domaine
    if (!subdomain && user.clientId) {
      // Utilisateur B2B essaie de se connecter sur le domaine principal (sans sous-domaine)
      console.log('❌ CONNEXION REFUSÉE: Utilisateur B2B tente de se connecter sans sous-domaine');
      return res.status(403).json({
        success: false,
        message: 'Veuillez vous connecter via le sous-domaine de votre entreprise.',
        code: 'SUBDOMAIN_REQUIRED',
      });
    }

    // 🔒 SÉCURITÉ: Vérifier que seuls les SUPER_ADMIN peuvent se connecter sur le domaine principal
    if (!subdomain && user.role !== 'SUPER_ADMIN') {
      console.log('❌ CONNEXION REFUSÉE: Seuls les Super Admin peuvent se connecter sur le domaine principal');
      return res.status(403).json({
        success: false,
        message: 'Accès non autorisé. Veuillez utiliser le sous-domaine de votre entreprise.',
        code: 'SUPERADMIN_ONLY',
      });
    }

    // Vérifier si le compte est verrouillé
    if (user.isLocked()) {
      const minutesLeft = Math.ceil((user.security.lockedUntil - Date.now()) / 60000);
      return res.status(403).json({
        success: false,
        message: `Compte verrouillé suite à plusieurs tentatives échouées. Réessayez dans ${minutesLeft} minute(s).`,
      });
    }

    // Vérifier le mot de passe
    const isPasswordValid = await user.comparePassword(password);

    if (!isPasswordValid) {
      // Incrémenter les tentatives échouées
      await user.incrementFailedAttempts();

      return res.status(401).json({
        success: false,
        message: 'Email ou mot de passe incorrect.',
      });
    }

    // Réinitialiser les tentatives échouées
    await user.resetFailedAttempts();

    // Vérifier si le compte est actif
    if (user.status !== 'ACTIVE') {
      return res.status(403).json({
        success: false,
        message: 'Compte inactif ou suspendu.',
      });
    }

    // Générer les tokens
    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();

    // Sauvegarder le refresh token
    user.refreshToken = refreshToken;
    user.lastLoginAt = Date.now();
    user.lastLoginIP = req.ip;
    await user.save();

    // Log l'action
    await AuditLog.log({
      clientId: user.clientId,
      action: 'USER_LOGGED_IN',
      actor: {
        userId: user._id,
        type: 'USER',
        name: `${user.firstName} ${user.lastName}`,
        email: user.email,
      },
      details: {
        description: `Connexion réussie`,
      },
      context: {
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      },
      result: 'SUCCESS',
    });

    return res.status(200).json({
      success: true,
      message: 'Connexion réussie.',
      data: {
        user: user.toJSON(),
        accessToken,
        refreshToken,
      },
    });
  } catch (error) {
    console.error('Erreur login:', error);
    return res.status(500).json({
      success: false,
      message: 'Erreur lors de la connexion.',
      error: error.message,
    });
  }
};

/**
 * Rafraîchir le token d'accès
 * POST /api/auth/refresh
 */
const refreshAccessToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        message: 'Refresh token requis.',
      });
    }

    // Vérifier le refresh token
    let decoded;
    try {
      decoded = require('jsonwebtoken').verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    } catch (error) {
      return res.status(401).json({
        success: false,
        message: 'Refresh token invalide ou expiré.',
      });
    }

    // Récupérer l'utilisateur
    const user = await User.findById(decoded.id);

    if (!user || user.refreshToken !== refreshToken) {
      return res.status(401).json({
        success: false,
        message: 'Refresh token invalide.',
      });
    }

    if (user.status !== 'ACTIVE') {
      return res.status(403).json({
        success: false,
        message: 'Compte inactif ou suspendu.',
      });
    }

    // Générer un nouveau access token
    const newAccessToken = user.generateAccessToken();

    return res.status(200).json({
      success: true,
      message: 'Token rafraîchi avec succès.',
      data: {
        accessToken: newAccessToken,
      },
    });
  } catch (error) {
    console.error('Erreur refresh token:', error);
    return res.status(500).json({
      success: false,
      message: 'Erreur lors du rafraîchissement du token.',
      error: error.message,
    });
  }
};

/**
 * Déconnexion
 * POST /api/auth/logout
 */
const logout = async (req, res) => {
  try {
    // Supprimer le refresh token de l'utilisateur
    if (req.user) {
      req.user.refreshToken = null;
      await req.user.save();

      // Log l'action
      await AuditLog.log({
        clientId: req.user.clientId,
        action: 'USER_LOGGED_OUT',
        actor: {
          userId: req.user._id,
          type: 'USER',
          name: `${req.user.firstName} ${req.user.lastName}`,
          email: req.user.email,
        },
        context: {
          ipAddress: req.ip,
          userAgent: req.get('user-agent'),
        },
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Déconnexion réussie.',
    });
  } catch (error) {
    console.error('Erreur logout:', error);
    return res.status(500).json({
      success: false,
      message: 'Erreur lors de la déconnexion.',
      error: error.message,
    });
  }
};

/**
 * Mot de passe oublié - Envoyer un email de réinitialisation
 * POST /api/auth/forgot-password
 */
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });

    // Pour des raisons de sécurité, toujours retourner le même message
    const successMessage = 'Si cet email existe, un lien de réinitialisation a été envoyé.';

    if (!user) {
      return res.status(200).json({
        success: true,
        message: successMessage,
      });
    }

    // Générer un token de réinitialisation
    const resetToken = user.generateResetPasswordToken();
    await user.save();

    // TODO: Envoyer l'email (à implémenter avec Nodemailer)
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;

    console.log('🔗 Lien de réinitialisation:', resetUrl);
    console.log('📧 Email destinataire:', email);

    // Pour l'instant, juste logger (en dev)
    // En production, utiliser emailService.sendPasswordReset(user.email, resetUrl)

    return res.status(200).json({
      success: true,
      message: successMessage,
      // En dev uniquement:
      ...(process.env.NODE_ENV === 'development' && { resetToken, resetUrl }),
    });
  } catch (error) {
    console.error('Erreur forgot password:', error);
    return res.status(500).json({
      success: false,
      message: 'Erreur lors de la demande de réinitialisation.',
      error: error.message,
    });
  }
};

/**
 * Réinitialiser le mot de passe
 * POST /api/auth/reset-password/:token
 */
const resetPassword = async (req, res) => {
  try {
    const { token } = req.params;
    const { password } = req.body;

    // Hasher le token pour le comparer
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    // Trouver l'utilisateur avec ce token non expiré
    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpire: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Token de réinitialisation invalide ou expiré.',
      });
    }

    // Mettre à jour le mot de passe
    user.password = password; // Sera hashé par le hook
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save();

    // Log l'action
    await AuditLog.log({
      clientId: user.clientId,
      action: 'PASSWORD_RESET',
      actor: {
        userId: user._id,
        type: 'USER',
        name: `${user.firstName} ${user.lastName}`,
        email: user.email,
      },
      context: {
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      },
    });

    return res.status(200).json({
      success: true,
      message: 'Mot de passe réinitialisé avec succès.',
    });
  } catch (error) {
    console.error('Erreur reset password:', error);
    return res.status(500).json({
      success: false,
      message: 'Erreur lors de la réinitialisation du mot de passe.',
      error: error.message,
    });
  }
};

/**
 * Changer le mot de passe (utilisateur connecté)
 * POST /api/auth/change-password
 */
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    // Récupérer l'utilisateur avec le mot de passe
    const user = await User.findById(req.user._id).select('+password');

    // Vérifier le mot de passe actuel
    const isPasswordValid = await user.comparePassword(currentPassword);

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Mot de passe actuel incorrect.',
      });
    }

    // Mettre à jour le mot de passe
    user.password = newPassword;
    await user.save();

    // Log l'action
    await AuditLog.log({
      clientId: user.clientId,
      action: 'PASSWORD_CHANGED',
      actor: {
        userId: user._id,
        type: 'USER',
        name: `${user.firstName} ${user.lastName}`,
        email: user.email,
      },
      context: {
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      },
    });

    return res.status(200).json({
      success: true,
      message: 'Mot de passe modifié avec succès.',
    });
  } catch (error) {
    console.error('Erreur change password:', error);
    return res.status(500).json({
      success: false,
      message: 'Erreur lors du changement de mot de passe.',
      error: error.message,
    });
  }
};

/**
 * Obtenir l'utilisateur connecté
 * GET /api/auth/me
 */
const getMe = async (req, res) => {
  try {
    return res.status(200).json({
      success: true,
      data: {
        user: req.user.toJSON(),
      },
    });
  } catch (error) {
    console.error('Erreur getMe:', error);
    return res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération du profil.',
      error: error.message,
    });
  }
};

module.exports = {
  register,
  login,
  refreshAccessToken,
  logout,
  forgotPassword,
  resetPassword,
  changePassword,
  getMe,
};
