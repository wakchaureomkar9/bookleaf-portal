/**
 * SSE (Server-Sent Events) service.
 *
 * Maintains an in-memory map of connected clients so other parts of the app
 * can push events without knowing about HTTP response objects.
 *
 * Structure:
 *   clients = Map<userId:string, Set<res>>
 *
 * Why a Set per user?  The same user may open multiple browser tabs, each
 * holding its own SSE connection.  A Set lets us fan-out to all of them.
 *
 * Why in-memory?  This is a single-process Node server.  For multi-process /
 * multi-server deployments, replace this with Redis pub/sub.
 */

const clients = new Map(); // userId (string) → Set of SSE response objects

/**
 * Register a new SSE client connection.
 * @param {string} userId - stringified MongoDB ObjectId
 * @param {object} res    - Express response object (kept open for SSE)
 */
const addClient = (userId, res) => {
  if (!clients.has(userId)) clients.set(userId, new Set());
  clients.get(userId).add(res);
};

/**
 * Remove a client when their connection closes.
 */
const removeClient = (userId, res) => {
  const userSet = clients.get(userId);
  if (!userSet) return;
  userSet.delete(res);
  if (userSet.size === 0) clients.delete(userId);
};

/**
 * Send an SSE event to a specific user (all their open connections).
 * @param {string} userId
 * @param {string} event  - SSE event name
 * @param {object} data   - will be JSON-serialised
 */
const sendToUser = (userId, event, data) => {
  const userSet = clients.get(userId.toString());
  if (!userSet) return;
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of userSet) {
    res.write(payload);
  }
};

/**
 * Send an SSE event to every connected admin.
 * We iterate all clients and send to those whose stored role is 'admin'.
 * Role is stashed on the res object by the stream controller (res._userRole).
 */
const sendToAllAdmins = (event, data) => {
  for (const [, userSet] of clients) {
    for (const res of userSet) {
      if (res._userRole === 'admin') {
        res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      }
    }
  }
};

module.exports = { addClient, removeClient, sendToUser, sendToAllAdmins };
