const { ZodError } = require('zod');
const mongoose = require('mongoose');

/**
 * Centralised error handler.
 *
 * Express recognises a 4-argument middleware as an error handler.
 * All routes should pass errors to next(err) rather than handling inline.
 *
 * Error mapping strategy:
 *  - ZodError           → 400 (should normally be caught by validate middleware,
 *                              but catches any schema.parse() calls in services)
 *  - ValidationError    → 422 (Mongoose field-level validation failed)
 *  - Duplicate key (11000) → 409 Conflict
 *  - JsonWebTokenError  → 401 Unauthorised
 *  - TokenExpiredError  → 401 Unauthorised
 *  - CastError          → 400 (invalid ObjectId format in URL params)
 *  - Everything else    → 500
 *
 * In production we suppress the raw error message for 500s to avoid
 * leaking internal details.
 */
// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal Server Error';
  let errors = null;

  // ── Zod validation error ──────────────────────────────────────────────────
  if (err instanceof ZodError) {
    statusCode = 400;
    message = 'Validation failed';
    errors = err.errors.map((e) => ({
      field: e.path.join('.'),
      message: e.message,
    }));
  }

  // ── Mongoose document validation error ───────────────────────────────────
  else if (err.name === 'ValidationError') {
    statusCode = 422;
    message = 'Validation error';
    errors = Object.values(err.errors).map((e) => ({
      field: e.path,
      message: e.message,
    }));
  }

  // ── MongoDB duplicate key ─────────────────────────────────────────────────
  else if (err.code === 11000) {
    statusCode = 409;
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    message = `Duplicate value for field: ${field}`;
  }

  // ── JWT errors ────────────────────────────────────────────────────────────
  else if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid token';
  } else if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Token expired';
  }

  // ── Mongoose CastError (bad ObjectId in URL) ──────────────────────────────
  else if (err.name === 'CastError') {
    statusCode = 400;
    message = `Invalid ${err.path}: ${err.value}`;
  }

  // Mask internal details in production for unhandled 500s
  if (statusCode === 500 && process.env.NODE_ENV === 'production') {
    message = 'Internal Server Error';
  }

  // Log the full error in non-production environments
  if (process.env.NODE_ENV !== 'production') {
    console.error(`[ErrorHandler] ${statusCode} — ${message}`, err.stack || err);
  }

  res.status(statusCode).json({
    success: false,
    message,
    ...(errors && { errors }),
  });
};

module.exports = errorHandler;
