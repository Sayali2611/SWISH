import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import '../styles/ProfilePage.css';

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

  useEffect(() => {
    const token = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');
    
    if (!token || !storedUser) {
      navigate('/');
      return;
    }

    const parsedUser = JSON.parse(storedUser);
    setCurrentUser(parsedUser);
    
    // Don't fetch if it's your own profile
    if (userId === parsedUser.id) {
      navigate('/profile');
      return;
    }
    
    fetchUserProfile();
    fetchUserPosts();
    fetchConnectionStatus();
  }, [userId, navigate]);

  const fetchUserProfile = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:5000/api/users/${userId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
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
        headers: {
          'Authorization': `Bearer ${token}`
        }
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
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setConnectionStatus(data.status);
      }
    } catch (error) {
      console.error('Failed to fetch connection status:', error);
    }
  };

  const handleConnect = async () => {
    try {
      setIsLoadingConnection(true);
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:5000/api/network/request/${userId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        setConnectionStatus('request_sent');
        // Show success message
        alert('Connection request sent!');
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
        alert('Connection accepted! You are now connected.');
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
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        setConnectionStatus('none');
        alert('Connection request rejected.');
      }
    } catch (error) {
      console.error('Failed to reject connection:', error);
    }
  };

  const handleCancelRequest = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:5000/api/network/cancel/${userId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        setConnectionStatus('none');
        alert('Connection request cancelled.');
      }
    } catch (error) {
      console.error('Failed to cancel request:', error);
    }
  };

  const handleRemoveConnection = async () => {
    if (window.confirm('Are you sure you want to remove this connection?')) {
      try {
        const token = localStorage.getItem('token');
        const response = await fetch(`http://localhost:5000/api/network/remove/${userId}`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        if (response.ok) {
          setConnectionStatus('none');
          alert('Connection removed.');
        }
      } catch (error) {
        console.error('Failed to remove connection:', error);
      }
    }
  };

  const handleMessage = () => {
    // Navigate to messages or show message modal
    alert('Messaging feature coming soon!');
  };

  const getRoleDisplay = (role) => {
    switch(role) {
      case 'student': return '🎓 Student';
      case 'faculty': return '👨‍🏫 Faculty';
      case 'admin': return '👑 Admin';
      default: return 'User';
    }
  };

  const getUserAvatar = (userData) => {
    if (userData?.profilePhoto) {
      return (
        <img 
          src={userData.profilePhoto} 
          alt={userData.name} 
          className="profile-page-avatar-img"
        />
      );
    }
    return userData?.name?.charAt(0).toUpperCase() || "U";
  };

  if (loading) {
    return (
      <div className="profile-page-loading">
        <div className="profile-page-spinner"></div>
        <p>Loading profile...</p>
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className="profile-page-error">
        <h2>User Not Found</h2>
        <p>{error || "The user profile you're looking for doesn't exist or you don't have permission to view it."}</p>
        <button onClick={() => navigate('/feed')} className="back-to-feed-btn">
          Back to Feed
        </button>
      </div>
    );
  }

  const isOwnProfile = currentUser && currentUser.id === userId;

  return (
    <div className="profile-page-container">
      {/* Header */}
      <header className="profile-page-header">
        <div className="profile-page-header-content">
          <button 
            onClick={() => navigate('/feed')}
            className="back-button"
          >
            ← Back to Feed
          </button>
          <h1 className="profile-page-title">Swish Profile</h1>
          <div className="profile-page-header-actions">
            <Link to="/profile" className="my-profile-link">
              👤 My Profile
            </Link>
          </div>
        </div>
      </header>

      <div className="profile-page-content">
        {/* Profile Sidebar */}
        <div className="profile-page-sidebar">
          <div className="profile-page-card">
            <div className="profile-page-avatar-large">
              {getUserAvatar(user)}
            </div>
            
            <div className="profile-page-info">
              <h2 className="profile-page-name">{user.name}</h2>
              
              <div className="profile-page-role-badge">
                {getRoleDisplay(user.role)}
              </div>
              
              <div className="profile-page-details">
                {user.email && (
                  <div className="profile-page-detail-item">
                    <span className="detail-icon">📧</span>
                    <span>{user.email}</span>
                  </div>
                )}
                
                {user.contact && (
                  <div className="profile-page-detail-item">
                    <span className="detail-icon">📞</span>
                    <span>{user.contact}</span>
                  </div>
                )}
                
                {user.department && (
                  <div className="profile-page-detail-item">
                    <span className="detail-icon">🏫</span>
                    <span>{user.department}</span>
                  </div>
                )}
                
                {user.designation && (
                  <div className="profile-page-detail-item">
                    <span className="detail-icon">💼</span>
                    <span>{user.designation}</span>
                  </div>
                )}
                
                {user.year && (
                  <div className="profile-page-detail-item">
                    <span className="detail-icon">📅</span>
                    <span>{user.year} Year</span>
                  </div>
                )}
              </div>
              
              {/* Bio Section */}
              {user.bio && (
                <div className="profile-page-bio">
                  <h3>About</h3>
                  <p>{user.bio}</p>
                </div>
              )}
              
              {/* Skills Section */}
              {user.skills && user.skills.length > 0 && (
                <div className="profile-page-skills">
                  <h3>Skills & Expertise</h3>
                  <div className="profile-page-skills-list">
                    {user.skills.map((skill, index) => (
                      <span key={index} className="profile-page-skill-tag">
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
            
            {/* Connection Actions */}
            <div className="profile-page-connection-actions">
              {connectionStatus === 'none' && (
                <button 
                  className="profile-page-connect-btn"
                  onClick={handleConnect}
                  disabled={isLoadingConnection}
                >
                  {isLoadingConnection ? 'Sending...' : 'Connect'}
                </button>
              )}
              
              {connectionStatus === 'request_sent' && (
                <div className="connection-status-group">
                  <button 
                    className="connection-pending-btn"
                    disabled
                  >
                    Request Sent
                  </button>
                  <button 
                    className="connection-cancel-btn"
                    onClick={handleCancelRequest}
                  >
                    Cancel
                  </button>
                </div>
              )}
              
              {connectionStatus === 'request_received' && (
                <div className="connection-status-group">
                  <button 
                    className="connection-accept-btn"
                    onClick={handleAcceptRequest}
                    disabled={isLoadingConnection}
                  >
                    {isLoadingConnection ? 'Accepting...' : 'Accept Request'}
                  </button>
                  <button 
                    className="connection-reject-btn"
                    onClick={handleRejectRequest}
                  >
                    Reject
                  </button>
                </div>
              )}
              
              {connectionStatus === 'connected' && (
                <div className="connection-status-group">
                  <button 
                    className="connection-connected-btn"
                    disabled
                  >
                    ✓ Connected
                  </button>
                  <button 
                    className="connection-remove-btn"
                    onClick={handleRemoveConnection}
                  >
                    Remove
                  </button>
                </div>
              )}          
            </div>
          </div>
        </div>

        {/* Main Content - User Posts */}
        <div className="profile-page-main">
          <div className="profile-page-posts-section">
            <div className="posts-section-header">
              <h2>Recent Activity</h2>
              <span className="posts-count">{posts.length} posts</span>
            </div>
            
            {posts.length === 0 ? (
              <div className="profile-page-no-posts">
                <div className="no-posts-icon">📝</div>
                <h3>No posts yet</h3>
                <p>{user.name} hasn't shared any posts yet.</p>
              </div>
            ) : (
              <div className="profile-page-posts-list">
                {posts.map(post => (
                  <div key={post._id} className="profile-page-post-card">
                    <div className="post-card-content">
                      <p>{post.content}</p>
                    </div>
                    <div className="post-card-stats">
                      <span>👍 {post.likes?.length || 0}</span>
                      <span>💬 {post.comments?.length || 0}</span>
                      <span className="post-date">
                        {new Date(post.createdAt).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric'
                        })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          
          {/* Additional Info Section */}
          <div className="profile-page-additional-info">
            <div className="info-card">
              <h3>Campus Info</h3>
              <div className="campus-details">
                <div className="campus-detail">
                  <strong>🏫 Campus:</strong>
                  <span>{user.campus || 'SIGCE Campus'}</span>
                </div>
                <div className="campus-detail">
                  <strong>👥 Connections:</strong>
                  <span>{user.connections?.length || 0}</span>
                </div>
                <div className="campus-detail">
                  <strong>📅 Member Since:</strong>
                  <span>
                    {user.createdAt 
                      ? new Date(user.createdAt).toLocaleDateString('en-US', {
                          month: 'long',
                          year: 'numeric'
                        })
                      : 'Recently'
                    }
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;