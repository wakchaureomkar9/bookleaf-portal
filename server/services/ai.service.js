const { z } = require('zod');
const {
  TICKET_CATEGORY_VALUES,
  TICKET_PRIORITY_VALUES,
  TICKET_CATEGORIES,
  TICKET_PRIORITIES,
  TICKET_SOURCES,
} = require('../constants/ticketEnums');
const { getContext } = require('./knowledge.service');

// Zod schema to validate whatever Gemini returns for classification
const aiResponseSchema = z.object({
  category: z.enum(TICKET_CATEGORY_VALUES),
  priority: z.enum(TICKET_PRIORITY_VALUES),
});

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const RETRY_DELAYS_MS = [1000, 2000];

/**
 * Execute a single generateContent call against Gemini with a 10s timeout.
 */
const sendGeminiRequest = async (model, prompt, generationConfig = {}) => {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);

  try {
    return await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          maxOutputTokens: 1024,
          ...generationConfig,
        },
      }),
    });
  } finally {
    clearTimeout(timer);
  }
};

/**
 * Parse the raw text from a successful Gemini response.
 */
const extractRawContent = async (res) => {
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Gemini API ${res.status}: ${errText}`);
  }
  const json = await res.json();
  const text = json?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
  if (!text) throw new Error('Empty response from Gemini');
  return text;
};

/**
 * Shared helper to call Gemini with 10s per-request timeout,
 * retries on 503 / 429 (1s, 2s delays), and fallback model support.
 *
 * @param {string} prompt - Prompt string
 * @param {Object} generationConfig - Gemini generationConfig (temperature, responseMimeType, etc.)
 * @returns {Promise<string>} Raw output text
 */
const callGemini = async (prompt, generationConfig = {}) => {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY not set');
  }

  const primaryModel = process.env.GEMINI_MODEL;
  const fallbackModel = process.env.GEMINI_FALLBACK_MODEL;

  if (!primaryModel) {
    throw new Error('GEMINI_MODEL not set');
  }

  let raw = null;
  let lastError = null;

  // 1. Try primary model with up to 2 retries for 503 or 429 (delays: 1s, 2s)
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    try {
      const res = await sendGeminiRequest(primaryModel, prompt, generationConfig);

      if (res.status === 503 || res.status === 429) {
        const errText = await res.text().catch(() => '');
        lastError = new Error(`Gemini API ${res.status}: ${errText}`);
        if (attempt < RETRY_DELAYS_MS.length) {
          await sleep(RETRY_DELAYS_MS[attempt]);
          continue;
        }
        break;
      }

      raw = await extractRawContent(res);
      lastError = null;
      break;
    } catch (err) {
      lastError = err;
      // Network/abort/parse errors: do not retry in this loop
      break;
    }
  }

  // 2. If primary still fails and fallback model is configured, try once with backup model
  if (!raw && fallbackModel) {
    try {
      const res = await sendGeminiRequest(fallbackModel, prompt, generationConfig);
      raw = await extractRawContent(res);
      lastError = null;
    } catch (err) {
      lastError = err;
    }
  }

  if (!raw) {
    throw lastError || new Error('Empty response from Gemini');
  }

  return raw;
};

/**
 * Ask Google Gemini to classify a support ticket's category and priority.
 *
 * @param {Object} param0
 * @param {string} param0.subject
 * @param {string} param0.description
 */
const classifyTicket = async ({ subject, description }) => {
  const fallback = {
    category: TICKET_CATEGORIES.GENERAL,
    priority: TICKET_PRIORITIES.MEDIUM,
    categorySource: TICKET_SOURCES.AI,
    prioritySource: TICKET_SOURCES.AI,
    aiMeta: { reason: null, aiFailed: true },
  };

  if (!process.env.GEMINI_API_KEY) {
    fallback.aiMeta.reason = 'GEMINI_API_KEY not set';
    return fallback;
  }

  if (!process.env.GEMINI_MODEL) {
    fallback.aiMeta.reason = 'GEMINI_MODEL not set';
    return fallback;
  }

  const prompt = `You are a support ticket classifier for a book publishing platform called BookLeaf.

Classify the following support ticket into exactly one category and one priority.

Categories (use the exact string):
${TICKET_CATEGORY_VALUES.map((c) => `- "${c}"`).join('\n')}

Priorities (use the exact string):
${TICKET_PRIORITY_VALUES.map((p) => `- "${p}"`).join('\n')}

Priority guide:
- Critical: blocks publishing or causes financial loss
- High: significant impact, needs same-day attention
- Medium: moderate issue, can wait a few days
- Low: minor or informational

Ticket subject: ${subject}
Ticket description: ${description}

Return a JSON object with exactly two keys: "category" and "priority".`;

  try {
    const raw = await callGemini(prompt, {
      responseMimeType: 'application/json',
      maxOutputTokens: 128,
      temperature: 0,
    });

    const parsed = JSON.parse(raw);
    const validated = aiResponseSchema.parse(parsed);

    return {
      category: validated.category,
      priority: validated.priority,
      categorySource: TICKET_SOURCES.AI,
      prioritySource: TICKET_SOURCES.AI,
      aiMeta: { reason: raw, aiFailed: false },
    };
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[ai.service] classifyTicket failed:', err.message);
    }
    fallback.aiMeta.reason = err.message;
    return fallback;
  }
};

/**
 * Build prompt for draftReply based on system instructions, knowledgebase context,
 * book details, ticket info, and last 5 thread responses (excluding internal notes).
 */
const buildDraftPrompt = (ticket, book, author) => {
  const firstName = author?.name ? author.name.trim().split(/\s+/)[0] : 'Author';
  const knowledgeContext = getContext(ticket.category);

  let bookInfo = 'No book is linked to this ticket.';
  if (ticket.bookId && book) {
    bookInfo = [
      `Title: ${book.title || 'N/A'}`,
      `Status: ${book.status || 'N/A'}`,
      `MRP: ${book.mrp != null ? `₹${book.mrp}` : 'N/A'}`,
      `Copies Sold: ${book.totalCopiesSold ?? 0}`,
      `Total Royalty Earned: ₹${book.totalRoyaltyEarned ?? 0}`,
      `Royalty Paid: ₹${book.royaltyPaid ?? 0}`,
      `Royalty Pending: ₹${book.royaltyPending ?? 0}`,
      `Last Payout Date: ${book.lastRoyaltyPayoutDate ? new Date(book.lastRoyaltyPayoutDate).toISOString().split('T')[0] : 'None'}`,
      `Print Partner: ${book.printPartner || 'N/A'}`,
    ].join('\n');
  }

  // Last 5 thread messages, excluding internal notes
  const threadMessages = (ticket.responses || []).slice(-5);
  const threadText =
    threadMessages.length > 0
      ? threadMessages
          .map((r) => `[${r.role === 'author' ? 'Author' : 'Support'}]: ${r.body}`)
          .join('\n')
      : 'No previous thread messages.';

  return `System Instruction:
You are a BookLeaf support representative replying to an author.
Follow these communication guidelines strictly:
- Acknowledge the author's concern first.
- Address the author using their first name: "${firstName}".
- Use real numbers and dates from the provided book data.
- Own BookLeaf mistakes directly without corporate deflection or excuses.
- Give a clear timeline for any actions, resolutions, reprints, or investigations.
- End with a clear next step for the author or BookLeaf team.
- Never invent facts, dates, or numbers outside the provided context and book record.
- Do not claim any action has already been taken or is in progress (such as a team reviewing, checking with a bank, or escalating) unless it appears in the ticket or book data. Say what the team WILL do, with the timeline, instead. Do not make personal promises like 'I will personally monitor'. Only state facts that appear in the knowledge base or book data.
- Do not use placeholders (such as [Date], [Number], [Name], etc.). Write the final text directly.
- Sign off with:
BookLeaf Support Team
- Write in plain text only (no markdown, no asterisks, no bullet symbols).

---
Knowledge Base Context:
${knowledgeContext}

---
Book Record:
${bookInfo}

---
Ticket Details:
Subject: ${ticket.subject}
Description: ${ticket.description}

---
Recent Thread Messages (last 5):
${threadText}

---
Draft your reply now as plain text:`;
};

/**
 * Generate an AI draft reply for a support ticket.
 *
 * @param {Object} ticket - Mongoose Ticket document
 * @param {Object|null} book - Mongoose Book document if linked
 * @param {Object|null} author - User document for author
 * @returns {Promise<{ draft: string|null, aiFailed: boolean }>}
 */
const draftReply = async (ticket, book, author) => {
  try {
    const prompt = buildDraftPrompt(ticket, book, author);
    const draft = await callGemini(prompt, {
      temperature: 0.3,
      maxOutputTokens: 1024,
    });
    return { draft, aiFailed: false };
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[ai.service] draftReply failed:', err.message);
    }
    return { draft: null, aiFailed: true };
  }
};

module.exports = {
  classifyTicket,
  draftReply,
  callGemini,
};
