/**
 * User role constants.
 * Centralised here so models, middleware, and validators all share
 * the same source of truth — no magic strings scattered around.
 */
const ROLES = Object.freeze({
  AUTHOR: 'author',
  ADMIN: 'admin',
});

/** Convenience array for Mongoose enum / Zod .enum() */
const ROLE_VALUES = Object.values(ROLES);

module.exports = { ROLES, ROLE_VALUES };
