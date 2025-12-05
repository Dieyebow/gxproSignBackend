const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const recipientSchema = new mongoose.Schema(
  {
    recipientId: {
      type: String,
      default: () => uuidv4(),
    },
    order: {
      type: Number,
      required: true,
    },
    role: {
      type: String,
      enum: ['SIGNER', 'REVIEWER', 'APPROVER', 'CC'],
      default: 'SIGNER',
    },

    // Informations du destinataire
    firstName: {
      type: String,
      required: true,
      trim: true,
    },
    lastName: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    phone: String,

    // Token de signature
    token: {
      type: String,
      default: () => uuidv4(),
    },
    tokenExpiration: Date,

    // Statut
    status: {
      type: String,
      enum: ['PENDING', 'SENT', 'OPENED', 'SIGNED', 'APPROVED', 'DECLINED', 'EXPIRED'],
      default: 'PENDING',
    },

    // Actions effectuées
    sentAt: Date,
    openedAt: Date,
    signedAt: Date,
    approvedAt: Date,
    declinedAt: Date,
    declineReason: String,

    // Action effectuée (pour différencier sign/approve)
    action: {
      type: String,
      enum: ['SIGN', 'APPROVE', 'REJECT'],
    },

    // Métadonnées de signature
    signatureMetadata: {
      ipAddress: String,
      userAgent: String,
      geolocation: {
        country: String,
        city: String,
        latitude: Number,
        longitude: Number,
      },
      signatureMethod: {
        type: String,
        enum: ['DRAW', 'TEXT', 'UPLOAD'],
      },
      signatureDuration: Number, // en secondes
      deviceType: {
        type: String,
        enum: ['DESKTOP', 'TABLET', 'MOBILE'],
      },
    },

    // Rappels
    reminders: [
      {
        sentAt: {
          type: Date,
          default: Date.now,
        },
        type: {
          type: String,
          enum: ['AUTO', 'MANUAL'],
          default: 'AUTO',
        },
      },
    ],

    // Code d'accès (optionnel)
    accessCode: String,
    requireAccessCode: {
      type: Boolean,
      default: false,
    },
  },
  { _id: false }
);

const envelopeSchema = new mongoose.Schema(
  {
    // Référence au document
    documentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Document',
      required: true,
    },

    // Informations de base
    title: {
      type: String,
      required: true,
      trim: true,
    },
    message: {
      type: String,
      trim: true,
    },

    // Expéditeur
    sender: {
      userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
      },
      name: String,
      email: String,
    },

    // Destinataires (signataires)
    recipients: [recipientSchema],

    // Workflow
    workflow: {
      type: {
        type: String,
        enum: ['SEQUENTIAL', 'PARALLEL', 'APPROVAL_THEN_SIGN'],
        default: 'SEQUENTIAL',
      },
      currentStep: {
        type: Number,
        default: 1,
      },
      totalSteps: {
        type: Number,
        default: 1,
      },
    },

    // Dates importantes
    dates: {
      createdAt: {
        type: Date,
        default: Date.now,
      },
      sentAt: Date,
      expiresAt: Date,
      completedAt: Date,
      cancelledAt: Date,
    },

    // Statut global
    status: {
      type: String,
      enum: ['DRAFT', 'SENT', 'IN_PROGRESS', 'COMPLETED', 'DECLINED', 'EXPIRED', 'CANCELLED', 'RECALLED'],
      default: 'DRAFT',
    },

    // Document signé
    signedDocument: {
      fileUrl: String,
      filename: String,
      fileSize: Number,
      hash: String, // SHA-256
      certificateUrl: String, // URL du certificat de signature
    },

    // Paramètres
    settings: {
      allowDecline: {
        type: Boolean,
        default: true,
      },
      requireAllSignatures: {
        type: Boolean,
        default: true,
      },
      sendCopyToSender: {
        type: Boolean,
        default: true,
      },
      autoReminders: {
        type: Boolean,
        default: true,
      },
      reminderIntervalDays: {
        type: Number,
        default: 7,
      },
    },

    // Appartenance
    clientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Client',
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
envelopeSchema.index({ clientId: 1, status: 1 });
envelopeSchema.index({ 'sender.userId': 1 });
envelopeSchema.index({ 'recipients.email': 1 });
envelopeSchema.index({ 'recipients.token': 1 }, { sparse: true });
envelopeSchema.index({ 'dates.expiresAt': 1 });
envelopeSchema.index({ 'dates.sentAt': -1 });
envelopeSchema.index({ status: 1, 'dates.expiresAt': 1 });

// Méthodes d'instance

// Obtenir le destinataire par token
envelopeSchema.methods.getRecipientByToken = function (token) {
  return this.recipients.find((r) => r.token === token);
};

// Obtenir le prochain destinataire dans le workflow séquentiel
envelopeSchema.methods.getNextRecipient = function () {
  if (this.workflow.type !== 'SEQUENTIAL') {
    return null;
  }

  // Chercher le destinataire actuel qui doit signer (status SENT ou OPENED, pas encore SIGNED)
  return this.recipients.find((r) =>
    r.order === this.workflow.currentStep &&
    (r.status === 'SENT' || r.status === 'OPENED')
  );
};

// Vérifier si tous les signataires ont signé
envelopeSchema.methods.isAllSigned = function () {
  const signers = this.recipients.filter((r) => r.role === 'SIGNER');
  return signers.every((r) => r.status === 'SIGNED');
};

// Vérifier si l'enveloppe est expirée
envelopeSchema.methods.isExpired = function () {
  return this.dates.expiresAt && this.dates.expiresAt < Date.now();
};

// Marquer comme envoyé
envelopeSchema.methods.markAsSent = async function () {
  this.status = 'SENT';
  this.dates.sentAt = Date.now();

  // Marquer les destinataires appropriés comme SENT
  if (this.workflow.type === 'SEQUENTIAL') {
    // Seul le premier destinataire
    const firstRecipient = this.recipients.find((r) => r.order === 1);
    if (firstRecipient) {
      firstRecipient.status = 'SENT';
      firstRecipient.sentAt = Date.now();
    }
  } else if (this.workflow.type === 'PARALLEL') {
    // Tous les signataires
    this.recipients.forEach((r) => {
      if (r.role === 'SIGNER') {
        r.status = 'SENT';
        r.sentAt = Date.now();
      }
    });
  }

  await this.save();
};

// Marquer un destinataire comme ayant ouvert le document
envelopeSchema.methods.markAsOpened = async function (recipientId) {
  const recipient = this.recipients.find((r) => r.recipientId === recipientId);
  if (recipient && recipient.status === 'SENT') {
    recipient.status = 'OPENED';
    recipient.openedAt = Date.now();

    if (this.status === 'SENT') {
      this.status = 'IN_PROGRESS';
    }

    await this.save();
  }
};

// Marquer un destinataire comme ayant signé
envelopeSchema.methods.markAsSigned = async function (recipientId, metadata) {
  const recipient = this.recipients.find((r) => r.recipientId === recipientId);
  if (!recipient) {
    throw new Error('Destinataire introuvable');
  }

  recipient.status = 'SIGNED';
  recipient.signedAt = Date.now();
  recipient.signatureMetadata = metadata;

  // Workflow séquentiel : passer au suivant
  if (this.workflow.type === 'SEQUENTIAL') {
    const nextRecipient = this.recipients.find(
      (r) => r.order === this.workflow.currentStep + 1 && r.role === 'SIGNER'
    );

    if (nextRecipient) {
      this.workflow.currentStep += 1;
      nextRecipient.status = 'SENT';
      nextRecipient.sentAt = Date.now();
    }
  }

  // Vérifier si tous les signataires ont signé
  if (this.isAllSigned()) {
    this.status = 'COMPLETED';
    this.dates.completedAt = Date.now();
  } else {
    this.status = 'IN_PROGRESS';
  }

  await this.save();
  return this;
};

// Marquer comme refusé
envelopeSchema.methods.markAsDeclined = async function (recipientId, reason) {
  const recipient = this.recipients.find((r) => r.recipientId === recipientId);
  if (recipient) {
    recipient.status = 'DECLINED';
    recipient.declinedAt = Date.now();
    recipient.declineReason = reason;

    this.status = 'DECLINED';
    await this.save();
  }
};

// Annuler l'enveloppe
envelopeSchema.methods.cancel = async function () {
  this.status = 'CANCELLED';
  this.dates.cancelledAt = Date.now();

  // Invalider tous les tokens
  this.recipients.forEach((r) => {
    if (r.status !== 'SIGNED' && r.status !== 'DECLINED') {
      r.status = 'EXPIRED';
    }
  });

  await this.save();
};

// Ajouter un rappel
envelopeSchema.methods.addReminder = async function (recipientId, type = 'AUTO') {
  const recipient = this.recipients.find((r) => r.recipientId === recipientId);
  if (recipient) {
    recipient.reminders.push({
      sentAt: Date.now(),
      type,
    });
    await this.save();
  }
};

// Méthodes statiques
envelopeSchema.statics.findByClient = function (clientId, filters = {}) {
  const query = { clientId, ...filters };
  return this.find(query)
    .sort({ 'dates.sentAt': -1 })
    .populate('documentId', 'title file')
    .populate('sender.userId', 'firstName lastName email');
};

envelopeSchema.statics.findExpired = function () {
  return this.find({
    status: { $in: ['SENT', 'IN_PROGRESS'] },
    'dates.expiresAt': { $lt: Date.now() },
  });
};

envelopeSchema.statics.findPendingReminders = function () {
  const reminderThreshold = new Date();
  reminderThreshold.setDate(reminderThreshold.getDate() - 7); // 7 jours

  return this.find({
    status: { $in: ['SENT', 'IN_PROGRESS'] },
    'recipients.status': { $in: ['SENT', 'OPENED'] },
    'recipients.reminders.sentAt': { $lt: reminderThreshold },
  });
};

module.exports = mongoose.model('Envelope', envelopeSchema);
