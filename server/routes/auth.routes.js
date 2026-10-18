const express = require('express');
const authController = require('../controllers/auth.controller');
const authMiddleware = require('../middleware/auth.middleware');
const validate = require('../middleware/validate.middleware');
const { loginSchema } = require('../validators/auth.schema');

/**
 * Auth router factory.
 *
 * Receives `loginLimiter` from index.js so the rate-limit middleware is
 * configured in one place (index.js) and applied here without this module
 * needing to import express-rate-limit directly.
 */
module.exports = (loginLimiter) => {
  const router = express.Router();

  // POST /api/auth/login  — public, rate-limited
  router.post('/login', loginLimiter, validate(loginSchema), authController.login);

  // GET  /api/auth/me     — requires valid JWT
  router.get('/me', authMiddleware, authController.getMe);

  return router;
};
