# BookLeaf Author Support Portal: Approach Write-Up

## What I prioritised

The brief weights AI integration and architecture highest, so I built the core ticket loop first and made it correct: login, own-data-only access, ticket creation, admin reply, live update. I then added the AI features on top of that foundation, so a failing AI call could never break a ticket.

1. **Safe data access.** Roles are enforced on the server, authors only see their own books and tickets, and internal notes never reach an author response.
2. **AI that degrades gracefully.** If classification or drafting fails, the ticket still saves with defaults and the admin writes the reply by hand.
3. **Grounded drafts.** Replies use the ticket, the author's real book numbers and the matching knowledge-base section, so they carry actual figures and dates instead of generic reassurance.
4. **An admin workflow that fits the job.** The queue is sorted unresolved first, then by priority, then oldest first. It can be filtered by status, priority, category and date. Admins can override the AI category and priority, assign tickets to themselves, and keep private notes.

## Trade-offs

- **SSE over WebSockets.** Updates only flow from server to client. SSE is simpler and reconnects by itself, at the cost of passing the token in the URL for the stream.
- **In-memory SSE registry and rate limiter.** This is fine for one process, but would need Redis to scale.
- **Embedded replies and notes.** One document read per ticket and atomic `$push` writes, but unbounded growth on very long threads.
- **Gemini free tier.** Zero cost during development, with rate limits and overload spikes. I added retries and a fallback model to absorb them.
- **Smoke test instead of unit tests.** One end-to-end script covers the risky behaviours (privacy, roles, SSE) in the time available, but isolated logic is not unit tested.
- **Plain CSS and no UI library.** Fewer dependencies and a clean interface, with less polish than a design system.

## Cost awareness

Only the relevant knowledge-base section, the tone guide and one example go into each prompt. Only the last 5 messages are sent. Drafts are cached on the ticket and regenerated only on request or after the author replies.

## How I would evolve it into production

- **Scale and reliability:** Redis for SSE fan-out and rate limiting, a job queue for AI calls with retries, and pagination or cursors on ticket lists.
- **AI quality:** a labelled set of real tickets to measure classification accuracy, prompt versioning, and a feedback signal (was the draft sent as written, edited, or discarded?) to improve prompts.
- **Knowledge base:** move from a static file to a managed, versioned store, with retrieval when the content outgrows a few sections.
- **Security:** token revocation or short-lived tokens with refresh, HTML sanitising on output, audit logs for admin actions, and a paid AI tier with suitable data-use terms.
- **Product:** real file attachments, email notifications for new replies, SLA timers on Critical and High tickets, canned responses, and royalty-breakdown data pulled directly into drafts.
- **Quality:** unit and integration tests in CI, error monitoring, and a staging environment.
