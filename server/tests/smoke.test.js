/**
 * smoke.test.js — end-to-end smoke tests for the BookLeaf API.
 *
 * Runs against the live running API at http://localhost:5000 using only
 * Node's built-in fetch. No new dependencies.
 *
 * Reads ADMIN_EMAIL, ADMIN_PASSWORD, SEED_AUTHOR_PASSWORD from server/.env.
 * Reads author emails and book IDs from server/seed/data/FULLSTACK-SAMPLEDATA.json.
 * Never prints passwords, tokens, or API keys.
 */

'use strict';

const path = require('path');
const fs = require('fs');

// ─── Load .env manually (no external dependency) ─────────────────────────────
const envPath = path.resolve(__dirname, '../.env');
if (!fs.existsSync(envPath)) {
  console.error('❌ server/.env not found');
  process.exit(1);
}

const envLines = fs.readFileSync(envPath, 'utf8').split('\n');
for (const line of envLines) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const eq = trimmed.indexOf('=');
  if (eq === -1) continue;
  const key = trimmed.slice(0, eq).trim();
  const val = trimmed.slice(eq + 1).trim();
  if (!(key in process.env)) process.env[key] = val;
}

const BASE = 'http://localhost:5000';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_PASS = process.env.ADMIN_PASSWORD;
const AUTHOR_PASS = process.env.SEED_AUTHOR_PASSWORD;

if (!ADMIN_EMAIL || !ADMIN_PASS || !AUTHOR_PASS) {
  console.error('❌ ADMIN_EMAIL, ADMIN_PASSWORD, or SEED_AUTHOR_PASSWORD not set in .env');
  process.exit(1);
}

// ─── Load author emails and books from sample data ───────────────────────────
const sampleDataPath = path.resolve(__dirname, '../seed/data/FULLSTACK-SAMPLEDATA.json');
const sampleData = JSON.parse(fs.readFileSync(sampleDataPath, 'utf8'));

const AUTHOR1_EMAIL = sampleData.authors[0].email.toLowerCase().trim();
const AUTHOR1_BOOK_ID = sampleData.authors[0].books[0].book_id;
const AUTHOR1_BOOK_COUNT = sampleData.authors[0].books.length;
const AUTHOR1_BOOK_IDS = sampleData.authors[0].books.map((b) => b.book_id);

const AUTHOR2_EMAIL = sampleData.authors[1].email.toLowerCase().trim();
const TOTAL_BOOKS = sampleData.authors.reduce((acc, a) => acc + a.books.length, 0);

// ─── Fetch helpers ────────────────────────────────────────────────────────────
const api = (endpoint, opts = {}) =>
  fetch(`${BASE}${endpoint}`, {
    headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
    ...opts,
  });

const authed = (token, opts = {}) => ({
  ...opts,
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
    ...(opts.headers || {}),
  },
});

const post = (endpoint, body, token) =>
  api(endpoint, {
    method: 'POST',
    body: JSON.stringify(body),
    ...(token ? authed(token) : {}),
  });

const patch = (endpoint, body, token) =>
  api(endpoint, {
    method: 'PATCH',
    body: JSON.stringify(body),
    ...(token ? authed(token) : {}),
  });

const get = (endpoint, token) =>
  api(endpoint, token ? authed(token) : {});

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ─── Result tracking ──────────────────────────────────────────────────────────
let passed = 0;
let failed = 0;

const PASS = (label, status) => {
  const statusStr = status !== undefined ? ` (${status})` : '';
  console.log(`  ✅ PASS  ${label}${statusStr}`);
  passed++;
};

const FAIL = (label, status, detail) => {
  const statusStr = status !== undefined ? ` (got ${status})` : '';
  console.log(`  ❌ FAIL  ${label}${statusStr}  →  ${detail || ''}`);
  failed++;
};

const expect = (label, cond, status, detail) =>
  cond ? PASS(label, status) : FAIL(label, status, detail);

// ─── State shared across checks ───────────────────────────────────────────────
let adminToken, author1Token, author2Token;
let adminId;
let ticket1Id, ticket2Id;
let ticket1Category, ticket1Priority;

// ─────────────────────────────────────────────────────────────────────────────
// CHECK 1 — Health 200, Login works, /auth/me, Author GET /users 403
// ─────────────────────────────────────────────────────────────────────────────
async function check1() {
  console.log('\n[Check 1] Health, Logins, /auth/me, and User RBAC');

  // Health
  const rHealth = await get('/api/health');
  expect('GET /api/health returns 200', rHealth.status === 200, rHealth.status);

  // Admin login
  const rAdmin = await post('/api/auth/login', { email: ADMIN_EMAIL, password: ADMIN_PASS });
  const bAdmin = await rAdmin.json();
  expect('Admin login succeeds', rAdmin.status === 200 && !!bAdmin?.data?.token, rAdmin.status);
  adminToken = bAdmin?.data?.token;
  adminId = bAdmin?.data?.user?._id;

  // Author 1 login
  const rAuth1 = await post('/api/auth/login', { email: AUTHOR1_EMAIL, password: AUTHOR_PASS });
  const bAuth1 = await rAuth1.json();
  expect('Author 1 login succeeds', rAuth1.status === 200 && !!bAuth1?.data?.token, rAuth1.status);
  author1Token = bAuth1?.data?.token;

  // Author 2 login
  const rAuth2 = await post('/api/auth/login', { email: AUTHOR2_EMAIL, password: AUTHOR_PASS });
  const bAuth2 = await rAuth2.json();
  expect('Author 2 login succeeds', rAuth2.status === 200 && !!bAuth2?.data?.token, rAuth2.status);
  author2Token = bAuth2?.data?.token;

  // Wrong password returns 401
  const rWrong = await post('/api/auth/login', { email: ADMIN_EMAIL, password: 'invalid-password-123' });
  expect('Wrong password returns 401', rWrong.status === 401, rWrong.status);

  // /auth/me with token returns 200
  const rMeAuthed = await get('/api/auth/me', adminToken);
  expect('/auth/me with token returns 200', rMeAuthed.status === 200, rMeAuthed.status);

  // /auth/me without token returns 401
  const rMeUnauthed = await get('/api/auth/me');
  expect('/auth/me without token returns 401', rMeUnauthed.status === 401, rMeUnauthed.status);

  // Author GET /api/users returns 403
  const rUsers = await get('/api/users', author1Token);
  expect('Author GET /users returns 403', rUsers.status === 403, rUsers.status);
}

// ─────────────────────────────────────────────────────────────────────────────
// CHECK 2 — Author GET /books returns only their books; admin gets 18
// ─────────────────────────────────────────────────────────────────────────────
async function check2() {
  console.log('\n[Check 2] Book Scoping');

  // Author GET /books
  const rAuthorBooks = await get('/api/books', author1Token);
  const bAuthorBooks = await rAuthorBooks.json();
  const returnedBooks = bAuthorBooks?.data?.books || [];
  const onlyOwn =
    returnedBooks.length === AUTHOR1_BOOK_COUNT &&
    returnedBooks.every((b) => AUTHOR1_BOOK_IDS.includes(b.bookId));

  expect(
    `Author GET /books returns only own books (${AUTHOR1_BOOK_COUNT})`,
    rAuthorBooks.status === 200 && onlyOwn,
    rAuthorBooks.status,
    `returned ${returnedBooks.length} books`
  );

  // Admin GET /books
  const rAdminBooks = await get('/api/books', adminToken);
  const bAdminBooks = await rAdminBooks.json();
  const adminBookCount = (bAdminBooks?.data?.books || []).length;
  expect(
    `Admin GET /books returns all ${TOTAL_BOOKS} books`,
    rAdminBooks.status === 200 && adminBookCount === TOTAL_BOOKS,
    rAdminBooks.status,
    `returned ${adminBookCount} books`
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CHECK 3 — Author creates ticket with bookId; create second with no bookId
// ─────────────────────────────────────────────────────────────────────────────
async function check3() {
  console.log('\n[Check 3] Ticket Creation (AI Category & Priority)');

  // Ticket 1: with bookId of author's own book
  const rTicket1 = await post(
    '/api/tickets',
    {
      subject: 'Royalty payment query for BK001',
      description: 'I noticed my Q3 payout has not arrived yet. Could you check the ledger?',
      bookId: AUTHOR1_BOOK_ID,
    },
    author1Token
  );
  const bTicket1 = await rTicket1.json();
  const t1 = bTicket1?.data?.ticket;
  ticket1Id = t1?._id;
  ticket1Category = t1?.category;
  ticket1Priority = t1?.priority;

  const t1Valid =
    rTicket1.status === 201 &&
    !!ticket1Id &&
    typeof t1.category === 'string' &&
    typeof t1.priority === 'string' &&
    t1.categorySource === 'ai';

  expect(
    'Author creates ticket with bookId (201, category, priority, categorySource "ai")',
    t1Valid,
    rTicket1.status,
    `id=${ticket1Id}, category=${t1?.category}, priority=${t1?.priority}, source=${t1?.categorySource}`
  );

  // Ticket 2: with NO bookId
  const rTicket2 = await post(
    '/api/tickets',
    {
      subject: 'General inquiry about platform guidelines',
      description: 'Where can I find the updated guidelines for international author distributions?',
    },
    author1Token
  );
  const bTicket2 = await rTicket2.json();
  const t2 = bTicket2?.data?.ticket;
  ticket2Id = t2?._id;

  expect(
    'Author creates second ticket with no bookId (201)',
    rTicket2.status === 201 && !!ticket2Id,
    rTicket2.status
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CHECK 4 — Internal note with SECRETWORD, visibility, Author 2 403/404
// ─────────────────────────────────────────────────────────────────────────────
async function check4() {
  console.log('\n[Check 4] Internal Notes Visibility & Cross-Author Isolation');

  // Admin adds internal note containing SECRETWORD
  const rNote = await post(
    `/api/tickets/${ticket1Id}/notes`,
    { body: 'Internal admin audit note: check SECRETWORD compliance in ledger.' },
    adminToken
  );
  expect('Admin adds internal note with SECRETWORD', rNote.status === 200 || rNote.status === 201, rNote.status);

  // Author 1 GET ticket: internalNotes must NOT be present
  const rAuth1Get = await get(`/api/tickets/${ticket1Id}`, author1Token);
  const bAuth1Get = await rAuth1Get.json();
  const authorTicket = bAuth1Get?.data?.ticket || {};
  const hasNoNotes = !('internalNotes' in authorTicket) || authorTicket.internalNotes === undefined;
  expect(
    'Author GET ticket has no internalNotes',
    rAuth1Get.status === 200 && hasNoNotes,
    rAuth1Get.status
  );

  // Admin GET ticket: internalNotes must be present and contain SECRETWORD
  const rAdminGet = await get(`/api/tickets/${ticket1Id}`, adminToken);
  const bAdminGet = await rAdminGet.json();
  const adminTicket = bAdminGet?.data?.ticket || {};
  const notes = adminTicket.internalNotes || [];
  const hasSecretWord = notes.some((n) => typeof n.body === 'string' && n.body.includes('SECRETWORD'));
  expect(
    'Admin GET ticket contains internalNotes with SECRETWORD',
    rAdminGet.status === 200 && hasSecretWord,
    rAdminGet.status
  );

  // Author 2 GET ticket: returns 403 or 404
  const rAuth2Get = await get(`/api/tickets/${ticket1Id}`, author2Token);
  expect(
    'Author 2 GET ticket returns 403 or 404',
    rAuth2Get.status === 403 || rAuth2Get.status === 404,
    rAuth2Get.status
  );

  // Author 2 POST reply to ticket: returns 403 or 404
  const rAuth2Reply = await post(
    `/api/tickets/${ticket1Id}/responses`,
    { body: 'Attempting unauthorized cross-author response' },
    author2Token
  );
  expect(
    'Author 2 reply to ticket returns 403 or 404',
    rAuth2Reply.status === 403 || rAuth2Reply.status === 404,
    rAuth2Reply.status
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CHECK 5 — Admin POST /tickets/:id/draft: expect 200 and text or aiFailed
// ─────────────────────────────────────────────────────────────────────────────
let firstDraftGeneratedAt = null;

async function check5() {
  console.log('\n[Check 5] Admin AI Draft Generation');

  const rDraft = await post(`/api/tickets/${ticket1Id}/draft`, {}, adminToken);
  const bDraft = await rDraft.json();
  const aiDraft = bDraft?.data?.aiDraft || {};
  firstDraftGeneratedAt = aiDraft.generatedAt;

  const isOkStatus = rDraft.status === 200;
  const hasTextOrFailed = typeof aiDraft.text === 'string' || aiDraft.aiFailed === true;

  expect(
    'Admin POST /tickets/:id/draft returns 200 with text or aiFailed: true',
    isOkStatus && hasTextOrFailed,
    rDraft.status,
    `aiFailed=${aiDraft.aiFailed}`
  );

  if (typeof aiDraft.text === 'string' && aiDraft.text.trim()) {
    console.log(`  ℹ️  Report: Draft text generated successfully (aiFailed: ${aiDraft.aiFailed})`);

    const draftText = aiDraft.text;
    const forbidden = ['SECRETWORD', '[', 'null', 'NaN', 'undefined'];
    const foundForbidden = forbidden.filter((f) => draftText.includes(f));

    expect(
      'Draft does not contain SECRETWORD, "[", "null", "NaN", or "undefined"',
      foundForbidden.length === 0,
      rDraft.status,
      foundForbidden.length > 0 ? `found forbidden tokens: ${foundForbidden.join(', ')}` : ''
    );

    console.log('\n--- AI DRAFT TEXT START ---');
    console.log(draftText);
    console.log('--- AI DRAFT TEXT END ---\n');
  } else {
    console.log(`  ℹ️  Report: aiFailed is true (${aiDraft.reason || 'AI unavailable / key not configured'})`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CHECK 6 — Draft cache, ?refresh=true, and regeneration on author reply
// ─────────────────────────────────────────────────────────────────────────────
async function check6() {
  console.log('\n[Check 6] Draft Caching, Refresh Query, and Author Reply Invalidation');

  // 1. Call draft again without refresh: expect same generatedAt (cached)
  const rCached = await post(`/api/tickets/${ticket1Id}/draft`, {}, adminToken);
  const bCached = await rCached.json();
  const cachedGenAt = bCached?.data?.aiDraft?.generatedAt;
  expect(
    'Subsequent draft call returns cached generatedAt',
    rCached.status === 200 && cachedGenAt === firstDraftGeneratedAt,
    rCached.status
  );

  // 2. Call draft with ?refresh=true: expect new generatedAt
  await sleep(100);
  const rRefresh = await post(`/api/tickets/${ticket1Id}/draft?refresh=true`, {}, adminToken);
  const bRefresh = await rRefresh.json();
  const refreshedGenAt = bRefresh?.data?.aiDraft?.generatedAt;
  expect(
    'Draft call with ?refresh=true produces new generatedAt',
    rRefresh.status === 200 && refreshedGenAt !== firstDraftGeneratedAt,
    rRefresh.status
  );

  // 3. Author posts a reply
  await sleep(100);
  const rAuthorReply = await post(
    `/api/tickets/${ticket1Id}/responses`,
    { body: 'Author followup: here is my linked bank account statement.' },
    author1Token
  );
  expect(
    'Author posts a reply to the thread',
    rAuthorReply.status === 200 || rAuthorReply.status === 201,
    rAuthorReply.status
  );

  // 4. Next draft call after author reply: expect new generatedAt
  await sleep(100);
  const rPostReplyDraft = await post(`/api/tickets/${ticket1Id}/draft`, {}, adminToken);
  const bPostReplyDraft = await rPostReplyDraft.json();
  const postReplyGenAt = bPostReplyDraft?.data?.aiDraft?.generatedAt;
  expect(
    'Draft call after author reply invalidates cache and produces new generatedAt',
    rPostReplyDraft.status === 200 && postReplyGenAt !== refreshedGenAt,
    rPostReplyDraft.status
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CHECK 7 — Author POST /draft returns 403
// ─────────────────────────────────────────────────────────────────────────────
async function check7() {
  console.log('\n[Check 7] Author Access to Draft Endpoint');

  const rAuthorDraft = await post(`/api/tickets/${ticket1Id}/draft`, {}, author1Token);
  expect('Author POST /tickets/:id/draft returns 403', rAuthorDraft.status === 403, rAuthorDraft.status);
}

// ─────────────────────────────────────────────────────────────────────────────
// CHECK 8 — Admin filters: category, priority, status, from/to, combined
// ─────────────────────────────────────────────────────────────────────────────
async function check8() {
  console.log('\n[Check 8] Admin Ticket Queue Filtering');

  // Filter by category
  const cat = ticket1Category || 'General Inquiry';
  const rCat = await get(`/api/tickets?category=${encodeURIComponent(cat)}`, adminToken);
  const bCat = await rCat.json();
  const catTickets = bCat?.data?.tickets || [];
  const catMatch = catTickets.length > 0 && catTickets.every((t) => t.category === cat);
  expect(
    `Filter ?category=${cat} returns only matching tickets`,
    rCat.status === 200 && catMatch,
    rCat.status,
    `matched ${catTickets.length}`
  );

  // Filter by priority
  const prio = ticket1Priority || 'Medium';
  const rPrio = await get(`/api/tickets?priority=${prio}`, adminToken);
  const bPrio = await rPrio.json();
  const prioTickets = bPrio?.data?.tickets || [];
  const prioMatch = prioTickets.length > 0 && prioTickets.every((t) => t.priority === prio);
  expect(
    `Filter ?priority=${prio} returns only matching tickets`,
    rPrio.status === 200 && prioMatch,
    rPrio.status,
    `matched ${prioTickets.length}`
  );

  // Filter by status
  const stat = 'Open';
  const rStat = await get(`/api/tickets?status=${stat}`, adminToken);
  const bStat = await rStat.json();
  const statTickets = bStat?.data?.tickets || [];
  const statMatch = statTickets.length > 0 && statTickets.every((t) => t.status === stat);
  expect(
    'Filter ?status= returns only matching tickets',
    rStat.status === 200 && statMatch,
    rStat.status,
    `matched ${statTickets.length}`
  );

  // Filter by date range
  const from = '2020-01-01';
  const to = '2030-01-01';
  const rDate = await get(`/api/tickets?from=${from}&to=${to}`, adminToken);
  const bDate = await rDate.json();
  const dateTickets = bDate?.data?.tickets || [];
  const dateMatch =
    dateTickets.length > 0 &&
    dateTickets.every(
      (t) =>
        new Date(t.createdAt) >= new Date(from) && new Date(t.createdAt) <= new Date('2030-01-02')
    );
  expect(
    'Filter ?from=&to= returns only tickets in date range',
    rDate.status === 200 && dateMatch,
    rDate.status,
    `matched ${dateTickets.length}`
  );

  // Combined filter: status + priority
  const rComb = await get(`/api/tickets?status=${stat}&priority=${prio}`, adminToken);
  const bComb = await rComb.json();
  const combTickets = bComb?.data?.tickets || [];
  const combMatch =
    combTickets.length > 0 &&
    combTickets.every((t) => t.status === stat && t.priority === prio);
  expect(
    'Combined filter (?status=&priority=) works',
    rComb.status === 200 && combMatch,
    rComb.status,
    `matched ${combTickets.length}`
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CHECK 9 — Default sort: unresolved before resolved, priority, oldest first
// ─────────────────────────────────────────────────────────────────────────────
async function check9() {
  console.log('\n[Check 9] Admin Default Sort Order');

  // Set ticket 2 to Resolved so we have a resolved ticket in the list
  const rPatchResolved = await patch(
    `/api/tickets/${ticket2Id}`,
    { status: 'Resolved' },
    adminToken
  );
  expect(
    'Set ticket2 to Resolved for sort verification',
    rPatchResolved.status === 200,
    rPatchResolved.status
  );

  // Fetch admin tickets with default sort
  const rSort = await get('/api/tickets', adminToken);
  const bSort = await rSort.json();
  const tickets = bSort?.data?.tickets || [];

  const STATUS_RANK = { 'Open': 0, 'In Progress': 0, 'Resolved': 1, 'Closed': 1 };
  const PRIO_RANK = { 'Critical': 0, 'High': 1, 'Medium': 2, 'Low': 3 };

  let sortValid = tickets.length >= 2;
  for (let i = 0; i < tickets.length - 1; i++) {
    const a = tickets[i];
    const b = tickets[i + 1];

    const sA = STATUS_RANK[a.status] ?? 2;
    const sB = STATUS_RANK[b.status] ?? 2;

    if (sA !== sB) {
      if (sA > sB) { sortValid = false; break; }
      continue;
    }

    const pA = PRIO_RANK[a.priority] ?? 4;
    const pB = PRIO_RANK[b.priority] ?? 4;

    if (pA !== pB) {
      if (pA > pB) { sortValid = false; break; }
      continue;
    }

    const tA = new Date(a.createdAt).getTime();
    const tB = new Date(b.createdAt).getTime();
    if (tA > tB) { sortValid = false; break; }
  }

  // Confirm resolved ticket appears in the resolved section (after all unresolved)
  const resolvedIndex = tickets.findIndex((t) => t._id.toString() === ticket2Id.toString());
  const anyUnresolvedAfter = tickets
    .slice(resolvedIndex + 1)
    .some((t) => t.status === 'Open' || t.status === 'In Progress');

  expect(
    'Default sort: unresolved first, priority Critical>High>Medium>Low, oldest first',
    rSort.status === 200 && sortValid && !anyUnresolvedAfter,
    rSort.status,
    `resolved ticket at index ${resolvedIndex} of ${tickets.length}`
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CHECK 10 — PATCH assignedTo "me", ?assignedTo=me, Author PATCH returns 403
// ─────────────────────────────────────────────────────────────────────────────
async function check10() {
  console.log('\n[Check 10] Ticket Assignment ("me") and RBAC');

  // Admin PATCH assignedTo "me"
  const rAssign = await patch(`/api/tickets/${ticket1Id}`, { assignedTo: 'me' }, adminToken);
  const bAssign = await rAssign.json();
  const assigned = bAssign?.data?.ticket?.assignedTo;
  const assignedIdStr = typeof assigned === 'object' && assigned ? assigned._id?.toString() : assigned?.toString();

  expect(
    'PATCH assignedTo "me" returns current admin ID',
    rAssign.status === 200 && assignedIdStr === adminId.toString(),
    rAssign.status,
    `assignedTo=${assignedIdStr}`
  );

  // Admin GET ?assignedTo=me lists this ticket
  const rMyAssigned = await get('/api/tickets?assignedTo=me', adminToken);
  const bMyAssigned = await rMyAssigned.json();
  const myTickets = bMyAssigned?.data?.tickets || [];
  const foundInAssigned = myTickets.some((t) => t._id.toString() === ticket1Id.toString());
  expect(
    'GET /api/tickets?assignedTo=me lists the assigned ticket',
    rMyAssigned.status === 200 && foundInAssigned,
    rMyAssigned.status
  );

  // Author PATCH /api/tickets/:id returns 403
  const rAuthorPatch = await patch(`/api/tickets/${ticket1Id}`, { status: 'Closed' }, author1Token);
  expect('Author PATCH /api/tickets/:id returns 403', rAuthorPatch.status === 403, rAuthorPatch.status);
}

// ─────────────────────────────────────────────────────────────────────────────
// CHECK 11 — SSE Stream: author 1 receives events, author 2 doesn't, no token 401
// ─────────────────────────────────────────────────────────────────────────────
async function check11() {
  console.log('\n[Check 11] SSE Live Updates Stream');

  // No token returns 401
  const rNoToken = await get('/api/tickets/stream');
  expect('GET /api/tickets/stream without token returns 401', rNoToken.status === 401, rNoToken.status);
  try { await rNoToken.body?.cancel(); } catch (_) {}

  // Helper to collect SSE events
  const collectEvents = (token, timeoutMs) => {
    return new Promise((resolve) => {
      const url = `${BASE}/api/tickets/stream?token=${token}`;
      const received = {};
      let settled = false;

      const finish = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(received);
      };

      const timer = setTimeout(finish, timeoutMs);

      fetch(url).then(async (res) => {
        if (!res.ok) { finish(); return; }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = '';

        const parseFrame = (frame) => {
          let eventName = 'message';
          for (const line of frame.split('\n')) {
            if (line.startsWith('event:')) eventName = line.slice(6).trim();
            if (line.startsWith('data:')) {
              const data = line.slice(5).trim();
              if (!received[eventName]) received[eventName] = [];
              received[eventName].push(data);
              if (received['ticket:response'] && received['ticket:updated']) finish();
            }
          }
        };

        try {
          while (!settled) {
            const { done, value } = await Promise.race([
              reader.read(),
              new Promise((r) => setTimeout(() => r({ done: true }), timeoutMs + 500)),
            ]);
            if (done) break;
            buf += decoder.decode(value, { stream: true });
            const frames = buf.split('\n\n');
            buf = frames.pop();
            for (const f of frames) {
              if (f.trim()) parseFrame(f);
            }
          }
        } catch (_) {}
        finish();
      }).catch(finish);
    });
  };

  const WAIT_MS = 4000;
  const [a1Events, a2Events] = await Promise.all([
    collectEvents(author1Token, WAIT_MS),
    collectEvents(author2Token, WAIT_MS),
    (async () => {
      await sleep(600); // Wait for streams to establish

      // Admin replies to ticket 1
      await post(
        `/api/tickets/${ticket1Id}/responses`,
        { body: 'Admin SSE live update test reply' },
        adminToken
      );

      // Admin patches ticket 1 status
      await patch(
        `/api/tickets/${ticket1Id}`,
        { status: 'In Progress' },
        adminToken
      );
    })(),
  ]);

  expect(
    'Author 1 stream receives "ticket:response" within 3s',
    !!a1Events['ticket:response'],
    200
  );
  expect(
    'Author 1 stream receives "ticket:updated" within 3s',
    !!a1Events['ticket:updated'],
    200
  );
  expect(
    'Author 2 stream does NOT receive "ticket:response"',
    !a2Events['ticket:response'],
    200
  );
  expect(
    'Author 2 stream does NOT receive "ticket:updated"',
    !a2Events['ticket:updated'],
    200
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CHECK 12 — Rate Limiting on Login (run last)
// ─────────────────────────────────────────────────────────────────────────────
async function check12() {
  console.log('\n[Check 12] Rate Limiting on /api/auth/login (Run Last)');

  let lastStatus = null;
  for (let i = 1; i <= 11; i++) {
    const r = await post('/api/auth/login', {
      email: ADMIN_EMAIL,
      password: `wrong-password-attempt-${i}`,
    });
    lastStatus = r.status;
    try { await r.json(); } catch (_) {}
    if (lastStatus === 429) {
      console.log(`  ℹ️  Rate limit triggered on attempt #${i}`);
      break;
    }
  }

  expect('11th wrong-password login returns 429', lastStatus === 429, lastStatus);
}

// ─────────────────────────────────────────────────────────────────────────────
// Runner
// ─────────────────────────────────────────────────────────────────────────────
(async () => {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  BookLeaf API — Full Smoke Tests');
  console.log(`  Base URL : ${BASE}`);
  console.log(`  Admin    : ${ADMIN_EMAIL}`);
  console.log(`  Author 1 : ${AUTHOR1_EMAIL}`);
  console.log(`  Author 2 : ${AUTHOR2_EMAIL}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  try {
    await check1();
    await check2();
    await check3();
    await check4();
    await check5();
    await check6();
    await check7();
    await check8();
    await check9();
    await check10();
    await check11();
    await check12();
  } catch (err) {
    console.error('\n💥 Unexpected test suite failure:', err);
    process.exit(1);
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`  Final Results: ${passed} passed, ${failed} failed`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  if (failed > 0) process.exit(1);
})();
