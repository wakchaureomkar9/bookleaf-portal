const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const ticketController = require('../controllers/ticket.controller');
const authMiddleware = require('../middleware/auth.middleware');
const requireRole = require('../middleware/role.middleware');
const validate = require('../middleware/validate.middleware');
const {
  createTicketSchema,
  updateTicketSchema,
  addInternalNoteSchema,
  addResponseSchema,
} = require('../validators/ticket.schema');
const { ROLES } = require('../constants/roles');
const sseService = require('../services/sse.service');

// ─── SSE Stream ───────────────────────────────────────────────────────────────
/**
 * GET /api/tickets/stream?token=<jwt>
 *
 * EventSource (browser API) cannot set custom headers, so the JWT is accepted
 * as a query param on this route only. We verify it manually here.
 *
 * IMPORTANT: registered BEFORE router.use(authMiddleware) so the header-based
 * auth check doesn't run on this route (EventSource sends no Authorization header).
 * Also registered before /:id so Express doesn't treat "stream" as an ObjectId.
 */
router.get('/stream', async (req, res) => {
  let user;
  try {
    const decoded = jwt.verify(req.query.token, process.env.JWT_SECRET);
    user = await User.findById(decoded.id);
    if (!user) throw new Error('User not found');
  } catch {
    return res.status(401).json({ success: false, message: 'Invalid or missing token' });
  }

  // Upgrade to SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // disable Nginx buffering if proxied
  res.flushHeaders();

  // Stash role so sseService.sendToAllAdmins can identify admin connections
  res._userRole = user.role;

  const userId = user._id.toString();
  sseService.addClient(userId, res);

  // Send an initial 'connected' event so the client knows the stream is live
  res.write(`event: connected\ndata: ${JSON.stringify({ userId })}\n\n`);

  // Heartbeat every 25s — keeps connections alive through proxies/LBs
  const heartbeat = setInterval(() => {
    res.write(': heartbeat\n\n');
  }, 25000);

  req.on('close', () => {
    clearInterval(heartbeat);
    sseService.removeClient(userId, res);
  });
});

// All routes below this line require a valid Bearer JWT
router.use(authMiddleware);

// ─── Collection routes ────────────────────────────────────────────────────────
// POST /api/tickets       — author creates ticket
router.post('/', requireRole(ROLES.AUTHOR), validate(createTicketSchema), ticketController.createTicket);

// GET  /api/tickets       — both roles (scoped in controller)
router.get('/', ticketController.getTickets);

// ─── Single ticket routes ─────────────────────────────────────────────────────
// GET  /api/tickets/:id   — both roles (ownership enforced in controller)
router.get('/:id', ticketController.getTicketById);

// PATCH /api/tickets/:id  — admin only
router.patch(
  '/:id',
  requireRole(ROLES.ADMIN),
  validate(updateTicketSchema),
  ticketController.updateTicket
);

// POST /api/tickets/:id/notes    — admin only (internal notes)
router.post(
  '/:id/notes',
  requireRole(ROLES.ADMIN),
  validate(addInternalNoteSchema),
  ticketController.addInternalNote
);

// POST /api/tickets/:id/responses — both roles can reply
router.post(
  '/:id/responses',
  validate(addResponseSchema),
  ticketController.addResponse
);

// POST /api/tickets/:id/draft     — admin only (generate or retrieve AI draft reply)
router.post(
  '/:id/draft',
  requireRole(ROLES.ADMIN),
  ticketController.generateDraft
);

module.exports = router;
