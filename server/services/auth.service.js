const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * Generates a signed JWT for a given user.
 *
 * Payload deliberately minimal — we re-fetch the user in authMiddleware,
 * so we only need enough to look the user up (id) and make role decisions
 * without a DB hit in some fast-path scenarios (role, authorId).
 */
const signToken = (user) => {
  return jwt.sign(
    {
      id: user._id,
      role: user.role,
      authorId: user.authorId,
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};

/**
 * Validates credentials and returns a token + sanitised user object.
 *
 * passwordHash is excluded from User queries via `select: false` on the
 * schema, so we must explicitly re-select it here for comparison.
 */
const loginUser = async (email, password) => {
  // Explicitly select passwordHash back since it's hidden by default
  const user = await User.findOne({ email }).select('+passwordHash');

  if (!user) {
    // Use a generic message to prevent user enumeration attacks
    const err = new Error('Invalid email or password');
    err.statusCode = 401;
    throw err;
  }

  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    const err = new Error('Invalid email or password');
    err.statusCode = 401;
    throw err;
  }

  const token = signToken(user);

  // Strip sensitive fields before returning
  const userObj = user.toObject();
  delete userObj.passwordHash;

  return { token, user: userObj };
};

module.exports = { loginUser };
