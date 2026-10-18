// ─── Environment — must be first ──────────────────────────────────────────────
// Loads .env from an explicit path and validates required vars. Exits on missing.
require('./config/env');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const connectDB = require('./config/db');
const errorHandler = require('./middleware/error.middleware');

// ─── Route imports ────────────────────────────────────────────────────────────
const authRoutes = require('./routes/auth.routes');
const userRoutes = require('./routes/user.routes');
const bookRoutes = require('./routes/book.routes');
const ticketRoutes = require('./routes/ticket.routes');

// ─── App initialisation ───────────────────────────────────────────────────────
const app = express();

// Connect to MongoDB before handling any requests
connectDB();

// ─── Security middleware ───────────────────────────────────────────────────────
// helmet sets a suite of security-relevant HTTP response headers in one call
app.use(helmet());

// CORS: restrict to the frontend origin declared in .env.
// In development CORS_ORIGIN defaults to '*' so you can hit the API directly.
// In production set CORS_ORIGIN to your exact frontend URL (no trailing slash).
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// ─── Rate limiter for login ────────────────────────────────────────────────────
// Applied only to /api/auth so it doesn't bleed onto other endpoints.
// 10 attempts per 15-minute window per IP; tightens the brute-force surface.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  standardHeaders: true,  // Return rate-limit info in RateLimit-* headers
  legacyHeaders: false,
  message: { success: false, message: 'Too many login attempts. Please try again later.' },
});

// ─── Body parsers ─────────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// ─── Health check ─────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.status(200).json({ success: true, message: 'Bookleaf API is running' });
});

// ─── Routes ───────────────────────────────────────────────────────────────────
// loginLimiter is passed to authRoutes so the router can apply it only to /login
app.use('/api/auth', authRoutes(loginLimiter));
app.use('/api/users', userRoutes);
app.use('/api/books', bookRoutes);
app.use('/api/tickets', ticketRoutes);

// ─── 404 handler ─────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.originalUrl} not found` });
});

// ─── Centralised error handler (must be last) ─────────────────────────────────
app.use(errorHandler);

// ─── Start server ─────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode`);
});

module.exports = app;
