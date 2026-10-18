const userService = require('../services/user.service');

/**
 * GET /api/users
 * Admin only. Returns all users.
 */
const getAllUsers = async (req, res, next) => {
  try {
    const users = await userService.getAllUsers();
    res.status(200).json({ success: true, data: { users } });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/users/:id
 * Admin only. Returns a single user by ObjectId.
 */
const getUserById = async (req, res, next) => {
  try {
    const user = await userService.getUserById(req.params.id);
    res.status(200).json({ success: true, data: { user } });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/users/me
 * Any authenticated user. Returns their own profile.
 * Note: this route must be registered BEFORE /:id so Express doesn't treat
 * "me" as an ObjectId.
 */
const getMyProfile = (req, res) => {
  res.status(200).json({ success: true, data: { user: req.user } });
};

module.exports = { getAllUsers, getUserById, getMyProfile };
