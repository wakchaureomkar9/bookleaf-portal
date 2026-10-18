const User = require('../models/User');

/**
 * Fetch all users (admin use). Excludes passwordHash.
 */
const getAllUsers = async () => {
  return User.find().select('-passwordHash');
};

/**
 * Fetch a single user by MongoDB ObjectId.
 */
const getUserById = async (id) => {
  const user = await User.findById(id).select('-passwordHash');
  if (!user) {
    const err = new Error('User not found');
    err.statusCode = 404;
    throw err;
  }
  return user;
};

/**
 * Fetch a single user by their string authorId (e.g. "AUTH001").
 * Used internally by the seed script and book ownership checks.
 */
const getUserByAuthorId = async (authorId) => {
  const user = await User.findOne({ authorId }).select('-passwordHash');
  if (!user) {
    const err = new Error(`Author ${authorId} not found`);
    err.statusCode = 404;
    throw err;
  }
  return user;
};

module.exports = { getAllUsers, getUserById, getUserByAuthorId };
