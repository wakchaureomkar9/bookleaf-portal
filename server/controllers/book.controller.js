const bookService = require('../services/book.service');
const { ROLES } = require('../constants/roles');

/**
 * GET /api/books
 *
 * Admins receive all books.
 * Authors receive only their own books (filtered by authorId).
 *
 * This single endpoint replaces separate admin/author routes so the
 * frontend can use the same URL regardless of role.
 */
const getBooks = async (req, res, next) => {
  try {
    // Authors are scoped to their own authorId string; admins get null (all)
    const authorId = req.user.role === ROLES.AUTHOR ? req.user.authorId : null;
    const books = await bookService.getBooks(authorId);
    res.status(200).json({ success: true, data: { books } });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/books/:id
 *
 * Authors: can only retrieve their own books (enforced by checking authorId).
 * Admins: can retrieve any book.
 */
const getBookById = async (req, res, next) => {
  try {
    const book = await bookService.getBookById(req.params.id);

    // Ownership check for authors
    if (req.user.role === ROLES.AUTHOR && book.authorId !== req.user.authorId) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    res.status(200).json({ success: true, data: { book } });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/books/:id
 * Admin only. Body validated by updateBookSchema.
 */
const updateBook = async (req, res, next) => {
  try {
    const book = await bookService.updateBook(req.params.id, req.body);
    res.status(200).json({ success: true, data: { book } });
  } catch (error) {
    next(error);
  }
};

module.exports = { getBooks, getBookById, updateBook };
