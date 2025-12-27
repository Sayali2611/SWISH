// backend/models/Post.js
const mongoose = require('mongoose');

const PostSchema = new mongoose.Schema({
  content: {
    type: String,
    required: [true, 'Post content is required'],
    trim: true,
    maxlength: 2000
  },
  
  // UPDATED: Support multiple media files
  media: [{
    type: {
      type: String,
      enum: ['image', 'video'],
      required: true
    },
    url: {
      type: String,
      required: true
    },
    thumbnail: String, // For video thumbnails
    publicId: String, // Cloudinary public ID for deletion
    width: Number,
    height: Number,
    duration: Number, // For videos in seconds
    size: Number, // File size in bytes
    format: String, // jpg, png, mp4, etc.
    caption: {
      type: String,
      maxlength: 200
    }
  }],
  
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Engagement
  likes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  
  comments: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    userName: {
      type: String,
      required: true
    },
    content: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500
    },
    timestamp: {
      type: Date,
      default: Date.now
    }
  }],
  
  // Metadata
  tags: [{
    type: String,
    trim: true
  }],
  isPublic: {
    type: Boolean,
    default: true
  },
  
  // NEW FIELDS FOR EXPLORE PAGE
  category: {
    type: String,
    enum: ['tech', 'events', 'projects', 'achievements', 'fun', 'academic', null],
    default: null
  },
  
  // Engagement metrics
  saves: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  
  shares: {
    type: Number,
    default: 0
  },
  
  views: {
    type: Number,
    default: 0
  },
  
  // Analytics
  engagementScore: {
    type: Number,
    default: 0
  },
  
  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Create index for better search performance
PostSchema.index({ createdAt: -1 });
PostSchema.index({ user: 1, createdAt: -1 });
PostSchema.index({ category: 1, createdAt: -1 });
PostSchema.index({ 'media.type': 1, createdAt: -1 });
PostSchema.index({ tags: 1, createdAt: -1 });
PostSchema.index({ engagementScore: -1 });

// Method to calculate engagement score
PostSchema.methods.calculateEngagementScore = function() {
  const likes = this.likes?.length || 0;
  const comments = this.comments?.length || 0;
  const saves = this.saves?.length || 0;
  const shares = this.shares || 0;
  const views = this.views || 0;
  
  // Hours since post was created
  const hoursSincePost = (Date.now() - new Date(this.createdAt).getTime()) / (1000 * 60 * 60);
  
  // Weighted engagement score: (likes * 2) + comments + saves + (shares * 3) - (hoursSincePost * 0.1)
  const score = (likes * 2) + comments + saves + (shares * 3) - (hoursSincePost * 0.1);
  this.engagementScore = score;
  return score;
};

// Pre-save middleware to update engagement score and extract tags
PostSchema.pre('save', function(next) {
  // Update updatedAt
  this.updatedAt = Date.now();
  
  // Extract hashtags from content
  if (this.isModified('content')) {
    const hashtagRegex = /#(\w+)/g;
    const matches = this.content.match(hashtagRegex);
    if (matches) {
      this.tags = matches.map(tag => tag.substring(1).toLowerCase());
    }
  }
  
  // Calculate engagement score if engagement metrics changed
  if (this.isModified('likes') || this.isModified('comments') || 
      this.isModified('saves') || this.isModified('shares') || this.isModified('views')) {
    this.calculateEngagementScore();
  }
  
  next();
});

module.exports = mongoose.model('Post', PostSchema);