const { Envelope, Document, User, Field, AuditLog } = require('../models');
const { v4: uuidv4 } = require('uuid');
const emailService = require('../services/emailService');

/**
 * Controller pour la gestion des enveloppes (workflow de signature)
 */

/**
 * Créer une nouvelle enveloppe
 */
const createEnvelope = async (req, res) => {
  try {
    const { documentId, recipients, workflow, message, expiresAt } = req.body;

    // Vérifier que le document existe
    const document = await Document.findById(documentId);
    if (!document) {
      return res.status(404).json({
        success: false,
        message: 'Document non trouvé.',
      });
    }

    // Vérifier l'accès au document
    if (req.user.role !== 'SUPER_ADMIN') {
      if (document.clientId.toString() !== req.user.clientId.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Accès refusé à ce document.',
        });
      }
    }

    // Préparer les destinataires avec tokens uniques
    const preparedRecipients = recipients.map((recipient, index) => ({
      recipientId: uuidv4(),
      order: workflow?.type === 'SEQUENTIAL' ? index + 1 : 1,
      role: recipient.role || 'SIGNER',
      firstName: recipient.firstName,
      lastName: recipient.lastName,
      email: recipient.email,
      phone: recipient.phone,
      token: uuidv4(), // Token unique pour accéder à la signature
      tokenExpiration: expiresAt || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 jours par défaut
      status: workflow?.type === 'SEQUENTIAL' && index > 0 ? 'PENDING' : 'SENT',
      sentAt: workflow?.type === 'SEQUENTIAL' && index > 0 ? null : new Date(),
    }));

    // Créer l'enveloppe
    const envelope = await Envelope.create({
      documentId,
      clientId: document.clientId,
      sender: {
        userId: req.user._id,
        name: `${req.user.firstName} ${req.user.lastName}`,
        email: req.user.email,
      },
      recipients: preparedRecipients,
      workflow: {
        type: workflow?.type || 'PARALLEL',
        currentStep: 1,
        totalSteps: workflow?.type === 'SEQUENTIAL' ? recipients.length : 1,
      },
      message,
      status: 'SENT',
      sentAt: new Date(),
      expiresAt: expiresAt || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    });

    // Mettre à jour le statut du document
    document.status = 'ACTIVE';
    await document.save();

    // Logger l'action
    await AuditLog.log({
      clientId: document.clientId,
      envelopeId: envelope._id,
      documentId: document._id,
      action: 'ENVELOPE_CREATED',
      actor: {
        userId: req.user._id,
        type: 'USER',
        name: `${req.user.firstName} ${req.user.lastName}`,
        email: req.user.email,
      },
      target: {
        type: 'ENVELOPE',
        id: envelope._id,
        name: document.title,
      },
      details: {
        description: `Enveloppe créée pour "${document.title}" avec ${recipients.length} destinataire(s)`,
        metadata: {
          recipientCount: recipients.length,
          workflowType: envelope.workflow.type,
        },
      },
      context: {
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      },
    });

    // Envoyer les emails aux destinataires qui ont le statut SENT
    const senderName = `${req.user.firstName} ${req.user.lastName}`;
    for (const recipient of preparedRecipients.filter(r => r.status === 'SENT')) {
      await emailService.sendSignatureRequestEmail({
        recipientEmail: recipient.email,
        recipientName: `${recipient.firstName} ${recipient.lastName}`,
        senderName,
        documentTitle: document.title,
        description: document.description,
        message,
        signatureToken: recipient.token,
        expiresAt: recipient.tokenExpiration,
      });
    }

    return res.status(201).json({
      success: true,
      message: 'Enveloppe créée avec succès.',
      data: {
        envelope,
        signatureLinks: preparedRecipients.map(r => ({
          email: r.email,
          link: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/sign/${r.token}`,
        })),
      },
    });
  } catch (error) {
    console.error('Erreur createEnvelope:', error);
    return res.status(500).json({
      success: false,
      message: 'Erreur lors de la création de l\'enveloppe.',
      error: error.message,
    });
  }
};

/**
 * Obtenir toutes les enveloppes
 */
const getAllEnvelopes = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      status,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = req.query;

    // Construire le filtre
    const filter = {};

    // Filtrer par client
    if (req.user.role !== 'SUPER_ADMIN') {
      filter.clientId = req.user.clientId;
    } else if (req.query.clientId) {
      filter.clientId = req.query.clientId;
    }

    if (status) {
      filter.status = status;
    }

    if (search) {
      filter.$or = [
        { 'sender.email': { $regex: search, $options: 'i' } },
        { 'recipients.email': { $regex: search, $options: 'i' } },
      ];
    }

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sortOptions = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

    // Récupérer les enveloppes
    const envelopes = await Envelope.find(filter)
      .populate('documentId', 'title file')
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Envelope.countDocuments(filter);

    return res.status(200).json({
      success: true,
      data: {
        envelopes,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit)),
        },
      },
    });
  } catch (error) {
    console.error('Erreur getAllEnvelopes:', error);
    return res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des enveloppes.',
      error: error.message,
    });
  }
};

/**
 * Obtenir une enveloppe par ID
 */
const getEnvelopeById = async (req, res) => {
  try {
    const { id } = req.params;

    const envelope = await Envelope.findById(id)
      .populate('documentId', 'title description file')
      .populate('clientId', 'companyName subdomain');

    if (!envelope) {
      return res.status(404).json({
        success: false,
        message: 'Enveloppe non trouvée.',
      });
    }

    // Vérifier l'accès
    if (req.user.role !== 'SUPER_ADMIN') {
      if (envelope.clientId._id.toString() !== req.user.clientId.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Accès refusé à cette enveloppe.',
        });
      }
    }

    return res.status(200).json({
      success: true,
      data: {
        envelope,
      },
    });
  } catch (error) {
    console.error('Erreur getEnvelopeById:', error);
    return res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération de l\'enveloppe.',
      error: error.message,
    });
  }
};

/**
 * Annuler une enveloppe
 */
const cancelEnvelope = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const envelope = await Envelope.findById(id);

    if (!envelope) {
      return res.status(404).json({
        success: false,
        message: 'Enveloppe non trouvée.',
      });
    }

    // Vérifier l'accès
    if (req.user.role !== 'SUPER_ADMIN') {
      if (envelope.clientId.toString() !== req.user.clientId.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Accès refusé à cette enveloppe.',
        });
      }
    }

    // Vérifier que l'enveloppe peut être annulée
    if (envelope.status === 'COMPLETED' || envelope.status === 'CANCELLED') {
      return res.status(400).json({
        success: false,
        message: `Impossible d'annuler une enveloppe ${envelope.status === 'COMPLETED' ? 'complétée' : 'déjà annulée'}.`,
      });
    }

    envelope.status = 'CANCELLED';
    envelope.cancelledAt = new Date();
    envelope.cancelledBy = req.user._id;
    await envelope.save();

    // Logger l'action
    await AuditLog.log({
      clientId: envelope.clientId,
      envelopeId: envelope._id,
      documentId: envelope.documentId,
      action: 'ENVELOPE_CANCELLED',
      actor: {
        userId: req.user._id,
        type: 'USER',
        name: `${req.user.firstName} ${req.user.lastName}`,
        email: req.user.email,
      },
      target: {
        type: 'ENVELOPE',
        id: envelope._id,
      },
      details: {
        description: 'Enveloppe annulée',
        metadata: { reason },
      },
      context: {
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      },
    });

    // TODO: Envoyer un email aux destinataires pour les informer

    return res.status(200).json({
      success: true,
      message: 'Enveloppe annulée avec succès.',
      data: {
        envelope,
      },
    });
  } catch (error) {
    console.error('Erreur cancelEnvelope:', error);
    return res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'annulation de l\'enveloppe.',
      error: error.message,
    });
  }
};

/**
 * Renvoyer une invitation
 */
const resendInvitation = async (req, res) => {
  try {
    const { id, recipientId } = req.params;

    const envelope = await Envelope.findById(id);

    if (!envelope) {
      return res.status(404).json({
        success: false,
        message: 'Enveloppe non trouvée.',
      });
    }

    // Vérifier l'accès
    if (req.user.role !== 'SUPER_ADMIN') {
      if (envelope.clientId.toString() !== req.user.clientId.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Accès refusé à cette enveloppe.',
        });
      }
    }

    // Trouver le destinataire
    const recipient = envelope.recipients.find(
      r => r.recipientId === recipientId
    );

    if (!recipient) {
      return res.status(404).json({
        success: false,
        message: 'Destinataire non trouvé.',
      });
    }

    if (recipient.status === 'SIGNED') {
      return res.status(400).json({
        success: false,
        message: 'Ce destinataire a déjà signé.',
      });
    }

    // TODO: Renvoyer l'email
    // await emailService.sendSignatureReminder(envelope, recipient);

    // Ajouter un rappel
    envelope.reminders.push({
      recipientId,
      sentAt: new Date(),
      sentBy: req.user._id,
    });
    await envelope.save();

    return res.status(200).json({
      success: true,
      message: 'Invitation renvoyée avec succès.',
    });
  } catch (error) {
    console.error('Erreur resendInvitation:', error);
    return res.status(500).json({
      success: false,
      message: 'Erreur lors du renvoi de l\'invitation.',
      error: error.message,
    });
  }
};

module.exports = {
  createEnvelope,
  getAllEnvelopes,
  getEnvelopeById,
  cancelEnvelope,
  resendInvitation,
};
