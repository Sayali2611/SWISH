const express = require('express');
const router = express.Router();
const exploreController = require('../controllers/exploreController');

// Import the same dependencies as server.js
const jwt = require('jsonwebtoken');

// Create auth middleware that matches server.js implementation
const auth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ message: 'No token, authorization denied' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    console.error("Auth middleware error:", error.message);
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ message: 'Token is not valid' });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token expired' });
    }
    res.status(500).json({ message: 'Server error during authentication' });
  }
};

// All routes require authentication
router.use(auth);

// Trending posts with time filter
router.get('/trending', exploreController.getTrendingPosts);

// Latest posts
router.get('/latest', exploreController.getLatestPosts);

// Posts by category
router.get('/category/:category', exploreController.getPostsByCategory);

// Posts by hashtag
router.get('/hashtag/:tag', exploreController.getPostsByHashtag);

// Posts by media type
router.get('/media/:type', exploreController.getPostsByMediaType);

// Search posts, users, and hashtags
router.get('/search', exploreController.search);

// Discover people
router.get('/people', exploreController.discoverPeople);

// Trending hashtags
router.get('/hashtags/trending', exploreController.getTrendingHashtags);

module.exports = router;