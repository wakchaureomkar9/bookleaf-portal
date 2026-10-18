# BookLeaf Author Support & Communication Portal

A two-portal web app (author and admin) where authors raise support tickets and the BookLeaf team handles them with AI help: automatic category and priority, plus an editable AI-drafted reply grounded in the BookLeaf Knowledge Base. Replies and status changes appear live, with no page refresh.

## Live demo

- **App:** https://bookleaf-portal-seven.vercel.app
- **API health:** https://bookleaf-api-pynd.onrender.com/api/health
- The API runs on a free tier and sleeps when idle. The first request can take about a minute. Open the health URL first, then log in.

| Role | Email | Password |
|---|---|---|
| Admin | admin@bookleaf.com | `<ADMIN_PASSWORD>` |
| Author | priya.sharma@email.com | `<AUTHOR_PASSWORD>` |
| Author | rohit.kapoor@email.com | `<AUTHOR_PASSWORD>` |

All 10 seeded authors (see `server/seed/data/FULLSTACK-SAMPLEDATA.json`) share the author password.

## Tech stack

- **Frontend:** React (Vite), React Router, plain CSS
- **Backend:** Node.js, Express, Mongoose, Zod, JWT, bcrypt, helmet, cors, express-rate-limit
- **Database:** MongoDB (Atlas)
- **AI:** Google Gemini (Flash models) over REST
- **Real time:** Server-Sent Events (SSE)
- **Hosting:** Vercel (client), Render (API), MongoDB Atlas (database)

## Run locally

Requires Node 18+ and a running MongoDB (or an Atlas URI).

```bash
# API
cd server
npm install
cp .env.example .env      # fill in every value
npm run seed              # loads 10 authors, 18 books, 1 admin
npm run dev               # http://localhost:5000

# Client (second terminal)
cd client
npm install
cp .env.example .env      # VITE_API_URL=http://localhost:5000/api
npm run dev               # http://localhost:5173
```

The server refuses to start if a required variable is missing. The seed has no hardcoded fallbacks and is blocked when `NODE_ENV=production` unless `ALLOW_SEED=true` is set on purpose.

### Environment variables (server)

| Variable | Purpose |
|---|---|
| `PORT`, `NODE_ENV` | Port and environment |
| `MONGO_URI` | MongoDB connection string |
| `JWT_SECRET`, `JWT_EXPIRES_IN` | Token signing and lifetime |
| `CORS_ORIGIN` | Allowed frontend origin (comma-separated list allowed) |
| `GEMINI_API_KEY` | Gemini key (server-side only, never sent to the browser) |
| `GEMINI_MODEL`, `GEMINI_FALLBACK_MODEL` | Primary and backup model names |
| `ADMIN_EMAIL`, `ADMIN_NAME`, `ADMIN_PASSWORD`, `SEED_AUTHOR_PASSWORD` | Used by the seed script only |
| `ALLOW_SEED` | Set to `true` only to seed a production database deliberately |

## Architecture

```
React (Vercel)  --REST + SSE-->  Express API (Render)  -->  MongoDB Atlas
                                      |
                                      +--> Gemini API (classification, draft replies)
```

Backend layers keep each concern in one place:

- **routes** map URLs to middleware and controllers
- **middleware** handle auth (JWT), roles, Zod validation and central error handling
- **controllers** handle HTTP in and out, plus ownership checks
- **services** hold business logic and all database access (`ticket`, `book`, `user`, `auth`, `ai`, `knowledge`, `sse`)
- **constants** hold shared enums (roles, categories, priorities, statuses)

Key decisions:

- **Services own the data access.** The same ticket logic serves REST, SSE events and AI calls.
- **Auth re-reads the user on each request.** A deleted account stops working immediately. The cost is one extra query per request.
- **Role and ownership checks happen on the server.** Authors only receive their own books and tickets, and `internalNotes` are stripped from every author response.
- **SSE instead of WebSockets.** Updates only flow server to client, SSE is plain HTTP and reconnects automatically. `EventSource` cannot send headers, so the stream route accepts the JWT as `?token=` and verifies it itself.
- **Embedded messages.** Responses and internal notes live inside the ticket document and are added with `$push`, so concurrent replies don't overwrite each other.
- **Human-readable IDs.** Books keep `bookId` (`BK001`) and users keep `authorId` (`AUTH001`) from the dataset.
- **Source flags.** `categorySource` and `prioritySource` record whether AI or an admin set a value, and the UI shows an "AI" or "Edited" tag.

## AI integration

**Model choice.** Gemini Flash models. The brief allows any LLM. Flash is fast and inexpensive, supports JSON output mode, and has a free tier, which suited a development budget of zero. For production I would move to a paid tier with data-use terms suitable for real author data.

**Classification (on ticket creation).** The ticket subject and description go to the model with a strict instruction to return JSON `{ category, priority }`. The reply is validated with Zod against the exact enum values. The AI result sets the ticket's category and priority, and an admin can override both from the ticket page.

**Draft replies (admin).** `POST /api/tickets/:id/draft` builds a prompt from:

1. A system instruction (BookLeaf support representative, acknowledge the concern first, use real numbers from the book record, own BookLeaf mistakes, give a clear timeline, end with a next step, never invent facts, no placeholders, sign off as "BookLeaf Support Team").
2. The knowledge-base section for the ticket's category, the communication tone guidelines, and the matching example only.
3. The linked book's record (status, MRP, copies sold, royalty earned, paid and pending, last payout date, print partner), if the ticket has one.
4. The last 5 thread messages plus the ticket text. Internal notes are never included.

Temperature is 0.3. The admin edits the draft before sending, and only the sent message is visible to the author.

**Cost control.**

- Only the relevant knowledge-base section is sent, never the whole file.
- Only the last 5 messages are sent, not the full history.
- Drafts are cached on the ticket (`aiDraft`). A new AI call happens only on `?refresh=true` or after the author replies.
- Short prompts, low temperature and compact JSON output keep tokens low.

**Failure handling.**

- Each call has a timeout and retries on 429 and 503 with backoff, then tries the fallback model.
- If everything fails, ticket creation still succeeds with defaults (General Inquiry, Medium) and `aiMeta.aiFailed = true`.
- The draft endpoint returns 200 with `aiFailed: true`, and the UI tells the admin to write the reply manually.
- API keys exist only in server environment variables.

## API

All responses use `{ success, data }` or `{ success: false, message, errors }`. Protected routes need `Authorization: Bearer <token>`.

| Method | Path | Access | Purpose |
|---|---|---|---|
| POST | `/api/auth/login` | public (rate limited) | Log in, returns JWT and user |
| GET | `/api/auth/me` | any | Current user |
| GET | `/api/users/me` | any | Own profile |
| GET | `/api/users`, `/api/users/:id` | admin | List or read users |
| GET | `/api/books` | any | Own books (author) or all books (admin) |
| GET | `/api/books/:id` | any | Book detail (author: own only) |
| PATCH | `/api/books/:id` | admin | Update book fields |
| POST | `/api/tickets` | author | Create ticket (`subject`, `description`, optional `bookId`); AI sets category and priority |
| GET | `/api/tickets` | any | Authors: own tickets. Admins: all, with filters `status`, `priority`, `category`, `from`, `to`, `assignedTo=me` |
| GET | `/api/tickets/:id` | any | Ticket detail (author: own only, no internal notes) |
| PATCH | `/api/tickets/:id` | admin | Update status, priority, category, `assignedTo` (`"me"` supported) |
| POST | `/api/tickets/:id/responses` | any | Reply (author: own ticket only) |
| POST | `/api/tickets/:id/notes` | admin | Add internal note |
| POST | `/api/tickets/:id/draft` | admin | Get or generate the AI draft (`?refresh=true` to regenerate) |
| GET | `/api/tickets/stream?token=` | any | SSE stream: `ticket:response`, `ticket:updated` |
| GET | `/api/health` | public | Health check |

Admin queue order is unresolved first, then priority (Critical to Low), then oldest first.

**Error codes:** 400 validation, 401 unauthenticated, 403 forbidden, 404 not found, 409 duplicate, 422 model validation, 429 rate limit, 500 unexpected.

## Testing

`server/tests/smoke.test.js` is an end-to-end script that runs against a running API (`npm test` in `server/`). It covers login and roles, data isolation between authors, internal-note privacy, AI classification and drafts, draft caching, queue filters and sort, assign-to-me, SSE delivery and isolation, and login rate limiting. It creates tickets, so re-seed a shared database afterwards.

## Known limitations

- SSE clients and the rate limiter are stored in memory, so this works for a single server process. Scaling out needs Redis pub/sub and a Redis rate-limit store.
- JWTs cannot be revoked before they expire (a token version field would fix that).
- No pagination on ticket lists yet.
- File attachment in the ticket form is UI only, as the brief allows.
- Ticket text is rendered as plain text, but there is no server-side HTML sanitising.
- Only an end-to-end smoke test exists. There are no unit tests.
- On the free hosting tier the API sleeps when idle, so the first request is slow.
- Classification quality has been checked on sample queries only, not on a labelled test set.
