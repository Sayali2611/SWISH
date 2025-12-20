// server.js - COMPLETE UPDATED VERSION WITH EVENTS, POLLS, AND DELETE
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

require("dotenv").config();

const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" } // restrict in production
});

const PORT = process.env.PORT || 5000;

// Middleware
app.use(express.json());
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:5173', 'https://campusconnect-sigce.vercel.app'],
  credentials: true
}));

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
const connectDB = async () => {
  try {
    const client = new MongoClient(process.env.MONGODB_URI);
    await client.connect();
    db = client.db('swish');
    console.log("✅ MongoDB connected successfully to Atlas");
    
    // Create indexes
    await db.collection('users').createIndex({ email: 1 }, { unique: true });
    await db.collection('posts').createIndex({ createdAt: -1 });
    await db.collection('posts').createIndex({ userId: 1 });
    await db.collection('notifications').createIndex({ recipientId: 1, createdAt: -1 });
    await db.collection('posts').createIndex({ type: 1 }); // New index for post types
    await db.collection('posts').createIndex({ "poll.question": "text", content: "text" }); // Text search index
    
  } catch (err) {
    console.error("❌ MongoDB connection failed", err);
  }
};
connectDB();

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
    const notification = {
      recipientId: new ObjectId(recipientId),
      senderId: new ObjectId(senderId),
      type,
      postId: postId ? new ObjectId(postId) : null,
      message,
      read: false,
      createdAt: new Date()
    };

    const result = await db.collection("notifications").insertOne(notification);

    // populate sender info to send to client
    const sender = await db.collection("users").findOne({ _id: new ObjectId(senderId) });
    const payload = {
      id: result.insertedId,
      recipientId,
      senderId,
      type,
      postId,
      message,
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

// ==================== AUTH ROUTES ====================

// Register with Cloudinary
app.post("/api/auth/register", profileUpload.single('profilePhoto'), async (req, res) => {
  try {
    const { 
      name, email, password, role, contact,
      studentId, department, year,
      employeeId, facultyDepartment, designation,
      adminCode
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
      bio: 'Passionate about technology and innovation. Always eager to learn and grow.',
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
      updatedAt: new Date()
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
      skills: user.skills,
      campus: user.campus,
      // NEW NETWORK FIELDS WITH UPDATED NAMES
      sentRequests: user.sentRequests || [],
      receivedRequests: user.receivedRequests || [],
      connections: user.connections || [],
      // ===================
      isVerified: user.isVerified || false
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
      await cloudinary.uploader.destroy(req.file.filename);
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

    const userResponse = {
      id: user._id,
      name: user.name,
      email: user.email,
      contact: user.contact,
      role: user.role,
      profilePhoto: user.profilePhoto,
      bio: user.bio,
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
      designation: user.designation || ''
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
      designation
    } = req.body;

    const userId = req.user.userId;

    const updateData = {
      updatedAt: new Date()
    };

    if (name) updateData.name = name;
    if (contact !== undefined) updateData.contact = contact;
    if (bio !== undefined) updateData.bio = bio;
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
    const user = await db.collection('users').findOne({ _id: new ObjectId(userId) });
    
    const postResponse = {
      _id: result.insertedId,
      content: post.content,
      type: post.type,
      media: post.media,
      likes: post.likes,
      comments: post.comments,
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
    const { content, type, event, poll } = req.body;
    const userId = req.user.userId;
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
    const user = await db.collection('users').findOne({ _id: new ObjectId(userId) });
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

// Get all posts (updated to include type, event, and poll)
app.get("/api/posts", auth, async (req, res) => {
  try {
    console.log("📥 GETTING ALL POSTS...");
    
    const posts = await db.collection('posts').find().sort({ createdAt: -1 }).toArray();
    
    console.log(`Found ${posts.length} posts`);
    
    const postsWithUsers = await Promise.all(
      posts.map(async (post) => {
        const user = await db.collection('users').findOne({ _id: new ObjectId(post.userId) });
        return {
          _id: post._id,
          content: post.content,
          type: post.type || 'text',
          media: post.media || [],
          likes: post.likes || [],
          comments: post.comments || [],
          event: post.event || null,
          poll: post.poll || null,
          createdAt: post.createdAt,
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

    res.json(postsWithUsers);
  } catch (error) {
    console.error("Error fetching posts:", error);
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
        postId: postId,
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

// Like/unlike post
app.post("/api/posts/:postId/like", auth, async (req, res) => {
  try {
    const { postId } = req.params;
    const userId = req.user.userId;

    // Validate postId
    if (!ObjectId.isValid(postId)) {
      return res.status(400).json({ message: 'Invalid post ID' });
    }

    const post = await db.collection("posts").findOne({ _id: new ObjectId(postId) });
    if (!post) return res.status(404).json({ message: "Post not found" });

    const postOwnerId = post.userId.toString();

    // convert likes to string for uniform comparison
    const normalizedLikes = (post.likes || []).map(id => id.toString());

    const alreadyLiked = normalizedLikes.includes(userId);

    if (alreadyLiked) {
      await db.collection("posts").updateOne(
        { _id: new ObjectId(postId) },
        { $pull: { likes: userId } }
      );
    } else {
      await db.collection("posts").updateOne(
        { _id: new ObjectId(postId) },
        { $push: { likes: userId } }
      );
    }

    // Get post again
    const updatedPost = await db.collection("posts").findOne({ _id: new ObjectId(postId) });
    const user = await db.collection("users").findOne({ _id: new ObjectId(updatedPost.userId) });

    // SEND NOTIFICATION ONLY IF:
    // 1. it's a new like AND
    // 2. liker is NOT the owner
    if (!alreadyLiked && userId !== postOwnerId) {
      const liker = await db.collection("users").findOne(
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

    res.json({
      _id: updatedPost._id,
      content: updatedPost.content,
      type: updatedPost.type || 'text',
      media: updatedPost.media || [],
      likes: updatedPost.likes || [],
      comments: updatedPost.comments || [],
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
    });

  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Add comment to post
app.post("/api/posts/:postId/comment", auth, async (req, res) => {
  try {
    const { content } = req.body;
    const postId = req.params.postId;
    const userId = req.user.userId;

    if (!content || !content.trim()) {
      return res.status(400).json({ message: 'Comment content is required' });
    }

    // Validate postId
    if (!ObjectId.isValid(postId)) {
      return res.status(400).json({ message: 'Invalid post ID' });
    }

    // Get user info for comment
    const user = await db.collection('users').findOne({ _id: new ObjectId(userId) });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const post = await db.collection('posts').findOne({ _id: new ObjectId(postId) });
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    const comment = {
      content: content.trim(),
      userId: userId,
      userName: user.name,
      userProfilePhoto: user.profilePhoto,
      timestamp: new Date()
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
      .limit(20)
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
        return {
          _id: post._id,
          content: post.content,
          type: post.type || 'text',
          media: post.media || [],
          likes: post.likes || [],
          comments: post.comments || [],
          event: post.event || null,
          poll: post.poll || null,
          createdAt: post.createdAt,
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

// Get user's posts for profile page
app.get("/api/users/:userId/posts", auth, async (req, res) => {
  try {
    const { userId } = req.params;

    // Validate userId is a valid ObjectId
    if (!ObjectId.isValid(userId)) {
      return res.status(400).json({ message: 'Invalid user ID format' });
    }

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
      user: {
        id: user?._id,
        name: user?.name || "Unknown User",
        profilePhoto: user?.profilePhoto,
        role: user?.role,
        department: user?.department
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
      const hasLiked = post.likes && post.likes.includes(userId);
      
      // Check if user commented on this post
      const userComments = post.comments ? 
        post.comments.filter(comment => comment.userId === userId) : [];
      
      if (hasLiked || userComments.length > 0) {
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
    
    // Get current user to exclude connections
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
        department: 1,
        designation: 1,
        bio: 1,
        skills: 1,
        year: 1
      })
      .limit(50)
      .toArray();

    res.json(users);
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// ==================== NETWORK ROUTES ====================

// Send connection request (updated field names)
app.post("/api/network/request/:userId", auth, async (req, res) => {
  try {
    const targetUserId = req.params.userId;
    const currentUserId = req.user.userId;

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

// Accept connection request (updated field names)
app.post("/api/network/accept/:userId", auth, async (req, res) => {
  try {
    const senderUserId = req.params.userId;
    const currentUserId = req.user.userId;

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

// Reject connection request (updated field names)
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

// Cancel outgoing connection request (updated field names)
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

// Remove connection
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

    res.json({ 
      success: true, 
      message: "Connection removed successfully" 
    });
  } catch (error) {
    console.error("Error removing connection:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Get network status with a user (updated field names)
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
        skills: 1
      })
      .toArray();

    res.json({
      success: true,
      count: connections.length,
      connections
    });
  } catch (error) {
    console.error("Error getting connections:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Get received connection requests (updated field names)
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

// Get sent connection requests (updated field names)
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

// Search users for networking (updated field names)
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

// Get network statistics (updated field names)
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

    res.json({
      success: true,
      stats: {
        connections: user?.connections?.length || 0,
        receivedRequests: user?.receivedRequests?.length || 0,
        sentRequests: user?.sentRequests?.length || 0,
        followers: user?.followers?.length || 0,
        following: user?.following?.length || 0
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
    
    res.json({
      totalUsers,
      totalPosts,
      postsToday,
      postsByType: { text: textPosts, event: eventPosts, poll: pollPosts },
      usersByRole: { students, faculty, admins }
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

// Resolve report (Admin only - mark as reviewed) - WITH NOTIFICATIONS TO ALL PARTIES
app.post("/api/admin/reports/:postId/resolve", auth, requireAdmin, async (req, res) => {
  try {
    const { postId } = req.params;
    const { action, adminReason } = req.body; // 'keep', 'delete'

    // Validate postId
    if (!ObjectId.isValid(postId)) {
      return res.status(400).json({ message: 'Invalid post ID' });
    }

    const post = await db.collection('posts').findOne({ _id: new ObjectId(postId) });
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    // Update all reports for this post as resolved
    await db.collection('posts').updateOne(
      { _id: new ObjectId(postId) },
      { 
        $set: { 
          isReported: false,
          "reports.$[].status": "resolved"
        }
      }
    );

    // If action is 'delete', delete the post and notify
    if (action === 'delete') {
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
          }
        }
      }
      
      await db.collection('posts').deleteOne({ _id: new ObjectId(postId) });
      
      // Notify post owner
      await createNotification({
        recipientId: post.userId.toString(),
        senderId: req.user.userId,
        type: "post_deleted",
        postId,
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
              postId,
              message: `✅ Thank you for reporting. The post was removed. Admin: "${adminReason || "Content violated guidelines"}"`
            });
          }
        }
      }
      
      res.json({ 
        message: 'Report resolved. Post deleted.',
        action: 'delete'
      });
    } 
    // If action is 'keep', notify all parties
    else if (action === 'keep') {
      // Notify post owner
      await createNotification({
        recipientId: post.userId.toString(),
        senderId: req.user.userId,
        type: "post_approved",
        postId,
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
              postId,
              message: `ℹ️ Your report was reviewed. The post was kept as it doesn't violate guidelines.`
            });
          }
        }
      }
      
      res.json({ 
        message: 'Report resolved. Post kept.',
        action: 'keep'
      });
    } else {
      return res.status(400).json({ message: 'Invalid action. Use "keep" or "delete"' });
    }
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

// ==================== ADMIN ANALYTICS ====================

// Get detailed analytics (Admin only)
app.get("/api/admin/analytics", auth, requireAdmin, async (req, res) => {
  try {
    // Daily posts for last 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
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
          $project: {
            name: 1,
            email: 1,
            role: 1,
            postCount: { $size: "$userPosts" },
            createdAt: 1
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

    res.json({
      dailyPosts,
      topUsers,
      postsByType,
      postsByDept,
      generatedAt: new Date()
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
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
    features: "Complete Event & Poll System, Cloudinary Media Upload, Real-time Notifications, Admin Dashboard, Post Deletion"
  });
});

app.get("/api/test", async (req, res) => {
  try {
    const users = await db.collection('users').find().toArray();
    const posts = await db.collection('posts').find().toArray();
    
    // Count posts by type
    const textPosts = await db.collection('posts').countDocuments({ type: 'text' });
    const eventPosts = await db.collection('posts').countDocuments({ type: 'event' });
    const pollPosts = await db.collection('posts').countDocuments({ type: 'poll' });
    
    res.json({ 
      message: 'API is working!', 
      users: users.length,
      posts: posts.length,
      postTypes: {
        text: textPosts,
        event: eventPosts,
        poll: pollPosts
      },
      campus: 'SIGCE Campus',
      media: 'Cloudinary uploads active'
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
server.listen(PORT, () => console.log(`🚀 Server running on port: ${PORT} with Complete Event & Poll System`));