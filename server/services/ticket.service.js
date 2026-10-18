const Ticket = require('../models/Ticket');
const { TICKET_SOURCES } = require('../constants/ticketEnums');
const { classifyTicket, draftReply } = require('./ai.service');
const sseService = require('./sse.service');

/**
 * Create a new ticket.
 *
 * Runs AI classification first; on failure the fallback from ai.service
 * supplies safe defaults so this never blocks ticket creation.
 *
 * @param {Object} data   - validated ticket fields (may include category/priority from client)
 * @param {string} userId - author's MongoDB ObjectId (req.user._id)
 */
const createTicket = async (data, userId) => {
  // Run AI classification; merges category, priority, categorySource, prioritySource, aiMeta
  const aiResult = await classifyTicket({
    subject: data.subject,
    description: data.description,
  });

  // AI result always wins on a new ticket — admin can override later via PATCH
  const ticket = await Ticket.create({
    ...data,
    authorId: userId,
    category: aiResult.category,
    priority: aiResult.priority,
    categorySource: aiResult.categorySource,
    prioritySource: aiResult.prioritySource,
    aiMeta: aiResult.aiMeta,
  });
  return ticket;
};

/**
 * Get tickets.
 *  - Authors see only their own tickets (filtered by authorId).
 *  - Admins see all tickets; can filter by status, priority, category, from/to date, and assignedTo.
 *
 * Default sort for admins:
 *  1. Status: Open/In Progress first, then others
 *  2. Priority: Critical > High > Medium > Low
 *  3. Oldest first (createdAt asc)
 */
const getTickets = async ({
  authorId = null,
  status = null,
  priority = null,
  category = null,
  from = null,
  to = null,
  assignedTo = null,
  currentUserId = null,
  stripNotes = false,
} = {}) => {
  const filter = {};
  if (authorId) filter.authorId = authorId;
  if (status) filter.status = status;
  if (priority) filter.priority = priority;
  if (category) filter.category = category;

  if (from || to) {
    filter.createdAt = {};
    if (from) filter.createdAt.$gte = new Date(from);
    if (to) {
      const toDate = new Date(to);
      if (typeof to === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(to.trim())) {
        toDate.setUTCHours(23, 59, 59, 999);
      }
      filter.createdAt.$lte = toDate;
    }
  }

  if (assignedTo === 'me' && currentUserId) {
    filter.assignedTo = currentUserId;
  } else if (assignedTo) {
    filter.assignedTo = assignedTo;
  }

  let tickets = await Ticket.find(filter)
    .populate('authorId', 'name email authorId')
    .populate('bookId', 'title bookId')
    .populate('assignedTo', 'name email');

  if (!authorId) {
    // Admin queue default sort:
    // 1. Open/In Progress first
    // 2. Priority: Critical > High > Medium > Low
    // 3. Oldest first (createdAt asc)
    const STATUS_ORDER = {
      'Open': 0,
      'In Progress': 0,
      'Resolved': 1,
      'Closed': 2,
    };
    const PRIORITY_ORDER = {
      'Critical': 0,
      'High': 1,
      'Medium': 2,
      'Low': 3,
    };

    tickets.sort((a, b) => {
      const statusA = STATUS_ORDER[a.status] ?? 3;
      const statusB = STATUS_ORDER[b.status] ?? 3;
      if (statusA !== statusB) return statusA - statusB;

      const prioA = PRIORITY_ORDER[a.priority] ?? 4;
      const prioB = PRIORITY_ORDER[b.priority] ?? 4;
      if (prioA !== prioB) return prioA - prioB;

      return new Date(a.createdAt) - new Date(b.createdAt);
    });
  } else {
    // Author view: newest first
    tickets.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  if (!stripNotes) return tickets;

  // Convert to plain objects and drop internalNotes before sending to authors
  return tickets.map((t) => {
    const obj = t.toObject ? t.toObject() : { ...t };
    delete obj.internalNotes;
    return obj;
  });
};

/**
 * Get a single ticket by its MongoDB ObjectId, with all relations populated.
 * Throws 404 if not found.
 *
 * @param {string}  id         - MongoDB ObjectId string
 * @param {string|null} authorId   - if provided, enforces that the ticket belongs to this author
 * @param {boolean} stripNotes - omit internalNotes from the result (for authors)
 */
const getTicketById = async (id, authorId = null, stripNotes = false) => {
  const filter = { _id: id };
  if (authorId) filter.authorId = authorId; // scoped access for authors

  const ticket = await Ticket.findOne(filter)
    .populate('authorId', 'name email authorId')
    .populate('bookId', 'title bookId')
    .populate('assignedTo', 'name email')
    .populate('internalNotes.addedBy', 'name email')
    .populate('responses.sentBy', 'name email');

  if (!ticket) {
    const err = new Error('Ticket not found');
    err.statusCode = 404;
    throw err;
  }

  if (!stripNotes) return ticket;

  const obj = ticket.toObject();
  delete obj.internalNotes;
  return obj;
};

/**
 * Admin: update ticket metadata (status, priority, category, assignedTo, aiMeta).
 * When an admin overrides category or priority, the source fields are
 * automatically set to 'admin' if not explicitly provided.
 * Emits an SSE 'ticket:updated' event when status changes.
 */
const updateTicket = async (id, updates, previousStatus = null, adminId = null) => {
  // Support assignedTo: "me" → current admin id
  if (updates.assignedTo === 'me' && adminId) {
    updates.assignedTo = adminId;
  }

  // Auto-set source to 'admin' when an admin changes category/priority
  if (updates.category && !updates.categorySource) {
    updates.categorySource = TICKET_SOURCES.ADMIN;
  }
  if (updates.priority && !updates.prioritySource) {
    updates.prioritySource = TICKET_SOURCES.ADMIN;
  }

  const ticket = await Ticket.findByIdAndUpdate(id, updates, {
    new: true,
    runValidators: true,
  });
  if (!ticket) {
    const err = new Error('Ticket not found');
    err.statusCode = 404;
    throw err;
  }

  // Only emit when status actually changed to avoid noisy events
  if (updates.status && updates.status !== previousStatus) {
    const payload = { ticketId: ticket._id, status: ticket.status };
    sseService.sendToUser(ticket.authorId.toString(), 'ticket:updated', payload);
    sseService.sendToAllAdmins('ticket:updated', payload);
  }

  return ticket;
};

/**
 * Admin: push a new internal note onto the ticket.
 * Uses $push to avoid a full document re-save and to prevent race conditions.
 *
 * @param {string} ticketId - MongoDB ObjectId
 * @param {string} body     - note content
 * @param {string} adminId  - ObjectId of the admin adding the note
 */
const addInternalNote = async (ticketId, body, adminId) => {
  const ticket = await Ticket.findByIdAndUpdate(
    ticketId,
    { $push: { internalNotes: { body, addedBy: adminId } } },
    { new: true, runValidators: true }
  ).populate('internalNotes.addedBy', 'name email');

  if (!ticket) {
    const err = new Error('Ticket not found');
    err.statusCode = 404;
    throw err;
  }
  return ticket;
};

/**
 * Author or admin: push a reply to the conversation thread.
 * Emits an SSE 'ticket:response' event to the ticket author and all admins.
 *
 * @param {string} ticketId - MongoDB ObjectId
 * @param {string} body     - reply content
 * @param {string} userId   - ObjectId of the sender
 * @param {string} role     - 'author' | 'admin'
 * @param {string|null} authorId - if provided, ensures only the ticket owner can reply
 */
const addResponse = async (ticketId, body, userId, role, authorId = null) => {
  const filter = { _id: ticketId };
  if (authorId) filter.authorId = authorId; // scope author to own tickets

  const ticket = await Ticket.findOneAndUpdate(
    filter,
    { $push: { responses: { body, sentBy: userId, role } } },
    { new: true, runValidators: true }
  ).populate('responses.sentBy', 'name email');

  if (!ticket) {
    // Return 404 for authors (ticket not found or not theirs) — no distinction to prevent probing
    const err = new Error('Ticket not found');
    err.statusCode = 404;
    throw err;
  }

  // Notify the ticket's author and all admin connections
  const payload = { ticketId: ticket._id, role, body };
  sseService.sendToUser(ticket.authorId.toString(), 'ticket:response', payload);
  sseService.sendToAllAdmins('ticket:response', payload);

  return ticket;
};

/**
 * Admin: generate or return cached AI draft reply for a ticket.
 *
 * @param {string} ticketId - MongoDB ObjectId string
 * @param {boolean} refresh - Force regeneration if true
 * @returns {Promise<{ text: string|null, generatedAt: Date, aiFailed: boolean }>}
 */
const generateDraft = async (ticketId, refresh = false) => {
  const ticket = await Ticket.findById(ticketId)
    .populate('authorId')
    .populate('bookId');

  if (!ticket) {
    const err = new Error('Ticket not found');
    err.statusCode = 404;
    throw err;
  }

  // Check if author replied after the draft was generated
  let authorRepliedAfter = false;
  if (ticket.aiDraft?.generatedAt) {
    const draftTime = new Date(ticket.aiDraft.generatedAt).getTime();
    authorRepliedAfter = (ticket.responses || []).some(
      (r) => r.role === 'author' && r.createdAt && new Date(r.createdAt).getTime() > draftTime
    );
  }

  // Return stored draft if one exists, unless ?refresh=true or author replied after generatedAt
  if (ticket.aiDraft?.generatedAt && !refresh && !authorRepliedAfter) {
    return ticket.aiDraft;
  }

  // Generate new draft via ai.service
  const result = await draftReply(ticket, ticket.bookId, ticket.authorId);

  ticket.aiDraft = {
    text: result.draft,
    generatedAt: new Date(),
    aiFailed: result.aiFailed,
  };

  await ticket.save();
  return ticket.aiDraft;
};

module.exports = {
  createTicket,
  getTickets,
  getTicketById,
  updateTicket,
  addInternalNote,
  addResponse,
  generateDraft,
};
