const mongoose = require('mongoose');
require('dotenv').config();

/**
 * Connects to MongoDB using the MONGO_URI from environment variables.
 *
 * We export a function (not a side-effect import) so that the seed script
 * and the server can both connect independently without coupling their
 * startup order.
 */
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      // These options suppress deprecation warnings in Mongoose 7+.
      // Mongoose 8 sets them by default, kept here for clarity.
    });
    console.log(`✅ MongoDB connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`❌ MongoDB connection failed: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
