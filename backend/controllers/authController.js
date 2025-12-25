const User = require('../models/User');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

// Generate JWT Token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: '30d'
  });
};

// @desc    Register user
// @route   POST /api/auth/register
// @access  Public
const registerUser = async (req, res) => {
  try {
    console.log("=".repeat(50));
    console.log("🚨 DEBUG REGISTRATION START");
    console.log("=".repeat(50));
    
    // Log EVERYTHING in request
    console.log("📦 Full req.body:", JSON.stringify(req.body, null, 2));
    console.log("📦 req.body type:", typeof req.body);
    console.log("📦 req.body keys:", Object.keys(req.body));
    
    // Check isPrivate specifically
    const hasIsPrivate = 'isPrivate' in req.body;
    console.log("🔍 Does req.body have 'isPrivate'?", hasIsPrivate);
    console.log("🔍 req.body.isPrivate value:", req.body.isPrivate);
    console.log("🔍 req.body.isPrivate type:", typeof req.body.isPrivate);
    
    // Get all fields
    const {
      name, email, password, contact, role,
      studentId, department, year,
      employeeId, facultyDepartment, designation,
      adminCode, bio
    } = req.body;

    // Check ALL values
    console.log("📝 Name:", name);
    console.log("📝 Email:", email);
    console.log("📝 Role:", role);
    console.log("📝 Raw isPrivate from form:", req.body.isPrivate);
    
    // Convert isPrivate
    let isPrivate = req.body.isPrivate;
    console.log("🔒 Raw isPrivate:", isPrivate);
    console.log("🔒 isPrivate === 'true':", isPrivate === 'true');
    console.log("🔒 isPrivate === true:", isPrivate === true);
    
    if (isPrivate === 'true' || isPrivate === true) {
      isPrivate = true;
    } else {
      isPrivate = false;
    }
    
    console.log("✅ Final isPrivate (boolean):", isPrivate);
    console.log("✅ Final isPrivate type:", typeof isPrivate);

    // Check if user exists
    const userExists = await User.findOne({ email });
    console.log("👤 User exists check:", userExists ? "YES" : "NO");
    
    if (userExists) {
      return res.status(400).json({
        success: false,
        message: 'User already exists with this email'
      });
    }

    // Create user object
    const userData = {
      name,
      email,
      password,
      contact,
      role,
      isPrivate, // 👈 THIS SHOULD BE TRUE/FALSE
      bio: bio || "Campus community member"
    };
    
    console.log("💾 User data to save:", JSON.stringify(userData, null, 2));

    // Hash password
    const salt = await bcrypt.genSalt(10);
    userData.password = await bcrypt.hash(userData.password, salt);

    // Create user
    const user = await User.create(userData);
    console.log("🎉 User created successfully!");
    console.log("🎉 User ID:", user._id);
    console.log("🎉 User isPrivate from DB:", user.isPrivate);
    console.log("🎉 User isPrivate type from DB:", typeof user.isPrivate);

    // Generate token
    const token = generateToken(user._id);

    console.log("=".repeat(50));
    console.log("✅ REGISTRATION COMPLETE");
    console.log("=".repeat(50));
    
    res.status(201).json({
      success: true,
      message: 'User registered successfully!',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isPrivate: user.isPrivate, // Send back
        bio: user.bio
      }
    });

  } catch (error) {
    console.error('❌ Registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during registration'
    });
  }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user
    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Check password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Generate token
    const token = generateToken(user._id);

    // IMPORTANT: Include isPrivate in response
    res.json({
      success: true,
      message: 'Login successful!',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        contact: user.contact,
        bio: user.bio,
        skills: user.skills,
        studentId: user.studentId,
        department: user.department || user.facultyDepartment,
        year: user.year,
        employeeId: user.employeeId,
        designation: user.designation,
        profilePhoto: user.profilePhoto,
        isPrivate: Boolean(user.isPrivate), // ✅ BEST
        createdAt: user.createdAt
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during login'
    });
  }
};

// @desc    Get user profile
// @route   GET /api/auth/profile
// @access  Private
const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      user
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Update user profile
// @route   PUT /api/auth/profile
// @access  Private
const updateProfile = async (req, res) => {
  try {
    const updates = req.body || {};
    const userId = req.user.id;

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No update data provided'
      });
    }

    // Don't allow email/password updates here
    delete updates.email;
    delete updates.password;

    // Handle isPrivate conversion
    if (updates.isPrivate !== undefined) {
      updates.isPrivate = Boolean(updates.isPrivate);
    }

    // Parse skills if string
    if (updates.skills && typeof updates.skills === 'string') {
      try {
        updates.skills = JSON.parse(updates.skills);
      } catch (error) {
        updates.skills = updates.skills.split(',').map(skill => skill.trim());
      }
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { $set: updates },
      { new: true, runValidators: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      message: 'Profile updated successfully',
      user
    });

  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during profile update'
    });
  }
};

// @desc    Search users
// @route   GET /api/users/search
// @access  Private
const searchUsers = async (req, res) => {
  try {
    const { name } = req.query;

    if (!name || name.trim().length === 0) {
      return res.status(400).json({ message: 'Search term is required' });
    }

    const searchRegex = new RegExp(name, 'i');

    const users = await User.find({
      name: { $regex: searchRegex },
      _id: { $ne: req.user.id }
    })
    .select('name email profilePhoto role department facultyDepartment isPrivate')
    .limit(10);

    res.json(users);

  } catch (error) {
    console.error('Search users error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error during user search' 
    });
  }
};

module.exports = {
  registerUser,
  loginUser,
  getProfile,
  updateProfile,
  searchUsers
};