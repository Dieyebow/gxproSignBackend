const express = require('express');
const router = express.Router();
const fieldController = require('../controllers/field.controller');
const { authenticate } = require('../middlewares/auth.middleware');

// Protected routes (require authentication)
router.get('/', authenticate, fieldController.getFields);
router.post('/', authenticate, fieldController.createField);
router.post('/bulk', authenticate, fieldController.bulkCreateFields);
router.put('/:id', authenticate, fieldController.updateField);
router.delete('/:id', authenticate, fieldController.deleteField);

// Public route (with token validation)
router.post('/:id/fill', fieldController.fillField);

module.exports = router;
