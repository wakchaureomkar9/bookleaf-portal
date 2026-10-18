const { z } = require('zod');
const {
  TICKET_CATEGORY_VALUES,
  TICKET_PRIORITY_VALUES,
  TICKET_STATUS_VALUES,
  TICKET_SOURCE_VALUES,
  TICKET_PRIORITIES,
  TICKET_SOURCES,
} = require('../constants/ticketEnums');

// ─── Create Ticket ────────────────────────────────────────────────────────────
/**
 * Submitted by an author when raising a new ticket.
 * category and priority may be pre-filled by AI on the client side before
 * submission, or set by the author manually — hence both are required on create
 * but optional to send (they have defaults in the model).
 */
const createTicketSchema = z.object({
  subject: z.string().trim().min(3, 'Subject too short').max(200, 'Subject too long'),
  description: z.string().trim().min(10, 'Description too short'),
  category: z
    .enum(TICKET_CATEGORY_VALUES, {
      errorMap: () => ({ message: `Category must be one of: ${TICKET_CATEGORY_VALUES.join(', ')}` }),
    })
    .optional(),
  priority: z
    .enum(TICKET_PRIORITY_VALUES, {
      errorMap: () => ({ message: `Priority must be one of: ${TICKET_PRIORITY_VALUES.join(', ')}` }),
    })
    .optional(),
  // bookId is optional — ticket may not be about a specific book
  bookId: z.string().optional().nullable(),
  categorySource: z.enum(TICKET_SOURCE_VALUES).default(TICKET_SOURCES.AI),
  prioritySource: z.enum(TICKET_SOURCE_VALUES).default(TICKET_SOURCES.AI),
  // aiMeta is optional on creation; AI pipeline may populate it server-side
  aiMeta: z
    .object({
      reason: z.string().nullable().optional(),
      aiFailed: z.boolean().default(false),
    })
    .optional(),
});

// ─── Update Ticket (admin) ────────────────────────────────────────────────────
/**
 * Admin-only patch: can reassign, change status, override category/priority.
 * All fields optional so admins can update just what they need.
 */
const updateTicketSchema = z
  .object({
    status: z.enum(TICKET_STATUS_VALUES).optional(),
    priority: z.enum(TICKET_PRIORITY_VALUES).optional(),
    category: z.enum(TICKET_CATEGORY_VALUES).optional(),
    categorySource: z.enum(TICKET_SOURCE_VALUES).optional(),
    prioritySource: z.enum(TICKET_SOURCE_VALUES).optional(),
    assignedTo: z.string().optional().nullable(),
    aiMeta: z
      .object({
        reason: z.string().nullable().optional(),
        aiFailed: z.boolean().optional(),
      })
      .optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided to update',
  });

// ─── Add Internal Note (admin) ────────────────────────────────────────────────
const addInternalNoteSchema = z.object({
  body: z.string().trim().min(1, 'Note body is required'),
});

// ─── Add Response (author or admin) ──────────────────────────────────────────
const addResponseSchema = z.object({
  body: z.string().trim().min(1, 'Response body is required'),
});

module.exports = {
  createTicketSchema,
  updateTicketSchema,
  addInternalNoteSchema,
  addResponseSchema,
};
