const Book = require('../models/Book');

/**
 * Get all books (admin) or all books belonging to a specific authorId (author).
 * @param {string|null} authorId - if provided, filters to this author's books
 */
const getBooks = async (authorId = null) => {
  const filter = authorId ? { authorId } : {};
  return Book.find(filter).sort({ createdAt: -1 });
};

/**
 * Get a single book by its MongoDB ObjectId.
 * Throws 404 if not found.
 */
const getBookById = async (id) => {
  const book = await Book.findById(id);
  if (!book) {
    const err = new Error('Book not found');
    err.statusCode = 404;
    throw err;
  }
  return book;
};

/**
 * Get a single book by its string bookId (e.g. "BK001").
 */
const getBookByBookId = async (bookId) => {
  const book = await Book.findOne({ bookId });
  if (!book) {
    const err = new Error('Book not found');
    err.statusCode = 404;
    throw err;
  }
  return book;
};

/**
 * Admin: update book fields by MongoDB ObjectId.
 * Returns the updated book document.
 */
const updateBook = async (id, updates) => {
  const book = await Book.findByIdAndUpdate(id, updates, {
    new: true,          // return updated document
    runValidators: true, // run schema validators on the update
  });
  if (!book) {
    const err = new Error('Book not found');
    err.statusCode = 404;
    throw err;
  }
  return book;
};

module.exports = { getBooks, getBookById, getBookByBookId, updateBook };
