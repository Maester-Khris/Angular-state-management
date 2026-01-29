const mongoose = require('mongoose');

const otpSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    index: true // Fast lookup during verification
  },
  otp: {
    type: String,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  // The TTL index: This document will be deleted 10 minutes after 'createdAt'
  expiresAt: {
    type: Date,
    default: () => new Date(Date.now() + 10 * 60 * 1000), 
    index: { expiresAfterSeconds: 0 }
  }
});

module.exports = mongoose.model('Otp', otpSchema);