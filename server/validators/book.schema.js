const { z } = require('zod');

/**
 * Book update schema (admin only — authors cannot edit book data directly).
 *
 * All fields are optional because admins may patch only a subset.
 * mrp, authorRoyaltyPerCopy, publicationDate, lastRoyaltyPayoutDate
 * accept null explicitly to allow clearing them for in-production books.
 */
const updateBookSchema = z
  .object({
    title: z.string().trim().min(1).optional(),
    isbn: z.string().trim().optional(),
    genre: z.string().trim().optional(),
    publicationDate: z.coerce.date().nullable().optional(),
    status: z.string().trim().optional(),
    mrp: z.number().positive().nullable().optional(),
    authorRoyaltyPerCopy: z.number().positive().nullable().optional(),
    totalCopiesSold: z.number().int().nonnegative().optional(),
    totalRoyaltyEarned: z.number().nonnegative().optional(),
    royaltyPaid: z.number().nonnegative().optional(),
    royaltyPending: z.number().nonnegative().optional(),
    lastRoyaltyPayoutDate: z.coerce.date().nullable().optional(),
    printPartner: z.string().trim().nullable().optional(),
    availableOn: z.array(z.string()).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided to update',
  });

module.exports = { updateBookSchema };
