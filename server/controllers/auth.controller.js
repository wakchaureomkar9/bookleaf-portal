const authService = require('../services/auth.service');

/**
 * POST /api/auth/login
 * Body validated by loginSchema before reaching here.
 */
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const { token, user } = await authService.loginUser(email, password);

    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: { token, user },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/auth/me
 * Returns the currently authenticated user (from req.user set by authMiddleware).
 * No DB hit here — user was already fetched by authMiddleware.
 */
const getMe = (req, res) => {
  res.status(200).json({
    success: true,
    data: { user: req.user },
  });
};

module.exports = { login, getMe };
