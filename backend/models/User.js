const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema({
  // Basic Info
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    trim: true,
    lowercase: true,
    match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: 6
  },
  contact: {
    type: String,
    trim: true
  },
  
  // Role & Verification
  role: {
    type: String,
    enum: ['student', 'faculty', 'admin'],
    default: 'student'
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  
  // Profile
  profilePhoto: {
    type: String,
    default: ''
  },
  bio: {
    type: String,
    default: 'Passionate about technology and innovation.',
    maxlength: 500
  },
  isPrivate: { // 👈 ADD THIS NEW FIELD
  type: Boolean,
  default: false 
  },
  skills: [{
    type: String,
    trim: true
  }],
  
  // Student Specific
  studentId: {
    type: String,
    sparse: true
  },
  department: {
    type: String,
    trim: true
  },
  year: {
    type: String,
    enum: ['First Year', 'Second Year', 'Third Year', 'Fourth Year', 'Postgraduate']
  },
  
  // Faculty Specific
  employeeId: {
    type: String,
    sparse: true
  },
  facultyDepartment: {
    type: String,
    trim: true
  },
  designation: {
    type: String,
    enum: ['Professor', 'Associate Professor', 'Assistant Professor', 'Head of Department', 'Lab Incharge']
  },
  
  // Admin
  adminCode: {
    type: String
  },
  
  // Social - Basic Following System
  followers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  following: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  
  // NEW: Network Connection System (Like LinkedIn)
  // Updated field names as requested
  sentRequests: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  receivedRequests: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  connections: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  
  // Admin Warnings
  warnings: [{
    reason: String,
    issuedBy: String,
    issuedAt: {
      type: Date,
      default: Date.now
    },
    isAcknowledged: {
      type: Boolean,
      default: false
    }
  }],
  warningCount: {
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
  },

  // Add this after your warnings array in User.js:

// Restriction fields
status: {
  type: String,
  enum: ['active', 'restricted', 'suspended', 'banned'],
  default: 'active'
},
restrictionDetails: {
  isRestricted: { type: Boolean, default: false },
  restrictedUntil: Date,
  restrictionReason: String,
  restrictionDuration: String, // '6h', '12h', '24h', '3d', '7d'
  restrictedAt: Date
},
permissions: {
  canPost: { type: Boolean, default: true },
  canComment: { type: Boolean, default: true },
  canEditProfile: { type: Boolean, default: true },
  canSendRequests: { type: Boolean, default: true },
  canAcceptRequests: { type: Boolean, default: true },
  canLike: { type: Boolean, default: true },
  canShare: { type: Boolean, default: true }
}
});

// Compare password method (optional - can also use bcrypt.compare directly)
UserSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Virtual for full name (optional)
UserSchema.virtual('fullName').get(function() {
  return `${this.name}`;
});

// Pre-save middleware to update updatedAt
UserSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Instance method to add a connection
UserSchema.methods.addConnection = function(userId) {
  if (!this.connections.includes(userId)) {
    this.connections.push(userId);
  }
  return this.save();
};

// Instance method to remove a connection
UserSchema.methods.removeConnection = function(userId) {
  const index = this.connections.indexOf(userId);
  if (index > -1) {
    this.connections.splice(index, 1);
  }
  return this.save();
};

// Instance method to send connection request
UserSchema.methods.sendRequest = function(userId) {
  if (!this.sentRequests.includes(userId)) {
    this.sentRequests.push(userId);
  }
  return this.save();
};

// Instance method to receive connection request
UserSchema.methods.receiveRequest = function(userId) {
  if (!this.receivedRequests.includes(userId)) {
    this.receivedRequests.push(userId);
  }
  return this.save();
};

// Instance method to accept connection request
UserSchema.methods.acceptRequest = function(userId) {
  // Remove from receivedRequests
  const requestIndex = this.receivedRequests.indexOf(userId);
  if (requestIndex > -1) {
    this.receivedRequests.splice(requestIndex, 1);
  }
  
  // Add to connections
  if (!this.connections.includes(userId)) {
    this.connections.push(userId);
  }
  
  return this.save();
};

// Instance method to reject connection request
UserSchema.methods.rejectRequest = function(userId) {
  const requestIndex = this.receivedRequests.indexOf(userId);
  if (requestIndex > -1) {
    this.receivedRequests.splice(requestIndex, 1);
  }
  return this.save();
};

// Instance method to cancel sent request
UserSchema.methods.cancelRequest = function(userId) {
  const requestIndex = this.sentRequests.indexOf(userId);
  if (requestIndex > -1) {
    this.sentRequests.splice(requestIndex, 1);
  }
  return this.save();
};

// Static method to find users by department
UserSchema.statics.findByDepartment = function(department) {
  return this.find({ department: department });
};

// Static method to find users by role
UserSchema.statics.findByRole = function(role) {
  return this.find({ role: role });
};

// Static method to search users
UserSchema.statics.searchUsers = function(query, excludeUserId) {
  const searchQuery = {
    _id: { $ne: excludeUserId },
    $or: [
      { name: { $regex: query, $options: 'i' } },
      { email: { $regex: query, $options: 'i' } },
      { department: { $regex: query, $options: 'i' } },
      { skills: { $in: [new RegExp(query, 'i')] } }
    ]
  };
  
  return this.find(searchQuery)
    .select('-password -warnings')
    .limit(20);
};

module.exports = mongoose.model('User', UserSchema);