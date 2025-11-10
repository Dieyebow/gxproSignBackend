const express = require('express');
const router = express.Router();
const billingPlansController = require('../controllers/billingPlans.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { requireSuperAdmin } = require('../middlewares/rbac.middleware');

// Routes publiques/authentifiées (pour les clients)
router.get('/active', authenticate, billingPlansController.getActivePlans);

// Routes Super Admin uniquement
router.use(authenticate);
router.use(requireSuperAdmin);

router.get('/', billingPlansController.getAllPlans);
router.get('/:id', billingPlansController.getPlanById);
router.post('/', billingPlansController.createPlan);
router.post('/init-defaults', billingPlansController.createDefaultPlans);
router.put('/:id', billingPlansController.updatePlan);
router.delete('/:id', billingPlansController.deletePlan);

module.exports = router;
