// src/components/Notifications.jsx - LinkedIn Style Dark Theme (ENHANCED VERSION)
import React, { useEffect, useState } from "react";
import { getSocket } from "./NotificationBell";
import Toast from "./Toast";
import { useNavigate } from "react-router-dom";
import "../styles/Notifications.css";
import ExploreSearch from "./ExploreSearch";
import "../styles/ExploreSearch.css";

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [notifCount, setNotifCount] = useState(0);
  const [user, setUser] = useState(null);
  const [trendingEvents, setTrendingEvents] = useState([]);
  const [suggestedUsers, setSuggestedUsers] = useState([]);
  const [connections, setConnections] = useState([]);
  const [showModal, setShowModal] = useState(null); // Connection modal
  const [userPostsCount, setUserPostsCount] = useState(0);
  const navigate = useNavigate();

  const token = localStorage.getItem("token");

  // 🔊 Notification Sound
  const notificationSound = new Audio("/sounds/notify.mp3");

  useEffect(() => {
    if (!token) {
      navigate("/login");
      return;
    }

    // Load all data
    fetchUserProfile();
    fetchNotifications();
    fetchTrendingEvents();
    fetchConnections();
    fetchUserPostsCount();

    // Socket listener
    const socket = getSocket();
    if (socket) {
      socket.on("new_notification", (payload) => {
        setNotifications(prev => [{ ...payload, animation: true }, ...prev]);
        setNotifCount(prev => prev + 1);
        notificationSound.play().catch(() => {});
        setToast(payload);
        setTimeout(() => setToast(null), 4000);
      });

      fetchNotificationCount();
    }

    return () => {
      if (socket) socket.off("new_notification");
    };
  }, [token, navigate]);

  // Fetch user profile
  const fetchUserProfile = async () => {
    try {
      const res = await fetch("http://localhost:5000/api/auth/profile", {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setUser(data);
      
      // After user is fetched, get suggested users
      setTimeout(() => {
        fetchSuggestedUsers();
      }, 500);
    } catch (err) {
      console.error("Error fetching user profile:", err);
    }
  };

  // Fetch notifications
  const fetchNotifications = async () => {
    try {
      const res = await fetch("http://localhost:5000/api/notifications/me", {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setNotifications(data || []);
      setLoading(false);
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };

  // Fetch notification count
  const fetchNotificationCount = async () => {
    try {
      const res = await fetch("http://localhost:5000/api/notifications/unread/count", {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setNotifCount(data.count || 0);
    } catch (error) {
      console.error("Failed to fetch notification count:", error);
    }
  };

  // Fetch trending events
  const fetchTrendingEvents = async () => {
    try {
      const res = await fetch("http://localhost:5000/api/explore/trending?limit=4", {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      
      // Filter only event posts and take max 3
      const events = data
        .filter(post => post.type === 'event')
        .slice(0, 3)
        .map(event => ({
          _id: event._id,
          title: event.content?.slice(0, 50) + '...' || event.event?.title || 'Event',
          date: event.event?.date || 'Soon',
          going: event.event?.attendees?.length || 0
        }));
      
      setTrendingEvents(events);
    } catch (err) {
      console.error("Error fetching trending events:", err);
      setTrendingEvents([]);
    }
  };

  // Fetch user's connections
  const fetchConnections = async () => {
    try {
      const res = await fetch("http://localhost:5000/api/network/connections", {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setConnections(data.connections || []);
    } catch (err) {
      console.error("Error fetching connections:", err);
      setConnections([]);
    }
  };

  // Fetch user's posts count
  const fetchUserPostsCount = async () => {
    try {
      const res = await fetch(`http://localhost:5000/api/users/${user?._id}/posts/count`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setUserPostsCount(data.count || 0);
    } catch (err) {
      console.error("Error fetching posts count:", err);
    }
  };

  // Fetch suggested users (NOT in my network)
  const fetchSuggestedUsers = async () => {
    try {
      // First get all users
      const res = await fetch("http://localhost:5000/api/users", {
        headers: { Authorization: `Bearer ${token}` }
      });
      const allUsers = await res.json();
      
      // Get my connections IDs
      const connectionIds = connections.map(conn => conn._id?.toString() || conn.toString());
      const myId = user?._id?.toString();
      
      // Filter: NOT me, NOT already connected
      const suggestions = allUsers
        .filter(u => {
          const userId = u._id?.toString() || u.toString();
          const isMe = userId === myId;
          const isConnected = connectionIds.includes(userId);
          return !isMe && !isConnected;
        })
        .slice(0, 4);
      
      setSuggestedUsers(suggestions);
    } catch (err) {
      console.error("Error fetching suggested users:", err);
      setSuggestedUsers([]);
    }
  };

  // MARK ONE AS READ
  const markAsRead = async (id) => {
    try {
      await fetch(`http://localhost:5000/api/notifications/${id}/read`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` }
      });

      setNotifications(prev =>
        prev.map(n =>
          n.id === id ? { ...n, read: true } : n
        )
      );
      
      setNotifCount(prev => Math.max(0, prev - 1));
    } catch (err) {
      console.error(err);
    }
  };

  // DELETE ONE
  const deleteNotification = async (id) => {
    try {
      await fetch(`http://localhost:5000/api/notifications/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });

      const notification = notifications.find(n => n.id === id);
      if (notification && !notification.read) {
        setNotifCount(prev => Math.max(0, prev - 1));
      }

      setNotifications(prev =>
        prev.map(n =>
          n.id === id ? { ...n, deleting: true } : n
        )
      );

      setTimeout(() => {
        setNotifications(prev => prev.filter(n => n.id !== id));
      }, 300);
    } catch (err) {
      console.error(err);
    }
  };

  // MARK ALL
  const markAll = async () => {
    try {
      await fetch("http://localhost:5000/api/notifications/read-all", {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` }
      });

      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setNotifCount(0);
    } catch (err) {
      console.error(err);
    }
  };

  // Handle notification click
  const handleNotificationClick = async (notification) => {
    if (!notification.read) {
      await markAsRead(notification.id);
    }

    // Connection request
    if (notification.type === 'connection_request' || 
        notification.message?.toLowerCase().includes('connection request')) {
      navigate('/network?tab=received');
      return;
    }

    // Post notification
    if (notification.postId) {
      const highlightData = {
        postId: notification.postId,
        timestamp: Date.now(),
        from: 'notification',
        notificationId: notification.id,
        expiresAt: Date.now() + 15000,
        postContent: notification.message || "Notification post",
        userName: notification.userName || "User"
      };
      
      localStorage.setItem('notificationHighlight', JSON.stringify(highlightData));
      navigate('/feed');
      
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('notificationHighlight', {
          detail: { postId: notification.postId, from: 'notification' }
        }));
      }, 100);
    }
    
    // Link notification
    else if (notification.link) {
      navigate(notification.link);
    }
  };

  // Handle logout
  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/login");
  };

  // Get user avatar
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
    return <span className="avatar-initial">{userData?.name?.charAt(0).toUpperCase() || "U"}</span>;
  };

  // Handle notification bell click
  const handleClickNotification = () => {
    setNotifCount(0);
    setToast(null);
  };

  // Handle user select from search
  const handleUserSelectFromSearch = (selectedUser) => {
    if (selectedUser && selectedUser._id) {
      navigate(`/profile/${selectedUser._id}`); 
    }
  };

  // Handle connect button click (opens modal)
  const handleConnectClick = (userData) => {
    setShowModal({
      userId: userData._id,
      userName: userData.name,
      userRole: userData.role,
      userAvatar: userData.profilePhoto,
      userDept: userData.department || 'SIGCE'
    });
  };

  // Send connection request (from modal)
  const sendConnectionRequest = async () => {
    if (!showModal) return;
    
    try {
      const res = await fetch(`http://localhost:5000/api/network/request/${showModal.userId}`, {
        method: "POST",
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      });
      const data = await res.json();
      
      if (res.ok) {
        // Remove from suggested users
        setSuggestedUsers(prev => prev.filter(u => u._id !== showModal.userId));
        setShowModal(null);
        
        // Show success toast
        setToast({
          message: `Connection request sent to ${showModal.userName}!`,
          type: 'success',
          userName: showModal.userName
        });
        setTimeout(() => setToast(null), 3000);
      } else {
        setToast({
          message: data.message || "Failed to send request",
          type: 'error'
        });
        setTimeout(() => setToast(null), 3000);
      }
    } catch (err) {
      console.error("Error sending connection request:", err);
      setToast({
        message: "Network error. Please try again.",
        type: 'error'
      });
      setTimeout(() => setToast(null), 3000);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="notifications-layout">
        <Header 
          user={user}
          notifCount={notifCount}
          handleClickNotification={handleClickNotification}
          handleLogout={handleLogout}
          handleUserSelectFromSearch={handleUserSelectFromSearch}
          navigate={navigate}
          getUserAvatar={getUserAvatar}
        />
        
        <div className="layout-container">
          <div className="sidebar left-sidebar loading">
            <div className="profile-skeleton">
              <div className="skeleton-avatar"></div>
              <div className="skeleton-line"></div>
              <div className="skeleton-line short"></div>
            </div>
          </div>

          <div className="main-content notif-loading-container">
            <div className="notif-spinner"></div>
          </div>

          <div className="sidebar right-sidebar loading">
            <div className="trending-skeleton">
              <div className="skeleton-line"></div>
              <div className="skeleton-line short"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="notifications-layout">
      <Header 
        user={user}
        notifCount={notifCount}
        handleClickNotification={handleClickNotification}
        handleLogout={handleLogout}
        handleUserSelectFromSearch={handleUserSelectFromSearch}
        navigate={navigate}
        getUserAvatar={getUserAvatar}
      />

      <div className="layout-container">
        {/* ========== ENHANCED LEFT SIDEBAR ========== */}
        <div className="sidebar left-sidebar">
          <div className="profile-mini-card" onClick={() => navigate("/profile")}>
            <div className="mini-avatar">
              {getUserAvatar(user)}
            </div>
            <div className="mini-info">
              <h4>{user?.name || "User"}</h4>
              <p className="mini-title">
                {user?.role === 'student' ? `🎓 ${user?.department || 'Student'}` : 
                 user?.role === 'faculty' ? `👨‍🏫 ${user?.department || 'Faculty'}` : 
                 user?.role === 'admin' ? '👑 Administrator' : '👤 Member'}
              </p>
              <p className="mini-bio">
                {user?.bio?.slice(0, 80) || "Welcome to Swish! Connect with your college community."}
              </p>
            </div>
            <div className="mini-stats">
              <div className="stats-grid">
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="quick-actions-card">
            <h3 className="sidebar-title">
              <span>⚡ Quick Actions</span>
            </h3>
            <div className="quick-actions-grid">
              <button className="quick-action-btn" onClick={() => navigate("/feed?create=true")}>
                <span className="action-icon">✏️</span>
                <span>Create Post</span>
              </button>
              <button className="quick-action-btn" onClick={() => navigate("/explore")}>
                <span className="action-icon">🔍</span>
                <span>Find People</span>
              </button>
              <button className="quick-action-btn" onClick={() => navigate("/network")}>
                <span className="action-icon">👥</span>
                <span>My Network</span>
              </button>
              <button className="quick-action-btn" onClick={() => navigate("/explore?tab=events")}>
                <span className="action-icon">📅</span>
                <span>Events</span>
              </button>
            </div>
          </div>
        </div>

        {/* ========== MIDDLE: NOTIFICATIONS ========== */}
        <div className="main-content">
          <div className="notifications-container">
            <div className="notifications-header">
              <h2 className="notifications-title">
                Notifications
                {notifCount > 0 && <span className="title-badge">{notifCount} new</span>}
              </h2>
              <div className="header-actions">
                <button className="feature-btn" onClick={markAll}>
                  Mark all read
                </button>
              </div>
            </div>

            {notifications.length === 0 ? (
              <div className="notifications-empty">
                <div className="empty-icon">🔔</div>
                <h3>No Notifications Yet</h3>
                <p>When someone interacts with your posts, you'll see it here.</p>
              </div>
            ) : (
              <div className="notifications-list">
                {notifications.map(n => (
                  <div
                    key={n.id}
                    className={`notification-card 
                      ${!n.read ? "unread" : ""} 
                      ${n.animation ? "notif-slide-in" : ""} 
                      ${n.deleting ? "notif-fade-out" : ""}
                    `}
                    onClick={() => handleNotificationClick(n)}
                    style={{ cursor: n.postId || n.link ? 'pointer' : 'default' }}
                  >
                    <div className="notif-left">
                      <div className="notif-avatar">
                        {n.userImage ? (
                          <img src={n.userImage} alt={n.userName} />
                        ) : (
                          <span>{n.userName?.charAt(0) || "A"}</span>
                        )}
                      </div>

                      <div className="notif-info">
                        <p className="notif-text">
                          <strong>{n.userName || "Someone"}</strong> {n.message}
                        </p>
                        <div className="notif-meta">
                          <span className="notif-time">{n.timeAgo || "Just now"}</span>
                          <span className="notif-type">{n.type?.replace('_', ' ')}</span>
                        </div>
                        
                        {n.postId && (
                          <span className="click-hint">
                            Click to view post →
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="notif-actions">
                      {!n.read && (
                        <button
                          className="mark-read-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            markAsRead(n.id);
                          }}
                          title="Mark as read"
                        >
                          ✓
                        </button>
                      )}
                      <button
                        className="notif-delete-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteNotification(n.id);
                        }}
                        title="Delete"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ========== RIGHT SIDEBAR ========== */}
        <div className="sidebar right-sidebar">
          {/* Trending Events */}
          {trendingEvents.length > 0 && (
            <div className="trending-card">
              <h3 className="sidebar-title">
                <span>🔥 Trending Events</span>
              </h3>
              
              <div className="trending-list">
                {trendingEvents.map(event => (
                  <div key={event._id} className="trending-item" onClick={() => navigate(`/post/${event._id}`)}>
                    <div className="trending-info">
                      <h4>{event.title}</h4>
                      <p className="trending-meta">
                        <span>📅 {event.date}</span>
                        <span>👥 {event.going} going</span>
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              <button 
                className="view-all-btn"
                onClick={() => navigate("/explore?tab=events")}
              >
                View all events →
              </button>
            </div>
          )}

          {/* Suggested Connections */}
          {suggestedUsers.length > 0 && (
            <div className="suggestions-card">
              <h3 className="sidebar-title">
                <span>👥 Suggested for you</span>
              </h3>
              
              <div className="suggestions-list">
                {suggestedUsers.map(suggested => (
                  <div key={suggested._id} className="suggestion-item">
                    <div className="suggestion-avatar">
                      {suggested.profilePhoto ? (
                        <img src={suggested.profilePhoto} alt={suggested.name} />
                      ) : (
                        <span>{suggested.name?.charAt(0) || "U"}</span>
                      )}
                    </div>
                    <div className="suggestion-info">
                      <h4>{suggested.name}</h4>
                      <p className="suggestion-meta">
                        {suggested.role} • {suggested.department || 'SIGCE'}
                      </p>
                    </div>
                    <button 
                      className="connect-btn"
                      onClick={() => handleConnectClick(suggested)}
                    >
                      Connect
                    </button>
                  </div>
                ))}
              </div>

              <button 
                className="view-all-btn"
                onClick={() => navigate("/network")}
              >
                Grow your network →
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Connection Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(null)}>
          <div className="connection-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-avatar">
                {showModal.userAvatar ? (
                  <img src={showModal.userAvatar} alt={showModal.userName} />
                ) : (
                  <span>{showModal.userName?.charAt(0).toUpperCase()}</span>
                )}
              </div>
              <div className="modal-info">
                <h3>{showModal.userName}</h3>
                <p>
                  {showModal.userRole === 'student' ? '🎓 Student' : 
                   showModal.userRole === 'faculty' ? '👨‍🏫 Faculty' : '👤 Member'}
                  {showModal.userDept && ` • ${showModal.userDept}`}
                </p>
              </div>
            </div>
            
            <div className="modal-message">
              <p>Send a connection request to <strong>{showModal.userName}</strong>?</p>
              <p style={{ fontSize: '0.9rem', marginTop: '8px' }}>
                Once accepted, you'll see each other's posts and activities.
              </p>
            </div>
            
            <div className="modal-actions">
              <button className="modal-btn cancel" onClick={() => setShowModal(null)}>
                Cancel
              </button>
              <button className="modal-btn confirm" onClick={sendConnectionRequest}>
                Send Request
              </button>
            </div>
          </div>
        </div>
      )}

      <Toast notification={toast} onClose={() => setToast(null)} />
    </div>
  );
}

// ========== HEADER COMPONENT ==========
function Header({ user, notifCount, handleClickNotification, handleLogout, handleUserSelectFromSearch, navigate, getUserAvatar }) {
  return (
    <header className="notifications-header-bar">
      <div className="header-left">
        <div className="logo" onClick={() => navigate("/feed")}>
          <span className="logo-icon">💼</span>
          <span className="logo-text">Swish</span>
        </div>
        
        <div className="feed-search-wrapper">
          <ExploreSearch onUserSelect={handleUserSelectFromSearch} />
        </div>

        <div className="nav-items">
          <button className="nav-btn" onClick={() => navigate("/feed")}>
            <span className="nav-icon">🏠</span>
            <span className="nav-text">Feed</span>
          </button>
          <button className="nav-btn" onClick={() => navigate("/profile")}>
            <span className="nav-icon">👤</span>
            <span className="nav-text">Profile</span>
          </button>
          <button className="nav-btn" onClick={() => navigate("/network")}>
            <span className="nav-icon">👥</span>
            <span className="nav-text">Network</span>
          </button>
          <button className="nav-btn" onClick={() => navigate("/explore")}>
            <span className="nav-icon">🔥</span>
            <span className="nav-text">Explore</span>
          </button>
          
          <button 
            className={`nav-btn notification-bell-btn active`}
            onClick={handleClickNotification}
            title="Notifications"
          >
            <span className="nav-icon">🔔</span>
            <span className="nav-text">Notifications</span>
          </button>
        </div>
      </div>
      <div className="header-right">
        {user?.role === 'admin' && (
          <button 
            className="admin-btn"
            onClick={() => navigate("/admin")}
          >
            <span className="admin-icon">👑</span>
            <span>Admin</span>
          </button>
        )}
        
        <div className="user-info">
          <div 
            className="user-avatar" 
            title="View Profile"
            onClick={() => navigate("/profile")}
          >
            {getUserAvatar(user)}
          </div>
        </div>
        
        <button className="logout-btn" onClick={handleLogout}>
          <span className="logout-icon">🚪</span>
          <span>Logout</span>
        </button>
      </div>
    </header>
  );
}