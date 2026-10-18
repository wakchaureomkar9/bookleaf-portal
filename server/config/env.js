/**
 * Environment loader and validator.
 *
 * Import this file FIRST in index.js and seed/seed.js.
 * It loads .env from an explicit absolute path so the process works correctly
 * regardless of which directory the command is run from (e.g. `node server/index.js`
 * from the project root vs `node index.js` from inside server/).
 *
 * After loading, it validates that every required variable is present.
 * Missing variables are printed together (not one at a time) so the developer
 * can fix them all in one edit, then the process exits with code 1.
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

// ─── Required variables ────────────────────────────────────────────────────────
// These must be set before the server or seed script can run safely.
// Grouped by concern so the error message is easy to act on.
const REQUIRED = [
  'MONGO_URI',
  'JWT_SECRET',
  'JWT_EXPIRES_IN',
  'CORS_ORIGIN',
];

const missing = REQUIRED.filter((key) => !process.env[key]);

if (missing.length > 0) {
  console.error('\n❌ Missing required environment variable(s):');
  missing.forEach((key) => console.error(`   • ${key}`));
  console.error('\nAdd them to server/.env (see .env.example).\n');
  process.exit(1);
}

module.exports = {}; // nothing to export; side-effect-only module
