const nodemailer = require('nodemailer');
const { Resend } = require('resend');

/**
 * Configuration du transporteur d'emails
 * Support pour SMTP, Gmail, SendGrid, Mailgun, Resend API, etc.
 */
const createTransporter = () => {
  const emailProvider = process.env.EMAIL_PROVIDER || 'smtp';

  let transportConfig;

  switch (emailProvider.toLowerCase()) {
    case 'resend':
      // Configuration Resend API
      const resend = new Resend(process.env.RESEND_API_KEY);

      // Créer un wrapper compatible avec nodemailer
      const resendTransporter = {
        sendMail: async (mailOptions) => {
          try {
            // Si mailOptions.from est déjà formaté (contient <), l'utiliser tel quel
            // Sinon, construire le format "Name <email>"
            let fromAddress;
            if (mailOptions.from && mailOptions.from.includes('<')) {
              fromAddress = mailOptions.from;
            } else {
              fromAddress = `${process.env.EMAIL_FROM_NAME} <${process.env.EMAIL_FROM_ADDRESS}>`;
            }

            const result = await resend.emails.send({
              from: fromAddress,
              to: mailOptions.to,
              subject: mailOptions.subject,
              html: mailOptions.html,
              text: mailOptions.text,
              reply_to: mailOptions.replyTo || process.env.EMAIL_REPLY_TO,
            });

            console.log('✅ Email envoyé via Resend API:', result.data?.id);
            return { messageId: result.data?.id };
          } catch (error) {
            console.error('❌ Erreur envoi email Resend:', error.message);
            throw error;
          }
        },
        verify: async () => {
          // Vérifier que l'API key est configurée
          if (!process.env.RESEND_API_KEY) {
            throw new Error('RESEND_API_KEY non configurée');
          }
          console.log('✅ Service email Resend API prêt');
          return true;
        }
      };

      // Appeler verify de manière asynchrone
      resendTransporter.verify().catch((error) => {
        console.error('❌ Erreur configuration Resend:', error.message);
      });

      return resendTransporter;

    case 'gmail':
      // Configuration Gmail
      transportConfig = {
        service: 'gmail',
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASSWORD, // App password for Gmail
        },
      };
      break;

    case 'sendgrid':
      // Configuration SendGrid
      transportConfig = {
        host: 'smtp.sendgrid.net',
        port: 587,
        auth: {
          user: 'apikey',
          pass: process.env.SENDGRID_API_KEY,
        },
      };
      break;

    case 'mailgun':
      // Configuration Mailgun
      transportConfig = {
        host: process.env.MAILGUN_SMTP_HOST || 'smtp.mailgun.org',
        port: 587,
        auth: {
          user: process.env.MAILGUN_SMTP_USER,
          pass: process.env.MAILGUN_SMTP_PASSWORD,
        },
      };
      break;

    case 'smtp':
    default:
      // Configuration SMTP générique
      transportConfig = {
        host: process.env.SMTP_HOST || 'localhost',
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
      };

      // Ajouter l'auth seulement si les credentials sont fournis
      if (process.env.SMTP_USER && process.env.SMTP_PASSWORD) {
        transportConfig.auth = {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASSWORD,
        };
      }
      break;
  }

  try {
    const transporter = nodemailer.createTransport(transportConfig);

    // Vérifier la connexion (de manière asynchrone pour ne pas bloquer le serveur)
    transporter.verify().then(() => {
      console.log('✅ Service email prêt');
    }).catch((error) => {
      console.error('❌ Erreur de configuration email:', error.message);
      console.warn('⚠️  Les emails ne seront pas envoyés. Veuillez configurer les variables d\'environnement EMAIL_*');
    });

    return transporter;
  } catch (error) {
    console.error('❌ Impossible de créer le transporteur email:', error.message);
    console.warn('⚠️  Les emails ne seront pas envoyés.');
    // Retourner un transporter factice qui ne fait rien
    return {
      sendMail: async () => {
        console.warn('⚠️  Email non envoyé - transporter non configuré');
        return { messageId: 'mock-id' };
      },
      verify: async () => false
    };
  }
};

// Créer le transporteur
const transporter = createTransporter();

// Configuration par défaut des emails
const emailConfig = {
  from: {
    name: process.env.EMAIL_FROM_NAME || 'GXpro Sign',
    address: process.env.EMAIL_FROM_ADDRESS || 'noreply@gxprosign.com',
  },
  replyTo: process.env.EMAIL_REPLY_TO || 'support@gxprosign.com',
};

module.exports = {
  transporter,
  emailConfig,
};
