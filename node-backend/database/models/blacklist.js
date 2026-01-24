const mongoose = require("mongoose");

const TokenBlacklistSchema = new mongoose.Schema(
  {
    token: { type: String, required: true, unique: true },
  },
  { expiresAt: { type: Date, required: true, index: { expires: 0 } } }
);

TokenBlacklistSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const TokenBlacklist = mongoose.model("TokenBlacklist", TokenBlacklistSchema);
module.exports = TokenBlacklist;
