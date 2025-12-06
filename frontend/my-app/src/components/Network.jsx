import React, { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

function Network() {
  const [users, setUsers] = useState([]);
  const [incoming, setIncoming] = useState([]);
  const [outgoing, setOutgoing] = useState([]);
  const [connections, setConnections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [notifCount, setNotifCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  
  const navigate = useNavigate();
  const token = localStorage.getItem("token");

  const authHeader = {
    headers: { Authorization: `Bearer ${token}` }
  };

  useEffect(() => {
    fetchUserProfile();
    fetchAllData();
    fetchNotificationCount();
  }, []);

  // Fetch user profile
  const fetchUserProfile = async () => {
    try {
      const res = await axios.get("http://localhost:5000/api/auth/profile", authHeader);
      setUser(res.data);
    } catch (err) {
      console.error("Error fetching user profile:", err);
    }
  };

  // Fetch notification count
  const fetchNotificationCount = async () => {
    try {
      const res = await axios.get("http://localhost:5000/api/notifications/unread/count", authHeader);
      setNotifCount(res.data.count || 0);
    } catch (err) {
      console.error("Error fetching notification count:", err);
    }
  };

  // Handle notification click
  const handleClickNotification = () => {
    navigate("/notifications");
  };

  // Handle logout
  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/login");
  };

  // Get user avatar
  const getUserAvatar = (user) => {
    if (user?.profilePhoto) {
      return (
        <img 
          src={user.profilePhoto} 
          alt={user.name}
          style={{ width: "40px", height: "40px", borderRadius: "50%", objectFit: "cover" }}
        />
      );
    }
    return <span style={{ fontSize: "20px" }}>👤</span>;
  };

  // Fetch all network data
  const fetchAllData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchUsers(),
        fetchIncomingRequests(),
        fetchOutgoingRequests(),
        fetchConnections()
      ]);
    } catch (err) {
      console.error("Error fetching network data:", err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch all users
  const fetchUsers = async () => {
    try {
      const res = await axios.get("http://localhost:5000/api/users", authHeader);
      setUsers(res.data || []);
    } catch (err) {
      console.error("Error fetching users:", err);
    }
  };

  // Fetch incoming requests
  const fetchIncomingRequests = async () => {
    try {
      const res = await axios.get(
        "http://localhost:5000/api/network/requests/received",
        authHeader
      );
      setIncoming(res.data?.requests || []);
    } catch (err) {
      console.error("Error fetching incoming requests:", err);
    }
  };

  // Fetch outgoing requests
  const fetchOutgoingRequests = async () => {
    try {
      const res = await axios.get(
        "http://localhost:5000/api/network/requests/sent",
        authHeader
      );
      setOutgoing(res.data?.requests || []);
    } catch (err) {
      console.error("Error fetching outgoing requests:", err);
    }
  };

  // Fetch accepted connections
  const fetchConnections = async () => {
    try {
      const res = await axios.get(
        "http://localhost:5000/api/network/connections",
        authHeader
      );
      setConnections(res.data?.connections || []);
    } catch (err) {
      console.error("Error fetching connections:", err);
    }
  };

  // Send request
  const sendRequest = async (id) => {
    try {
      await axios.post(
        `http://localhost:5000/api/network/request/${id}`,
        {},
        authHeader
      );
      alert("Request Sent!");
      fetchAllData();
    } catch (err) {
      alert(err.response?.data?.message || "Error sending request");
    }
  };

  // Accept request
  const acceptRequest = async (id) => {
    try {
      await axios.post(
        `http://localhost:5000/api/network/accept/${id}`,
        {},
        authHeader
      );
      alert("Request Accepted!");
      fetchAllData();
    } catch (err) {
      alert(err.response?.data?.message || "Error accepting request");
    }
  };

  // Reject request
  const rejectRequest = async (id) => {
    try {
      await axios.post(
        `http://localhost:5000/api/network/reject/${id}`,
        {},
        authHeader
      );
      alert("Request Rejected");
      fetchAllData();
    } catch (err) {
      alert(err.response?.data?.message || "Error rejecting request");
    }
  };

  // Cancel sent request
  const cancelRequest = async (id) => {
    try {
      await axios.post(
        `http://localhost:5000/api/network/cancel/${id}`,
        {},
        authHeader
      );
      alert("Request Cancelled");
      fetchAllData();
    } catch (err) {
      alert(err.response?.data?.message || "Error cancelling request");
    }
  };

  // Check status
  const isOutgoing = (id) => {
    if (!Array.isArray(outgoing)) return false;
    return outgoing.some((u) => u._id === id);
  };
  
  const isIncoming = (id) => {
    if (!Array.isArray(incoming)) return false;
    return incoming.some((u) => u._id === id);
  };
  
  const isConnected = (id) => {
    if (!Array.isArray(connections)) return false;
    return connections.some((u) => u._id === id);
  };

  const removeConnection = async (id) => {
    if (window.confirm("Are you sure you want to remove this connection?")) {
      try {
        await axios.post(
          `http://localhost:5000/api/network/remove/${id}`,
          {},
          authHeader
        );
        alert("Connection removed!");
        fetchAllData();
      } catch (err) {
        alert(err.response?.data?.message || "Error removing connection");
      }
    }
  };

  if (loading && !user) {
    return <div style={{ padding: "20px" }}>Loading...</div>;
  }

  return (
    <div>
      {/* Header */}
      <header className="feed-header" style={{
        background: "white",
        borderBottom: "1px solid #e0e0e0",
        padding: "15px 20px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        position: "sticky",
        top: 0,
        zIndex: 1000
      }}>
        <div className="header-left" style={{ display: "flex", alignItems: "center", gap: "30px" }}>
          <div className="logo" style={{ 
            fontSize: "24px", 
            fontWeight: "bold", 
            background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent"
          }}>💼 CampusConnect</div>
          <div className="nav-items" style={{ display: "flex", gap: "10px" }}>
            <button 
              className="nav-btn" 
              onClick={() => navigate("/feed")}
              style={{
                background: "none",
                border: "none",
                padding: "8px 16px",
                borderRadius: "6px",
                cursor: "pointer",
                fontSize: "14px",
                fontWeight: "500"
              }}
            >🏠 Feed</button>
            <button 
              className="nav-btn" 
              onClick={() => navigate("/profile")}
              style={{
                background: "none",
                border: "none",
                padding: "8px 16px",
                borderRadius: "6px",
                cursor: "pointer",
                fontSize: "14px",
                fontWeight: "500"
              }}
            >👤 Profile</button>
            <button 
              className="nav-btn active" 
              style={{
                background: "#667eea",
                color: "white",
                border: "none",
                padding: "8px 16px",
                borderRadius: "6px",
                cursor: "pointer",
                fontSize: "14px",
                fontWeight: "600"
              }}
            >👥 Network</button>
            
            <button 
              className="nav-btn" 
              style={{
                background: "none",
                border: "none",
                padding: "8px 16px",
                borderRadius: "6px",
                cursor: "pointer",
                fontSize: "14px",
                fontWeight: "500"
              }}
            >🔍 Explore</button>
            
            {/* Notification button */}
            <button 
              className={`nav-btn notification-bell-btn ${showNotifications ? 'active-bell' : ''}`}
              onClick={handleClickNotification}
              title="Notifications"
              style={{
                background: "none",
                border: "none",
                padding: "8px 16px",
                borderRadius: "6px",
                cursor: "pointer",
                fontSize: "14px",
                fontWeight: "500",
                position: "relative"
              }}
            >
              🔔 Notifications
              {notifCount > 0 && (
                <span className="notif-badge" style={{
                  position: "absolute",
                  top: "-5px",
                  right: "5px",
                  background: "#ff4757",
                  color: "white",
                  borderRadius: "50%",
                  width: "20px",
                  height: "20px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "12px",
                  fontWeight: "bold"
                }}>{notifCount}</span>
              )}
            </button>
          </div>
        </div>
        <div className="header-right" style={{ display: "flex", alignItems: "center", gap: "15px" }}>
          <div className="user-info" style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span className="user-name" style={{ fontSize: "14px", fontWeight: "500" }}>
              Welcome, {user?.name || "User"}
            </span>
            <div 
              className="user-avatar" 
              title="View Profile"
              onClick={() => navigate("/profile")}
              style={{ cursor: "pointer" }}
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
          
          <button 
            className="logout-btn" 
            onClick={handleLogout}
            style={{
              background: "#ff6b6b",
              color: "white",
              border: "none",
              padding: "8px 16px",
              borderRadius: "6px",
              cursor: "pointer",
              fontSize: "14px",
              fontWeight: "500"
            }}
          >🚪 Logout</button>
        </div>
      </header>

      {/* Network Content */}
      <div style={{ padding: "20px", maxWidth: "1200px", margin: "0 auto" }}>
        <h1 style={{ marginBottom: "30px", color: "#333" }}>Network</h1>
        
        {/* Stats */}
        <div style={{ display: "flex", gap: "20px", marginBottom: "30px", flexWrap: "wrap" }}>
          <div style={{ 
            padding: "20px", 
            background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)", 
            borderRadius: "12px", 
            flex: "1", 
            minWidth: "200px",
            color: "white",
            boxShadow: "0 4px 6px rgba(0,0,0,0.1)"
          }}>
            <h3 style={{ margin: 0, fontSize: "16px", opacity: 0.9 }}>Connections</h3>
            <p style={{ fontSize: "36px", fontWeight: "bold", margin: "10px 0 0 0" }}>
              {Array.isArray(connections) ? connections.length : 0}
            </p>
          </div>
          <div style={{ 
            padding: "20px", 
            background: "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)", 
            borderRadius: "12px", 
            flex: "1", 
            minWidth: "200px",
            color: "white",
            boxShadow: "0 4px 6px rgba(0,0,0,0.1)"
          }}>
            <h3 style={{ margin: 0, fontSize: "16px", opacity: 0.9 }}>Received Requests</h3>
            <p style={{ fontSize: "36px", fontWeight: "bold", margin: "10px 0 0 0" }}>
              {Array.isArray(incoming) ? incoming.length : 0}
            </p>
          </div>
          <div style={{ 
            padding: "20px", 
            background: "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)", 
            borderRadius: "12px", 
            flex: "1", 
            minWidth: "200px",
            color: "white",
            boxShadow: "0 4px 6px rgba(0,0,0,0.1)"
          }}>
            <h3 style={{ margin: 0, fontSize: "16px", opacity: 0.9 }}>Sent Requests</h3>
            <p style={{ fontSize: "36px", fontWeight: "bold", margin: "10px 0 0 0" }}>
              {Array.isArray(outgoing) ? outgoing.length : 0}
            </p>
          </div>
        </div>

        {/* People You May Know */}
        <div style={{ 
          background: "white", 
          borderRadius: "12px", 
          padding: "25px", 
          marginBottom: "30px",
          boxShadow: "0 2px 10px rgba(0,0,0,0.05)"
        }}>
          <h2 style={{ margin: "0 0 20px 0", color: "#333" }}>People You May Know</h2>
          {users.length === 0 ? (
            <p style={{ color: "#666", textAlign: "center", padding: "20px" }}>No users available to connect with.</p>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "20px" }}>
              {users.map((u) => (
                <div
                  key={u._id}
                  style={{
                    border: "1px solid #e0e0e0",
                    padding: "20px",
                    borderRadius: "10px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "15px",
                    background: "#fff",
                    transition: "transform 0.2s, box-shadow 0.2s"
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = "translateY(-5px)";
                    e.currentTarget.style.boxShadow = "0 5px 15px rgba(0,0,0,0.1)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = "translateY(0)";
                    e.currentTarget.style.boxShadow = "none";
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "15px" }}>
                    <img
                      src={u.profilePhoto || "https://via.placeholder.com/50"}
                      alt={u.name}
                      style={{
                        width: "60px",
                        height: "60px",
                        borderRadius: "50%",
                        objectFit: "cover"
                      }}
                    />
                    <div style={{ flex: 1 }}>
                      <h3 style={{ margin: "0 0 5px 0", fontSize: "18px" }}>{u.name}</h3>
                      <p style={{ margin: "0 0 5px 0", color: "#666", fontSize: "14px" }}>
                        {u.role} • {u.department || "No department"}
                      </p>
                    </div>
                  </div>
                  
                  {u.bio && (
                    <p style={{ margin: "0", fontSize: "14px", color: "#777", lineHeight: "1.5" }}>
                      {u.bio.length > 100 ? u.bio.substring(0, 100) + "..." : u.bio}
                    </p>
                  )}
                  
                  {u.skills && u.skills.length > 0 && (
                    <div style={{ marginTop: "5px" }}>
                      {u.skills.slice(0, 3).map((skill, index) => (
                        <span
                          key={index}
                          style={{
                            background: "#e8f5e9",
                            padding: "3px 10px",
                            borderRadius: "15px",
                            fontSize: "12px",
                            marginRight: "5px",
                            color: "#2e7d32",
                            display: "inline-block",
                            marginBottom: "5px"
                          }}
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
                  )}
                  
                  {/* Button Logic */}
                  <div style={{ marginTop: "auto" }}>
                    {isConnected(u._id) ? (
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ color: "green", fontWeight: "bold", fontSize: "14px" }}>
                          ✓ Connected
                        </span>
                        <button 
                          onClick={() => removeConnection(u._id)}
                          style={{ 
                            background: "none", 
                            border: "1px solid #ccc", 
                            padding: "5px 10px",
                            borderRadius: "4px",
                            cursor: "pointer",
                            fontSize: "12px"
                          }}
                        >
                          Remove
                        </button>
                      </div>
                    ) : isOutgoing(u._id) ? (
                      <button 
                        onClick={() => cancelRequest(u._id)}
                        style={{ 
                          background: "#ff6b6b", 
                          color: "white", 
                          border: "none", 
                          padding: "10px 0",
                          borderRadius: "6px",
                          cursor: "pointer",
                          width: "100%",
                          fontWeight: "500"
                        }}
                      >
                        Cancel Request
                      </button>
                    ) : isIncoming(u._id) ? (
                      <div style={{ display: "flex", gap: "10px" }}>
                        <button 
                          onClick={() => acceptRequest(u._id)}
                          style={{ 
                            background: "#4CAF50", 
                            color: "white", 
                            border: "none", 
                            padding: "10px 0",
                            borderRadius: "6px",
                            cursor: "pointer",
                            flex: 1,
                            fontWeight: "500"
                          }}
                        >
                          Accept
                        </button>
                        <button 
                          onClick={() => rejectRequest(u._id)}
                          style={{ 
                            background: "#ff6b6b", 
                            color: "white", 
                            border: "none", 
                            padding: "10px 0",
                            borderRadius: "6px",
                            cursor: "pointer",
                            flex: 1,
                            fontWeight: "500"
                          }}
                        >
                          Reject
                        </button>
                      </div>
                    ) : (
                      <button 
                        onClick={() => sendRequest(u._id)}
                        style={{ 
                          background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)", 
                          color: "white", 
                          border: "none", 
                          padding: "10px 0",
                          borderRadius: "6px",
                          cursor: "pointer",
                          width: "100%",
                          fontWeight: "500"
                        }}
                      >
                        Connect
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Three Columns Layout */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "30px", marginBottom: "40px" }}>
          {/* Incoming Requests Section */}
          <div style={{ 
            background: "white", 
            borderRadius: "12px", 
            padding: "25px",
            boxShadow: "0 2px 10px rgba(0,0,0,0.05)"
          }}>
            <h2 style={{ margin: "0 0 20px 0", color: "#333", fontSize: "20px" }}>Received Requests</h2>
            {incoming.length === 0 ? (
              <p style={{ color: "#666", textAlign: "center", padding: "20px" }}>No incoming connection requests.</p>
            ) : (
              incoming.map((r) => (
                <div
                  key={r._id}
                  style={{
                    border: "1px solid #e0e0e0",
                    padding: "15px",
                    margin: "0 0 15px 0",
                    borderRadius: "8px",
                    display: "flex",
                    alignItems: "center",
                    gap: "15px"
                  }}
                >
                  <img
                    src={r.profilePhoto || "https://via.placeholder.com/50"}
                    alt={r.name}
                    style={{
                      width: "50px",
                      height: "50px",
                      borderRadius: "50%",
                      objectFit: "cover"
                    }}
                  />
                  <div style={{ flex: 1 }}>
                    <h4 style={{ margin: "0 0 5px 0", fontSize: "16px" }}>{r.name}</h4>
                    <p style={{ margin: "0 0 5px 0", color: "#666", fontSize: "13px" }}>
                      {r.role} • {r.department || "No department"}
                    </p>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                    <button 
                      onClick={() => acceptRequest(r._id)}
                      style={{ 
                        background: "#4CAF50", 
                        color: "white", 
                        border: "none", 
                        padding: "5px 10px",
                        borderRadius: "4px",
                        cursor: "pointer",
                        fontSize: "12px"
                      }}
                    >
                      Accept
                    </button>
                    <button 
                      onClick={() => rejectRequest(r._id)}
                      style={{ 
                        background: "#ff6b6b", 
                        color: "white", 
                        border: "none", 
                        padding: "5px 10px",
                        borderRadius: "4px",
                        cursor: "pointer",
                        fontSize: "12px"
                      }}
                    >
                      Reject
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Outgoing Requests Section */}
          <div style={{ 
            background: "white", 
            borderRadius: "12px", 
            padding: "25px",
            boxShadow: "0 2px 10px rgba(0,0,0,0.05)"
          }}>
            <h2 style={{ margin: "0 0 20px 0", color: "#333", fontSize: "20px" }}>Sent Requests</h2>
            {outgoing.length === 0 ? (
              <p style={{ color: "#666", textAlign: "center", padding: "20px" }}>No sent connection requests.</p>
            ) : (
              outgoing.map((r) => (
                <div
                  key={r._id}
                  style={{
                    border: "1px solid #e0e0e0",
                    padding: "15px",
                    margin: "0 0 15px 0",
                    borderRadius: "8px",
                    display: "flex",
                    alignItems: "center",
                    gap: "15px"
                  }}
                >
                  <img
                    src={r.profilePhoto || "https://via.placeholder.com/50"}
                    alt={r.name}
                    style={{
                      width: "50px",
                      height: "50px",
                      borderRadius: "50%",
                      objectFit: "cover"
                    }}
                  />
                  <div style={{ flex: 1 }}>
                    <h4 style={{ margin: "0 0 5px 0", fontSize: "16px" }}>{r.name}</h4>
                    <p style={{ margin: "0 0 5px 0", color: "#666", fontSize: "13px" }}>
                      {r.role} • {r.department || "No department"}
                    </p>
                  </div>
                  <button 
                    onClick={() => cancelRequest(r._id)}
                    style={{ 
                      background: "#ff6b6b", 
                      color: "white", 
                      border: "none", 
                      padding: "5px 10px",
                      borderRadius: "4px",
                      cursor: "pointer",
                      fontSize: "12px"
                    }}
                  >
                    Cancel
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Connections Section */}
          <div style={{ 
            background: "white", 
            borderRadius: "12px", 
            padding: "25px",
            boxShadow: "0 2px 10px rgba(0,0,0,0.05)"
          }}>
            <h2 style={{ margin: "0 0 20px 0", color: "#333", fontSize: "20px" }}>Your Connections</h2>
            {connections.length === 0 ? (
              <p style={{ color: "#666", textAlign: "center", padding: "20px" }}>You haven't connected with anyone yet.</p>
            ) : (
              connections.map((c) => (
                <div
                  key={c._id}
                  style={{
                    border: "1px solid #e0e0e0",
                    padding: "15px",
                    margin: "0 0 15px 0",
                    borderRadius: "8px",
                    display: "flex",
                    alignItems: "center",
                    gap: "15px"
                  }}
                >
                  <img
                    src={c.profilePhoto || "https://via.placeholder.com/50"}
                    alt={c.name}
                    style={{
                      width: "50px",
                      height: "50px",
                      borderRadius: "50%",
                      objectFit: "cover"
                    }}
                  />
                  <div style={{ flex: 1 }}>
                    <h4 style={{ margin: "0 0 5px 0", fontSize: "16px", color: "#2e7d32" }}>{c.name}</h4>
                    <p style={{ margin: "0 0 5px 0", color: "#666", fontSize: "13px" }}>
                      {c.role} • {c.department || "No department"}
                    </p>
                    {c.skills && c.skills.length > 0 && (
                      <div style={{ marginTop: "5px" }}>
                        {c.skills.slice(0, 2).map((skill, index) => (
                          <span
                            key={index}
                            style={{
                              background: "#e8f5e9",
                              padding: "2px 8px",
                              borderRadius: "12px",
                              fontSize: "11px",
                              marginRight: "5px",
                              color: "#2e7d32"
                            }}
                          >
                            {skill}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <button 
                    onClick={() => removeConnection(c._id)}
                    style={{ 
                      background: "none", 
                      border: "1px solid #ccc", 
                      padding: "3px 8px",
                      borderRadius: "4px",
                      cursor: "pointer",
                      fontSize: "12px"
                    }}
                  >
                    Remove
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Network;