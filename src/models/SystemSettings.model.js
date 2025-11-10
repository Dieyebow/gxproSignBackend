const mongoose = require('mongoose');

/**
 * Schéma pour les paramètres système
 * Un seul document existe dans la collection (singleton pattern)
 */
const systemSettingsSchema = new mongoose.Schema(
  {
    // Paramètres généraux
    general: {
      platformName: {
        type: String,
        default: 'GXpro Sign',
      },
      supportEmail: {
        type: String,
        default: 'support@gxprosign.com',
      },
      adminEmail: {
        type: String,
        default: 'admin@gxprosign.com',
      },
      website: {
        type: String,
        default: 'https://gxprosign.com',
      },
    },

    // Paramètres email
    email: {
      fromName: {
        type: String,
        default: 'GXpro Sign',
      },
      fromEmail: {
        type: String,
        default: 'noreply@gxprosign.com',
      },
      replyToEmail: {
        type: String,
        default: 'support@gxprosign.com',
      },
    },

    // Paramètres documents
    documents: {
      maxFileSize: {
        type: Number,
        default: 10, // En MB
      },
      allowedFormats: {
        type: [String],
        default: ['pdf', 'doc', 'docx'],
      },
      defaultExpirationDays: {
        type: Number,
        default: 30,
      },
    },

    // Paramètres de sécurité
    security: {
      sessionTimeout: {
        type: Number,
        default: 60, // En minutes
      },
      maxLoginAttempts: {
        type: Number,
        default: 5,
      },
      lockoutDuration: {
        type: Number,
        default: 15, // En minutes
      },
      requireEmailVerification: {
        type: Boolean,
        default: true,
      },
      require2FA: {
        type: Boolean,
        default: false,
      },
    },

    // Limites par défaut
    limits: {
      maxUsersPerClient: {
        type: Number,
        default: 100,
      },
      maxDocumentsPerMonth: {
        type: Number,
        default: 1000,
      },
      maxStoragePerClient: {
        type: Number,
        default: 10, // En GB
      },
    },

    // Métadonnées
    lastUpdatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
  }
);

/**
 * Méthode statique pour obtenir ou créer les paramètres système (singleton)
 */
systemSettingsSchema.statics.getSettings = async function () {
  let settings = await this.findOne();

  if (!settings) {
    // Créer les paramètres par défaut s'ils n'existent pas
    settings = await this.create({});
  }

  return settings;
};

/**
 * Méthode statique pour mettre à jour une section spécifique
 */
systemSettingsSchema.statics.updateSection = async function (section, data, userId) {
  const settings = await this.getSettings();

  if (!settings[section]) {
    throw new Error(`Section "${section}" invalide`);
  }

  // Mettre à jour la section
  settings[section] = { ...settings[section].toObject(), ...data };
  settings.lastUpdatedBy = userId;

  await settings.save();
  return settings;
};

const SystemSettings = mongoose.model('SystemSettings', systemSettingsSchema);

module.exports = SystemSettings;
