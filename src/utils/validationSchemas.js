const Joi = require('joi');

/**
 * Schémas de validation Joi pour toutes les routes
 */

// ============================================
// AUTHENTIFICATION
// ============================================

const authSchemas = {
  register: Joi.object({
    firstName: Joi.string().trim().min(2).max(50).required().messages({
      'string.empty': 'Le prénom est requis',
      'string.min': 'Le prénom doit contenir au moins 2 caractères',
      'string.max': 'Le prénom ne peut pas dépasser 50 caractères',
    }),
    lastName: Joi.string().trim().min(2).max(50).required().messages({
      'string.empty': 'Le nom est requis',
      'string.min': 'Le nom doit contenir au moins 2 caractères',
      'string.max': 'Le nom ne peut pas dépasser 50 caractères',
    }),
    email: Joi.string().email().lowercase().trim().required().messages({
      'string.empty': 'L\'email est requis',
      'string.email': 'L\'email doit être valide',
    }),
    password: Joi.string().min(8).max(128).required().messages({
      'string.empty': 'Le mot de passe est requis',
      'string.min': 'Le mot de passe doit contenir au moins 8 caractères',
      'string.max': 'Le mot de passe ne peut pas dépasser 128 caractères',
    }),
    role: Joi.string().valid('ADMIN_B2B', 'USER_B2B').default('USER_B2B'),
    clientId: Joi.string().pattern(/^[0-9a-fA-F]{24}$/),
  }),

  login: Joi.object({
    email: Joi.string().email().lowercase().trim().required().messages({
      'string.empty': 'L\'email est requis',
      'string.email': 'L\'email doit être valide',
    }),
    password: Joi.string().required().messages({
      'string.empty': 'Le mot de passe est requis',
    }),
    subdomain: Joi.string().optional().allow(null, ''),
  }),

  refreshToken: Joi.object({
    refreshToken: Joi.string().required().messages({
      'string.empty': 'Le refresh token est requis',
    }),
  }),

  forgotPassword: Joi.object({
    email: Joi.string().email().lowercase().trim().required().messages({
      'string.empty': 'L\'email est requis',
      'string.email': 'L\'email doit être valide',
    }),
  }),

  resetPassword: Joi.object({
    password: Joi.string().min(8).max(128).required().messages({
      'string.empty': 'Le mot de passe est requis',
      'string.min': 'Le mot de passe doit contenir au moins 8 caractères',
    }),
    confirmPassword: Joi.string().valid(Joi.ref('password')).required().messages({
      'any.only': 'Les mots de passe ne correspondent pas',
    }),
  }),

  changePassword: Joi.object({
    currentPassword: Joi.string().required().messages({
      'string.empty': 'Le mot de passe actuel est requis',
    }),
    newPassword: Joi.string().min(8).max(128).required().messages({
      'string.empty': 'Le nouveau mot de passe est requis',
      'string.min': 'Le nouveau mot de passe doit contenir au moins 8 caractères',
    }),
    confirmPassword: Joi.string().valid(Joi.ref('newPassword')).required().messages({
      'any.only': 'Les mots de passe ne correspondent pas',
    }),
  }),
};

// ============================================
// CLIENTS
// ============================================

const clientSchemas = {
  create: Joi.object({
    companyName: Joi.string().trim().min(2).max(100).required().messages({
      'string.empty': 'Le nom de l\'entreprise est requis',
    }),
    subdomain: Joi.string()
      .trim()
      .lowercase()
      .pattern(/^[a-z0-9-]+$/)
      .min(3)
      .max(50)
      .required()
      .messages({
        'string.empty': 'Le sous-domaine est requis',
        'string.pattern.base': 'Le sous-domaine ne peut contenir que des lettres minuscules, chiffres et tirets',
        'string.min': 'Le sous-domaine doit contenir au moins 3 caractères',
      }),
    email: Joi.string().email().lowercase().trim().required(),
    phone: Joi.string().trim().allow(''),
    // Accepter address comme string OU objet pour plus de flexibilité
    address: Joi.alternatives().try(
      Joi.string().trim().allow(''),
      Joi.object({
        street: Joi.string().trim().allow(''),
        city: Joi.string().trim().allow(''),
        state: Joi.string().trim().allow(''),
        zipCode: Joi.string().trim().allow(''),
        country: Joi.string().trim().allow(''),
      })
    ).optional(),
    // Ajouter contactPerson qui était manquant
    contactPerson: Joi.object({
      firstName: Joi.string().trim().allow(''),
      lastName: Joi.string().trim().allow(''),
      position: Joi.string().trim().allow(''),
    }).optional(),
    subscription: Joi.object({
      plan: Joi.string().valid('STARTER', 'PROFESSIONAL', 'ENTERPRISE', 'CUSTOM').default('STARTER'),
      status: Joi.string().valid('TRIAL', 'ACTIVE', 'PAST_DUE', 'CANCELLED').optional(),
      billingCycle: Joi.string().valid('MONTHLY', 'YEARLY').default('MONTHLY'),
    }),
    limits: Joi.object({
      // -1 = illimité (pour plan ENTERPRISE)
      maxDocumentsPerMonth: Joi.number().integer().min(-1).default(10),
      maxUsers: Joi.number().integer().min(-1).default(5),
      maxStorageGB: Joi.number().integer().min(-1).default(1),
    }),
  }),

  update: Joi.object({
    companyName: Joi.string().trim().min(2).max(100),
    email: Joi.string().email().lowercase().trim(),
    phone: Joi.string().trim().allow(''),
    address: Joi.object({
      street: Joi.string().trim().allow(''),
      city: Joi.string().trim().allow(''),
      state: Joi.string().trim().allow(''),
      zipCode: Joi.string().trim().allow(''),
      country: Joi.string().trim().allow(''),
    }),
    branding: Joi.object({
      logo: Joi.string().uri().allow(''),
      primaryColor: Joi.string().pattern(/^#[0-9A-Fa-f]{6}$/),
      secondaryColor: Joi.string().pattern(/^#[0-9A-Fa-f]{6}$/),
    }),
    subscription: Joi.object({
      plan: Joi.string().valid('STARTER', 'PROFESSIONAL', 'ENTERPRISE', 'CUSTOM'),
      status: Joi.string().valid('TRIAL', 'ACTIVE', 'PAST_DUE', 'CANCELLED'),
      billingCycle: Joi.string().valid('MONTHLY', 'YEARLY'),
    }),
    limits: Joi.object({
      // -1 = illimité (pour plan ENTERPRISE)
      maxDocumentsPerMonth: Joi.number().integer().min(-1),
      maxUsers: Joi.number().integer().min(-1),
      maxStorageGB: Joi.number().integer().min(-1),
    }),
    status: Joi.string().valid('ACTIVE', 'SUSPENDED', 'DELETED'),
  }).min(1), // Au moins un champ doit être fourni
};

// ============================================
// UTILISATEURS
// ============================================

const userSchemas = {
  create: Joi.object({
    firstName: Joi.string().trim().min(2).max(50).required(),
    lastName: Joi.string().trim().min(2).max(50).required(),
    email: Joi.string().email().lowercase().trim().required(),
    password: Joi.string().min(8).max(128).required(),
    role: Joi.string().valid('ADMIN_B2B', 'USER_B2B').default('USER_B2B'),
    clientId: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).required(),
    profile: Joi.object({
      title: Joi.string().trim().allow(''),
      department: Joi.string().trim().allow(''),
      phone: Joi.string().trim().allow(''),
    }),
  }),

  update: Joi.object({
    firstName: Joi.string().trim().min(2).max(50),
    lastName: Joi.string().trim().min(2).max(50),
    email: Joi.string().email().lowercase().trim(),
    role: Joi.string().valid('ADMIN_B2B', 'USER_B2B'),
    status: Joi.string().valid('ACTIVE', 'INACTIVE', 'SUSPENDED'),
    profile: Joi.object({
      title: Joi.string().trim().allow(''),
      department: Joi.string().trim().allow(''),
      phone: Joi.string().trim().allow(''),
      timezone: Joi.string().trim(),
      language: Joi.string().trim(),
    }),
  }).min(1),
};

// ============================================
// DOCUMENTS
// ============================================

const documentSchemas = {
  create: Joi.object({
    title: Joi.string().trim().min(2).max(200).required(),
    description: Joi.string().trim().max(1000).allow(''),
    folder: Joi.string().trim().allow(''),
    tags: Joi.array().items(Joi.string().trim()),
    isTemplate: Joi.boolean().default(false),
    templateName: Joi.string().trim().when('isTemplate', {
      is: true,
      then: Joi.required(),
      otherwise: Joi.optional(),
    }),
  }),

  update: Joi.object({
    title: Joi.string().trim().min(2).max(200),
    description: Joi.string().trim().max(1000).allow(''),
    folder: Joi.string().trim().allow(''),
    tags: Joi.array().items(Joi.string().trim()),
    status: Joi.string().valid('ACTIVE', 'ARCHIVED', 'DELETED'),
  }).min(1),
};

// ============================================
// ENVELOPES
// ============================================

const envelopeSchemas = {
  create: Joi.object({
    documentId: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).required(),
    title: Joi.string().trim().min(2).max(200).required(),
    message: Joi.string().trim().max(1000).allow(''),
    recipients: Joi.array()
      .items(
        Joi.object({
          order: Joi.number().integer().min(1).required(),
          role: Joi.string().valid('SIGNER', 'APPROVER', 'CC').default('SIGNER'),
          firstName: Joi.string().trim().min(2).max(50).required(),
          lastName: Joi.string().trim().min(2).max(50).required(),
          email: Joi.string().email().lowercase().trim().required(),
          phone: Joi.string().trim().allow(''),
          requireAccessCode: Joi.boolean().default(false),
          accessCode: Joi.string().when('requireAccessCode', {
            is: true,
            then: Joi.string().length(6).required(),
            otherwise: Joi.optional(),
          }),
        })
      )
      .min(1)
      .required(),
    workflow: Joi.object({
      type: Joi.string().valid('SEQUENTIAL', 'PARALLEL', 'APPROVAL_THEN_SIGN').default('SEQUENTIAL'),
    }),
    dates: Joi.object({
      expiresAt: Joi.date().greater('now').optional(),
    }),
    settings: Joi.object({
      allowDecline: Joi.boolean().default(true),
      requireAllSignatures: Joi.boolean().default(true),
      sendCopyToSender: Joi.boolean().default(true),
      autoReminders: Joi.boolean().default(true),
      reminderIntervalDays: Joi.number().integer().min(1).default(7),
    }),
  }),
};

// ============================================
// PARAMÈTRES ID
// ============================================

const idSchema = Joi.object({
  id: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .required()
    .messages({
      'string.pattern.base': 'ID invalide',
    }),
});

module.exports = {
  authSchemas,
  clientSchemas,
  userSchemas,
  documentSchemas,
  envelopeSchemas,
  idSchema,
};
