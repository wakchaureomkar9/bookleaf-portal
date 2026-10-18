const express = require('express');
const router = express.Router();
const bookController = require('../controllers/book.controller');
const authMiddleware = require('../middleware/auth.middleware');
const requireRole = require('../middleware/role.middleware');
const validate = require('../middleware/validate.middleware');
const { updateBookSchema } = require('../validators/book.schema');
const { ROLES } = require('../constants/roles');

// All book routes require authentication
router.use(authMiddleware);

// GET  /api/books      — both roles (scoped by role in controller)
router.get('/', bookController.getBooks);

// GET  /api/books/:id  — both roles (ownership enforced in controller)
router.get('/:id', bookController.getBookById);

// PATCH /api/books/:id — admin only
router.patch(
  '/:id',
  requireRole(ROLES.ADMIN),
  validate(updateBookSchema),
  bookController.updateBook
);

module.exports = router;
