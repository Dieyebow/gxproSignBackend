const { Document, Client, AuditLog } = require('../models');
const path = require('path');
const fs = require('fs');

/**
 * Controller pour la gestion des documents
 */

/**
 * Upload et créer un nouveau document
 */
const uploadDocument = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Aucun fichier n\'a été fourni.',
      });
    }

    const { title, description, folder, tags, isTemplate } = req.body;

    // Vérifier que l'utilisateur a un clientId (sauf SuperAdmin)
    const clientId = req.user.role === 'SUPER_ADMIN'
      ? req.body.clientId
      : req.user.clientId;

    if (!clientId) {
      // Supprimer le fichier uploadé
      fs.unlinkSync(req.file.path);
      return res.status(400).json({
        success: false,
        message: 'Client ID requis.',
      });
    }

    // Vérifier que le client existe
    const client = await Client.findById(clientId);
    if (!client) {
      fs.unlinkSync(req.file.path);
      return res.status(404).json({
        success: false,
        message: 'Client non trouvé.',
      });
    }

    // Vérifier les limites du client
    const currentMonthDocs = await Document.countDocuments({
      clientId,
      createdAt: {
        $gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
      },
    });

    if (currentMonthDocs >= client.limits.maxDocumentsPerMonth) {
      fs.unlinkSync(req.file.path);
      return res.status(403).json({
        success: false,
        message: `Limite mensuelle de documents atteinte (${client.limits.maxDocumentsPerMonth}).`,
      });
    }

    // Créer le document
    const document = await Document.create({
      clientId,
      uploadedBy: req.user._id,
      title: title || req.file.originalname,
      description,
      file: {
        originalName: req.file.originalname,
        filename: req.file.filename,
        fileUrl: `/uploads/${clientId}/${req.file.filename}`,
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
      },
      folder: folder || 'default',
      tags: tags ? (Array.isArray(tags) ? tags : tags.split(',')) : [],
      isTemplate: isTemplate === 'true' || isTemplate === true,
      status: 'ACTIVE',
    });

    // Logger l'action
    await AuditLog.log({
      clientId,
      documentId: document._id,
      action: 'DOCUMENT_UPLOADED',
      actor: {
        userId: req.user._id,
        type: 'USER',
        name: `${req.user.firstName} ${req.user.lastName}`,
        email: req.user.email,
      },
      target: {
        type: 'DOCUMENT',
        id: document._id,
        name: document.title,
      },
      details: {
        description: `Document "${document.title}" uploadé`,
        metadata: {
          fileName: document.file.originalName,
          fileSize: document.file.fileSize,
        },
      },
      context: {
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      },
    });

    return res.status(201).json({
      success: true,
      message: 'Document uploadé avec succès.',
      data: {
        document,
      },
    });
  } catch (error) {
    console.error('Erreur uploadDocument:', error);

    // Supprimer le fichier en cas d'erreur
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    return res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'upload du document.',
      error: error.message,
    });
  }
};

/**
 * Obtenir la liste des documents
 */
const getAllDocuments = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      status,
      folder,
      tags,
      search,
      isTemplate,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = req.query;

    // Construire le filtre
    const filter = {};

    // Filtrer par client (sauf SuperAdmin)
    if (req.user.role !== 'SUPER_ADMIN') {
      filter.clientId = req.user.clientId;
    } else if (req.query.clientId) {
      filter.clientId = req.query.clientId;
    }

    if (status) {
      filter.status = status;
    }

    if (folder) {
      filter.folder = folder;
    }

    if (tags) {
      filter.tags = { $in: Array.isArray(tags) ? tags : tags.split(',') };
    }

    if (isTemplate !== undefined) {
      filter.isTemplate = isTemplate === 'true';
    }

    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { originalFileName: { $regex: search, $options: 'i' } },
      ];
    }

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sortOptions = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

    // Récupérer les documents
    const documents = await Document.find(filter)
      .populate('uploadedBy', 'firstName lastName email')
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Document.countDocuments(filter);

    return res.status(200).json({
      success: true,
      data: {
        documents,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit)),
        },
      },
    });
  } catch (error) {
    console.error('Erreur getAllDocuments:', error);
    return res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des documents.',
      error: error.message,
    });
  }
};

/**
 * Obtenir un document par ID
 */
const getDocumentById = async (req, res) => {
  try {
    const { id } = req.params;

    const document = await Document.findById(id)
      .populate('uploadedBy', 'firstName lastName email')
      .populate('clientId', 'companyName subdomain');

    if (!document) {
      return res.status(404).json({
        success: false,
        message: 'Document non trouvé.',
      });
    }

    // Vérifier l'accès (sauf SuperAdmin)
    if (req.user.role !== 'SUPER_ADMIN') {
      if (document.clientId._id.toString() !== req.user.clientId.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Accès refusé à ce document.',
        });
      }
    }

    return res.status(200).json({
      success: true,
      data: {
        document,
      },
    });
  } catch (error) {
    console.error('Erreur getDocumentById:', error);
    return res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération du document.',
      error: error.message,
    });
  }
};

/**
 * Télécharger un document
 */
const downloadDocument = async (req, res) => {
  try {
    const { id } = req.params;

    const document = await Document.findById(id);

    if (!document) {
      return res.status(404).json({
        success: false,
        message: 'Document non trouvé.',
      });
    }

    // Vérifier l'accès
    if (req.user.role !== 'SUPER_ADMIN') {
      if (document.clientId.toString() !== req.user.clientId.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Accès refusé à ce document.',
        });
      }
    }

    // Vérifier que le fichier existe
    if (!fs.existsSync(document.filePath)) {
      return res.status(404).json({
        success: false,
        message: 'Fichier non trouvé sur le serveur.',
      });
    }

    // Incrémenter les téléchargements
    document.stats.downloads += 1;
    await document.save();

    // Envoyer le fichier
    res.download(document.filePath, document.originalFileName);
  } catch (error) {
    console.error('Erreur downloadDocument:', error);
    return res.status(500).json({
      success: false,
      message: 'Erreur lors du téléchargement du document.',
      error: error.message,
    });
  }
};

/**
 * Mettre à jour un document
 */
const updateDocument = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const document = await Document.findById(id);

    if (!document) {
      return res.status(404).json({
        success: false,
        message: 'Document non trouvé.',
      });
    }

    // Vérifier l'accès
    if (req.user.role !== 'SUPER_ADMIN') {
      if (document.clientId.toString() !== req.user.clientId.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Accès refusé à ce document.',
        });
      }
    }

    // Mettre à jour
    Object.assign(document, updates);
    document.lastModifiedAt = Date.now();
    document.lastModifiedBy = req.user._id;
    await document.save();

    // Logger l'action
    await AuditLog.log({
      clientId: document.clientId,
      documentId: document._id,
      action: 'DOCUMENT_UPDATED',
      actor: {
        userId: req.user._id,
        type: 'USER',
        name: `${req.user.firstName} ${req.user.lastName}`,
        email: req.user.email,
      },
      target: {
        type: 'DOCUMENT',
        id: document._id,
        name: document.title,
      },
      details: {
        description: `Document "${document.title}" modifié`,
      },
      context: {
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      },
    });

    return res.status(200).json({
      success: true,
      message: 'Document mis à jour avec succès.',
      data: {
        document,
      },
    });
  } catch (error) {
    console.error('Erreur updateDocument:', error);
    return res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise à jour du document.',
      error: error.message,
    });
  }
};

/**
 * Supprimer un document
 */
const deleteDocument = async (req, res) => {
  try {
    const { id } = req.params;

    const document = await Document.findById(id);

    if (!document) {
      return res.status(404).json({
        success: false,
        message: 'Document non trouvé.',
      });
    }

    // Vérifier l'accès
    if (req.user.role !== 'SUPER_ADMIN') {
      if (document.clientId.toString() !== req.user.clientId.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Accès refusé à ce document.',
        });
      }
    }

    // Vérifier si le document est utilisé dans des enveloppes
    // TODO: Vérifier les enveloppes

    // Supprimer le fichier physique
    if (fs.existsSync(document.filePath)) {
      fs.unlinkSync(document.filePath);
    }

    // Logger l'action avant suppression
    await AuditLog.log({
      clientId: document.clientId,
      documentId: document._id,
      action: 'DOCUMENT_DELETED',
      actor: {
        userId: req.user._id,
        type: 'USER',
        name: `${req.user.firstName} ${req.user.lastName}`,
        email: req.user.email,
      },
      target: {
        type: 'DOCUMENT',
        id: document._id,
        name: document.title,
      },
      details: {
        description: `Document "${document.title}" supprimé`,
      },
      context: {
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      },
    });

    // Supprimer le document
    await document.deleteOne();

    return res.status(200).json({
      success: true,
      message: 'Document supprimé avec succès.',
    });
  } catch (error) {
    console.error('Erreur deleteDocument:', error);
    return res.status(500).json({
      success: false,
      message: 'Erreur lors de la suppression du document.',
      error: error.message,
    });
  }
};

module.exports = {
  uploadDocument,
  getAllDocuments,
  getDocumentById,
  downloadDocument,
  updateDocument,
  deleteDocument,
};
