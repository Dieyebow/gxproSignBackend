const mongoose = require('mongoose');

const fieldSchema = new mongoose.Schema(
  {
    // Référence
    envelopeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Envelope',
      required: true,
    },
    documentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Document',
      required: true,
    },

    // Attribution
    recipientId: {
      type: String,
      required: true,
    },

    // Type de champ
    type: {
      type: String,
      enum: [
        'SIGNATURE',
        'INITIAL',
        'DATE',
        'TEXT',
        'EMAIL',
        'NAME',
        'COMPANY',
        'TITLE',
        'CHECKBOX',
        'DROPDOWN',
        'RADIO',
        'ATTACHMENT',
        'NOTE',
        'APPROVE',
        'DECLINE',
        'PHONE',
        'NUMBER',
      ],
      required: true,
    },

    // Position et dimensions (coordonnées en pixels ou %)
    position: {
      page: {
        type: Number,
        required: true,
        min: 1,
      },
      x: {
        type: Number,
        required: true,
      },
      y: {
        type: Number,
        required: true,
      },
      width: {
        type: Number,
        required: true,
      },
      height: {
        type: Number,
        required: true,
      },
    },

    // Propriétés du champ
    properties: {
      label: {
        type: String,
        trim: true,
      },
      placeholder: String,
      required: {
        type: Boolean,
        default: false,
      },
      readOnly: {
        type: Boolean,
        default: false,
      },
      defaultValue: String,
      tooltip: String,

      // Validation
      validation: {
        type: {
          type: String,
          enum: ['email', 'phone', 'date', 'number', 'text', 'url'],
        },
        pattern: String, // Regex
        minLength: Number,
        maxLength: Number,
        min: Number, // Pour les nombres
        max: Number,
      },

      // Pour les listes déroulantes/radio
      options: [String],

      // Formatage
      fontSize: {
        type: Number,
        default: 12,
      },
      fontFamily: {
        type: String,
        default: 'Helvetica',
      },
      fontColor: {
        type: String,
        default: '#000000',
      },
      bold: {
        type: Boolean,
        default: false,
      },
      italic: {
        type: Boolean,
        default: false,
      },

      // Formule (pour calculs automatiques)
      formula: String, // Ex: "field1 + field2"
    },

    // Valeur remplie
    value: String,
    filledAt: Date,

    // Ordre de tabulation
    tabOrder: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
fieldSchema.index({ envelopeId: 1, recipientId: 1 });
fieldSchema.index({ documentId: 1 });
fieldSchema.index({ type: 1 });
fieldSchema.index({ 'position.page': 1 });

// Méthodes d'instance
fieldSchema.methods.fillValue = async function (value) {
  this.value = value;
  this.filledAt = Date.now();
  await this.save();
};

// Méthodes statiques
fieldSchema.statics.findByEnvelopeAndRecipient = function (envelopeId, recipientId) {
  return this.find({ envelopeId, recipientId }).sort({ 'position.page': 1, tabOrder: 1 });
};

fieldSchema.statics.findByPage = function (envelopeId, page) {
  return this.find({ envelopeId, 'position.page': page }).sort({ tabOrder: 1 });
};

module.exports = mongoose.model('Field', fieldSchema);
