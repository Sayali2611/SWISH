// controllers/exploreController.js
const { ObjectId } = require('mongodb');

const exploreController = {
  // Get trending posts - FIXED VERSION
  getTrendingPosts: async (req, res) => {
    try {
      const db = req.db || global.db;
      if (!db) {
        console.error("Database not available in getTrendingPosts");
        return res.status(200).json([]);
      }
      
      const { timeframe = 'week' } = req.query;
      let startDate = new Date();
      
      switch(timeframe) {
        case 'day':
          startDate.setDate(startDate.getDate() - 1);
          break;
        case 'week':
          startDate.setDate(startDate.getDate() - 7);
          break;
        case 'month':
          startDate.setMonth(startDate.getMonth() - 1);
          break;
        default:
          startDate.setDate(startDate.getDate() - 7);
      }
      
      // First get all posts within timeframe
      const posts = await db.collection('posts')
        .find({ 
          createdAt: { $gte: startDate }
        })
        .toArray();
      
      // Calculate engagement score for each post
      const postsWithScore = posts.map(post => {
        const likesCount = Array.isArray(post.likes) ? post.likes.length : 0;
        const commentsCount = Array.isArray(post.comments) ? post.comments.length : 0;
        
        // Calculate engagement score (weighted formula)
        const engagementScore = (likesCount * 1) + (commentsCount * 2);
        
        return {
          ...post,
          likesCount,
          commentsCount,
          engagementScore
        };
      });
      
      // Sort by engagement score (highest first)
      postsWithScore.sort((a, b) => b.engagementScore - a.engagementScore);
      
      // Get top 20 posts
      const topPosts = postsWithScore.slice(0, 20);
      
      // Get user details for each post
      const postsWithUsers = await Promise.all(
        topPosts.map(async (post) => {
          try {
            const user = await db.collection('users').findOne(
              { _id: new ObjectId(post.userId) },
              { projection: { name: 1, profilePhoto: 1, role: 1, department: 1 } }
            );
            return {
              ...post,
              likes: post.likes || [],
              comments: post.comments || [],
              user: {
                id: user?._id,
                name: user?.name || "Unknown User",
                profilePhoto: user?.profilePhoto,
                role: user?.role,
                department: user?.department
              }
            };
          } catch (err) {
            console.error("Error fetching user for post:", err);
            return {
              ...post,
              user: {
                id: post.userId,
                name: "Unknown User",
                profilePhoto: null,
                role: "user",
                department: ""
              }
            };
          }
        })
      );
      
      res.json(postsWithUsers);
    } catch (error) {
      console.error("Error fetching trending posts:", error);
      res.status(200).json([]);
    }
  },

  // Get latest posts - FIXED VERSION
  getLatestPosts: async (req, res) => {
    try {
      const db = req.db || global.db;
      if (!db) {
        console.error("Database not available in getLatestPosts");
        return res.status(200).json({
          posts: [],
          currentPage: 1,
          totalPages: 0,
          totalPosts: 0
        });
      }
      
      const { page = 1, limit = 10 } = req.query;
      const skip = (parseInt(page) - 1) * parseInt(limit);
      
      // Sort by createdAt only (simpler sort)
      const posts = await db.collection('posts')
        .find()
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .toArray();
      
      // Get user details for each post
      const postsWithUsers = await Promise.all(
        posts.map(async (post) => {
          try {
            const user = await db.collection('users').findOne(
              { _id: new ObjectId(post.userId) },
              { projection: { name: 1, profilePhoto: 1, role: 1, department: 1 } }
            );
            return {
              ...post,
              likes: post.likes || [],
              comments: post.comments || [],
              user: {
                id: user?._id,
                name: user?.name || "Unknown User",
                profilePhoto: user?.profilePhoto,
                role: user?.role,
                department: user?.department
              }
            };
          } catch (err) {
            console.error("Error fetching user for post:", err);
            return {
              ...post,
              user: {
                id: post.userId,
                name: "Unknown User",
                profilePhoto: null,
                role: "user",
                department: ""
              }
            };
          }
        })
      );
      
      // Get total count for pagination
      const totalPosts = await db.collection('posts').countDocuments();
      
      res.json({
        posts: postsWithUsers,
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalPosts / parseInt(limit)),
        totalPosts
      });
    } catch (error) {
      console.error("Error fetching latest posts:", error);
      res.status(200).json({
        posts: [],
        currentPage: 1,
        totalPages: 0,
        totalPosts: 0
      });
    }
  },

  // Get posts by category - FIXED VERSION
  getPostsByCategory: async (req, res) => {
    try {
      const { category } = req.params;
      const db = req.db || global.db;
      if (!db) {
        console.error("Database not available in getPostsByCategory");
        return res.status(200).json([]);
      }
      
      // Map category to post type
      let query = {};
      switch(category) {
        case 'events':
          query = { type: 'event' };
          break;
        case 'polls':
          query = { type: 'poll' };
          break;
        case 'media':
          query = { media: { $exists: true, $ne: [] } };
          break;
        default:
          query = { type: category };
      }
      
      const posts = await db.collection('posts')
        .find(query)
        .sort({ createdAt: -1 })
        .limit(20)
        .toArray();
      
      // Get user details for each post
      const postsWithUsers = await Promise.all(
        posts.map(async (post) => {
          try {
            const user = await db.collection('users').findOne(
              { _id: new ObjectId(post.userId) },
              { projection: { name: 1, profilePhoto: 1, role: 1, department: 1 } }
            );
            return {
              ...post,
              likes: post.likes || [],
              comments: post.comments || [],
              user: {
                id: user?._id,
                name: user?.name || "Unknown User",
                profilePhoto: user?.profilePhoto,
                role: user?.role,
                department: user?.department
              }
            };
          } catch (err) {
            console.error("Error fetching user for post:", err);
            return {
              ...post,
              user: {
                id: post.userId,
                name: "Unknown User",
                profilePhoto: null,
                role: "user",
                department: ""
              }
            };
          }
        })
      );
      
      res.json(postsWithUsers);
    } catch (error) {
      console.error("Error fetching posts by category:", error);
      res.status(200).json([]);
    }
  },

  // Get posts by hashtag
  getPostsByHashtag: async (req, res) => {
    try {
      const { tag } = req.params;
      const db = req.db || global.db;
      if (!db) {
        console.error("Database not available in getPostsByHashtag");
        return res.status(200).json([]);
      }
      
      const posts = await db.collection('posts')
        .find({ 
          content: { $regex: `#${tag}`, $options: 'i' }
        })
        .sort({ createdAt: -1 })
        .limit(20)
        .toArray();
      
      // Get user details for each post
      const postsWithUsers = await Promise.all(
        posts.map(async (post) => {
          try {
            const user = await db.collection('users').findOne(
              { _id: new ObjectId(post.userId) },
              { projection: { name: 1, profilePhoto: 1, role: 1, department: 1 } }
            );
            return {
              ...post,
              likes: post.likes || [],
              comments: post.comments || [],
              user: {
                id: user?._id,
                name: user?.name || "Unknown User",
                profilePhoto: user?.profilePhoto,
                role: user?.role,
                department: user?.department
              }
            };
          } catch (err) {
            console.error("Error fetching user for post:", err);
            return {
              ...post,
              user: {
                id: post.userId,
                name: "Unknown User",
                profilePhoto: null,
                role: "user",
                department: ""
              }
            };
          }
        })
      );
      
      res.json(postsWithUsers);
    } catch (error) {
      console.error("Error fetching posts by hashtag:", error);
      res.status(200).json([]);
    }
  },

  // Get posts by media type
  getPostsByMediaType: async (req, res) => {
    try {
      const { type } = req.params;
      const db = req.db || global.db;
      if (!db) {
        console.error("Database not available in getPostsByMediaType");
        return res.status(200).json([]);
      }
      
      let query = {};
      if (type === 'image') {
        query = { 'media.type': 'image' };
      } else if (type === 'video') {
        query = { 'media.type': 'video' };
      } else {
        query = { media: { $exists: true, $ne: [] } };
      }
      
      const posts = await db.collection('posts')
        .find(query)
        .sort({ createdAt: -1 })
        .limit(20)
        .toArray();
      
      // Get user details for each post
      const postsWithUsers = await Promise.all(
        posts.map(async (post) => {
          try {
            const user = await db.collection('users').findOne(
              { _id: new ObjectId(post.userId) },
              { projection: { name: 1, profilePhoto: 1, role: 1, department: 1 } }
            );
            return {
              ...post,
              likes: post.likes || [],
              comments: post.comments || [],
              user: {
                id: user?._id,
                name: user?.name || "Unknown User",
                profilePhoto: user?.profilePhoto,
                role: user?.role,
                department: user?.department
              }
            };
          } catch (err) {
            console.error("Error fetching user for post:", err);
            return {
              ...post,
              user: {
                id: post.userId,
                name: "Unknown User",
                profilePhoto: null,
                role: "user",
                department: ""
              }
            };
          }
        })
      );
      
      res.json(postsWithUsers);
    } catch (error) {
      console.error("Error fetching posts by media type:", error);
      res.status(200).json([]);
    }
  },

  // Search posts, users, and hashtags
  search: async (req, res) => {
    try {
      const { q, type = 'all' } = req.query;
      const db = req.db || global.db;
      if (!db) {
        console.error("Database not available in search");
        return res.status(200).json({
          success: true,
          query: q || '',
          results: { posts: [], users: [], hashtags: [] }
        });
      }
      
      if (!q || q.trim().length === 0) {
        return res.status(400).json({ message: 'Search query is required' });
      }
      
      const searchQuery = q.trim();
      const results = {};
      
      // Search posts
      if (type === 'all' || type === 'posts') {
        const posts = await db.collection('posts')
          .find({ 
            $or: [
              { content: { $regex: searchQuery, $options: 'i' } },
              { 'event.title': { $regex: searchQuery, $options: 'i' } },
              { 'poll.question': { $regex: searchQuery, $options: 'i' } }
            ]
          })
          .sort({ createdAt: -1 })
          .limit(10)
          .toArray();
        
        // Get user details for posts
        const postsWithUsers = await Promise.all(
          posts.map(async (post) => {
            try {
              const user = await db.collection('users').findOne(
                { _id: new ObjectId(post.userId) },
                { projection: { name: 1, profilePhoto: 1, role: 1, department: 1 } }
              );
              return {
                ...post,
                likes: post.likes || [],
                comments: post.comments || [],
                user: {
                  id: user?._id,
                  name: user?.name || "Unknown User",
                  profilePhoto: user?.profilePhoto,
                  role: user?.role,
                  department: user?.department
                }
              };
            } catch (err) {
              console.error("Error fetching user for post:", err);
              return {
                ...post,
                user: {
                  id: post.userId,
                  name: "Unknown User",
                  profilePhoto: null,
                  role: "user",
                  department: ""
                }
              };
            }
          })
        );
        
        results.posts = postsWithUsers;
      }
      
      // Search users
      if (type === 'all' || type === 'users') {
        const users = await db.collection('users')
          .find({ 
            name: { $regex: searchQuery, $options: 'i' }
          })
          .project({
            _id: 1,
            name: 1,
            email: 1,
            profilePhoto: 1,
            role: 1,
            department: 1,
            bio: 1,
            skills: 1
          })
          .limit(10)
          .toArray();
        
        results.users = users;
      }
      
      // Search hashtags
      if (type === 'all' || type === 'hashtags') {
        const hashtagPosts = await db.collection('posts')
          .find({ 
            content: { $regex: `#${searchQuery}`, $options: 'i' }
          })
          .sort({ createdAt: -1 })
          .limit(5)
          .toArray();
        
        results.hashtags = hashtagPosts.map(post => ({
          tag: searchQuery,
          postCount: 1,
          recentPost: post.content?.substring(0, 100) || ''
        }));
      }
      
      res.json({
        success: true,
        query: searchQuery,
        results
      });
    } catch (error) {
      console.error("Error searching:", error);
      res.status(200).json({
        success: true,
        query: req.query.q || '',
        results: { posts: [], users: [], hashtags: [] }
      });
    }
  },

  // Discover people
  discoverPeople: async (req, res) => {
    try {
      const db = req.db || global.db;
      if (!db) {
        console.error("Database not available in discoverPeople");
        return res.status(200).json([]);
      }
      
      const userId = req.user?.userId;
      
      if (!userId) {
        console.log("No user ID found in request");
        // Return some sample users if no auth
        const sampleUsers = await db.collection('users')
          .find()
          .project({
            _id: 1,
            name: 1,
            profilePhoto: 1,
            role: 1,
            department: 1,
            bio: 1,
            skills: 1
          })
          .limit(10)
          .toArray();
        return res.json(sampleUsers);
      }
      
      // Get current user's connections
      let userConnections = [];
      try {
        const currentUser = await db.collection('users').findOne(
          { _id: new ObjectId(userId) },
          { projection: { connections: 1 } }
        );
        userConnections = currentUser?.connections || [];
      } catch (err) {
        console.error("Error fetching user connections:", err);
      }
      
      // Find users not connected to current user
      const users = await db.collection('users')
        .find({ 
          _id: { $ne: new ObjectId(userId) }
        })
        .project({
          _id: 1,
          name: 1,
          profilePhoto: 1,
          role: 1,
          department: 1,
          bio: 1,
          skills: 1,
          connections: 1,
          followers: 1,
          following: 1
        })
        .limit(20)
        .toArray();
      
      // Add mutual connection count
      const usersWithMutual = users.map((user) => {
        const userConnectionsList = user.connections || [];
        const mutualConnections = userConnectionsList.filter(connId => 
          userConnections.includes(connId.toString())
        );
        
        return {
          ...user,
          mutualConnections: mutualConnections.length,
          isConnected: userConnections.includes(user._id.toString())
        };
      });
      
      // Sort by mutual connections (highest first)
      usersWithMutual.sort((a, b) => b.mutualConnections - a.mutualConnections);
      
      res.json(usersWithMutual);
    } catch (error) {
      console.error("Error discovering people:", error);
      res.status(200).json([]);
    }
  },

  // Get trending hashtags
  getTrendingHashtags: async (req, res) => {
    try {
      const db = req.db || global.db;
      if (!db) {
        console.error("Database not available in getTrendingHashtags");
        return res.status(200).json([]);
      }
      
      // Get recent posts with hashtags
      const recentPosts = await db.collection('posts')
        .find({ 
          createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } // Last 7 days
        })
        .project({ content: 1 })
        .limit(100)
        .toArray();
      
      // Extract hashtags from posts
      const hashtagCounts = {};
      recentPosts.forEach(post => {
        const hashtags = post.content?.match(/#\w+/g) || [];
        hashtags.forEach(tag => {
          const cleanTag = tag.toLowerCase();
          hashtagCounts[cleanTag] = (hashtagCounts[cleanTag] || 0) + 1;
        });
      });
      
      // Convert to array and sort by count
      const trendingHashtags = Object.entries(hashtagCounts)
        .map(([tag, count]) => ({ 
          tag: tag.replace('#', ''), 
          count,
          posts: count
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);
      
      res.json(trendingHashtags);
    } catch (error) {
      console.error("Error fetching trending hashtags:", error);
      res.status(200).json([]);
    }
  }
};

module.exports = exploreController;