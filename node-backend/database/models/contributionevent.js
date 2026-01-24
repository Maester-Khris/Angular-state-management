const mongoose = require('mongoose');

const contributionEventSchema = new mongoose.Schema({
  timestamp: { 
    type: Date, 
    required: true 
  },
  metadata: {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    postId: { type: mongoose.Schema.Types.ObjectId, ref: 'Post' },
    // Type defines the "weight" of the contribution for the heatmap
    type: { 
      type: String, 
      enum: ['create', 'edit', 'collaborate', 'milestone'], 
      required: true 
    }
  }
}, {
  timeseries: {
    timeField: 'timestamp',
    metaField: 'metadata',
    granularity: 'hours' // Contributions happen less frequently than views
  },
  // Keep raw history for 14 months to cover the 12-month UI display + buffer
  expireAfterSeconds: 36806400 
});

const ContributionEvent = mongoose.model('ContributionEvent', contributionEventSchema);