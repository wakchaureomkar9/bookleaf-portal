const ticketService = require('../services/ticket.service');
const bookService = require('../services/book.service');
const { ROLES } = require('../constants/roles');

/**
 * POST /api/tickets
 * Author: create a new support ticket.
 * Body validated by createTicketSchema before reaching here.
 */
const createTicket = async (req, res, next) => {
  try {
    const data = { ...req.body };

    // Resolve the string bookId (e.g. "BK001") to a MongoDB ObjectId if provided.
    // This keeps the API consumer-friendly (they send readable IDs, not ObjectIds).
    if (data.bookId) {
      const book = await bookService.getBookByBookId(data.bookId);

      // Ensure the author can only link their own books
      if (req.user.role === ROLES.AUTHOR && book.authorId !== req.user.authorId) {
        return res.status(403).json({ success: false, message: 'You do not own this book' });
      }

      data.bookId = book._id; // replace string with ObjectId
    }

    const ticket = await ticketService.createTicket(data, req.user._id);
    res.status(201).json({ success: true, data: { ticket } });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/tickets
 * Authors see their own; admins see all.
 * Optional query params: ?status= ?priority= ?category= ?from= ?to= ?assignedTo=
 */
const getTickets = async (req, res, next) => {
  try {
    const isAuthor = req.user.role === ROLES.AUTHOR;
    const authorId = isAuthor ? req.user._id : null;
    const { status, priority, category, from, to, assignedTo } = req.query;

    const tickets = await ticketService.getTickets({
      authorId,
      status,
      priority,
      category,
      from,
      to,
      assignedTo,
      currentUserId: req.user._id,
      stripNotes: isAuthor, // authors must not see internal notes
    });
    res.status(200).json({ success: true, data: { tickets } });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/tickets/:id
 * Authors can only view their own tickets; admins can view any.
 */
const getTicketById = async (req, res, next) => {
  try {
    const isAuthor = req.user.role === ROLES.AUTHOR;
    const authorId = isAuthor ? req.user._id : null;
    const ticket = await ticketService.getTicketById(req.params.id, authorId, isAuthor);
    res.status(200).json({ success: true, data: { ticket } });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/tickets/:id
 * Admin only. Update status, priority, category, assignedTo, aiMeta.
 * Body validated by updateTicketSchema.
 * Supports assignedTo: "me" → current admin id.
 */
const updateTicket = async (req, res, next) => {
  try {
    // Fetch current status so the service can detect a real change before emitting SSE
    const existing = await ticketService.getTicketById(req.params.id);
    const ticket = await ticketService.updateTicket(
      req.params.id,
      req.body,
      existing.status,
      req.user._id
    );
    res.status(200).json({ success: true, data: { ticket } });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/tickets/:id/notes
 * Admin only. Add an internal note (not visible to authors).
 * Body validated by addInternalNoteSchema.
 */
const addInternalNote = async (req, res, next) => {
  try {
    const ticket = await ticketService.addInternalNote(
      req.params.id,
      req.body.body,
      req.user._id
    );
    res.status(200).json({ success: true, data: { ticket } });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/tickets/:id/responses
 * Author or admin: add a reply to the ticket thread.
 * Body validated by addResponseSchema.
 *
 * For authors: verify the ticket exists first, then check ownership.
 * This lets us return a clear 403 instead of a misleading 404 when the
 * ticket exists but belongs to someone else.
 */
const addResponse = async (req, res, next) => {
  try {
    const isAuthor = req.user.role === ROLES.AUTHOR;

    if (isAuthor) {
      // Check the ticket exists before the ownership check to give a meaningful error
      const existing = await ticketService.getTicketById(req.params.id);
      if (existing.authorId._id.toString() !== req.user._id.toString()) {
        return res.status(403).json({ success: false, message: 'You can only reply to your own tickets' });
      }
    }

    // For authors authorId scopes the DB update as a second safety net
    const authorId = isAuthor ? req.user._id : null;
    const ticket = await ticketService.addResponse(
      req.params.id,
      req.body.body,
      req.user._id,
      req.user.role,
      authorId
    );
    res.status(200).json({ success: true, data: { ticket } });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/tickets/:id/draft
 * Admin only. Generates or retrieves stored AI draft reply.
 * Always responds with HTTP 200.
 */
const generateDraft = async (req, res, next) => {
  try {
    const refresh = req.query.refresh === 'true';
    const aiDraft = await ticketService.generateDraft(req.params.id, refresh);
    res.status(200).json({
      success: true,
      data: {
        aiDraft,
        draft: aiDraft.text,
      },
    });
  } catch (error) {
    next(error);
  }
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
