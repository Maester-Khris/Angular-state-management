const PostAnalytics = require('./models/postsevent');

const AnalyticsDAO = {
    /**
     * Batch insert analytics events into the TimeSeries collection
     * @param {Array<object>} events - Array of events to insert
     */
    async batchInsertEvents(events) {
        if (!events || events.length === 0) return null;

        // Mongoose insertMany handles bulk operations efficiently
        return await PostAnalytics.insertMany(events, { ordered: false });
    },

    /**
     * Clean up orphaned analytics (optional, for maintenance)
     * Note: TTL already handles auto-deletion after 90 days.
     */
    async deleteAnalyticsByPostId(postId) {
        return await PostAnalytics.deleteMany({ "metadata.postId": postId });
    }
};

module.exports = AnalyticsDAO;
