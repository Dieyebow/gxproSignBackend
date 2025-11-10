const mongoose = require('mongoose');

const documentSchema = new mongoose.Schema(
  {
    // Informations de base
    title: {
      type: String,
      required: [true, 'Le titre du document est requis'],
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },

    // Fichier
    file: {
      originalName: {
        type: String,
        required: true,
      },
      filename: {
        type: String,
        required: true,
      },
      fileUrl: {
        type: String,
        required: true,
      },
      fileSize: {
        type: Number,
        required: true,
      },
      mimeType: {
        type: String,
        required: true,
        default: 'application/pdf',
      },
      pageCount: {
        type: Number,
        default: 1,
      },
      hash: String, // SHA-256 du fichier original
    },

    // Miniature
    thumbnail: {
      url: String,
      width: Number,
      height: Number,
    },

    // Organisation
    folder: {
      type: String,
      trim: true,
    },
    tags: {
      type: [String],
      default: [],
    },

    // Template
    isTemplate: {
      type: Boolean,
      default: false,
    },
    templateName: {
      type: String,
      trim: true,
    },

    // Appartenance
    clientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Client',
      required: true,
    },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    // Statistiques
    stats: {
      timesUsed: {
        type: Number,
        default: 0,
      },
      lastUsedAt: Date,
    },

    // Métadonnées
    status: {
      type: String,
      enum: ['ACTIVE', 'ARCHIVED', 'DELETED'],
      default: 'ACTIVE',
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
documentSchema.index({ clientId: 1, status: 1 });
documentSchema.index({ uploadedBy: 1 });
documentSchema.index({ isTemplate: 1 });
documentSchema.index({ title: 'text', description: 'text' });
documentSchema.index({ createdAt: -1 });

// Méthodes d'instance
documentSchema.methods.incrementUsage = async function () {
  this.stats.timesUsed += 1;
  this.stats.lastUsedAt = Date.now();
  await this.save();
};

// Méthodes statiques
documentSchema.statics.findByClient = function (clientId, options = {}) {
  const query = { clientId, status: 'ACTIVE' };
  return this.find(query)
    .sort(options.sort || { createdAt: -1 })
    .limit(options.limit || 20)
    .populate('uploadedBy', 'firstName lastName email');
};

documentSchema.statics.findTemplates = function (clientId) {
  return this.find({ clientId, isTemplate: true, status: 'ACTIVE' }).sort({ templateName: 1 });
};

module.exports = mongoose.model('Document', documentSchema);
