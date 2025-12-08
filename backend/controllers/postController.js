const { ObjectId } = require('mongodb');

// @desc    Create a post
// @route   POST /api/posts
// @access  Private
const createPost = async (req, res) => {
  try {
    // SAFETY CHECK for req.body
    const { content, imageUrl } = req.body || {};
    const userId = req.user.id;

    // Validate required fields
    if (!content || content.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Post content is required'
      });
    }

    // Get user details from db (req.db is your database connection)
    const user = await req.db.collection('users').findOne(
      { _id: new ObjectId(userId) },
      { projection: { name: 1, role: 1, department: 1, profilePhoto: 1 } }
    );
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const post = {
      content: content.trim(),
      imageUrl: imageUrl || '',
      userId: new ObjectId(userId),
      likes: [],
      comments: [],
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const result = await req.db.collection('posts').insertOne(post);
    const postId = result.insertedId;

    // Prepare response with user info
    const postResponse = {
      _id: postId,
      content: post.content,
      imageUrl: post.imageUrl,
      likes: post.likes,
      comments: post.comments,
      createdAt: post.createdAt,
      user: {
        id: user._id,
        name: user.name,
        role: user.role,
        profilePhoto: user.profilePhoto,
        department: user.department
      }
    };

    res.status(201).json({
      success: true,
      message: 'Post created successfully',
      post: postResponse
    });

  } catch (error) {
    console.error('Create post error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error creating post'
    });
  }
};

// @desc    Get all posts
// @route   GET /api/posts
// @access  Private
const getPosts = async (req, res) => {
  try {
    const posts = await req.db.collection('posts')
      .find()
      .sort({ createdAt: -1 })
      .toArray();

    // Get user data for each post
    const postsWithUsers = await Promise.all(
      posts.map(async (post) => {
        const user = await req.db.collection('users').findOne(
          { _id: new ObjectId(post.userId) },
          { 
            projection: { 
              name: 1, 
              role: 1, 
              profilePhoto: 1, 
              department: 1,
              facultyDepartment: 1,
              designation: 1 
            } 
          }
        );

        return {
          _id: post._id,
          content: post.content,
          imageUrl: post.imageUrl,
          likes: post.likes || [],
          comments: post.comments || [],
          createdAt: post.createdAt,
          user: {
            id: user?._id,
            name: user?.name || "Unknown User",
            role: user?.role,
            profilePhoto: user?.profilePhoto,
            department: user?.department,
            facultyDepartment: user?.facultyDepartment,
            designation: user?.designation
          }
        };
      })
    );

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

// @desc    Like a post
// @route   POST /api/posts/:postId/like
// @access  Private
const likePost = async (req, res) => {
  try {
    const postId = req.params.postId;
    const userId = req.user.id;

    const post = await req.db.collection('posts').findOne({ _id: new ObjectId(postId) });
    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found'
      });
    }

    // Check if already liked
    const alreadyLiked = (post.likes || []).some(likeId => likeId.toString() === userId.toString());

    if (alreadyLiked) {
      // Unlike
      await req.db.collection('posts').updateOne(
        { _id: new ObjectId(postId) },
        { $pull: { likes: userId } }
      );
    } else {
      // Like
      await req.db.collection('posts').updateOne(
        { _id: new ObjectId(postId) },
        { $push: { likes: userId } }
      );
    }

    // Get updated post with user data
    const updatedPost = await req.db.collection('posts').findOne({ _id: new ObjectId(postId) });
    const user = await req.db.collection('users').findOne(
      { _id: new ObjectId(updatedPost.userId) },
      { projection: { name: 1, role: 1, profilePhoto: 1, department: 1 } }
    );

    const postResponse = {
      _id: updatedPost._id,
      content: updatedPost.content,
      imageUrl: updatedPost.imageUrl,
      likes: updatedPost.likes || [],
      comments: updatedPost.comments || [],
      createdAt: updatedPost.createdAt,
      user: {
        id: user?._id,
        name: user?.name || "Unknown User",
        role: user?.role,
        profilePhoto: user?.profilePhoto,
        department: user?.department
      }
    };

    res.json({
      success: true,
      message: alreadyLiked ? 'Post unliked' : 'Post liked',
      post: postResponse
    });

  } catch (error) {
    console.error('Like post error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error liking post'
    });
  }
};

// @desc    Add comment to post
// @route   POST /api/posts/:postId/comment
// @access  Private
const addComment = async (req, res) => {
  try {
    const postId = req.params.postId;
    // SAFETY CHECK for req.body
    const { content } = req.body || {};
    const userId = req.user.id;

    // Validate comment content
    if (!content || content.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Comment content is required'
      });
    }

    // Get user info
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

    const post = await req.db.collection('posts').findOne({ _id: new ObjectId(postId) });
    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found'
      });
    }

    // Add comment
    const comment = {
      userId: userId,
      userName: user.name,
      content: content.trim(),
      timestamp: new Date()
    };

    await req.db.collection('posts').updateOne(
      { _id: new ObjectId(postId) },
      { $push: { comments: comment } }
    );

    // Get updated post with user data
    const updatedPost = await req.db.collection('posts').findOne({ _id: new ObjectId(postId) });
    const postUser = await req.db.collection('users').findOne(
      { _id: new ObjectId(updatedPost.userId) },
      { projection: { name: 1, role: 1, profilePhoto: 1, department: 1 } }
    );

    const postResponse = {
      _id: updatedPost._id,
      content: updatedPost.content,
      imageUrl: updatedPost.imageUrl,
      likes: updatedPost.likes || [],
      comments: updatedPost.comments || [],
      createdAt: updatedPost.createdAt,
      user: {
        id: postUser?._id,
        name: postUser?.name || "Unknown User",
        role: postUser?.role,
        profilePhoto: postUser?.profilePhoto,
        department: postUser?.department
      }
    };

    res.json({
      success: true,
      message: 'Comment added successfully',
      post: postResponse
    });

  } catch (error) {
    console.error('Add comment error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error adding comment'
    });
  }
};

// @desc    Search posts by content
// @route   GET /api/posts/search
// @access  Private
const searchPosts = async (req, res) => {
  try {
    const { q } = req.query; // Search query
    const userId = req.user.id;

    if (!q || q.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Search query is required'
      });
    }

    // Create search query for posts
    const searchQuery = {
      content: { $regex: q, $options: 'i' } // Case-insensitive search
    };

    // Find posts matching the search
    const posts = await req.db.collection('posts')
      .find(searchQuery)
      .sort({ createdAt: -1 })
      .limit(50)
      .toArray();

    // Get user data for each post
    const postsWithUsers = await Promise.all(
      posts.map(async (post) => {
        const user = await req.db.collection('users').findOne(
          { _id: new ObjectId(post.userId) },
          { 
            projection: { 
              name: 1, 
              role: 1, 
              profilePhoto: 1, 
              department: 1 
            } 
          }
        );
        
        return {
          _id: post._id,
          content: post.content,
          imageUrl: post.imageUrl,
          likes: post.likes || [],
          comments: post.comments || [],
          createdAt: post.createdAt,
          user: {
            id: user?._id,
            name: user?.name || "Unknown User",
            role: user?.role,
            profilePhoto: user?.profilePhoto,
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
    console.error('Post search error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during post search'
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