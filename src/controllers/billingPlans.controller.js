const BillingPlan = require('../models/BillingPlan.model');

// Récupérer tous les plans de facturation
const getAllPlans = async (req, res) => {
  try {
    console.log('📥 GET /admin/billing-plans - Récupération des plans de facturation');

    const { billingPeriod, isActive } = req.query;
    const query = {};

    if (billingPeriod) {
      query.billingPeriod = billingPeriod;
    }

    if (isActive !== undefined) {
      query.isActive = isActive === 'true';
    }

    const plans = await BillingPlan.find(query)
      .sort({ displayOrder: 1, billingPeriod: 1, price: 1 });

    console.log(`✅ ${plans.length} plans récupérés`);

    return res.status(200).json({
      success: true,
      data: { plans },
    });
  } catch (error) {
    console.error('❌ Erreur get billing plans:', error);
    return res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des plans de facturation.',
      error: error.message,
    });
  }
};

// Récupérer les plans actifs (pour les clients)
const getActivePlans = async (req, res) => {
  try {
    console.log('📥 GET /billing-plans/active - Récupération des plans actifs');

    const { billingPeriod } = req.query;
    const plans = await BillingPlan.getActivePlans(billingPeriod);

    console.log(`✅ ${plans.length} plans actifs récupérés`);

    return res.status(200).json({
      success: true,
      data: { plans },
    });
  } catch (error) {
    console.error('❌ Erreur get active plans:', error);
    return res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des plans actifs.',
      error: error.message,
    });
  }
};

// Récupérer un plan par ID
const getPlanById = async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`📥 GET /admin/billing-plans/${id}`);

    const plan = await BillingPlan.findById(id);

    if (!plan) {
      return res.status(404).json({
        success: false,
        message: 'Plan de facturation non trouvé.',
      });
    }

    console.log('✅ Plan récupéré:', plan.name);

    return res.status(200).json({
      success: true,
      data: { plan },
    });
  } catch (error) {
    console.error('❌ Erreur get plan by id:', error);
    return res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération du plan.',
      error: error.message,
    });
  }
};

// Créer un nouveau plan
const createPlan = async (req, res) => {
  try {
    console.log('📥 POST /admin/billing-plans - Création d\'un plan');
    console.log('  Données reçues:', req.body);
    console.log('  Utilisateur:', req.user.email);

    const planData = {
      ...req.body,
      createdBy: req.user._id,
      lastUpdatedBy: req.user._id,
    };

    const plan = await BillingPlan.create(planData);

    console.log('✅ Plan créé:', plan.name);

    return res.status(201).json({
      success: true,
      message: 'Plan de facturation créé avec succès.',
      data: { plan },
    });
  } catch (error) {
    console.error('❌ Erreur create plan:', error);
    return res.status(500).json({
      success: false,
      message: 'Erreur lors de la création du plan.',
      error: error.message,
    });
  }
};

// Mettre à jour un plan
const updatePlan = async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`📥 PUT /admin/billing-plans/${id}`);
    console.log('  Données reçues:', req.body);
    console.log('  Utilisateur:', req.user.email);

    const plan = await BillingPlan.findById(id);

    if (!plan) {
      return res.status(404).json({
        success: false,
        message: 'Plan de facturation non trouvé.',
      });
    }

    // Mettre à jour les champs
    Object.keys(req.body).forEach(key => {
      if (key !== 'createdBy' && key !== '_id') {
        plan[key] = req.body[key];
      }
    });

    plan.lastUpdatedBy = req.user._id;
    await plan.save();

    console.log('✅ Plan mis à jour:', plan.name);

    return res.status(200).json({
      success: true,
      message: 'Plan de facturation mis à jour avec succès.',
      data: { plan },
    });
  } catch (error) {
    console.error('❌ Erreur update plan:', error);
    return res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise à jour du plan.',
      error: error.message,
    });
  }
};

// Supprimer un plan (soft delete par défaut, suppression définitive si permanent=true)
const deletePlan = async (req, res) => {
  try {
    const { id } = req.params;
    const { permanent } = req.query;
    console.log(`📥 DELETE /admin/billing-plans/${id}`);
    console.log('  Utilisateur:', req.user.email);
    console.log('  Suppression permanente:', permanent === 'true');

    const plan = await BillingPlan.findById(id);

    if (!plan) {
      return res.status(404).json({
        success: false,
        message: 'Plan de facturation non trouvé.',
      });
    }

    // Si permanent=true, supprimer définitivement de la base de données
    if (permanent === 'true') {
      await BillingPlan.findByIdAndDelete(id);
      console.log('✅ Plan supprimé définitivement:', plan.name);

      return res.status(200).json({
        success: true,
        message: 'Plan de facturation supprimé définitivement avec succès.',
        data: { plan },
      });
    }

    // Sinon, soft delete: désactiver le plan
    plan.isActive = false;
    plan.lastUpdatedBy = req.user._id;
    await plan.save();

    console.log('✅ Plan désactivé:', plan.name);

    return res.status(200).json({
      success: true,
      message: 'Plan de facturation désactivé avec succès.',
      data: { plan },
    });
  } catch (error) {
    console.error('❌ Erreur delete plan:', error);
    return res.status(500).json({
      success: false,
      message: 'Erreur lors de la suppression du plan.',
      error: error.message,
    });
  }
};

// Créer les plans par défaut (utile pour l'initialisation)
const createDefaultPlans = async (req, res) => {
  try {
    console.log('📥 POST /admin/billing-plans/init-defaults');
    console.log('  Utilisateur:', req.user.email);

    const defaultPlans = [
      // Plans MENSUELS
      {
        name: 'Starter Mensuel',
        description: 'Parfait pour les petites équipes',
        billingPeriod: 'MENSUEL',
        price: 29,
        currency: 'EUR',
        features: {
          maxUsers: 5,
          maxDocumentsPerMonth: 50,
          maxStorageGB: 5,
          customBranding: false,
          apiAccess: false,
          prioritySupport: false,
          advancedReporting: false,
        },
        displayOrder: 1,
        createdBy: req.user._id,
        lastUpdatedBy: req.user._id,
      },
      {
        name: 'Pro Mensuel',
        description: 'Pour les équipes en croissance',
        billingPeriod: 'MENSUEL',
        price: 79,
        currency: 'EUR',
        features: {
          maxUsers: 20,
          maxDocumentsPerMonth: 200,
          maxStorageGB: 20,
          customBranding: true,
          apiAccess: true,
          prioritySupport: false,
          advancedReporting: true,
        },
        isPopular: true,
        displayOrder: 2,
        createdBy: req.user._id,
        lastUpdatedBy: req.user._id,
      },
      {
        name: 'Enterprise Mensuel',
        description: 'Pour les grandes organisations',
        billingPeriod: 'MENSUEL',
        price: 199,
        currency: 'EUR',
        features: {
          maxUsers: 100,
          maxDocumentsPerMonth: 1000,
          maxStorageGB: 100,
          customBranding: true,
          apiAccess: true,
          prioritySupport: true,
          advancedReporting: true,
        },
        displayOrder: 3,
        createdBy: req.user._id,
        lastUpdatedBy: req.user._id,
      },

      // Plans TRIMESTRIELS (avec 10% de réduction)
      {
        name: 'Starter Trimestriel',
        description: 'Parfait pour les petites équipes - Économisez 10%',
        billingPeriod: 'TRIMESTRIEL',
        price: 78.30, // 29 * 3 * 0.9
        currency: 'EUR',
        features: {
          maxUsers: 5,
          maxDocumentsPerMonth: 50,
          maxStorageGB: 5,
          customBranding: false,
          apiAccess: false,
          prioritySupport: false,
          advancedReporting: false,
        },
        displayOrder: 4,
        createdBy: req.user._id,
        lastUpdatedBy: req.user._id,
      },
      {
        name: 'Pro Trimestriel',
        description: 'Pour les équipes en croissance - Économisez 10%',
        billingPeriod: 'TRIMESTRIEL',
        price: 213.30, // 79 * 3 * 0.9
        currency: 'EUR',
        features: {
          maxUsers: 20,
          maxDocumentsPerMonth: 200,
          maxStorageGB: 20,
          customBranding: true,
          apiAccess: true,
          prioritySupport: false,
          advancedReporting: true,
        },
        displayOrder: 5,
        createdBy: req.user._id,
        lastUpdatedBy: req.user._id,
      },

      // Plans SEMESTRIELS (avec 15% de réduction)
      {
        name: 'Pro Semestriel',
        description: 'Pour les équipes en croissance - Économisez 15%',
        billingPeriod: 'SEMESTRIEL',
        price: 402.90, // 79 * 6 * 0.85
        currency: 'EUR',
        features: {
          maxUsers: 20,
          maxDocumentsPerMonth: 200,
          maxStorageGB: 20,
          customBranding: true,
          apiAccess: true,
          prioritySupport: false,
          advancedReporting: true,
        },
        displayOrder: 6,
        createdBy: req.user._id,
        lastUpdatedBy: req.user._id,
      },

      // Plans ANNUELS (avec 20% de réduction)
      {
        name: 'Starter Annuel',
        description: 'Parfait pour les petites équipes - Économisez 20%',
        billingPeriod: 'ANNUEL',
        price: 278.40, // 29 * 12 * 0.8
        currency: 'EUR',
        features: {
          maxUsers: 5,
          maxDocumentsPerMonth: 50,
          maxStorageGB: 5,
          customBranding: false,
          apiAccess: false,
          prioritySupport: false,
          advancedReporting: false,
        },
        displayOrder: 7,
        createdBy: req.user._id,
        lastUpdatedBy: req.user._id,
      },
      {
        name: 'Pro Annuel',
        description: 'Pour les équipes en croissance - Économisez 20%',
        billingPeriod: 'ANNUEL',
        price: 758.40, // 79 * 12 * 0.8
        currency: 'EUR',
        features: {
          maxUsers: 20,
          maxDocumentsPerMonth: 200,
          maxStorageGB: 20,
          customBranding: true,
          apiAccess: true,
          prioritySupport: false,
          advancedReporting: true,
        },
        isPopular: true,
        displayOrder: 8,
        createdBy: req.user._id,
        lastUpdatedBy: req.user._id,
      },
      {
        name: 'Enterprise Annuel',
        description: 'Pour les grandes organisations - Économisez 20%',
        billingPeriod: 'ANNUEL',
        price: 1910.40, // 199 * 12 * 0.8
        currency: 'EUR',
        features: {
          maxUsers: 100,
          maxDocumentsPerMonth: 1000,
          maxStorageGB: 100,
          customBranding: true,
          apiAccess: true,
          prioritySupport: true,
          advancedReporting: true,
        },
        displayOrder: 9,
        createdBy: req.user._id,
        lastUpdatedBy: req.user._id,
      },
    ];

    const createdPlans = await BillingPlan.insertMany(defaultPlans);

    console.log(`✅ ${createdPlans.length} plans par défaut créés`);

    return res.status(201).json({
      success: true,
      message: `${createdPlans.length} plans par défaut créés avec succès.`,
      data: { plans: createdPlans },
    });
  } catch (error) {
    console.error('❌ Erreur create default plans:', error);
    return res.status(500).json({
      success: false,
      message: 'Erreur lors de la création des plans par défaut.',
      error: error.message,
    });
  }
};

module.exports = {
  getAllPlans,
  getActivePlans,
  getPlanById,
  createPlan,
  updatePlan,
  deletePlan,
  createDefaultPlans,
};
