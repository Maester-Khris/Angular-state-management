const eventLoggerService = require('./services/eventLoggerService');
const queueService = require('./services/queueService');
const database = require('./database/connection');
require('dotenv').config();

async function run() {
    console.log('--- Full Analytics Diagnostic ---');

    // 1. Connect to DB
    await database.connectDB();
    console.log('1. DB connected.');

    // 2. Clear queues to start fresh
    const analyticsQueue = queueService.getQueue('analytics-queue');
    const controlQueue = queueService.getQueue('analytics-control-queue');
    await analyticsQueue.drain(true);
    await controlQueue.drain(true);
    console.log('2. Queues drained.');

    // 3. Enqueue some test events
    console.log('3. Enqueuing test events...');
    await eventLoggerService.queueEvent({
        postId: '699b625581aec74a7b33dadb',
        userId: '699b625481aec74a7b33dad1',
        type: 'view',
        source: 'diag-web'
    });
    await eventLoggerService.queueEvent({
        postId: 'another-post-uuid',
        guestId: 'guest-diag-123',
        type: 'preview',
        source: 'diag-web'
    });

    // 4. Verify they are waiting
    const waiting = await analyticsQueue.getWaiting();
    console.log(`4. Jobs waiting in analytics-queue: ${waiting.length}`);
    if (waiting.length !== 2) {
        console.error('FAIL: Events were processed too early or not enqueued.');
    }

    // 5. Trigger batch processing manually
    console.log('5. Triggering batch processing...');
    await eventLoggerService.processAnalyticsBatch();

    // 6. Verify they are gone from queue
    const waitingAfter = await analyticsQueue.getWaiting();
    console.log(`6. Jobs waiting after process: ${waitingAfter.length}`);

    // 7. Verify they are in MongoDB
    const PostAnalytics = require('./database/models/postsevent');
    const docs = await PostAnalytics.find({ 'metadata.source': 'diag-web' });
    console.log(`7. Documents found in MongoDB with source=diag-web: ${docs.length}`);
    if (docs.length > 0) {
        console.log('Sample document:', JSON.stringify(docs[0], null, 2));
    }

    // Cleanup
    await PostAnalytics.deleteMany({ 'metadata.source': 'diag-web' });
    console.log('Cleanup: Deleted diag documents.');

    await analyticsQueue.close();
    await controlQueue.close();
    await queueService.shutdown();
    await database.closeConnection();
    console.log('Diagnostic complete.');
    process.exit(0);
}

run().catch(err => {
    console.error('Diagnostic error:', err);
    process.exit(1);
});
