const fs = require('fs').promises;
const path = require('path');
const handlebars = require('handlebars');
const { transporter, emailConfig } = require('../config/email');

/**
 * Service d'envoi d'emails avec templates Handlebars
 */
class EmailService {
  constructor() {
    this.templatesPath = path.join(__dirname, '../templates/emails');
    this.baseTemplate = null;
    this.compiledTemplates = new Map();
  }

  /**
   * Charger et compiler un template
   */
  async loadTemplate(templateName) {
    try {
      // Utiliser le cache si disponible
      if (this.compiledTemplates.has(templateName)) {
        return this.compiledTemplates.get(templateName);
      }

      // Charger le template de base si pas encore fait
      if (!this.baseTemplate) {
        const baseTemplatePath = path.join(this.templatesPath, 'base.hbs');
        const baseTemplateContent = await fs.readFile(baseTemplatePath, 'utf-8');
        this.baseTemplate = handlebars.compile(baseTemplateContent);
      }

      // Charger le template de contenu
      const templatePath = path.join(this.templatesPath, `${templateName}.hbs`);
      const templateContent = await fs.readFile(templatePath, 'utf-8');
      const compiledTemplate = handlebars.compile(templateContent);

      // Mettre en cache
      this.compiledTemplates.set(templateName, compiledTemplate);

      return compiledTemplate;
    } catch (error) {
      console.error(`Erreur lors du chargement du template ${templateName}:`, error);
      throw new Error(`Template ${templateName} non trouvé`);
    }
  }

  /**
   * Générer le HTML complet avec le template de base
   */
  async generateHTML(templateName, data) {
    const contentTemplate = await this.loadTemplate(templateName);
    const content = contentTemplate(data);

    const html = this.baseTemplate({
      content,
      subject: data.subject,
      frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
      year: new Date().getFullYear(),
    });

    return html;
  }

  /**
   * Envoyer un email
   */
  async sendEmail({ to, subject, template, data, attachments = [] }) {
    try {
      // Générer le HTML
      const html = await this.generateHTML(template, { ...data, subject });

      // Configuration de l'email
      const mailOptions = {
        from: `${emailConfig.from.name} <${emailConfig.from.address}>`,
        to,
        subject,
        html,
        replyTo: emailConfig.replyTo,
        attachments,
      };

      // Envoyer l'email
      const info = await transporter.sendMail(mailOptions);

      console.log(`✅ Email envoyé à ${to}: ${subject}`);
      return {
        success: true,
        messageId: info.messageId,
      };
    } catch (error) {
      console.error(`❌ Erreur lors de l'envoi d'email à ${to}:`, error.message);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Email de bienvenue pour nouveau client
   */
  async sendClientWelcomeEmail({ email, companyName, subdomain, plan, invitationToken, contactPerson }) {
    // Construire l'URL d'activation avec le sous-domaine du client
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const activationUrl = baseUrl.includes('localhost')
      ? `${baseUrl}/activate-account/${invitationToken}`
      : `https://${subdomain}.gxprosign.com/activate-account/${invitationToken}`;

    const contactName = contactPerson ? `${contactPerson.firstName} ${contactPerson.lastName}` : 'Admin';

    return this.sendEmail({
      to: email,
      subject: 'Bienvenue sur GXpro Sign - Activez votre compte',
      template: 'client-welcome',
      data: {
        companyName,
        subdomain,
        plan,
        email,
        activationUrl,
        contactName,
      },
    });
  }

  /**
   * Email de demande de signature
   */
  async sendSignatureRequestEmail({
    recipientEmail,
    recipientName,
    senderName,
    documentTitle,
    description,
    message,
    signatureToken,
    expiresAt,
  }) {
    const signatureUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/sign/${signatureToken}`;

    return this.sendEmail({
      to: recipientEmail,
      subject: `${senderName} vous demande de signer un document`,
      template: 'signature-request',
      data: {
        recipientEmail,
        recipientName,
        senderName,
        documentTitle,
        description,
        message,
        signatureUrl,
        expiresAt: expiresAt ? new Date(expiresAt).toLocaleDateString('fr-FR', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        }) : null,
      },
    });
  }

  /**
   * Email de rappel de signature
   */
  async sendSignatureReminderEmail({
    recipientEmail,
    recipientName,
    senderName,
    senderEmail,
    documentTitle,
    signatureToken,
    sentAt,
    expiresAt,
  }) {
    const signatureUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/sign/${signatureToken}`;

    return this.sendEmail({
      to: recipientEmail,
      subject: `Rappel : Document en attente de signature - ${documentTitle}`,
      template: 'signature-reminder',
      data: {
        recipientName,
        senderName,
        senderEmail,
        documentTitle,
        signatureUrl,
        sentAt: new Date(sentAt).toLocaleDateString('fr-FR', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        }),
        expiresAt: expiresAt ? new Date(expiresAt).toLocaleDateString('fr-FR', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        }) : null,
      },
    });
  }

  /**
   * Email de confirmation de signature au signataire
   */
  async sendSignatureConfirmationEmail({
    recipientEmail,
    recipientName,
    senderName,
    documentTitle,
    signedAt,
  }) {
    return this.sendEmail({
      to: recipientEmail,
      subject: `Confirmation de signature : ${documentTitle}`,
      template: 'signature-confirmation',
      data: {
        recipientName,
        senderName,
        documentTitle,
        signedAt: new Date(signedAt).toLocaleDateString('fr-FR', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        }),
      },
    });
  }

  /**
   * Email de document complètement signé
   */
  async sendEnvelopeCompletedEmail({
    senderEmail,
    senderName,
    documentTitle,
    recipients,
    completedAt,
    envelopeId,
    clientSubdomain,
  }) {
    // Construire l'URL avec le sous-domaine du client
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const envelopeUrl = baseUrl.includes('localhost')
      ? `${baseUrl}/envelopes/${envelopeId}`
      : `https://${clientSubdomain}.gxprosign.com/envelopes/${envelopeId}`;

    // Formater les destinataires
    const formattedRecipients = recipients.map(r => ({
      name: `${r.firstName} ${r.lastName}`,
      email: r.email,
      signedAt: new Date(r.signedAt).toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }),
    }));

    return this.sendEmail({
      to: senderEmail,
      subject: `Document signé : ${documentTitle}`,
      template: 'envelope-completed',
      data: {
        senderName,
        documentTitle,
        signatureCount: recipients.length,
        recipientCount: recipients.length,
        completedAt: new Date(completedAt).toLocaleDateString('fr-FR', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        }),
        recipients: formattedRecipients,
        envelopeUrl,
      },
    });
  }

  /**
   * Email de signature refusée
   */
  async sendSignatureDeclinedEmail({
    senderEmail,
    senderName,
    recipientName,
    recipientEmail,
    documentTitle,
    reason,
    declinedAt,
    envelopeId,
  }) {
    const envelopeUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/envelopes/${envelopeId}`;

    return this.sendEmail({
      to: senderEmail,
      subject: `Signature refusée : ${documentTitle}`,
      template: 'signature-declined',
      data: {
        senderName,
        recipientName,
        recipientEmail,
        documentTitle,
        reason,
        declinedAt: new Date(declinedAt).toLocaleDateString('fr-FR', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        }),
        envelopeUrl,
      },
    });
  }

  /**
   * Email de réinitialisation de mot de passe
   */
  async sendPasswordResetEmail({ email, userName, resetToken }) {
    const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password/${resetToken}`;

    return this.sendEmail({
      to: email,
      subject: 'Réinitialisation de votre mot de passe GXpro Sign',
      template: 'password-reset',
      data: {
        userName,
        resetUrl,
      },
    });
  }

  /**
   * Envoyer un email de copie du document signé
   */
  async sendSignedDocumentCopy({
    recipientEmail,
    recipientName,
    documentTitle,
    senderName,
    documentPath,
  }) {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

    return this.sendEmail({
      to: recipientEmail,
      subject: `Copie de votre document signé : ${documentTitle}`,
      template: 'envelope-completed',
      data: {
        senderName: recipientName,
        documentTitle,
        signatureCount: 1,
        recipientCount: 1,
        completedAt: new Date().toLocaleDateString('fr-FR', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        }),
        recipients: [{
          name: recipientName,
          email: recipientEmail,
          signedAt: new Date().toLocaleDateString('fr-FR', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          }),
        }],
        envelopeUrl: frontendUrl,
      },
      attachments: documentPath ? [{
        filename: `${documentTitle}.pdf`,
        path: documentPath,
      }] : [],
    });
  }

  /**
   * Email de demande de révision (pour REVIEWER)
   */
  async sendReviewRequestEmail({
    recipientEmail,
    recipientName,
    senderName,
    documentTitle,
    description,
    message,
    reviewToken,
    expiresAt,
    clientSubdomain,
  }) {
    // Construire l'URL avec le sous-domaine du client
    const baseDomain = process.env.BASE_DOMAIN || 'gxprosign.com';
    const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http';
    const reviewUrl = clientSubdomain
      ? `${protocol}://${clientSubdomain}.${baseDomain}/review/${reviewToken}`
      : `${process.env.FRONTEND_URL || 'http://localhost:5173'}/review/${reviewToken}`;

    return this.sendEmail({
      to: recipientEmail,
      subject: `${senderName} vous demande de réviser un document`,
      template: 'review-request',
      data: {
        recipientEmail,
        recipientName,
        senderName,
        documentTitle,
        description,
        message,
        reviewUrl,
        expiresAt: expiresAt ? new Date(expiresAt).toLocaleDateString('fr-FR', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        }) : null,
      },
    });
  }

  /**
   * Email de demande d'approbation finale (pour APPROVER)
   */
  async sendApprovalRequestEmail({
    recipientEmail,
    recipientName,
    senderName,
    documentTitle,
    description,
    message,
    approvalToken,
    expiresAt,
    reviewStatus,
    clientSubdomain,
  }) {
    // Construire l'URL avec le sous-domaine du client
    const baseDomain = process.env.BASE_DOMAIN || 'gxprosign.com';
    const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http';
    const approvalUrl = clientSubdomain
      ? `${protocol}://${clientSubdomain}.${baseDomain}/approve/${approvalToken}`
      : `${process.env.FRONTEND_URL || 'http://localhost:5173'}/approve/${approvalToken}`;

    return this.sendEmail({
      to: recipientEmail,
      subject: `${senderName} vous demande l'approbation finale d'un document`,
      template: 'approval-request',
      data: {
        recipientEmail,
        recipientName,
        senderName,
        documentTitle,
        description,
        message,
        approvalUrl,
        reviewStatus,
        expiresAt: expiresAt ? new Date(expiresAt).toLocaleDateString('fr-FR', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        }) : null,
      },
    });
  }
}

// Export singleton
module.exports = new EmailService();
