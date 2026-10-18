const { z } = require('zod');

/**
 * Schema for POST /api/auth/login
 *
 * email is lowercased + trimmed by Zod before it reaches the service,
 * so the controller never needs to sanitise it manually.
 */
const loginSchema = z.object({
  email: z
    .string({ required_error: 'Email is required' })
    .email('Invalid email format')
    .toLowerCase()
    .trim(),
  password: z
    .string({ required_error: 'Password is required' })
    .min(6, 'Password must be at least 6 characters'),
});

module.exports = { loginSchema };
