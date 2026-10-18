const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * Authentication middleware.
 *
 * Reads the Bearer token from Authorization header, verifies it, then
 * attaches the full user document (minus passwordHash) to req.user.
 *
 * We re-fetch from DB rather than trusting only the JWT payload so that:
 *  - Deleted or deactivated users are rejected immediately.
 *  - The full user object (incl. authorId) is always available to
 *    downstream controllers without an extra query.
 */
const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Re-fetch user; passwordHash excluded via schema `select: false`
    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(401).json({ success: false, message: 'User not found' });
    }

    req.user = user;
    next();
  } catch (error) {
    // Let the centralised error handler differentiate token errors
    next(error);
  }
};

module.exports = authMiddleware;
