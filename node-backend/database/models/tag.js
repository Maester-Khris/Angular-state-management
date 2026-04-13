const mongoose = require('mongoose');

const TagSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    index: true
  }
}, {
  timestamps: false,
  collection: 'tags'
});

TagSchema.index({ name: 'text' });

module.exports = mongoose.model('Tag', TagSchema);
