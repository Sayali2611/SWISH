// server.js - FINAL MERGED VERSION WITH ALL IMPROVEMENTS - FIXED SHARES ERROR & ALL FEEDS
const express = require("express");
const cors = require("cors");
const { MongoClient, ObjectId } = require("mongodb");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const exploreRoutes = require('./routes/exploreRoutes');

require("dotenv").config();

const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" } // restrict in production
});

const PORT = process.env.PORT || 5000;

// Make db globally available
global.db = null;

// Middleware
app.use(express.json());
app.use(cors({ origin: "https://swish-black.vercel.app", credentials: true }));

// Cloudinary Configuration
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ==================== CLOUDINARY STORAGE CONFIGURATION ====================

// Cloudinary Storage for Profile Photos
const profileStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'campus-connect/profiles',
    format: async (req, file) => 'png',
    public_id: (req, file) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      return 'profile-' + uniqueSuffix;
    },
    transformation: [
      { width: 500, height: 500, crop: "limit" },
      { quality: "auto" },
      { format: "png" }
    ]
  },
});

// Cloudinary Storage for Post Media (Images & Videos)
const postMediaStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    
    // Check file type
    const isImage = file.mimetype.startsWith('image/');
    const isVideo = file.mimetype.startsWith('video/');
    
    let folder = 'campus-connect/posts';
    let resource_type = 'auto'; // Automatically detect image/video
    let transformation = [];
    
    if (isImage) {
      transformation = [
        { width: 1200, height: 1200, crop: "limit" },
        { quality: "auto:good" }
      ];
    } else if (isVideo) {
      transformation = [
        { quality: "auto:good" }
      ];
    }
    
    return {
      folder: folder,
      public_id: `post-media-${uniqueSuffix}`,
      resource_type: resource_type,
      allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'mp4', 'mov', 'avi'],
      transformation: transformation
    };
  }
});

// File filter for profile photos
const profileFileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed for profile photos!'), false);
  }
};

// File filter for post media (images & videos)
const mediaFileFilter = (req, file, cb) => {
  const allowedTypes = [
    'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp',
    'video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/x-matroska'
  ];
  
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only image and video files are allowed for posts!'), false);
  }
};

// Create multer instances
const profileUpload = multer({ 
  storage: profileStorage,
  fileFilter: profileFileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB for profile photos
  }
});

const postMediaUpload = multer({
  storage: postMediaStorage,
  fileFilter: mediaFileFilter,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB for videos
    files: 10 // Max 10 files per upload
  }
});

// MongoDB connection
let db;
let mongoClient;
const connectDB = async () => {
  try {
    mongoClient = new MongoClient(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
      maxPoolSize: 10,
      minPoolSize: 5,
      retryWrites: true,
      retryReads: true,
    });
    
    await mongoClient.connect();
    db = mongoClient.db('swish');
    
    // Set global db for access in other modules
    global.db = db;
    
    console.log("✅ MongoDB connected successfully to Atlas");
    
    // Debug logging
    console.log("🔍 DEBUG: db variable type:", typeof db);
    console.log("🔍 DEBUG: global.db set:", !!global.db);
    console.log("🔍 DEBUG: Is db connected?", !!db);
    
    // Create indexes
    await db.collection('users').createIndex({ email: 1 }, { unique: true });
    await db.collection('posts').createIndex({ createdAt: -1 });
    await db.collection('posts').createIndex({ userId: 1 });
    await db.collection('notifications').createIndex({ recipientId: 1, createdAt: -1 });
    await db.collection('posts').createIndex({ type: 1 }); // New index for post types
    await db.collection('posts').createIndex({ "poll.question": "text", content: "text" }); // Text search index
    await db.collection('connectionHistory').createIndex({ userId: 1, date: -1 }); // For connection history
    await db.collection('connectionHistory').createIndex({ userId: 1, targetUserId: 1 }); // For duplicate prevention
    
    // FIX: Run migration to fix the shares field in existing posts
    await migrateSharesField();
    
    // Also set on app for consistency
    app.set('db', db);
    
  } catch (err) {
    console.error("❌ MongoDB connection failed", err);
    process.exit(1);
  }
};

// Migration function to fix shares field
const migrateSharesField = async () => {
  try {
    console.log("🔄 Running migration to fix shares field...");
    
    // Find posts where shares is not an array
    const postsWithInvalidShares = await db.collection('posts').find({
      $or: [
        { shares: { $type: "number" } }, // shares is a number
        { shares: { $type: "string" } }, // shares is a string
        { shares: { $exists: false } }, // shares doesn't exist
        { shares: null } // shares is null
      ]
    }).toArray();
    
    console.log(`Found ${postsWithInvalidShares.length} posts with invalid shares field`);
    
    // Fix each post
    for (const post of postsWithInvalidShares) {
      try {
        await db.collection('posts').updateOne(
          { _id: post._id },
          { 
            $set: { 
              shares: [], // Set to empty array
              shareCount: typeof post.shares === 'number' ? post.shares : 0 // Preserve count if it was a number
            }
          }
        );
        console.log(`Fixed post ${post._id}: shares field`);
      } catch (error) {
        console.error(`Error fixing post ${post._id}:`, error.message);
      }
    }
    
    console.log("✅ Migration completed successfully");
  } catch (error) {
    console.error("Error running migration:", error);
  }
};

connectDB();

// Make db available to routes
app.use((req, res, next) => {
  req.db = db;
  next();
});

// Auth middleware (reads Authorization: Bearer <token>)
const auth = (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ message: 'No token, authorization denied' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ message: 'Token is not valid' });
  }
};

// ==================== SOCKET.IO REAL-TIME SETUP ====================
const userSockets = new Map();

io.use((socket, next) => {
  const token = socket.handshake.auth?.token || socket.handshake.query?.token;
  if (!token) return next(new Error("Authentication error"));
  try {
    const decoded = jwt.verify(token.replace('Bearer ', ''), process.env.JWT_SECRET);
    socket.userId = decoded.userId;
    return next();
  } catch (err) {
    return next(new Error("Authentication error"));
  }
});

io.on("connection", (socket) => {
  const userId = socket.userId;
  if (!userId) return;

  // add socket id to map
  const existing = userSockets.get(userId) || new Set();
  existing.add(socket.id);
  userSockets.set(userId, existing);

  console.log(`🔌 socket connected: user ${userId} -> socket ${socket.id}`);

  socket.on("disconnect", () => {
    const set = userSockets.get(userId);
    if (set) {
      set.delete(socket.id);
      if (set.size === 0) userSockets.delete(userId);
      else userSockets.set(userId, set);
    }
    console.log(`❌ socket disconnected: user ${userId} -> socket ${socket.id}`);
  });
});

// Helper to emit to a userId (all connected sockets)
const emitToUser = (userId, event, payload) => {
  const sockets = userSockets.get(userId?.toString());
  if (!sockets) return;
  sockets.forEach((socketId) => {
    io.to(socketId).emit(event, payload);
  });
};

// ----------------- timeAgo helper -----------------
function timeAgo(date) {
  const seconds = Math.floor((new Date() - new Date(date)) / 1000);
  if (seconds < 60) return "Just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// ----------------- Notifications helper -----------------
const createNotification = async ({ recipientId, senderId, type, postId = null, message }) => {
  try {
    // Get sender info first
    const sender = await db.collection("users").findOne({ _id: new ObjectId(senderId) });
    
    // Format message based on type
    let formattedMessage = message;
    if (!formattedMessage) {
      switch(type) {
        case "post_shared":
          formattedMessage = `${sender?.name || "Someone"} shared a post with you`;
          break;
        case "like":
          formattedMessage = `${sender?.name || "Someone"} liked your post`;
          break;
        case "comment":
          formattedMessage = `${sender?.name || "Someone"} commented on your post`;
          break;
        case "connection_request":
          formattedMessage = `${sender?.name || "Someone"} sent you a connection request`;
          break;
        case "connection_accepted":
          formattedMessage = `${sender?.name || "Someone"} accepted your connection request`;
          break;
        case "event_rsvp":
          formattedMessage = `${sender?.name || "Someone"} RSVP'd to your event`;
          break;
        case "poll_vote":
          formattedMessage = `${sender?.name || "Someone"} voted on your poll`;
          break;
        case "post_reported":
          formattedMessage = `${sender?.name || "Someone"} reported your post`;
          break;
        case "post_deleted":
          formattedMessage = `Your post was removed by admin`;
          break;
        case "warning":
          formattedMessage = `You received a warning from admin`;
          break;
        case "account_restricted":
          formattedMessage = `Your account has been restricted by admin`;
          break;
        case "account_unrestricted":
          formattedMessage = `Your account restriction has been removed`;
          break;
        case "role_changed":
          formattedMessage = `Your role has been changed by admin`;
          break;
        case "account_status":
          formattedMessage = `Your account status has been updated by admin`;
          break;
        case "account_deleted":
          formattedMessage = `Your account was deleted by admin`;
          break;
        case "post_approved":
          formattedMessage = `Your post was reviewed and approved by admin`;
          break;
        case "report_resolved":
          formattedMessage = `Your report has been resolved by admin`;
          break;
        default:
          formattedMessage = `You have a new notification`;
      }
    }

    const notification = {
      recipientId: new ObjectId(recipientId),
      senderId: new ObjectId(senderId),
      type,
      postId: postId ? new ObjectId(postId) : null,
      message: formattedMessage,
      read: false,
      createdAt: new Date()
    };

    const result = await db.collection("notifications").insertOne(notification);

    // populate sender info to send to client
    const payload = {
      id: result.insertedId,
      recipientId,
      senderId,
      type,
      postId,
      message: formattedMessage,
      read: false,
      createdAt: notification.createdAt,
      userName: sender?.name || "Campus Admin",
      userImage: sender?.profilePhoto || null,
      timeAgo: timeAgo(notification.createdAt)
    };

    // Emit real-time to recipient if they are connected
    emitToUser(recipientId.toString(), "new_notification", payload);

    return payload;
  } catch (err) {
    console.error("Error creating notification:", err);
    throw err;
  }
};

// ==================== CONNECTION HISTORY HELPER ====================

// Record connection history event
const recordConnectionEvent = async (userId, targetUserId, targetUserName, type, userData = {}) => {
  try {
    const historyEvent = {
      userId: new ObjectId(userId),
      targetUserId: new ObjectId(targetUserId),
      targetUserName,
      type, // 'connected' or 'disconnected'
      date: new Date(),
      userData: {
        name: userData.name || '',
        role: userData.role || '',
        department: userData.department || '',
        company: userData.company || '',
        email: userData.email || '',
        ...userData
      }
    };

    const result = await db.collection('connectionHistory').insertOne(historyEvent);
    
    console.log(`📊 Connection history recorded: ${type} event for user ${userId}`);
    
    return result.insertedId;
  } catch (error) {
    console.error("Error recording connection history:", error);
    throw error;
  }
};

// Get connection history for a user
const getConnectionHistory = async (userId, timeframe = 'all') => {
  try {
    const query = { userId: new ObjectId(userId) };
    const now = new Date();
    
    // Apply timeframe filter
    switch(timeframe) {
      case '7days':
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        query.date = { $gte: sevenDaysAgo };
        break;
      case '30days':
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        query.date = { $gte: thirtyDaysAgo };
        break;
      case '90days':
        const ninetyDaysAgo = new Date();
        ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
        query.date = { $gte: ninetyDaysAgo };
        break;
      // 'all' includes all history
    }
    
    const history = await db.collection('connectionHistory')
      .find(query)
      .sort({ date: 1 }) // Sort by date ascending for timeline
      .toArray();
    
    return history.map(item => ({
      type: item.type,
      date: item.date,
      userId: item.targetUserId.toString(),
      userName: item.targetUserName,
      userData: item.userData
    }));
  } catch (error) {
    console.error("Error fetching connection history:", error);
    throw error;
  }
};

// ==================== EXPLORE ROUTES ====================
// Mount explore routes with database access
app.use('/api/explore', (req, res, next) => {
  req.db = db;
  next();
}, exploreRoutes);

// ==================== AUTH ROUTES ====================

// Register with Cloudinary
app.post("/api/auth/register", profileUpload.single('profilePhoto'), async (req, res) => {
  try {
    const { 
      name, email, password, role, contact,
      studentId, department, year,
      employeeId, facultyDepartment, designation,
      adminCode,
      bio, // Add this
      isPrivate = false
    } = req.body;

    // Validate university email
    if (!email.endsWith('@sigce.edu')) {
      if (req.file) {
        // Delete uploaded file if email validation fails
        await cloudinary.uploader.destroy(req.file.filename);
      }
      return res.status(400).json({ message: 'Please use your SIGCE email (@sigce.edu)' });
    }

    // Check if user exists
    const existingUser = await db.collection('users').findOne({ email });
    if (existingUser) {
      if (req.file) {
        await cloudinary.uploader.destroy(req.file.filename);
      }
      return res.status(400).json({ message: 'User already exists' });
    }

    // Validate admin code
    if (role === 'admin' && adminCode !== "CAMPUS2024") {
      if (req.file) {
        await cloudinary.uploader.destroy(req.file.filename);
      }
      return res.status(400).json({ message: 'Invalid admin access code' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Handle profile photo
    let profilePhotoUrl = '';
    if (req.file) {
      profilePhotoUrl = req.file.path; // Cloudinary URL
    }

    const user = {
      name,
      email,
      password: hashedPassword,
      contact,
      role: role || 'student',
      profilePhoto: profilePhotoUrl,
      bio: bio || 'Passionate about technology and innovation. Always eager to learn and grow.',
      isPrivate: isPrivate === 'true' || isPrivate === true,
      skills: ["JavaScript", "React", "Node.js", "Python"],
      campus: 'SIGCE Campus',
      followers: [],
      following: [],
      // NEW NETWORK FIELDS WITH UPDATED NAMES
      sentRequests: [],
      receivedRequests: [],
      connections: [],
      // ===================
      isVerified: false,
      warnings: [],
      warningCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      // ADD THESE FIELDS to the user object:
      status: 'active', // active, suspended, banned, restricted
      restrictedUntil: null, // Date when restriction ends
      restrictionReason: '',
      restrictionDetails: { // ← ADD THIS OBJECT
        isRestricted: false,
        restrictedUntil: null,
        restrictionReason: '',
        restrictionDuration: '',
        restrictedAt: null
      },
      lastLogin: null,
      loginCount: 0,
      department: department || facultyDepartment || '', // Unified department field
      // Permissions for restricted users
      permissions: {
        canPost: true,
        canComment: true,
        canEditProfile: true,
        canSendRequests: true,
        canAcceptRequests: true,
        canLike: true,
        canShare: true
      }
    };

    // Add role-specific fields
    if (role === 'student') {
      user.studentId = studentId;
      user.department = department;
      user.year = year;
    } else if (role === 'faculty') {
      user.employeeId = employeeId;
      user.department = facultyDepartment;
      user.designation = designation;
    } else if (role === 'admin') {
      user.permissions = ['manage_users', 'moderate_content'];
    }

    const result = await db.collection('users').insertOne(user);

    // Generate token
    const token = jwt.sign(
      { userId: result.insertedId.toString() }, 
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Prepare user response
    const userResponse = {
      id: result.insertedId,
      name: user.name,
      email: user.email,
      contact: user.contact,
      role: user.role,
      profilePhoto: user.profilePhoto,
      bio: user.bio,
      isPrivate: user.isPrivate, 
      skills: user.skills,
      campus: user.campus,
      // NEW NETWORK FIELDS WITH UPDATED NAMES
      sentRequests: user.sentRequests || [],
      receivedRequests: user.receivedRequests || [],
      connections: user.connections || [],
      // ===================
      isVerified: user.isVerified || false,
      permissions: user.permissions
    };

    // Add role-specific fields to response
    if (user.studentId) userResponse.studentId = user.studentId;
    if (user.department) userResponse.department = user.department;
    if (user.year) userResponse.year = user.year;
    if (user.employeeId) userResponse.employeeId = user.employeeId;
    if (user.designation) userResponse.designation = user.designation;

    res.status(201).json({
      message: 'User created successfully',
      token,
      user: userResponse
    });
  } catch (error) {
    if (req.file) {
      await cloudinary.ploader.destroy(req.file.filename);
    }
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Login
app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate university email
    if (!email.endsWith('@sigce.edu')) {
      return res.status(400).json({ message: 'Please use your SIGCE email (@sigce.edu)' });
    }

    const user = await db.collection('users').findOne({ email });
    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { userId: user._id.toString() },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
    
    await db.collection('users').updateOne(
      { _id: user._id },
      { 
        $set: { lastLogin: new Date() },
        $inc: { loginCount: 1 }
      }
    );

    const userResponse = {
      id: user._id,
      name: user.name,
      email: user.email,
      contact: user.contact,
      role: user.role,
      profilePhoto: user.profilePhoto,
      bio: user.bio,
      isPrivate: Boolean(user.isPrivate),
      skills: user.skills || [],
      campus: user.campus,
      // NEW NETWORK FIELDS WITH UPDATED NAMES
      sentRequests: user.sentRequests || [],
      receivedRequests: user.receivedRequests || [],
      connections: user.connections || [],
      // ===================
      isVerified: user.isVerified || false,
      studentId: user.studentId || '',
      department: user.department || '',
      year: user.year || '',
      employeeId: user.employeeId || '',
      facultyDepartment: user.facultyDepartment || '',
      designation: user.designation || '',
      status: user.status || 'active',
      restrictedUntil: user.restrictedUntil || null,
      restrictionReason: user.restrictionReason || '',
      restrictionDetails: user.restrictionDetails || { isRestricted: false },
      permissions: user.permissions || {
        canPost: true,
        canComment: true,
        canEditProfile: true,
        canSendRequests: true,
        canAcceptRequests: true,
        canLike: true,
        canShare: true
      }
    };

    res.json({
      message: 'Login successful',
      token,
      user: userResponse
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// ==================== PROFILE ROUTES ====================

// ✅✅✅ NEW ENDPOINT: Upload profile photo
app.post("/api/auth/upload-photo", auth, profileUpload.single('profilePhoto'), async (req, res) => {
  try {
    const userId = req.user.userId;
    
    if (!req.file) {
      return res.status(400).json({ 
        success: false, 
        message: 'No file uploaded' 
      });
    }
    
    const photoUrl = req.file.path; // Cloudinary URL
    
    // Update user with new photo URL
    await db.collection('users').updateOne(
      { _id: new ObjectId(userId) },
      { $set: { profilePhoto: photoUrl, updatedAt: new Date() } }
    );
    
    // Get updated user
    const updatedUser = await db.collection('users').findOne(
      { _id: new ObjectId(userId) },
      { projection: { password: 0 } }
    );
    
    res.json({
      success: true,
      message: 'Profile photo updated successfully',
      photoUrl: photoUrl,
      user: {
        id: updatedUser._id,
        name: updatedUser.name,
        email: updatedUser.email,
        profilePhoto: updatedUser.profilePhoto,
        role: updatedUser.role
      }
    });
    
  } catch (error) {
    console.error("Error uploading profile photo:", error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error uploading photo',
      error: error.message 
    });
  }
});

app.get("/api/auth/profile", auth, async (req, res) => {
  try {
    const userId = req.user.userId;
    
    const user = await db.collection('users').findOne({ _id: new ObjectId(userId) });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const userResponse = { ...user };
    delete userResponse.password;
    userResponse.id = userResponse._id;
    userResponse.isPrivate = Boolean(userResponse.isPrivate);

    // Ensure network fields exist with updated names
    userResponse.sentRequests = userResponse.sentRequests || [];
    userResponse.receivedRequests = userResponse.receivedRequests || [];
    userResponse.connections = userResponse.connections || [];

    res.json(userResponse);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update user profile
app.put("/api/auth/profile", auth, async (req, res) => {
  try {
  // ============ ADD THIS CHECK ============
    const userId = req.user.userId;
    const user = await db.collection('users').findOne({ _id: new ObjectId(userId) });
    
    if (user.status === 'restricted' && user.restrictedUntil) {
      const now = new Date();
      const restrictionEnd = new Date(user.restrictedUntil);
      
      if (restrictionEnd > now) {
        return res.status(403).json({ 
          success: false,
          message: `⏸️ Your account is restricted until ${restrictionEnd.toLocaleString()}. You cannot edit profile during restriction.`,
          canEditProfile: false
        });
      }
    }

    const { 
      name,
      contact,
      bio,
      skills,
      studentId,
      department,
      year,
      employeeId,
      facultyDepartment,
      designation,
      isPrivate 
    } = req.body;

    // const userId = req.user.userId;

    const updateData = {
      updatedAt: new Date()
    };

    if (name) updateData.name = name;
    if (contact !== undefined) updateData.contact = contact;
    if (bio !== undefined) updateData.bio = bio;
    if (isPrivate !== undefined) updateData.isPrivate = isPrivate === 'true' || isPrivate === true;
    if (skills) {
      try {
        updateData.skills = typeof skills === 'string' ? JSON.parse(skills) : skills;
      } catch (e) {
        return res.status(400).json({ message: "Invalid JSON format provided for skills." });
      }
    }
    if (department) updateData.department = department;
    if (year) updateData.year = year;
    if (studentId) updateData.studentId = studentId;
    if (employeeId) updateData.employeeId = employeeId;
    if (facultyDepartment) updateData.facultyDepartment = facultyDepartment;
    if (designation) updateData.designation = designation;

    const result = await db.collection('users').updateOne(
      { _id: new ObjectId(userId) },
      { $set: updateData }
    );

    if (result.modifiedCount === 0) {
      return res.status(404).json({ message: 'User not found or no changes made' });
    }

    const updatedUser = await db.collection('users').findOne({ _id: new ObjectId(userId) });

    const userResponse = { ...updatedUser };
    delete userResponse.password;
    userResponse.id = userResponse._id;

    res.json({
      message: 'Profile updated successfully',
      user: userResponse
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// ==================== POST ROUTES WITH EVENT & POLL SUPPORT ====================

// Create post (TEXT, EVENT, or POLL - without media)
app.post("/api/posts", auth, async (req, res) => {
  try {
    const { content, type, event, poll } = req.body;
    const userId = req.user.userId;

    // ============ ADD RESTRICTION CHECK HERE ============
    // Check if user is restricted
    const user = await db.collection('users').findOne({ _id: new ObjectId(userId) });
    
    if (user.status === 'restricted' && user.restrictedUntil) {
      const now = new Date();
      const restrictionEnd = new Date(user.restrictedUntil);
      
      // If still restricted
      if (restrictionEnd > now) {
        return res.status(403).json({ 
          success: false,
          message: `⏸️ Your account is restricted until ${restrictionEnd.toLocaleString()}. Reason: ${user.restrictionReason || 'Administrative action'}`,
          restrictedUntil: restrictionEnd,
          restrictionReason: user.restrictionReason,
          canPost: false
        });
      } 
      // If restriction expired, auto-remove it
      else {
        await db.collection('users').updateOne(
          { _id: new ObjectId(userId) },
          { 
            $set: { 
              status: 'active',
              restrictedUntil: null,
              restrictionReason: '',
              updatedAt: new Date()
            }
          }
        );
      }
    }
    // ============ END RESTRICTION CHECK ============

    // Basic validation
    if (!content && type !== 'poll') {
      return res.status(400).json({ message: 'Post content is required for text and event posts' });
    }

    if (type === 'poll' && (!poll?.question || poll?.options?.length < 2)) {
      return res.status(400).json({ message: 'Poll must have a question and at least 2 options' });
    }

    if (type === 'event' && (!event?.title || !event?.date || !event?.time || !event?.location)) {
      return res.status(400).json({ message: 'Event must have title, date, time, and location' });
    }

    // Build post object
    const post = {
      content: content?.trim() || '',
      type: type || 'text',
      media: [],
      userId: new ObjectId(userId),
      likes: [],
      comments: [],
      shareCount: 0,
      shares: [], // FIX: Ensure shares is an array
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Add event data if present
    if (type === 'event' && event) {
      const dateTime = new Date(`${event.date}T${event.time}`);
      if (isNaN(dateTime.getTime())) {
        return res.status(400).json({ message: 'Invalid event date/time' });
      }
      
      post.event = {
        title: event.title,
        description: event.description || '',
        dateTime: dateTime,
        date: event.date,
        time: event.time,
        location: event.location,
        maxAttendees: event.maxAttendees || null,
        attendees: [],
        rsvpCount: 0
      };
    }

    // Add poll data if present
    if (type === 'poll' && poll) {
      post.poll = {
        question: poll.question,
        options: poll.options
          .filter(opt => opt?.trim())
          .map(option => ({
            text: option.trim(),
            votes: 0,
            voters: []
          })),
        totalVotes: 0,
        voters: []
      };
    }

    const result = await db.collection('posts').insertOne(post);
    
    // Get user data for response
    const userData = await db.collection('users').findOne({ _id: new ObjectId(userId) });
    
    const postResponse = {
      _id: result.insertedId,
      content: post.content,
      type: post.type,
      media: post.media,
      likes: post.likes,
      comments: post.comments,
      shareCount: post.shareCount,
      shares: post.shares,
      createdAt: post.createdAt,
      event: post.event || null,
      poll: post.poll || null,
      user: {
        id: userData._id,
        name: userData.name,
        profilePhoto: userData.profilePhoto,
        role: userData.role,
        department: userData.department
      }
    };

    res.status(201).json(postResponse);
  } catch (error) {
    console.error("Error creating post:", error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// ==================== MEDIA UPLOAD ROUTE FOR POSTS ====================

// Create post with media upload (supports event and poll too)
app.post("/api/posts/upload", auth, postMediaUpload.array('media', 10), async (req, res) => {
  console.log("📤 UPLOADING POST WITH MEDIA TO CLOUDINARY...");
  
  try {
const userId = req.user.userId;
    const user = await db.collection('users').findOne({ _id: new ObjectId(userId) });
    
    if (user.status === 'restricted' && user.restrictedUntil) {
      const now = new Date();
      const restrictionEnd = new Date(user.restrictedUntil);
      
      if (restrictionEnd > now) {
        // Delete uploaded files if any
        if (req.files && req.files.length > 0) {
          for (const file of req.files) {
            try {
              await cloudinary.uploader.destroy(file.filename);
            } catch (e) {
              console.error("Error deleting uploaded file:", e);
            }
          }
        }
        return res.status(403).json({ 
          success: false,
          message: `⏸️ Your account is restricted until ${restrictionEnd.toLocaleString()}. Reason: ${user.restrictionReason || 'Administrative action'}`,
          canPost: false
        });
      }
    }
    // ============ END CHECK ============

    const { content, type, event, poll } = req.body;
    // const userId = req.user.userId;
    const files = req.files || [];

    console.log("Content:", content);
    console.log("Type:", type);
    console.log("Files received:", files.length);
    console.log("User ID:", userId);

    // Basic validation
    if (!content && type !== 'poll') {
      return res.status(400).json({ 
        success: false,
        message: 'Post content is required for text and event posts' 
      });
    }

    if (type === 'poll' && (!poll?.question || poll?.options?.length < 2)) {
      return res.status(400).json({ 
        success: false,
        message: 'Poll must have a question and at least 2 options' 
      });
    }

    if (type === 'event' && (!event?.title || !event?.date || !event?.time || !event?.location)) {
      return res.status(400).json({ 
        success: false,
        message: 'Event must have title, date, time, and location' 
      });
    }

    // Process uploaded files
    const media = [];
    if (files.length > 0) {
      for (const file of files) {
        console.log("Processing file:", file.originalname);
        
        media.push({
          type: file.mimetype.startsWith('image/') ? 'image' : 'video',
          url: file.path, // Cloudinary URL
          publicId: file.filename,
          format: file.mimetype.split('/')[1] || '',
          size: file.size || 0,
          uploadedAt: new Date()
        });
      }
    }

    console.log("Processed media:", media);

    // Get user details
    // const user = await db.collection('users').findOne({ _id: new ObjectId(userId) });
    if (!user) {
      return res.status(404).json({ 
        success: false,
        message: 'User not found' 
      });
    }

    // Build post object
    const post = {
      content: content?.trim() || '',
      type: type || 'text',
      media: media,
      userId: new ObjectId(userId),
      likes: [],
      comments: [],
      shareCount: 0,
      shares: [], // FIX: Ensure shares is an array
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Add event data if present
    if (type === 'event' && event) {
      const dateTime = new Date(`${event.date}T${event.time}`);
      if (isNaN(dateTime.getTime())) {
        return res.status(400).json({ 
          success: false,
          message: 'Invalid event date/time' 
        });
      }
      
      post.event = {
        title: event.title,
        description: event.description || '',
        dateTime: dateTime,
        date: event.date,
        time: event.time,
        location: event.location,
        maxAttendees: event.maxAttendees || null,
        attendees: [],
        rsvpCount: 0
      };
    }

    // Add poll data if present
    if (type === 'poll' && poll) {
      post.poll = {
        question: poll.question,
        options: poll.options
          .filter(opt => opt?.trim())
          .map(option => ({
            text: option.trim(),
            votes: 0,
            voters: []
          })),
        totalVotes: 0,
        voters: []
      };
    }

    console.log("Saving post to database...");
    
    // Insert post into database
    const result = await db.collection('posts').insertOne(post);
    const postId = result.insertedId;

    console.log("Post saved with ID:", postId);
    
    // Prepare response
    const postResponse = {
      _id: postId,
      content: post.content,
      type: post.type,
      media: post.media,
      likes: post.likes,
      comments: post.comments,
      shareCount: post.shareCount,
      shares: post.shares,
      createdAt: post.createdAt,
      event: post.event || null,
      poll: post.poll || null,
      user: {
        id: user._id,
        name: user.name,
        profilePhoto: user.profilePhoto,
        role: user.role,
        department: user.department
      }
    };

    console.log("✅ Post created successfully with media!");

    res.status(201).json({
      success: true,
      message: 'Post created successfully with media!',
      post: postResponse
    });

  } catch (error) {
    console.error("❌ MEDIA UPLOAD ERROR:", error);
    console.error("Error stack:", error.stack);
    
    res.status(500).json({ 
      success: false,
      message: 'Server error uploading media',
      error: error.message 
    });
  }
});

// ==================== DELETE POST ROUTE ====================

// Delete a post
app.delete("/api/posts/:id", auth, async (req, res) => {
  try {
    const postId = req.params.id;
    const userId = req.user.userId;

    // Validate postId
    if (!ObjectId.isValid(postId)) {
      return res.status(400).json({ message: 'Invalid post ID' });
    }

    const post = await db.collection('posts').findOne({ _id: new ObjectId(postId) });
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    // Check if user is owner or admin
    const user = await db.collection('users').findOne({ _id: new ObjectId(userId) });
    const isOwner = post.userId.toString() === userId;
    const isAdmin = user.role === 'admin';

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ message: 'Not authorized to delete this post' });
    }

    // Delete associated media from Cloudinary
    if (post.media && post.media.length > 0) {
      for (const mediaItem of post.media) {
        try {
          await cloudinary.uploader.destroy(mediaItem.publicId, {
            resource_type: mediaItem.type === 'video' ? 'video' : 'image'
          });
          console.log(`Deleted media from Cloudinary: ${mediaItem.publicId}`);
        } catch (cloudinaryError) {
          console.error(`Error deleting media from Cloudinary: ${cloudinaryError.message}`);
          // Continue with post deletion even if media deletion fails
        }
      }
    }

    // Delete the post from database
    const result = await db.collection('posts').deleteOne({ _id: new ObjectId(postId) });

    if (result.deletedCount === 0) {
      return res.status(404).json({ message: 'Post not found' });
    }

    res.json({ 
      success: true,
      message: 'Post deleted successfully' 
    });
  } catch (error) {
    console.error("Error deleting post:", error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// ==================== UPDATE POST ROUTE ====================

// Update a post
app.put("/api/posts/:id", auth, async (req, res) => {
  try {
    const postId = req.params.id;
    const userId = req.user.userId;
    const { content } = req.body;

    // Validate postId
    if (!ObjectId.isValid(postId)) {
      return res.status(400).json({ message: 'Invalid post ID' });
    }

    if (!content || !content.trim()) {
      return res.status(400).json({ message: 'Post content is required' });
    }

    // Find the post
    const post = await db.collection('posts').findOne({ _id: new ObjectId(postId) });
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    // Check if user is owner
    if (post.userId.toString() !== userId) {
      return res.status(403).json({ message: 'Not authorized to edit this post' });
    }

    // Update the post
    const updateData = {
      content: content.trim(),
      updatedAt: new Date()
    };

    const result = await db.collection('posts').updateOne(
      { _id: new ObjectId(postId) },
      { $set: updateData }
    );

    if (result.modifiedCount === 0) {
      return res.status(400).json({ message: 'Failed to update post' });
    }

    // Get updated post with user info
    const updatedPost = await db.collection('posts').findOne({ _id: new ObjectId(postId) });
    const user = await db.collection('users').findOne({ _id: new ObjectId(userId) });

    const postResponse = {
      _id: updatedPost._id,
      content: updatedPost.content,
      type: updatedPost.type || 'text',
      media: updatedPost.media || [],
      likes: updatedPost.likes || [],
      comments: updatedPost.comments || [],
      shareCount: updatedPost.shareCount || 0,
      shares: updatedPost.shares || [],
      event: updatedPost.event || null,
      poll: updatedPost.poll || null,
      createdAt: updatedPost.createdAt,
      updatedAt: updatedPost.updatedAt,
      user: {
        id: user?._id,
        name: user?.name || "Unknown User",
        profilePhoto: user?.profilePhoto,
        role: user?.role,
        department: user?.department
      }
    };

    res.json(postResponse);
  } catch (error) {
    console.error("Error updating post:", error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// ==================== YOUR 80-20 ALGORITHM FOR FEED - FIXED DUPLICATE KEY ISSUE ====================

// ==================== FEED WITH NOTIFICATION HIGHLIGHT ====================

app.get("/api/posts", auth, async (req, res) => {
  try {
    const currentUserId = req.user.userId;
    
    // ============ CHECK FOR ALL TYPES OF HIGHLIGHTS ============
    let pinnedPost = null;
    
    // Get highlight from query parameter
    const highlightParam = req.query.highlight;
    
    if (highlightParam) {
      try {
        const highlightData = JSON.parse(highlightParam);
        
        // Check if highlight is still valid (15 seconds)
        const now = Date.now();
        if (highlightData.postId && highlightData.timestamp && 
            (now - highlightData.timestamp < 15000)) {
          
          // Get the pinned post from database
          pinnedPost = await db.collection('posts').findOne({ 
            _id: new ObjectId(highlightData.postId) 
          });
          
          if (pinnedPost) {
            console.log(`🎯 [Backend] Pinning ${highlightData.type || 'unknown'} post to top:`, highlightData.postId);
            console.log(`🎯 [Backend] Source:`, highlightData.source || 'unknown');
            
            // Get user info
            const pinnedPostUser = await db.collection('users').findOne({ 
              _id: new ObjectId(pinnedPost.userId) 
            });
            
            // Add user info
            pinnedPost.user = {
              id: pinnedPostUser._id,
              name: pinnedPostUser.name || "Unknown User",
              profilePhoto: pinnedPostUser.profilePhoto,
              role: pinnedPostUser.role,
              department: pinnedPostUser.department || pinnedPostUser.facultyDepartment,
              isPrivate: Boolean(pinnedPostUser.isPrivate)
            };
            
            // Mark as pinned
            pinnedPost.isPinned = true;
            pinnedPost.pinnedSource = highlightData.type || 'unknown';
            pinnedPost.pinnedFrom = highlightData.source || 'unknown';
            pinnedPost.pinnedUntil = new Date(now + 15000);
          }
        }
      } catch (error) {
        console.error("Error processing highlight:", error);
      }
    }
    
    // Get user connections
    const currentUser = await db.collection('users').findOne(
      { _id: new ObjectId(currentUserId) },
      { projection: { connections: 1, sentRequests: 1, receivedRequests: 1 } }
    );
    
    const userConnections = currentUser?.connections || [];
    const sentRequests = currentUser?.sentRequests || [];
    const receivedRequests = currentUser?.receivedRequests || [];
    
    // Get all posts
    const allPosts = await db.collection('posts').find().sort({ createdAt: -1 }).toArray();
    
    // Categorize posts
    const connectionPosts = [];
    const publicNonConnectionPosts = [];
    const sharedWithMePosts = [];
    const myOwnPosts = [];
    const seenPostIds = new Set();
    
    for (const post of allPosts) {
      const postUser = await db.collection('users').findOne({ _id: new ObjectId(post.userId) });
      
      if (!postUser) continue;
      
      const postId = post._id.toString();
      
      // Skip if already seen
      if (seenPostIds.has(postId)) {
        continue;
      }
      
      const isOwnPost = post.userId.toString() === currentUserId;
      const isConnection = userConnections.includes(post.userId.toString());
      const isPublicUser = postUser.isPrivate === false;
      
      // Check if this post was shared with me
      const wasSharedWithMe = Array.isArray(post.shares) && post.shares.some(share => 
        share.sharedWith && share.sharedWith.includes(currentUserId)
      );
      
      const safeShares = Array.isArray(post.shares) ? post.shares : [];
      
      const postWithUser = {
        ...post,
        _id: post._id,
        shares: safeShares,
        user: {
          id: postUser._id,
          name: postUser.name || "Unknown User",
          profilePhoto: postUser.profilePhoto,
          role: postUser.role,
          department: postUser.department || postUser.facultyDepartment,
          isPrivate: Boolean(postUser.isPrivate)
        },
        wasSharedWithMe: wasSharedWithMe,
        sharedBy: wasSharedWithMe ? safeShares.find(share => 
          share.sharedWith && share.sharedWith.includes(currentUserId)
        )?.userId : null
      };
      
      seenPostIds.add(postId);
      
      // Categorize posts
      if (isOwnPost) {
        myOwnPosts.push(postWithUser);
      }
      else if (wasSharedWithMe) {
        sharedWithMePosts.push(postWithUser);
      } else if (isConnection) {
        connectionPosts.push(postWithUser);
      } else if (isPublicUser) {
        publicNonConnectionPosts.push(postWithUser);
      }
    }
    
    // ==================== 80-20 ALGORITHM ====================
    
    const availableConnections = connectionPosts.length;
    const availablePublic = publicNonConnectionPosts.length;
    const availableShared = sharedWithMePosts.length;
    
    // Calculate 20% of total feed from connections
    const totalFeedIfAllConnections = Math.ceil(availableConnections / 0.8);
    const targetPublicFor20Percent = Math.ceil(totalFeedIfAllConnections * 0.2);
    
    // Take available posts
    const targetPublic = Math.min(targetPublicFor20Percent, availablePublic);
    
    // ============ 2. MIX POSTS WITH PINNED POST AT TOP ============
    const allPostsMixed = [];
    
    // Add pinned post at the VERY TOP if it exists
    if (pinnedPost) {
      console.log("✅ [Backend] Adding pinned post to TOP");
      allPostsMixed.push(pinnedPost);
      
      // Remove pinned post from other categories to avoid duplicates
      const pinnedPostId = pinnedPost._id.toString();
      
      // Function to remove from array
      const removeFromArray = (arr) => {
        const index = arr.findIndex(p => p._id.toString() === pinnedPostId);
        if (index > -1) {
          arr.splice(index, 1);
        }
      };
      
      removeFromArray(myOwnPosts);
      removeFromArray(connectionPosts);
      removeFromArray(publicNonConnectionPosts);
      removeFromArray(sharedWithMePosts);
    }
    
    // Add all other posts
    allPostsMixed.push(
      ...myOwnPosts,
      ...connectionPosts,
      ...publicNonConnectionPosts.slice(0, targetPublic),
      ...sharedWithMePosts
    );
    
    // Remove any remaining duplicates by post ID
    const uniquePostsMap = new Map();
    allPostsMixed.forEach(post => {
      const postId = post._id.toString();
      if (!uniquePostsMap.has(postId)) {
        uniquePostsMap.set(postId, post);
      }
    });
    
    const uniquePostsArray = Array.from(uniquePostsMap.values());
    
    // Shuffle to avoid monotony
    for (let i = uniquePostsArray.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [uniquePostsArray[i], uniquePostsArray[j]] = [uniquePostsArray[j], uniquePostsArray[i]];
    }
    
    // Sort by time (newest first)
    uniquePostsArray.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    // Ensure shares array exists for all posts
    const finalPosts = uniquePostsArray.map(post => ({
      ...post,
      shares: Array.isArray(post.shares) ? post.shares : []
    }));
    
    console.log("├─────────────────────────────────────┤");
    console.log(`│ 20% of total feed: ${targetPublicFor20Percent} posts needed │`);
    console.log(`│ Public posts used: ${targetPublic} posts │`);
    console.log(`│ Shared posts used: ${sharedWithMePosts.length} posts │`);
    console.log("├─────────────────────────────────────┤");
    console.log(`│ FINAL FEED: ${finalPosts.length} total posts      │`);
    if (pinnedPost) {
      console.log(`│ - Pinned:   1 post (from ${pinnedPost.pinnedSource || 'unknown'}) │`);
    } else {
      console.log(`│ - Pinned:   0 posts                           │`);
    }
    console.log(`│ - My Posts: ${myOwnPosts.length} posts           │`);
    console.log(`│ - Friends:  ${connectionPosts.length} posts           │`);
    console.log(`│ - Public:   ${targetPublic} posts           │`);
    console.log(`│ - Shared:   ${sharedWithMePosts.length} posts        │`);
    console.log("└─────────────────────────────────────┘");
    
    res.json(finalPosts);
    
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// ==================== GET SPECIFIC USER'S FEED ====================

// Get feed for a specific user (for profile pages)
app.get("/api/users/:userId/feed", auth, async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user.userId;
    
    // Validate userId
    if (!ObjectId.isValid(userId)) {
      return res.status(400).json({ message: 'Invalid user ID' });
    }
    
    // Get the user's posts
    const userPosts = await db.collection('posts')
      .find({ userId: new ObjectId(userId) })
      .sort({ createdAt: -1 })
      .toArray();
    
    // Get user info
    const user = await db.collection('users').findOne(
      { _id: new ObjectId(userId) },
      { projection: { name: 1, profilePhoto: 1, role: 1, department: 1 } }
    );
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Get posts that were shared with this user
    const sharedPosts = await db.collection('posts')
      .find({
        shares: {
          $elemMatch: {
            sharedWith: { $in: [userId] }
          }
        }
      })
      .sort({ createdAt: -1 })
      .toArray();
    
    // Combine and process posts - Remove duplicates
    const uniquePosts = [];
    const seenPostIds = new Set();
    
    const allPosts = [...userPosts, ...sharedPosts];
    
    for (const post of allPosts) {
      const postId = post._id.toString();
      if (!seenPostIds.has(postId)) {
        seenPostIds.add(postId);
        uniquePosts.push(post);
      }
    }
    
    // Get user info for each post and format response
    const postsWithDetails = await Promise.all(
      uniquePosts.map(async (post) => {
        const postUser = await db.collection('users').findOne(
          { _id: new ObjectId(post.userId) },
          { projection: { name: 1, profilePhoto: 1, role: 1, department: 1 } }
        );
        
        // Check if this post was shared with the current user
        const wasSharedWithCurrentUser = Array.isArray(post.shares) && 
          post.shares.some(share => share.sharedWith && share.sharedWith.includes(currentUserId));
        
        // Check if this post was shared with the target user (for profile page)
        const wasSharedWithTargetUser = Array.isArray(post.shares) && 
          post.shares.some(share => share.sharedWith && share.sharedWith.includes(userId));
        
        return {
          _id: post._id,
          content: post.content,
          type: post.type || 'text',
          media: post.media || [],
          likes: post.likes || [],
          comments: post.comments || [],
          shareCount: post.shareCount || 0,
          shares: Array.isArray(post.shares) ? post.shares : [],
          event: post.event || null,
          poll: post.poll || null,
          createdAt: post.createdAt,
          wasSharedWithCurrentUser,
          wasSharedWithTargetUser,
          sharedBy: wasSharedWithTargetUser ? post.shares?.find(share => 
            share.sharedWith && share.sharedWith.includes(userId)
          )?.userId : null,
          user: {
            id: postUser?._id,
            name: postUser?.name || "Unknown User",
            profilePhoto: postUser?.profilePhoto,
            role: postUser?.role,
            department: postUser?.department
          }
        };
      })
    );
    
    // Sort by date (newest first)
    postsWithDetails.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    res.json({
      success: true,
      posts: postsWithDetails,
      user: {
        id: user._id,
        name: user.name,
        profilePhoto: user.profilePhoto,
        role: user.role
      },
      stats: {
        totalPosts: userPosts.length,
        sharedPosts: sharedPosts.length,
        totalFeed: postsWithDetails.length
      }
    });
    
  } catch (error) {
    console.error("Error fetching user feed:", error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// ==================== GET POSTS SHARED WITH ME ====================

// Get posts that were shared with the current user
app.get("/api/posts/shared-with-me", auth, async (req, res) => {
  try {
    const currentUserId = req.user.userId;
    
    // Find posts where shares.sharedWith includes currentUserId
    const sharedPosts = await db.collection('posts')
      .find({
        shares: {
          $elemMatch: {
            sharedWith: { $in: [currentUserId] }
          }
        }
      })
      .sort({ createdAt: -1 })
      .toArray();
    
    // Remove duplicates
    const uniquePosts = [];
    const seenPostIds = new Set();
    
    for (const post of sharedPosts) {
      const postId = post._id.toString();
      if (!seenPostIds.has(postId)) {
        seenPostIds.add(postId);
        uniquePosts.push(post);
      }
    }
    
    // Get user info for each post
    const postsWithDetails = await Promise.all(
      uniquePosts.map(async (post) => {
        const postUser = await db.collection('users').findOne(
          { _id: new ObjectId(post.userId) },
          { projection: { name: 1, profilePhoto: 1, role: 1, department: 1 } }
        );
        
        // Find who shared it with me
        const shareInfo = Array.isArray(post.shares) ? 
          post.shares.find(share => share.sharedWith && share.sharedWith.includes(currentUserId)) : null;
        
        let sharedByUser = null;
        if (shareInfo?.userId) {
          sharedByUser = await db.collection('users').findOne(
            { _id: new ObjectId(shareInfo.userId) },
            { projection: { name: 1, profilePhoto: 1 } }
          );
        }
        
        return {
          _id: post._id,
          content: post.content,
          type: post.type || 'text',
          media: post.media || [],
          likes: post.likes || [],
          comments: post.comments || [],
          shareCount: post.shareCount || 0,
          shares: Array.isArray(post.shares) ? post.shares : [],
          event: post.event || null,
          poll: post.poll || null,
          createdAt: post.createdAt,
          shareInfo: {
            sharedBy: shareInfo?.userId,
            sharedByName: sharedByUser?.name || "Unknown User",
            sharedByPhoto: sharedByUser?.profilePhoto,
            message: shareInfo?.message || '',
            timestamp: shareInfo?.timestamp
          },
          user: {
            id: postUser?._id,
            name: postUser?.name || "Unknown User",
            profilePhoto: postUser?.profilePhoto,
            role: postUser?.role,
            department: postUser?.department
          }
        };
      })
    );
    
    res.json({
      success: true,
      count: postsWithDetails.length,
      posts: postsWithDetails
    });
    
  } catch (error) {
    console.error("Error fetching shared posts:", error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// ==================== GET SINGLE POST WITH DETAILS ====================

// Get a single post with full details including shares
app.get("/api/posts/:postId/full", auth, async (req, res) => {
  try {
    const { postId } = req.params;
    const currentUserId = req.user.userId;
    
    // Validate postId
    if (!ObjectId.isValid(postId)) {
      return res.status(400).json({ message: 'Invalid post ID' });
    }
    
    const post = await db.collection('posts').findOne({ _id: new ObjectId(postId) });
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }
    
    // Get post owner info
    const postUser = await db.collection('users').findOne(
      { _id: new ObjectId(post.userId) },
      { projection: { name: 1, profilePhoto: 1, role: 1, department: 1 } }
    );
    
    // Check if this post was shared with current user
    const wasSharedWithMe = Array.isArray(post.shares) && 
      post.shares.some(share => share.sharedWith && share.sharedWith.includes(currentUserId));
    
    // Get detailed share information
    const detailedShares = [];
    if (Array.isArray(post.shares)) {
      for (const share of post.shares) {
        if (share.userId) {
          const sharer = await db.collection('users').findOne(
            { _id: new ObjectId(share.userId) },
            { projection: { name: 1, profilePhoto: 1 } }
          );
          
          // Get info about who it was shared with
          const sharedWithUsers = [];
          if (Array.isArray(share.sharedWith)) {
            for (const userId of share.sharedWith) {
              const user = await db.collection('users').findOne(
                { _id: new ObjectId(userId) },
                { projection: { name: 1, profilePhoto: 1 } }
              );
              if (user) {
                sharedWithUsers.push({
                  userId: user._id,
                  name: user.name,
                  profilePhoto: user.profilePhoto
                });
              }
            }
          }
          
          detailedShares.push({
            ...share,
            sharerName: sharer?.name || "Unknown User",
            sharerPhoto: sharer?.profilePhoto,
            sharedWithUsers: sharedWithUsers
          });
        }
      }
    }
    
    const postResponse = {
      _id: post._id,
      content: post.content,
      type: post.type || 'text',
      media: post.media || [],
      likes: post.likes || [],
      comments: post.comments || [],
      shareCount: post.shareCount || 0,
      shares: detailedShares,
      event: post.event || null,
      poll: post.poll || null,
      createdAt: post.createdAt,
      updatedAt: post.updatedAt,
      wasSharedWithMe,
      user: {
        id: postUser?._id,
        name: postUser?.name || "Unknown User",
        profilePhoto: postUser?.profilePhoto,
        role: postUser?.role,
        department: postUser?.department
      }
    };
    
    res.json({
      success: true,
      post: postResponse
    });
    
  } catch (error) {
    console.error("Error fetching post details:", error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// ==================== EVENT RSVP ROUTE ====================

// RSVP to an event
app.post("/api/posts/:id/rsvp", auth, async (req, res) => {
  try {
    const postId = req.params.id;
    const userId = req.user.userId;
    const { status } = req.body; // 'going', 'maybe', 'not-going'

    // Validate postId
    if (!ObjectId.isValid(postId)) {
      return res.status(400).json({ message: 'Invalid post ID' });
    }

    if (!['going', 'maybe', 'not-going'].includes(status)) {
      return res.status(400).json({ message: 'Invalid RSVP status' });
    }

    const post = await db.collection('posts').findOne({ _id: new ObjectId(postId) });
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    if (post.type !== 'event') {
      return res.status(400).json({ message: 'This post is not an event' });
    }

    // Check if event has max attendees
    if (status === 'going' && post.event.maxAttendees) {
      const goingCount = post.event.attendees.filter(a => a.status === 'going').length;
      if (goingCount >= post.event.maxAttendees) {
        return res.status(400).json({ message: 'Event is at full capacity' });
      }
    }

    // Remove existing RSVP if exists
    const updatedAttendees = post.event.attendees.filter(
      attendee => attendee.userId.toString() !== userId
    );

    // Add new RSVP
    updatedAttendees.push({
      userId: userId,
      status: status,
      timestamp: new Date()
    });

    // Calculate RSVP counts
    const goingCount = updatedAttendees.filter(a => a.status === 'going').length;
    const maybeCount = updatedAttendees.filter(a => a.status === 'maybe').length;

    // Update the post
    const updateResult = await db.collection('posts').updateOne(
      { _id: new ObjectId(postId) },
      { 
        $set: { 
          "event.attendees": updatedAttendees,
          "event.rsvpCount": goingCount + maybeCount,
          "event.goingCount": goingCount,
          "event.maybeCount": maybeCount
        } 
      }
    );

    if (updateResult.modifiedCount === 0) {
      return res.status(400).json({ message: 'Failed to update RSVP' });
    }

    // Get updated post
    const updatedPost = await db.collection('posts').findOne({ _id: new ObjectId(postId) });
    const user = await db.collection('users').findOne({ _id: new ObjectId(updatedPost.userId) });

    // Create notification for event creator if not the same user
    if (userId !== post.userId.toString()) {
      const rsvpUser = await db.collection('users').findOne({ _id: new ObjectId(userId) });
      await createNotification({
        recipientId: post.userId.toString(),
        senderId: userId,
        type: "event_rsvp",
        postId: postId,
        message: `${rsvpUser.name} RSVP'd ${status} to your event "${post.event.title}"`
      });
    }

    const postResponse = {
      _id: updatedPost._id,
      content: updatedPost.content,
      type: updatedPost.type,
      media: updatedPost.media || [],
      likes: updatedPost.likes || [],
      comments: updatedPost.comments || [],
      shareCount: updatedPost.shareCount || 0,
      shares: updatedPost.shares || [],
      event: updatedPost.event || null,
      poll: updatedPost.poll || null,
      createdAt: updatedPost.createdAt,
      user: {
        id: user?._id,
        name: user?.name || "Unknown User",
        profilePhoto: user?.profilePhoto,
        role: user?.role,
        department: user?.department
      }
    };

    res.json({
      success: true,
      message: `RSVP ${status} successful!`,
      post: postResponse
    });
  } catch (error) {
    console.error("Error updating RSVP:", error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// ==================== POLL VOTING ROUTE ====================

// Vote on a poll
app.post("/api/posts/:id/vote", auth, async (req, res) => {
  try {
    const postId = req.params.id;
    const userId = req.user.userId;
    const { optionIndex } = req.body;

    // Validate postId
    if (!ObjectId.isValid(postId)) {
      return res.status(400).json({ message: 'Invalid post ID' });
    }

    if (typeof optionIndex !== 'number' || optionIndex < 0) {
      return res.status(400).json({ message: 'Invalid option index' });
    }

    const post = await db.collection('posts').findOne({ _id: new ObjectId(postId) });
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    if (post.type !== 'poll') {
      return res.status(400).json({ message: 'This post is not a poll' });
    }

    // Check if option exists
    if (!post.poll.options[optionIndex]) {
      return res.status(400).json({ message: 'Invalid option index' });
    }

    // Check if user already voted
    const existingVoteIndex = post.poll.voters.findIndex(v => v.userId.toString() === userId);
    
    // If user already voted, remove their previous vote
    if (existingVoteIndex > -1) {
      const previousOptionIndex = post.poll.voters[existingVoteIndex].optionIndex;
      post.poll.options[previousOptionIndex].votes--;
      post.poll.options[previousOptionIndex].voters = post.poll.options[previousOptionIndex].voters.filter(
        v => v.userId.toString() !== userId
      );
      post.poll.voters.splice(existingVoteIndex, 1);
      post.poll.totalVotes--;
    }

    // Add new vote
    post.poll.options[optionIndex].votes++;
    post.poll.options[optionIndex].voters.push({
      userId: userId,
      timestamp: new Date()
    });

    post.poll.voters.push({
      userId: userId,
      optionIndex: optionIndex,
      timestamp: new Date()
    });

    post.poll.totalVotes++;

    // Update the post
    const updateResult = await db.collection('posts').updateOne(
      { _id: new ObjectId(postId) },
      { 
        $set: { 
          poll: post.poll
        } 
      }
    );

    if (updateResult.modifiedCount === 0) {
      return res.status(400).json({ message: 'Failed to update vote' });
    }

    // Get updated post
    const updatedPost = await db.collection('posts').findOne({ _id: new ObjectId(postId) });
    const user = await db.collection('users').findOne({ _id: new ObjectId(updatedPost.userId) });

    // Create notification for poll creator if not the same user
    if (userId !== post.userId.toString()) {
      const voter = await db.collection('users').findOne({ _id: new ObjectId(userId) });
      await createNotification({
        recipientId: post.userId.toString(),
        senderId: userId,
        type: "poll_vote",
        postId,
        message: `${voter.name} voted on your poll "${post.poll.question}"`
      });
    }

    const postResponse = {
      _id: updatedPost._id,
      content: updatedPost.content,
      type: updatedPost.type,
      media: updatedPost.media || [],
      likes: updatedPost.likes || [],
      comments: updatedPost.comments || [],
      shareCount: updatedPost.shareCount || 0,
      shares: updatedPost.shares || [],
      event: updatedPost.event || null,
      poll: updatedPost.poll || null,
      createdAt: updatedPost.createdAt,
      user: {
        id: user?._id,
        name: user?.name || "Unknown User",
        profilePhoto: user?.profilePhoto,
        role: user?.role,
        department: user?.department
      }
    };

    res.json({
      success: true,
      message: 'Vote submitted successfully!',
      post: postResponse
    });
  } catch (error) {
    console.error("Error updating vote:", error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// ==================== SHARE POST ROUTES - IMPROVED FOR ALL FEEDS ====================

// Share post with connections - FIXED VERSION
app.post("/api/posts/:postId/share", auth, async (req, res) => {
  try {
    const { postId } = req.params;
    const { connectionIds, message } = req.body;
    const userId = req.user.userId;

    // ============ ADD RESTRICTION CHECK ============
    const user = await db.collection('users').findOne({ _id: new ObjectId(userId) });
    
    if (user.status === 'restricted' && user.restrictedUntil) {
      const now = new Date();
      const restrictionEnd = new Date(user.restrictedUntil);
      
      if (restrictionEnd > now) {
        return res.status(403).json({ 
          success: false,
          message: `⏸️ Your account is restricted until ${restrictionEnd.toLocaleString()}. You cannot share posts during restriction.`,
          canShare: false
        });
      }
    }
    // ============ END CHECK ============

    // Validate postId
    if (!ObjectId.isValid(postId)) {
      return res.status(400).json({ message: 'Invalid post ID' });
    }

    if (!connectionIds || !Array.isArray(connectionIds) || connectionIds.length === 0) {
      return res.status(400).json({ message: 'Please select at least one connection to share with' });
    }

    const post = await db.collection('posts').findOne({ _id: new ObjectId(postId) });
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    // Get current user info
    const currentUser = await db.collection('users').findOne({ _id: new ObjectId(userId) });
    if (!currentUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    const postOwner = await db.collection('users').findOne({ _id: new ObjectId(post.userId) });
    
    // Get original post content preview (first 100 chars)
    const postPreview = post.content.length > 100 ? post.content.substring(0, 100) + '...' : post.content;
    
    // Send notification to each selected connection
    const notifications = [];
    const successfullySharedWith = [];
    
    for (const connectionId of connectionIds) {
      // Validate connection exists and is actually a connection
      const isConnected = currentUser.connections?.includes(connectionId);
      if (!isConnected) {
        console.log(`User ${connectionId} is not a connection, skipping notification`);
        continue;
      }

      // Create personalized message
      const notificationMessage = message 
        ? `${currentUser.name} shared a post with you: "${message}"`
        : `${currentUser.name} shared ${post.userId.toString() === userId ? 'their post' : `${postOwner?.name || 'someone'}'s post`} with you`;
      
      const notification = await createNotification({
        recipientId: connectionId,
        senderId: userId,
        type: "post_shared",
        postId: postId,
        message: notificationMessage
      });
      
      if (notification) {
        notifications.push({
          userId: connectionId,
          success: true
        });
        successfullySharedWith.push(connectionId);
      }
    }

    // FIXED: Safely handle shares field - check if it exists and is an array
    const currentShares = Array.isArray(post.shares) ? post.shares : [];
    
    // Check if user already shared with any of these connections
    const existingShareIndex = currentShares.findIndex(share => share.userId === userId);
    
    let updatedShares;
    if (existingShareIndex > -1) {
      // Update existing share entry
      const existingShare = currentShares[existingShareIndex];
      const combinedSharedWith = [...new Set([...existingShare.sharedWith, ...successfullySharedWith])];
      currentShares[existingShareIndex] = {
        ...existingShare,
        sharedWith: combinedSharedWith,
        timestamp: new Date(),
        message: message || existingShare.message
      };
      updatedShares = currentShares;
    } else {
      // Create new share entry
      updatedShares = [...currentShares, {
        userId: userId,
        sharedWith: successfullySharedWith,
        timestamp: new Date(),
        message: message || ''
      }];
    }
    
    // Increment share count on post and update shares array
    const shareIncrement = existingShareIndex > -1 ? 0 : 1; // Only increment if it's a new share
    
    await db.collection('posts').updateOne(
      { _id: new ObjectId(postId) },
      { 
        $inc: { shareCount: shareIncrement },
        $set: { 
          shares: updatedShares
        }
      }
    );

    // Emit real-time update to all users who might be viewing this post
    const updatedPost = await db.collection('posts').findOne({ _id: new ObjectId(postId) });
    const postUser = await db.collection('users').findOne({ _id: new ObjectId(updatedPost.userId) });
    
    const postResponse = {
      _id: updatedPost._id,
      content: updatedPost.content,
      type: updatedPost.type,
      media: updatedPost.media || [],
      likes: updatedPost.likes || [],
      comments: updatedPost.comments || [],
      shareCount: updatedPost.shareCount || 0,
      shares: updatedPost.shares || [],
      event: updatedPost.event || null,
      poll: updatedPost.poll || null,
      createdAt: updatedPost.createdAt,
      user: {
        id: postUser?._id,
        name: postUser?.name || "Unknown User",
        profilePhoto: postUser?.profilePhoto,
        role: postUser?.role,
        department: postUser?.department
      }
    };
    
    // Emit to post owner and all users who were shared with
    const usersToNotify = [...successfullySharedWith, post.userId.toString()];
    usersToNotify.forEach(userIdToNotify => {
      emitToUser(userIdToNotify, "post_updated", {
        postId: postId,
        post: postResponse,
        action: "shared"
      });
    });

    res.json({
      success: true,
      message: `Post shared with ${notifications.length} connection(s)`,
      sharedWithCount: notifications.length,
      notifications,
      post: postResponse
    });

  } catch (error) {
    console.error("Error sharing post:", error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get connections for sharing modal
app.get("/api/posts/:postId/share/connections", auth, async (req, res) => {
  try {
    const { postId } = req.params;
    const userId = req.user.userId;

    // Validate postId
    if (!ObjectId.isValid(postId)) {
      return res.status(400).json({ message: 'Invalid post ID' });
    }

    const post = await db.collection('posts').findOne({ _id: new ObjectId(postId) });
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    // Get current user's connections
    const currentUser = await db.collection('users').findOne(
      { _id: new ObjectId(userId) },
      { projection: { connections: 1 } }
    );

    const connectionIds = currentUser?.connections || [];
    
    // Get detailed connection info
    const connections = await db.collection('users')
      .find({ _id: { $in: connectionIds.map(id => new ObjectId(id)) } })
      .project({
        _id: 1,
        name: 1,
        email: 1,
        profilePhoto: 1,
        role: 1,
        department: 1
      })
      .toArray();

    // Get already shared connections
    const alreadySharedWith = [];
    if (Array.isArray(post.shares)) {
      const userShare = post.shares.find(share => share.userId === userId);
      if (userShare && Array.isArray(userShare.sharedWith)) {
        alreadySharedWith.push(...userShare.sharedWith);
      }
    }

    // Mark connections as already shared
    const connectionsWithStatus = connections.map(conn => ({
      ...conn,
      alreadyShared: alreadySharedWith.includes(conn._id.toString())
    }));

    res.json({
      success: true,
      connections: connectionsWithStatus,
      totalConnections: connections.length,
      alreadySharedCount: alreadySharedWith.length
    });

  } catch (error) {
    console.error("Error fetching connections for sharing:", error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get post share data - IMPROVED VERSION
app.get("/api/posts/:postId/shares", auth, async (req, res) => {
  try {
    const { postId } = req.params;
    const userId = req.user.userId;

    if (!ObjectId.isValid(postId)) {
      return res.status(400).json({ message: 'Invalid post ID' });
    }

    const post = await db.collection('posts').findOne(
      { _id: new ObjectId(postId) },
      { projection: { shares: 1, shareCount: 1, userId: 1 } }
    );

    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    // FIX: Ensure shares is an array
    const shares = Array.isArray(post.shares) ? post.shares : [];
    
    // Get detailed information about who shared the post
    const detailedShares = [];
    for (const share of shares) {
      const sharer = await db.collection('users').findOne(
        { _id: new ObjectId(share.userId) },
        { projection: { name: 1, profilePhoto: 1 } }
      );
      
      // Get info about who it was shared with
      const sharedWithUsers = [];
      if (Array.isArray(share.sharedWith)) {
        for (const sharedUserId of share.sharedWith) {
          const user = await db.collection('users').findOne(
            { _id: new ObjectId(sharedUserId) },
            { projection: { name: 1, profilePhoto: 1 } }
          );
          if (user) {
            sharedWithUsers.push({
              userId: user._id,
              name: user.name,
              profilePhoto: user.profilePhoto
            });
          }
        }
      }
      
      detailedShares.push({
        ...share,
        sharerName: sharer?.name || "Unknown User",
        sharerPhoto: sharer?.profilePhoto,
        sharedWithUsers: sharedWithUsers
      });
    }

    // Get user's connections
    const user = await db.collection('users').findOne(
      { _id: new ObjectId(userId) },
      { projection: { connections: 1 } }
    );

    const connections = user?.connections || [];

    res.json({
      success: true,
      shareCount: post.shareCount || 0,
      shares: detailedShares,
      userConnections: connections,
      hasShared: shares.some(share => share.userId === userId)
    });

  } catch (error) {
    console.error("Error fetching post shares:", error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// ==================== UNSHARE POST ROUTE ====================

// Unshare a post (remove from shares)
app.post("/api/posts/:postId/unshare", auth, async (req, res) => {
  try {
    const { postId } = req.params;
    const { connectionIds } = req.body; // Optional: specific connections to unshare from
    const userId = req.user.userId;

    if (!ObjectId.isValid(postId)) {
      return res.status(400).json({ message: 'Invalid post ID' });
    }

    const post = await db.collection('posts').findOne({ _id: new ObjectId(postId) });
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    const currentShares = Array.isArray(post.shares) ? post.shares : [];
    const userShareIndex = currentShares.findIndex(share => share.userId === userId);
    
    if (userShareIndex === -1) {
      return res.status(400).json({ message: 'You have not shared this post' });
    }

    const userShare = currentShares[userShareIndex];
    let updatedShares = [...currentShares];
    let removedCount = 0;

    if (connectionIds && Array.isArray(connectionIds) && connectionIds.length > 0) {
      // Remove specific connections
      const remainingConnections = userShare.sharedWith.filter(
        connId => !connectionIds.includes(connId)
      );
      
      if (remainingConnections.length === 0) {
        // Remove the entire share entry if no connections left
        updatedShares.splice(userShareIndex, 1);
        removedCount = userShare.sharedWith.length;
      } else {
        // Update the share entry with remaining connections
        updatedShares[userShareIndex] = {
          ...userShare,
          sharedWith: remainingConnections,
          timestamp: new Date()
        };
        removedCount = userShare.sharedWith.length - remainingConnections.length;
      }
    } else {
      // Remove entire share entry
      updatedShares.splice(userShareIndex, 1);
      removedCount = userShare.sharedWith.length;
    }

    // Update the post
    await db.collection('posts').updateOne(
      { _id: new ObjectId(postId) },
      { 
        $set: { shares: updatedShares }
      }
    );

    res.json({
      success: true,
      message: `Post unshared from ${removedCount} connection(s)`,
      removedCount
    });

  } catch (error) {
    console.error("Error unsharing post:", error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// ==================== COMMENT ROUTES (YOUR IMPROVED VERSION) ====================

// Add comment to post with UNIQUE ID
app.post("/api/posts/:postId/comment", auth, async (req, res) => {
  try {
 // ============ ADD THIS CHECK ============
    const userId = req.user.userId;
    const user = await db.collection('users').findOne({ _id: new ObjectId(userId) });
    
    if (user.status === 'restricted' && user.restrictedUntil) {
      const now = new Date();
      const restrictionEnd = new Date(user.restrictedUntil);
      
      if (restrictionEnd > now) {
        return res.status(403).json({ 
          success: false,
          message: `⏸️ Your account is restricted until ${restrictionEnd.toLocaleString()}. You cannot comment during restriction.`,
          canComment: false
        });
      }
    }
    // ============ END CHECK ============

    const { content } = req.body;
    const postId = req.params.postId;
    // const userId = req.user.userId;

    if (!content || !content.trim()) {
      return res.status(400).json({ message: 'Comment content is required' });
    }

    // Validate postId
    if (!ObjectId.isValid(postId)) {
      return res.status(400).json({ message: 'Invalid post ID' });
    }

    // Get user info for comment
    // const user = await db.collection('users').findOne({ _id: new ObjectId(userId) });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const post = await db.collection('posts').findOne({ _id: new ObjectId(postId) });
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    // Create comment with UNIQUE ID
    const comment = {
      _id: new ObjectId(), // ← THIS IS THE KEY! Add unique ID
      content: content.trim(),
      userId: userId,
      userName: user.name,
      userProfilePhoto: user.profilePhoto,
      timestamp: new Date(),
      likes: [] // Add likes array for consistency
    };

    await db.collection('posts').updateOne(
      { _id: new ObjectId(postId) },
      { $push: { comments: comment } }
    );

    // Create notification for post owner if commenter is not the owner
    if (userId !== post.userId.toString()) {
      await createNotification({
        recipientId: post.userId,
        senderId: userId,
        type: "comment",
        postId,
        message: `${user.name} commented on your post`
      });
    }

    // Get updated post
    const updatedPost = await db.collection('posts').findOne({ _id: new ObjectId(postId) });
    const postUser = await db.collection('users').findOne({ _id: new ObjectId(updatedPost.userId) });
    
    const postResponse = {
      _id: updatedPost._id,
      content: updatedPost.content,
      type: updatedPost.type || 'text',
      media: updatedPost.media || [],
      likes: updatedPost.likes || [],
      comments: updatedPost.comments || [],
      shareCount: updatedPost.shareCount || 0,
      shares: updatedPost.shares || [],
      event: updatedPost.event || null,
      poll: updatedPost.poll || null,
      createdAt: updatedPost.createdAt,
      user: {
        id: postUser?._id,
        name: postUser?.name || "Unknown User",
        profilePhoto: postUser?.profilePhoto,
        role: postUser?.role,
        department: postUser?.department
      }
    };

    res.json({
      message: 'Comment added successfully',
      post: postResponse
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Edit comment
app.put("/api/posts/:postId/comments/:commentId", auth, async (req, res) => {
  try {
    const { postId, commentId } = req.params;
    const { content } = req.body;
    const userId = req.user.userId;

    if (!content || !content.trim()) {
      return res.status(400).json({ message: 'Comment content is required' });
    }

    const post = await db.collection('posts').findOne({ _id: new ObjectId(postId) });
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    // Find the comment
    const commentIndex = post.comments.findIndex(
      comment => comment._id?.toString() === commentId || 
                 (comment.userId === userId && !comment._id)
    );

    if (commentIndex === -1) {
      return res.status(404).json({ message: 'Comment not found' });
    }

    // Check if user is the comment owner
    if (post.comments[commentIndex].userId !== userId) {
      return res.status(403).json({ message: 'Not authorized to edit this comment' });
    }

    // Update the comment
    post.comments[commentIndex].content = content.trim();
    post.comments[commentIndex].updatedAt = new Date();

    await db.collection('posts').updateOne(
      { _id: new ObjectId(postId) },
      { $set: { comments: post.comments } }
    );

    // Get updated post with user info
    const updatedPost = await db.collection('posts').findOne({ _id: new ObjectId(postId) });
    const postUser = await db.collection('users').findOne({ _id: new ObjectId(updatedPost.userId) });
    
    const postResponse = {
      _id: updatedPost._id,
      content: updatedPost.content,
      type: updatedPost.type || 'text',
      media: updatedPost.media || [],
      likes: updatedPost.likes || [],
      comments: updatedPost.comments || [],
      shareCount: updatedPost.shareCount || 0,
      shares: updatedPost.shares || [],
      createdAt: updatedPost.createdAt,
      user: {
        id: postUser?._id,
        name: postUser?.name || "Unknown User",
        profilePhoto: postUser?.profilePhoto,
        role: postUser?.role,
        department: postUser?.department
      }
    };

    res.json({
      message: 'Comment updated successfully',
      post: postResponse
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Delete comment
app.delete("/api/posts/:postId/comments/:commentId", auth, async (req, res) => {
  try {
    const { postId, commentId } = req.params;
    const userId = req.user.userId;

    // Validate IDs
    if (!ObjectId.isValid(postId) || !ObjectId.isValid(commentId)) {
      return res.status(400).json({ message: 'Invalid ID format' });
    }

    // Find the post
    const post = await db.collection('posts').findOne({ _id: new ObjectId(postId) });
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    // Find the specific comment by its _id
    const commentIndex = post.comments?.findIndex(
      comment => comment._id && comment._id.toString() === commentId
    );

    if (commentIndex === -1) {
      return res.status(404).json({ message: 'Comment not found' });
    }

    // Check if user owns the comment
    if (post.comments[commentIndex].userId !== userId) {
      return res.status(403).json({ message: 'Not authorized to delete this comment' });
    }

    // Remove the specific comment
    post.comments.splice(commentIndex, 1);

    await db.collection('posts').updateOne(
      { _id: new ObjectId(postId) },
      { $set: { comments: post.comments } }
    );

    // Get updated post
    const updatedPost = await db.collection('posts').findOne({ _id: new ObjectId(postId) });
    const postUser = await db.collection('users').findOne({ _id: new ObjectId(updatedPost.userId) });
    
    const postResponse = {
      _id: updatedPost._id,
      content: updatedPost.content,
      type: updatedPost.type || 'text',
      media: updatedPost.media || [],
      likes: updatedPost.likes || [],
      comments: updatedPost.comments || [],
      shareCount: updatedPost.shareCount || 0,
      shares: updatedPost.shares || [],
      event: updatedPost.event || null,
      poll: updatedPost.poll || null,
      createdAt: updatedPost.createdAt,
      user: {
        id: postUser?._id,
        name: postUser?.name || "Unknown User",
        profilePhoto: postUser?.profilePhoto,
        role: postUser?.role,
        department: postUser?.department
      }
    };

    res.json({
      message: 'Comment deleted successfully',
      post: postResponse
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Like/unlike comment
app.post("/api/posts/:postId/comments/:commentId/like", auth, async (req, res) => {
  try {
    const { postId, commentId } = req.params;
    const userId = req.user.userId;

    const post = await db.collection('posts').findOne({ _id: new ObjectId(postId) });
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    // Find the comment
    const commentIndex = post.comments.findIndex(
      comment => comment._id?.toString() === commentId || 
                 (comment.userId === userId && !comment._id)
    );

    if (commentIndex === -1) {
      return res.status(404).json({ message: 'Comment not found' });
    }

    // Initialize likes array if it doesn't exist
    if (!post.comments[commentIndex].likes) {
      post.comments[commentIndex].likes = [];
    }

    // Check if user already liked the comment
    const likeIndex = post.comments[commentIndex].likes.indexOf(userId);
    
    if (likeIndex > -1) {
      // Unlike
      post.comments[commentIndex].likes.splice(likeIndex, 1);
    } else {
      // Like
      post.comments[commentIndex].likes.push(userId);
    }

    await db.collection('posts').updateOne(
      { _id: new ObjectId(postId) },
      { $set: { comments: post.comments } }
    );

    // Get updated post with user info
    const updatedPost = await db.collection('posts').findOne({ _id: new ObjectId(postId) });
    const postUser = await db.collection('users').findOne({ _id: new ObjectId(updatedPost.userId) });
    
    const postResponse = {
      _id: updatedPost._id,
      content: updatedPost.content,
      type: updatedPost.type || 'text',
      media: updatedPost.media || [],
      likes: updatedPost.likes || [],
      comments: updatedPost.comments || [],
      shareCount: updatedPost.shareCount || 0,
      shares: updatedPost.shares || [],
      createdAt: updatedPost.createdAt,
      user: {
        id: postUser?._id,
        name: postUser?.name || "Unknown User",
        profilePhoto: postUser?.profilePhoto,
        role: postUser?.role,
        department: postUser?.department
      }
    };

    res.json({
      message: likeIndex > -1 ? 'Comment unliked' : 'Comment liked',
      post: postResponse
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// ==================== LIKE/UNLIKE POST (YOUR IMPROVED VERSION) ====================

app.post("/api/posts/:postId/like", auth, async (req, res) => {
  try {

 // ============ ADD THIS CHECK ============
    const userId = req.user.userId;
    const user = await db.collection('users').findOne({ _id: new ObjectId(userId) });
    
    if (user.status === 'restricted' && user.restrictedUntil) {
      const now = new Date();
      const restrictionEnd = new Date(user.restrictedUntil);
      
      if (restrictionEnd > now) {
        return res.status(403).json({ 
          success: false,
          message: `⏸️ Your account is restricted until ${restrictionEnd.toLocaleString()}. You cannot like posts during restriction.`,
          canLike: false
        });
      }
    }

    const { postId } = req.params;
    // const userId = req.user.userId;

    // Validate postId
    if (!ObjectId.isValid(postId)) {
      return res.status(400).json({ message: 'Invalid post ID' });
    }

    const post = await db.collection('posts').findOne({ _id: new ObjectId(postId) });
    if (!post) return res.status(404).json({ message: "Post not found" });

    const postOwnerId = post.userId.toString();

    // Initialize likes as array of objects if it doesn't exist
    if (!post.likes) post.likes = [];
    
    // Get user info for the liker
    // const user = await db.collection('users').findOne({ _id: new ObjectId(userId) });
    
    // Check if user already liked the post
    const existingLikeIndex = post.likes.findIndex(like => {
      // Handle both formats: string userId or object with userId
      if (typeof like === 'string') {
        return like === userId;
      } else if (like && like.userId) {
        return like.userId === userId;
      }
      return false;
    });

    if (existingLikeIndex > -1) {
      // Unlike: remove the like
      post.likes.splice(existingLikeIndex, 1);
    } else {
      // Like: add with timestamp and user info
      const likeObject = {
        userId: userId,
        userName: user.name,
        userProfilePhoto: user.profilePhoto,
        timestamp: new Date()
      };
      post.likes.push(likeObject);
    }

    await db.collection('posts').updateOne(
      { _id: new ObjectId(postId) },
      { $set: { likes: post.likes } }
    );

    // Get updated post with populated user info
    const updatedPost = await db.collection('posts').findOne({ _id: new ObjectId(postId) });
    const postUser = await db.collection('users').findOne({ _id: new ObjectId(updatedPost.userId) });

    // SEND NOTIFICATION ONLY IF:
    // 1. it's a new like AND
    // 2. liker is NOT the owner
    if (existingLikeIndex === -1 && userId !== postOwnerId) {
      const liker = await db.collection('users').findOne(
        { _id: new ObjectId(userId) },
        { projection: { name: 1, profilePhoto: 1 } }
      );

      if (liker) { 
        await createNotification({
          recipientId: postOwnerId,
          senderId: userId,
          type: "like",
          postId,
          message: `${liker.name} liked your post`
        });
      }
    }

    const postResponse = {
      _id: updatedPost._id,
      content: updatedPost.content,
      type: updatedPost.type || 'text',
      media: updatedPost.media || [],
      likes: updatedPost.likes || [],
      comments: updatedPost.comments || [],
      shareCount: updatedPost.shareCount || 0,
      shares: updatedPost.shares || [],
      event: updatedPost.event || null,
      poll: updatedPost.poll || null,
      createdAt: updatedPost.createdAt,
      user: {
        id: postUser?._id,
        name: postUser?.name || "Unknown User",
        profilePhoto: postUser?.profilePhoto,
        role: postUser?.role,
        department: postUser?.department
      }
    };

    res.json(postResponse);
  } catch (error) {
    console.error("Error in like route:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// ==================== USER SEARCH ROUTES ====================

// Search users by name or email (for the search bar) - WORKING VERSION
app.get("/api/users/search", auth, async (req, res) => {
  console.log("🔍 SEARCH ENDPOINT CALLED");
  
  try {
    const { name } = req.query;
    const currentUserId = req.user.userId;

    console.log("Searching for:", name);
    console.log("Current user ID:", currentUserId);

    // Validate input
    if (!name || name.trim().length === 0) {
      return res.status(400).json({ 
        success: false,
        message: 'Search query is required' 
      });
    }

    // Build search query
    const searchQuery = {
      name: { $regex: name.trim(), $options: 'i' }
    };

    console.log("Search query:", searchQuery);

    // Check if currentUserId is valid ObjectId
    if (currentUserId && ObjectId.isValid(currentUserId)) {
      try {
        searchQuery._id = { $ne: new ObjectId(currentUserId) };
      } catch (error) {
        console.log("Could not create ObjectId, skipping user exclusion:", error.message);
      }
    }

    // Execute search
    const users = await db.collection('users')
      .find(searchQuery)
      .project({
        _id: 1,
        name: 1,
        email: 1,
        profilePhoto: 1,
        role: 1,
        department: 1,
        designation: 1,
        bio: 1,
        skills: 1,
        year: 1
      })
      .toArray();

    console.log(`✅ Found ${users.length} users`);

    // Format response
    const formattedUsers = users.map(user => ({
      _id: user._id,
      id: user._id,
      name: user.name || '',
      email: user.email || '',
      profilePhoto: user.profilePhoto || '',
      role: user.role || 'student',
      department: user.department || '',
      designation: user.designation || '',
      bio: user.bio || '',
      skills: user.skills || [],
      year: user.year || ''
    }));

    res.json(formattedUsers);

  } catch (error) {
    console.error("❌ SEARCH ERROR:", error);
    console.error("Error stack:", error.stack);
    
    res.status(500).json({ 
      success: false,
      message: 'Server error during search',
      error: error.message
    });
  }
});

// ==================== POST SEARCH ROUTES ====================

// Search posts by content (like LinkedIn search)
app.get("/api/posts/search", auth, async (req, res) => {
  try {
    const { q } = req.query; // Search query
    const userId = req.user.userId;

    if (!q || q.trim().length === 0) {
      return res.status(400).json({ message: 'Search query is required' });
    }

    // Create search query for posts
    const searchQuery = {
      $or: [
        { content: { $regex: q, $options: 'i' } }, // Search in content
        { "event.title": { $regex: q, $options: 'i' } }, // Search in event titles
        { "poll.question": { $regex: q, $options: 'i' } } // Search in poll questions
      ]
    };

    // Find posts matching the search
    const posts = await db.collection('posts')
      .find(searchQuery)
      .sort({ createdAt: -1 })
      .limit(50)
      .toArray();

    // Get user data for each post
    const postsWithUsers = await Promise.all(
      posts.map(async (post) => {
        const user = await db.collection('users').findOne({ _id: new ObjectId(post.userId) });
        
        // Check if this post was shared with the current user
        const wasSharedWithMe = Array.isArray(post.shares) && 
          post.shares.some(share => share.sharedWith && share.sharedWith.includes(userId));
        
        return {
          _id: post._id,
          content: post.content,
          type: post.type || 'text',
          media: post.media || [],
          likes: post.likes || [],
          comments: post.comments || [],
          shareCount: post.shareCount || 0,
          shares: Array.isArray(post.shares) ? post.shares : [],
          event: post.event || null,
          poll: post.poll || null,
          createdAt: post.createdAt,
          wasSharedWithMe,
          user: {
            id: user?._id,
            name: user?.name || "Unknown User",
            profilePhoto: user?.profilePhoto,
            role: user?.role,
            department: user?.department
          }
        };
      })
    );

    res.json({
      success: true,
      count: postsWithUsers.length,
      query: q,
      results: postsWithUsers
    });
  } catch (error) {
    console.error("Post search error:", error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// ==================== USER PROFILE ENDPOINTS ====================

// Get user by ID (for viewing other users' profiles)
app.get("/api/users/:userId", auth, async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user.userId;

    // Validate userId is a valid ObjectId
    if (!ObjectId.isValid(userId)) {
      return res.status(400).json({ message: 'Invalid user ID format' });
    }

    // Check if the requested user exists
    const user = await db.collection('users').findOne(
      { _id: new ObjectId(userId) },
      { 
        projection: { 
          password: 0,  // Exclude password
          sentRequests: 0, // Exclude sensitive network data
          receivedRequests: 0,
          warnings: 0,
          warningCount: 0,
          isVerified: 0,
          updatedAt: 0
        } 
      }
    );

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Convert to response format
    const userResponse = { ...user };
    userResponse.id = userResponse._id;

    // Ensure arrays exist
    userResponse.skills = userResponse.skills || [];
    userResponse.connections = userResponse.connections || [];
    userResponse.followers = userResponse.followers || [];
    userResponse.following = userResponse.following || [];

    res.json(userResponse);
  } catch (error) {
    console.error("Error fetching user:", error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get user's posts for profile page WITH CONNECTION CHECK
app.get("/api/users/:userId/posts", auth, async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user.userId;

    // Validate userId is a valid ObjectId
    if (!ObjectId.isValid(userId)) {
      return res.status(400).json({ message: 'Invalid user ID format' });
    }

    // Don't need connection check if viewing own profile
    if (currentUserId === userId) {
      const posts = await db.collection('posts')
        .find({ userId: new ObjectId(userId) })
        .sort({ createdAt: -1 })
        .limit(20)
        .toArray();

      // Get user data for each post
      const user = await db.collection('users').findOne(
        { _id: new ObjectId(userId) },
        { projection: { name: 1, profilePhoto: 1, role: 1, department: 1 } }
      );

      const postsWithUser = posts.map(post => ({
        ...post,
        shares: Array.isArray(post.shares) ? post.shares : [],
        user: {
          id: user?._id,
          name: user?.name || "Unknown User",
          profilePhoto: user?.profilePhoto,
          role: user?.role,
          department: user?.department
        }
      }));

      return res.json(postsWithUser);
    }

    // For viewing other users' profiles: CHECK CONNECTION STATUS
    const currentUser = await db.collection('users').findOne(
      { _id: new ObjectId(currentUserId) },
      { projection: { connections: 1, sentRequests: 1, receivedRequests: 1 } }
    );

    const targetUser = await db.collection('users').findOne(
      { _id: new ObjectId(userId) },
      { projection: { isPrivate: 1, name: 1, profilePhoto: 1, role: 1, department: 1 } }
    );

    if (!targetUser) {
      return res.status(404).json({ message: 'User not found' });
    }
// To this:
const isConnected = (currentUser?.connections || []).some(connId => 
  connId.toString() === userId
);
    // If target user is private AND not connected, deny access
    if (targetUser.isPrivate && !isConnected) {
      return res.status(403).json({ 
        message: 'Cannot view posts. User is private or not connected.',
        isPrivate: true,
        isConnected: false
      });
    }

    // If connected or public user, fetch posts
    const posts = await db.collection('posts')
      .find({ userId: new ObjectId(userId) })
      .sort({ createdAt: -1 })
      .limit(20)
      .toArray();

    // Also get posts that were shared with current user by this user
    const sharedPosts = await db.collection('posts')
      .find({
        userId: new ObjectId(userId),
        shares: {
          $elemMatch: {
            sharedWith: { $in: [currentUserId] }
          }
        }
      })
      .sort({ createdAt: -1 })
      .toArray();

    // Combine and remove duplicates
    const allPosts = [...posts, ...sharedPosts];
    const uniquePosts = [];
    const seenPostIds = new Set();

    for (const post of allPosts) {
      const postId = post._id.toString();
      if (!seenPostIds.has(postId)) {
        seenPostIds.add(postId);
        uniquePosts.push(post);
      }
    }

    const postsWithUser = uniquePosts.map(post => ({
      ...post,
      shares: Array.isArray(post.shares) ? post.shares : [],
      // Check if this specific post was shared with current user
      wasSharedWithMe: Array.isArray(post.shares) && 
        post.shares.some(share => share.sharedWith && share.sharedWith.includes(currentUserId)),
      user: {
        id: targetUser._id,
        name: targetUser.name || "Unknown User",
        profilePhoto: targetUser.profilePhoto,
        role: targetUser.role,
        department: targetUser.department
      }
    }));

    res.json(postsWithUser);
  } catch (error) {
    console.error("Error fetching user posts:", error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// ==================== USER ACTIVITY ENDPOINT ====================

// Get user activity (likes and comments)
app.get("/api/users/:userId/activity", auth, async (req, res) => {
  try {
    const userId = req.params.userId;
    
    if (!ObjectId.isValid(userId)) {
      return res.status(400).json({ message: 'Invalid user ID' });
    }
    
    // Get all posts
    const posts = await db.collection('posts').find().toArray();
    
    const userActivity = [];
    
    posts.forEach(post => {
      // Check if user liked this post
      const hasLiked = post.likes && post.likes.some(like => 
        typeof like === 'string' ? like === userId : like.userId === userId
      );
      
      // Check if user commented on this post
      const userComments = post.comments ? 
        post.comments.filter(comment => comment.userId === userId) : [];
      
      // Check if user shared this post
      const userShares = Array.isArray(post.shares) ? 
        post.shares.filter(share => share.userId === userId) : [];
      
      if (hasLiked || userComments.length > 0 || userShares.length > 0) {
        // Get post owner info for activity
        const postOwnerId = post.userId.toString();
        
        if (hasLiked) {
          userActivity.push({
            type: 'like',
            postId: post._id,
            postContent: post.content.substring(0, 100) + (post.content.length > 100 ? '...' : ''),
            postType: post.type || 'text',
            postOwnerId: postOwnerId,
            postOwnerName: 'User', // We'll populate later
            timestamp: post.createdAt
          });
        }
        
        // Add comment activities
        userComments.forEach(comment => {
          userActivity.push({
            type: 'comment',
            postId: post._id,
            postContent: post.content.substring(0, 100) + (post.content.length > 100 ? '...' : ''),
            commentContent: comment.content.substring(0, 100) + (comment.content.length > 100 ? '...' : ''),
            postType: post.type || 'text',
            postOwnerId: postOwnerId,
            postOwnerName: 'User', // We'll populate later
            timestamp: comment.timestamp
          });
        });
        
        // Add share activities
        userShares.forEach(share => {
          userActivity.push({
            type: 'share',
            postId: post._id,
            postContent: post.content.substring(0, 100) + (post.content.length > 100 ? '...' : ''),
            postType: post.type || 'text',
            postOwnerId: postOwnerId,
            postOwnerName: 'User', // We'll populate later
            sharedWithCount: Array.isArray(share.sharedWith) ? share.sharedWith.length : 0,
            timestamp: share.timestamp
          });
        });
      }
    });
    
    // Get post owner names for all activities
    for (let activity of userActivity) {
      try {
        const postOwner = await db.collection('users').findOne(
          { _id: new ObjectId(activity.postOwnerId) },
          { projection: { name: 1 } }
        );
        activity.postOwnerName = postOwner?.name || 'Unknown User';
      } catch (err) {
        activity.postOwnerName = 'Unknown User';
      }
    }
    
    // Sort by timestamp (newest first)
    userActivity.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    res.json({
      success: true,
      count: userActivity.length,
      activity: userActivity.slice(0, 50) // Limit to 50 items
    });
    
  } catch (error) {
    console.error("Error fetching user activity:", error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// ==================== USERS ROUTES (FOR NETWORK PAGE) ====================

// Get all users (excluding current user) for network page
app.get("/api/users", auth, async (req, res) => {
  try {
    const currentUserId = req.user.userId;
    
    const currentUser = await db.collection('users').findOne(
      { _id: new ObjectId(currentUserId) },
      { projection: { connections: 1, sentRequests: 1, receivedRequests: 1 } }
    );

    // Build exclude array
    const excludeIds = [
      new ObjectId(currentUserId),
      ...(currentUser?.connections || []).map(id => new ObjectId(id)),
      ...(currentUser?.sentRequests || []).map(id => new ObjectId(id)),
      ...(currentUser?.receivedRequests || []).map(id => new ObjectId(id))
    ];

    // Get users excluding current user and connections
    const users = await db.collection('users')
      .find({ _id: { $nin: excludeIds } })
      .project({
        _id: 1,
        name: 1,
        email: 1,
        profilePhoto: 1,
        role: 1,
        department: 1,           // Keep this
        facultyDepartment: 1,    // Keep this
        designation: 1,
        bio: 1,
        skills: 1,
        year: 1,
        company: 1,              // Add this
        createdAt: 1             // Add this for timestamp
      })
      .limit(50)
      .toArray();

    // Process users to have a single department field
    const processedUsers = users.map(user => ({
      ...user,
      department: user.department || user.facultyDepartment || ''
    }));

    res.json(processedUsers);
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// ==================== CONNECTION HISTORY ROUTES ====================

// Record connection event
app.post("/api/network/history/record", auth, async (req, res) => {
  try {
    const { type, date, userId, userName, userData } = req.body;
    const currentUserId = req.user.userId;
    
    if (!type || !['connected', 'disconnected'].includes(type)) {
      return res.status(400).json({ message: 'Invalid event type' });
    }
    
    if (!userId) {
      return res.status(400).json({ message: 'Target user ID is required' });
    }
    
    // Record the history event
    const historyId = await recordConnectionEvent(
      currentUserId,
      userId,
      userName || 'Unknown User',
      type,
      userData
    );
    
    res.json({ 
      success: true, 
      message: 'Connection history recorded',
      historyId 
    });
  } catch (error) {
    console.error("Error recording connection history:", error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get connection history with timeframe filter
app.get("/api/network/history", auth, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { timeframe = 'all' } = req.query;
    
    const history = await getConnectionHistory(userId, timeframe);
    
    res.json({ 
      success: true,
      history,
      timeframe,
      count: history.length
    });
  } catch (error) {
    console.error("Error fetching connection history:", error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Initialize history from existing connections (run once)
app.post("/api/network/history/initialize", auth, async (req, res) => {
  try {
    const userId = req.user.userId;
    
    // Get current user with connections
    const user = await db.collection('users').findOne(
      { _id: new ObjectId(userId) },
      { projection: { connections: 1, name: 1 } }
    );
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    const connectionIds = user.connections || [];
    
    if (connectionIds.length === 0) {
      return res.json({ 
        success: true, 
        message: 'No existing connections to initialize history from',
        count: 0 
      });
    }
    
    // Clear existing history for this user
    await db.collection('connectionHistory').deleteMany({ userId: new ObjectId(userId) });
    
    // Create history events for each existing connection
    const connectionEvents = [];
    
    for (const connectionId of connectionIds) {
      try {
        // Get connection user details
        const connectionUser = await db.collection('users').findOne(
          { _id: new ObjectId(connectionId) },
          { projection: { name: 1, role: 1, department: 1, company: 1, email: 1 } }
        );
        
        if (connectionUser) {
          // Create a connected event (use current date as estimate)
          await recordConnectionEvent(
            userId,
            connectionId,
            connectionUser.name,
            'connected',
            {
              name: connectionUser.name,
              role: connectionUser.role,
              department: connectionUser.department,
              company: connectionUser.company,
              email: connectionUser.email
            }
          );
          
          connectionEvents.push({
            userId: connectionId,
            userName: connectionUser.name
          });
        }
      } catch (err) {
        console.error(`Error processing connection ${connectionId}:`, err);
      }
    }
    
    res.json({ 
      success: true, 
      message: `Initialized ${connectionEvents.length} connection events`,
      count: connectionEvents.length,
      connections: connectionEvents
    });
  } catch (error) {
    console.error("Error initializing history:", error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// ==================== NETWORK ROUTES ====================

// Send connection request (with history recording)
app.post("/api/network/request/:userId", auth, async (req, res) => {
  try {
  // ============ ADD THIS CHECK ============
    const currentUserId = req.user.userId;
    const user = await db.collection('users').findOne({ _id: new ObjectId(currentUserId) });
    
    if (user.status === 'restricted' && user.restrictedUntil) {
      const now = new Date();
      const restrictionEnd = new Date(user.restrictedUntil);
      
      if (restrictionEnd > now) {
        return res.status(403).json({ 
          success: false,
          message: `⏸️ Your account is restricted until ${restrictionEnd.toLocaleString()}. You cannot send connection requests during restriction.`,
          canSendRequests: false
        });
      }
    }
    // ============ END CHECK ============

    const targetUserId = req.params.userId;
    // const currentUserId = req.user.userId;

    if (targetUserId === currentUserId) {
      return res.status(400).json({ message: "You cannot send a connection request to yourself" });
    }

    // Validate userId
    if (!ObjectId.isValid(targetUserId)) {
      return res.status(400).json({ message: 'Invalid user ID' });
    }

    // Check if users exist
    const currentUser = await db.collection('users').findOne({ _id: new ObjectId(currentUserId) });
    const targetUser = await db.collection('users').findOne({ _id: new ObjectId(targetUserId) });

    if (!targetUser) {
      return res.status(404).json({ message: "User not found" });
    }

    // Check if already connected
    const isAlreadyConnected = (currentUser.connections || []).includes(targetUserId);
    if (isAlreadyConnected) {
      return res.status(400).json({ message: "You are already connected with this user" });
    }

    // Check if request already sent (using sentRequests)
    const hasSentRequest = (currentUser.sentRequests || []).includes(targetUserId);
    if (hasSentRequest) {
      return res.status(400).json({ message: "You have already sent a connection request to this user" });
    }

    // Check if incoming request exists (using receivedRequests)
    const hasReceivedRequest = (currentUser.receivedRequests || []).includes(targetUserId);
    if (hasReceivedRequest) {
      return res.status(400).json({ message: "This user has already sent you a connection request. Please check your received requests." });
    }

    // Update both users with new field names
    await db.collection('users').updateOne(
      { _id: new ObjectId(currentUserId) },
      { $push: { sentRequests: targetUserId } }
    );

    await db.collection('users').updateOne(
      { _id: new ObjectId(targetUserId) },
      { $push: { receivedRequests: currentUserId } }
    );

    // Create notification for the target user
    await createNotification({
      recipientId: targetUserId,
      senderId: currentUserId,
      type: "connection_request",
      message: `${currentUser.name} sent you a connection request`
    });

    res.json({ 
      success: true, 
      message: "Connection request sent successfully" 
    });
  } catch (error) {
    console.error("Error sending connection request:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Accept connection request (with history recording)
app.post("/api/network/accept/:userId", auth, async (req, res) => {
  try {
 // ============ ADD THIS CHECK ============
    const currentUserId = req.user.userId;
    const user = await db.collection('users').findOne({ _id: new ObjectId(currentUserId) });
    
    if (user.status === 'restricted' && user.restrictedUntil) {
      const now = new Date();
      const restrictionEnd = new Date(user.restrictedUntil);
      
      if (restrictionEnd > now) {
        return res.status(403).json({ 
          success: false,
          message: `⏸️ Your account is restricted until ${restrictionEnd.toLocaleString()}. You cannot accept connections during restriction.`,
          canAcceptRequests: false
        });
      }
    }
    // ============ END CHECK ============

    const senderUserId = req.params.userId;
    // const currentUserId = req.user.userId;

    // Validate userId
    if (!ObjectId.isValid(senderUserId)) {
      return res.status(400).json({ message: 'Invalid user ID' });
    }

    // Check if users exist
    const currentUser = await db.collection('users').findOne({ _id: new ObjectId(currentUserId) });
    const senderUser = await db.collection('users').findOne({ _id: new ObjectId(senderUserId) });

    if (!senderUser) {
      return res.status(404).json({ message: "User not found" });
    }

    // Check if request exists (using receivedRequests)
    const hasReceivedRequest = (currentUser.receivedRequests || []).includes(senderUserId);
    if (!hasReceivedRequest) {
      return res.status(400).json({ message: "No pending connection request from this user" });
    }

    // Remove from requests and add to connections
    await db.collection('users').updateOne(
      { _id: new ObjectId(currentUserId) },
      { 
        $pull: { receivedRequests: senderUserId },
        $push: { connections: senderUserId }
      }
    );

    await db.collection('users').updateOne(
      { _id: new ObjectId(senderUserId) },
      { 
        $pull: { sentRequests: currentUserId },
        $push: { connections: currentUserId }
      }
    );

    // Update followers/following counts (optional, for backward compatibility)
    await db.collection('users').updateOne(
      { _id: new ObjectId(currentUserId) },
      { $push: { followers: senderUserId } }
    );

    await db.collection('users').updateOne(
      { _id: new ObjectId(senderUserId) },
      { $push: { following: currentUserId } }
    );

    // ✅ RECORD CONNECTION HISTORY EVENT
    await recordConnectionEvent(
      currentUserId,
      senderUserId,
      senderUser.name,
      'connected',
      {
        name: senderUser.name,
        role: senderUser.role,
        department: senderUser.department,
        company: senderUser.company,
        email: senderUser.email
      }
    );

    // Also record for the sender user (optional)
    await recordConnectionEvent(
      senderUserId,
      currentUserId,
      currentUser.name,
      'connected',
      {
        name: currentUser.name,
        role: currentUser.role,
        department: currentUser.department,
        company: currentUser.company,
        email: currentUser.email
      }
    );

    // Create notification for the sender
    await createNotification({
      recipientId: senderUserId,
      senderId: currentUserId,
      type: "connection_accepted",
      message: `${currentUser.name} accepted your connection request`
    });

    res.json({ 
      success: true, 
      message: "Connection request accepted successfully" 
    });
  } catch (error) {
    console.error("Error accepting connection request:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Reject connection request
app.post("/api/network/reject/:userId", auth, async (req, res) => {
  try {
    const senderUserId = req.params.userId;
    const currentUserId = req.user.userId;

    // Validate userId
    if (!ObjectId.isValid(senderUserId)) {
      return res.status(400).json({ message: 'Invalid user ID' });
    }

    // Check if request exists
    const currentUser = await db.collection('users').findOne({ _id: new ObjectId(currentUserId) });
    const hasReceivedRequest = (currentUser.receivedRequests || []).includes(senderUserId);
    
    if (!hasReceivedRequest) {
      return res.status(400).json({ message: "No pending connection request from this user" });
    }

    // Remove from requests
    await db.collection('users').updateOne(
      { _id: new ObjectId(currentUserId) },
      { $pull: { receivedRequests: senderUserId } }
    );

    await db.collection('users').updateOne(
      { _id: new ObjectId(senderUserId) },
      { $pull: { sentRequests: currentUserId } }
    );

    res.json({ 
      success: true, 
      message: "Connection request rejected successfully" 
    });
  } catch (error) {
    console.error("Error rejecting connection request:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Cancel outgoing connection request
app.post("/api/network/cancel/:userId", auth, async (req, res) => {
  try {
    const targetUserId = req.params.userId;
    const currentUserId = req.user.userId;

    // Validate userId
    if (!ObjectId.isValid(targetUserId)) {
      return res.status(400).json({ message: 'Invalid user ID' });
    }

    // Check if request exists
    const currentUser = await db.collection('users').findOne({ _id: new ObjectId(currentUserId) });
    const hasSentRequest = (currentUser.sentRequests || []).includes(targetUserId);
    
    if (!hasSentRequest) {
      return res.status(400).json({ message: "No pending outgoing request to this user" });
    }

    // Remove from requests
    await db.collection('users').updateOne(
      { _id: new ObjectId(currentUserId) },
      { $pull: { sentRequests: targetUserId } }
    );

    await db.collection('users').updateOne(
      { _id: new ObjectId(targetUserId) },
      { $pull: { receivedRequests: currentUserId } }
    );

    res.json({ 
      success: true, 
      message: "Connection request cancelled successfully" 
    });
  } catch (error) {
    console.error("Error cancelling connection request:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Remove connection (with history recording)
app.post("/api/network/remove/:userId", auth, async (req, res) => {
  try {
    const targetUserId = req.params.userId;
    const currentUserId = req.user.userId;

    // Validate userId
    if (!ObjectId.isValid(targetUserId)) {
      return res.status(400).json({ message: 'Invalid user ID' });
    }

    // Check if connected
    const currentUser = await db.collection('users').findOne({ _id: new ObjectId(currentUserId) });
    const targetUser = await db.collection('users').findOne({ _id: new ObjectId(targetUserId) });
    
    if (!targetUser) {
      return res.status(404).json({ message: "User not found" });
    }

    const isConnected = (currentUser.connections || []).includes(targetUserId);
    
    if (!isConnected) {
      return res.status(400).json({ message: "You are not connected with this user" });
    }

    // Remove from connections for both users
    await db.collection('users').updateOne(
      { _id: new ObjectId(currentUserId) },
      { $pull: { connections: targetUserId } }
    );

    await db.collection('users').updateOne(
      { _id: new ObjectId(targetUserId) },
      { $pull: { connections: currentUserId } }
    );

    // Also update followers/following for backward compatibility
    await db.collection('users').updateOne(
      { _id: new ObjectId(currentUserId) },
      { $pull: { followers: targetUserId } }
    );

    await db.collection('users').updateOne(
      { _id: new ObjectId(targetUserId) },
      { $pull: { following: currentUserId } }
    );

    // ✅ RECORD DISCONNECTION HISTORY EVENT
    await recordConnectionEvent(
      currentUserId,
      targetUserId,
      targetUser.name,
      'disconnected',
      {
        name: targetUser.name,
        role: targetUser.role,
        department: targetUser.department,
        company: targetUser.company,
        email: targetUser.email
      }
    );

    // Also record for the other user (optional)
    await recordConnectionEvent(
      targetUserId,
      currentUserId,
      currentUser.name,
      'disconnected',
      {
        name: currentUser.name,
        role: currentUser.role,
        department: currentUser.department,
        company: currentUser.company,
        email: currentUser.email
      }
    );

    res.json({ 
      success: true, 
      message: "Connection removed successfully" 
    });
  } catch (error) {
    console.error("Error removing connection:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Get network status with a user
app.get("/api/network/status/:userId", auth, async (req, res) => {
  try {
    const targetUserId = req.params.userId;
    const currentUserId = req.user.userId;

    if (targetUserId === currentUserId) {
      return res.json({
        status: "self",
        message: "This is your own profile"
      });
    }

    // Validate userId
    if (!ObjectId.isValid(targetUserId)) {
      return res.status(400).json({ message: 'Invalid user ID' });
    }

    const currentUser = await db.collection('users').findOne({ _id: new ObjectId(currentUserId) });

    // Check connection status
    const isConnected = (currentUser.connections || []).includes(targetUserId);
    const hasSentRequest = (currentUser.sentRequests || []).includes(targetUserId);
    const hasReceivedRequest = (currentUser.receivedRequests || []).includes(targetUserId);

    let status = "none";
    let message = "";

    if (isConnected) {
      status = "connected";
      message = "You are connected with this user";
    } else if (hasSentRequest) {
      status = "request_sent";
      message = "Connection request sent - pending";
    } else if (hasReceivedRequest) {
      status = "request_received";
      message = "You have a connection request from this user";
    } else {
      status = "not_connected";
      message = "Not connected";
    }

    res.json({
      status,
      message,
      canSendRequest: !isConnected && !hasSentRequest && !hasReceivedRequest
    });
  } catch (error) {
    console.error("Error getting connection status:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Get user's connections
app.get("/api/network/connections", auth, async (req, res) => {
  try {
    const userId = req.user.userId;

    const user = await db.collection('users').findOne(
      { _id: new ObjectId(userId) },
      { projection: { connections: 1 } }
    );

    const connectionIds = user?.connections || [];
    
    // Get detailed user info for each connection
    const connections = await db.collection('users')
      .find({ _id: { $in: connectionIds.map(id => new ObjectId(id)) } })
      .project({
        _id: 1,
        name: 1,
        email: 1,
        profilePhoto: 1,
        role: 1,
        department: 1,
        designation: 1,
        bio: 1,
        skills: 1,
        company: 1,
        createdAt: 1
      })
      .toArray();

    // Add connection date from history
    const connectionsWithDetails = await Promise.all(
      connections.map(async (conn) => {
        // Try to get connection date from history
        const connectionEvent = await db.collection('connectionHistory')
          .findOne({
            userId: new ObjectId(userId),
            targetUserId: conn._id,
            type: 'connected'
          }, {
            sort: { date: -1 },
            projection: { date: 1 }
          });
        
        return {
          ...conn,
          connectedAt: connectionEvent?.date || conn.createdAt
        };
      })
    );

    res.json({
      success: true,
      count: connectionsWithDetails.length,
      connections: connectionsWithDetails
    });
  } catch (error) {
    console.error("Error getting connections:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Get connection history endpoint for frontend
app.get("/api/network/connections/history", auth, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { timeframe = 'all' } = req.query;
    
    const history = await getConnectionHistory(userId, timeframe);
    
    res.json({ 
      success: true,
      history,
      timeframe,
      count: history.length
    });
  } catch (error) {
    console.error("Error fetching connection history:", error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get users with connections (for mutual connections)
app.get("/api/users/with-connections", auth, async (req, res) => {
  try {
    const currentUserId = req.user.userId;
    
    // Get current user's connections
    const currentUser = await db.collection('users').findOne(
      { _id: new ObjectId(currentUserId) },
      { projection: { connections: 1 } }
    );
    
    const currentUserConnections = currentUser?.connections || [];
    
    // Get all users who are not the current user
    const users = await db.collection('users')
      .find({ 
        _id: { $ne: new ObjectId(currentUserId) },
        connections: { $exists: true, $ne: [] }
      })
      .project({
        _id: 1,
        name: 1,
        email: 1,
        profilePhoto: 1,
        role: 1,
        department: 1,
        bio: 1,
        skills: 1,
        connections: 1
      })
      .limit(100)
      .toArray();
    
    // Add mutual connection count
    const usersWithMutualCount = users.map(user => {
      const userConnections = user.connections || [];
      const mutualConnections = userConnections.filter(connId => 
        currentUserConnections.includes(connId.toString())
      );
      
      return {
        ...user,
        mutualCount: mutualConnections.length,
        connections: userConnections
      };
    });
    
    // Sort by mutual count (highest first)
    usersWithMutualCount.sort((a, b) => b.mutualCount - a.mutualCount);
    
    res.json({
      success: true,
      users: usersWithMutualCount
    });
  } catch (error) {
    console.error("Error fetching users with connections:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Get received connection requests
app.get("/api/network/requests/received", auth, async (req, res) => {
  try {
    const userId = req.user.userId;

    const user = await db.collection('users').findOne(
      { _id: new ObjectId(userId) },
      { projection: { receivedRequests: 1 } }
    );

    const requestIds = user?.receivedRequests || [];
    
    // Get detailed user info for each request
    const requests = await db.collection('users')
      .find({ _id: { $in: requestIds.map(id => new ObjectId(id)) } })
      .project({
        _id: 1,
        name: 1,
        email: 1,
        profilePhoto: 1,
        role: 1,
        department: 1,
        designation: 1,
        bio: 1
      })
      .toArray();

    res.json({
      success: true,
      count: requests.length,
      requests
    });
  } catch (error) {
    console.error("Error getting received requests:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Get sent connection requests
app.get("/api/network/requests/sent", auth, async (req, res) => {
  try {
    const userId = req.user.userId;

    const user = await db.collection('users').findOne(
      { _id: new ObjectId(userId) },
      { projection: { sentRequests: 1 } }
    );

    const requestIds = user?.sentRequests || [];
    
    // Get detailed user info for each request
    const requests = await db.collection('users')
      .find({ _id: { $in: requestIds.map(id => new ObjectId(id)) } })
      .project({
        _id: 1,
        name: 1,
        email: 1,
        profilePhoto: 1,
        role: 1,
        department: 1,
        designation: 1,
        bio: 1
      })
      .toArray();

    res.json({
      success: true,
      count: requests.length,
      requests
    });
  } catch (error) {
    console.error("Error getting sent requests:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Search users for networking
app.get("/api/network/search", auth, async (req, res) => {
  try {
    const { query, department, role, excludeConnected = true } = req.query;
    const currentUserId = req.user.userId;

    // Get current user's connections to exclude them
    const currentUser = await db.collection('users').findOne(
      { _id: new ObjectId(currentUserId) },
      { projection: { connections: 1, receivedRequests: 1, sentRequests: 1 } }
    );

    const excludeIds = [new ObjectId(currentUserId)];
    
    if (excludeConnected === 'true') {
      const connectionIds = (currentUser?.connections || []).map(id => new ObjectId(id));
      const receivedIds = (currentUser?.receivedRequests || []).map(id => new ObjectId(id));
      const sentIds = (currentUser?.sentRequests || []).map(id => new ObjectId(id));
      
      excludeIds.push(...connectionIds, ...receivedIds, ...sentIds);
    }

    // Build search query
    const searchQuery = {
      _id: { $nin: excludeIds }
    };

    if (query) {
      searchQuery.$or = [
        { name: { $regex: query, $options: 'i' } },
        { email: { $regex: query, $options: 'i' } },
        { department: { $regex: query, $options: 'i' } }
      ];
    }

    if (department) {
      searchQuery.department = department;
    }

    if (role) {
      searchQuery.role = role;
    }

    const users = await db.collection('users')
      .find(searchQuery)
      .project({
        _id: 1,
        name: 1,
        email: 1,
        profilePhoto: 1,
        role: 1,
        department: 1,
        designation: 1,
        bio: 1,
        skills: 1,
        year: 1
      })
      .limit(50)
      .toArray();

    // Add connection status for each user
    const usersWithStatus = users.map(user => {
      const userObj = user;
      const userIdStr = user._id.toString();
      
      const isConnected = (currentUser?.connections || []).includes(userIdStr);
      const hasSentRequest = (currentUser?.sentRequests || []).includes(userIdStr);
      const hasReceivedRequest = (currentUser?.receivedRequests || []).includes(userIdStr);

      let connectionStatus = "none";
      if (isConnected) connectionStatus = "connected";
      else if (hasSentRequest) connectionStatus = "request_sent";
      else if (hasReceivedRequest) connectionStatus = "request_received";

      return {
        ...userObj,
        connectionStatus
      };
    });

    res.json({
      success: true,
      count: usersWithStatus.length,
      users: usersWithStatus
    });
  } catch (error) {
    console.error("Error searching users:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Get network statistics
app.get("/api/network/stats", auth, async (req, res) => {
  try {
    const userId = req.user.userId;

    const user = await db.collection('users').findOne(
      { _id: new ObjectId(userId) },
      {
        projection: {
          connections: 1,
          receivedRequests: 1,
          sentRequests: 1,
          followers: 1,
          following: 1
        }
      }
    );

    // Get connection history stats
    const historyStats = await db.collection('connectionHistory').aggregate([
      { $match: { userId: new ObjectId(userId) } },
      { $group: {
          _id: '$type',
          count: { $sum: 1 }
        }
      }
    ]).toArray();

    const connectedCount = historyStats.find(stat => stat._id === 'connected')?.count || 0;
    const disconnectedCount = historyStats.find(stat => stat._id === 'disconnected')?.count || 0;

    res.json({
      success: true,
      stats: {
        connections: user?.connections?.length || 0,
        receivedRequests: user?.receivedRequests?.length || 0,
        sentRequests: user?.sentRequests?.length || 0,
        followers: user?.followers?.length || 0,
        following: user?.following?.length || 0,
        totalHistoryEvents: connectedCount + disconnectedCount,
        connectedEvents: connectedCount,
        disconnectedEvents: disconnectedCount,
        netGrowth: connectedCount - disconnectedCount
      }
    });
  } catch (error) {
    console.error("Error getting network stats:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// ==================== REPORT SYSTEM ====================

// Report a post (All users can report)
app.post("/api/posts/:postId/report", auth, async (req, res) => {
  try {
    const { postId } = req.params;
    const userId = req.user.userId;
    const { reason } = req.body;

    if (!reason || !reason.trim()) {
      return res.status(400).json({ message: 'Please provide a reason for reporting' });
    }

    // Validate postId
    if (!ObjectId.isValid(postId)) {
      return res.status(400).json({ message: 'Invalid post ID' });
    }

    const post = await db.collection('posts').findOne({ _id: new ObjectId(postId) });
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    // Initialize reports array if it doesn't exist
    const reports = post.reports || [];
    
    // Check if user already reported this post
    const alreadyReported = reports.some(report => report.userId === userId);
    if (alreadyReported) {
      return res.status(400).json({ message: 'You have already reported this post' });
    }

    // Get user info
    const user = await db.collection('users').findOne({ _id: new ObjectId(userId) });

    const report = {
      userId,
      userName: user.name,
      userEmail: user.email,
      reason: reason.trim(),
      timestamp: new Date(),
      status: 'pending' // pending, reviewed, resolved
    };

    // Update post with new report
    await db.collection('posts').updateOne(
      { _id: new ObjectId(postId) },
      { 
        $push: { reports: report },
        $set: { isReported: true }
      }
    );

    // Notify post owner that their post was reported
    await createNotification({
      recipientId: post.userId.toString(),
      senderId: userId,
      type: "post_reported",
      postId,
      message: `🚨 Your post was reported for: "${reason}"`
    });

    res.json({ 
      message: 'Post reported successfully. Admin will review it.',
      report 
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// ==================== ADMIN MIDDLEWARE ====================
const requireAdmin = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const user = await db.collection('users').findOne({ _id: new ObjectId(userId) });
    
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }
    
    req.admin = user;
    next();
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// ==================== ADMIN ROUTES WITH NOTIFICATIONS ====================

// Get all users (Admin only)
app.get("/api/admin/users", auth, requireAdmin, async (req, res) => {
  try {
    const users = await db.collection('users').find({}, { projection: { password: 0 } }).toArray();
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Delete user (Admin only)
app.delete("/api/admin/users/:userId", auth, requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { reason } = req.body;
    
    // Don't allow admin to delete themselves
    if (userId === req.user.userId) {
      return res.status(400).json({ message: 'Cannot delete your own account' });
    }
    
    // Validate userId
    if (!ObjectId.isValid(userId)) {
      return res.status(400).json({ message: 'Invalid user ID' });
    }
    
    const userToDelete = await db.collection('users').findOne({ _id: new ObjectId(userId) });
    if (!userToDelete) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Notify user before deletion (if they're online)
    await createNotification({
      recipientId: userId,
      senderId: req.user.userId,
      type: "account_deleted",
      message: `🚫 Your account was permanently deleted by admin. Reason: ${reason || "Violation of community guidelines"}`
    });
    
    const result = await db.collection('users').deleteOne({ _id: new ObjectId(userId) });
    
    if (result.deletedCount === 0) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get all posts (Admin view)
app.get("/api/admin/posts", auth, requireAdmin, async (req, res) => {
  try {
    const posts = await db.collection('posts').find().sort({ createdAt: -1 }).toArray();
    
    const postsWithUsers = await Promise.all(
      posts.map(async (post) => {
        const user = await db.collection('users').findOne({ _id: new ObjectId(post.userId) });
        return {
          _id: post._id,
          content: post.content,
          type: post.type || 'text',
          media: post.media || [],
          likesCount: post.likes?.length || 0,
          commentsCount: post.comments?.length || 0,
          shareCount: post.shareCount || 0,
          shares: post.shares || [],
          event: post.event || null,
          poll: post.poll || null,
          createdAt: post.createdAt,
          user: {
            id: user?._id,
            name: user?.name || "Unknown User",
            email: user?.email,
            role: user?.role
          }
        };
      })
    );

    res.json(postsWithUsers);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Delete post (Admin only) - WITH NOTIFICATION TO USER
app.delete("/api/admin/posts/:postId", auth, requireAdmin, async (req, res) => {
  try {
    const { postId } = req.params;
    const { reason } = req.body;
    
    // Validate postId
    if (!ObjectId.isValid(postId)) {
      return res.status(400).json({ message: 'Invalid post ID' });
    }
    
    const post = await db.collection('posts').findOne({ _id: new ObjectId(postId) });
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }
    
    // Delete associated media from Cloudinary
    if (post.media && post.media.length > 0) {
      for (const mediaItem of post.media) {
        try {
          await cloudinary.uploader.destroy(mediaItem.publicId, {
            resource_type: mediaItem.type === 'video' ? 'video' : 'image'
          });
          console.log(`Deleted media from Cloudinary: ${mediaItem.publicId}`);
        } catch (cloudinaryError) {
          console.error(`Error deleting media from Cloudinary: ${cloudinaryError.message}`);
          // Continue with post deletion even if media deletion fails
        }
      }
    }
    
    const result = await db.collection('posts').deleteOne({ _id: new ObjectId(postId) });
    
    if (result.deletedCount === 0) {
      return res.status(404).json({ message: 'Post not found' });
    }
    
    // Notify post owner about deletion
    await createNotification({
      recipientId: post.userId.toString(),
      senderId: req.user.userId,
      type: "post_deleted",
      postId,
      message: `🗑️ Your post was removed by admin. Reason: ${reason || "Violation of community guidelines"}`
    });
    
    res.json({ message: 'Post deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get admin stats
app.get("/api/admin/stats", auth, requireAdmin, async (req, res) => {
  try {
    const totalUsers = await db.collection('users').countDocuments();
    const totalPosts = await db.collection('posts').countDocuments();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const postsToday = await db.collection('posts').countDocuments({ createdAt: { $gte: today } });
    
    // Count posts by type
    const textPosts = await db.collection('posts').countDocuments({ type: 'text' });
    const eventPosts = await db.collection('posts').countDocuments({ type: 'event' });
    const pollPosts = await db.collection('posts').countDocuments({ type: 'poll' });
    
    // User breakdown by role
    const students = await db.collection('users').countDocuments({ role: 'student' });
    const faculty = await db.collection('users').countDocuments({ role: 'faculty' });
    const admins = await db.collection('users').countDocuments({ role: 'admin' });
    
    // Connection history stats
    const totalConnections = await db.collection('connectionHistory').countDocuments({ type: 'connected' });
    const totalDisconnections = await db.collection('connectionHistory').countDocuments({ type: 'disconnected' });
    
    res.json({
      totalUsers,
      totalPosts,
      postsToday,
      postsByType: { text: textPosts, event: eventPosts, poll: pollPosts },
      usersByRole: { students, faculty, admins },
      connectionStats: {
        totalConnections,
        totalDisconnections,
        netGrowth: totalConnections - totalDisconnections
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get all reported posts (Admin only)
app.get("/api/admin/reports", auth, requireAdmin, async (req, res) => {
  try {
    const reportedPosts = await db.collection('posts')
      .find({ isReported: true })
      .sort({ createdAt: -1 })
      .toArray();

    const postsWithDetails = await Promise.all(
      reportedPosts.map(async (post) => {
        const user = await db.collection('users').findOne({ _id: new ObjectId(post.userId) });
        
        // Get reporter details for each report
        const reportsWithDetails = await Promise.all(
          (post.reports || []).map(async (report) => {
            const reporter = await db.collection('users').findOne({ _id: new ObjectId(report.userId) });
            return {
              ...report,
              reporterName: reporter?.name,
              reporterEmail: reporter?.email,
              reporterRole: reporter?.role
            };
          })
        );

        return {
          _id: post._id,
          content: post.content,
          type: post.type || 'text',
          media: post.media || [],
          event: post.event || null,
          poll: post.poll || null,
          createdAt: post.createdAt,
          reports: reportsWithDetails,
          totalReports: (post.reports || []).length,
          user: {
            id: user?._id,
            name: user?.name || "Unknown User",
            email: user?.email,
            role: user?.role
          }
        };
      })
    );

    res.json(postsWithDetails);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// ==================== USER WARNINGS SYSTEM ====================

// Add warning to user (Admin only) - WITH NOTIFICATION
app.post("/api/admin/users/:userId/warn", auth, requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { reason, postId } = req.body;

    if (!reason || !reason.trim()) {
      return res.status(400).json({ message: 'Warning reason is required' });
    }

    // Validate userId
    if (!ObjectId.isValid(userId)) {
      return res.status(400).json({ message: 'Invalid user ID' });
    }

    const user = await db.collection('users').findOne({ _id: new ObjectId(userId) });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const warning = {
      reason: reason.trim(),
      issuedBy: req.admin.name,
      issuedAt: new Date(),
      isAcknowledged: false
    };

    // Initialize warnings array if it doesn't exist
    const warnings = user.warnings || [];
    warnings.push(warning);

    await db.collection('users').updateOne(
      { _id: new ObjectId(userId) },
      { 
        $set: { 
          warnings,
          warningCount: warnings.length
        }
      }
    );

    // Notify the user about the warning
    await createNotification({
      recipientId: userId,
      senderId: req.user.userId,
      type: "warning",
      postId: postId || null,
      message: `⚠️ You received a warning from admin: "${reason}". Repeated violations may lead to account suspension.`
    });

    res.json({ 
      message: 'Warning issued to user',
      warning,
      totalWarnings: warnings.length
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get user warnings (Admin only)
app.get("/api/admin/users/:userId/warnings", auth, requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Validate userId
    if (!ObjectId.isValid(userId)) {
      return res.status(400).json({ message: 'Invalid user ID' });
    }
    
    const user = await db.collection('users').findOne(
      { _id: new ObjectId(userId) },
      { projection: { warnings: 1, name: 1, email: 1 } }
    );

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({
      user: {
        name: user.name,
        email: user.email
      },
      warnings: user.warnings || [],
      totalWarnings: user.warnings?.length || 0
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Save resolved reports to separate collection - COMPLETE VERSION
app.post("/api/admin/reports/:postId/resolve", auth, requireAdmin, async (req, res) => {
  try {
    const { postId } = req.params;
    const { action, adminReason } = req.body; // 'keep', 'delete', 'warn', 'restrict'

    // Validate postId
    if (!ObjectId.isValid(postId)) {
      return res.status(400).json({ message: 'Invalid post ID' });
    }

    const post = await db.collection('posts').findOne({ _id: new ObjectId(postId) });
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    // Get user details
    const user = await db.collection('users').findOne({ _id: new ObjectId(post.userId) });
    
    // Save to resolved reports collection FOR ALL ACTIONS
    const resolvedReport = {
      postId: post._id,
      postContent: post.content,
      postType: post.type || 'text',
      authorId: post.userId,
      authorName: user?.name || "Unknown User",
      reports: post.reports || [],
      totalReports: (post.reports || []).length,
      actionTaken: action, // 'keep', 'delete', 'warn', 'restrict'
      adminReason: adminReason,
      resolvedBy: req.user.userId,
      resolvedByName: req.admin.name,
      resolvedAt: new Date(),
      createdAt: post.createdAt,
      originalReports: post.reports || [] // Keep original reports
    };

    await db.collection('resolvedReports').insertOne(resolvedReport);

    // Clear reports array and mark as not reported
    await db.collection('posts').updateOne(
      { _id: new ObjectId(postId) },
      { 
        $set: { 
          isReported: false,
          reports: [] // Clear the reports array entirely
        }
      }
    );
        
    // If action is 'delete', delete the post
    if (action === 'delete') {
      // Delete associated media from Cloudinary
      if (post.media && post.media.length > 0) {
        for (const mediaItem of post.media) {
          try {
            await cloudinary.uploader.destroy(mediaItem.publicId, {
              resource_type: mediaItem.type === 'video' ? 'video' : 'image'
            });
          } catch (cloudinaryError) {
            console.error(`Error deleting media: ${cloudinaryError.message}`);
          }
        }
      }
      
      await db.collection('posts').deleteOne({ _id: new ObjectId(postId) });
    }

    // Better notifications based on action
    if (action === 'keep') {
      // Notify post owner
      await createNotification({
        recipientId: post.userId.toString(),
        senderId: req.user.userId,
        type: "post_approved",
        postId: postId,
        message: `✅ Your post was reviewed and approved. It doesn't violate guidelines.`
      });
      
      // Notify all reporters
      if (post.reports && post.reports.length > 0) {
        for (const report of post.reports) {
          if (report.userId !== req.user.userId) {
            await createNotification({
              recipientId: report.userId,
              senderId: req.user.userId,
              type: "report_resolved",
              postId: postId,
              message: `ℹ️ Your report was reviewed. The post was kept as it doesn't violate guidelines.`
            });
          }
        }
      }
    } 
    else if (action === 'delete') {
      // Notify post owner
      await createNotification({
        recipientId: post.userId.toString(),
        senderId: req.user.userId,
        type: "post_deleted",
        postId: postId,
        message: `🗑️ Your post was removed after review. Reason: ${adminReason || "Multiple user reports confirmed inappropriate content"}`
      });
      
      // Notify all reporters
      if (post.reports && post.reports.length > 0) {
        for (const report of post.reports) {
          if (report.userId !== req.user.userId) {
            await createNotification({
              recipientId: report.userId,
              senderId: req.user.userId,
              type: "report_resolved",
              postId: postId,
              message: `✅ Thank you for reporting. The post was removed. Admin: "${adminReason || "Content violated guidelines"}"`
            });
          }
        }
      }
    }
    else if (action === 'warn') {
      // Notify post owner
      await createNotification({
        recipientId: post.userId.toString(),
        senderId: req.user.userId,
        type: "warning",
        postId: postId,
        message: `⚠️ You received a warning for your post. Reason: ${adminReason || "Post violated guidelines"}`
      });
    }
    else if (action === 'restrict') {
      // Notify post owner
      await createNotification({
        recipientId: post.userId.toString(),
        senderId: req.user.userId,
        type: "account_restricted",
        postId: postId,
        message: `⏸️ Your account has been restricted. Reason: ${adminReason || "Repeated violations"}`
      });
    }

    res.json({ 
      success: true,
      message: `Report resolved. ${action === 'delete' ? 'Post deleted' : action === 'keep' ? 'Post kept' : action === 'warn' ? 'User warned' : 'User restricted'}.`,
      action: action,
      resolvedReport: resolvedReport // Send back for frontend
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get resolved reports (Admin only)
app.get("/api/admin/reports/resolved", auth, requireAdmin, async (req, res) => {
  try {
    // Get resolved reports with pagination
    const { page = 1, limit = 50 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const resolvedReports = await db.collection('resolvedReports')
      .find()
      .sort({ resolvedAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .toArray();
    
    // Get total count for pagination
    const totalReports = await db.collection('resolvedReports').countDocuments();
    
    // Get admin details for each resolved report
    const reportsWithAdminDetails = await Promise.all(
      resolvedReports.map(async (report) => {
        let adminName = report.resolvedByName;
        let adminEmail = '';
        
        // Try to get admin details if only ID is stored
        if (report.resolvedBy && ObjectId.isValid(report.resolvedBy)) {
          const admin = await db.collection('users').findOne(
            { _id: new ObjectId(report.resolvedBy) },
            { projection: { name: 1, email: 1 } }
          );
          if (admin) {
            adminName = admin.name;
            adminEmail = admin.email;
          }
        }
        
        return {
          ...report,
          resolvedByName: adminName,
          resolvedByEmail: adminEmail,
          postId: report.postId?.toString(),
          authorId: report.authorId?.toString()
        };
      })
    );
    
    res.json({
      success: true,
      reports: reportsWithAdminDetails,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        totalReports,
        totalPages: Math.ceil(totalReports / parseInt(limit))
      }
    });
  } catch (error) {
    console.error("Error fetching resolved reports:", error);
    res.status(500).json({ 
      success: false,
      message: 'Server error', 
      error: error.message 
    });
  }
});

// ==================== NEW ADMIN ENDPOINTS ====================

// Update user role (Admin only)
app.put("/api/admin/users/:userId/role", auth, requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { role } = req.body;
    
    if (!role || !['student', 'faculty', 'admin'].includes(role)) {
      return res.status(400).json({ message: 'Valid role required (student, faculty, admin)' });
    }
    
    // Validate userId
    if (!ObjectId.isValid(userId)) {
      return res.status(400).json({ message: 'Invalid user ID' });
    }
    
    // Don't allow changing own role
    if (userId === req.user.userId) {
      return res.status(400).json({ message: 'Cannot change your own role' });
    }
    
    const user = await db.collection('users').findOne({ _id: new ObjectId(userId) });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    await db.collection('users').updateOne(
      { _id: new ObjectId(userId) },
      { $set: { role, updatedAt: new Date() } }
    );
    
    // Notify user about role change
    await createNotification({
      recipientId: userId,
      senderId: req.user.userId,
      type: "role_changed",
      message: `Your role has been changed to ${role} by admin`
    });
    
    res.json({ 
      success: true,
      message: `User role changed to ${role} successfully`
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update user status (active/suspended/banned) - Admin only
app.put("/api/admin/users/:userId/status", auth, requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { status, reason, durationHours } = req.body;
    
    if (!status || !['active'].includes(status)) {
      return res.status(400).json({ message: 'Valid status required (active,)' });
    }
    
    // Validate userId
    if (!ObjectId.isValid(userId)) {
      return res.status(400).json({ message: 'Invalid user ID' });
    }
    
    // Don't allow changing own status
    if (userId === req.user.userId) {
      return res.status(400).json({ message: 'Cannot change your own status' });
    }
    
    const user = await db.collection('users').findOne({ _id: new ObjectId(userId) });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    const updateData = {
      status,
      updatedAt: new Date()
    };
    
    // If unsuspending/activating, clear restriction
    if (status === 'active') {
      updateData.restrictedUntil = null;
      updateData.restrictionReason = '';
    }
    
    // If suspending/banning, add reason
    if (status !== 'active' && reason) {
      updateData.restrictionReason = reason;
    }
    
    await db.collection('users').updateOne(
      { _id: new ObjectId(userId) },
      { $set: updateData }
    );
    
    // Create appropriate notification
    const action = status === 'active' ? 'activated' : status === 'suspended' ? 'suspended' : 'banned';
    await createNotification({
      recipientId: userId,
      senderId: req.user.userId,
      type: "account_status",
      message: `Your account has been ${action} by admin. ${reason ? `Reason: ${reason}` : ''}`
    });
    
    res.json({ 
      success: true,
      message: `User account ${action} successfully`,
      status: status
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// ==================== RESTRICTION CHECK MIDDLEWARE ====================
const checkRestriction = async (req, res, next) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return next();
    
    const user = await db.collection('users').findOne({ _id: new ObjectId(userId) });
    if (!user) return next();
    
    // Auto-remove expired restriction
    if (user.status === 'restricted' && user.restrictedUntil) {
      if (new Date(user.restrictedUntil) < new Date()) {
        await db.collection('users').updateOne(
          { _id: new ObjectId(userId) },
          { 
            $set: { 
              status: 'active',
              'restrictionDetails.isRestricted': false,
              'restrictionDetails.restrictedUntil': null,
              'restrictionDetails.restrictionReason': '',
              'permissions.canPost': true,
              'permissions.canComment': true,
              'permissions.canEditProfile': true,
              'permissions.canSendRequests': true,
              'permissions.canAcceptRequests': true,
              'permissions.canLike': true,
              'permissions.canShare': true
            }
          }
        );
        return next();
      }
      
      // Check if action is allowed
      const restrictedEndpoints = {
        'POST': ['/api/posts', '/api/posts/upload'],
        'PUT': ['/api/auth/profile'],
        'DELETE': ['/api/posts']
      };
      
      const currentMethod = req.method;
      const currentPath = req.path;
      
      if (restrictedEndpoints[currentMethod]?.some(endpoint => currentPath.startsWith(endpoint))) {
        return res.status(403).json({ 
          success: false,
          message: `⏸️ Your account is restricted until ${new Date(user.restrictedUntil).toLocaleString()}. Reason: ${user.restrictionReason || 'Administrative action'}`,
          restrictedUntil: user.restrictedUntil,
          restrictionReason: user.restrictionReason
        });
      }
    }
    
    next();
  } catch (error) {
    console.error("Restriction check error:", error);
    next();
  }
};

// Apply restriction check to all protected routes
app.use('/api/', auth, checkRestriction);

// Restrict user for specific duration (Admin only)
app.post("/api/admin/users/:userId/restrict", auth, requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { reason, duration = '24h' } = req.body;
    
    if (!reason || !reason.trim()) {
      return res.status(400).json({ message: 'Restriction reason is required' });
    }
    
    // Validate duration
    const validDurations = ['1h', '6h', '12h', '24h', '3d', '7d'];
    if (!validDurations.includes(duration)) {
      return res.status(400).json({ message: 'Invalid duration. Use: 1h, 6h, 12h, 24h, 3d, 7d' });
    }
    
    // Validate userId
    if (!ObjectId.isValid(userId)) {
      return res.status(400).json({ message: 'Invalid user ID' });
    }
    
    // Don't allow restricting yourself
    if (userId === req.user.userId) {
      return res.status(400).json({ message: 'Cannot restrict your own account' });
    }
    
    const user = await db.collection('users').findOne({ _id: new ObjectId(userId) });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Calculate restriction end time based on duration
    const restrictedUntil = new Date();
    const durationMap = {
      '1h': 1 * 60 * 60 * 1000,
      '6h': 6 * 60 * 60 * 1000,
      '12h': 12 * 60 * 60 * 1000,
      '24h': 24 * 60 * 60 * 1000,
      '3d': 3 * 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000
    };
    
    restrictedUntil.setTime(restrictedUntil.getTime() + durationMap[duration]);
    
    await db.collection('users').updateOne(
      { _id: new ObjectId(userId) },
      { 
        $set: { 
          status: 'restricted',
          restrictedUntil,
          restrictionReason: reason.trim(),
          'restrictionDetails.isRestricted': true,
          'restrictionDetails.restrictedUntil': restrictedUntil,
          'restrictionDetails.restrictionReason': reason.trim(),
          'restrictionDetails.restrictionDuration': duration,
          'restrictionDetails.restrictedAt': new Date(),
          'permissions.canPost': false,
          'permissions.canComment': false,
          'permissions.canEditProfile': false,
          'permissions.canSendRequests': false,
          'permissions.canAcceptRequests': false,
          'permissions.canLike': false,
          'permissions.canShare': false,
          updatedAt: new Date()
        }
      }
    );
    
    // Notify user about restriction
    await createNotification({
      recipientId: userId,
      senderId: req.user.userId,
      type: "account_restricted",
      message: `⏸️ Your account has been restricted for ${duration}. Reason: ${reason}. You cannot post, comment, like, send/accept connections, or edit profile until ${restrictedUntil.toLocaleString()}.`
    });
    
    res.json({ 
      success: true,
      message: `User restricted for ${duration} successfully`,
      restrictedUntil,
      restrictionReason: reason.trim(),
      duration
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Remove restriction (Admin only)
app.post("/api/admin/users/:userId/unrestrict", auth, requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Validate userId
    if (!ObjectId.isValid(userId)) {
      return res.status(400).json({ message: 'Invalid user ID' });
    }
    
    const user = await db.collection('users').findOne({ _id: new ObjectId(userId) });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    if (user.status !== 'restricted') {
      return res.status(400).json({ message: 'User is not restricted' });
    }
    
    await db.collection('users').updateOne(
      { _id: new ObjectId(userId) },
      { 
        $set: { 
          status: 'active',
          restrictedUntil: null,
          restrictionReason: '',
          'restrictionDetails.isRestricted': false,
          'restrictionDetails.restrictedUntil': null,
          'restrictionDetails.restrictionReason': '',
          'restrictionDetails.restrictionDuration': '',
          'permissions.canPost': true,
          'permissions.canComment': true,
          'permissions.canEditProfile': true,
          'permissions.canSendRequests': true,
          'permissions.canAcceptRequests': true,
          'permissions.canLike': true,
          'permissions.canShare': true,
          updatedAt: new Date()
        }
      }
    );
    
    // Notify user about removal of restriction
    await createNotification({
      recipientId: userId,
      senderId: req.user.userId,
      type: "account_unrestricted",
      message: `✅ Your account restriction has been removed. You can now post, comment, like, and connect normally.`
    });
    
    res.json({ 
      success: true,
      message: 'User restriction removed successfully',
      status: 'active'
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get user details with activity (Admin only)
app.get("/api/admin/users/:userId/details", auth, requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Validate userId
    if (!ObjectId.isValid(userId)) {
      return res.status(400).json({ message: 'Invalid user ID' });
    }
    
    const user = await db.collection('users').findOne(
      { _id: new ObjectId(userId) },
      { projection: { password: 0 } }
    );
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Get user's posts count
    const postsCount = await db.collection('posts').countDocuments({ userId: new ObjectId(userId) });
    
    // Get total likes received (sum of likes on user's posts)
    const userPosts = await db.collection('posts')
      .find({ userId: new ObjectId(userId) })
      .project({ likes: 1 })
      .toArray();
    
    const totalLikesReceived = userPosts.reduce((sum, post) => sum + (post.likes?.length || 0), 0);
    
    // Get total comments made by user
    const allPosts = await db.collection('posts').find().toArray();
    const commentsCount = allPosts.reduce((sum, post) => {
      if (post.comments) {
        const userComments = post.comments.filter(comment => comment.userId === userId);
        return sum + userComments.length;
      }
      return sum;
    }, 0);
    
    // Get user's last activity
    const userPostsSorted = await db.collection('posts')
      .find({ userId: new ObjectId(userId) })
      .sort({ createdAt: -1 })
      .limit(1)
      .toArray();
    
    const lastActivity = userPostsSorted[0]?.createdAt || user.createdAt;
    
    res.json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status || 'active',
        department: user.department || '',
        profilePhoto: user.profilePhoto,
        createdAt: user.createdAt,
        lastLogin: user.lastLogin,
        warningCount: user.warningCount || 0,
        connectionsCount: user.connections?.length || 0,
        restrictedUntil: user.restrictedUntil,
        restrictionReason: user.restrictionReason
      },
      activity: {
        postsCount,
        totalLikesReceived,
        commentsCount,
        lastActivity,
        loginCount: user.loginCount || 0
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Admin search users with filters
app.get("/api/admin/users/search", auth, requireAdmin, async (req, res) => {
  try {
    const { 
      query = '', 
      role = '', 
      status = '', 
      department = '',
      page = 1, 
      limit = 20 
    } = req.query;
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Build search query
    const searchQuery = {};
    
    if (query) {
      searchQuery.$or = [
        { name: { $regex: query, $options: 'i' } },
        { email: { $regex: query, $options: 'i' } },
        { department: { $regex: query, $options: 'i' } }
      ];
    }
    
    if (role) {
      searchQuery.role = role;
    }
    
    if (status) {
      searchQuery.status = status;
    }
    
    if (department) {
      searchQuery.department = { $regex: department, $options: 'i' };
    }
    
    // Get users
    const users = await db.collection('users')
      .find(searchQuery)
      .project({
        _id: 1,
        name: 1,
        email: 1,
        role: 1,
        status: 1,
        department: 1,
        profilePhoto: 1,
        createdAt: 1,
        warningCount: 1,
        connections: 1,
        restrictedUntil: 1,
        restrictionReason: 1
      })
      .skip(skip)
      .limit(parseInt(limit))
      .toArray();
    
    // Get total count for pagination
    const totalUsers = await db.collection('users').countDocuments(searchQuery);
    
    // Get stats for each user
    const usersWithStats = await Promise.all(
      users.map(async (user) => {
        const postsCount = await db.collection('posts').countDocuments({ userId: user._id });
        
        return {
          ...user,
          postsCount,
          connectionsCount: user.connections?.length || 0,
          isRestricted: user.status === 'restricted' && user.restrictedUntil > new Date()
        };
      })
    );
    
       res.json({
      success: true,
      users: usersWithStats,
      totalUsers: totalUsers, // ADD THIS LINE
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        totalUsers,
        totalPages: Math.ceil(totalUsers / parseInt(limit))
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// ==================== ADMIN ANALYTICS ====================

// Get detailed analytics with moderation stats (Admin only)
app.get("/api/admin/analytics", auth, requireAdmin, async (req, res) => {
  try {
    // Get today's date for daily stats
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Get yesterday for comparison
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    // Get 7 days ago for weekly stats
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // ==================== DAILY ACTIVITY STATS ====================
    
    // Daily posts for last 7 days
    const dailyPosts = await db.collection('posts')
      .aggregate([
        {
          $match: {
            createdAt: { $gte: sevenDaysAgo }
          }
        },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            count: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } }
      ]).toArray();

    // Daily connections for last 7 days
    const dailyConnections = await db.collection('connectionHistory')
      .aggregate([
        {
          $match: {
            date: { $gte: sevenDaysAgo },
            type: 'connected'
          }
        },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$date" } },
            count: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } }
      ]).toArray();

    // ==================== MODERATION STATS ====================
    
    // Reports resolved today
    const reportsResolvedToday = await db.collection('resolvedReports')
      .countDocuments({
        resolvedAt: { $gte: today }
      });

    // Total resolved reports
    const totalResolvedReports = await db.collection('resolvedReports')
      .countDocuments();

    // Pending reports (from posts collection)
    const pendingReports = await db.collection('posts')
      .countDocuments({ 
        isReported: true,
        "reports.0": { $exists: true }
      });

    // Active warnings (sum of warningCount from all users)
    const activeWarningsResult = await db.collection('users')
      .aggregate([
        { 
          $group: { 
            _id: null, 
            totalWarnings: { $sum: "$warningCount" } 
          } 
        }
      ]).toArray();
    const activeWarnings = activeWarningsResult[0]?.totalWarnings || 0;

    // Restricted accounts
    const restrictedAccounts = await db.collection('users')
      .countDocuments({ 
        status: 'restricted',
        restrictedUntil: { $gt: new Date() }
      });

    // ==================== PLATFORM GROWTH STATS ====================
    
    // New users today
    const newUsersToday = await db.collection('users')
      .countDocuments({ createdAt: { $gte: today } });

    // Total users
    const totalUsers = await db.collection('users').countDocuments();

    // Posts created today
    const postsToday = await db.collection('posts')
      .countDocuments({ createdAt: { $gte: today } });

    // Total posts
    const totalPosts = await db.collection('posts').countDocuments();

    // Active users today (users who logged in today)
    const activeUsersToday = await db.collection('users')
      .countDocuments({ lastLogin: { $gte: today } });

    // ==================== CONTENT STATS ====================
    
    // Top active users
    const topUsers = await db.collection('users')
      .aggregate([
        {
          $lookup: {
            from: "posts",
            localField: "_id",
            foreignField: "userId",
            as: "userPosts"
          }
        },
        {
          $lookup: {
            from: "connectionHistory",
            localField: "_id",
            foreignField: "userId",
            as: "connections"
          }
        },
        {
          $project: {
            _id: 1,
            name: 1,
            email: 1,
            role: 1,
            profilePhoto: 1,
            postCount: { $size: "$userPosts" },
            connectionCount: { 
              $size: { 
                $filter: {
                  input: "$connections",
                  as: "conn",
                  cond: { $eq: ["$$conn.type", "connected"] }
                }
              }
            },
            createdAt: 1,
            lastLogin: 1
          }
        },
        { $sort: { postCount: -1 } },
        { $limit: 10 }
      ]).toArray();

    // Posts by type
    const postsByType = await db.collection('posts')
      .aggregate([
        {
          $group: {
            _id: "$type",
            count: { $sum: 1 }
          }
        },
        { $sort: { count: -1 } }
      ]).toArray();

    // Posts by department
    const postsByDept = await db.collection('posts')
      .aggregate([
        {
          $lookup: {
            from: "users",
            localField: "userId",
            foreignField: "_id",
            as: "user"
          }
        },
        { $unwind: "$user" },
        {
          $group: {
            _id: "$user.department",
            count: { $sum: 1 }
          }
        },
        { $sort: { count: -1 } }
      ]).toArray();

    // Engagement by department (posts + likes)
    const engagementByDept = await db.collection('posts')
      .aggregate([
        {
          $lookup: {
            from: "users",
            localField: "userId",
            foreignField: "_id",
            as: "user"
          }
        },
        { $unwind: "$user" },
        {
          $group: {
            _id: "$user.department",
            postCount: { $sum: 1 },
            totalLikes: { $sum: { $size: { $ifNull: ["$likes", []] } } },
            totalComments: { $sum: { $size: { $ifNull: ["$comments", []] } } }
          }
        },
        {
          $project: {
            _id: 1,
            postCount: 1,
            totalLikes: 1,
            totalComments: 1,
            engagementScore: {
              $add: [
                { $multiply: ["$postCount", 2] },
                { $multiply: ["$totalLikes", 0.5] },
                { $multiply: ["$totalComments", 1] }
              ]
            }
          }
        },
        { $sort: { engagementScore: -1 } },
        { $limit: 10 }
      ]).toArray();

    // ==================== SYSTEM STATS ====================
    
    // Recent activity (last 24 hours)
    const last24Hours = new Date();
    last24Hours.setHours(last24Hours.getHours() - 24);
    
    const recentActivity = {
      posts: await db.collection('posts').countDocuments({ createdAt: { $gte: last24Hours } }),
      connections: await db.collection('connectionHistory').countDocuments({ 
        date: { $gte: last24Hours },
        type: 'connected'
      }),
      logins: await db.collection('users').countDocuments({ lastLogin: { $gte: last24Hours } }),
      reports: await db.collection('posts').countDocuments({ 
        isReported: true,
        "reports.timestamp": { $gte: last24Hours }
      })
    };

    // ==================== RESPONSE ====================
    
    res.json({
      // Daily trends
      dailyPosts,
      dailyConnections,
      
      // Moderation stats
      moderationStats: {
        pendingReports,
        reportsResolvedToday,
        totalResolvedReports,
        activeWarnings,
        restrictedAccounts,
        resolutionRate: totalResolvedReports > 0 ? 
          Math.round((reportsResolvedToday / (pendingReports + reportsResolvedToday)) * 100) : 0
      },
      
      // Platform growth
      platformStats: {
        newUsersToday,
        totalUsers,
        postsToday,
        totalPosts,
        activeUsersToday,
        growthRate: totalUsers > 0 ? 
          Math.round((newUsersToday / totalUsers) * 10000) / 100 : 0 // Percentage with 2 decimals
      },
      
      // Content stats
      topUsers,
      postsByType,
      postsByDept,
      engagementByDept,
      
      // Activity stats
      recentActivity,
      
      // Meta
      generatedAt: new Date(),
      timeRange: {
        today: today.toISOString(),
        last7Days: sevenDaysAgo.toISOString(),
        last24Hours: last24Hours.toISOString()
      }
    });
    
  } catch (error) {
    console.error("Error fetching analytics:", error);
    res.status(500).json({ 
      success: false,
      message: 'Server error fetching analytics', 
      error: error.message 
    });
  }
});

// ==================== NOTIFICATIONS API ====================

// Fetch current user's notifications
app.get("/api/notifications/me", auth, async (req, res) => {
  try {
    const userId = req.user.userId;

    const notifications = await db.collection('notifications')
      .find({ recipientId: new ObjectId(userId) })
      .sort({ createdAt: -1 })
      .toArray();

    // populate sender info
    const complete = await Promise.all(
      notifications.map(async (n) => {
        const sender = await db.collection('users').findOne({ _id: new ObjectId(n.senderId) });
        return {
          id: n._id,
          recipientId: n.recipientId,
          senderId: n.senderId,
          type: n.type,
          postId: n.postId,
          message: n.message,
          read: n.read,
          createdAt: n.createdAt,
          userName: sender?.name || "Campus Admin",
          userImage: sender?.profilePhoto || null,
          timeAgo: timeAgo(n.createdAt)
        };
      })
    );

    res.json(complete);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Mark single notification as read
app.put("/api/notifications/:id/read", auth, async (req, res) => {
  try {
    const notifId = req.params.id;
    const userId = req.user.userId;

    // Validate notification ID
    if (!ObjectId.isValid(notifId)) {
      return res.status(400).json({ message: 'Invalid notification ID' });
    }

    await db.collection('notifications').updateOne(
      { _id: new ObjectId(notifId), recipientId: new ObjectId(userId) },
      { $set: { read: true } }
    );

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Mark all as read
app.put("/api/notifications/read-all", auth, async (req, res) => {
  try {
    const userId = req.user.userId;
    await db.collection('notifications').updateMany(
      { recipientId: new ObjectId(userId) },
      { $set: { read: true } }
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Unread count (for badge)
app.get("/api/notifications/unread/count", auth, async (req, res) => {
  try {
    const userId = req.user.userId;
    const count = await db.collection('notifications')
      .countDocuments({ recipientId: new ObjectId(userId), read: false });
    res.json({ count });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Delete single notification
app.delete("/api/notifications/:id", auth, async (req, res) => {
  try {
    const notifId = req.params.id;
    const userId = req.user.userId;

    // Validate notification ID
    if (!ObjectId.isValid(notifId)) {
      return res.status(400).json({ message: 'Invalid notification ID' });
    }

    const result = await db.collection('notifications').deleteOne({
      _id: new ObjectId(notifId),
      recipientId: new ObjectId(userId)
    });

    if (result.deletedCount === 0) {
      return res.status(404).json({ message: 'Notification not found' });
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ==================== STATS ENDPOINT ====================

// Get campus stats (like in the image)
app.get("/api/stats", auth, async (req, res) => {
  try {
    const totalPosts = await db.collection('posts').countDocuments();
    const totalUsers = await db.collection('users').countDocuments();
    const activeUsers = await db.collection('users').countDocuments({
      lastActive: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
    });

    // Get current user stats
    const userId = req.user.userId;
    const user = await db.collection('users').findOne({ _id: new ObjectId(userId) });
    
    const userPosts = await db.collection('posts').countDocuments({ userId: new ObjectId(userId) });
    
    // Calculate total likes on user's posts
    const userPostsData = await db.collection('posts')
      .find({ userId: new ObjectId(userId) })
      .toArray();
    
    let totalUserLikes = 0;
    userPostsData.forEach(post => {
      totalUserLikes += post.likes?.length || 0;
    });

    // Get connection stats
    const connectionHistory = await db.collection('connectionHistory')
      .find({ userId: new ObjectId(userId) })
      .toArray();
    
    const connectedEvents = connectionHistory.filter(h => h.type === 'connected').length;
    const disconnectedEvents = connectionHistory.filter(h => h.type === 'disconnected').length;

    res.json({
      campusStats: {
        totalPosts,
        totalUsers,
        activeUsers
      },
      userStats: {
        posts: userPosts,
        likes: totalUserLikes,
        connections: user?.connections?.length || 0
      },
      connectionStats: {
        totalEvents: connectionHistory.length,
        connectionsMade: connectedEvents,
        connectionsRemoved: disconnectedEvents,
        netGrowth: connectedEvents - disconnectedEvents
      }
    });
  } catch (error) {
    console.error("Error fetching stats:", error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// ==================== TEST ROUTES ====================

app.get("/", (req, res) => {
  res.json({ 
    message: "Swish Backend API is running 🚀",
    version: "2.0",
    campus: "SIGCE Campus",
    features: "Complete Event & Poll System, Cloudinary Media Upload, Real-time Notifications, Admin Dashboard, Post Deletion, Connection History Tracking, Post Sharing System - FIXED FOR ALL FEEDS"
  });
});

app.get("/api/test", async (req, res) => {
  try {
    const users = await db.collection('users').find().toArray();
    const posts = await db.collection('posts').find().toArray();
    const connectionHistory = await db.collection('connectionHistory').find().toArray();
    
    // Count posts by type
    const textPosts = await db.collection('posts').countDocuments({ type: 'text' });
    const eventPosts = await db.collection('posts').countDocuments({ type: 'event' });
    const pollPosts = await db.collection('posts').countDocuments({ type: 'poll' });
    
    // Check shares field status
    const postsWithInvalidShares = await db.collection('posts').find({
      $or: [
        { shares: { $type: "number" } },
        { shares: { $type: "string" } },
        { shares: { $exists: false } },
        { shares: null }
      ]
    }).toArray();
    
    // Check posts shared with users
    const postsWithShares = await db.collection('posts').countDocuments({
      shares: { $exists: true, $ne: [] }
    });
    
    res.json({ 
      message: 'API is working!', 
      users: users.length,
      posts: posts.length,
      connectionHistory: connectionHistory.length,
      postTypes: {
        text: textPosts,
        event: eventPosts,
        poll: pollPosts
      },
      sharesFieldStatus: {
        postsWithInvalidShares: postsWithInvalidShares.length,
        postsWithValidShares: postsWithShares,
        migrationNeeded: postsWithInvalidShares.length > 0
      },
      campus: 'SIGCE Campus',
      media: 'Cloudinary uploads active',
      tracking: 'Connection history tracking enabled',
      sharing: 'Post sharing system enabled - WORKING FOR ALL FEEDS'
    });
  } catch (error) {
    res.status(500).json({ message: 'Database error', error: error.message });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error("❌ Global Error:", err);
  res.status(500).json({
    message: "Internal server error",
    error: process.env.NODE_ENV === "development" ? err.message : undefined
  });
});

// Start server (use server, not app)
server.listen(PORT, () => console.log(`🚀 Server running on port: ${PORT} with Post Sharing System Working for ALL FEEDS`));