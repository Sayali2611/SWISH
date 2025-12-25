// backend/controllers/postController.js
const { ObjectId } = require('mongodb');

// @desc    Create a post with media
// @route   POST /api/posts
// @access  Private
const createPost = async (req, res) => {
  try {
    console.log("📤 Creating post...", req.body);
    console.log("📤 Files:", req.files);
    
    // Handle both form-data and JSON
    let content = '';
    let media = [];
    
    if (req.body.content) {
      content = req.body.content;
    } else if (req.body) {
      // Handle JSON body
      content = req.body.content || '';
    }
    
    const userId = req.user.id;

    // Validate required fields
    if (!content || content.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Post content is required'
      });
    }

    // Get user details
    const user = await req.db.collection('users').findOne(
      { _id: new ObjectId(userId) },
      { projection: { name: 1, role: 1, department: 1, facultyDepartment: 1, profilePhoto: 1, isPrivate: 1, connections: 1 } }
    );
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Process uploaded files if any
    if (req.files && req.files.length > 0) {
      media = req.files.map(file => ({
        type: file.mimetype.startsWith('image/') ? 'image' : 'video',
        url: file.path || file.location || `/uploads/${file.filename}`, // Cloudinary URL or local path
        publicId: file.filename,
        format: file.mimetype.split('/')[1],
        size: file.size || 0
      }));
    }

    // Create post object
    const post = {
      content: content.trim(),
      media: media,
      userId: new ObjectId(userId),
      likes: [],
      comments: [],
      createdAt: new Date(),
      updatedAt: new Date()
    };

    console.log("📝 Post to save:", post);

    const result = await req.db.collection('posts').insertOne(post);
    const postId = result.insertedId;

    // Get the saved post
    const savedPost = await req.db.collection('posts').findOne(
      { _id: postId },
      { projection: { userId: 0 } } // Exclude userId from response
    );

    // Prepare response with user info
    const postResponse = {
      _id: savedPost._id,
      content: savedPost.content,
      media: savedPost.media || [],
      likes: savedPost.likes || [],
      comments: savedPost.comments || [],
      createdAt: savedPost.createdAt,
      user: {
        id: user._id,
        name: user.name,
        role: user.role,
        profilePhoto: user.profilePhoto,
        department: user.department || user.facultyDepartment,
        isPrivate: Boolean(user.isPrivate)
      }
    };

    console.log("✅ Post created successfully:", postResponse._id);

    res.status(201).json({
      success: true,
      message: 'Post created successfully',
      post: postResponse
    });

  } catch (error) {
    console.error('❌ Create post error:', error);
    console.error('❌ Error stack:', error.stack);
    
    res.status(500).json({
      success: false,
      message: 'Server error creating post',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// @desc    Get all posts with privacy filtering
// @route   GET /api/posts
// @access  Private
const getPosts = async (req, res) => {
  try {
    const currentUserId = req.user.id;
    
    // Get current user details including connections and isPrivate
    const currentUser = await req.db.collection('users').findOne(
      { _id: new ObjectId(currentUserId) },
      { projection: { connections: 1, isPrivate: 1 } }
    );
    
    const userConnections = currentUser?.connections || [];
    
    // Get all posts with user info
    const posts = await req.db.collection('posts')
      .aggregate([
        {
          $lookup: {
            from: "users",
            localField: "userId",
            foreignField: "_id",
            as: "user"
          }
        },
        {
          $unwind: "$user"
        },
        {
          $addFields: {
            // Check if viewer can see this post
            canView: {
              $cond: [
                { $eq: ["$user.isPrivate", false] }, // Public user - anyone can see
                true,
                { // Private user - only connections or own posts
                  $or: [
                    { $eq: ["$userId", new ObjectId(currentUserId)] }, // Own post
                    { $in: ["$userId", userConnections] } // Connected user
                  ]
                }
              ]
            }
          }
        },
        {
          $match: {
            canView: true // Only show posts the user can view
          }
        },
        {
          $sort: { createdAt: -1 }
        }
      ])
      .toArray();

    // Format response
    const postsWithUsers = posts.map(post => ({
      _id: post._id,
      content: post.content,
      media: post.media || [],
      likes: post.likes || [],
      comments: post.comments || [],
      createdAt: post.createdAt,
      user: {
        id: post.user._id,
        name: post.user.name,
        role: post.user.role,
        profilePhoto: post.user.profilePhoto,
        department: post.user.department || post.user.facultyDepartment,
        isPrivate: post.user.isPrivate || false
      }
    }));

    res.json({
      success: true,
      count: postsWithUsers.length,
      posts: postsWithUsers
    });

  } catch (error) {
    console.error('Get posts error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching posts'
    });
  }
};

// @desc    Like/unlike a post
// @route   POST /api/posts/:postId/like
// @access  Private
const likePost = async (req, res) => {
  try {
    const { postId } = req.params;
    const userId = req.user.id;
    
    // Check if post exists
    const post = await req.db.collection('posts').findOne({ _id: new ObjectId(postId) });
    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found'
      });
    }
    
    // Check if user already liked the post
    const alreadyLiked = post.likes?.some(likeId => likeId.toString() === userId.toString());
    
    let updatedPost;
    if (alreadyLiked) {
      // Unlike the post
      updatedPost = await req.db.collection('posts').findOneAndUpdate(
        { _id: new ObjectId(postId) },
        { $pull: { likes: new ObjectId(userId) } },
        { returnDocument: 'after' }
      );
    } else {
      // Like the post
      updatedPost = await req.db.collection('posts').findOneAndUpdate(
        { _id: new ObjectId(postId) },
        { $push: { likes: new ObjectId(userId) } },
        { returnDocument: 'after' }
      );
    }
    
    res.json({
      success: true,
      message: alreadyLiked ? 'Post unliked' : 'Post liked',
      post: updatedPost.value
    });
    
  } catch (error) {
    console.error('Like post error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Add comment to post
// @route   POST /api/posts/:postId/comment
// @access  Private
const addComment = async (req, res) => {
  try {
    const { postId } = req.params;
    const { content } = req.body;
    const userId = req.user.id;
    
    if (!content || content.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Comment content is required'
      });
    }
    
    // Get user details
    const user = await req.db.collection('users').findOne(
      { _id: new ObjectId(userId) },
      { projection: { name: 1 } }
    );
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    const comment = {
      user: new ObjectId(userId),
      userName: user.name,
      content: content.trim(),
      timestamp: new Date()
    };
    
    const updatedPost = await req.db.collection('posts').findOneAndUpdate(
      { _id: new ObjectId(postId) },
      { $push: { comments: comment } },
      { returnDocument: 'after' }
    );
    
    if (!updatedPost.value) {
      return res.status(404).json({
        success: false,
        message: 'Post not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Comment added successfully',
      post: updatedPost.value
    });
    
  } catch (error) {
    console.error('Add comment error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Search posts
// @route   GET /api/posts/search
// @access  Private
const searchPosts = async (req, res) => {
  try {
    const { query } = req.query;
    const currentUserId = req.user.id;
    
    if (!query || query.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Search query is required'
      });
    }
    
    // Get current user connections
    const currentUser = await req.db.collection('users').findOne(
      { _id: new ObjectId(currentUserId) },
      { projection: { connections: 1 } }
    );
    
    const userConnections = currentUser?.connections || [];
    
    // Search posts with privacy filtering
    const posts = await req.db.collection('posts')
      .aggregate([
        {
          $lookup: {
            from: "users",
            localField: "userId",
            foreignField: "_id",
            as: "user"
          }
        },
        {
          $unwind: "$user"
        },
        {
          $addFields: {
            canView: {
              $cond: [
                { $eq: ["$user.isPrivate", false] },
                true,
                {
                  $or: [
                    { $eq: ["$userId", new ObjectId(currentUserId)] },
                    { $in: ["$userId", userConnections] }
                  ]
                }
              ]
            }
          }
        },
        {
          $match: {
            canView: true,
            $or: [
              { content: { $regex: query, $options: 'i' } },
              { "user.name": { $regex: query, $options: 'i' } }
            ]
          }
        },
        {
          $sort: { createdAt: -1 }
        }
      ])
      .toArray();
    
    res.json({
      success: true,
      count: posts.length,
      posts: posts.map(post => ({
        _id: post._id,
        content: post.content,
        media: post.media || [],
        likes: post.likes || [],
        comments: post.comments || [],
        createdAt: post.createdAt,
        user: {
          id: post.user._id,
          name: post.user.name,
          role: post.user.role,
          profilePhoto: post.user.profilePhoto,
          department: post.user.department || post.user.facultyDepartment,
          isPrivate: post.user.isPrivate || false
        }
      }))
    });
    
  } catch (error) {
    console.error('Search posts error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error searching posts'
    });
  }
};

module.exports = {
  createPost,
  getPosts,
  likePost,
  addComment,
  searchPosts
};