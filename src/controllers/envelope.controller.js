const Envelope = require('../models/Envelope');
const Document = require('../models/Document');
const Field = require('../models/Field');
const User = require('../models/User');
const { v4: uuidv4 } = require('uuid');

/**
 * Créer une nouvelle enveloppe
 */
exports.createEnvelope = async (req, res) => {
  try {
    const { documentId, title, message, recipients, workflow, expirationDays } = req.body;

    console.log('📥 POST /envelopes - Création d\'une enveloppe');
    console.log('  Document ID:', documentId);
    console.log('  Titre:', title);
    console.log('  Recipients:', recipients.length);

    // Vérifier que le document existe et appartient au client
    const document = await Document.findById(documentId);
    if (!document) {
      return res.status(404).json({
        success: false,
        message: 'Document non trouvé',
      });
    }

    if (document.clientId.toString() !== req.user.clientId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Accès refusé à ce document',
      });
    }

    // Valider les destinataires
    if (!recipients || recipients.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Au moins un destinataire est requis',
      });
    }

    // Préparer les destinataires avec tokens
    const preparedRecipients = recipients.map((r, index) => ({
      recipientId: uuidv4(),
      order: r.order || index + 1,
      role: r.role || 'SIGNER',
      firstName: r.firstName,
      lastName: r.lastName,
      email: r.email.toLowerCase(),
      phone: r.phone,
      token: uuidv4(),
      tokenExpiration: new Date(Date.now() + (expirationDays || 30) * 24 * 60 * 60 * 1000),
      status: 'PENDING',
    }));

    // Calculer la date d'expiration
    const expiresAt = new Date(Date.now() + (expirationDays || 30) * 24 * 60 * 60 * 1000);

    // Créer l'enveloppe
    const envelope = await Envelope.create({
      documentId,
      title,
      message: message || '',
      sender: {
        userId: req.user._id,
        name: `${req.user.firstName} ${req.user.lastName}`,
        email: req.user.email,
      },
      recipients: preparedRecipients,
      workflow: {
        type: workflow?.type || 'SEQUENTIAL',
        currentStep: 1,
        totalSteps: preparedRecipients.filter((r) => r.role === 'SIGNER').length,
      },
      dates: {
        expiresAt,
      },
      status: 'DRAFT',
      clientId: req.user.clientId,
    });

    console.log('✅ Enveloppe créée:', envelope._id);

    return res.status(201).json({
      success: true,
      message: 'Enveloppe créée avec succès',
      data: {
        envelope,
      },
    });
  } catch (error) {
    console.error('❌ Erreur création enveloppe:', error);
    return res.status(500).json({
      success: false,
      message: 'Erreur lors de la création de l\'enveloppe',
      error: error.message,
    });
  }
};

/**
 * Récupérer toutes les enveloppes du client
 */
exports.getEnvelopes = async (req, res) => {
  try {
    const { status, search } = req.query;
    console.log('📥 GET /envelopes - Liste des enveloppes');

    const query = { clientId: req.user.clientId };

    if (status) {
      query.status = status;
    }

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { 'recipients.email': { $regex: search, $options: 'i' } },
      ];
    }

    const envelopes = await Envelope.find(query)
      .sort({ 'dates.sentAt': -1, createdAt: -1 })
      .populate('documentId', 'title file')
      .populate('sender.userId', 'firstName lastName email');

    console.log(`✅ ${envelopes.length} enveloppes récupérées`);

    return res.status(200).json({
      success: true,
      data: {
        envelopes,
      },
    });
  } catch (error) {
    console.error('❌ Erreur récupération enveloppes:', error);
    return res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des enveloppes',
      error: error.message,
    });
  }
};

/**
 * Récupérer une enveloppe par ID
 */
exports.getEnvelopeById = async (req, res) => {
  try {
    const { id } = req.params;
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📥 GET /envelopes/${id}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('👤 Utilisateur:', {
      id: req.user._id,
      email: req.user.email,
      clientId: req.user.clientId?.toString()
    });

    console.log('🔍 Recherche de l\'enveloppe dans MongoDB...');
    const envelope = await Envelope.findById(id)
      .populate('documentId', 'title description file');

    console.log('📦 Résultat de la requête:', envelope ? 'Enveloppe trouvée' : 'Enveloppe NON trouvée');

    if (!envelope) {
      console.log('❌ Enveloppe non trouvée');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      return res.status(404).json({
        success: false,
        message: 'Enveloppe non trouvée',
      });
    }

    console.log('📋 Détails de l\'enveloppe:');
    console.log('  - ID:', envelope._id);
    console.log('  - Titre:', envelope.title);
    console.log('  - Status:', envelope.status);
    console.log('  - ClientId:', envelope.clientId?.toString());
    console.log('  - DocumentId:', envelope.documentId?._id || envelope.documentId);
    console.log('  - Document présent:', !!envelope.documentId);
    if (envelope.documentId) {
      console.log('  - Document.title:', envelope.documentId.title);
      console.log('  - Document.file présent:', !!envelope.documentId.file);
      if (envelope.documentId.file) {
        console.log('  - Document.file.fileUrl:', envelope.documentId.file.fileUrl);
      } else {
        console.log('  ⚠️  Document.file est undefined/null!');
      }
    } else {
      console.log('  ⚠️  DocumentId est undefined/null!');
    }

    // Vérifier l'accès
    console.log('🔐 Vérification d\'accès...');
    console.log('  - ClientId utilisateur:', req.user.clientId?.toString());
    console.log('  - ClientId enveloppe:', envelope.clientId?.toString());

    if (envelope.clientId.toString() !== req.user.clientId.toString()) {
      console.log('❌ Accès refusé: clientId ne correspond pas');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      return res.status(403).json({
        success: false,
        message: 'Accès refusé à cette enveloppe',
      });
    }

    console.log('✅ Accès autorisé');

    // Récupérer aussi les signatures et les champs pour affichage complet
    const Signature = require('../models/Signature');
    const Field = require('../models/Field');

    const signatures = await Signature.find({ envelopeId: envelope._id });
    const fields = await Field.find({ envelopeId: envelope._id });

    console.log(`📝 Signatures trouvées: ${signatures.length}`);
    console.log(`📋 Champs trouvés: ${fields.length}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    return res.status(200).json({
      success: true,
      data: {
        envelope,
        signatures,
        fields,
      },
    });
  } catch (error) {
    console.error('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error('❌ ERREUR CRITIQUE dans getEnvelopeById');
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error('Type d\'erreur:', error.name);
    console.error('Message:', error.message);
    console.error('Stack:', error.stack);
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    return res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération de l\'enveloppe',
      error: error.message,
    });
  }
};

/**
 * Envoyer une enveloppe (déclenche l'envoi des emails)
 */
exports.sendEnvelope = async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`📥 POST /envelopes/${id}/send`);

    const envelope = await Envelope.findById(id).populate('documentId');

    if (!envelope) {
      return res.status(404).json({
        success: false,
        message: 'Enveloppe non trouvée',
      });
    }

    // Vérifier l'accès
    if (envelope.clientId.toString() !== req.user.clientId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Accès refusé à cette enveloppe',
      });
    }

    // Vérifier qu'il y a des champs assignés
    const fields = await Field.find({ envelopeId: id });
    if (fields.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Veuillez d\'abord placer des champs sur le document',
      });
    }

    // Vérifier que chaque signataire a au moins un champ SIGNATURE
    const signers = envelope.recipients.filter((r) => r.role === 'SIGNER');
    for (const signer of signers) {
      const hasSignatureField = fields.some(
        (f) => f.recipientId === signer.recipientId && f.type === 'SIGNATURE'
      );
      if (!hasSignatureField) {
        return res.status(400).json({
          success: false,
          message: `Le destinataire ${signer.firstName} ${signer.lastName} n'a pas de champ de signature assigné`,
        });
      }
    }

    // Marquer comme envoyé
    await envelope.markAsSent();

    // Envoyer les emails aux destinataires
    const emailService = require('../services/emailService');
    const sender = await User.findById(envelope.sender.userId);
    const senderName = sender ? `${sender.firstName} ${sender.lastName}` : envelope.sender.name || 'GXpro Sign';

    if (envelope.workflow.type === 'SEQUENTIAL') {
      // Workflow séquentiel : envoyer seulement au premier destinataire
      const firstRecipient = envelope.recipients.find((r) => r.order === 1);
      if (firstRecipient) {
        console.log(`📧 Envoi email à: ${firstRecipient.email} (${firstRecipient.role})`);

        if (firstRecipient.role === 'SIGNER') {
          await emailService.sendSignatureRequestEmail({
            recipientEmail: firstRecipient.email,
            recipientName: `${firstRecipient.firstName} ${firstRecipient.lastName}`,
            senderName,
            documentTitle: envelope.title,
            description: envelope.description || '',
            message: envelope.emailMessage || 'Merci de signer ce document.',
            signatureToken: firstRecipient.token,
            expiresAt: envelope.expiresAt,
          });
        } else if (firstRecipient.role === 'REVIEWER') {
          await emailService.sendReviewRequestEmail({
            recipientEmail: firstRecipient.email,
            recipientName: `${firstRecipient.firstName} ${firstRecipient.lastName}`,
            senderName,
            documentTitle: envelope.title,
            description: envelope.description || '',
            message: envelope.emailMessage || 'Merci de réviser ce document.',
            reviewToken: firstRecipient.token,
            expiresAt: envelope.expiresAt,
          });
        } else if (firstRecipient.role === 'APPROVER') {
          await emailService.sendApprovalRequestEmail({
            recipientEmail: firstRecipient.email,
            recipientName: `${firstRecipient.firstName} ${firstRecipient.lastName}`,
            senderName,
            documentTitle: envelope.title,
            description: envelope.description || '',
            message: envelope.emailMessage || 'Merci d\'approuver ce document.',
            approvalToken: firstRecipient.token,
            expiresAt: envelope.expiresAt,
          });
        }
      }
    } else {
      // Workflow parallèle : envoyer à tous les destinataires selon leur rôle
      for (const recipient of envelope.recipients) {
        console.log(`📧 Envoi email à: ${recipient.email} (${recipient.role})`);

        if (recipient.role === 'SIGNER') {
          await emailService.sendSignatureRequestEmail({
            recipientEmail: recipient.email,
            recipientName: `${recipient.firstName} ${recipient.lastName}`,
            senderName,
            documentTitle: envelope.title,
            description: envelope.description || '',
            message: envelope.emailMessage || 'Merci de signer ce document.',
            signatureToken: recipient.token,
            expiresAt: envelope.expiresAt,
          });
        } else if (recipient.role === 'REVIEWER') {
          await emailService.sendReviewRequestEmail({
            recipientEmail: recipient.email,
            recipientName: `${recipient.firstName} ${recipient.lastName}`,
            senderName,
            documentTitle: envelope.title,
            description: envelope.description || '',
            message: envelope.emailMessage || 'Merci de réviser ce document.',
            reviewToken: recipient.token,
            expiresAt: envelope.expiresAt,
          });
        } else if (recipient.role === 'APPROVER') {
          await emailService.sendApprovalRequestEmail({
            recipientEmail: recipient.email,
            recipientName: `${recipient.firstName} ${recipient.lastName}`,
            senderName,
            documentTitle: envelope.title,
            description: envelope.description || '',
            message: envelope.emailMessage || 'Merci d\'approuver ce document.',
            approvalToken: recipient.token,
            expiresAt: envelope.expiresAt,
          });
        }
      }
    }

    console.log('✅ Enveloppe envoyée avec succès');

    return res.status(200).json({
      success: true,
      message: 'Enveloppe envoyée avec succès',
      data: {
        envelope,
      },
    });
  } catch (error) {
    console.error('❌ Erreur envoi enveloppe:', error);
    return res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'envoi de l\'enveloppe',
      error: error.message,
    });
  }
};

/**
 * Annuler une enveloppe
 */
exports.cancelEnvelope = async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`📥 POST /envelopes/${id}/cancel`);

    const envelope = await Envelope.findById(id);

    if (!envelope) {
      return res.status(404).json({
        success: false,
        message: 'Enveloppe non trouvée',
      });
    }

    // Vérifier l'accès
    if (envelope.clientId.toString() !== req.user.clientId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Accès refusé à cette enveloppe',
      });
    }

    // Vérifier qu'elle peut être annulée
    if (envelope.status === 'COMPLETED' || envelope.status === 'CANCELLED') {
      return res.status(400).json({
        success: false,
        message: 'Cette enveloppe ne peut pas être annulée',
      });
    }

    await envelope.cancel();

    console.log('✅ Enveloppe annulée');

    return res.status(200).json({
      success: true,
      message: 'Enveloppe annulée avec succès',
      data: {
        envelope,
      },
    });
  } catch (error) {
    console.error('❌ Erreur annulation enveloppe:', error);
    return res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'annulation de l\'enveloppe',
      error: error.message,
    });
  }
};

/**
 * Supprimer une enveloppe (soft delete)
 */
exports.deleteEnvelope = async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`📥 DELETE /envelopes/${id}`);

    const envelope = await Envelope.findById(id);

    if (!envelope) {
      return res.status(404).json({
        success: false,
        message: 'Enveloppe non trouvée',
      });
    }

    // Vérifier l'accès
    if (envelope.clientId.toString() !== req.user.clientId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Accès refusé à cette enveloppe',
      });
    }

    // Soft delete: marquer comme CANCELLED si en cours, sinon supprimer
    if (envelope.status === 'DRAFT') {
      await Envelope.findByIdAndDelete(id);
      // Supprimer aussi les champs associés
      await Field.deleteMany({ envelopeId: id });
    } else {
      await envelope.cancel();
    }

    console.log('✅ Enveloppe supprimée');

    return res.status(200).json({
      success: true,
      message: 'Enveloppe supprimée avec succès',
    });
  } catch (error) {
    console.error('❌ Erreur suppression enveloppe:', error);
    return res.status(500).json({
      success: false,
      message: 'Erreur lors de la suppression de l\'enveloppe',
      error: error.message,
    });
  }
};

/**
 * Obtenir les détails d'une enveloppe
 */
exports.getEnvelopeDetails = async (req, res) => {
  try {
    const { id } = req.params;

    console.log('📥 GET /envelopes/:id - Récupération détails enveloppe');
    console.log('  Envelope ID:', id);

    const envelope = await Envelope.findById(id)
      .populate('documentId')
      .populate('sender.userId', 'firstName lastName email');

    if (!envelope) {
      return res.status(404).json({
        success: false,
        message: 'Enveloppe non trouvée',
      });
    }

    // Vérifier les permissions
    if (envelope.clientId.toString() !== req.user.clientId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Accès refusé à cette enveloppe',
      });
    }

    // Récupérer les signatures et les champs
    const Signature = require('../models/Signature');
    const signatures = await Signature.find({ envelopeId: envelope._id });
    const fields = await Field.find({ envelopeId: envelope._id });

    return res.status(200).json({
      success: true,
      data: {
        envelope,
        signatures,
        fields,
      },
    });
  } catch (error) {
    console.error('❌ Erreur récupération détails enveloppe:', error);
    return res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des détails',
      error: error.message,
    });
  }
};

/**
 * Télécharger le PDF signé d'une enveloppe
 */
exports.downloadSignedPDF = async (req, res) => {
  try {
    const { id } = req.params;

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📥 DOWNLOAD PDF SIGNÉ - Route appelée');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📍 Route complète:', req.method, req.path);
    console.log('📍 URL complète:', req.originalUrl);
    console.log('📍 Envelope ID:', id);
    console.log('👤 User présent:', !!req.user);
    if (req.user) {
      console.log('   - User ID:', req.user._id);
      console.log('   - Email:', req.user.email);
      console.log('   - ClientId:', req.user.clientId);
    } else {
      console.log('   ❌ PAS D\'UTILISATEUR - req.user est undefined!');
    }
    console.log('🔑 Authorization header:', req.headers.authorization ? 'Présent' : '❌ ABSENT');
    console.log('🌐 Origin:', req.headers.origin);
    console.log('🌐 Host:', req.headers.host);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const envelope = await Envelope.findById(id).populate('documentId');

    if (!envelope) {
      return res.status(404).json({
        success: false,
        message: 'Enveloppe non trouvée',
      });
    }

    // Vérifier les permissions
    if (envelope.clientId.toString() !== req.user.clientId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Accès refusé à cette enveloppe',
      });
    }

    // Vérifier que l'enveloppe est complétée
    if (envelope.status !== 'COMPLETED') {
      return res.status(400).json({
        success: false,
        message: 'Le document n\'est pas encore entièrement signé',
      });
    }

    // Vérifier que le PDF signé existe
    if (!envelope.signedDocument || !envelope.signedDocument.fileUrl) {
      return res.status(404).json({
        success: false,
        message: 'PDF signé non disponible',
      });
    }

    // Renvoyer l'URL du PDF signé pour que le frontend puisse l'ouvrir
    return res.status(200).json({
      success: true,
      url: envelope.signedDocument.fileUrl,
      filename: envelope.signedDocument.filename,
    });
  } catch (error) {
    console.error('❌ Erreur téléchargement PDF signé:', error);
    return res.status(500).json({
      success: false,
      message: 'Erreur lors du téléchargement du PDF',
      error: error.message,
    });
  }
};
/**
 * Approuver un document (pour REVIEWER ou APPROVER)
 */
exports.approveDocument = async (req, res) => {
  try {
    const { token } = req.params;
    const { comment, metadata } = req.body;

    console.log('✅ POST /envelopes/approve/:token - Approbation document');
    console.log('  Token:', token);

    const envelope = await Envelope.findOne({ 'recipients.token': token });

    if (!envelope) {
      return res.status(404).json({
        success: false,
        message: 'Document non trouvé',
      });
    }

    const recipient = envelope.recipients.find(r => r.token === token);

    if (!recipient) {
      return res.status(404).json({
        success: false,
        message: 'Destinataire non trouvé',
      });
    }

    // Vérifier que le destinataire est REVIEWER ou APPROVER
    if (recipient.role !== 'REVIEWER' && recipient.role !== 'APPROVER') {
      return res.status(403).json({
        success: false,
        message: 'Seuls les reviewers et approvers peuvent approuver',
      });
    }

    // Vérifier que le destinataire n'a pas déjà approuvé
    if (recipient.status === 'APPROVED') {
      return res.status(400).json({
        success: false,
        message: 'Document déjà approuvé',
      });
    }

    // Marquer comme approuvé
    recipient.status = 'APPROVED';
    recipient.action = 'APPROVE';
    recipient.approvedAt = new Date();
    recipient.declineReason = comment || null;

    // Enregistrer les métadonnées
    if (metadata) {
      recipient.signatureMetadata = {
        ...recipient.signatureMetadata,
        ...metadata,
      };
    }

    await envelope.save();

    console.log('✅ Document approuvé par', recipient.email);

    // Vérifier si tous les reviewers/approvers ont approuvé
    const allReviewersApproved = envelope.recipients
      .filter(r => r.role === 'REVIEWER')
      .every(r => r.status === 'APPROVED' || r.status === 'SIGNED');

    const allApproversApproved = envelope.recipients
      .filter(r => r.role === 'APPROVER')
      .every(r => r.status === 'APPROVED' || r.status === 'SIGNED');

    // Si tous ont approuvé, passer au statut suivant
    if (allReviewersApproved && allApproversApproved) {
      // Vérifier si tous les signers ont aussi signé
      const allSignersSigned = envelope.recipients
        .filter(r => r.role === 'SIGNER')
        .every(r => r.status === 'SIGNED');

      if (allSignersSigned || envelope.recipients.filter(r => r.role === 'SIGNER').length === 0) {
        envelope.status = 'COMPLETED';
        envelope.dates.completedAt = new Date();
        await envelope.save();

        // Générer le PDF signé si nécessaire
        const Field = require('../models/Field');
        const Signature = require('../models/Signature');
        const Document = require('../models/Document');
        const pdfSignatureService = require('../services/pdfSignatureService');

        const document = await Document.findById(envelope.documentId);
        const signatures = await Signature.find({ envelopeId: envelope._id });
        const fields = await Field.find({ envelopeId: envelope._id });

        const pdfInfo = await pdfSignatureService.generateSignedPDF({
          envelope,
          document,
          signatures,
          fields,
        });

        envelope.signedDocument = pdfInfo;
        await envelope.save();

        console.log('✅ Enveloppe complétée et PDF généré');
      }
    }

    return res.status(200).json({
      success: true,
      message: 'Document approuvé avec succès',
      envelope: {
        id: envelope._id,
        status: envelope.status,
        recipient: {
          email: recipient.email,
          status: recipient.status,
          approvedAt: recipient.approvedAt,
        },
      },
    });
  } catch (error) {
    console.error('❌ Erreur approbation document:', error);
    return res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'approbation',
      error: error.message,
    });
  }
};

/**
 * Rejeter un document (pour REVIEWER ou APPROVER)
 */
exports.rejectDocument = async (req, res) => {
  try {
    const { token } = req.params;
    const { reason, metadata } = req.body;

    console.log('❌ POST /envelopes/reject/:token - Rejet document');
    console.log('  Token:', token);

    if (!reason || reason.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Une raison de rejet est requise',
      });
    }

    const envelope = await Envelope.findOne({ 'recipients.token': token });

    if (!envelope) {
      return res.status(404).json({
        success: false,
        message: 'Document non trouvé',
      });
    }

    const recipient = envelope.recipients.find(r => r.token === token);

    if (!recipient) {
      return res.status(404).json({
        success: false,
        message: 'Destinataire non trouvé',
      });
    }

    // Vérifier que le destinataire est REVIEWER ou APPROVER
    if (recipient.role !== 'REVIEWER' && recipient.role !== 'APPROVER') {
      return res.status(403).json({
        success: false,
        message: 'Seuls les reviewers et approvers peuvent rejeter',
      });
    }

    // Marquer comme rejeté
    recipient.status = 'DECLINED';
    recipient.action = 'REJECT';
    recipient.declinedAt = new Date();
    recipient.declineReason = reason;

    // Enregistrer les métadonnées
    if (metadata) {
      recipient.signatureMetadata = {
        ...recipient.signatureMetadata,
        ...metadata,
      };
    }

    // Marquer l'enveloppe entière comme DECLINED
    envelope.status = 'DECLINED';

    await envelope.save();

    console.log('❌ Document rejeté par', recipient.email, '- Raison:', reason);

    // Envoyer notification à l'expéditeur
    const emailService = require('../services/emailService');
    const Client = require('../models/Client');
    const client = await Client.findById(envelope.clientId);

    await emailService.sendSignatureDeclinedEmail({
      senderEmail: envelope.sender.email,
      senderName: envelope.sender.name,
      recipientName: `${recipient.firstName} ${recipient.lastName}`,
      recipientEmail: recipient.email,
      documentTitle: envelope.title,
      reason,
      declinedAt: recipient.declinedAt,
      envelopeId: envelope._id,
    });

    return res.status(200).json({
      success: true,
      message: 'Document rejeté',
      envelope: {
        id: envelope._id,
        status: envelope.status,
        recipient: {
          email: recipient.email,
          status: recipient.status,
          declinedAt: recipient.declinedAt,
          reason,
        },
      },
    });
  } catch (error) {
    console.error('❌ Erreur rejet document:', error);
    return res.status(500).json({
      success: false,
      message: 'Erreur lors du rejet',
      error: error.message,
    });
  }
};

/**
 * Rappeler (recall) une enveloppe (retirer pour modification)
 */
exports.recallEnvelope = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    console.log('🔙 POST /envelopes/:id/recall - Rappel enveloppe');
    console.log('  Envelope ID:', id);

    const envelope = await Envelope.findById(id);

    if (!envelope) {
      return res.status(404).json({
        success: false,
        message: 'Enveloppe non trouvée',
      });
    }

    // Vérifier l'accès
    if (envelope.clientId.toString() !== req.user.clientId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Accès refusé à cette enveloppe',
      });
    }

    // Vérifier que l'enveloppe peut être rappelée
    if (envelope.status === 'COMPLETED') {
      return res.status(400).json({
        success: false,
        message: 'Impossible de rappeler une enveloppe complétée',
      });
    }

    if (envelope.status === 'RECALLED' || envelope.status === 'CANCELLED') {
      return res.status(400).json({
        success: false,
        message: 'Enveloppe déjà rappelée ou annulée',
      });
    }

    // Marquer comme rappelée
    envelope.status = 'RECALLED';
    envelope.dates.cancelledAt = new Date();

    await envelope.save();

    console.log('✅ Enveloppe rappelée');

    // Envoyer notification aux destinataires qui n'ont pas encore signé/approuvé
    const emailService = require('../services/emailService');

    for (const recipient of envelope.recipients) {
      if (recipient.status === 'PENDING' || recipient.status === 'SENT' || recipient.status === 'OPENED') {
        // TODO: Créer un template email pour le recall
        console.log('  📧 Notification de rappel à', recipient.email);
      }
    }

    return res.status(200).json({
      success: true,
      message: 'Enveloppe rappelée avec succès',
      envelope: {
        id: envelope._id,
        status: envelope.status,
        reason,
      },
    });
  } catch (error) {
    console.error('❌ Erreur rappel enveloppe:', error);
    return res.status(500).json({
      success: false,
      message: 'Erreur lors du rappel',
      error: error.message,
    });
  }
};
