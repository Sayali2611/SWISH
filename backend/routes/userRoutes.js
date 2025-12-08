const express = require('express');
const router = express.Router();
// Assuming you have an authentication middleware file
const { protect } = require('../middleware/auth'); 
// Import the new function from the controller
const { searchUsers } = require('../controllers/authController'); 

// @route:  GET /api/users/search
// @desc:   Search for users by name
// @access: Private (Requires the 'protect' middleware)
router.get('/search', protect, searchUsers);

module.exports = router;