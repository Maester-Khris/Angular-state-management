const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const PostSchema = new mongoose.Schema({
  uuid: { type: String, default: uuidv4, unique: true, index: true },
  title: { type: String, required: true, trim: true },
  description: { type: String, required: true },

  // INTERNAL LINKING - The Performance Engine
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  editors: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], 
  
  // DENORMALIZATION - Keep these for "Read-Heavy" performance (No joins needed for feed)
  // MUST IMPLEMENT WORKER FOR SYNC: after change in user objects
  authorName: { type: String, required: true }, 
  authorAvatar: { type: String },

  images: [{ type: String }], // Array of URLs
  hashtags: [{ type: String, lowercase: true }],
  isPublic: { type: Boolean, default: false }, 
  lastEditedAt: { type: Date, default: Date.now },
  views: { type: Number, default: 0, index: true },
}, {
  timestamps: false, // We handle dates manually for precise control
  collection: 'posts'
});

// Composite Index for feed performance (Title + Creation Date)
PostSchema.index({ title: 'text', description: 'text' });
PostSchema.index({ authorid: 1, createdAt: -1 });

// Pre-save Method: Update lastEditedAt automatically
PostSchema.pre('save', function(){
  if (this.isModified()) {
    this.lastEditedAt = Date.now();
  }
});

// Override toJSON for clean network delivery
PostSchema.set('toJSON', {
  transform: (doc, ret) => {
    ret.cursorId = ret._id.toString();
    delete ret.__v;
    delete ret._id;
    return ret;
  }
});

module.exports = mongoose.model('Post', PostSchema);