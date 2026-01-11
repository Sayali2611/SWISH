import React, { useEffect, useState, useMemo } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import ExploreSearch from "../components/ExploreSearch";
import "../styles/Network.css";

function Network() {
  // 🔵 STATES
  const [users, setUsers] = useState([]);
  const [incoming, setIncoming] = useState([]);
  const [outgoing, setOutgoing] = useState([]);
  const [connections, setConnections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [notifCount, setNotifCount] = useState(0);
  const [activeTab, setActiveTab] = useState("people");
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [quickActionFilter, setQuickActionFilter] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [connectionHistory, setConnectionHistory] = useState([]);
  const [usersWithConnections, setUsersWithConnections] = useState([]);
  const [graphTimeframe, setGraphTimeframe] = useState("all");
  
  // Modal states
  const [showNetworkGrowthModal, setShowNetworkGrowthModal] = useState(false);
  const [showCommonFieldsModal, setShowCommonFieldsModal] = useState(false);
  const [showTopSkillsModal, setShowTopSkillsModal] = useState(false);
  const [showAlumniNetworkModal, setShowAlumniNetworkModal] = useState(false);
  
  const navigate = useNavigate();
  const token = localStorage.getItem("token");
  const authHeader = { headers: { Authorization: `Bearer ${token}` } };

  // 🔵 LINE CHART COMPONENT
  const LineChart = ({ data, maxValue, height = 220, color = "#4f46e5" }) => {
    if (!data || data.length === 0) return null;
    
    const points = data
      .map((d, i) => {
        const x = (i / (data.length - 1 || 1)) * 100;
        const y = ((maxValue - d.value) / maxValue) * 100;
        return `${x}% ${y}%`;
      })
      .join(", ");

    const areaPoints = `0% 100%, ${points}, 100% 100%`;
    
    return (
      <div className="line-chart-container" style={{ height: `${height}px` }}>
        <div className="chart-y-axis">
          {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => (
            <div key={i} className="y-tick">
              {Math.round(maxValue * ratio)}
            </div>
          ))}
        </div>
        <div className="chart-lines">
          <svg className="chart-svg" width="100%" height="100%" preserveAspectRatio="none">
            <polygon
              points={areaPoints}
              fill={`url(#gradient-${color.replace('#', '')})`}
              fillOpacity="0.2"
            />
            
            <defs>
              <linearGradient id={`gradient-${color.replace('#', '')}`} x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor={color} stopOpacity="0.3" />
                <stop offset="100%" stopColor={color} stopOpacity="0" />
              </linearGradient>
            </defs>
            
            <polyline
              points={points}
              fill="none"
              stroke={color}
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          
          <div className="x-axis-labels">
            {data.map((item, index) => (
              <div key={index} className="x-label">
                <div className="x-label-text">{item.label}</div>
                {item.rawCount !== undefined && item.rawCount !== 0 && (
                  <div className={`x-label-count ${item.rawCount > 0 ? 'positive' : 'negative'}`}>
                    {item.rawCount > 0 ? `+${item.rawCount}` : item.rawCount}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  // 🔵 DATA FETCHING FUNCTIONS
  const fetchConnectionHistory = async () => {
    try {
      const res = await axios.get(
        `http://localhost:5000/api/network/history?timeframe=${graphTimeframe}`, 
        authHeader
      );
      setConnectionHistory(res.data?.history || []);
    } catch (err) {
      console.error("Error fetching connection history:", err);
      const fallbackHistory = connections.map(conn => ({
        type: 'connected',
        date: conn.connectedAt || conn.createdAt || new Date().toISOString(),
        userId: conn._id,
        userName: conn.name
      }));
      setConnectionHistory(fallbackHistory);
    }
  };

  const fetchUsersWithConnections = async () => {
    try {
      const res = await axios.get("http://localhost:5000/api/users/with-connections", authHeader);
      setUsersWithConnections(res.data || []);
    } catch (err) {
      console.error("Error fetching users with connections:", err);
      setUsersWithConnections(users);
    }
  };

  // 🔵 DATA PROCESSING FUNCTIONS
  const processHistoricalData = (history) => {
    if (!history || history.length === 0) return [];
    
    const sortedEvents = [...history].sort((a, b) => 
      new Date(a.date) - new Date(b.date)
    );
    
    let timeframeDays;
    switch(graphTimeframe) {
      case "7days":
        timeframeDays = 7;
        break;
      case "30days":
        timeframeDays = 30;
        break;
      case "90days":
        timeframeDays = 90;
        break;
      default:
        timeframeDays = sortedEvents.length > 0 ? 
          Math.ceil((new Date() - new Date(sortedEvents[0].date)) / (1000 * 60 * 60 * 24)) + 1 : 
          365;
    }
    
    const dateArray = [];
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - timeframeDays + 1);
    
    const dailyData = {};
    let currentDate = new Date(startDate);
    
    while (currentDate <= endDate) {
      const dateStr = currentDate.toISOString().split('T')[0];
      const label = currentDate.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric',
        ...(timeframeDays > 30 ? { year: '2-digit' } : {})
      });
      
      dailyData[dateStr] = {
        label: label,
        date: new Date(currentDate),
        connections: new Set(),
        netChange: 0,
        rawCount: 0
      };
      
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    sortedEvents.forEach(event => {
      const eventDate = new Date(event.date);
      const dateStr = eventDate.toISOString().split('T')[0];
      
      if (dailyData[dateStr]) {
        if (event.type === 'connected') {
          if (!dailyData[dateStr].connections.has(event.userId)) {
            dailyData[dateStr].connections.add(event.userId);
            dailyData[dateStr].netChange += 1;
            dailyData[dateStr].rawCount += 1;
          }
        } else if (event.type === 'disconnected') {
          if (dailyData[dateStr].connections.has(event.userId)) {
            dailyData[dateStr].connections.delete(event.userId);
          }
          dailyData[dateStr].netChange -= 1;
          dailyData[dateStr].rawCount -= 1;
        }
      }
    });
    
    const dataArray = Object.values(dailyData).sort((a, b) => a.date - b.date);
    
    let cumulativeTotal = 0;
    const result = dataArray.map(item => {
      cumulativeTotal += item.netChange;
      return {
        label: item.label,
        value: Math.max(0, cumulativeTotal),
        rawCount: item.rawCount,
        date: item.date,
        events: Array.from(item.connections)
      };
    });
    
    return result;
  };

  const calculateMutualConnections = (userData) => {
    if (!userData || !userData.connections || !connections.length) return [];
    
    const currentUserConnections = connections.map(c => c._id);
    const otherUserConnections = userData.connections || [];
    
    return otherUserConnections.filter(connId => 
      currentUserConnections.includes(connId)
    );
  };

  // 🔵 NETWORK INSIGHTS
  const networkInsights = useMemo(() => {
    const historicalData = processHistoricalData(connectionHistory);
    
    const totalConnections = connections.length;
    const pendingRequests = incoming.length;
    const sentRequests = outgoing.length;
    
    let dailyChange = 0;
    let weeklyChange = 0;
    let monthlyChange = 0;
    let growthRate = 0;
    let currentStreak = 0;
    
    if (historicalData.length > 0) {
      const today = historicalData[historicalData.length - 1];
      dailyChange = today.rawCount || 0;
      
      if (historicalData.length >= 7) {
        weeklyChange = historicalData.slice(-7).reduce((sum, day) => sum + day.rawCount, 0);
      }
      
      if (historicalData.length >= 30) {
        monthlyChange = historicalData.slice(-30).reduce((sum, day) => sum + day.rawCount, 0);
      }
      
      let streak = 0;
      for (let i = 1; i < historicalData.length; i++) {
        if (historicalData[i].value > historicalData[i-1].value) {
          streak++;
        } else if (historicalData[i].value < historicalData[i-1].value) {
          streak = 0;
        }
      }
      currentStreak = streak;
    }
    
    const maxHistoricalValue = Math.max(
      ...historicalData.map(d => d.value),
      totalConnections,
      1
    );
    
    const alumniConnections = connections.filter(c => {
      const roleLower = c.role?.toLowerCase() || '';
      const companyLower = c.company?.toLowerCase() || '';
      return roleLower.includes('alumni') || 
             roleLower.includes('graduate') ||
             companyLower.includes('alumni');
    });
    
    const usersWithMutualConnections = usersWithConnections
      .filter(u => u._id !== user?._id)
      .map(u => ({
        ...u,
        mutualCount: calculateMutualConnections(u).length
      }))
      .filter(u => u.mutualCount > 0);
    
    const allSkills = connections.flatMap(c => c.skills || []);
    const skillFrequency = allSkills.reduce((acc, skill) => {
      acc[skill] = (acc[skill] || 0) + 1;
      return acc;
    }, {});
    
    const topSkillsWithCount = Object.entries(skillFrequency)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([skill, count]) => ({ skill, count }));
    
    const allDepartments = connections.map(c => c.department).filter(Boolean);
    const deptFrequency = allDepartments.reduce((acc, dept) => {
      acc[dept] = (acc[dept] || 0) + 1;
      return acc;
    }, {});
    
    const topDepartmentsWithCount = Object.entries(deptFrequency)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([dept, count]) => ({ dept, count }));
    
    return {
      networkGrowth: {
        total: totalConnections,
        pending: pendingRequests,
        sent: sentRequests,
        dailyChange: dailyChange,
        weeklyChange: weeklyChange,
        monthlyChange: monthlyChange,
        growthRate: growthRate,
        historicalData: historicalData,
        maxHistoricalValue: maxHistoricalValue,
        hasRealData: connectionHistory.length > 0,
        currentStreak: currentStreak,
        timeframe: graphTimeframe
      },
      mutualConnections: {
        total: usersWithMutualConnections.length,
        users: usersWithMutualConnections
      },
      alumniNetwork: {
        count: alumniConnections.length,
        percentage: totalConnections > 0 ? Math.round((alumniConnections.length / totalConnections) * 100) : 0
      },
      topSkills: {
        skills: topSkillsWithCount,
        topSkill: topSkillsWithCount[0]?.skill || "No shared skills"
      },
      commonFields: {
        departments: topDepartmentsWithCount,
        topDepartment: topDepartmentsWithCount[0]?.dept || "No common field"
      },
      historicalStats: {
        totalEvents: connectionHistory.length,
        connectionEvents: connectionHistory.filter(e => e.type === 'connected').length,
        disconnectionEvents: connectionHistory.filter(e => e.type === 'disconnected').length
      }
    };
  }, [connections, incoming, outgoing, connectionHistory, usersWithConnections, user, graphTimeframe]);

  // 🔵 USE EFFECTS
  useEffect(() => {
    fetchUserProfile();
    fetchAllData();
    fetchNotificationCount();
  }, []);

  useEffect(() => {
    fetchConnectionHistory();
  }, [graphTimeframe]);

  useEffect(() => {
    const availableUsers = users.filter(u => 
      u._id !== user?._id &&
      !connections.some(c => c._id === u._id) && 
      !outgoing.some(o => o._id === u._id) && 
      !incoming.some(i => i._id === u._id)
    );
    
    if (quickActionFilter) {
      let filtered = [];
      let targetTab = "people";
      
      switch(quickActionFilter) {
        case 'alumni':
          filtered = availableUsers.filter(u => {
            const roleLower = u.role?.toLowerCase() || '';
            const companyLower = u.company?.toLowerCase() || '';
            return roleLower.includes('alumni') || 
                   roleLower.includes('graduate') ||
                   companyLower.includes('alumni');
          });
          break;
          
        case 'same_department':
          filtered = availableUsers.filter(u => 
            u.department === user?.department
          );
          break;
          
        case 'top_skill':
          const topSkill = networkInsights.topSkills.topSkill;
          if (topSkill !== "No shared skills") {
            filtered = availableUsers.filter(u => 
              u.skills?.some(skill => 
                skill.toLowerCase().includes(topSkill.toLowerCase())
              )
            );
          }
          break;
          
        case 'recent_connections':
          filtered = [...connections].sort((a, b) => {
            const dateA = new Date(a.connectedAt || a.createdAt || 0);
            const dateB = new Date(b.connectedAt || b.createdAt || 0);
            return dateB - dateA;
          }).slice(0, 10);
          targetTab = "connections";
          break;
          
        case 'mutual_connections':
          filtered = networkInsights.mutualConnections.users
            .filter(u => 
              u._id !== user?._id &&
              !connections.some(c => c._id === u._id) && 
              !outgoing.some(o => o._id === u._id) && 
              !incoming.some(i => i._id === u._id)
            )
            .sort((a, b) => b.mutualCount - a.mutualCount);
          break;
          
        case 'pending_actions':
          setActiveTab("received");
          return;
          
        case 'export_connections':
          exportConnections();
          setQuickActionFilter(null);
          return;
          
        default:
          filtered = availableUsers;
      }
      
      setFilteredUsers(filtered);
      if (targetTab) setActiveTab(targetTab);
    } else {
      setFilteredUsers(availableUsers);
    }
  }, [users, connections, outgoing, incoming, quickActionFilter, user, networkInsights]);

  // 🔵 API CALL FUNCTIONS
  const fetchUserProfile = async () => {
    try {
      const res = await axios.get("http://localhost:5000/api/auth/profile", authHeader);
      setUser(res.data);
    } catch (err) {
      console.error("Error fetching user profile:", err);
    }
  };

  const fetchNotificationCount = async () => {
    try {
      const res = await axios.get("http://localhost:5000/api/notifications/unread/count", authHeader);
      setNotifCount(res.data.count || 0);
    } catch (err) {
      console.error("Error fetching notification count:", err);
    }
  };

  const fetchAllData = async () => {
    setLoading(true);
    try {
      const [usersRes, incomingRes, outgoingRes, connectionsRes] = await Promise.all([
        axios.get("http://localhost:5000/api/users", authHeader),
        axios.get("http://localhost:5000/api/network/requests/received", authHeader),
        axios.get("http://localhost:5000/api/network/requests/sent", authHeader),
        axios.get("http://localhost:5000/api/network/connections", authHeader)
      ]);
      
      setUsers(usersRes.data || []);
      setIncoming(incomingRes.data?.requests || []);
      setOutgoing(outgoingRes.data?.requests || []);
      setConnections(connectionsRes.data?.connections || []);
      
      fetchConnectionHistory();
      fetchUsersWithConnections();
      
    } catch (err) {
      console.error("Error fetching network data:", err);
      setUsers([]);
      setIncoming([]);
      setOutgoing([]);
      setConnections([]);
    } finally {
      setLoading(false);
    }
  };

  const handleNetworkAction = async (endpoint, id, userName = '', userData = null) => {
    try {
      const isRemoval = endpoint === "remove";
      const isConnection = endpoint === "accept" || endpoint === "request";
      
      await axios.post(`http://localhost:5000/api/network/${endpoint}/${id}`, {}, authHeader);
      
      const eventType = isRemoval ? 'disconnected' : 
                      isConnection ? 'connected' : null;
      
      if (eventType) {
        const historyEvent = {
          type: eventType,
          date: new Date().toISOString(),
          userId: id,
          userName: userName || 'Unknown',
          userData: userData || null
        };
        
        setConnectionHistory(prev => [...prev, historyEvent]);
        
        try {
          await axios.post("http://localhost:5000/api/network/history/record", 
            historyEvent, 
            authHeader
          );
        } catch (err) {
          console.error("Failed to record history:", err);
        }
      }
      
      fetchAllData();
      
    } catch (err) {
      alert(err.response?.data?.message || "Error processing request");
    }
  };

  const exportConnections = () => {
    const csvHeaders = "Name,Role,Department,Email,Company,Skills,Connection Date,Connection Type\n";
    
    const csvRows = connectionHistory.map(event => {
      const date = new Date(event.date);
      const formattedDate = date.toLocaleDateString();
      const formattedTime = date.toLocaleTimeString();
      
      return `"${event.userName || ''}","${event.userData?.role || ''}","${event.userData?.department || ''}","${event.userData?.email || ''}","${event.userData?.company || ''}","","${formattedDate} ${formattedTime}","${event.type}"`;
    }).join("\n");
    
    const csvContent = "data:text/csv;charset=utf-8," + csvHeaders + csvRows;
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `network_history_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    alert(`${connectionHistory.length} historical events exported successfully!`);
  };

  // 🔵 HELPER FUNCTIONS
  const clearFilter = () => {
    setQuickActionFilter(null);
    setSearchQuery("");
  };

  const getUserAvatar = (userObj) => (
    userObj?.profilePhoto ? 
      <img src={userObj.profilePhoto} alt={userObj.name} className="user-avatar-img" /> :
      <div className="avatar-initial">{userObj?.name?.charAt(0).toUpperCase() || "U"}</div>
  );

  const getConnectionDateDisplay = (connection) => {
    const date = connection.connectedAt || connection.createdAt;
    if (!date) return null;
    
    const connectionDate = new Date(date);
    const now = new Date();
    const diffTime = Math.abs(now - connectionDate);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    return `${Math.floor(diffDays / 30)} months ago`;
  };

  const handleTimeframeChange = (timeframe) => {
    setGraphTimeframe(timeframe);
  };

  // 🔵 RENDER FUNCTIONS
  if (loading && !user) {
    return (
      <div className="network-loading">
        <div className="loading-spinner"></div>
        <p>Loading Network...</p>
      </div>
    );
  }

  const getActiveContent = () => {
    switch(activeTab) {
      case "people":
        return filteredUsers;
      case "received":
        return incoming;
      case "sent":
        return outgoing;
      case "connections":
        if (quickActionFilter === 'recent_connections') {
          return [...connections].sort((a, b) => {
            const dateA = new Date(a.connectedAt || a.createdAt || 0);
            const dateB = new Date(b.connectedAt || b.createdAt || 0);
            return dateB - dateA;
          }).slice(0, 10);
        }
        return connections;
      default:
        return [];
    }
  };

  const activeContent = getActiveContent();

  // 🔵 HANDLE LOGOUT
  const handleLogout = () => {
    localStorage.clear();
    navigate("/login");
  };

  // 🔵 NOTIFICATION HANDLER
  const handleClickNotification = () => {
    navigate("/notifications");
  };
  
  return (
    <div className="network-page">
      
      {/* 🔵 HEADER - UPDATED TO MATCH FEED PAGE NAVBAR */}
      <header className="feed-header network-feed-header">
        <div className="header-left">
          <div className="logo" onClick={() => navigate("/feed")}>💼 Swish</div>
          
          {/* SEARCH BAR */}
          <div className="feed-search-wrapper">
            <ExploreSearch onUserSelect={(selectedUser) => selectedUser?._id && navigate(`/profile/${selectedUser._id}`)} />
          </div>

          <div className="nav-items">
            <button className="nav-btn" onClick={() => navigate("/feed")}>🏠 Feed</button>
            <button className="nav-btn" onClick={() => navigate("/profile")}>👤 Profile</button>
            <button className="nav-btn active" onClick={() => navigate("/network")}>👥 Network</button>
            <button className="nav-btn" onClick={() => navigate("/Explore")}>🌍 Explore</button>
            <button 
              className="nav-btn notification-bell-btn"
              onClick={handleClickNotification}
              title="Notifications"
            >
              🔔 Notifications
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
          
          {user?.role === 'admin' && (
            <button 
              className="admin-btn"
              onClick={() => navigate("/admin")}
              style={{
                background: 'linear-gradient(135deg, #6f4bac, #9793e4)',
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

      {/* 📊 NETWORK GROWTH MODAL */}
      {showNetworkGrowthModal && (
        <div className="modal-overlay" onClick={() => setShowNetworkGrowthModal(false)}>
          <div className="modal-content analytics-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title-section">
                <h3>📊 Network Growth Analytics</h3>
                <div className="data-source-indicator">
                  <span className="data-source real">
                    📈 Real-Time Historical Tracking
                  </span>
                </div>
              </div>
              <button className="modal-close" onClick={() => setShowNetworkGrowthModal(false)}>×</button>
            </div>
            
            <div className="modal-body">
              <div className="analytics-summary">
                <div className="timeframe-selector">
                  <h4>View Timeframe:</h4>
                  <div className="timeframe-buttons">
                    {[
                      { key: "7days", label: "7 Days" },
                      { key: "30days", label: "30 Days" },
                      { key: "90days", label: "90 Days" },
                      { key: "all", label: "All Time" }
                    ].map(({ key, label }) => (
                      <button
                        key={key}
                        className={`timeframe-btn ${graphTimeframe === key ? 'active' : ''}`}
                        onClick={() => handleTimeframeChange(key)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                
                <div className="summary-stats">
                  <div className="stat-item">
                    <div className="stat-value">{networkInsights.networkGrowth.total}</div>
                    <div className="stat-label">Total Connections</div>
                    <div className="stat-note">Current count</div>
                  </div>
                  <div className="stat-item">
                    <div className="stat-value">{networkInsights.networkGrowth.dailyChange > 0 ? '+' : ''}{networkInsights.networkGrowth.dailyChange}</div>
                    <div className="stat-label">Today</div>
                    <div className="stat-note">Net change</div>
                  </div>
                  <div className="stat-item">
                    <div className="stat-value">{networkInsights.networkGrowth.weeklyChange > 0 ? '+' : ''}{networkInsights.networkGrowth.weeklyChange}</div>
                    <div className="stat-label">This Week</div>
                    <div className="stat-note">Weekly change</div>
                  </div>
                  <div className="stat-item">
                    <div className="stat-value">{networkInsights.networkGrowth.monthlyChange > 0 ? '+' : ''}{networkInsights.networkGrowth.monthlyChange}</div>
                    <div className="stat-label">This Month</div>
                    <div className="stat-note">Monthly change</div>
                  </div>
                </div>
                
                <div className="growth-chart">
                  <h4>📈 Network Growth Timeline</h4>
                  <div className="data-real-notice">
                    <span className="real-icon">✅</span>
                    <span>Tracking {networkInsights.historicalStats.totalEvents} connection events in real-time</span>
                  </div>
                  <div className="chart-container-large">
                    <LineChart 
                      data={networkInsights.networkGrowth.historicalData}
                      maxValue={networkInsights.networkGrowth.maxHistoricalValue}
                      color="#3498db"
                      height={280}
                    />
                  </div>
                  <div className="chart-legend">
                    <div className="legend-item">
                      <div className="legend-color" style={{ backgroundColor: '#3498db' }}></div>
                      <span>Network Size</span>
                    </div>
                    <div className="legend-item">
                      <div className="legend-color" style={{ backgroundColor: '#2ecc71' }}></div>
                      <span>Growth Trend</span>
                    </div>
                  </div>
                </div>
                
                {networkInsights.historicalStats.totalEvents > 0 && (
                  <div className="event-history">
                    <h4>📝 Recent Network Activity</h4>
                    <div className="events-list-container">
                      {[...connectionHistory]
                        .sort((a, b) => new Date(b.date) - new Date(a.date))
                        .slice(0, 8)
                        .map((event, index) => (
                          <div key={index} className={`event-item ${event.type}`}>
                            <div className="event-icon">
                              {event.type === 'connected' ? '🔗' : '❌'}
                            </div>
                            <div className="event-content">
                              <div className="event-description">
                                <strong>{event.userName}</strong> was {event.type === 'connected' ? 'added to' : 'removed from'} your network
                              </div>
                              <div className="event-date">
                                {new Date(event.date).toLocaleDateString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </div>
                            </div>
                            <div className="event-action">
                              {event.type === 'connected' ? '+1' : '-1'}
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
                
                <div className="stats-summary">
                  <div className="stat-card-mini">
                    <div className="stat-mini-value">{networkInsights.historicalStats.connectionEvents}</div>
                    <div className="stat-mini-label">Connections Made</div>
                  </div>
                  <div className="stat-card-mini">
                    <div className="stat-mini-value">{networkInsights.historicalStats.disconnectionEvents}</div>
                    <div className="stat-mini-label">Connections Removed</div>
                  </div>
                  <div className="stat-card-mini">
                    <div className="stat-mini-value">{networkInsights.networkGrowth.currentStreak}</div>
                    <div className="stat-mini-label">Growth Streak</div>
                  </div>
                  <div className="stat-card-mini">
                    <div className="stat-mini-value">
                      {networkInsights.historicalStats.connectionEvents - networkInsights.historicalStats.disconnectionEvents}
                    </div>
                    <div className="stat-mini-label">Net Growth</div>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="modal-actions">
              <button className="modal-btn" onClick={() => {
                setShowNetworkGrowthModal(false);
                setQuickActionFilter('recent_connections');
                setSearchQuery("Recent connections");
                setActiveTab("connections");
              }}>
                <span className="modal-icon">🔄</span>
                View Recent Connections
              </button>
              <button className="modal-btn" onClick={exportConnections}>
                <span className="modal-icon">📥</span>
                Export Complete History
              </button>
              <button className="modal-btn cancel" onClick={() => setShowNetworkGrowthModal(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🔵 COMMON FIELDS MODAL */}
      {showCommonFieldsModal && (
        <div className="modal-overlay" onClick={() => setShowCommonFieldsModal(false)}>
          <div className="modal-content analytics-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>🎯 Common Fields Analysis</h3>
              <button className="modal-close" onClick={() => setShowCommonFieldsModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="analytics-summary">
                <div className="summary-stats">
                  <div className="stat-item">
                    <div className="stat-value">{networkInsights.commonFields.departments.length}</div>
                    <div className="stat-label">Common Fields</div>
                  </div>
                  <div className="stat-item">
                    <div className="stat-value">{networkInsights.commonFields.departments[0]?.count || 0}</div>
                    <div className="stat-label">In {networkInsights.commonFields.topDepartment}</div>
                  </div>
                </div>
                
                <div className="fields-list">
                  <h4>Top Fields in Your Network</h4>
                  {networkInsights.commonFields.departments.slice(0, 8).map((field, index) => (
                    <div key={index} className="field-item">
                      <div className="field-rank">{index + 1}</div>
                      <div className="field-name">{field.dept}</div>
                      <div className="field-count">{field.count} connections</div>
                      <div className="field-bar">
                        <div 
                          className="field-bar-fill" 
                          style={{ 
                            width: `${(field.count / Math.max(...networkInsights.commonFields.departments.map(f => f.count))) * 100}%` 
                          }}
                        ></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="modal-actions">
              <button className="modal-btn" onClick={() => {
                setShowCommonFieldsModal(false);
                if (networkInsights.commonFields.topDepartment !== "No common field") {
                  setQuickActionFilter('same_department');
                  setSearchQuery(`People in ${networkInsights.commonFields.topDepartment}`);
                  setActiveTab("people");
                }
              }}>
                <span className="modal-icon">🔗</span>
                Connect with {networkInsights.commonFields.topDepartment}
              </button>
              <button className="modal-btn cancel" onClick={() => setShowCommonFieldsModal(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🔵 TOP SKILLS MODAL */}
      {showTopSkillsModal && (
        <div className="modal-overlay" onClick={() => setShowTopSkillsModal(false)}>
          <div className="modal-content analytics-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>🔧 Top Shared Skills Analysis</h3>
              <button className="modal-close" onClick={() => setShowTopSkillsModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="analytics-summary">
                <div className="summary-stats">
                  <div className="stat-item">
                    <div className="stat-value">{networkInsights.topSkills.skills.length}</div>
                    <div className="stat-label">Shared Skills</div>
                  </div>
                  <div className="stat-item">
                    <div className="stat-value">{networkInsights.topSkills.skills[0]?.count || 0}</div>
                    <div className="stat-label">Know {networkInsights.topSkills.topSkill}</div>
                  </div>
                </div>
                
                <div className="skills-list">
                  <h4>Skill Ranking</h4>
                  {networkInsights.topSkills.skills.slice(0, 10).map((skill, index) => (
                    <div key={index} className="skill-item-modal">
                      <div className="skill-rank">{index + 1}</div>
                      <div className="skill-name">{skill.skill}</div>
                      <div className="skill-count">{skill.count} connections</div>
                      <div className="skill-bar">
                        <div 
                          className="skill-bar-fill" 
                          style={{ 
                            width: `${(skill.count / Math.max(...networkInsights.topSkills.skills.map(s => s.count))) * 100}%` 
                          }}
                        ></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="modal-actions">
              <button className="modal-btn" onClick={() => {
                setShowTopSkillsModal(false);
                if (networkInsights.topSkills.topSkill !== "No shared skills") {
                  setQuickActionFilter('top_skill');
                  setSearchQuery(`People with ${networkInsights.topSkills.topSkill} skill`);
                  setActiveTab("people");
                }
              }}>
                <span className="modal-icon">👥</span>
                Find People with {networkInsights.topSkills.topSkill}
              </button>
              <button className="modal-btn cancel" onClick={() => setShowTopSkillsModal(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      
      
      {/* 🔵 MAIN CONTENT */}
      <main className="network-main">
        <div className="network-hero">
          <div className="hero-content">
            <h1>My Network</h1>
            <p>Connect with professionals and grow your circle</p>
            {networkInsights.networkGrowth.hasRealData && (
              <div className="historical-data-badge">
                <span className="badge-icon">📊</span>
                <span className="badge-text">Real-time growth tracking active</span>
              </div>
            )}
          </div>
          <div className="hero-stats">
            {[
              {value: connections.length, label: "Connections"}, 
              {value: incoming.length, label: "Pending"}, 
              {value: outgoing.length, label: "Sent"},
              {value: `${networkInsights.networkGrowth.dailyChange > 0 ? '+' : ''}${networkInsights.networkGrowth.dailyChange}`, label: "Today"},
              {value: `${networkInsights.historicalStats.totalEvents}`, label: "Total Events"}
            ].map((stat, i) => (
              <div key={i} className="stat-card">
                <div className="stat-value">{stat.value}</div>
                <div className="stat-label">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Search/Filter Bar */}
        {searchQuery && (
          <div className="filter-bar">
            <div className="filter-info">
              <span className="filter-icon">🔍</span>
              <span className="filter-text">Showing: {searchQuery}</span>
              <span className="filter-count">({activeContent.length} results)</span>
            </div>
            <button className="clear-filter-btn" onClick={clearFilter}>
              <span className="clear-icon">✕</span> Clear Filter
            </button>
          </div>
        )}

        {/* UPDATED TAB NAVIGATION */}
        <div className="network-tabs">
          {/* PEOPLE (NO BADGE) */}
          <div 
            className={`tab-item ${activeTab === 'people' ? 'active' : ''}`} 
            onClick={() => { setActiveTab('people'); clearFilter(); }}
          >
            <span className="tab-icon">👥</span>
            <span className="tab-text">People</span>
          </div>

          {/* RECEIVED (BADGE KEPT) */}
          <div 
            className={`tab-item ${activeTab === 'received' ? 'active' : ''}`} 
            onClick={() => { setActiveTab('received'); clearFilter(); }}
          >
            <span className="tab-icon">📥</span>
            <span className="tab-text">Received</span>
            {incoming.length > 0 && <span className="notification-badge">{incoming.length}</span>}
          </div>

          {/* SENT (NO BADGE) */}
          <div 
            className={`tab-item ${activeTab === 'sent' ? 'active' : ''}`} 
            onClick={() => { setActiveTab('sent'); clearFilter(); }}
          >
            <span className="tab-icon">📤</span>
            <span className="tab-text">Sent</span>
          </div>

          {/* CONNECTIONS (NO BADGE) */}
          <div 
            className={`tab-item ${activeTab === 'connections' ? 'active' : ''}`} 
            onClick={() => { setActiveTab('connections'); clearFilter(); }}
          >
            <span className="tab-icon">🤝</span>
            <span className="tab-text">Connections</span>
          </div>
        </div>

        <div className="tab-content-wrapper">
          {activeTab === "people" && (
            <div className="tab-content active">
              <div className="section-header">
                <h2>{searchQuery || "Discover Professionals"}</h2>
                <p>{searchQuery ? "Filtered results" : "Connect with people in your network"}</p>
                {quickActionFilter === 'mutual_connections' && networkInsights.mutualConnections.total > 0 && (
                  <div className="mutual-connections-info">
                    <span className="info-icon">🤝</span>
                    <span className="info-text">
                      Showing {networkInsights.mutualConnections.total} users who share connections with you
                    </span>
                  </div>
                )}
              </div>
              
              {activeContent.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">👥</div>
                  <h3>{searchQuery ? "No results found" : "No users to connect with"}</h3>
                  <p>{searchQuery ? "Try a different filter or clear the search" : "All users are already connected or have pending requests"}</p>
                  {searchQuery && (
                    <button className="connect-btn" onClick={clearFilter} style={{marginTop: '20px', maxWidth: '200px'}}>
                      Show All Users
                    </button>
                  )}
                </div>
              ) : (
                <div className="users-grid">
                  {activeContent.map(user => {
                    const mutualCount = quickActionFilter === 'mutual_connections' ? 
                      calculateMutualConnections(user)?.length || 0 : 0;
                    
                    return (
                      <div key={user._id} className="user-card">
                        <div className="user-card-header">
                          <div className="avatar-container">
                            <img src={user.profilePhoto || "https://via.placeholder.com/80"} alt={user.name} className="user-avatar" />
                          </div>
                          <div className="linkedin-details">
                            <h3 className="user-name">{user.name}</h3>
                            <p className="user-role">{user.role}</p>
                            <p className="user-department">{user.department || "No department"}</p>
                            {user.company && <p className="user-company">{user.company}</p>}
                            {mutualCount > 0 && (
                              <div className="mutual-connections-badge">
                                <span className="mutual-icon">🤝</span>
                                <span className="mutual-count">{mutualCount} mutual connection{mutualCount !== 1 ? 's' : ''}</span>
                              </div>
                            )}
                          </div>
                        </div>
                        <button 
                          className="connect-btn" 
                          onClick={() => handleNetworkAction("request", user._id, user.name, user)}
                        >
                          Connect
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {activeTab === "received" && (
            <div className="tab-content active">
              <div className="section-header">
                <h2>{searchQuery || "Connection Requests"}</h2>
                <p>{searchQuery || "Manage your incoming requests"}</p>
              </div>
              
              {activeContent.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">📥</div>
                  <h3>No pending requests</h3>
                  <p>When someone sends you a request, it will appear here</p>
                </div>
              ) : (
                <div className="requests-list">
                  {activeContent.map(request => (
                    <div key={request._id} className="request-card">
                      <div className="avatar-container">
                        <img src={request.profilePhoto || "https://via.placeholder.com/60"} alt={request.name} className="request-avatar" />
                      </div>
                      <div className="request-info">
                        <h3 className="request-name">{request.name}</h3>
                        <p className="request-details">{request.role} • {request.department || "No department"}</p>
                        {request.bio && <p className="request-bio">{request.bio.length > 80 ? `${request.bio.substring(0, 80)}...` : request.bio}</p>}
                      </div>
                      <div className="request-actions">
                        <button 
                          className="accept-btn" 
                          onClick={() => handleNetworkAction("accept", request._id, request.name, request)}
                        >
                          Accept
                        </button>
                        <button 
                          className="reject-btn" 
                          onClick={() => handleNetworkAction("reject", request._id, request.name)}
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === "sent" && (
            <div className="tab-content active">
              <div className="section-header">
                <h2>Sent Requests</h2>
                <p>Your outgoing connection requests</p>
              </div>
              
              {activeContent.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">📤</div>
                  <h3>No sent requests</h3>
                  <p>Connect with people to grow your network</p>
                </div>
              ) : (
                <div className="sent-list">
                  {activeContent.map(request => (
                    <div key={request._id} className="sent-card">
                      <div className="avatar-container">
                        <img src={request.profilePhoto || "https://via.placeholder.com/60"} alt={request.name} className="sent-avatar" />
                      </div>
                      <div className="sent-info">
                        <h3 className="sent-name">{request.name}</h3>
                        <p className="sent-details">{request.role} • {request.department || "No department"}</p>
                        <div className="sent-status">
                          <span className="status-icon">⏳</span>
                          <span className="status-text">Pending</span>
                        </div>
                      </div>
                      <button 
                        className="cancel-btn" 
                        onClick={() => handleNetworkAction("cancel", request._id, request.name)}
                      >
                        Cancel
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === "connections" && (
            <div className="tab-content active">
              <div className="section-header">
                <h2>{searchQuery || "Your Connections"}</h2>
                <p>{searchQuery || "Manage your professional network"}</p>
                {quickActionFilter === 'recent_connections' && (
                  <div className="section-subtitle">
                    <span className="subtitle-icon">🕒</span>
                    Showing most recent connections first
                  </div>
                )}
              </div>
              
              {activeContent.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">🤝</div>
                  <h3>No connections yet</h3>
                  <p>Start building your professional network</p>
                  <button className="connect-btn" onClick={() => setActiveTab("people")} style={{marginTop: '20px'}}>
                    Discover People to Connect With
                  </button>
                </div>
              ) : (
                <div className="connections-grid">
                  {activeContent.map(connection => {
                    const connectionDateDisplay = getConnectionDateDisplay(connection);
                    
                    return (
                      <div key={connection._id} className="connection-card">
                        <div className="connection-left">
                          <img 
                            src={connection.profilePhoto || "https://via.placeholder.com/80"} 
                            alt={connection.name} 
                            className="connection-avatar" 
                          />
                          <div className="connection-info">
                            <div className="connection-name">{connection.name}</div>
                            <div className="connection-role">{connection.role}</div>
                            <div className="connection-department">{connection.department || "No department"}</div>
                            {connection.company && <div className="connection-company">{connection.company}</div>}
                            {connectionDateDisplay && (
                              <div className="connection-date">
                                <span className="date-icon">📅</span>
                                <span className="date-text">Connected {connectionDateDisplay}</span>
                              </div>
                            )}
                            {connection.skills?.length > 0 && (
                              <div className="connection-skills">
                                {connection.skills.slice(0, 3).map((skill, idx) => 
                                  <span key={idx} className="skill-tag">{skill}</span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="connection-actions">
                          <button 
                            className="remove-btn" 
                            onClick={() => {
                              if (window.confirm(`Remove ${connection.name} from your connections?`)) {
                                handleNetworkAction("remove", connection._id, connection.name, connection);
                              }
                            }}
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* 🔵 SIDEBAR */}
        <aside className="network-sidebar">
          <div className="sidebar-section">
            <h3>Network Insights</h3>
            {[
              ["📈", "Network Growth", `${networkInsights.networkGrowth.total} connections`, () => setShowNetworkGrowthModal(true)],
              ["🎯", "Common Fields", networkInsights.commonFields.topDepartment, () => setShowCommonFieldsModal(true)],
              ["🔧", "Top Shared Skills", networkInsights.topSkills.topSkill, () => setShowTopSkillsModal(true)],
            ].map(([icon, title, value, onClick], idx) => (
              <div key={idx} className="insight-item clickable" onClick={onClick}>
                <span className="insight-icon">{icon}</span>
                <div className="insight-content">
                  <strong>{title}</strong>
                  <span className="insight-value">{value}</span>
                </div>
                <span className="insight-arrow">→</span>
              </div>
            ))}
          </div>
        </aside>
      </main>
    </div>
  );
}

export default Network;