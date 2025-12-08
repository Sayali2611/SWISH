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
    const { 
      name, email, password, contact, role,
      studentId, department, year,
      employeeId, facultyDepartment, designation,
      adminCode
    } = req.body;

    // Check if user exists
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({
        success: false,
        message: 'User already exists with this email'
      });
    }

    // Admin verification
    if (role === 'admin' && adminCode !== "CAMPUS2024") {
      return res.status(400).json({
        success: false,
        message: 'Invalid admin access code'
      });
    }

    // Create user object
    const userData = {
      name,
      email,
      password,
      contact,
      role
    };

    // Add role-specific fields
    if (role === 'student') {
      userData.studentId = studentId;
      userData.department = department;
      userData.year = year;
    } else if (role === 'faculty') {
      userData.employeeId = employeeId;
      userData.facultyDepartment = facultyDepartment;
      userData.designation = designation;
    } else if (role === 'admin') {
      userData.adminCode = adminCode;
    }

    // Hash password before creating user
    const salt = await bcrypt.genSalt(10);
    userData.password = await bcrypt.hash(userData.password, salt);

    // Create user
    const user = await User.create(userData);

    // Generate token
    const token = generateToken(user._id);

    res.status(201).json({
      success: true,
      message: 'User registered successfully!',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department || user.facultyDepartment,
        profilePhoto: user.profilePhoto
      }
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during registration',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
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
    // SAFETY CHECK for req.body
    const updates = req.body || {};
    const userId = req.user.id;

    // Check if updates object is empty
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No update data provided'
      });
    }

    // Don't allow email/password updates here
    delete updates.email;
    delete updates.password;

    // Parse skills if it's a string
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

// 🚀 NEW FUNCTION: Search Users
// @desc    Search for users by name
// @route   GET /api/users/search
// @access  Private
const searchUsers = async (req, res) => {
  try {
    // The frontend sends the search query as 'name' in the URL query parameters
    const { name } = req.query; 

    if (!name || name.trim().length === 0) {
      return res.status(400).json({ message: 'Search term is required' });
    }

    // Create a case-insensitive regex for the search term (partial match)
    // The 'i' option makes the search case-insensitive
    const searchRegex = new RegExp(name, 'i');

    // Find users where name matches, excluding the current user
    const users = await User.find({
      name: { $regex: searchRegex },
      // Exclude the user performing the search
      _id: { $ne: req.user.id } 
    })
    // Select only the necessary fields for the search results display
    .select('name email profilePhoto role department facultyDepartment')
    .limit(10); // Limit results for better performance

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
  searchUsers // 👈 Export the new function
};