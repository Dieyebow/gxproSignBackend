const mongoose = require('mongoose');

const billingPlanSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  description: {
    type: String,
    trim: true,
  },
  billingPeriod: {
    type: String,
    enum: ['MENSUEL', 'TRIMESTRIEL', 'SEMESTRIEL', 'ANNUEL'],
    required: true,
  },
  price: {
    type: Number,
    required: true,
    min: 0,
  },
  currency: {
    type: String,
    default: 'EUR',
    enum: ['EUR', 'USD', 'GBP', 'CAD'],
  },
  features: {
    maxUsers: {
      type: Number,
      required: true,
      min: 1,
    },
    maxDocumentsPerMonth: {
      type: Number,
      required: true,
      min: 1,
    },
    maxStorageGB: {
      type: Number,
      required: true,
      min: 1,
    },
    customBranding: {
      type: Boolean,
      default: false,
    },
    apiAccess: {
      type: Boolean,
      default: false,
    },
    prioritySupport: {
      type: Boolean,
      default: false,
    },
    advancedReporting: {
      type: Boolean,
      default: false,
    },
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  isPopular: {
    type: Boolean,
    default: false,
  },
  displayOrder: {
    type: Number,
    default: 0,
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  lastUpdatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
}, {
  timestamps: true,
});

// Index pour recherche et tri
billingPlanSchema.index({ billingPeriod: 1, isActive: 1 });
billingPlanSchema.index({ displayOrder: 1 });

// Méthode virtuelle pour calculer le prix mensuel équivalent
billingPlanSchema.virtual('monthlyEquivalent').get(function() {
  const months = {
    'MENSUEL': 1,
    'TRIMESTRIEL': 3,
    'SEMESTRIEL': 6,
    'ANNUEL': 12,
  };
  return this.price / (months[this.billingPeriod] || 1);
});

// Méthode statique pour obtenir tous les plans actifs
billingPlanSchema.statics.getActivePlans = async function(billingPeriod = null) {
  const query = { isActive: true };
  if (billingPeriod) {
    query.billingPeriod = billingPeriod;
  }
  return this.find(query).sort({ displayOrder: 1, price: 1 });
};

// Méthode statique pour obtenir le plan par défaut
billingPlanSchema.statics.getDefaultPlan = async function() {
  return this.findOne({ isActive: true }).sort({ price: 1 });
};

// Assurez-vous que les champs virtuels sont inclus dans toJSON
billingPlanSchema.set('toJSON', { virtuals: true });
billingPlanSchema.set('toObject', { virtuals: true });

const BillingPlan = mongoose.model('BillingPlan', billingPlanSchema);

module.exports = BillingPlan;
