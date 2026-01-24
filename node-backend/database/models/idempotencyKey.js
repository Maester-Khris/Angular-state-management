// models/IdempotencyKey.js
const mongoose = require("mongoose");

const IdempotencyKeySchema = new mongoose.Schema({
  key: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  requestHash: {
    type: String,
    required: false
  },
  method: {
    type: String,
    required: true
  },
  endpoint: {
    type: String,
    required: true
  },
  statusCode: {
    type: Number,
    required: true
  },
  responseBody: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  resourceId: {
    type: mongoose.Schema.Types.Mixed,
    required: false
  },
  locked: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: { expires: "24h" }  // TTL index auto deletes after 24 hours
  }
});

module.exports = mongoose.model("IdempotencyKey", IdempotencyKeySchema);
