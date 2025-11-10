const express = require('express');
const router = express.Router();
const { Client, User } = require('../models');

/**
 * @route   GET /api/activation/verify/:token
 * @desc    Vérifier la validité d'un token d'activation
 * @access  Public
 */
router.get('/verify/:token', async (req, res) => {
  try {
    const { token } = req.params;

    // Trouver le client avec ce token
    const client = await Client.findOne({
      invitationToken: token,
      invitationUsed: false,
    }).select('+invitationToken +invitationExpires');

    if (!client) {
      return res.status(404).json({
        success: false,
        message: 'Token d\'activation invalide ou déjà utilisé.',
      });
    }

    // Vérifier si le token a expiré
    if (client.invitationExpires < new Date()) {
      return res.status(400).json({
        success: false,
        message: 'Ce lien d\'activation a expiré.',
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        companyName: client.companyName,
        subdomain: client.subdomain,
        email: client.email,
        contactPerson: client.contactPerson,
      },
    });
  } catch (error) {
    console.error('Erreur verification token:', error);
    return res.status(500).json({
      success: false,
      message: 'Erreur lors de la vérification du token.',
    });
  }
});

/**
 * @route   POST /api/activation/activate
 * @desc    Activer le compte et créer le premier utilisateur admin
 * @access  Public
 */
router.post('/activate', async (req, res) => {
  try {
    const { token, firstName, lastName, password } = req.body;

    // Validation
    if (!token || !firstName || !lastName || !password) {
      return res.status(400).json({
        success: false,
        message: 'Tous les champs sont requis.',
      });
    }

    // Vérifier le mot de passe
    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'Le mot de passe doit contenir au moins 8 caractères.',
      });
    }

    // Trouver le client avec ce token
    const client = await Client.findOne({
      invitationToken: token,
      invitationUsed: false,
    }).select('+invitationToken +invitationExpires');

    if (!client) {
      return res.status(404).json({
        success: false,
        message: 'Token d\'activation invalide ou déjà utilisé.',
      });
    }

    // Vérifier si le token a expiré
    if (client.invitationExpires < new Date()) {
      return res.status(400).json({
        success: false,
        message: 'Ce lien d\'activation a expiré.',
      });
    }

    // Vérifier si un utilisateur existe déjà pour ce client
    const existingUser = await User.findOne({ clientId: client._id });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Un compte a déjà été créé pour ce client.',
      });
    }

    // Créer le premier utilisateur admin
    // Le mot de passe sera automatiquement hashé par le hook pre-save du modèle User
    const user = await User.create({
      firstName,
      lastName,
      email: client.email,
      password, // Plain password - will be hashed by User model's pre-save hook
      role: 'ADMIN_B2B',
      clientId: client._id,
      emailVerified: true, // Email déjà vérifié via le token
      status: 'ACTIVE',
    });

    // Marquer le token comme utilisé
    client.invitationUsed = true;
    client.invitationToken = undefined;
    client.invitationExpires = undefined;
    await client.save();

    return res.status(201).json({
      success: true,
      message: 'Compte activé avec succès ! Vous pouvez maintenant vous connecter.',
      data: {
        user: {
          id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          role: user.role,
        },
      },
    });
  } catch (error) {
    console.error('Erreur activation compte:', error);
    return res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'activation du compte.',
      error: error.message,
    });
  }
});

module.exports = router;
