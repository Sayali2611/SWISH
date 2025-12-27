import { useState, useEffect, useRef, useCallback, forwardRef } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/Explore.css";
import { getSocket } from "../components/NotificationBell";
import Toast from "../components/Toast";
import "../styles/Notifications.css";
import ExploreSearch from "../components/ExploreSearch";

// Post Card Component (Reusable) - Wrapped with forwardRef
const PostCard = forwardRef(({ post, user, onLike, onComment, onSave, onFollow, isFollowing }, ref) => {
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [isCommenting, setIsCommenting] = useState(false);
  
  const navigate = useNavigate();
  
  // Safely check if user liked or saved the post
  const isLiked = post.likes?.some(like => 
    (typeof like === 'object' ? like._id || like : like) === user?.id
  ) || false;
  
  const isSaved = post.saves?.some(save => 
    (typeof save === 'object' ? save._id || save : save) === user?.id
  ) || false;
  
  const handleLike = async () => {
    if (!user) return;
    await onLike(post._id);
  };
  
  const handleSave = async () => {
    if (!user) return;
    await onSave(post._id);
  };
  
  const handleFollow = async () => {
    if (!user) return;
    await onFollow(post.user?.id || post.userId);
  };
  
  const handleAddComment = async () => {
    if (!commentText.trim() || !user) return;
    setIsCommenting(true);
    try {
      await onComment(post._id, commentText);
      setCommentText("");
      setShowComments(true);
    } catch (error) {
      console.error("Error adding comment:", error);
    } finally {
      setIsCommenting(false);
    }
  };
  
  const getUserAvatar = (userData) => {
    if (userData?.profilePhoto) {
      return (
        <img 
          src={userData.profilePhoto} 
          alt={userData.name} 
          className="user-avatar-img"
        />
      );
    }
    return userData?.name?.charAt(0).toUpperCase() || "U";
  };
  
  const formatNumber = (num) => {
    if (!num) return "0";
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };
  
  // Get likes count safely
  const likesCount = Array.isArray(post.likes) ? post.likes.length : 0;
  // Get comments count safely
  const commentsCount = Array.isArray(post.comments) ? post.comments.length : 0;
  // Get saves count safely
  const savesCount = Array.isArray(post.saves) ? post.saves.length : 0;
  
  return (
    <div className="post-card" ref={ref}>
      {/* Post Header */}
      <div className="post-header">
        <div className="post-user">
          <div 
            className="user-avatar"
            onClick={() => navigate(`/profile/${post.user?.id || post.userId}`)}
            style={{ cursor: 'pointer' }}
          >
            {getUserAvatar(post.user)}
          </div>
          <div className="user-info">
            <div className="user-name">
              {post.user?.name || "Unknown User"}
              {post.user?.isPrivate && (
                <span className="private-badge" title="Private Account"> 🔒</span>
              )}
              {post.user?.role === 'faculty' && (
                <span className="verified-badge" title="Faculty Member"> 👨‍🏫</span>
              )}
              {post.user?.role === 'admin' && (
                <span className="admin-badge" title="Administrator"> 👑</span>
              )}
            </div>
            <div className="post-meta">
              <span className="post-time">
                {new Date(post.createdAt).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </span>
              {post.user?.department && (
                <span className="user-department">• {post.user.department}</span>
              )}
            </div>
          </div>
        </div>
        
        {post.user?.id !== user?.id && (
          <button 
            className={`follow-btn ${isFollowing ? 'following' : ''}`}
            onClick={handleFollow}
          >
            {isFollowing ? 'Following' : 'Follow'}
          </button>
        )}
      </div>
      
      {/* Post Content */}
      <div className="post-content">
        <p>{post.content}</p>
        
        {/* Hashtags - extract from content */}
        {post.content && post.content.includes('#') && (
          <div className="hashtags">
            {post.content.match(/#\w+/g)?.map((tag, index) => (
              <span key={index} className="hashtag" onClick={() => navigate(`/explore/hashtag/${tag.replace('#', '')}`)}>
                {tag}
              </span>
            ))}
          </div>
        )}
        
        {/* Media */}
        {post.media && post.media.length > 0 && (
          <div className="post-media">
            {post.media.map((media, index) => (
              media.type === 'image' ? (
                <img key={index} src={media.url} alt={`Post media ${index}`} className="post-media-item" />
              ) : media.type === 'video' ? (
                <video key={index} src={media.url} controls className="post-media-item" />
              ) : null
            ))}
          </div>
        )}
        
        {/* Category */}
        {post.category && (
          <div className="post-category">
            <span className="category-badge">{post.category}</span>
          </div>
        )}
      </div>
      
      {/* Post Stats */}
      <div className="post-stats">
        <span className="stat-item">
          👍 {formatNumber(likesCount)}
        </span>
        <span className="stat-item">
          💬 {formatNumber(commentsCount)}
        </span>
        <span className="stat-item">
          💾 {formatNumber(savesCount)}
        </span>
        {post.tags && post.tags.length > 0 && (
          <span className="stat-item">
            # {post.tags.length}
          </span>
        )}
      </div>
      
      {/* Post Actions */}
      <div className="post-actions-buttons">
        <button 
          className={`action-btn like-btn ${isLiked ? 'liked' : ''}`}
          onClick={handleLike}
        >
          {isLiked ? '👍 Liked' : '🤍 Like'}
        </button>
        <button 
          className={`action-btn comment-btn ${showComments ? 'active' : ''}`}
          onClick={() => setShowComments(!showComments)}
        >
          💬 Comment
        </button>
        <button 
          className={`action-btn save-btn ${isSaved ? 'saved' : ''}`}
          onClick={handleSave}
        >
          {isSaved ? '💾 Saved' : '💾 Save'}
        </button>
        <button className="action-btn share-btn" onClick={() => {
          if (navigator.share) {
            navigator.share({
              title: 'Check out this post on CampusConnect',
              text: post.content.substring(0, 100),
              url: window.location.origin + `/post/${post._id}`
            });
          } else {
            navigator.clipboard.writeText(window.location.origin + `/post/${post._id}`);
            alert('Link copied to clipboard!');
          }
        }}>
          🔄 Share
        </button>
      </div>
      
      {/* Comments Section */}
      {showComments && (
        <div className="comments-section">
          {/* Existing Comments */}
          {post.comments && post.comments.length > 0 ? (
            <div className="comments-list">
              <h4>Comments ({commentsCount})</h4>
              {post.comments.slice(0, 3).map((comment, index) => (
                <div key={index} className="comment-item">
                  <div className="comment-avatar">
                    {comment.userName?.charAt(0).toUpperCase() || "U"}
                  </div>
                  <div className="comment-content">
                    <div className="comment-header">
                      <span className="comment-author">{comment.userName}</span>
                      <span className="comment-time">
                        {new Date(comment.timestamp).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="comment-text">{comment.content}</p>
                  </div>
                </div>
              ))}
              {post.comments.length > 3 && (
                <button 
                  className="view-more-comments"
                  onClick={() => navigate(`/post/${post._id}`)}
                >
                  View all {post.comments.length} comments
                </button>
              )}
            </div>
          ) : (
            <div className="no-comments">
              <p>No comments yet. Be the first to comment!</p>
            </div>
          )}
          
          {/* Add Comment */}
          <div className="add-comment">
            <div className="comment-avatar-small">
              {getUserAvatar(user)}
            </div>
            <input 
              type="text" 
              placeholder="Write a comment..." 
              className="comment-input"
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleAddComment()}
              disabled={isCommenting}
            />
            <button 
              className="comment-submit-btn"
              onClick={handleAddComment}
              disabled={isCommenting || !commentText.trim()}
            >
              {isCommenting ? '...' : 'Post'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
});

PostCard.displayName = 'PostCard';

// User Card Component
const UserCard = ({ userData, currentUser, onFollow, isFollowing }) => {
  const navigate = useNavigate();
  
  const getUserAvatar = (user) => {
    if (user?.profilePhoto) {
      return (
        <img 
          src={user.profilePhoto} 
          alt={user.name} 
          className="user-avatar-img"
        />
      );
    }
    return user?.name?.charAt(0).toUpperCase() || "U";
  };
  
  const formatNumber = (num) => {
    if (!num) return "0";
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };
  
  // Safely get counts
  const followersCount = Array.isArray(userData.followers) ? userData.followers.length : 0;
  const connectionsCount = Array.isArray(userData.connections) ? userData.connections.length : 0;
  
  return (
    <div className="user-card">
      <div 
        className="user-avatar-large"
        onClick={() => navigate(`/profile/${userData._id || userData.id}`)}
        style={{ cursor: 'pointer' }}
      >
        {getUserAvatar(userData)}
      </div>
      <div className="user-info">
        <h4 
          className="user-name"
          onClick={() => navigate(`/profile/${userData._id || userData.id}`)}
          style={{ cursor: 'pointer' }}
        >
          {userData.name}
          {userData.isPrivate && (
            <span className="private-badge" title="Private Account"> 🔒</span>
          )}
          {userData.role === 'faculty' && (
            <span className="verified-badge" title="Faculty Member"> 👨‍🏫</span>
          )}
        </h4>
        <p className="user-department">{userData.department || userData.facultyDepartment || 'No department'}</p>
        <div className="user-stats">
          <span>{formatNumber(followersCount)} followers</span>
          <span>•</span>
          <span>{formatNumber(connectionsCount)} connections</span>
        </div>
      </div>
      {currentUser?.id !== (userData._id || userData.id) && (
        <button 
          className={`follow-btn ${isFollowing ? 'following' : ''}`}
          onClick={() => onFollow(userData._id || userData.id)}
        >
          {isFollowing ? 'Following' : 'Follow'}
        </button>
      )}
    </div>
  );
};

// Hashtag Card Component
const HashtagCard = ({ tag, count, onClick }) => {
  return (
    <div className="hashtag-card" onClick={() => onClick(tag)}>
      <div className="hashtag-icon">#</div>
      <div className="hashtag-content">
        <h4>#{tag}</h4>
        <p>{count.toLocaleString()} posts</p>
      </div>
    </div>
  );
};

function Explore() {
  const [activeTab, setActiveTab] = useState('trending');
  const [timeFilter, setTimeFilter] = useState('week'); // Changed default to 'week'
  const [mediaFilter, setMediaFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  const [trendingPosts, setTrendingPosts] = useState([]);
  const [latestPosts, setLatestPosts] = useState([]);
  const [categoryPosts, setCategoryPosts] = useState([]);
  const [hashtagPosts, setHashtagPosts] = useState([]);
  const [mediaPosts, setMediaPosts] = useState([]);
  const [searchResults, setSearchResults] = useState({ posts: [], users: [] });
  const [discoverUsers, setDiscoverUsers] = useState([]);
  const [trendingHashtags, setTrendingHashtags] = useState([]);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [user, setUser] = useState(null);
  const [following, setFollowing] = useState({});
  
  const navigate = useNavigate();
  const observerRef = useRef();
  const lastPostRef = useRef();
  const pageRef = useRef(1);
  const hasMoreRef = useRef(true);
  
  // Fetch user data
  useEffect(() => {
    const userData = localStorage.getItem('user');
    const token = localStorage.getItem('token');
    
    if (!userData || !token) {
      navigate("/");
      return;
    }
    
    setUser(JSON.parse(userData));
    
    // Initialize Socket for notifications
    const socket = getSocket();
    if (socket) {
      socket.on("new_notification", (payload) => {
        // Handle notifications
        console.log("New notification:", payload);
      });
    }
    
    return () => {
      if (socket) {
        socket.off("new_notification");
      }
    };
  }, [navigate]);
  
  // Fetch trending posts - FIXED
  const fetchTrendingPosts = useCallback(async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `http://localhost:5000/api/explore/trending?timeframe=${timeFilter}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );
      
      if (response.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        navigate("/");
        return;
      }
      
      const data = await response.json();
      if (response.ok) {
        setTrendingPosts(data);
      } else {
        setError(data.message || 'Failed to fetch trending posts');
      }
    } catch (error) {
      setError('Network error: ' + error.message);
    } finally {
      setLoading(false);
    }
  }, [user, timeFilter, navigate]);
  
  // Fetch latest posts - FIXED
  const fetchLatestPosts = useCallback(async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `http://localhost:5000/api/explore/latest?page=${pageRef.current}&limit=10`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );
      
      const data = await response.json();
      if (response.ok) {
        if (pageRef.current === 1) {
          setLatestPosts(data.posts || []);
        } else {
          setLatestPosts(prev => [...prev, ...(data.posts || [])]);
        }
        hasMoreRef.current = data.currentPage < data.totalPages;
      } else {
        setError(data.message || 'Failed to fetch latest posts');
      }
    } catch (error) {
      setError('Network error: ' + error.message);
    } finally {
      setLoading(false);
    }
  }, [user]);
  
  // Fetch posts by category - FIXED
  const fetchCategoryPosts = useCallback(async () => {
    if (!user || categoryFilter === 'all') return;
    
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `http://localhost:5000/api/explore/category/${categoryFilter}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );
      
      const data = await response.json();
      if (response.ok) {
        setCategoryPosts(data);
      } else {
        setError(data.message || 'Failed to fetch category posts');
      }
    } catch (error) {
      setError('Network error: ' + error.message);
    } finally {
      setLoading(false);
    }
  }, [user, categoryFilter]);
  
  // Fetch posts by media type - FIXED
  const fetchMediaPosts = useCallback(async () => {
    if (!user || mediaFilter === 'all') return;
    
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `http://localhost:5000/api/explore/media/${mediaFilter}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );
      
      const data = await response.json();
      if (response.ok) {
        setMediaPosts(data);
      } else {
        setError(data.message || 'Failed to fetch media posts');
      }
    } catch (error) {
      setError('Network error: ' + error.message);
    } finally {
      setLoading(false);
    }
  }, [user, mediaFilter]);
  
  // Fetch discover users - FIXED
  const fetchDiscoverUsers = useCallback(async () => {
    if (!user) return;
    
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        'http://localhost:5000/api/explore/people',
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );
      
      const data = await response.json();
      if (response.ok) {
        setDiscoverUsers(data);
        
        // Initialize following state
        const followingState = {};
        data.forEach(userData => {
          followingState[userData._id] = userData.followers?.includes(user.id) || false;
        });
        setFollowing(followingState);
      }
    } catch (error) {
      console.error('Error fetching discover users:', error);
    }
  }, [user]);
  
  // Fetch trending hashtags - FIXED
  const fetchTrendingHashtags = useCallback(async () => {
    if (!user) return;
    
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        'http://localhost:5000/api/explore/hashtags/trending',
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );
      
      const data = await response.json();
      if (response.ok) {
        setTrendingHashtags(data);
      }
    } catch (error) {
      console.error('Error fetching trending hashtags:', error);
    }
  }, [user]);
  
  // Search posts and users - FIXED
  const handleSearchFromNavbar = useCallback(async (query) => {
    if (!user || !query.trim()) return;
    
    setActiveTab('search');
    setSearchQuery(query);
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `http://localhost:5000/api/explore/search?q=${encodeURIComponent(query)}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );
      
      const data = await response.json();
      if (response.ok) {
        setSearchResults(data.results || { posts: [], users: [], hashtags: [] });
      } else {
        setError(data.message || 'Search failed');
      }
    } catch (error) {
      setError('Network error during search');
    } finally {
      setLoading(false);
    }
  }, [user]);
  
  // Listen for search events from navbar
  useEffect(() => {
    const handleNavbarSearch = (event) => {
      if (event.detail && event.detail.query) {
        handleSearchFromNavbar(event.detail.query);
      }
    };
    
    window.addEventListener('navbarSearch', handleNavbarSearch);
    
    return () => {
      window.removeEventListener('navbarSearch', handleNavbarSearch);
    };
  }, [handleSearchFromNavbar]);
  
  // Handle like - FIXED
  const handleLike = async (postId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:5000/api/posts/${postId}/like`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const updatedPost = await response.json();
        
        // Update posts in all relevant states
        const updatePosts = (posts) => 
          posts.map(post => post._id === postId ? updatedPost : post);
        
        setTrendingPosts(updatePosts);
        setLatestPosts(updatePosts);
        setCategoryPosts(updatePosts);
        setMediaPosts(updatePosts);
        
        // Handle hashtag posts update
        setHashtagPosts(updatePosts);
        
        setSuccess('Post liked!');
        setTimeout(() => setSuccess(""), 2000);
      }
    } catch (error) {
      setError('Failed to like post');
    }
  };
  
  // Handle save - TEMPORARY FIX (add this endpoint to server.js)
  const handleSave = async (postId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:5000/api/posts/${postId}/save`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        // For now, just show a message since save endpoint might not exist
        setSuccess('Save functionality coming soon!');
        setTimeout(() => setSuccess(""), 2000);
      } else {
        setSuccess('Save feature will be available soon!');
        setTimeout(() => setSuccess(""), 2000);
      }
    } catch (error) {
      console.log('Save feature not implemented yet');
    }
  };
  
  // Handle follow - FIXED (using connection request instead of follow)
  const handleFollow = async (userId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:5000/api/network/request/${userId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      const data = await response.json();
      if (response.ok) {
        setFollowing(prev => ({ ...prev, [userId]: true }));
        setSuccess(data.message || 'Connection request sent!');
        setTimeout(() => setSuccess(""), 2000);
      } else {
        setError(data.message || 'Failed to send connection request');
      }
    } catch (error) {
      setError('Failed to send connection request');
    }
  };
  
  // Handle comment - FIXED
  const handleComment = async (postId, content) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:5000/api/posts/${postId}/comment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ content })
      });
      
      if (response.ok) {
        const data = await response.json();
        const updatedPost = data.post;
        
        // Update posts in all relevant states
        const updatePosts = (posts) => 
          posts.map(post => post._id === postId ? updatedPost : post);
        
        setTrendingPosts(updatePosts);
        setLatestPosts(updatePosts);
        setCategoryPosts(updatePosts);
        setMediaPosts(updatePosts);
        setHashtagPosts(updatePosts);
        
        // Update search results if present
        setSearchResults(prev => ({
          ...prev,
          posts: prev.posts.map(post => post._id === postId ? updatedPost : post)
        }));
        
        setSuccess('Comment added!');
        setTimeout(() => setSuccess(""), 2000);
        
        return updatedPost;
      }
    } catch (error) {
      setError('Failed to add comment');
      throw error;
    }
  };
  
  // Handle hashtag click - FIXED
  const handleHashtagClick = async (tag) => {
    setActiveTab('hashtag');
    const cleanTag = tag.startsWith('#') ? tag.substring(1) : tag;
    setSearchQuery(`#${cleanTag}`);
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `http://localhost:5000/api/explore/hashtag/${encodeURIComponent(cleanTag)}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );
      
      const data = await response.json();
      if (response.ok) {
        setHashtagPosts(data);
      } else {
        setError(data.message || 'Failed to fetch hashtag posts');
      }
    } catch (error) {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  };
  
  // Infinite scroll observer
  useEffect(() => {
    if (!lastPostRef.current || !hasMoreRef.current || loading) return;
    
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMoreRef.current) {
          pageRef.current += 1;
          
          switch (activeTab) {
            case 'latest':
              fetchLatestPosts();
              break;
            default:
              // Other tabs don't support pagination in current implementation
              break;
          }
        }
      },
      { threshold: 0.5 }
    );
    
    if (lastPostRef.current) {
      observer.observe(lastPostRef.current);
    }
    
    return () => {
      if (observer) observer.disconnect();
    };
  }, [activeTab, loading, fetchLatestPosts]);
  
  // Initial data fetch
  useEffect(() => {
    if (!user) return;
    
    pageRef.current = 1;
    hasMoreRef.current = true;
    
    switch (activeTab) {
      case 'trending':
        fetchTrendingPosts();
        break;
      case 'latest':
        fetchLatestPosts();
        break;
      case 'category':
        fetchCategoryPosts();
        break;
      case 'media':
        fetchMediaPosts();
        break;
      case 'hashtag':
        // Already handled in handleHashtagClick
        break;
      case 'search':
        // Already handled in handleSearchFromNavbar
        break;
    }
    
    // Always fetch discover users and hashtags
    fetchDiscoverUsers();
    fetchTrendingHashtags();
  }, [
    user, 
    activeTab, 
    timeFilter, 
    categoryFilter, 
    mediaFilter, 
    fetchTrendingPosts, 
    fetchLatestPosts, 
    fetchCategoryPosts, 
    fetchMediaPosts, 
    fetchDiscoverUsers, 
    fetchTrendingHashtags
  ]);
  
  // Get current posts based on active tab
  const getCurrentPosts = () => {
    switch (activeTab) {
      case 'trending':
        return trendingPosts;
      case 'latest':
        return latestPosts;
      case 'category':
        return categoryPosts;
      case 'media':
        return mediaPosts;
      case 'hashtag':
        return hashtagPosts;
      case 'search':
        return searchResults.posts || [];
      default:
        return trendingPosts;
    }
  };
  
  // Get current users for search
  const getCurrentUsers = () => {
    if (activeTab !== 'search') return [];
    return searchResults.users || [];
  };
  
  const handleUserSelectFromSearch = (selectedUser) => {
    if (selectedUser && selectedUser._id) {
      navigate(`/profile/${selectedUser._id}`);
    }
  };
  
  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate("/");
  };
  
  if (!user) {
    return (
      <div className="loading-container">
        <div className="loading-spinner">Loading...</div>
      </div>
    );
  }
  
  return (
    <div className="explore-container">
      {/* Header - Same as Feed with single search bar */}
      <header className="feed-header">
        <div className="header-left">
          <div className="logo" onClick={() => navigate("/feed")}>💼 CampusConnect</div>
          
          {/* SINGLE SEARCH BAR IN NAVBAR */}
          <div className="feed-search-wrapper">
            <ExploreSearch 
              onUserSelect={handleUserSelectFromSearch}
              onSearch={(query) => {
                if (query.trim()) {
                  setActiveTab('search');
                  handleSearchFromNavbar(query);
                }
              }}
            />
          </div>

          <div className="nav-items">
            <button className="nav-btn" onClick={() => navigate("/feed")}>🏠 Feed</button>
            <button className="nav-btn" onClick={() => navigate("/profile")}>👤 Profile</button>
            <button className="nav-btn" onClick={() => navigate("/network")}>👥 Network</button>
            <button className="nav-btn active">🔥 Explore</button>
            <button 
              className="nav-btn"
              onClick={() => navigate("/notifications")}
              title="Notifications"
            >
              🔔 Notifications
            </button>
          </div>
        </div>
        <div className="header-right">
          <div className="user-info">
            <span className="user-name">Explore, {user.name}</span>
            <div 
              className="user-avatar" 
              title="View Profile"
              onClick={() => navigate("/profile")}
            >
              {user?.profilePhoto ? (
                <img src={user.profilePhoto} alt={user.name} className="user-avatar-img" />
              ) : (
                user?.name?.charAt(0).toUpperCase() || "U"
              )}
            </div>
          </div>
          
          {user.role === 'admin' && (
            <button 
              className="admin-btn"
              onClick={() => navigate("/admin")}
              style={{
                background: 'linear-gradient(135deg, #7c3aed, #4f46e5)',
                color: 'white',
                border: 'none',
                padding: '8px 16px',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: '600',
                fontSize: '14px',
                marginRight: '10px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'all 0.3s ease'
              }}
              onMouseOver={(e) => e.target.style.transform = 'translateY(-2px)'}
              onMouseOut={(e) => e.target.style.transform = 'translateY(0)'}
            >
              👑 Admin
            </button>
          )}
          
          <button className="logout-btn" onClick={handleLogout}>🚪 Logout</button>
        </div>
      </header>

      {/* Error/Success Notifications */}
      {error && (
        <Toast message={error} type="error" onClose={() => setError("")} />
      )}
      {success && (
        <Toast message={success} type="success" onClose={() => setSuccess("")} />
      )}

      <div className="explore-content">
        {/* Left Sidebar - Filters */}
        <div className="explore-sidebar">
          {/* Time Filter */}
          <div className="filter-section">
            <h3>📅 Time Range</h3>
            <div className="filter-options">
              {['day', 'week', 'month'].map((time) => (
                <button
                  key={time}
                  className={`filter-btn ${timeFilter === time ? 'active' : ''}`}
                  onClick={() => setTimeFilter(time)}
                >
                  {time === 'day' ? 'Today' : 
                   time === 'week' ? 'This Week' : 'This Month'}
                </button>
              ))}
            </div>
          </div>
          
          {/* Category Filter */}
          <div className="filter-section">
            <h3>🏷️ Categories</h3>
            <div className="filter-options">
              {['all', 'events', 'polls', 'media'].map((category) => (
                <button
                  key={category}
                  className={`filter-btn ${categoryFilter === category ? 'active' : ''}`}
                  onClick={() => {
                    setCategoryFilter(category);
                    setActiveTab('category');
                  }}
                >
                  {category === 'all' ? 'All Categories' : 
                   category === 'events' ? '📅 Events' :
                   category === 'polls' ? '📊 Polls' : '📷 Media'}
                </button>
              ))}
            </div>
          </div>
          
          {/* Media Filter */}
          <div className="filter-section">
            <h3>📷 Media Type</h3>
            <div className="filter-options">
              {['all', 'image', 'video'].map((media) => (
                <button
                  key={media}
                  className={`filter-btn ${mediaFilter === media ? 'active' : ''}`}
                  onClick={() => {
                    setMediaFilter(media);
                    setActiveTab('media');
                  }}
                >
                  {media === 'all' ? 'All Media' : 
                   media === 'image' ? '🖼️ Images' : '🎥 Videos'}
                </button>
              ))}
            </div>
          </div>
          
          {/* Trending Hashtags */}
          {trendingHashtags.length > 0 && (
            <div className="filter-section">
              <h3>🔥 Trending Hashtags</h3>
              <div className="hashtags-list">
                {trendingHashtags.slice(0, 8).map((tag, index) => (
                  <div 
                    key={index} 
                    className="hashtag-card" 
                    onClick={() => handleHashtagClick(tag.tag)}
                  >
                    <div className="hashtag-icon">#</div>
                    <div className="hashtag-content">
                      <h4>#{tag.tag}</h4>
                      <p>{tag.count || tag.posts} posts</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* Discover People */}
          {discoverUsers.length > 0 && activeTab !== 'search' && (
            <div className="filter-section">
              <h3>👥 People to Discover</h3>
              <div className="discover-users">
                {discoverUsers.slice(0, 5).map((discoverUser) => (
                  <UserCard
                    key={discoverUser._id}
                    userData={discoverUser}
                    currentUser={user}
                    onFollow={handleFollow}
                    isFollowing={following[discoverUser._id]}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
        
        {/* Main Content */}
        <div className="explore-main">
          {/* Tabs */}
          <div className="explore-tabs">
            {[
              { id: 'trending', label: '🔥 Trending', icon: '🔥' },
              { id: 'latest', label: '🕒 Latest', icon: '🕒' },
              { id: 'category', label: '🏷️ Categories', icon: '🏷️' },
              { id: 'media', label: '📷 Media', icon: '📷' },
            ].map((tab) => (
              <button
                key={tab.id}
                className={`explore-tab ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => {
                  setActiveTab(tab.id);
                  pageRef.current = 1;
                  hasMoreRef.current = true;
                  setSearchQuery('');
                }}
              >
                {tab.icon} {tab.label}
              </button>
            ))}
            
            {/* Search Tab - Only show when there's a search query */}
            {searchQuery && (
              <button
                className={`explore-tab ${activeTab === 'search' ? 'active' : ''}`}
                onClick={() => setActiveTab('search')}
              >
                🔍 Search Results
              </button>
            )}
            
            {/* Hashtag Tab - Only show when viewing hashtag */}
            {activeTab === 'hashtag' && (
              <button className="explore-tab active">
                # {searchQuery.replace('#', '')}
              </button>
            )}
          </div>
          
          {/* Active Filters Display */}
          <div className="active-filters">
            {activeTab === 'trending' && timeFilter !== 'all' && (
              <span className="active-filter">
                Time: {timeFilter === 'day' ? 'Today' : 
                      timeFilter === 'week' ? 'This Week' : 'This Month'}
                <button onClick={() => setTimeFilter('week')}>×</button>
              </span>
            )}
            
            {activeTab === 'category' && categoryFilter !== 'all' && (
              <span className="active-filter">
                Category: {categoryFilter}
                <button onClick={() => setCategoryFilter('all')}>×</button>
              </span>
            )}
            
            {activeTab === 'media' && mediaFilter !== 'all' && (
              <span className="active-filter">
                Media: {mediaFilter}
                <button onClick={() => setMediaFilter('all')}>×</button>
              </span>
            )}
            
            {activeTab === 'search' && searchQuery && (
              <span className="active-filter">
                Search: "{searchQuery}"
                <button onClick={() => {
                  setSearchQuery('');
                  setSearchResults({ posts: [], users: [] });
                  setActiveTab('trending');
                }}>×</button>
              </span>
            )}
            
            {activeTab === 'hashtag' && searchQuery && (
              <span className="active-filter">
                Hashtag: {searchQuery}
                <button onClick={() => {
                  setSearchQuery('');
                  setHashtagPosts([]);
                  setActiveTab('trending');
                }}>×</button>
              </span>
            )}
          </div>
          
          {/* Posts Grid */}
          <div className="posts-grid">
            {loading && pageRef.current === 1 ? (
              // Skeleton Loaders
              Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="post-card skeleton">
                  <div className="skeleton-header">
                    <div className="skeleton-avatar"></div>
                    <div className="skeleton-user">
                      <div className="skeleton-line short"></div>
                      <div className="skeleton-line shorter"></div>
                    </div>
                  </div>
                  <div className="skeleton-content">
                    <div className="skeleton-line"></div>
                    <div className="skeleton-line"></div>
                    <div className="skeleton-line half"></div>
                  </div>
                  <div className="skeleton-media"></div>
                  <div className="skeleton-actions">
                    <div className="skeleton-button"></div>
                    <div className="skeleton-button"></div>
                    <div className="skeleton-button"></div>
                  </div>
                </div>
              ))
            ) : activeTab === 'search' && getCurrentUsers().length > 0 ? (
              // Search Results - Users
              <div className="search-results">
                <h3>👥 Users ({getCurrentUsers().length})</h3>
                <div className="users-grid">
                  {getCurrentUsers().map((userResult) => (
                    <UserCard
                      key={userResult._id}
                      userData={userResult}
                      currentUser={user}
                      onFollow={handleFollow}
                      isFollowing={following[userResult._id]}
                    />
                  ))}
                </div>
                
                {/* Search Results - Posts */}
                {getCurrentPosts().length > 0 && (
                  <>
                    <h3>📝 Posts ({getCurrentPosts().length})</h3>
                    {getCurrentPosts().map((post, index) => (
                      <PostCard
                        key={post._id}
                        ref={index === getCurrentPosts().length - 1 ? lastPostRef : null}
                        post={post}
                        user={user}
                        onLike={handleLike}
                        onSave={handleSave}
                        onFollow={handleFollow}
                        onComment={handleComment}
                        isFollowing={following[post.user?.id || post.userId]}
                      />
                    ))}
                  </>
                )}
              </div>
            ) : getCurrentPosts().length > 0 ? (
              // Regular Posts
              <>
                {getCurrentPosts().map((post, index) => (
                  <PostCard
                    key={post._id}
                    ref={index === getCurrentPosts().length - 1 ? lastPostRef : null}
                    post={post}
                    user={user}
                    onLike={handleLike}
                    onSave={handleSave}
                    onFollow={handleFollow}
                    onComment={handleComment}
                    isFollowing={following[post.user?.id || post.userId]}
                  />
                ))}
                
                {loading && pageRef.current > 1 && (
                  <div className="loading-more">
                    <div className="loading-spinner"></div>
                    <p>Loading more posts...</p>
                  </div>
                )}
              </>
            ) : (
              // Empty State
              <div className="empty-state">
                <div className="empty-icon">
                  {activeTab === 'trending' && '🔥'}
                  {activeTab === 'latest' && '🕒'}
                  {activeTab === 'category' && '🏷️'}
                  {activeTab === 'media' && '📷'}
                  {activeTab === 'search' && '🔍'}
                  {activeTab === 'hashtag' && '#'}
                </div>
                <h3>
                  {activeTab === 'trending' && 'No trending posts found'}
                  {activeTab === 'latest' && 'No posts yet'}
                  {activeTab === 'category' && `No posts in "${categoryFilter}" category`}
                  {activeTab === 'media' && `No "${mediaFilter}" posts found`}
                  {activeTab === 'search' && 'No results found'}
                  {activeTab === 'hashtag' && `No posts with "${searchQuery}" found`}
                </h3>
                <p>
                  {activeTab === 'trending' && 'Be the first to create trending content!'}
                  {activeTab === 'latest' && 'Create a post to get started!'}
                  {activeTab === 'category' && 'Be the first to post in this category!'}
                  {activeTab === 'media' && 'Create a post with this media type!'}
                  {activeTab === 'search' && 'Try a different search term'}
                  {activeTab === 'hashtag' && 'Try a different hashtag or create a post with this hashtag!'}
                </p>
                {(activeTab !== 'search' && activeTab !== 'hashtag') && (
                  <button 
                    className="create-post-btn"
                    onClick={() => navigate("/feed")}
                  >
                    ✨ Create a Post
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Explore;