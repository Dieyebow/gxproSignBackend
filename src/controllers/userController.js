const { User, AuditLog } = require('../models');
const path = require('path');
const fs = require('fs').promises;

/**
 * Controller pour les opérations utilisateur
 */

/**
 * Upload avatar
 * POST /api/users/upload-avatar
 */
const uploadAvatar = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Aucun fichier fourni',
      });
    }

    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Utilisateur non trouvé',
      });
    }

    // Delete old avatar if exists
    if (user.profile?.avatar) {
      const oldAvatarPath = path.join(__dirname, '../../', user.profile.avatar);
      try {
        await fs.unlink(oldAvatarPath);
      } catch (error) {
        // Ignore error if file doesn't exist
        console.log('Old avatar not found, continuing...');
      }
    }

    // Save new avatar path
    const avatarUrl = `/uploads/avatars/${req.file.filename}`;
    user.profile = {
      ...user.profile,
      avatar: avatarUrl,
    };
    await user.save();

    // Log action
    await AuditLog.log({
      clientId: user.clientId,
      action: 'USER_AVATAR_UPDATED',
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
      message: 'Avatar mis à jour avec succès',
      data: {
        avatarUrl,
      },
    });
  } catch (error) {
    console.error('Erreur upload avatar:', error);
    return res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'upload de l\'avatar',
      error: error.message,
    });
  }
};

/**
 * Update profile
 * PUT /api/users/profile
 */
const updateProfile = async (req, res) => {
  try {
    const { firstName, lastName, profile } = req.body;

    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Utilisateur non trouvé',
      });
    }

    // Update fields
    if (firstName) user.firstName = firstName;
    if (lastName) user.lastName = lastName;

    // Update profile fields
    if (profile) {
      user.profile = {
        ...user.profile,
        ...profile,
      };
    }

    await user.save();

    // Log action
    await AuditLog.log({
      clientId: user.clientId,
      action: 'USER_PROFILE_UPDATED',
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
      message: 'Profil mis à jour avec succès',
      data: {
        user: user.toJSON(),
      },
    });
  } catch (error) {
    console.error('Erreur update profile:', error);
    return res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise à jour du profil',
      error: error.message,
    });
  }
};

/**
 * Get user profile
 * GET /api/users/profile
 */
const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Utilisateur non trouvé',
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        user: user.toJSON(),
      },
    });
  } catch (error) {
    console.error('Erreur get profile:', error);
    return res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération du profil',
      error: error.message,
    });
  }
};

module.exports = {
  uploadAvatar,
  updateProfile,
  getProfile,
};
