const PostAnalytics = require("../database/models/postsevent");
const ContributionEvent = require("../database/models/contributionevent");
const UserStatsSummary = require("../database/models/usersstats");
const UserContributionSummary = require("../database/models/usercontribution");

const recordPostEvent = async (postId, userId, eventType) =>{
    // 1. Log to Time-Series (Fire and Forget)
    PostAnalytics.create({
        timestamp: new Date(),
        metadata: {
            postId: postId,
            userId: userId,
            type: eventType
        }
    }).catch(err => console.error("Analytics Error:", err));

    // 2. Selective Summary Updates
    const increments = {};
    if (eventType === 'view') increments.totalReach = 1;
    if (eventType === 'share') increments.totalShares = 1;
    
    // We SKIP real-time updates for 'impression' to save I/O.
    // We'll calculate total impressions via a nightly rollup if needed.

    if (Object.keys(increments).length > 0) {
        await UserStatsSummary.findOneAndUpdate(
            { userId: userId },
            { $inc: increments, $set: { lastUpdated: new Date() } },
            { upsert: true }
        );
    }
}
const recordContributionEvent = async (postId, userId, eventType) =>{
    // 1. Log to Time-Series
    ContributionEvent.create({
        timestamp: new Date(),
        metadata: {
            postId: postId,
            userId: userId,
            type: eventType
        }
    }).catch(err => console.error("Analytics Error:", err));

    // 2. Update Daily Heatmap Summary
    // const today = new Date().setHours(0, 0, 0, 0);
    // await UserContributionSummary.findOneAndUpdate(
    //     { userId, date: today },
    //     { $inc: { contributionCount: 1 } },
    //     { upsert: true }
    // );
    
    // 3. Update Lifetime Totals
    // const update = eventType === 'create' ? { totalPosts: 1 } : { totalCoAuthored: 1 };
    // await UserStatsSummary.findOneAndUpdate(
    //     { userId },
    //     { $inc: update },
    //     { upsert: true }
    // );
}

const getStats = async (userId) => {
    return await UserStatsSummary.findOne({ userId }).lean();
};

module.exports = { recordPostEvent, recordContributionEvent, getStats };


