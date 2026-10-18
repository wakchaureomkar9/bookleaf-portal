const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { ROLE_VALUES, ROLES } = require('../constants/roles');

/**
 * User schema.
 *
 * authorId mirrors the AUTH00x string from the seed JSON so that we can
 * quickly look up which User owns a given Book without a separate join.
 * It is sparse+unique: null for admins (who have no authorId), unique for
 * authors. Mongoose sparse indexes skip null values, so multiple admins
 * won't collide on this field.
 */
const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: {
      type: String,
      required: true,
      select: false, // never returned in queries by default
    },
    role: {
      type: String,
      enum: ROLE_VALUES,
      default: ROLES.AUTHOR,
    },
    // Only set for authors; null for admin users
    authorId: {
      type: String,
      default: null,
      sparse: true, // allows multiple null values while still enforcing uniqueness for non-null
      unique: true,
    },
  },
  { timestamps: true }
);

/**
 * Instance method: compare a plain password against the stored hash.
 * Called on login; keeps the comparison logic on the model, not the service.
 */
userSchema.methods.comparePassword = async function (plainPassword) {
  return bcrypt.compare(plainPassword, this.passwordHash);
};

module.exports = mongoose.model('User', userSchema);
