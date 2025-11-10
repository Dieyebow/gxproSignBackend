const mongoose = require('mongoose');

const signatureSchema = new mongoose.Schema(
  {
    // Référence
    envelopeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Envelope',
      required: true,
    },
    recipientId: {
      type: String,
      required: true,
    },

    // Signataire
    signer: {
      firstName: {
        type: String,
        required: true,
      },
      lastName: {
        type: String,
        required: true,
      },
      email: {
        type: String,
        required: true,
        lowercase: true,
      },
    },

    // Signature principale
    signature: {
      method: {
        type: String,
        enum: ['DRAW', 'TEXT', 'UPLOAD'],
        required: true,
      },
      imageUrl: {
        type: String,
        required: true,
      },
      imageData: String, // Base64 (optionnel pour backup)
      width: Number,
      height: Number,
      style: String, // Si TEXT: "script", "cursive", "elegant", etc.
      originalFilename: String, // Si UPLOAD
    },

    // Initiales (paraphe)
    initials: {
      method: {
        type: String,
        enum: ['DRAW', 'TEXT', 'UPLOAD'],
      },
      imageUrl: String,
      imageData: String,
      width: Number,
      height: Number,
    },

    // Métadonnées de création
    metadata: {
      ipAddress: String,
      userAgent: String,
      geolocation: {
        country: String,
        city: String,
        latitude: Number,
        longitude: Number,
      },
      timestamp: {
        type: Date,
        default: Date.now,
      },
      deviceType: {
        type: String,
        enum: ['DESKTOP', 'TABLET', 'MOBILE'],
      },
      browserInfo: String,
    },

    // Hash de la signature (pour vérification)
    signatureHash: String, // SHA-256

    // Consentement
    consent: {
      agreed: {
        type: Boolean,
        required: true,
      },
      agreedAt: {
        type: Date,
        required: true,
      },
      consentText: String,
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
signatureSchema.index({ envelopeId: 1 });
signatureSchema.index({ 'signer.email': 1 });
signatureSchema.index({ clientId: 1 });
signatureSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Signature', signatureSchema);
