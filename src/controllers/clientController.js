const { Client, User, AuditLog } = require('../models');
const emailService = require('../services/emailService');
const crypto = require('crypto');

/**
 * Controller pour la gestion des clients B2B
 * Réservé aux SuperAdmin
 */

/**
 * Vérifier la disponibilité d'un sous-domaine
 */
const checkSubdomainAvailability = async (req, res) => {
  console.log('\n\n');
  console.log('🚨🚨🚨 NOUVELLE REQUÊTE REÇUE 🚨🚨🚨');
  console.log('Timestamp:', new Date().toISOString());

  try {
    const { subdomain } = req.params;

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔍 CHECK SUBDOMAIN - DÉBUT DU TRAITEMENT');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📍 URL complète:', req.originalUrl);
    console.log('📍 Méthode:', req.method);
    console.log('📍 Host header:', req.get('host'));
    console.log('📍 Sous-domaine demandé:', subdomain);
    console.log('📍 Sous-domaine (lowercase):', subdomain.toLowerCase());
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    // Validation basique du sous-domaine
    if (!subdomain || subdomain.length < 3) {
      console.log('❌ VALIDATION ÉCHEC: Sous-domaine trop court');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      return res.status(400).json({
        success: false,
        available: false,
        message: 'Le sous-domaine doit contenir au moins 3 caractères.',
      });
    }

    console.log('✅ VALIDATION OK: Longueur suffisante');
    console.log('');
    console.log('🔍 RECHERCHE DANS LA BASE DE DONNÉES...');
    console.log('   Query MongoDB: { subdomain: "' + subdomain.toLowerCase() + '" }');

    // Vérifier si le sous-domaine existe déjà
    const existingClient = await Client.findOne({ subdomain: subdomain.toLowerCase() });

    console.log('');
    console.log('📊 RÉSULTAT DE LA RECHERCHE:');
    if (existingClient) {
      console.log('   ✅ Client trouvé dans la base:');
      console.log('      - ID:', existingClient._id);
      console.log('      - Nom:', existingClient.companyName);
      console.log('      - Sous-domaine:', existingClient.subdomain);
      console.log('      - Email:', existingClient.email);
      console.log('      - Status:', existingClient.status);
      console.log('');
      console.log('📤 RÉPONSE ENVOYÉE AU FRONTEND:');
      console.log('   {');
      console.log('     success: true,');
      console.log('     available: false,  ← Le sous-domaine EXISTE (donc PAS disponible)');
      console.log('     message: "Ce sous-domaine est déjà pris."');
      console.log('   }');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

      return res.status(200).json({
        success: true,
        available: false,
        message: 'Ce sous-domaine est déjà pris.',
      });
    } else {
      console.log('   ❌ Aucun client trouvé avec ce sous-domaine');
      console.log('');
      console.log('📤 RÉPONSE ENVOYÉE AU FRONTEND:');
      console.log('   {');
      console.log('     success: true,');
      console.log('     available: true,  ← Le sous-domaine N\'EXISTE PAS (donc disponible)');
      console.log('     message: "Ce sous-domaine est disponible."');
      console.log('   }');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

      return res.status(200).json({
        success: true,
        available: true,
        message: 'Ce sous-domaine est disponible.',
      });
    }
  } catch (error) {
    console.log('');
    console.log('❌❌❌ ERREUR DANS checkSubdomainAvailability ❌❌❌');
    console.error('Détails de l\'erreur:', error);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    return res.status(500).json({
      success: false,
      available: false,
      message: 'Erreur lors de la vérification du sous-domaine.',
      error: error.message,
    });
  }
};

/**
 * Créer un nouveau client B2B
 */
const createClient = async (req, res) => {
  try {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📥 BACKEND - DONNÉES REÇUES (req.body):');
    console.log(JSON.stringify(req.body, null, 2));
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    const {
      companyName,
      subdomain,
      email,
      contactPerson,
      phone,
      address,
      branding,
      limits,
      subscription,
      settings,
    } = req.body;

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔍 BACKEND - CHAMPS EXTRAITS:');
    console.log('companyName:', companyName);
    console.log('subdomain:', subdomain);
    console.log('email:', email);
    console.log('contactPerson:', JSON.stringify(contactPerson));
    console.log('phone:', phone);
    console.log('address:', address);
    console.log('limits:', JSON.stringify(limits));
    console.log('subscription:', JSON.stringify(subscription));
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    // Normaliser l'adresse: si c'est une string, la convertir en objet
    let normalizedAddress = address;
    if (typeof address === 'string' && address.trim()) {
      normalizedAddress = {
        street: address.trim(),
        city: '',
        state: '',
        zipCode: '',
        country: '',
      };
      console.log('🔄 Address convertie de string en objet:', normalizedAddress);
    }

    // 1. Vérifier que le subdomain n'existe pas déjà
    const existingClient = await Client.findOne({ subdomain: subdomain.toLowerCase() });
    if (existingClient) {
      return res.status(409).json({
        success: false,
        message: 'Ce sous-domaine est déjà utilisé.',
      });
    }

    // 2. Vérifier que l'email n'existe pas déjà
    const existingEmail = await Client.findOne({ email: email.toLowerCase() });
    if (existingEmail) {
      return res.status(409).json({
        success: false,
        message: `Cet email est déjà utilisé par le client "${existingEmail.companyName}". Veuillez utiliser un autre email.`,
      });
    }

    // 3. Générer un token d'invitation pour le premier admin
    const invitationToken = crypto.randomBytes(32).toString('hex');
    const invitationExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 jours

    // 4. Créer le client
    const client = await Client.create({
      companyName,
      subdomain: subdomain.toLowerCase(),
      email: email.toLowerCase(),
      contactPerson,
      phone,
      address: normalizedAddress,
      branding: branding || {},
      limits: limits || {
        maxDocumentsPerMonth: 100,
        maxUsers: 10,
        maxStorageGB: 5,
      },
      subscription: subscription || {
        plan: 'STARTER',
        status: 'TRIAL',
        billingCycle: 'MONTHLY',
        trialEndsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 jours
      },
      settings: settings || {},
      status: 'ACTIVE',
      invitationToken,
      invitationExpires,
    });

    // 4. Logger l'action
    await AuditLog.log({
      clientId: client._id,
      action: 'CLIENT_CREATED',
      actor: {
        userId: req.user._id,
        type: 'USER',
        name: `${req.user.firstName} ${req.user.lastName}`,
        email: req.user.email,
      },
      target: {
        type: 'CLIENT',
        id: client._id,
        name: client.companyName,
      },
      details: {
        description: `Client "${client.companyName}" créé avec le sous-domaine "${client.subdomain}"`,
      },
      context: {
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      },
    });

    // Envoyer un email de bienvenue avec lien d'activation
    // Délai de 1 seconde avant l'envoi pour éviter le rate limiting
    await new Promise(resolve => setTimeout(resolve, 1000));

    await emailService.sendClientWelcomeEmail({
      email: client.email,
      companyName: client.companyName,
      subdomain: client.subdomain,
      plan: client.subscription.plan,
      invitationToken: client.invitationToken,
      contactPerson: client.contactPerson,
    });

    return res.status(201).json({
      success: true,
      message: 'Client créé avec succès.',
      data: {
        client,
      },
    });
  } catch (error) {
    console.error('Erreur createClient:', error);
    return res.status(500).json({
      success: false,
      message: 'Erreur lors de la création du client.',
      error: error.message,
    });
  }
};

/**
 * Obtenir la liste de tous les clients
 */
const getAllClients = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      status,
      plan,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = req.query;

    // 1. Construire le filtre
    const filter = {};

    if (status) {
      filter.status = status;
    }

    if (plan) {
      filter['subscription.plan'] = plan;
    }

    if (search) {
      filter.$or = [
        { companyName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { subdomain: { $regex: search, $options: 'i' } },
      ];
    }

    // 2. Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sortOptions = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

    // 3. Récupérer les clients
    const clients = await Client.find(filter)
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(limit));

    // 4. Compter le total
    const total = await Client.countDocuments(filter);

    return res.status(200).json({
      success: true,
      data: {
        clients,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit)),
        },
      },
    });
  } catch (error) {
    console.error('Erreur getAllClients:', error);
    return res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des clients.',
      error: error.message,
    });
  }
};

/**
 * Obtenir un client par son ID
 */
const getClientById = async (req, res) => {
  try {
    const { id } = req.params;

    const client = await Client.findById(id);

    if (!client) {
      return res.status(404).json({
        success: false,
        message: 'Client non trouvé.',
      });
    }

    // Récupérer les statistiques du client
    const userCount = await User.countDocuments({ clientId: client._id });
    // TODO: Ajouter d'autres stats (documents, enveloppes, etc.)

    return res.status(200).json({
      success: true,
      data: {
        client,
        stats: {
          users: userCount,
          // documents: 0,
          // envelopes: 0,
        },
      },
    });
  } catch (error) {
    console.error('Erreur getClientById:', error);
    return res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération du client.',
      error: error.message,
    });
  }
};

/**
 * Mettre à jour un client
 */
const updateClient = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // 1. Trouver le client
    const client = await Client.findById(id);

    if (!client) {
      return res.status(404).json({
        success: false,
        message: 'Client non trouvé.',
      });
    }

    // 2. Vérifier si le subdomain est changé et s'il n'existe pas déjà
    if (updates.subdomain && updates.subdomain !== client.subdomain) {
      const existingSubdomain = await Client.findOne({
        subdomain: updates.subdomain.toLowerCase(),
        _id: { $ne: id },
      });

      if (existingSubdomain) {
        return res.status(409).json({
          success: false,
          message: 'Ce sous-domaine est déjà utilisé.',
        });
      }
    }

    // 3. Vérifier si l'email est changé et s'il n'existe pas déjà
    if (updates.email && updates.email !== client.email) {
      const existingEmail = await Client.findOne({
        email: updates.email.toLowerCase(),
        _id: { $ne: id },
      });

      if (existingEmail) {
        return res.status(409).json({
          success: false,
          message: 'Cet email est déjà utilisé.',
        });
      }
    }

    // 4. Sauvegarder l'ancien état pour l'audit
    const oldState = client.toObject();

    // 5. Mettre à jour le client
    Object.assign(client, updates);
    await client.save();

    // 6. Logger l'action
    await AuditLog.log({
      clientId: client._id,
      action: 'CLIENT_UPDATED',
      actor: {
        userId: req.user._id,
        type: 'USER',
        name: `${req.user.firstName} ${req.user.lastName}`,
        email: req.user.email,
      },
      target: {
        type: 'CLIENT',
        id: client._id,
        name: client.companyName,
      },
      details: {
        description: `Client "${client.companyName}" modifié`,
        changes: {
          before: oldState,
          after: client.toObject(),
        },
      },
      context: {
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      },
    });

    return res.status(200).json({
      success: true,
      message: 'Client mis à jour avec succès.',
      data: {
        client,
      },
    });
  } catch (error) {
    console.error('Erreur updateClient:', error);
    return res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise à jour du client.',
      error: error.message,
    });
  }
};

/**
 * Supprimer un client
 */
const deleteClient = async (req, res) => {
  try {
    const { id } = req.params;

    const client = await Client.findById(id);

    if (!client) {
      return res.status(404).json({
        success: false,
        message: 'Client non trouvé.',
      });
    }

    // Vérifier s'il y a des utilisateurs associés
    const userCount = await User.countDocuments({ clientId: id });

    if (userCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Impossible de supprimer le client. Il y a ${userCount} utilisateur(s) associé(s). Veuillez d'abord les supprimer ou les réassigner.`,
      });
    }

    // TODO: Vérifier s'il y a des documents/enveloppes associés

    // Logger l'action avant la suppression
    await AuditLog.log({
      clientId: client._id,
      action: 'CLIENT_DELETED',
      actor: {
        userId: req.user._id,
        type: 'USER',
        name: `${req.user.firstName} ${req.user.lastName}`,
        email: req.user.email,
      },
      target: {
        type: 'CLIENT',
        id: client._id,
        name: client.companyName,
      },
      details: {
        description: `Client "${client.companyName}" supprimé`,
      },
      context: {
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      },
    });

    // Supprimer le client
    await client.deleteOne();

    return res.status(200).json({
      success: true,
      message: 'Client supprimé avec succès.',
    });
  } catch (error) {
    console.error('Erreur deleteClient:', error);
    return res.status(500).json({
      success: false,
      message: 'Erreur lors de la suppression du client.',
      error: error.message,
    });
  }
};

/**
 * Suspendre un client
 */
const suspendClient = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const client = await Client.findById(id);

    if (!client) {
      return res.status(404).json({
        success: false,
        message: 'Client non trouvé.',
      });
    }

    if (client.status === 'SUSPENDED') {
      return res.status(400).json({
        success: false,
        message: 'Le client est déjà suspendu.',
      });
    }

    client.status = 'SUSPENDED';
    await client.save();

    // Logger l'action
    await AuditLog.log({
      clientId: client._id,
      action: 'CLIENT_SUSPENDED',
      actor: {
        userId: req.user._id,
        type: 'USER',
        name: `${req.user.firstName} ${req.user.lastName}`,
        email: req.user.email,
      },
      target: {
        type: 'CLIENT',
        id: client._id,
        name: client.companyName,
      },
      details: {
        description: `Client "${client.companyName}" suspendu`,
        metadata: { reason },
      },
      context: {
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      },
    });

    // TODO: Envoyer un email au client pour l'informer de la suspension

    return res.status(200).json({
      success: true,
      message: 'Client suspendu avec succès.',
      data: {
        client,
      },
    });
  } catch (error) {
    console.error('Erreur suspendClient:', error);
    return res.status(500).json({
      success: false,
      message: 'Erreur lors de la suspension du client.',
      error: error.message,
    });
  }
};

/**
 * Activer un client
 */
const activateClient = async (req, res) => {
  try {
    const { id } = req.params;

    const client = await Client.findById(id);

    if (!client) {
      return res.status(404).json({
        success: false,
        message: 'Client non trouvé.',
      });
    }

    if (client.status === 'ACTIVE') {
      return res.status(400).json({
        success: false,
        message: 'Le client est déjà actif.',
      });
    }

    client.status = 'ACTIVE';
    await client.save();

    // Logger l'action
    await AuditLog.log({
      clientId: client._id,
      action: 'CLIENT_UPDATED',
      actor: {
        userId: req.user._id,
        type: 'USER',
        name: `${req.user.firstName} ${req.user.lastName}`,
        email: req.user.email,
      },
      target: {
        type: 'CLIENT',
        id: client._id,
        name: client.companyName,
      },
      details: {
        description: `Client "${client.companyName}" activé`,
      },
      context: {
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      },
    });

    // TODO: Envoyer un email au client pour l'informer de l'activation

    return res.status(200).json({
      success: true,
      message: 'Client activé avec succès.',
      data: {
        client,
      },
    });
  } catch (error) {
    console.error('Erreur activateClient:', error);
    return res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'activation du client.',
      error: error.message,
    });
  }
};

/**
 * Obtenir les statistiques d'un client
 */
const getClientStats = async (req, res) => {
  try {
    const { id } = req.params;

    const client = await Client.findById(id);

    if (!client) {
      return res.status(404).json({
        success: false,
        message: 'Client non trouvé.',
      });
    }

    // Récupérer les stats
    const userCount = await User.countDocuments({ clientId: id });
    // TODO: Ajouter les stats pour documents, enveloppes, signatures

    const stats = {
      users: {
        total: userCount,
        limit: client.limits.maxUsers,
        percentage: (userCount / client.limits.maxUsers) * 100,
      },
      documents: {
        total: 0, // TODO
        monthlyLimit: client.limits.maxDocumentsPerMonth,
        percentage: 0,
      },
      storage: {
        used: 0, // TODO: Calculer l'espace utilisé
        limit: client.limits.maxStorageGB,
        percentage: 0,
      },
      subscription: {
        plan: client.subscription.plan,
        status: client.subscription.status,
        billingCycle: client.subscription.billingCycle,
        trialEndsAt: client.subscription.trialEndsAt,
        currentPeriodEnd: client.subscription.currentPeriodEnd,
      },
    };

    return res.status(200).json({
      success: true,
      data: {
        stats,
      },
    });
  } catch (error) {
    console.error('Erreur getClientStats:', error);
    return res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des statistiques.',
      error: error.message,
    });
  }
};

module.exports = {
  checkSubdomainAvailability,
  createClient,
  getAllClients,
  getClientById,
  updateClient,
  deleteClient,
  suspendClient,
  activateClient,
  getClientStats,
};
