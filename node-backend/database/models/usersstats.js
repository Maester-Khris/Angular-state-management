const mongoose = require('mongoose');

const UserStatsSummarySchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', unique: true, index: true },
  totalPosts: { type: Number, default: 0 },
  totalCoAuthored: { type: Number, default: 0 },
  totalReach: { type: Number, default: 0 }, // Lifetime views
  totalShares: { type: Number, default: 0 },
  lastUpdated: { type: Date, default: Date.now }
});

const UserStatsSummary = mongoose.model('UserStatsSummary', UserStatsSummarySchema);