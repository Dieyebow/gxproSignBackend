const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema(
  {
    // Référence
    envelopeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Envelope',
    },
    documentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Document',
    },
    clientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Client',
      required: false, // Optional for SuperAdmin actions
    },

    // Action
    action: {
      type: String,
      required: true,
      enum: [
        'ENVELOPE_CREATED',
        'ENVELOPE_SENT',
        'ENVELOPE_CANCELLED',
        'ENVELOPE_COMPLETED',
        'DOCUMENT_OPENED',
        'DOCUMENT_SIGNED',
        'DOCUMENT_DECLINED',
        'DOCUMENT_UPLOADED',
        'DOCUMENT_DELETED',
        'REMINDER_SENT',
        'USER_LOGGED_IN',
        'USER_LOGGED_OUT',
        'USER_CREATED',
        'USER_UPDATED',
        'USER_DELETED',
        'CLIENT_CREATED',
        'CLIENT_UPDATED',
        'CLIENT_SUSPENDED',
        'SETTINGS_UPDATED',
        'PASSWORD_CHANGED',
        'PASSWORD_RESET',
        'TWO_FACTOR_ENABLED',
        'TWO_FACTOR_DISABLED',
        'FIELD_ADDED',
        'FIELD_UPDATED',
        'FIELD_FILLED',
        'SIGNATURE_CREATED',
      ],
    },

    // Acteur
    actor: {
      userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
      type: {
        type: String,
        enum: ['USER', 'SIGNER', 'SYSTEM'],
        required: true,
      },
      name: String,
      email: String,
    },

    // Cible (optionnel)
    target: {
      type: {
        type: String,
        enum: ['ENVELOPE', 'DOCUMENT', 'USER', 'CLIENT', 'FIELD', 'SIGNATURE'],
      },
      id: mongoose.Schema.Types.ObjectId,
      name: String,
    },

    // Détails de l'action
    details: {
      description: String, // Description lisible
      changes: mongoose.Schema.Types.Mixed, // Changements effectués (before/after)
      metadata: mongoose.Schema.Types.Mixed, // Métadonnées additionnelles
    },

    // Contexte technique
    context: {
      ipAddress: String,
      userAgent: String,
      geolocation: {
        country: String,
        city: String,
      },
      deviceType: {
        type: String,
        enum: ['DESKTOP', 'TABLET', 'MOBILE', 'UNKNOWN'],
      },
      timestamp: {
        type: Date,
        default: Date.now,
      },
    },

    // Résultat
    result: {
      type: String,
      enum: ['SUCCESS', 'FAILURE', 'WARNING'],
      default: 'SUCCESS',
    },
    errorMessage: String,
  },
  {
    timestamps: false, // Utiliser context.timestamp au lieu de createdAt
  }
);

// Indexes
auditLogSchema.index({ clientId: 1, 'context.timestamp': -1 });
auditLogSchema.index({ envelopeId: 1 });
auditLogSchema.index({ action: 1 });
auditLogSchema.index({ 'actor.userId': 1 });
auditLogSchema.index({ 'context.timestamp': 1 }, { expireAfterSeconds: 31536000 }); // TTL 1 an

// Virtuel pour createdAt (pour compatibilité)
auditLogSchema.virtual('createdAt').get(function () {
  return this.context.timestamp;
});

// Méthodes statiques
auditLogSchema.statics.log = async function (data) {
  const log = new this({
    clientId: data.clientId,
    envelopeId: data.envelopeId,
    documentId: data.documentId,
    action: data.action,
    actor: data.actor,
    target: data.target,
    details: data.details,
    context: {
      ...data.context,
      timestamp: Date.now(),
    },
    result: data.result || 'SUCCESS',
    errorMessage: data.errorMessage,
  });

  return await log.save();
};

auditLogSchema.statics.findByClient = function (clientId, options = {}) {
  const query = { clientId };

  if (options.action) {
    query.action = options.action;
  }

  if (options.startDate) {
    query['context.timestamp'] = { $gte: options.startDate };
  }

  if (options.endDate) {
    query['context.timestamp'] = {
      ...query['context.timestamp'],
      $lte: options.endDate,
    };
  }

  return this.find(query)
    .sort({ 'context.timestamp': -1 })
    .limit(options.limit || 100);
};

auditLogSchema.statics.findByEnvelope = function (envelopeId) {
  return this.find({ envelopeId }).sort({ 'context.timestamp': 1 });
};

module.exports = mongoose.model('AuditLog', auditLogSchema);
