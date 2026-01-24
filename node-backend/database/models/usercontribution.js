const mongoose = require('mongoose');

const UserContributionSummarySchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  date: { type: Date, required: true }, // Normalized to 00:00:00 of that day
  contributionCount: { type: Number, default: 0 }, // Sum of views/edits/posts for that day
}, { timestamps: true });

// Compound index to make "Get last 365 days for this user" a single index seek
UserContributionSummarySchema.index({ userId: 1, date: -1 });
const UserContributionSummary = mongoose.model('UserContributionSummary', UserContributionSummarySchema);
module.exports = UserContributionSummary;