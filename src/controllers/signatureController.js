const { Envelope, Signature, Field, AuditLog, User } = require('../models');
const emailService = require('../services/emailService');

/**
 * Controller pour les signatures (accès public via token)
 */

/**
 * Obtenir les informations pour signer (via token)
 */
const getSignatureInfo = async (req, res) => {
  try {
    const { token } = req.params;

    // Trouver l'enveloppe avec ce token
    const envelope = await Envelope.findOne({
      'recipients.token': token,
    }).populate('documentId', 'title description file');

    if (!envelope) {
      return res.status(404).json({
        success: false,
        message: 'Lien de signature invalide ou expiré.',
      });
    }

    // Trouver le destinataire
    const recipient = envelope.getRecipientByToken(token);

    if (!recipient) {
      return res.status(404).json({
        success: false,
        message: 'Destinataire non trouvé.',
      });
    }

    // Vérifier l'expiration
    if (new Date() > new Date(recipient.tokenExpiration)) {
      return res.status(410).json({
        success: false,
        message: 'Le lien de signature a expiré.',
      });
    }

    // Vérifier si déjà signé
    if (recipient.status === 'SIGNED') {
      return res.status(400).json({
        success: false,
        message: 'Ce document a déjà été signé.',
      });
    }

    // Vérifier si c'est le tour du destinataire (workflow séquentiel)
    if (envelope.workflow.type === 'SEQUENTIAL') {
      const nextRecipient = envelope.getNextRecipient();
      if (!nextRecipient || nextRecipient.recipientId !== recipient.recipientId) {
        return res.status(403).json({
          success: false,
          message: 'Ce n\'est pas encore votre tour de signer.',
        });
      }
    }

    // Récupérer les champs à remplir pour ce destinataire
    const fields = await Field.find({
      documentId: envelope.documentId._id,
      assignedTo: recipient.email,
    });

    // Marquer comme ouvert si ce n'est pas déjà fait
    if (recipient.status === 'SENT') {
      recipient.status = 'OPENED';
      recipient.openedAt = new Date();
      await envelope.save();

      // Logger
      await AuditLog.log({
        clientId: envelope.clientId,
        envelopeId: envelope._id,
        documentId: envelope.documentId._id,
        action: 'DOCUMENT_OPENED',
        actor: {
          type: 'SIGNER',
          name: `${recipient.firstName} ${recipient.lastName}`,
          email: recipient.email,
        },
        target: {
          type: 'ENVELOPE',
          id: envelope._id,
        },
        details: {
          description: `Document ouvert par ${recipient.email}`,
        },
        context: {
          ipAddress: req.ip,
          userAgent: req.get('user-agent'),
        },
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        envelope: {
          id: envelope._id,
          message: envelope.message,
          expiresAt: envelope.expiresAt,
        },
        document: {
          id: envelope.documentId._id,
          title: envelope.documentId.title,
          description: envelope.documentId.description,
          fileUrl: envelope.documentId.file.fileUrl,
        },
        recipient: {
          firstName: recipient.firstName,
          lastName: recipient.lastName,
          email: recipient.email,
          role: recipient.role,
        },
        fields,
      },
    });
  } catch (error) {
    console.error('Erreur getSignatureInfo:', error);
    return res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des informations.',
      error: error.message,
    });
  }
};

/**
 * Signer le document
 */
const signDocument = async (req, res) => {
  try {
    const { token } = req.params;
    const { signatureData, fields } = req.body;

    // Trouver l'enveloppe
    const envelope = await Envelope.findOne({
      'recipients.token': token,
    }).populate('documentId');

    if (!envelope) {
      return res.status(404).json({
        success: false,
        message: 'Lien de signature invalide.',
      });
    }

    const recipient = envelope.getRecipientByToken(token);

    if (!recipient) {
      return res.status(404).json({
        success: false,
        message: 'Destinataire non trouvé.',
      });
    }

    // Vérifications
    if (new Date() > new Date(recipient.tokenExpiration)) {
      return res.status(410).json({
        success: false,
        message: 'Le lien de signature a expiré.',
      });
    }

    if (recipient.status === 'SIGNED') {
      return res.status(400).json({
        success: false,
        message: 'Vous avez déjà signé ce document.',
      });
    }

    // Créer la signature
    const signature = await Signature.create({
      envelopeId: envelope._id,
      documentId: envelope.documentId._id,
      clientId: envelope.clientId,
      signer: {
        firstName: recipient.firstName,
        lastName: recipient.lastName,
        email: recipient.email,
        phone: recipient.phone,
      },
      signatureMethod: signatureData.method,
      signatureData: {
        type: signatureData.method,
        data: signatureData.data,
      },
      metadata: {
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        geolocation: req.body.geolocation,
        deviceType: req.get('user-agent')?.includes('Mobile') ? 'MOBILE' : 'DESKTOP',
      },
      consentGiven: true,
      consentText: 'J\'accepte de signer ce document électroniquement.',
      consentTimestamp: new Date(),
    });

    // Mettre à jour les champs si fournis
    if (fields && fields.length > 0) {
      for (const fieldData of fields) {
        await Field.findByIdAndUpdate(fieldData.fieldId, {
          value: fieldData.value,
          filledAt: new Date(),
        });
      }
    }

    // Marquer le destinataire comme signé
    const signatureMetadata = {
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      geolocation: req.body.geolocation,
      deviceType: req.get('user-agent')?.includes('Mobile') ? 'MOBILE' : 'DESKTOP',
      timestamp: new Date(),
    };

    await envelope.markAsSigned(recipient.recipientId, signatureMetadata);

    // Logger
    await AuditLog.log({
      clientId: envelope.clientId,
      envelopeId: envelope._id,
      documentId: envelope.documentId._id,
      action: 'DOCUMENT_SIGNED',
      actor: {
        type: 'SIGNER',
        name: `${recipient.firstName} ${recipient.lastName}`,
        email: recipient.email,
      },
      target: {
        type: 'ENVELOPE',
        id: envelope._id,
      },
      details: {
        description: `Document signé par ${recipient.email}`,
        metadata: signatureMetadata,
      },
      context: {
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      },
    });

    // Vérifier si tous ont signé
    const allSigned = envelope.isAllSigned();

    if (allSigned) {
      envelope.status = 'COMPLETED';
      envelope.completedAt = new Date();
      await envelope.save();

      // Logger la complétion
      await AuditLog.log({
        clientId: envelope.clientId,
        envelopeId: envelope._id,
        documentId: envelope.documentId._id,
        action: 'ENVELOPE_COMPLETED',
        actor: {
          type: 'SYSTEM',
        },
        target: {
          type: 'ENVELOPE',
          id: envelope._id,
        },
        details: {
          description: 'Enveloppe complétée - tous les destinataires ont signé',
        },
        context: {
          ipAddress: req.ip,
          userAgent: req.get('user-agent'),
        },
      });

      // Envoyer email de confirmation à l'expéditeur
      const sender = await User.findById(envelope.sender);
      if (sender) {
        await emailService.sendEnvelopeCompletedEmail({
          senderEmail: sender.email,
          senderName: `${sender.firstName} ${sender.lastName}`,
          documentTitle: envelope.documentId.title,
          recipients: envelope.recipients.filter(r => r.status === 'SIGNED'),
          completedAt: envelope.completedAt,
          envelopeId: envelope._id,
        });
      }
    } else {
      // Workflow séquentiel : envoyer au suivant
      if (envelope.workflow.type === 'SEQUENTIAL') {
        const nextRecipient = envelope.getNextRecipient();
        if (nextRecipient) {
          // Envoyer email au prochain signataire
          const sender = await User.findById(envelope.sender);
          if (sender) {
            await emailService.sendSignatureRequestEmail({
              recipientEmail: nextRecipient.email,
              recipientName: `${nextRecipient.firstName} ${nextRecipient.lastName}`,
              senderName: `${sender.firstName} ${sender.lastName}`,
              documentTitle: envelope.documentId.title,
              description: envelope.documentId.description,
              message: envelope.message,
              signatureToken: nextRecipient.token,
              expiresAt: nextRecipient.tokenExpiration,
            });
          }

          nextRecipient.status = 'SENT';
          nextRecipient.sentAt = new Date();
          await envelope.save();
        }
      }
    }

    return res.status(200).json({
      success: true,
      message: 'Document signé avec succès.',
      data: {
        signature,
        envelopeCompleted: allSigned,
      },
    });
  } catch (error) {
    console.error('Erreur signDocument:', error);
    return res.status(500).json({
      success: false,
      message: 'Erreur lors de la signature.',
      error: error.message,
    });
  }
};

/**
 * Refuser de signer
 */
const declineSignature = async (req, res) => {
  try {
    const { token } = req.params;
    const { reason } = req.body;

    const envelope = await Envelope.findOne({
      'recipients.token': token,
    });

    if (!envelope) {
      return res.status(404).json({
        success: false,
        message: 'Lien invalide.',
      });
    }

    const recipient = envelope.getRecipientByToken(token);

    if (!recipient) {
      return res.status(404).json({
        success: false,
        message: 'Destinataire non trouvé.',
      });
    }

    if (recipient.status === 'SIGNED') {
      return res.status(400).json({
        success: false,
        message: 'Vous avez déjà signé ce document.',
      });
    }

    // Marquer comme refusé
    await envelope.markAsDeclined(recipient.recipientId, reason);

    // Logger
    await AuditLog.log({
      clientId: envelope.clientId,
      envelopeId: envelope._id,
      documentId: envelope.documentId,
      action: 'DOCUMENT_DECLINED',
      actor: {
        type: 'SIGNER',
        name: `${recipient.firstName} ${recipient.lastName}`,
        email: recipient.email,
      },
      target: {
        type: 'ENVELOPE',
        id: envelope._id,
      },
      details: {
        description: `Signature refusée par ${recipient.email}`,
        metadata: { reason },
      },
      context: {
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      },
    });

    // Envoyer email à l'expéditeur
    const sender = await User.findById(envelope.sender).populate('documentId');
    if (sender) {
      await emailService.sendSignatureDeclinedEmail({
        senderEmail: sender.email,
        senderName: `${sender.firstName} ${sender.lastName}`,
        recipientName: `${recipient.firstName} ${recipient.lastName}`,
        recipientEmail: recipient.email,
        documentTitle: envelope.documentId?.title || 'Document',
        reason,
        declinedAt: new Date(),
        envelopeId: envelope._id,
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Signature refusée.',
    });
  } catch (error) {
    console.error('Erreur declineSignature:', error);
    return res.status(500).json({
      success: false,
      message: 'Erreur lors du refus.',
      error: error.message,
    });
  }
};

module.exports = {
  getSignatureInfo,
  signDocument,
  declineSignature,
};
