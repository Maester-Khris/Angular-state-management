const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const UserSchema = new mongoose.Schema({
  useruuid: { type: String, default: uuidv4, unique: true, index: true },
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, index: true, lowercase: true, trim: true },
  password: { type: String, required: true, select: false }, // Hidden by default
  avatarUrl: { type: String, default: '' },
  bio: { type: String, maxlength: 250, default: '' },
  status: { type: String, enum: ['active', 'away', 'offline'], default: 'active' },
  createdAt: { type: Date, default: Date.now }
}, {
  timestamps: true,
  collection: 'users'
});

// Indexes for fast lookups
// UserSchema.index({ email: 1 });
UserSchema.index({ useruuid: 1 });

// Safe JSON Return: Never send password or __v over the network
UserSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.password;
    delete ret.__v;
    delete ret._id;
    return ret;
  }
});
UserSchema.methods.toProfileJSON = function() {
  return {
    uuid: this.useruuid,
    name: this.name,
    email: this.email,
    avatarUrl: this.avatarUrl,
    bio: this.bio,
    status: this.status
  };
};


module.exports = mongoose.model('User', UserSchema);