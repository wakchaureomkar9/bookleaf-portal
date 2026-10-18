const express = require('express');
const router = express.Router();
const userController = require('../controllers/user.controller');
const authMiddleware = require('../middleware/auth.middleware');
const requireRole = require('../middleware/role.middleware');
const { ROLES } = require('../constants/roles');

// All user routes require authentication
router.use(authMiddleware);

// GET /api/users/me — MUST be before /:id to avoid "me" being treated as an ObjectId
router.get('/me', userController.getMyProfile);

// Admin-only routes
router.get('/', requireRole(ROLES.ADMIN), userController.getAllUsers);
router.get('/:id', requireRole(ROLES.ADMIN), userController.getUserById);

module.exports = router;
