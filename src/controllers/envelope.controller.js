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
      // Workflow séquentiel : envoyer seulement au premier signataire
      const firstRecipient = envelope.recipients.find((r) => r.order === 1);
      if (firstRecipient && firstRecipient.role === 'SIGNER') {
        console.log(`📧 Envoi email à: ${firstRecipient.email}`);
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
      }
    } else {
      // Workflow parallèle : envoyer à tous les signataires
      const signers = envelope.recipients.filter((r) => r.role === 'SIGNER');
      for (const signer of signers) {
        console.log(`📧 Envoi email à: ${signer.email}`);
        await emailService.sendSignatureRequestEmail({
          recipientEmail: signer.email,
          recipientName: `${signer.firstName} ${signer.lastName}`,
          senderName,
          documentTitle: envelope.title,
          description: envelope.description || '',
          message: envelope.emailMessage || 'Merci de signer ce document.',
          signatureToken: signer.token,
          expiresAt: envelope.expiresAt,
        });
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
