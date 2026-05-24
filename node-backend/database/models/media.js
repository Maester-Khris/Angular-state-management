const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const MediaSchema = new mongoose.Schema({
  mediaId:      { type: String, default: uuidv4, unique: true, required: true },
  useruuid:     { type: String, required: true, index: true },
  cloudinaryId: { type: String, required: true },
  url:          { type: String, required: true },
  folder:       { type: String },
  hash:         { type: String, index: true },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'attached', 'deleted'],
    default: 'pending',
  },
  type:       { type: String, enum: ['post', 'profile'] },
  sizeBytes:  { type: Number },
  mimeType:   { type: String },
  uploadedAt: { type: Date, default: Date.now },
  attachedAt: { type: Date },
});

MediaSchema.index({ hash: 1, useruuid: 1 });

module.exports = mongoose.model('Media', MediaSchema);
