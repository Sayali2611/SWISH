// src/components/Notifications.jsx
import React, { useEffect, useState } from "react";
import { getSocket } from "./NotificationBell";
import Toast from "./Toast";
import { useNavigate } from "react-router-dom";
import "../styles/Notifications.css";

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const navigate = useNavigate();

  const token = localStorage.getItem("token");

  // 🔊 Notification Sound
  const notificationSound = new Audio("/sounds/notify.mp3");

  useEffect(() => {
    if (!token) return;

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

        // Play sound
        notificationSound.play().catch(() => {});

        // Show toast
        setToast(payload);

        // auto-hide toast after 4s
        setTimeout(() => setToast(null), 4000);
      });
    }

    return () => {
      if (socket) socket.off("new_notification");
    };
  }, [token]);

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
    } catch (err) {
      console.error(err);
    }
  };

  // HANDLE NOTIFICATION CLICK
  const handleNotificationClick = async (notification) => {
    // Mark as read first
    if (!notification.read) {
      await markAsRead(notification.id);
    }

    // If notification has a postId, navigate to feed and highlight the post
    if (notification.postId) {
      console.log("🎯 [Notifications] Navigating to post:", notification.postId);
      
      // Store highlighted post data in localStorage (similar to search)
      const highlightData = {
        postId: notification.postId,
        timestamp: Date.now(),
        from: 'notification',
        notificationId: notification.id,
        postContent: notification.message || "Notification post",
        userName: notification.userName || "User"
      };
      
      localStorage.setItem('searchHighlightedPost', JSON.stringify(highlightData));
      sessionStorage.setItem('highlightedPostId', notification.postId);
      
      // Trigger feed highlight via custom event
      window.dispatchEvent(new Event('feedHighlight'));
      window.dispatchEvent(new Event('refreshFeed'));
      
      // Small delay to ensure storage is updated
      setTimeout(() => {
        // Navigate to feed with highlight parameter
        navigate(`/feed?highlight=${notification.postId}`);
        
        // Also dispatch a global event for Feed.jsx to catch
        window.dispatchEvent(new CustomEvent('feedHighlight', {
          detail: { postId: notification.postId, from: 'notification' }
        }));
      }, 100);
    }
    
    // If notification has a link field, navigate to that link
    else if (notification.link) {
      navigate(notification.link);
    }
  };

  if (loading)
    return (
      <div className="notif-loading-container">
        <div className="notif-spinner"></div>
      </div>
    );

  return (
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
  );
}