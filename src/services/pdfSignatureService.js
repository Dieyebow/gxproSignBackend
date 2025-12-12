const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const fs = require('fs').promises;
const path = require('path');
const AWS = require('aws-sdk');

/**
 * Normaliser le texte pour éviter les problèmes d'encodage
 * Convertit les caractères Unicode composés en caractères simples
 */
function normalizeText(text) {
  if (!text) return '';
  // Normaliser en NFD (décomposé) puis enlever les marques diacritiques
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/**
 * Service de génération de PDF signés avec intégration des signatures
 */
class PDFSignatureService {
  /**
   * Générer le PDF final avec toutes les signatures
   * @param {Object} envelope - L'enveloppe complétée
   * @param {Object} document - Le document original
   * @param {Array} signatures - Toutes les signatures
   * @param {Array} fields - Tous les champs remplis
   * @returns {Promise<Object>} - Informations sur le PDF généré
   */
  async generateSignedPDF({ envelope, document, signatures, fields }) {
    try {
      console.log('\n📄 [PDF SIGNATURE] Début génération PDF signé');
      console.log('  - Envelope ID:', envelope._id);
      console.log('  - Document:', document?.title);
      console.log('  - Document object:', JSON.stringify(document, null, 2));
      console.log('  - Document.file présent:', !!document?.file);
      console.log('  - Document.file.fileUrl:', document?.file?.fileUrl);
      console.log('  - Nombre de signatures:', signatures.length);

      if (!document?.file?.fileUrl) {
        throw new Error('Document file URL is missing. Document structure: ' + JSON.stringify(document));
      }

      // Télécharger le PDF original depuis le stockage
      const originalPdfBuffer = await this.downloadOriginalPDF(document.file.fileUrl);

      // Charger le PDF avec pdf-lib
      const pdfDoc = await PDFDocument.load(originalPdfBuffer);
      const pages = pdfDoc.getPages();
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

      console.log('  - Pages du PDF:', pages.length);

      // Intégrer les signatures et les valeurs des champs sur le PDF
      for (const field of fields) {
        if (!field.value) continue;

        const page = pages[field.position.page - 1];
        if (!page) continue;

        // Les coordonnées dans la BD sont en pourcentages (0-100)
        // Il faut les convertir en points PDF
        const pageWidth = page.getWidth();
        const pageHeight = page.getHeight();

        // Convertir les pourcentages en points
        const xPoints = (field.position.x * pageWidth) / 100;
        const yPoints = (field.position.y * pageHeight) / 100;
        const widthPoints = (field.position.width * pageWidth) / 100;
        const heightPoints = (field.position.height * pageHeight) / 100;

        // Convertir les coordonnées (le système de coordonnées de pdf-lib commence en bas à gauche)
        // Frontend utilise top-left origin, PDF utilise bottom-left origin
        const pdfY = pageHeight - yPoints - heightPoints;

        console.log(`  - Field ${field.type}:`);
        console.log(`    Percentage: x=${field.position.x}%, y=${field.position.y}%, w=${field.position.width}%, h=${field.position.height}%`);
        console.log(`    PDF Points: x=${xPoints}, y=${pdfY}, w=${widthPoints}, h=${heightPoints}`);

        if (field.type === 'SIGNATURE' || field.type === 'INITIAL') {
          // Trouver le destinataire correspondant à ce champ
          const recipient = envelope.recipients.find(r => r.recipientId === field.recipientId);

          // Intégrer l'image de signature avec les informations du signataire
          await this.embedSignatureImage(
            pdfDoc,
            page,
            field.value,
            xPoints,
            pdfY,
            widthPoints,
            heightPoints,
            recipient,
            font
          );
        } else if (field.type === 'TEXT' || field.type === 'NAME' || field.type === 'EMAIL') {
          // Calculer la taille de police en fonction de la hauteur du champ
          // Utiliser environ 70% de la hauteur pour la police
          const fontSize = Math.max(8, Math.min(heightPoints * 0.7, 20));

          // Dessiner le texte
          page.drawText(field.value, {
            x: xPoints,
            y: pdfY + heightPoints / 2 - fontSize / 2,
            size: fontSize,
            font,
            color: rgb(0, 0, 0),
          });
        } else if (field.type === 'DATE') {
          // Calculer la taille de police
          const fontSize = Math.max(8, Math.min(heightPoints * 0.7, 20));

          // Dessiner la date
          const dateStr = new Date(field.value).toLocaleDateString('fr-FR');
          page.drawText(dateStr, {
            x: xPoints,
            y: pdfY + heightPoints / 2 - fontSize / 2,
            size: fontSize,
            font,
            color: rgb(0, 0, 0),
          });
        } else if (field.type === 'CHECKBOX') {
          // Dessiner une case cochée
          if (field.value === 'true' || field.value === true) {
            page.drawText('☑', {
              x: xPoints,
              y: pdfY,
              size: heightPoints,
              font,
              color: rgb(0, 0, 0),
            });
          }
        }
      }

      // Ajouter une page de certificat de signature à la fin
      const certPage = pdfDoc.addPage();
      await this.addCertificatePage(certPage, envelope, signatures, boldFont, font);

      // Sauvegarder le PDF modifié
      const pdfBytes = await pdfDoc.save();

      // Uploader le PDF signé vers le stockage
      const signedPdfInfo = await this.uploadSignedPDF({
        pdfBytes,
        envelope,
        document,
      });

      console.log('✅ [PDF SIGNATURE] PDF signé généré avec succès');
      console.log('  - URL:', signedPdfInfo.fileUrl);
      console.log('  - Taille:', signedPdfInfo.fileSize, 'bytes');

      return signedPdfInfo;
    } catch (error) {
      console.error('❌ [PDF SIGNATURE] Erreur génération PDF:', error);
      throw error;
    }
  }

  /**
   * Télécharger le PDF original depuis le stockage
   */
  async downloadOriginalPDF(fileUrl) {
    try {
      if (fileUrl.startsWith('http')) {
        // Télécharger depuis une URL (Digital Ocean Spaces)
        const response = await fetch(fileUrl);
        if (!response.ok) {
          throw new Error(`Erreur téléchargement PDF: ${response.statusText}`);
        }
        return Buffer.from(await response.arrayBuffer());
      } else {
        // Lire depuis le système de fichiers local
        const filePath = path.join(process.cwd(), fileUrl);
        return await fs.readFile(filePath);
      }
    } catch (error) {
      console.error('Erreur téléchargement PDF original:', error);
      throw error;
    }
  }

  /**
   * Intégrer une image de signature (base64) dans le PDF avec informations du signataire
   */
  async embedSignatureImage(pdfDoc, page, base64Image, x, y, width, height, recipient, font) {
    try {
      // Réserver de l'espace pour le texte en bas (environ 30% de la hauteur)
      const signatureHeight = height * 0.65;
      const textAreaHeight = height * 0.35;

      // Extraire le format et les données base64
      const matches = base64Image.match(/^data:image\/(png|jpg|jpeg);base64,(.+)$/);
      if (!matches) {
        console.warn('Format d\'image de signature invalide');
        return;
      }

      const [, format, data] = matches;
      const imageBytes = Buffer.from(data, 'base64');

      // Intégrer l'image dans le PDF
      let image;
      if (format === 'png') {
        image = await pdfDoc.embedPng(imageBytes);
      } else {
        image = await pdfDoc.embedJpg(imageBytes);
      }

      // Calculer les dimensions pour maintenir le ratio (en utilisant seulement 65% de la hauteur)
      const imageDims = image.scale(1);
      const scale = Math.min(width / imageDims.width, signatureHeight / imageDims.height);

      // Dessiner l'image de signature (en haut de la zone)
      page.drawImage(image, {
        x,
        y: y + textAreaHeight,
        width: imageDims.width * scale,
        height: imageDims.height * scale,
      });

      // Ajouter les informations du signataire en dessous
      if (recipient) {
        const fontSize = 8;
        const lineHeight = 10;
        let currentY = y + textAreaHeight - 5;

        // Nom complet du signataire
        const fullName = normalizeText(`${recipient.firstName} ${recipient.lastName}`);
        page.drawText(fullName, {
          x,
          y: currentY,
          size: fontSize,
          font,
          color: rgb(0.2, 0.2, 0.2),
        });
        currentY -= lineHeight;

        // Date et heure de signature
        if (recipient.signedAt || recipient.approvedAt) {
          const signedDate = new Date(recipient.signedAt || recipient.approvedAt);
          const dateStr = normalizeText(
            `Le ${signedDate.toLocaleDateString('fr-FR')} a ${signedDate.toLocaleTimeString('fr-FR', {
              hour: '2-digit',
              minute: '2-digit',
            })}`
          );
          page.drawText(dateStr, {
            x,
            y: currentY,
            size: fontSize,
            font,
            color: rgb(0.4, 0.4, 0.4),
          });
          currentY -= lineHeight;
        }

        // Rôle du signataire
        const roleMap = {
          'SIGNER': 'Signataire',
          'REVIEWER': 'Réviseur',
          'APPROVER': 'Approbateur',
        };
        const roleLabel = roleMap[recipient.role] || recipient.role;
        page.drawText(normalizeText(roleLabel), {
          x,
          y: currentY,
          size: fontSize - 1,
          font,
          color: rgb(0.5, 0.5, 0.5),
        });
      }
    } catch (error) {
      console.error('Erreur intégration image signature:', error);
      // Continuer même en cas d'erreur pour ne pas bloquer tout le processus
    }
  }

  /**
   * Ajouter une page de certificat de signature
   */
  async addCertificatePage(page, envelope, signatures, boldFont, font) {
    const { width, height } = page.getSize();
    const margin = 50;
    let yPosition = height - margin;

    // Titre
    page.drawText('Certificat de Signature Électronique', {
      x: margin,
      y: yPosition,
      size: 20,
      font: boldFont,
      color: rgb(0.2, 0.2, 0.2),
    });

    yPosition -= 40;

    // Informations du document
    page.drawText('Informations du document', {
      x: margin,
      y: yPosition,
      size: 14,
      font: boldFont,
      color: rgb(0.3, 0.3, 0.3),
    });

    yPosition -= 25;

    const documentInfo = [
      `Titre: ${envelope.documentId?.title || 'N/A'}`,
      `ID de l'enveloppe: ${envelope._id}`,
      `Date de creation: ${new Date(envelope.createdAt).toLocaleString('fr-FR')}`,
      `Date de completion: ${new Date(envelope.completedAt).toLocaleString('fr-FR')}`,
      `Statut: ${envelope.status}`,
    ];

    for (const info of documentInfo) {
      page.drawText(normalizeText(info), {
        x: margin + 20,
        y: yPosition,
        size: 10,
        font,
        color: rgb(0.4, 0.4, 0.4),
      });
      yPosition -= 18;
    }

    yPosition -= 20;

    // Signatures
    page.drawText('Signatures', {
      x: margin,
      y: yPosition,
      size: 14,
      font: boldFont,
      color: rgb(0.3, 0.3, 0.3),
    });

    yPosition -= 25;

    for (const signature of signatures) {
      const signerInfo = [
        `Signataire: ${signature.signer.firstName} ${signature.signer.lastName}`,
        `Email: ${signature.signer.email}`,
        `Date de signature: ${new Date(signature.createdAt).toLocaleString('fr-FR')}`,
        `Methode: ${signature.signature.method}`,
        `Adresse IP: ${signature.metadata.ipAddress}`,
        `Appareil: ${signature.metadata.deviceType}`,
      ];

      for (const info of signerInfo) {
        page.drawText(normalizeText(info), {
          x: margin + 20,
          y: yPosition,
          size: 9,
          font,
          color: rgb(0.4, 0.4, 0.4),
        });
        yPosition -= 15;
      }

      yPosition -= 10;

      // Éviter de dépasser la page
      if (yPosition < 100) break;
    }

    // Pied de page
    page.drawText(normalizeText('Ce document a ete signe electroniquement via GXpro Sign'), {
      x: margin,
      y: 50,
      size: 8,
      font,
      color: rgb(0.5, 0.5, 0.5),
    });

    page.drawText(normalizeText(`Genere le ${new Date().toLocaleString('fr-FR')}`), {
      x: margin,
      y: 35,
      size: 8,
      font,
      color: rgb(0.5, 0.5, 0.5),
    });
  }

  /**
   * Uploader le PDF signé vers le stockage
   */
  async uploadSignedPDF({ pdfBytes, envelope, document }) {
    try {
      const filename = `${document.title.replace(/[^a-z0-9]/gi, '_')}_signed_${Date.now()}.pdf`;

      // Vérifier si Digital Ocean Spaces est configuré
      const useSpaces = process.env.DO_SPACES_KEY && process.env.DO_SPACES_SECRET;

      if (useSpaces) {
        // Upload vers Digital Ocean Spaces
        const spacesEndpoint = new AWS.Endpoint(process.env.DO_SPACES_ENDPOINT);
        const s3Client = new AWS.S3({
          endpoint: spacesEndpoint,
          accessKeyId: process.env.DO_SPACES_KEY,
          secretAccessKey: process.env.DO_SPACES_SECRET,
          region: process.env.DO_SPACES_REGION || 'tor1',
        });

        const folder = `signed-documents/${envelope.clientId}`;
        const key = `${folder}/${filename}`;

        await s3Client.putObject({
          Bucket: process.env.DO_SPACES_BUCKET,
          Key: key,
          Body: Buffer.from(pdfBytes),
          ACL: 'public-read',
          ContentType: 'application/pdf',
        }).promise();

        const fileUrl = `https://${process.env.DO_SPACES_BUCKET}.${process.env.DO_SPACES_REGION}.digitaloceanspaces.com/${key}`;

        return {
          fileUrl,
          filename,
          fileSize: pdfBytes.length,
          hash: this.generateHash(pdfBytes),
        };
      } else {
        // Stockage local
        const uploadDir = path.join(process.cwd(), 'uploads', 'signed-documents', envelope.clientId.toString());
        await fs.mkdir(uploadDir, { recursive: true });

        const filePath = path.join(uploadDir, filename);
        await fs.writeFile(filePath, pdfBytes);

        const fileUrl = `/uploads/signed-documents/${envelope.clientId}/${filename}`;

        return {
          fileUrl,
          filename,
          fileSize: pdfBytes.length,
          hash: this.generateHash(pdfBytes),
        };
      }
    } catch (error) {
      console.error('Erreur upload PDF signé:', error);
      throw error;
    }
  }

  /**
   * Générer un hash SHA-256 du PDF
   */
  generateHash(buffer) {
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(buffer).digest('hex');
  }
}

// Export singleton
module.exports = new PDFSignatureService();
