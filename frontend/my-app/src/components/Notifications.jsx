// src/components/Notifications.jsx
import React, { useEffect, useState } from "react";
import { getSocket } from "./NotificationBell";
import Toast from "./Toast";
import { useNavigate } from "react-router-dom";
import "../styles/Notifications.css";
// Import search component and styles
import ExploreSearch from "./ExploreSearch";
import "../styles/ExploreSearch.css";

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [notifCount, setNotifCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  const [user, setUser] = useState(null);
  const navigate = useNavigate();

  const token = localStorage.getItem("token");

  // 🔊 Notification Sound
  const notificationSound = new Audio("/sounds/notify.mp3");

  useEffect(() => {
    if (!token) return;

    // Fetch user profile
    fetchUserProfile();

    // Load notifications
    fetch("http://localhost:5000/api/notifications/me", {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        setNotifications(data || []);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });

    // Socket listener
    const socket = getSocket();
    if (socket) {
      socket.on("new_notification", (payload) => {
        // Add to top
        setNotifications(prev => [
          { ...payload, animation: true },
          ...prev
        ]);

        // Update notification count
        setNotifCount(prev => prev + 1);

        // Play sound
        notificationSound.play().catch(() => {});

        // Show toast
        setToast(payload);

        // auto-hide toast after 4s
        setTimeout(() => setToast(null), 4000);
      });

      // Fetch initial notification count
      const fetchInitialCount = async () => {
        try {
          const response = await fetch("http://localhost:5000/api/notifications/unread/count", {
            headers: { Authorization: `Bearer ${token}` }
          });
          const data = await response.json();
          setNotifCount(data.count || 0);
        } catch (error) {
          console.error("Failed to fetch notification count:", error);
        }
      };
      fetchInitialCount();
    }

    return () => {
      if (socket) socket.off("new_notification");
    };
  }, [token]);

  // Fetch user profile
  const fetchUserProfile = async () => {
    try {
      const res = await fetch("http://localhost:5000/api/auth/profile", {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setUser(data);
    } catch (err) {
      console.error("Error fetching user profile:", err);
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
      
      // Update notification count
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

      // Check if notification was unread to update count
      const notification = notifications.find(n => n.id === id);
      if (notification && !notification.read) {
        setNotifCount(prev => Math.max(0, prev - 1));
      }

      // smooth fade out
      setNotifications(prev =>
        prev.map(n =>
          n.id === id ? { ...n, deleting: true } : n
        )
      );

      setTimeout(() => {
        setNotifications(prev => prev.filter(n => n.id !== id));
      }, 300); // match CSS fade-out duration
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

const handleNotificationClick = async (notification) => {
  // Mark as read first
  if (!notification.read) {
    await markAsRead(notification.id);
  }

  console.log("🎯 [Notifications] Clicked notification:", {
    type: notification.type,
    postId: notification.postId,
    message: notification.message
  });

  // ============ CHECK IF IT'S A CONNECTION REQUEST ============
  if (notification.type === 'connection_request' || 
      notification.message?.toLowerCase().includes('connection request') ||
      notification.message?.toLowerCase().includes('sent you a connection')) {
    
    console.log("👥 [Notifications] Connection request - Navigating to Network/Received");
    
    // Navigate to Network with 'received' tab active
    navigate('/network?tab=received');
    return;
  }

  // If notification has a postId, navigate to feed and highlight the post
  if (notification.postId) {
    console.log("🎯 [Notifications] Navigating to post:", notification.postId);
    
    // Store highlighted post data in localStorage with expiration
    const highlightData = {
      postId: notification.postId,
      timestamp: Date.now(),
      from: 'notification',
      notificationId: notification.id,
      expiresAt: Date.now() + 15000, // 15 seconds expiration
      postContent: notification.message || "Notification post",
      userName: notification.userName || "User"
    };
    
    // Use a DIFFERENT key to avoid conflict with search highlights
    localStorage.setItem('notificationHighlight', JSON.stringify(highlightData));
    
    // Navigate to feed
    navigate('/feed');
    
    // Dispatch event for Feed.jsx to catch
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('notificationHighlight', {
        detail: { postId: notification.postId, from: 'notification' }
      }));
    }, 100);
  }
  
  // If notification has a link field, navigate to that link
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
    // Already on notifications page, just reset count
    setNotifCount(0);
    setToast(null);
  };

  // Handler for user selected from search
  const handleUserSelectFromSearch = (selectedUser) => {
    if (selectedUser && selectedUser._id) {
      navigate(`/profile/${selectedUser._id}`); 
    }
  };

  if (loading) {
    return (
      <div className="feed-container">
        {/* Header component - Single instance */}
        <Header 
          user={user}
          notifCount={notifCount}
          handleClickNotification={handleClickNotification}
          handleLogout={handleLogout}
          handleUserSelectFromSearch={handleUserSelectFromSearch}
          navigate={navigate}
          getUserAvatar={getUserAvatar}
        />
        
        <div className="notif-loading-container">
          <div className="notif-spinner"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="feed-container">
      {/* Header component - Single instance */}
      <Header 
        user={user}
        notifCount={notifCount}
        handleClickNotification={handleClickNotification}
        handleLogout={handleLogout}
        handleUserSelectFromSearch={handleUserSelectFromSearch}
        navigate={navigate}
        getUserAvatar={getUserAvatar}
      />

      <div className="notifications-container">
        <div className="notifications-header">
          <h2 className="notifications-title">Notifications</h2>
          <div style={{ display: "flex", gap: 12 }}>
            <button className="feature-btn" onClick={markAll}>
              Mark all read
            </button>
          </div>
        </div>

        {notifications.length === 0 ? (
          <div className="notifications-empty">
            <div className="empty-icon">🔔</div>
            <h3>No Notifications Yet</h3>
            <p>We'll notify you when someone interacts with your posts.</p>
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
                      <span>{n.userName?.charAt(0)}</span>
                    )}
                  </div>

                  <div className="notif-info">
                    <p className="notif-text">
                      <strong>{n.userName}</strong> {n.message}
                    </p>
                    <span className="notif-time">{n.timeAgo}</span>
                    
                    {/* Show click hint if it's a post notification */}
                    {n.postId && (
                      <span className="click-hint">
                        Click to view post →
                      </span>
                    )}
                  </div>
                </div>

                {/* Delete Button */}
                <button
                  className="notif-delete-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteNotification(n.id);
                  }}
                >
                  ✕
                </button>

                {n.postId && (
                  <div className="notif-thumbnail">
                    <img
                      src={n.postImage || "/default-post-thumb.png"}
                      alt="post"
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <Toast notification={toast} onClose={() => setToast(null)} />
      </div>
    </div>
  );
}

// Reusable Header Component
function Header({ user, notifCount, handleClickNotification, handleLogout, handleUserSelectFromSearch, navigate, getUserAvatar }) {
  return (
    <header className="feed-header">
      <div className="header-left">
        <div className="logo" onClick={() => navigate("/feed")}>💼 Swish</div>
        
        {/* SEARCH BAR */}
        <div className="feed-search-wrapper">
          <ExploreSearch onUserSelect={handleUserSelectFromSearch} />
        </div>

        <div className="nav-items">
          <button className="nav-btn" onClick={() => navigate("/feed")}>🏠 Feed</button>
          <button className="nav-btn" onClick={() => navigate("/profile")}>👤 Profile</button>
          <button className="nav-btn" onClick={() => navigate("/network")}>👥 Network</button>
          <button className="nav-btn" onClick={() => navigate("/Explore")}>🔥 Explore</button>
          
          <button 
            className={`nav-btn notification-bell-btn active`}
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
          <span className="user-name">Welcome, {user?.name || "User"}</span>
          <div 
            className="user-avatar" 
            title="View Profile"
            onClick={() => navigate("/profile")}
          >
            {getUserAvatar(user)}
          </div>
        </div>
        
        {/* Admin button - Only show if user is admin */}
        {user?.role === 'admin' && (
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
  );
}