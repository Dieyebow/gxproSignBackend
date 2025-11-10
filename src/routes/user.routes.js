const express = require('express');
const router = express.Router();
const { uploadAvatar, updateProfile, getProfile } = require('../controllers/userController');
const { authenticate } = require('../middlewares/auth.middleware');
const { uploadAvatar: uploadMiddleware } = require('../middleware/upload');

/**
 * @route   POST /api/users/upload-avatar
 * @desc    Upload avatar
 * @access  Private
 */
router.post('/upload-avatar', authenticate, uploadMiddleware, uploadAvatar);

/**
 * @route   PUT /api/users/profile
 * @desc    Update user profile
 * @access  Private
 */
router.put('/profile', authenticate, updateProfile);

/**
 * @route   GET /api/users/profile
 * @desc    Get user profile
 * @access  Private
 */
router.get('/profile', authenticate, getProfile);

module.exports = router;
