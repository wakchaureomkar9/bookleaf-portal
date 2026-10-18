const mongoose = require('mongoose');

/**
 * Book schema.
 *
 * bookId and authorId are plain strings (e.g. "BK001", "AUTH001") — not
 * ObjectIds — because the seed JSON uses these human-readable keys and the
 * frontend will display/filter by them. We store them as strings and create
 * indexes for lookup performance.
 *
 * Financial fields (royalty*) default to 0 rather than null so arithmetic
 * never needs a null-guard on the frontend.
 *
 * mrp, authorRoyaltyPerCopy, publicationDate, lastRoyaltyPayoutDate,
 * printPartner are nullable because some books are still In Production.
 */
const bookSchema = new mongoose.Schema(
  {
    bookId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    // String reference to User.authorId (not ObjectId) for easy JSON-level joins
    authorId: {
      type: String,
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    isbn: {
      type: String,
      trim: true,
    },
    genre: {
      type: String,
      trim: true,
    },
    // null when book is still in production
    publicationDate: {
      type: Date,
      default: null,
    },
    status: {
      type: String,
      trim: true,
    },
    // null for books not yet priced
    mrp: {
      type: Number,
      default: null,
    },
    // null for books not yet contracted
    authorRoyaltyPerCopy: {
      type: Number,
      default: null,
    },
    totalCopiesSold: {
      type: Number,
      default: 0,
    },
    totalRoyaltyEarned: {
      type: Number,
      default: 0,
    },
    royaltyPaid: {
      type: Number,
      default: 0,
    },
    royaltyPending: {
      type: Number,
      default: 0,
    },
    // null when no payout has ever been made
    lastRoyaltyPayoutDate: {
      type: Date,
      default: null,
    },
    // null for in-production books not yet assigned to a print partner
    printPartner: {
      type: String,
      default: null,
    },
    availableOn: {
      type: [String],
      default: [],
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Book', bookSchema);
