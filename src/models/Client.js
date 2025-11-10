const mongoose = require('mongoose');

const clientSchema = new mongoose.Schema(
  {
    // Informations de base
    companyName: {
      type: String,
      required: [true, 'Le nom de l\'entreprise est requis'],
      trim: true,
    },
    subdomain: {
      type: String,
      required: [true, 'Le sous-domaine est requis'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^[a-z0-9-]+$/, 'Le sous-domaine ne peut contenir que des lettres minuscules, chiffres et tirets'],
    },
    email: {
      type: String,
      required: [true, 'L\'email est requis'],
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Email invalide'],
    },
    phone: {
      type: String,
      trim: true,
    },

    // Adresse
    address: {
      street: String,
      city: String,
      state: String,
      zipCode: String,
      country: String,
    },

    // Branding personnalisé
    branding: {
      logo: String, // URL du logo
      primaryColor: {
        type: String,
        default: '#3B82F6',
      },
      secondaryColor: {
        type: String,
        default: '#10B981',
      },
      companySignature: String,
    },

    // Limites d'utilisation
    limits: {
      maxDocumentsPerMonth: {
        type: Number,
        default: 10,
      },
      maxUsers: {
        type: Number,
        default: 5,
      },
      maxStorageGB: {
        type: Number,
        default: 1,
      },
      currentMonthDocuments: {
        type: Number,
        default: 0,
      },
      currentUsers: {
        type: Number,
        default: 0,
      },
      currentStorageGB: {
        type: Number,
        default: 0,
      },
    },

    // Abonnement et facturation
    subscription: {
      plan: {
        type: String,
        enum: ['STARTER', 'PROFESSIONAL', 'ENTERPRISE', 'CUSTOM'],
        default: 'STARTER',
      },
      billingPlan: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'BillingPlan',
      },
      status: {
        type: String,
        enum: ['ACTIVE', 'SUSPENDED', 'CANCELLED', 'TRIAL'],
        default: 'TRIAL',
      },
      startDate: {
        type: Date,
        default: Date.now,
      },
      endDate: Date,
      trialEndDate: Date,
      billingCycle: {
        type: String,
        enum: ['MONTHLY', 'YEARLY', 'MENSUEL', 'TRIMESTRIEL', 'SEMESTRIEL', 'ANNUEL'],
        default: 'MONTHLY',
      },
      // Informations de facturation
      nextBillingDate: {
        type: Date,
      },
      lastBillingDate: {
        type: Date,
      },
      billingAmount: {
        type: Number,
        default: 0,
      },
      currency: {
        type: String,
        default: 'EUR',
        enum: ['EUR', 'USD', 'GBP', 'CAD'],
      },
      // Historique de paiement
      paymentMethod: {
        type: String,
        enum: ['CARD', 'BANK_TRANSFER', 'PAYPAL', 'OTHER'],
      },
      autoRenew: {
        type: Boolean,
        default: true,
      },
    },

    // Paramètres
    settings: {
      defaultTokenExpirationDays: {
        type: Number,
        default: 30,
      },
      allowSignatureUpload: {
        type: Boolean,
        default: true,
      },
      requireTwoFactor: {
        type: Boolean,
        default: false,
      },
      defaultWorkflowType: {
        type: String,
        enum: ['SEQUENTIAL', 'PARALLEL'],
        default: 'SEQUENTIAL',
      },
      emailNotifications: {
        type: Boolean,
        default: true,
      },
      reminderDays: {
        type: [Number],
        default: [3, 7, 14],
      },
    },

    // Token d'invitation pour le premier admin
    invitationToken: {
      type: String,
      select: false, // Ne pas inclure par défaut dans les requêtes
    },
    invitationExpires: {
      type: Date,
      select: false,
    },
    invitationUsed: {
      type: Boolean,
      default: false,
    },

    // Personne de contact
    contactPerson: {
      firstName: String,
      lastName: String,
      position: String,
    },

    // Métadonnées
    status: {
      type: String,
      enum: ['ACTIVE', 'SUSPENDED', 'DELETED'],
      default: 'ACTIVE',
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    lastActivityAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true, // Ajoute createdAt et updatedAt automatiquement
  }
);

// Indexes
clientSchema.index({ subdomain: 1 }, { unique: true });
clientSchema.index({ email: 1 });
clientSchema.index({ status: 1 });

// Méthodes d'instance
clientSchema.methods.canCreateDocument = function () {
  return this.limits.currentMonthDocuments < this.limits.maxDocumentsPerMonth;
};

clientSchema.methods.canAddUser = function () {
  return this.limits.currentUsers < this.limits.maxUsers;
};

// Calculer les jours restants avant la prochaine facturation
clientSchema.methods.getDaysUntilNextBilling = function () {
  if (!this.subscription.nextBillingDate) {
    return null;
  }
  const now = new Date();
  const nextBilling = new Date(this.subscription.nextBillingDate);
  const diffTime = nextBilling - now;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays > 0 ? diffDays : 0;
};

// Calculer les jours restants de l'essai
clientSchema.methods.getDaysUntilTrialEnd = function () {
  if (!this.subscription.trialEndDate || this.subscription.status !== 'TRIAL') {
    return null;
  }
  const now = new Date();
  const trialEnd = new Date(this.subscription.trialEndDate);
  const diffTime = trialEnd - now;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays > 0 ? diffDays : 0;
};

// Obtenir le libellé de la fréquence de facturation
clientSchema.methods.getBillingCycleLabel = function () {
  const labels = {
    'MONTHLY': 'Mensuel',
    'YEARLY': 'Annuel',
    'MENSUEL': 'Mensuel',
    'TRIMESTRIEL': 'Trimestriel',
    'SEMESTRIEL': 'Semestriel',
    'ANNUEL': 'Annuel',
  };
  return labels[this.subscription.billingCycle] || this.subscription.billingCycle;
};

// Méthodes statiques
clientSchema.statics.findBySubdomain = function (subdomain) {
  return this.findOne({ subdomain, status: 'ACTIVE' });
};

module.exports = mongoose.model('Client', clientSchema);
