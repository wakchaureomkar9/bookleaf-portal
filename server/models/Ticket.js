const mongoose = require('mongoose');
const {
  TICKET_CATEGORY_VALUES,
  TICKET_PRIORITY_VALUES,
  TICKET_PRIORITIES,
  TICKET_STATUS_VALUES,
  TICKET_STATUSES,
  TICKET_SOURCE_VALUES,
  TICKET_SOURCES,
} = require('../constants/ticketEnums');

// ─── Sub-document schemas ─────────────────────────────────────────────────────

/**
 * internalNotes: visible to admins only.
 * Stored as an embedded array rather than a separate collection to keep
 * all ticket data in a single document read.
 */
const internalNoteSchema = new mongoose.Schema(
  {
    body: { type: String, required: true },
    // ObjectId ref so we can populate the admin's name on read
    addedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

/**
 * responses: the conversation thread between author and support.
 * role tells the UI whether to align the bubble left (author) or right (admin).
 */
const responseSchema = new mongoose.Schema(
  {
    body: { type: String, required: true },
    sentBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    role: { type: String, enum: ['author', 'admin'], required: true },
  },
  { timestamps: true }
);

/**
 * aiMeta: reserved for the AI triage pipeline.
 *
 * aiFailed = true when the AI pipeline ran but could not produce a usable
 * result (e.g. LLM timeout), so a human admin should review category/priority.
 * reason stores the AI's explanation or the failure message.
 */
const aiMetaSchema = new mongoose.Schema(
  {
    reason: { type: String, default: null },
    aiFailed: { type: Boolean, default: false },
  },
  { _id: false } // no extra _id on this embedded sub-doc
);

/**
 * aiDraft: AI draft reply generated for admin assistance.
 */
const aiDraftSchema = new mongoose.Schema(
  {
    text: { type: String, default: null },
    generatedAt: { type: Date, default: null },
    aiFailed: { type: Boolean, default: false },
  },
  { _id: false }
);

// ─── Main Ticket schema ───────────────────────────────────────────────────────
const ticketSchema = new mongoose.Schema(
  {
    // Author who raised the ticket
    authorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    // Optional: ticket may or may not relate to a specific book
    bookId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Book',
      default: null,
    },
    subject: {
      type: String,
      required: [true, 'Subject is required'],
      trim: true,
      maxlength: 200,
    },
    description: {
      type: String,
      required: [true, 'Description is required'],
      trim: true,
    },
    category: {
      type: String,
      enum: TICKET_CATEGORY_VALUES,
      required: true,
    },
    priority: {
      type: String,
      enum: TICKET_PRIORITY_VALUES,
      default: TICKET_PRIORITIES.MEDIUM,
    },

    // ─── Source tracking ──────────────────────────────────────────────────────
    // categorySource / prioritySource record whether the AI or an admin last
    // set these fields. This lets the UI flag AI-set values for human review.
    categorySource: {
      type: String,
      enum: TICKET_SOURCE_VALUES,
      default: TICKET_SOURCES.AI,
    },
    prioritySource: {
      type: String,
      enum: TICKET_SOURCE_VALUES,
      default: TICKET_SOURCES.AI,
    },

    // ─── AI metadata ─────────────────────────────────────────────────────────
    aiMeta: {
      type: aiMetaSchema,
      default: () => ({ reason: null, aiFailed: false }),
    },

    status: {
      type: String,
      enum: TICKET_STATUS_VALUES,
      default: TICKET_STATUSES.OPEN,
    },
    // Admin user assigned to handle this ticket; null = unassigned
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },

    aiDraft: {
      type: aiDraftSchema,
      default: null,
    },

    internalNotes: [internalNoteSchema],
    responses: [responseSchema],
  },
  { timestamps: true }
);

// Compound index: quickly list all tickets for an author sorted by recency
ticketSchema.index({ authorId: 1, createdAt: -1 });
// Quickly filter the admin queue by status
ticketSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('Ticket', ticketSchema);
