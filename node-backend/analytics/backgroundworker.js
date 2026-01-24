const PostAnalytics = require("../database/models/postsevent");
const UserStatsSummary = require("../database/models/usersstats");
const ContributionEvent = require("../database/models/contributionevent");
const UserContributionSummary = require("../database/models/usercontribution");

const runContributionRollup = async () => {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    // 1. Aggregate yesterday's raw events from Time-Series
    const dailyData = await ContributionEvent.aggregate([
        { $match: { timestamp: { $gte: startOfToday } } },
        {
            $group: {
                _id: { userId: "$metadata.userId", date: { $dateTrunc: { date: "$timestamp", unit: "day" } } },
                count: { $sum: 1 }
            }
        }
    ]);

    // 2. Bulk Write to the Summary Collection
    const operations = dailyData.map(entry => ({
        updateOne: {
            filter: { userId: entry._id.userId, date: entry._id.date },
            update: { $set: { contributionCount: entry.count } },
            upsert: true
        }
    }));

    if (operations.length > 0) {
        await UserContributionSummary.bulkWrite(operations);
    }
};

const rollupImpressions = async () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0,0,0,0);

    // 1. Aggregate impressions per user for the last 24 hours
    // We assume the PostAnalytics contains the post's author ID in the metadata for easier rollup
    const impressionData = await PostAnalytics.aggregate([
        { 
            $match: { 
                "metadata.type": "impression", 
                timestamp: { $gte: yesterday } 
            } 
        },
        {
            $group: {
                _id: "$metadata.authorId", // We need the authorId in the metadata!
                dailyImpressions: { $sum: 1 }
            }
        }
    ]);

    // 2. Perform Bulk Update to Summary Collection
    const operations = impressionData.map(data => ({
        updateOne: {
            filter: { userId: data._id },
            update: { $inc: { totalReach: data.dailyImpressions } },
            upsert: true
        }
    }));

    if (operations.length > 0) {
        await UserStatsSummary.bulkWrite(operations);
        console.log(`Rollup complete: Updated reach for ${operations.length} users.`);
    }
};

module.exports = { runContributionRollup, rollupImpressions };