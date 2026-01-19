import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import ExploreSearch from '../components/ExploreSearch';
import "../styles/Navbar.css";

const Navbar = () => {
  const [user, setUser] = useState(null);
  const [notifCount, setNotifCount] = useState(0);
  const navigate = useNavigate();
  const location = useLocation();
  
  const token = localStorage.getItem('token');
  const authHeader = { headers: { Authorization: `Bearer ${token}` } };

  useEffect(() => {
    fetchUserProfile();
    fetchNotificationCount();
  }, []);

  const fetchUserProfile = async () => {
    try {
      const res = await axios.get(`${import.meta.env.VITE_API_URL}/api/auth/profile`, authHeader);
      setUser(res.data);
    } catch (err) {
      console.error("Error fetching user profile:", err);
    }
  };

  const fetchNotificationCount = async () => {
    try {
      const res = await axios.get(`${import.meta.env.VITE_API_URL}/api/notifications/unread/count`, authHeader);
      setNotifCount(res.data.count || 0);
    } catch (err) {
      console.error("Error fetching notification count:", err);
    }
  };

  const handleLogout = () => {
    localStorage.clear();
    navigate('/login');
  };

  const getUserAvatar = (userObj) => (
    userObj?.profilePhoto ? 
      <img src={userObj.profilePhoto} alt={userObj.name} className="user-avatar-img" /> :
      <div className="avatar-initial">{userObj?.name?.charAt(0).toUpperCase() || "U"}</div>
  );

  return (
    <header className="notifications-header-bar">
      <div className="header-left">
        <div className="logo" onClick={() => navigate('/feed')}>
          <span className="logo-icon">💼</span>
          <span className="logo-text">Swish</span>
        </div>
        
        <div className="feed-search-wrapper">
          <ExploreSearch onUserSelect={(selectedUser) => selectedUser?._id && navigate(`/profile/${selectedUser._id}`)} />
        </div>

        <div className="nav-items">
          <button 
            className={`nav-btn ${location.pathname === '/feed' ? 'active' : ''}`} 
            onClick={() => navigate('/feed')}
          >
            <span className="nav-icon">🏠</span>
            <span className="nav-text">Feed</span>
          </button>
          <button 
            className={`nav-btn ${location.pathname === '/profile' ? 'active' : ''}`} 
            onClick={() => navigate('/profile')}
          >
            <span className="nav-icon">👤</span>
            <span className="nav-text">Profile</span>
          </button>
          <button 
            className={`nav-btn ${location.pathname === '/network' ? 'active' : ''}`} 
            onClick={() => navigate('/network')}
          >
            <span className="nav-icon">👥</span>
            <span className="nav-text">Network</span>
          </button>
          <button 
            className={`nav-btn ${location.pathname === '/explore' ? 'active' : ''}`} 
            onClick={() => navigate('/explore')}
          >
            <span className="nav-icon">🔥</span>
            <span className="nav-text">Explore</span>
          </button>
          <button 
            className={`nav-btn notification-bell-btn ${location.pathname === '/notifications' ? 'active' : ''}`}
            onClick={() => navigate('/notifications')}
            title="Notifications"
          >
            <span className="nav-icon">🔔</span>
            <span className="nav-text">Notifications</span>
            {notifCount > 0 && <span className="notification-badge">{notifCount}</span>}
          </button>
        </div>
      </div>
      
      <div className="header-right">
        {user?.role === 'admin' && (
          <button 
            className="admin-btn"
            onClick={() => navigate('/admin')}
          >
            <span className="admin-icon">👑</span>
            <span>Admin</span>
          </button>
        )}
        
        <div className="user-info" onClick={() => navigate('/profile')}>
          <div 
            className="user-avatar" 
            title="View Profile"
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
};

export default Navbar;