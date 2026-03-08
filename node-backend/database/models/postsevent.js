const mongoose = require('mongoose');

const postAnalyticsSchema = new mongoose.Schema({
    timestamp: {
        type: Date,
        required: true,
    },
    metadata: {
        postId: { type: mongoose.Schema.Types.ObjectId, ref: 'Post', required: true },
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: false },
        guestId: { type: String, required: false },
        type: { type: String, required: true, enum: ['view', 'impression', 'share', 'favorite'] },
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