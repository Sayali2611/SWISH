import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import "../styles/Feed.css";
// Import her notification components
import { getSocket } from "../components/NotificationBell";
import Toast from "../components/Toast";
import "../styles/Notifications.css";

/* --------------------
   ADDED: Search imports
   -------------------- */
import ExploreSearch from "../components/ExploreSearch";
import "../styles/ExploreSearch.css";

function Feed() {
  const [posts, setPosts] = useState([]);
  const [newPost, setNewPost] = useState("");
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [commentTexts, setCommentTexts] = useState({});
  const [commentLoading, setCommentLoading] = useState({});
  const [activeCommentSection, setActiveCommentSection] = useState(null);
  
  // Her notification states
  const [notifCount, setNotifCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  const [toastData, setToastData] = useState(null);
  
  // NEW: State for highlighted post from search
  const [highlightedPostId, setHighlightedPostId] = useState(null);
  const [searchPostData, setSearchPostData] = useState(null);
  const [hasScrolledToPost, setHasScrolledToPost] = useState(false);
  
  const navigate = useNavigate();
  const location = useLocation();

  // Block ALL alerts
  useEffect(() => {
    const originalAlert = window.alert;
    window.alert = function(msg) {
      console.log("Alert blocked:", msg);
      return;
    };

    return () => {
      window.alert = originalAlert;
    };
  }, []);

  useEffect(() => {
    const userData = localStorage.getItem('user');
    const token = localStorage.getItem('token');
    
    if (!userData || !token) {
      navigate("/");
      return;
    }

    const userObj = JSON.parse(userData);
    setUser(userObj);

    // Check for highlighted post FIRST
    const checkAndLoadHighlightedPost = () => {
      console.log("🔍 [Feed] Checking for highlighted post on mount...");
      
      // Check localStorage
      const highlightData = localStorage.getItem('searchHighlightedPost');
      if (highlightData) {
        try {
          const data = JSON.parse(highlightData);
          console.log("✅ [Feed] Found highlighted post data:", data);
          
          if (data.postId && Date.now() - data.timestamp < 60000) {
            console.log("🎯 [Feed] Setting highlighted post ID:", data.postId);
            setHighlightedPostId(data.postId);
            setSearchPostData(data);
            
            // Clear immediately
            localStorage.removeItem('searchHighlightedPost');
            
            // Fetch posts with this highlighted ID
            fetchPosts(data.postId);
            return;
          }
        } catch (error) {
          console.error("Error parsing highlighted post:", error);
          localStorage.removeItem('searchHighlightedPost');
        }
      }
      
      // Check sessionStorage as backup
      const sessionPostId = sessionStorage.getItem('highlightedPostId');
      if (sessionPostId) {
        console.log("🔑 [Feed] Found in sessionStorage:", sessionPostId);
        setHighlightedPostId(sessionPostId);
        sessionStorage.removeItem('highlightedPostId');
        fetchPosts(sessionPostId);
        return;
      }
      
      // Normal fetch if no highlighted post
      console.log("📭 [Feed] No highlighted post found");
      fetchPosts();
    };
    
    checkAndLoadHighlightedPost();

    // --- SOCKET/NOTIFICATION LOGIC (Her code) ---
    const socket = getSocket();
    if (socket) {
      // Listen for real-time new notifications
      socket.on("new_notification", (payload) => {
        setNotifCount(c => c + 1);

        // Show toast popup
        setToastData({
          userName: payload.userName || "New Activity",
          message: payload.message || "You have a new notification.",
          userImage: payload.userImage,
          timeAgo: "just now"
        });
      });

      // Fetch initial unread count
      const fetchInitialCount = async () => {
        try {
          const response = await fetch("http://localhost:5000/api/notifications/unread/count", {
            headers: { Authorization: `Bearer ${token}` }
          });
          const data = await response.json();
          setNotifCount(data.count || 0);
        } catch (error) {
          console.error("Failed to fetch initial notification count:", error);
        }
      };
      fetchInitialCount();
    }

    return () => {
      if (socket) {
        socket.off("new_notification");
      }
    };
    // --- END SOCKET/NOTIFICATION LOGIC ---

  }, [navigate]);

  // NEW: Fetch posts with highlighted post handling
  const fetchPosts = async (highlightedId = null) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:5000/api/posts', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        navigate("/");
        return;
      }

      const data = await response.json();
      console.log("📝 [Feed] Fetched", data.length, "posts");
      
      // Debug: Show all post IDs
      console.log("🔍 [Feed] All post IDs from API:");
      data.forEach((post, i) => {
        console.log(`  [${i}] ID: ${post._id} | Content: "${post.content?.substring(0, 30)}..."`);
      });
      
      // If we have a highlighted post ID, move it to top
      const postIdToHighlight = highlightedId || highlightedPostId;
      if (postIdToHighlight) {
        console.log("🎯 [Feed] Looking for post with ID:", postIdToHighlight);
        
        const highlightedIndex = data.findIndex(post => {
          // Try multiple ways to match the ID
          const match = post._id === postIdToHighlight || 
                       post.id === postIdToHighlight ||
                       (post._id && post._id.toString() === postIdToHighlight);
          return match;
        });
        
        console.log("🔍 [Feed] Found at index:", highlightedIndex);
        
        if (highlightedIndex > -1) {
          // Create new array with highlighted post at the TOP
          const newPosts = [...data];
          const [highlightedPost] = newPosts.splice(highlightedIndex, 1);
          newPosts.unshift(highlightedPost);
          
          console.log("✅ [Feed] Moved post to TOP!");
          console.log("📊 [Feed] New order (first 3 posts):");
          newPosts.slice(0, 3).forEach((post, i) => {
            const isHighlighted = post._id === postIdToHighlight;
            console.log(`  [${i}] ${isHighlighted ? "⭐ " : ""}ID: ${post._id} | "${post.content?.substring(0, 30)}..."`);
          });
          
          setPosts(newPosts);
          
          // Set the highlighted post ID
          if (!highlightedPostId) {
            setHighlightedPostId(postIdToHighlight);
          }
          
          // Scroll to the highlighted post after render
          setTimeout(() => {
            scrollToHighlightedPost(postIdToHighlight);
          }, 1000);
          
        } else {
          console.log("❌ [Feed] Could not find highlighted post in data");
          console.log("   Looking for:", postIdToHighlight);
          console.log("   Available IDs:", data.map(p => p._id));
          setPosts(data);
        }
      } else {
        setPosts(data);
      }
      
    } catch (error) {
      setError('Failed to fetch posts');
      console.error('Error fetching posts:', error);
    }
  };

  // NEW: Function to scroll to highlighted post
  const scrollToHighlightedPost = (postId = null) => {
    const targetId = postId || highlightedPostId;
    if (!targetId) return;
    
    console.log("🎯 [Feed] Attempting to scroll to post:", targetId);
    
    const elementId = `post-${targetId}`;
    console.log("🔍 [Feed] Looking for element:", elementId);
    
    let attempts = 0;
    const maxAttempts = 15;
    
    const tryScroll = () => {
      attempts++;
      
      const element = document.getElementById(elementId);
      console.log(`⏳ [Feed] Attempt ${attempts}: Element found?`, !!element);
      
      if (element) {
        console.log("✅ [Feed] Found element! Scrolling...");
        
        // Scroll to element
        element.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'center',
          inline: 'center'
        });
        
        // Highlight effect
        element.style.border = '3px solid #007bff';
        element.style.backgroundColor = '#f0f8ff';
        element.style.boxShadow = '0 0 20px rgba(0, 123, 255, 0.3)';
        element.style.transition = 'all 0.5s ease';
        
        // Add "From Search" badge if not already there
        if (!element.querySelector('.highlight-badge')) {
          const badge = document.createElement('div');
          badge.className = 'highlight-badge';
          badge.innerHTML = `
            <span>🔍</span>
            <span>From Search</span>
          `;
          badge.style.cssText = `
            position: absolute;
            top: 15px;
            right: 15px;
            background: #007bff;
            color: white;
            padding: 6px 12px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: bold;
            z-index: 10;
            display: flex;
            align-items: center;
            gap: 5px;
          `;
          element.style.position = 'relative';
          element.appendChild(badge);
        }
        
        setHasScrolledToPost(true);
        
        // Remove highlight after 5 seconds
        setTimeout(() => {
          element.style.boxShadow = '0 0 10px rgba(0, 123, 255, 0.1)';
          setTimeout(() => {
            element.style.border = '';
            element.style.backgroundColor = '';
            element.style.boxShadow = '';
          }, 2000);
        }, 5000);
        
      } else if (attempts < maxAttempts) {
        console.log(`⏳ [Feed] Element not found, trying again in 300ms...`);
        setTimeout(tryScroll, 300);
      } else {
        console.log("❌ [Feed] Failed to find element after", maxAttempts, "attempts");
      }
    };
    
    tryScroll();
  };

  // Force scroll when highlightedPostId changes
  useEffect(() => {
    if (highlightedPostId && posts.length > 0 && !hasScrolledToPost) {
      console.log("🔄 [Feed] highlightedPostId changed, attempting scroll...");
      setTimeout(() => {
        scrollToHighlightedPost();
      }, 1500);
    }
  }, [highlightedPostId, posts, hasScrolledToPost]);

  const handleCreatePost = async () => {
    if (!newPost.trim() || !user) {
      setError('Post cannot be empty');
      return;
    }

    setLoading(true);
    setError("");
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:5000/api/posts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          content: newPost
        })
      });

      const data = await response.json();
      
      if (response.ok) {
        setNewPost("");
        setSuccess('Post created successfully!');
        setPosts(prevPosts => [data, ...prevPosts]);
        setTimeout(() => setSuccess(""), 3000);
      } else {
        setError(data.message || 'Failed to create post');
      }
    } catch (error) {
      setError('Network error: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLike = async (postId) => {
    if (!user) return;

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
        setPosts(prevPosts => 
          prevPosts.map(post => 
            post._id === postId ? updatedPost : post
          )
        );
      }
    } catch (error) {
      setError('Failed to like post');
    }
  };

  const handleAddComment = async (postId) => {
    const text = commentTexts[postId];
    if (!text?.trim() || !user) return;

    setCommentLoading(prev => ({ ...prev, [postId]: true }));
    
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:5000/api/posts/${postId}/comment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          content: text
        })
      });

      const data = await response.json();

      if (response.ok) {
        setCommentTexts(prev => ({ ...prev, [postId]: "" }));
        setPosts(prevPosts => 
          prevPosts.map(post => 
            post._id === postId ? data.post : post
          )
        );
        setSuccess('Comment added successfully!');
        setTimeout(() => setSuccess(""), 2000);
      } else {
        setError('Failed to add comment');
      }
    } catch (error) {
      setError('Network error: Unable to add comment');
    } finally {
      setCommentLoading(prev => ({ ...prev, [postId]: false }));
    }
  };

  // Your report post function
  const handleReportPost = async (postId) => {
    const reason = prompt("Please provide reason for reporting this post (harassment, spam, inappropriate content, etc.):");
    
    if (!reason || !reason.trim()) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:5000/api/posts/${postId}/report`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ reason })
      });

      const data = await response.json();
      
      if (response.ok) {
        setSuccess('✅ Post reported successfully! Admin will review it.');
        setTimeout(() => setSuccess(""), 3000);
      } else {
        setError(data.message || 'Failed to report post');
      }
    } catch (error) {
      setError('Network error');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate("/");
  };

  const isPostLiked = (post) => {
    return post.likes?.includes(user?.id);
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

  const handleCommentChange = (postId, text) => {
    setCommentTexts(prev => ({
      ...prev,
      [postId]: text
    }));
  };

  const toggleCommentSection = (postId) => {
    setActiveCommentSection(activeCommentSection === postId ? null : postId);
  };

  // Her notification click handler
  const handleClickNotification = async () => {
    const token = localStorage.getItem("token");

    setToastData(null); // Hide toast when clicking the bell

    // Mark notifications as read BEFORE navigation
    if (notifCount > 0) {
      try {
        await fetch("http://localhost:5000/api/notifications/read-all", {
          method: "PUT",
          headers: { Authorization: `Bearer ${token}` }
        });
      } catch (err) {
        console.error("Failed to mark as read:", err);
      }
    }

    setNotifCount(0); // Reset the badge count

    // Navigate to full notification page
    navigate("/notifications");
  };

  // ----------------------------------------------------
  // 🚀 Handler for a user selected from the search dropdown
  const handleUserSelectFromSearch = (selectedUser) => {
    // Navigate to the profile page using the selected user's ID
    if (selectedUser && selectedUser._id) {
        navigate(`/profile/${selectedUser._id}`); 
    }
  };
  // ----------------------------------------------------


  if (!user) {
    return (
      <div className="loading-container">
        <div className="loading-spinner">Loading...</div>
      </div>
    );
  }

  return (
    <div className="feed-container">
      {/* Header */}
      <header className="feed-header">
        <div className="header-left">
          <div className="logo" onClick={() => navigate("/feed")}>💼 CampusConnect</div>
          
          {/* 🔍 SEARCH BAR INTEGRATION (Placed after logo) */}
          <div className="feed-search-wrapper">
             <ExploreSearch onUserSelect={handleUserSelectFromSearch} />
          </div>
          {/* END SEARCH BAR */}


          <div className="nav-items">
            <button className="nav-btn active">🏠 Feed</button>
            <button className="nav-btn" onClick={() => navigate("/profile")}>👤 Profile</button>
            <button className="nav-btn" onClick={() => navigate("/network")}>👥 Network</button>
            
            {/* Her notification button */}
            <button 
              className={`nav-btn notification-bell-btn ${showNotifications ? 'active-bell' : ''}`}
              onClick={handleClickNotification}
              title="Notifications"
            >
              🔔 Notifications
              {notifCount > 0 && <span className="notif-badge">{notifCount}</span>}
            </button>
          </div>
        </div>
        <div className="header-right">
          <div className="user-info">
            <span className="user-name">Welcome, {user.name}</span>
            <div 
              className="user-avatar" 
              title="View Profile"
              onClick={() => navigate("/profile")}
            >
              {getUserAvatar(user)}
            </div>
          </div>
          
          {/* Your Admin button - Only show if user is admin */}
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

      {/* Notifications */}
      {error && (
        <div className="notification error">
          {error}
          <button onClick={() => setError("")}>×</button>
        </div>
      )}
      {success && (
        <div className="notification success">
          {success}
          <button onClick={() => setSuccess("")}>×</button>
        </div>
      )}

      {/* Her notification panel */}
      {showNotifications && (
        <div className="notification-panel-overlay" onClick={() => setShowNotifications(false)}>
          <div className="notification-panel" onClick={(e) => e.stopPropagation()}>
            <div className="panel-header">
              <h3>Notifications</h3>
              <button onClick={() => setShowNotifications(false)} className="close-panel-btn">×</button>
            </div>
            <div className="panel-content">
              <p className="empty-message">You have no new notifications to display (Placeholder).</p>
              <p>The badge has been reset. You can now fetch your notification list here.</p>
              <button 
                onClick={() => { setShowNotifications(false); navigate("/notifications"); }}
                className="view-all-notifs-btn"
              >
                View Full Notification Page
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="feed-content">
        <div className="main-feed">
          {/* User Welcome Card */}
          <div className="welcome-card">
            <div className="welcome-content">
              <div className="welcome-avatar">
                {getUserAvatar(user)}
              </div>
              <div className="welcome-text">
                <h2>Hello, {user.name}! 👋</h2>
                <p>Share your thoughts with the campus community...</p>
              </div>
            </div>
            <div className="user-role-badge">
              {user.role === 'student' && '🎓 Student'}
              {user.role === 'faculty' && '👨‍🏫 Faculty'}
              {user.role === 'admin' && '👑 Admin'}
            </div>
          </div>

          {/* Create Post Card */}
          <div className="create-post-card">
            <div className="post-input-section">
              <div className="user-avatar-small">
                {getUserAvatar(user)}
              </div>
              <input 
                type="text" 
                placeholder="What's happening on campus? Share updates, events, or thoughts... 🎓" 
                value={newPost}
                onChange={(e) => setNewPost(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleCreatePost()}
                maxLength={500}
              />
            </div>
            <div className="post-actions">
              <div className="post-features">
                <button className="feature-btn" title="Add Image">🖼️</button>
                <button className="feature-btn" title="Add Event">📅</button>
                <button className="feature-btn" title="Add Poll">📊</button>
              </div>
              <div className="post-submit-section">
                <div className="char-count">{newPost.length}/500</div>
                <button 
                  className="post-submit-btn" 
                  onClick={handleCreatePost}
                  disabled={loading || !newPost.trim()}
                >
                  {loading ? (
                    <>
                      <div className="btn-spinner"></div>
                      Posting...
                    </>
                  ) : (
                    '📝 Post'
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Posts Feed */}
          <div className="posts-container">
            {posts.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">📝</div>
                <h3>No posts yet</h3>
                <p>Be the first to share something with your campus community!</p>
                <button 
                  className="create-first-post-btn"
                  onClick={() => document.querySelector('.post-input-section input')?.focus()}
                >
                  Create Your First Post
                </button>
              </div>
            ) : (
              posts.map(post => {
                const isHighlighted = post._id === highlightedPostId;
                
                return (
                  <div 
                    key={post._id} 
                    id={`post-${post._id}`}
                    className={`post-card ${isHighlighted ? 'highlighted-post' : ''}`}
                    style={isHighlighted ? {
                      border: '3px solid #007bff',
                      backgroundColor: '#f0f8ff',
                      boxShadow: '0 0 15px rgba(0, 123, 255, 0.2)',
                      position: 'relative',
                      marginBottom: '25px',
                      transition: 'all 0.3s ease'
                    } : {}}
                  >
                    {isHighlighted && (
                      <div className="highlight-badge" style={{
                        position: 'absolute',
                        top: '15px',
                        right: '15px',
                        background: '#007bff',
                        color: 'white',
                        padding: '6px 12px',
                        borderRadius: '20px',
                        fontSize: '12px',
                        fontWeight: 'bold',
                        zIndex: 10,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px'
                      }}>
                        <span>🔍</span>
                        <span>From Search</span>
                      </div>
                    )}
                    
                    <div className="post-header">
                      <div className="post-user">
                        <div className="user-avatar">
                          {getUserAvatar(post.user)}
                        </div>
                        <div className="user-info">
                          <div className="user-name">
                            {post.user?.name || "Unknown User"}
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
                      <button className="post-options-btn" title="More options">⋯</button>
                    </div>

                    <div className="post-content">
                      <p>{post.content}</p>
                      {post.imageUrl && (
                        <div className="post-image">
                          <img src={post.imageUrl} alt="Post content" />
                        </div>
                      )}
                    </div>

                    <div className="post-stats">
                      <span className="stat-item">
                        👍 {post.likes?.length || 0}
                      </span>
                      <span className="stat-item">
                        💬 {post.comments?.length || 0}
                      </span>
                    </div>

                    <div className="post-actions-buttons">
                      <button 
                        className={`action-btn like-btn ${isPostLiked(post) ? 'liked' : ''}`}
                        onClick={() => handleLike(post._id)}
                      >
                        {isPostLiked(post) ? '👍 Liked' : '🤍 Like'}
                      </button>
                      <button 
                        className={`action-btn comment-btn ${activeCommentSection === post._id ? 'active' : ''}`}
                        onClick={() => toggleCommentSection(post._id)}
                      >
                        💬 Comment
                      </button>
                      <button className="action-btn share-btn">
                        🔄 Share
                      </button>
                      {/* Your Report button */}
                      <button 
                        className="action-btn report-btn"
                        onClick={() => handleReportPost(post._id)}
                        title="Report inappropriate content"
                      >
                        🚨 Report
                      </button>
                    </div>

                    {/* Comments Section */}
                    {activeCommentSection === post._id && (
                      <div className="comments-section">
                        {/* Display Existing Comments */}
                        {post.comments && post.comments.length > 0 && (
                          <div className="comments-list">
                            <h4>Comments ({post.comments.length})</h4>
                            {post.comments.map((comment, index) => (
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
                            value={commentTexts[post._id] || ""}
                            onChange={(e) => handleCommentChange(post._id, e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && handleAddComment(post._id)}
                          />
                          <button 
                            className="comment-submit-btn"
                            onClick={() => handleAddComment(post._id)}
                            disabled={commentLoading[post._id] || !commentTexts[post._id]?.trim()}
                          >
                            {commentLoading[post._id] ? '...' : 'Post'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="sidebar">
          {/* User Profile Card */}
          <div className="sidebar-card user-profile-card">
            <div className="profile-header">
              <div className="profile-avatar">
                {getUserAvatar(user)}
              </div>
              <div className="profile-info">
                <h3>{user.name}</h3>
                <p className="profile-role">
                  {user.role === 'student' && '🎓 Student'}
                  {user.role === 'faculty' && '👨‍🏫 Faculty'}
                  {user.role === 'admin' && '👑 Administrator'}
                </p>
                {user.department && (
                  <p className="profile-department">{user.department}</p>
                )}
                <div className="profile-stats">
                  <span>{posts.filter(p => p.user?.id === user.id).length} posts</span>
                  <span>•</span>
                  <span>{(posts.reduce((acc, post) => acc + (post.likes?.length || 0), 0))} likes</span>
                </div>
              </div>
            </div>
            <button 
              className="view-profile-btn"
              onClick={() => navigate("/profile")}
            >
              👤 View Profile
            </button>
          </div>

          <div className="sidebar-card">
            <h3>📊 Campus Stats</h3>
            <div className="stats">
              <div className="stat">
                <strong>{posts.length}</strong>
                <span>Posts Today</span>
              </div>
              <div className="stat">
                <strong>{new Set(posts.map(p => p.user?.id)).size}</strong>
                <span>Active Users</span>
              </div>
              <div className="stat">
                <strong>{(posts.reduce((acc, post) => acc + (post.likes?.length || 0), 0))}</strong>
                <span>Total Likes</span>
              </div>
              <div className="stat">
                <strong>{(posts.reduce((acc, post) => acc + (post.comments?.length || 0), 0))}</strong>
                <span>Total Comments</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Her Toast Component */}
      <Toast
        notification={toastData}
        onClose={() => setToastData(null)}
        onOpen={() => {
          setToastData(null);
          setNotifCount(0);
          setShowNotifications(true);
        }}
      />
    </div>
  );
}

export default Feed;