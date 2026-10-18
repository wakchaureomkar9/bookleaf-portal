/**
 * Role-based access control middleware factory.
 *
 * Usage: router.get('/admin-only', authMiddleware, requireRole('admin'), handler)
 *
 * Accepts one or more roles so routes can be accessible to multiple roles:
 *   requireRole('admin', 'author')
 *
 * Must be used AFTER authMiddleware so req.user is populated.
 */
const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      // Should never reach here if authMiddleware runs first, but guard anyway
      return res.status(401).json({ success: false, message: 'Unauthenticated' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Required role(s): ${roles.join(', ')}`,
      });
    }

    next();
  };
};

module.exports = requireRole;
