const mongoose = require('mongoose');

const postAnalyticsSchema = new mongoose.Schema({
    timestamp: {
        type: Date,
        required: true,
    },
    metadata: {
        postId: { type: String, required: true },
        userId: { type: String, required: false },
        guestId: { type: String, required: false },
        type: { type: String, required: true, enum: ['view', 'impression', 'share', 'favorite', 'preview'] },
        source: { type: String } // e.g., 'web', 'mobile', 'api'
    }
}, {
    timeseries: {
        timeField: 'timestamp',
        metaField: 'metadata',
        granularity: 'minutes'
    },
    // Set a TTL (Time-to-Live) so data auto-deletes after 90 days
    // This keeps your DB lean and costs low.
    expireAfterSeconds: 7776000
});


const PostAnalytics = mongoose.model('PostAnalytics', postAnalyticsSchema);
module.exports = PostAnalytics;