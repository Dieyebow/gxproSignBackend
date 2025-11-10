const Field = require('../models/Field');
const Envelope = require('../models/Envelope');

/**
 * Get fields for an envelope
 * GET /fields?envelopeId=xxx
 */
const getFields = async (req, res) => {
  try {
    const { envelopeId } = req.query;

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📥 GET /fields?envelopeId=${envelopeId}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    if (!envelopeId) {
      console.log('❌ envelopeId manquant');
      return res.status(400).json({
        success: false,
        message: 'envelopeId est requis',
      });
    }

    // Verify envelope exists and user has access
    console.log('🔍 Vérification de l\'enveloppe...');
    const envelope = await Envelope.findById(envelopeId);
    if (!envelope) {
      console.log('❌ Enveloppe non trouvée');
      return res.status(404).json({
        success: false,
        message: 'Enveloppe non trouvée',
      });
    }

    console.log('✅ Enveloppe trouvée:', envelope._id);
    console.log('🔐 Vérification d\'accès...');
    console.log('  - ClientId utilisateur:', req.user.clientId?.toString());
    console.log('  - ClientId enveloppe:', envelope.clientId?.toString());

    // Check access - envelope belongs to user's client
    if (envelope.clientId.toString() !== req.user.clientId.toString()) {
      console.log('❌ Accès refusé: clientId ne correspond pas');
      return res.status(403).json({
        success: false,
        message: 'Accès non autorisé',
      });
    }

    console.log('✅ Accès autorisé');
    console.log('🔍 Recherche des champs...');
    const fields = await Field.find({ envelopeId }).sort({ page: 1, 'position.y': 1 });

    console.log(`✅ ${fields.length} champ(s) trouvé(s)`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    res.json({
      success: true,
      data: {
        fields,
      },
    });
  } catch (error) {
    console.error('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error('❌ ERREUR dans getFields');
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error('Type d\'erreur:', error.name);
    console.error('Message:', error.message);
    console.error('Stack:', error.stack);
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des champs',
    });
  }
};

/**
 * Create a single field
 * POST /fields
 */
const createField = async (req, res) => {
  try {
    const { envelopeId, recipientId, type, label, page, position, validation } = req.body;

    // Verify envelope exists and user has access
    const envelope = await Envelope.findById(envelopeId);
    if (!envelope) {
      return res.status(404).json({
        success: false,
        message: 'Enveloppe non trouvée',
      });
    }

    if (envelope.clientId.toString() !== req.user.clientId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Accès non autorisé',
      });
    }

    // Verify recipient exists in envelope
    const recipient = envelope.recipients.find((r) => r.recipientId === recipientId);
    if (!recipient) {
      return res.status(400).json({
        success: false,
        message: 'Destinataire non trouvé dans cette enveloppe',
      });
    }

    const field = await Field.create({
      envelopeId,
      recipientId,
      type,
      label: label || type,
      page,
      position,
      validation: validation || { required: true },
      status: 'EMPTY',
    });

    res.status(201).json({
      success: true,
      data: {
        field,
      },
    });
  } catch (error) {
    console.error('Erreur create field:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la création du champ',
    });
  }
};

/**
 * Bulk create fields
 * POST /fields/bulk
 */
const bulkCreateFields = async (req, res) => {
  try {
    const { fields } = req.body;

    if (!fields || !Array.isArray(fields) || fields.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'fields doit être un tableau non vide',
      });
    }

    // Verify all fields belong to the same envelope
    const envelopeId = fields[0].envelopeId;
    const envelope = await Envelope.findById(envelopeId);

    if (!envelope) {
      return res.status(404).json({
        success: false,
        message: 'Enveloppe non trouvée',
      });
    }

    if (envelope.clientId.toString() !== req.user.clientId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Accès non autorisé',
      });
    }

    // Delete existing fields for this envelope
    await Field.deleteMany({ envelopeId });

    // Create new fields
    const createdFields = await Field.insertMany(
      fields.map((f) => ({
        envelopeId: f.envelopeId,
        recipientId: f.recipientId,
        type: f.type,
        label: f.label || f.type,
        page: f.page,
        position: f.position,
        validation: f.validation || { required: true },
        status: 'EMPTY',
      }))
    );

    res.status(201).json({
      success: true,
      data: {
        fields: createdFields,
        count: createdFields.length,
      },
    });
  } catch (error) {
    console.error('Erreur bulk create fields:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la création des champs',
    });
  }
};

/**
 * Update a field
 * PUT /fields/:id
 */
const updateField = async (req, res) => {
  try {
    const { id } = req.params;
    const { label, position, validation, value } = req.body;

    const field = await Field.findById(id);
    if (!field) {
      return res.status(404).json({
        success: false,
        message: 'Champ non trouvé',
      });
    }

    // Verify envelope access
    const envelope = await Envelope.findById(field.envelopeId);
    if (!envelope) {
      return res.status(404).json({
        success: false,
        message: 'Enveloppe non trouvée',
      });
    }

    if (envelope.clientId.toString() !== req.user.clientId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Accès non autorisé',
      });
    }

    // Update field
    if (label !== undefined) field.label = label;
    if (position !== undefined) field.position = position;
    if (validation !== undefined) field.validation = validation;
    if (value !== undefined) {
      field.value = value;
      field.status = 'FILLED';
      field.fillDate = new Date();
    }

    await field.save();

    res.json({
      success: true,
      data: {
        field,
      },
    });
  } catch (error) {
    console.error('Erreur update field:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise à jour du champ',
    });
  }
};

/**
 * Delete a field
 * DELETE /fields/:id
 */
const deleteField = async (req, res) => {
  try {
    const { id } = req.params;

    const field = await Field.findById(id);
    if (!field) {
      return res.status(404).json({
        success: false,
        message: 'Champ non trouvé',
      });
    }

    // Verify envelope access
    const envelope = await Envelope.findById(field.envelopeId);
    if (!envelope) {
      return res.status(404).json({
        success: false,
        message: 'Enveloppe non trouvée',
      });
    }

    if (envelope.clientId.toString() !== req.user.clientId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Accès non autorisé',
      });
    }

    await Field.findByIdAndDelete(id);

    res.json({
      success: true,
      message: 'Champ supprimé',
    });
  } catch (error) {
    console.error('Erreur delete field:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la suppression du champ',
    });
  }
};

/**
 * Fill a field (public endpoint with token)
 * POST /fields/:id/fill
 */
const fillField = async (req, res) => {
  try {
    const { id } = req.params;
    const { value, token } = req.body;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: 'Token requis',
      });
    }

    const field = await Field.findById(id);
    if (!field) {
      return res.status(404).json({
        success: false,
        message: 'Champ non trouvé',
      });
    }

    // Verify token
    const envelope = await Envelope.findById(field.envelopeId);
    if (!envelope) {
      return res.status(404).json({
        success: false,
        message: 'Enveloppe non trouvée',
      });
    }

    const recipient = envelope.recipients.find((r) => r.recipientId === field.recipientId);
    if (!recipient || recipient.token !== token) {
      return res.status(403).json({
        success: false,
        message: 'Token invalide',
      });
    }

    // Check token expiration
    if (new Date() > recipient.tokenExpiration) {
      return res.status(403).json({
        success: false,
        message: 'Token expiré',
      });
    }

    // Fill field
    field.value = value;
    field.status = 'FILLED';
    field.fillDate = new Date();
    await field.save();

    res.json({
      success: true,
      data: {
        field,
      },
    });
  } catch (error) {
    console.error('Erreur fill field:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors du remplissage du champ',
    });
  }
};

module.exports = {
  getFields,
  createField,
  bulkCreateFields,
  updateField,
  deleteField,
  fillField,
};
