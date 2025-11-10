const Document = require('../models/Document');
const path = require('path');
const fs = require('fs').promises;
const crypto = require('crypto');
const { PDFDocument } = require('pdf-lib');

/**
 * Upload un document
 */
exports.uploadDocument = async (req, res) => {
  try {
    console.log('📥 POST /documents/upload - Upload d\'un document');

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Aucun fichier fourni',
      });
    }

    const { title, description } = req.body;

    // Lire le fichier pour calculer le hash
    const fileBuffer = await fs.readFile(req.file.path);
    const hash = crypto.createHash('sha256').update(fileBuffer).digest('hex');

    // Compter les pages si PDF
    let pageCount = 1;
    if (req.file.mimetype === 'application/pdf') {
      try {
        const pdfDoc = await PDFDocument.load(fileBuffer);
        pageCount = pdfDoc.getPageCount();
      } catch (error) {
        console.error('Erreur lecture PDF:', error);
      }
    }

    // Créer le document dans la base de données
    const document = await Document.create({
      title: title || req.file.originalname.replace(/\.[^/.]+$/, ''),
      description: description || '',
      file: {
        originalName: req.file.originalname,
        filename: req.file.filename,
        fileUrl: `/uploads/${req.file.filename}`,
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
        pageCount,
        hash,
      },
      clientId: req.user.clientId,
      uploadedBy: req.user._id,
      status: 'ACTIVE',
    });

    console.log('✅ Document uploadé:', document._id);
    console.log('  Pages:', pageCount);
    console.log('  Taille:', Math.round(req.file.size / 1024), 'KB');

    return res.status(201).json({
      success: true,
      message: 'Document uploadé avec succès',
      data: {
        document,
      },
    });
  } catch (error) {
    console.error('❌ Erreur upload document:', error);
    return res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'upload du document',
      error: error.message,
    });
  }
};

/**
 * Récupérer tous les documents du client
 */
exports.getDocuments = async (req, res) => {
  try {
    const { status, search, isTemplate } = req.query;
    console.log('📥 GET /documents - Liste des documents');

    const query = { clientId: req.user.clientId };

    if (status) {
      query.status = status;
    } else {
      query.status = 'ACTIVE';
    }

    if (isTemplate !== undefined) {
      query.isTemplate = isTemplate === 'true';
    }

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ];
    }

    const documents = await Document.find(query)
      .sort({ createdAt: -1 })
      .populate('uploadedBy', 'firstName lastName email')
      .limit(100);

    console.log(`✅ ${documents.length} documents récupérés`);

    return res.status(200).json({
      success: true,
      data: {
        documents,
      },
    });
  } catch (error) {
    console.error('❌ Erreur récupération documents:', error);
    return res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des documents',
      error: error.message,
    });
  }
};

/**
 * Récupérer un document par ID
 */
exports.getDocumentById = async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`📥 GET /documents/${id}`);

    const document = await Document.findById(id).populate(
      'uploadedBy',
      'firstName lastName email'
    );

    if (!document) {
      return res.status(404).json({
        success: false,
        message: 'Document non trouvé',
      });
    }

    // Vérifier l'accès
    if (document.clientId.toString() !== req.user.clientId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Accès refusé à ce document',
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        document,
      },
    });
  } catch (error) {
    console.error('❌ Erreur récupération document:', error);
    return res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération du document',
      error: error.message,
    });
  }
};

/**
 * Mettre à jour un document
 */
exports.updateDocument = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, folder, tags, isTemplate, templateName } = req.body;

    console.log(`📥 PUT /documents/${id}`);

    const document = await Document.findById(id);

    if (!document) {
      return res.status(404).json({
        success: false,
        message: 'Document non trouvé',
      });
    }

    // Vérifier l'accès
    if (document.clientId.toString() !== req.user.clientId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Accès refusé à ce document',
      });
    }

    // Mettre à jour
    if (title !== undefined) document.title = title;
    if (description !== undefined) document.description = description;
    if (folder !== undefined) document.folder = folder;
    if (tags !== undefined) document.tags = tags;
    if (isTemplate !== undefined) document.isTemplate = isTemplate;
    if (templateName !== undefined) document.templateName = templateName;

    await document.save();

    console.log('✅ Document mis à jour');

    return res.status(200).json({
      success: true,
      message: 'Document mis à jour avec succès',
      data: {
        document,
      },
    });
  } catch (error) {
    console.error('❌ Erreur mise à jour document:', error);
    return res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise à jour du document',
      error: error.message,
    });
  }
};

/**
 * Archiver un document
 */
exports.archiveDocument = async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`📥 POST /documents/${id}/archive`);

    const document = await Document.findById(id);

    if (!document) {
      return res.status(404).json({
        success: false,
        message: 'Document non trouvé',
      });
    }

    // Vérifier l'accès
    if (document.clientId.toString() !== req.user.clientId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Accès refusé à ce document',
      });
    }

    document.status = 'ARCHIVED';
    await document.save();

    console.log('✅ Document archivé');

    return res.status(200).json({
      success: true,
      message: 'Document archivé avec succès',
      data: {
        document,
      },
    });
  } catch (error) {
    console.error('❌ Erreur archivage document:', error);
    return res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'archivage du document',
      error: error.message,
    });
  }
};

/**
 * Supprimer un document
 */
exports.deleteDocument = async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`📥 DELETE /documents/${id}`);

    const document = await Document.findById(id);

    if (!document) {
      return res.status(404).json({
        success: false,
        message: 'Document non trouvé',
      });
    }

    // Vérifier l'accès
    if (document.clientId.toString() !== req.user.clientId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Accès refusé à ce document',
      });
    }

    // Soft delete
    document.status = 'DELETED';
    await document.save();

    console.log('✅ Document supprimé');

    return res.status(200).json({
      success: true,
      message: 'Document supprimé avec succès',
    });
  } catch (error) {
    console.error('❌ Erreur suppression document:', error);
    return res.status(500).json({
      success: false,
      message: 'Erreur lors de la suppression du document',
      error: error.message,
    });
  }
};
