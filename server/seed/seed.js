/**
 * Seed Script — populates MongoDB with author users, books, and an admin user.
 *
 * Usage:
 *   npm run seed
 *   node seed/seed.js
 *
 * Safety guards:
 *  - Blocked when NODE_ENV=production UNLESS ALLOW_SEED=true is also set,
 *    which lets an operator seed a deployed database exactly once on purpose.
 *  - Clears Users, Books, AND Tickets before inserting (idempotent re-runs).
 *  - All credentials are read from .env — no hardcoded fallbacks.
 *
 * Decisions:
 *  - bcrypt work factor = 10 (OWASP recommendation; high enough to be secure,
 *    low enough for the seed to run in reasonable time for 10+ authors).
 *  - authorId is kept as the original string from the JSON (e.g. "AUTH001")
 *    so the human-readable IDs survive across seed runs without collision.
 *  - Passwords are never printed. Only emails are logged.
 */

// ─── Environment — must be first ──────────────────────────────────────────────
// config/env.js loads .env with an absolute path and validates required vars.
require('../config/env');

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const connectDB = require('../config/db');
const User = require('../models/User');
const Book = require('../models/Book');
const Ticket = require('../models/Ticket');

// ─── Production guard ─────────────────────────────────────────────────────────
// Seeding is blocked in production to prevent accidental data loss.
// Set ALLOW_SEED=true alongside NODE_ENV=production only when you need to seed
// a deployed database for the first time, and remove it immediately after.
if (process.env.NODE_ENV === 'production' && process.env.ALLOW_SEED !== 'true') {
  console.error('\n❌ Seed is BLOCKED in production.');
  console.error('   To seed a production database intentionally, set ALLOW_SEED=true.');
  console.error('   Remove ALLOW_SEED immediately after seeding.\n');
  process.exit(1);
}

// ─── Seed-specific required variables ─────────────────────────────────────────
// These are only needed by the seed script, not the server, so they are
// validated here rather than in config/env.js.
const SEED_REQUIRED = ['ADMIN_EMAIL', 'ADMIN_PASSWORD', 'ADMIN_NAME', 'SEED_AUTHOR_PASSWORD'];
const missingSeed = SEED_REQUIRED.filter((key) => !process.env[key]);

if (missingSeed.length > 0) {
  console.error('\n❌ Missing seed environment variable(s):');
  missingSeed.forEach((key) => console.error(`   • ${key}`));
  console.error('\nAdd them to server/.env (see .env.example).\n');
  process.exit(1);
}

// ─── Load seed data ───────────────────────────────────────────────────────────
const sampleData = require('./data/FULLSTACK-SAMPLEDATA.json');

// ─── Constants ────────────────────────────────────────────────────────────────
const BCRYPT_ROUNDS = 10;

/**
 * Convert a JSON date string or null to a JS Date or null.
 * Mongoose stores undefined as 0 on Date fields; null is stored correctly.
 */
const toDate = (val) => (val ? new Date(val) : null);

const seed = async () => {
  await connectDB();

  // Track created emails for the summary — passwords are never printed.
  const createdAuthorEmails = [];

  try {
    console.log('\n🌱 Starting seed...\n');

    // ── Clear existing data ────────────────────────────────────────────────────
    await Promise.all([
      User.deleteMany({}),
      Book.deleteMany({}),
      Ticket.deleteMany({}),
    ]);
    console.log('🗑️  Cleared Users, Books, and Tickets.\n');

    // ── Hash the shared author password once ───────────────────────────────────
    // All authors share one default password set in SEED_AUTHOR_PASSWORD.
    // Hashing once (not per-author) keeps the seed fast.
    const authorPasswordHash = await bcrypt.hash(process.env.SEED_AUTHOR_PASSWORD, BCRYPT_ROUNDS);

    // ── Seed authors and their books ───────────────────────────────────────────
    let totalBooks = 0;

    for (const author of sampleData.authors) {
      const user = await User.create({
        name: author.name,
        email: author.email.toLowerCase().trim(),
        passwordHash: authorPasswordHash,
        role: 'author',
        authorId: author.author_id,
      });

      createdAuthorEmails.push(user.email);
      console.log(`  ✅ Author: ${user.name} <${user.email}> [${user.authorId}]`);

      const bookDocs = author.books.map((b) => ({
        bookId: b.book_id,
        authorId: author.author_id, // string reference, not ObjectId
        title: b.title,
        isbn: b.isbn,
        genre: b.genre,
        publicationDate: toDate(b.publication_date),
        status: b.status,
        mrp: b.mrp ?? null,
        authorRoyaltyPerCopy: b.author_royalty_per_copy ?? null,
        totalCopiesSold: b.total_copies_sold ?? 0,
        totalRoyaltyEarned: b.total_royalty_earned ?? 0,
        royaltyPaid: b.royalty_paid ?? 0,
        royaltyPending: b.royalty_pending ?? 0,
        lastRoyaltyPayoutDate: toDate(b.last_royalty_payout_date),
        printPartner: b.print_partner ?? null,
        availableOn: b.available_on ?? [],
      }));

      await Book.insertMany(bookDocs);
      totalBooks += bookDocs.length;
      console.log(`     📚 ${bookDocs.length} book(s) inserted for ${author.name}`);
    }

    // ── Seed admin user ────────────────────────────────────────────────────────
    const adminEmail = process.env.ADMIN_EMAIL.toLowerCase().trim();
    const adminPasswordHash = await bcrypt.hash(process.env.ADMIN_PASSWORD, BCRYPT_ROUNDS);

    const admin = await User.create({
      name: process.env.ADMIN_NAME,
      email: adminEmail,
      passwordHash: adminPasswordHash,
      role: 'admin',
      authorId: null, // admins have no authorId
    });

    // ── Summary ────────────────────────────────────────────────────────────────
    console.log('\n─────────────────────────────────────────');
    console.log('✨ Seed complete!');
    console.log(`   Authors  : ${sampleData.authors.length}`);
    console.log(`   Books    : ${totalBooks}`);
    console.log(`   Admins   : 1`);
    console.log('\n   Admin account:');
    console.log(`     ${admin.email}`);
    console.log('\n   Author accounts:');
    createdAuthorEmails.forEach((email) => console.log(`     ${email}`));
    console.log('─────────────────────────────────────────\n');
  } catch (error) {
    console.error('❌ Seed failed:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB.');
  }
};

seed();
