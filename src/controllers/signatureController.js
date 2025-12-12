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

    // Vérifier si déjà signé/approuvé/rejeté
    if (recipient.status === 'SIGNED' || recipient.status === 'APPROVED') {
      const actionLabel = recipient.role === 'REVIEWER' || recipient.role === 'APPROVER'
        ? 'approuvé'
        : 'signé';
      return res.status(400).json({
        success: false,
        message: `Ce document a déjà été ${actionLabel}.`,
      });
    }

    if (recipient.status === 'DECLINED') {
      return res.status(400).json({
        success: false,
        message: 'Vous avez déjà rejeté ce document.',
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
    const fieldsFromDb = await Field.find({
      envelopeId: envelope._id,
      recipientId: recipient.recipientId,
    });

    // Transform fields to frontend format
    const fields = fieldsFromDb.map(field => ({
      id: field._id,
      type: field.type,
      label: field.properties?.label || field.type,
      page: field.position.page,
      x: field.position.x,
      y: field.position.y,
      width: field.position.width,
      height: field.position.height,
      required: field.properties?.required || false,
      value: field.value,
    }));

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

    // Récupérer les infos du sender
    const sender = await User.findById(envelope.sender.userId);
    const senderName = sender ? `${sender.firstName} ${sender.lastName}` : envelope.sender.name || 'Unknown';

    return res.status(200).json({
      success: true,
      data: {
        envelope: {
          id: envelope._id,
          title: envelope.title,
          message: envelope.message,
          expiresAt: envelope.dates?.expiresAt,
        },
        document: {
          id: envelope.documentId._id,
          title: envelope.documentId.title,
          description: envelope.documentId.description,
          file: {
            fileUrl: envelope.documentId.file.fileUrl,
          },
        },
        recipient: {
          firstName: recipient.firstName,
          lastName: recipient.lastName,
          email: recipient.email,
          role: recipient.role,
          senderName,
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

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📝 [SIGN DOCUMENT] Début de signature');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📍 Token:', token);
    console.log('\n📦 Body reçu du frontend:');
    console.log('  - signatureData:', JSON.stringify(signatureData, null, 2));
    console.log('  - fields count:', fields?.length);
    if (fields && fields.length > 0) {
      console.log('  - Premier field:', JSON.stringify(fields[0], null, 2));
      console.log('  - Tous les fieldIds:', fields.map(f => f.fieldId));
    }

    // Trouver l'enveloppe
    const envelope = await Envelope.findOne({
      'recipients.token': token,
    }).populate('documentId');

    console.log('  Enveloppe trouvée:', envelope ? envelope._id : 'Non trouvée');

    if (!envelope) {
      return res.status(404).json({
        success: false,
        message: 'Lien de signature invalide.',
      });
    }

    const recipient = envelope.getRecipientByToken(token);
    console.log('  Recipient trouvé:', recipient ? recipient.email : 'Non trouvé');

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

    console.log('\n🔨 Création de la signature...');
    console.log('  - recipientId:', recipient.recipientId);
    console.log('  - clientId:', envelope.clientId);
    console.log('  - signatureData.method:', signatureData.method);
    console.log('  - signatureData.data length:', signatureData.data?.length);

    const signatureObject = {
      envelopeId: envelope._id,
      recipientId: recipient.recipientId,
      clientId: envelope.clientId, // REQUIS par le modèle Signature
      signer: {
        firstName: recipient.firstName,
        lastName: recipient.lastName,
        email: recipient.email,
      },
      signature: {
        method: signatureData.method === 'DRAWN' ? 'DRAW' : signatureData.method,
        imageUrl: signatureData.data, // Base64 data URL
        imageData: signatureData.data, // Backup
      },
      metadata: {
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        geolocation: req.body.geolocation,
        deviceType: req.get('user-agent')?.includes('Mobile') ? 'MOBILE' : 'DESKTOP',
        timestamp: new Date(),
      },
      consent: {
        agreed: true,
        agreedAt: new Date(),
        consentText: 'J\'accepte de signer ce document électroniquement.',
      },
    };

    console.log('\n📋 Objet signature à créer:');
    console.log(JSON.stringify({
      ...signatureObject,
      signature: {
        ...signatureObject.signature,
        imageData: `[Base64 ${signatureObject.signature.imageData?.length} chars]`,
        imageUrl: `[Base64 ${signatureObject.signature.imageUrl?.length} chars]`,
      }
    }, null, 2));

    // Créer la signature selon le schéma Signature
    const signature = await Signature.create(signatureObject);

    console.log('✅ Signature créée avec succès:', signature._id);

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

    // ⚡ PRIORITÉ 1: Envoyer l'email au prochain reviewer EN PREMIER (avant tout le reste)
    // Vérifier si tous ont signé
    const allSignedCheck = envelope.isAllSigned();

    if (!allSignedCheck && envelope.workflow.type === 'SEQUENTIAL') {
      const nextRecipient = envelope.getNextRecipient();
      if (nextRecipient) {
        console.log(`\n🚀━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        console.log(`🚀 [PRIORITÉ 1] Envoi email au prochain reviewer`);
        console.log(`   👤 Nom: ${nextRecipient.firstName} ${nextRecipient.lastName}`);
        console.log(`   📧 Email: ${nextRecipient.email}`);
        console.log(`   🎭 Rôle: ${nextRecipient.role}`);
        console.log(`🚀━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

        const sender = await User.findById(envelope.sender.userId);
        const Client = require('../models/Client');
        const client = await Client.findById(envelope.clientId);

        if (sender) {
          if (nextRecipient.role === 'REVIEWER') {
            await emailService.sendReviewRequestEmail({
              recipientEmail: nextRecipient.email,
              recipientName: `${nextRecipient.firstName} ${nextRecipient.lastName}`,
              senderName: `${sender.firstName} ${sender.lastName}`,
              documentTitle: envelope.documentId.title,
              description: envelope.documentId.description,
              message: envelope.message,
              reviewToken: nextRecipient.token,
              expiresAt: nextRecipient.tokenExpiration,
              clientSubdomain: client?.subdomain,
            });
            console.log(`   ✅ Email REVIEWER envoyé en PRIORITÉ!\n`);
          } else if (nextRecipient.role === 'SIGNER') {
            await emailService.sendSignatureRequestEmail({
              recipientEmail: nextRecipient.email,
              recipientName: `${nextRecipient.firstName} ${nextRecipient.lastName}`,
              senderName: `${sender.firstName} ${sender.lastName}`,
              documentTitle: envelope.documentId.title,
              description: envelope.documentId.description,
              message: envelope.message,
              signatureToken: nextRecipient.token,
              expiresAt: nextRecipient.tokenExpiration,
              clientSubdomain: client?.subdomain,
            });
            console.log(`   ✅ Email SIGNER envoyé en PRIORITÉ!\n`);
          } else if (nextRecipient.role === 'APPROVER') {
            await emailService.sendApprovalRequestEmail({
              recipientEmail: nextRecipient.email,
              recipientName: `${nextRecipient.firstName} ${nextRecipient.lastName}`,
              senderName: `${sender.firstName} ${sender.lastName}`,
              documentTitle: envelope.documentId.title,
              description: envelope.documentId.description,
              message: envelope.message,
              approvalToken: nextRecipient.token,
              expiresAt: nextRecipient.tokenExpiration,
              clientSubdomain: client?.subdomain,
            });
            console.log(`   ✅ Email APPROVER envoyé en PRIORITÉ!\n`);
          }

          nextRecipient.status = 'SENT';
          nextRecipient.sentAt = new Date();
          await envelope.save();
        }
      }
    }

    // ⚡ PRIORITÉ 2: Envoyer email de confirmation au signataire qui vient de signer
    const sender = await User.findById(envelope.sender.userId);
    const senderName = sender ? `${sender.firstName} ${sender.lastName}` : envelope.sender.name;

    console.log(`📧 Envoi email de confirmation à: ${recipient.email}`);
    await emailService.sendSignatureConfirmationEmail({
      recipientEmail: recipient.email,
      recipientName: `${recipient.firstName} ${recipient.lastName}`,
      senderName,
      documentTitle: envelope.documentId.title,
      signedAt: new Date(),
    });

    // Compter les signatures/actions complétées
    console.log('\n📊━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 [PROGRESSION] CALCUL DES SIGNATURES');
    console.log('📊━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    const completedCount = envelope.recipients.filter(r =>
      r.status === 'SIGNED' || r.status === 'REVIEWED' || r.status === 'APPROVED'
    ).length;
    const totalRecipients = envelope.recipients.length;
    const remainingCount = totalRecipients - completedCount;

    console.log(`✅ Complétés: ${completedCount}/${totalRecipients}`);
    console.log(`⏳ Restants: ${remainingCount}`);
    console.log(`📈 Pourcentage: ${Math.round((completedCount / totalRecipients) * 100)}%`);
    console.log('📊━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Envoyer notification de progression à l'administrateur (sauf si c'est la dernière signature)
    if (sender && remainingCount > 0) {
      const Client = require('../models/Client');
      const client = await Client.findById(envelope.clientId);

      console.log(`📧 Envoi notification de progression à l'admin: ${sender.email}`);
      await emailService.sendSignatureProgressEmail({
        adminEmail: sender.email,
        adminName: senderName,
        signerName: `${recipient.firstName} ${recipient.lastName}`,
        signerEmail: recipient.email,
        documentTitle: envelope.documentId.title,
        signedAt: new Date(),
        totalRecipients,
        signedCount: completedCount,
        remainingCount,
        envelopeId: envelope._id,
        clientSubdomain: client?.subdomain || 'app',
      });
    }

    // Vérifier si tous ont signé
    console.log('\n🎯━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🎯 [WORKFLOW] VÉRIFICATION COMPLÉTION');
    console.log('🎯━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    const allSigned = envelope.isAllSigned();

    console.log(`\n🎯 Résultat isAllSigned(): ${allSigned ? '✅ TOUS COMPLÉTÉS' : '❌ PAS ENCORE FINI'}\n`);

    if (allSigned) {
      console.log('🎉━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('🎉 ENVELOPPE COMPLÉTÉE - TOUS ONT SIGNÉ!');
      console.log('🎉━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

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

      // Générer le PDF final avec toutes les signatures
      console.log('📄 Génération du PDF signé final...');
      const pdfSignatureService = require('../services/pdfSignatureService');

      try {
        // Récupérer toutes les signatures de cette enveloppe
        const allSignatures = await Signature.find({ envelopeId: envelope._id });

        // Récupérer tous les champs remplis
        const allFields = await Field.find({ envelopeId: envelope._id });

        // Générer le PDF signé
        const signedPdfInfo = await pdfSignatureService.generateSignedPDF({
          envelope,
          document: envelope.documentId,
          signatures: allSignatures,
          fields: allFields,
        });

        // Mettre à jour l'enveloppe avec les infos du PDF signé
        envelope.signedDocument = signedPdfInfo;
        await envelope.save();

        console.log('✅ PDF signé généré et enregistré');
      } catch (pdfError) {
        console.error('❌ Erreur génération PDF signé:', pdfError);
        // Continue même en cas d'erreur PDF pour ne pas bloquer le reste
      }

      // Envoyer email de confirmation à l'expéditeur/administrateur
      if (sender) {
        // Récupérer le client pour avoir le subdomain
        const Client = require('../models/Client');
        const client = await Client.findById(envelope.clientId);

        console.log(`📧 Envoi email de complétion à l'administrateur: ${sender.email}`);
        await emailService.sendEnvelopeCompletedEmail({
          senderEmail: sender.email,
          senderName: `${sender.firstName} ${sender.lastName}`,
          documentTitle: envelope.documentId.title,
          recipients: envelope.recipients.filter(r => r.status === 'SIGNED'),
          completedAt: envelope.completedAt,
          envelopeId: envelope._id,
          clientSubdomain: client?.subdomain || 'app',
        });
      }
    } else {
      console.log('⏭️━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('⏭️ [WORKFLOW] PAS ENCORE TERMINÉ');
      console.log('⏭️  Email au prochain reviewer déjà envoyé en PRIORITÉ 1');
      console.log('⏭️━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
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
    console.error('\n❌ [SIGN DOCUMENT] Erreur:', error);
    console.error('  Message:', error.message);
    console.error('  Stack:', error.stack);
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
