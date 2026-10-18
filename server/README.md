# BookLeaf Author Portal — API Server

Express + MongoDB REST API for the BookLeaf author support portal.

---

## Quick start

```bash
cd server
cp .env.example .env        # fill in every value — no defaults exist
npm install
npm run seed                # creates authors, books, and the admin account
npm run dev                 # starts with nodemon on PORT (default 5000)
```

---

## Environment variables

### Server (validated at startup — server will not start if missing)

| Variable | Required | Description |
|---|---|---|
| `PORT` | no | HTTP port. Default `5000`. |
| `NODE_ENV` | no | `development` or `production`. |
| `MONGO_URI` | ✅ | MongoDB connection string. |
| `JWT_SECRET` | ✅ | Long random string used to sign JWTs. Generate with `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"` |
| `JWT_EXPIRES_IN` | ✅ | Token lifetime, e.g. `7d` or `24h`. |
| `CORS_ORIGIN` | ✅ | Allowed frontend origin. Use `*` in dev; set exact URL (no trailing slash) in prod. |

### Seed (required only when running `npm run seed`)

| Variable | Required | Description |
|---|---|---|
| `ADMIN_EMAIL` | ✅ | Email for the seeded admin account. |
| `ADMIN_PASSWORD` | ✅ | Password for the seeded admin account. No default. |
| `ADMIN_NAME` | ✅ | Display name for the seeded admin account. |
| `SEED_AUTHOR_PASSWORD` | ✅ | Password assigned to every author account the seed creates. No default. |
| `ALLOW_SEED` | no | Set to `true` to allow seeding when `NODE_ENV=production`. Remove after use. |

### Optional

| Variable | Description |
|---|---|
| `GEMINI_API_KEY` | Enables AI ticket classification via Google Gemini. Tickets are still created with default values (`General Inquiry` / `Medium`) if this is unset. |
| `GEMINI_MODEL` | Primary Gemini model to use for classification. |
| `GEMINI_FALLBACK_MODEL` | Backup Gemini model used if `GEMINI_MODEL` fails after retries. |

---

## API endpoints

### Auth
| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/api/auth/login` | ❌ | Returns JWT. Rate-limited: 10 req / 15 min per IP. |
| `GET` | `/api/auth/me` | ✅ | Current user profile. |

### Users
| Method | Path | Role | Description |
|---|---|---|---|
| `GET` | `/api/users/me` | any | Own profile. |
| `GET` | `/api/users` | admin | All users. |
| `GET` | `/api/users/:id` | admin | User by MongoDB ObjectId. |

### Books
| Method | Path | Role | Description |
|---|---|---|---|
| `GET` | `/api/books` | any | Author: own books. Admin: all books. |
| `GET` | `/api/books/:id` | any | Author: own book only (403 otherwise). |
| `PATCH` | `/api/books/:id` | admin | Update any subset of book fields. |

### Tickets
| Method | Path | Role | Description |
|---|---|---|---|
| `POST` | `/api/tickets` | author | Create a ticket. Category and priority are optional (AI classifies automatically). |
| `GET` | `/api/tickets` | any | Author: own tickets, `internalNotes` stripped. Admin: all tickets. Filters: `?status=&priority=&category=&from=&to=&assignedTo=me`. Default admin sort: Open/In Progress first, priority Critical>High>Medium>Low, oldest first. |
| `GET` | `/api/tickets/:id` | any | Author: own only, `internalNotes` stripped. |
| `PATCH` | `/api/tickets/:id` | admin | Update status, priority, category, `assignedTo` (accepts `"me"` for current admin). |
| `POST` | `/api/tickets/:id/notes` | admin | Add an internal note (never exposed to authors). |
| `POST` | `/api/tickets/:id/responses` | any | Reply to the thread. Authors get 403 on tickets they don't own. |
| `POST` | `/api/tickets/:id/draft` | admin | Generate or retrieve stored AI draft reply. Cached on ticket; bypass with `?refresh=true`. |

### SSE live updates
| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/tickets/stream?token=<jwt>` | query param | Server-Sent Events stream. Token in query param because `EventSource` cannot set headers. |

**Events:**

| Event | Payload | Trigger |
|---|---|---|
| `connected` | `{ userId }` | Immediately on open. |
| `ticket:response` | `{ ticketId, role, body }` | Any reply posted to a thread. |
| `ticket:updated` | `{ ticketId, status }` | Ticket status changes. |
| `: heartbeat` | *(SSE comment)* | Every 25 seconds. |

**Client example:**
```js
const es = new EventSource(`/api/tickets/stream?token=${jwt}`);
es.addEventListener('ticket:response', (e) => {
  const { ticketId, body } = JSON.parse(e.data);
});
es.addEventListener('ticket:updated', (e) => {
  const { ticketId, status } = JSON.parse(e.data);
});
```

---

## AI features & approach

### 1. Automatic classification
When an author creates a ticket, `services/ai.service.js` classifies it into one of six categories and four priorities using **Google Gemini** (`responseMimeType: "application/json"`, temperature 0, 128 tokens).
- Fast and deterministic.
- If `GEMINI_API_KEY` is missing or the call fails, defaults (`General Inquiry` / `Medium`, `aiFailed: true`) are assigned so ticket creation is never blocked.
- Admins can override category/priority at any time via `PATCH /api/tickets/:id`.

### 2. Context-aware draft replies
Admins can generate an AI reply draft via `POST /api/tickets/:id/draft`:
- **Context grounding**: `services/knowledge.service.js` parses `knowledgebase.md` and provides the exact policy for the ticket's category, communication tone guidelines, and relevant sample responses.
- **Data-driven**: Real book data (MRP, copies sold, royalties earned/paid/pending, payout dates, print partner) and the last 5 thread messages are injected into the prompt.
- **Empathetic & strict rules**: Acknowledges author concerns first, uses the author's first name, owns BookLeaf mistakes without corporate deflection, provides concrete timelines, avoids placeholders, and never invents facts outside context.
- **Caching**: The generated draft is saved on the ticket (`aiDraft { text, generatedAt, aiFailed }`). Subsequent calls return the cached draft instantly unless `?refresh=true` is passed or the author has replied since the draft was created.

### 3. AI approach and cost
- **Shared resilient client**: Both classification and drafting share a single Gemini caller with a 10-second per-request timeout, retries on 503/429 (1s and 2s backoff), and an optional `GEMINI_FALLBACK_MODEL`.
- **Minimal token overhead**: Classification consumes ~150–200 input tokens and ~20 output tokens. Drafting uses targeted category-specific knowledge slices rather than the entire knowledge base, keeping input tokens under ~1,200 tokens.
- **Draft caching**: Storing drafts on the ticket document prevents repeated LLM invocations when admins reopen tickets, saving API costs and avoiding latency.
- **Cost estimation**: On Gemini 2.0 Flash / 1.5 Flash, classification costs < $0.00005 per ticket, and draft generation costs < $0.0004 per draft. Free tier covers thousands of requests per month.

---

## Security

| Layer | Detail |
|---|---|
| **helmet** | Sets `X-Frame-Options`, CSP, `X-Content-Type-Options`, and others. |
| **CORS** | Restricted to `CORS_ORIGIN`. |
| **Rate limit** | Login endpoint: 10 requests per 15-minute window per IP. |
| **JWT** | Bearer token. User re-fetched from DB on every request so deleted accounts are rejected immediately. |
| **passwordHash** | `select: false` on the schema — never included in query results by default. |
| **Role guard** | `requireRole()` factory applied per-route. |
| **Note stripping** | `internalNotes` deleted from all author-facing responses in the service layer. |

---

## Seed

```bash
# Normal development seed
npm run seed

# Seed a production database once on purpose (remove ALLOW_SEED after)
ALLOW_SEED=true NODE_ENV=production npm run seed
```

The seed script:
- Is blocked when `NODE_ENV=production` unless `ALLOW_SEED=true` is also set.
- Deletes all existing Users, Books, and Tickets before inserting.
- Creates one User per author from `seed/data/FULLSTACK-SAMPLEDATA.json` with the password in `SEED_AUTHOR_PASSWORD`.
- Creates one admin account using `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAME`.
- Prints all created email addresses at the end. Passwords are never printed.

See the root README.md for demo logins.

---

## Demo logins

See the root README.md for demo logins.

---

## Project structure

```
server/
├── config/
│   ├── db.js            Mongoose connection
│   └── env.js           Dotenv loader + required-var validation (import first)
├── constants/
│   ├── roles.js
│   └── ticketEnums.js
├── controllers/
├── middleware/
├── models/
├── routes/
├── seed/
│   ├── seed.js
│   └── data/FULLSTACK-SAMPLEDATA.json
├── services/
│   ├── ai.service.js    Claude Haiku ticket classification
│   ├── sse.service.js   In-memory SSE client registry
│   └── ...
└── validators/
```
