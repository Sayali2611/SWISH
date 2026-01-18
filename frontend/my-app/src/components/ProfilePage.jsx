import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import '../styles/Feed.css';
import '../styles/ProfilePage.css';
import ExploreSearch from '../components/ExploreSearch';

const ProfilePage = () => {
  const { userId } = useParams();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [connectionStatus, setConnectionStatus] = useState('none');
  const [currentUser, setCurrentUser] = useState(null);
  const [isLoadingConnection, setIsLoadingConnection] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [showMoreSkills, setShowMoreSkills] = useState(false);

  const POSTS_PER_PAGE = 5;

  useEffect(() => {
    const token = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');
    
    if (!token || !storedUser) {
      navigate('/');
      return;
    }

    const parsedUser = JSON.parse(storedUser);
    setCurrentUser(parsedUser);
    
    if (userId === parsedUser.id) {
      navigate('/profile');
      return;
    }
    
    fetchUserProfile();
    fetchUserPosts();
    fetchConnectionStatus();
  }, [userId, navigate]);

  // ==================== API CALLS ====================
  const fetchUserProfile = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:5000/api/users/${userId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setUser(data);
      } else {
        setError('User not found or access denied');
      }
    } catch (error) {
      setError('Failed to load profile');
      console.error('Profile fetch error:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUserPosts = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:5000/api/users/${userId}/posts`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setPosts(data);
      }
    } catch (error) {
      console.error('Failed to fetch user posts:', error);
    }
  };

  const fetchConnectionStatus = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:5000/api/network/status/${userId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setConnectionStatus(data.status);
      }
    } catch (error) {
      console.error('Failed to fetch connection status:', error);
    }
  };

  // ==================== NETWORK ACTIONS ====================
  const handleConnect = async () => {
    try {
      setIsLoadingConnection(true);
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:5000/api/network/send/${userId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        setConnectionStatus('request_sent');
        fetchUserProfile();
      } else {
        const data = await response.json();
        alert(data.message || 'Failed to send connection request');
      }
    } catch (error) {
      console.error('Failed to send connection request:', error);
      alert('Network error. Please try again.');
    } finally {
      setIsLoadingConnection(false);
    }
  };

  const handleAcceptRequest = async () => {
    try {
      setIsLoadingConnection(true);
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:5000/api/network/accept/${userId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        setConnectionStatus('connected');
        fetchUserProfile();
      } else {
        const data = await response.json();
        alert(data.message || 'Failed to accept connection');
      }
    } catch (error) {
      console.error('Failed to accept connection:', error);
      alert('Network error. Please try again.');
    } finally {
      setIsLoadingConnection(false);
    }
  };

  const handleRejectRequest = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:5000/api/network/reject/${userId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        setConnectionStatus('none');
        fetchUserProfile();
      }
    } catch (error) {
      console.error('Failed to reject connection:', error);
    }
  };

  const handleCancelRequest = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:5000/api/network/cancel/${userId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        setConnectionStatus('none');
        fetchUserProfile();
      }
    } catch (error) {
      console.error('Failed to cancel request:', error);
    }
  };

  const handleRemoveConnection = async () => {
    if (window.confirm('Are you sure you want to remove this connection?')) {
      try {
        const token = localStorage.getItem('token');
        const response = await fetch(`http://localhost:5000/api/network/reject/${userId}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        if (response.ok) {
          setConnectionStatus('none');
          fetchUserProfile();
        }
      } catch (error) {
        console.error('Failed to remove connection:', error);
      }
    }
  };

  const handleMessage = () => {
    alert('Messaging feature coming soon!');
  };

  const handleUserSelectFromSearch = (selectedUser) => {
    if (selectedUser && selectedUser._id) {
      navigate(`/profile/${selectedUser._id}`);
    }
  };

  // ==================== HELPER FUNCTIONS ====================
  const getRoleDisplay = (role) => {
    switch(role) {
      case 'student': return '🎓 Student';
      case 'faculty': return '👨‍🏫 Faculty';
      case 'admin': return '👑 Admin';
      default: return '👤 Member';
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

  const totalPages = Math.ceil(posts.length / POSTS_PER_PAGE);
  const paginatedPosts = posts.slice(
    (currentPage - 1) * POSTS_PER_PAGE,
    currentPage * POSTS_PER_PAGE
  );

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  const handlePreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  // ==================== LOADING & ERROR STATES ====================
  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner">Loading Profile...</div>
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className="profile-error-state">
        <div className="error-content">
          <h2>Profile Not Found</h2>
          <p>{error || "This profile doesn't exist or you don't have permission to view it."}</p>
          <button onClick={() => navigate('/feed')} className="post-submit-btn">
            Back to Feed
          </button>
        </div>
      </div>
    );
  }

  // ==================== MAIN RENDER ====================
  return (
    <div className="feed-layout">
      {/* Header - EXACTLY like Feed.jsx */}
      <header className="feed-header-bar">
        <div className="header-left">
          <div className="logo" onClick={() => navigate("/feed")}>
            <span className="logo-icon">💼</span>
            <span className="logo-text">Swish</span>
          </div>
          
          {/* SEARCH BAR - Same as Feed.jsx */}
          <div className="feed-search-wrapper">
            <ExploreSearch onUserSelect={handleUserSelectFromSearch} />
          </div>

          <div className="nav-items">
            <button className="nav-btn" onClick={() => navigate("/feed")}>
              <span className="nav-icon">🏠</span>
              <span className="nav-text">Feed</span>
            </button>
            <button className="nav-btn active">
              <span className="nav-icon">👤</span>
              <span className="nav-text">Profile</span>
            </button>
            <button className="nav-btn" onClick={() => navigate("/network")}>
              <span className="nav-icon">👥</span>
              <span className="nav-text">Network</span>
            </button>
            <button className="nav-btn" onClick={() => navigate("/Explore")}>
              <span className="nav-icon">🔥</span>
              <span className="nav-text">Explore</span>
            </button>
            <button className="nav-btn" onClick={() => navigate("/notifications")}>
              <span className="nav-icon">🔔</span>
              <span className="nav-text">Notifications</span>
            </button>
          </div>
        </div>
        
        <div className="header-right">
          {currentUser?.role === 'admin' && (
            <button className="admin-btn" onClick={() => navigate("/admin")}>
              <span className="admin-icon">👑</span>
              <span>Admin</span>
            </button>
          )}
          
          <div className="user-info" onClick={() => navigate("/profile")}>
            <div className="user-avatar">
              {getUserAvatar(currentUser)}
            </div>
          </div>
          
          <button className="logout-btn" onClick={() => {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            navigate("/");
          }}>
            <span className="logout-icon">🚪</span>
            <span>Logout</span>
          </button>
        </div>
      </header>

      {/* Error/Success Notifications */}
      {error && (
        <div className="notification error">
          {error}
          <button onClick={() => setError("")}>×</button>
        </div>
      )}

      <div className="feed-layout-container">
        {/* ========== LEFT SIDEBAR ========== */}
        <div className="sidebar left-sidebar">
          {/* Profile Card */}
          <div className="profile-mini-card" style={{ textAlign: 'left', cursor: 'default' }}>
            <div className="profile-header" style={{ display: 'flex', gap: '16px', alignItems: 'center', marginBottom: '20px' }}>
              <div className="mini-avatar" style={{ width: '80px', height: '80px' }}>
                {getUserAvatar(user)}
              </div>
              <div>
                <h4 style={{ margin: '0 0 6px 0', fontSize: '1.3rem', color: 'var(--text-main)' }}>{user.name}</h4>
                <p className="mini-title" style={{ color: 'var(--lavender)', fontWeight: '700' }}>
                  {getRoleDisplay(user.role)}
                </p>
              </div>
            </div>
            
            <div className="mini-info">
              <div className="profile-stats" style={{ marginTop: '20px' }}>
                <div className="network-tabs-container">
                  <div className="network-tab-item active">
                    <span className="network-tab-text">Posts</span>
                    <span className="network-tab-badge">{posts.length}</span>
                  </div>
                  <div className="network-tab-item">
                    <span className="network-tab-text">Connections</span>
                    <span className="network-tab-badge">{user.connections?.length || 0}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Connection Actions */}
          <div className="quick-actions-card">
            <h3 className="sidebar-title">
              <span>🔗 Connection</span>
            </h3>
            <div className="connection-actions">
              {connectionStatus === 'none' && (
                <button 
                  className="quick-action-btn"
                  onClick={handleConnect}
                  disabled={isLoadingConnection}
                  style={{ width: '100%', justifyContent: 'center' }}
                >
                  <span className="action-icon">🤝</span>
                  <span>{isLoadingConnection ? 'Connecting...' : 'Connect'}</span>
                </button>
              )}
              
              {connectionStatus === 'request_sent' && (
                <div className="connection-btn-group">
                  <button className="quick-action-btn" disabled style={{ flex: 1 }}>
                    <span className="action-icon">⏳</span>
                    <span>Request Sent</span>
                  </button>
                  <button 
                    className="quick-action-btn"
                    onClick={handleCancelRequest}
                    style={{ width: '50px', padding: '10px' }}
                  >
                    ×
                  </button>
                </div>
              )}
              
              {connectionStatus === 'request_received' && (
                <div className="connection-btn-group">
                  <button 
                    className="quick-action-btn"
                    onClick={handleAcceptRequest}
                    disabled={isLoadingConnection}
                    style={{ flex: 1 }}
                  >
                    <span className="action-icon">✓</span>
                    <span>{isLoadingConnection ? 'Accepting...' : 'Accept'}</span>
                  </button>
                  <button 
                    className="quick-action-btn"
                    onClick={handleRejectRequest}
                    style={{ flex: 1 }}
                  >
                    <span className="action-icon">✗</span>
                    <span>Reject</span>
                  </button>
                </div>
              )}
              
              {connectionStatus === 'connected' && (
                <div className="connection-btn-group">
                  <button className="quick-action-btn" disabled style={{ flex: 1 }}>
                    <span className="action-icon">✓</span>
                    <span>Connected</span>
                  </button>
                  <button 
                    className="quick-action-btn"
                    onClick={handleRemoveConnection}
                    style={{ flex: 1 }}
                  >
                    <span className="action-icon">🗑️</span>
                    <span>Remove</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Skills Section */}
          {user.skills && user.skills.length > 0 && (
            <div className="trending-card">
              <h3 className="sidebar-title">
                <span>🛠️ Skills</span>
              </h3>
              <div className="trending-list">
                {(showMoreSkills ? user.skills : user.skills.slice(0, 5)).map((skill, index) => (
                  <div key={index} className="trending-item">
                    <div className="trending-info">
                      <h4>{skill}</h4>
                    </div>
                  </div>
                ))}
                {user.skills.length > 5 && (
                  <button 
                    className="view-more-btn"
                    onClick={() => setShowMoreSkills(!showMoreSkills)}
                  >
                    {showMoreSkills ? 'Show less' : `Show ${user.skills.length - 5} more`}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ========== MAIN CONTENT ========== */}
        <div className="main-content feed-main">
          

          {/* Profile Header Card */}
          <div className="create-post-card" style={{ padding: '30px', marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '24px', marginBottom: '20px' }}>
              <div className="user-avatar" style={{ width: '100px', height: '100px', fontSize: '36px' }}>
                {getUserAvatar(user)}
              </div>
              <div style={{ flex: 1 }}>
                <h1 style={{ margin: '0 0 8px 0', fontSize: '2rem', color: 'var(--text-main)' }}>{user.name}</h1>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px', flexWrap: 'wrap' }}>
                  <span style={{ color: 'var(--lavender)', fontWeight: '700' }}>
                    {getRoleDisplay(user.role)}
                  </span>
                  {user.department && (
                    <span style={{ color: 'var(--text-dim)', fontSize: '0.95rem' }}>
                      • {user.department}
                    </span>
                  )}
                  {user.year && (
                    <span style={{ color: 'var(--text-dim)', fontSize: '0.95rem' }}>
                      • {user.year} Year
                    </span>
                  )}
                </div>
                <div style={{ color: 'var(--text-dim)', fontSize: '0.9rem' }}>
                  {user.email && <span>📧 {user.email}</span>}
                  {user.contact && <span style={{ marginLeft: '12px' }}>📞 {user.contact}</span>}
                </div>
              </div>
            </div>

            {/* Bio Section */}
            {user.bio && (
              <div style={{ marginTop: '20px', paddingTop: '20px', borderTop: '1px solid var(--border)' }}>
                <h3 style={{ color: 'var(--lavender)', marginBottom: '12px', fontSize: '1rem' }}>📝 About</h3>
                <p style={{ color: 'var(--text-main)', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>
                  {user.bio}
                </p>
              </div>
            )}

            {/* Campus Info */}
            <div style={{ marginTop: '20px', paddingTop: '20px', borderTop: '1px solid var(--border)' }}>
              <h3 style={{ color: 'var(--lavender)', marginBottom: '12px', fontSize: '1rem' }}>🏛️ Campus Info</h3>
              <div className="campus-info-grid">
                <div className="campus-info-item">
                  <div className="campus-info-label">🏫 College</div>
                  <div className="campus-info-value">SIGCE</div>
                </div>
                {user.department && (
                  <div className="campus-info-item">
                    <div className="campus-info-label">🎓 Program</div>
                    <div className="campus-info-value">{user.department}</div>
                  </div>
                )}
                {user.year && (
                  <div className="campus-info-item">
                    <div className="campus-info-label">📅 Year</div>
                    <div className="campus-info-value">{user.year}</div>
                  </div>
                )}
                <div className="campus-info-item">
                  <div className="campus-info-label">👥 Connections</div>
                  <div className="campus-info-value" style={{ color: 'var(--lavender)', fontSize: '1.2rem' }}>
                    {user.connections?.length || 0}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Posts Section */}
          <div className="posts-container">
            <div className="profile-section">
              <h2 style={{ margin: '0 0 20px 0', color: 'var(--text-main)', fontSize: '1.2rem' }}>
                Recent Activity ({posts.length} posts)
              </h2>
              
              {paginatedPosts.length === 0 ? (
                <div className="notifications-empty">
                  <div className="empty-icon">📝</div>
                  <h3>No posts yet</h3>
                  <p>{user.name} hasn't shared any posts yet.</p>
                </div>
              ) : (
                <>
                  {paginatedPosts.map(post => (
                    <div key={post._id} className="profile-post-card">
                      <div className="post-header">
                        <div className="post-user">
                          <div className="post-avatar">
                            {getUserAvatar(post.user || user)}
                          </div>
                          <div className="post-user-info">
                            <div className="post-user-name">
                              {post.user?.name || user.name}
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
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="post-content">
                        <p style={{ whiteSpace: 'pre-wrap', overflowWrap: 'break-word' }}>
                          {post.content}
                        </p>
                      </div>

                      <div className="post-stats">
                        <span className="stat-item">👍 {post.likes?.length || 0}</span>
                        <span className="stat-item">💬 {post.comments?.length || 0}</span>
                        <span className="stat-item">🔄 {post.shares?.length || 0}</span>
                      </div>
                    </div>
                  ))}
                  
                  {totalPages > 1 && (
                    <div className="profile-pagination">
                      <button
                        onClick={handlePreviousPage}
                        disabled={currentPage === 1}
                        className="pagination-btn"
                      >
                        ← Previous
                      </button>
                      <span style={{ color: 'var(--text-dim)', fontWeight: '600' }}>
                        Page {currentPage} of {totalPages}
                      </span>
                      <button
                        onClick={handleNextPage}
                        disabled={currentPage === totalPages}
                        className="pagination-btn"
                      >
                        Next →
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {/* ========== RIGHT SIDEBAR ========== */}
        <div className="sidebar right-sidebar">
          {/* Stats Card */}
          <div className="trending-card">
            <h3 className="sidebar-title">
              <span>📊 Profile Stats</span>
            </h3>
            
            <div className="profile-stats-grid">
              <div className="profile-stat-item">
                <span className="profile-stat-number">{posts.length}</span>
                <span className="profile-stat-label">Total Posts</span>
              </div>
              <div className="profile-stat-item">
                <span className="profile-stat-number">
                  {posts.reduce((acc, post) => acc + (post.likes?.length || 0), 0)}
                </span>
                <span className="profile-stat-label">Total Likes</span>
              </div>
              <div className="profile-stat-item">
                <span className="profile-stat-number">
                  {posts.reduce((acc, post) => acc + (post.comments?.length || 0), 0)}
                </span>
                <span className="profile-stat-label">Total Comments</span>
              </div>
              <div className="profile-stat-item">
                <span className="profile-stat-number">
                  {posts.reduce((acc, post) => acc + (post.shares?.length || 0), 0)}
                </span>
                <span className="profile-stat-label">Total Shares</span>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="quick-actions-card">
            <h3 className="sidebar-title">
              <span>⚡ Quick Actions</span>
            </h3>
            <div className="quick-actions-grid">
              <button className="quick-action-btn" onClick={() => navigate("/network")}>
                <span className="action-icon">👥</span>
                <span>My Network</span>
              </button>
              <button className="quick-action-btn" onClick={() => navigate("/explore")}>
                <span className="action-icon">🔍</span>
                <span>Find People</span>
              </button>
              <button className="quick-action-btn" onClick={() => navigate("/profile")}>
                <span className="action-icon">👤</span>
                <span>My Profile</span>
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default ProfilePage;