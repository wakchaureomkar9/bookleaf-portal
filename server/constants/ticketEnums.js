/**
 * All enum values for the Ticket model.
 *
 * Kept in one file so that:
 *  - Mongoose schemas, Zod validators, and seed scripts all import from here.
 *  - Adding a new category/status only requires one change.
 */

// ─── Categories ───────────────────────────────────────────────────────────────
const TICKET_CATEGORIES = Object.freeze({
  ROYALTY_PAYMENTS: 'Royalty & Payments',
  ISBN_METADATA: 'ISBN & Metadata Issues',
  PRINTING_QUALITY: 'Printing & Quality',
  DISTRIBUTION: 'Distribution & Availability',
  BOOK_STATUS: 'Book Status & Production Updates',
  GENERAL: 'General Inquiry',
});

const TICKET_CATEGORY_VALUES = Object.values(TICKET_CATEGORIES);

// ─── Priorities ───────────────────────────────────────────────────────────────
// Ordered high → low intentionally; Critical reserved for urgent/SLA breaches.
const TICKET_PRIORITIES = Object.freeze({
  CRITICAL: 'Critical',
  HIGH: 'High',
  MEDIUM: 'Medium',
  LOW: 'Low',
});

const TICKET_PRIORITY_VALUES = Object.values(TICKET_PRIORITIES);

// ─── Statuses ─────────────────────────────────────────────────────────────────
const TICKET_STATUSES = Object.freeze({
  OPEN: 'Open',
  IN_PROGRESS: 'In Progress',
  RESOLVED: 'Resolved',
  CLOSED: 'Closed',
});

const TICKET_STATUS_VALUES = Object.values(TICKET_STATUSES);

// ─── Source (who/what set category or priority) ───────────────────────────────
// 'ai'    → inferred by the AI pipeline (default for new tickets)
// 'admin' → manually overridden by a support agent
const TICKET_SOURCES = Object.freeze({
  AI: 'ai',
  ADMIN: 'admin',
});

const TICKET_SOURCE_VALUES = Object.values(TICKET_SOURCES);

module.exports = {
  TICKET_CATEGORIES,
  TICKET_CATEGORY_VALUES,
  TICKET_PRIORITIES,
  TICKET_PRIORITY_VALUES,
  TICKET_STATUSES,
  TICKET_STATUS_VALUES,
  TICKET_SOURCES,
  TICKET_SOURCE_VALUES,
};
