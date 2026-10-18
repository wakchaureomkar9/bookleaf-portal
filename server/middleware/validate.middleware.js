const { ZodError } = require('zod');

/**
 * Zod validation middleware factory.
 *
 * Usage: router.post('/', validate(myZodSchema), controller)
 *
 * Validates req.body against the provided Zod schema.
 * On failure returns a structured 400 with per-field error messages
 * so the frontend can map errors directly to form fields.
 *
 * We use schema.safeParse (not schema.parse) to avoid throwing and
 * to keep error shaping consistent regardless of Zod version.
 */
const validate = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body);

  if (!result.success) {
    const errors = result.error.errors.map((e) => ({
      field: e.path.join('.'),
      message: e.message,
    }));

    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors,
    });
  }

  // Replace req.body with the Zod-parsed (coerced + stripped) data
  req.body = result.data;
  next();
};

module.exports = validate;
