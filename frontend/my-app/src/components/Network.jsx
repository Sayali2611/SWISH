import React, { useEffect, useState, useMemo } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar"; // Import the reusable navbar
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
  
  const navigate = useNavigate();
  const token = localStorage.getItem("token");
  const authHeader = { headers: { Authorization: `Bearer ${token}` } };

  // 🔵 LINE CHART COMPONENT
  const LineChart = ({ data, maxValue, height = 220, color = "#a78bfa" }) => {
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
      <div className="network-line-chart-container" style={{ height: `${height}px` }}>
        <div className="network-chart-y-axis">
          {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => (
            <div key={i} className="network-y-tick">
              {Math.round(maxValue * ratio)}
            </div>
          ))}
        </div>
        <div className="network-chart-lines">
          <svg className="network-chart-svg" width="100%" height="100%" preserveAspectRatio="none">
            <polygon
              points={areaPoints}
              fill={`url(#network-gradient-${color.replace('#', '')})`}
              fillOpacity="0.2"
            />
            
            <defs>
              <linearGradient id={`network-gradient-${color.replace('#', '')}`} x1="0%" y1="0%" x2="0%" y2="100%">
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
          
          <div className="network-x-axis-labels">
            {data.map((item, index) => (
              <div key={index} className="network-x-label">
                <div className="network-x-label-text">{item.label}</div>
                {item.rawCount !== undefined && item.rawCount !== 0 && (
                  <div className={`network-x-label-count ${item.rawCount > 0 ? 'positive' : 'negative'}`}>
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
        `${import.meta.env.VITE_API_URL}/api/network/history?timeframe=${graphTimeframe}`, 
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
      const res = await axios.get(`${import.meta.env.VITE_API_URL}/api/users/with-connections`, authHeader);
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

  const fetchAllData = async () => {
    setLoading(true);
    try {
      const [usersRes, incomingRes, outgoingRes, connectionsRes] = await Promise.all([
        axios.get(`${import.meta.env.VITE_API_URL}/api/users`, authHeader),
        axios.get(`${import.meta.env.VITE_API_URL}/api/network/requests/received`, authHeader),
        axios.get(`${import.meta.env.VITE_API_URL}/api/network/requests/sent`, authHeader),
        axios.get(`${import.meta.env.VITE_API_URL}/api/network/connections`, authHeader)
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
      
      await axios.post(`${import.meta.env.VITE_API_URL}/api/network/${endpoint}/${id}`, {}, authHeader);
      
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
          await axios.post(`${import.meta.env.VITE_API_URL}/api/network/history/record`, 
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
      <img src={userObj.profilePhoto} alt={userObj.name} className="network-user-avatar-img" /> :
      <div className="network-avatar-initial">{userObj?.name?.charAt(0).toUpperCase() || "U"}</div>
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
      <div className="network-page-root">
        <Navbar /> {/* Use the reusable navbar */}
        <div className="network-loading-container">
          <div className="network-loading-spinner"></div>
          <p>Loading Network...</p>
        </div>
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

  return (
    <div className="network-page-root">
      {/* Use the reusable Navbar component */}
      <Navbar />

      {/* 🔵 MAIN LAYOUT CONTAINER - MATCHING NOTIFICATIONS */}
      <div className="network-layout-container">
        {/* ========== LEFT SIDEBAR ========== */}
        <div className="network-sidebar network-left-sidebar">
          <div className="network-profile-mini-card" onClick={() => navigate("/profile")}>
            <div className="network-mini-avatar">
              {getUserAvatar(user)}
            </div>
            <div className="network-mini-info">
              <h4>{user?.name || "User"}</h4>
              <p className="network-mini-title">
                {user?.role === 'student' ? `🎓 ${user?.department || 'Student'}` : 
                 user?.role === 'faculty' ? `👨‍🏫 ${user?.department || 'Faculty'}` : 
                 user?.role === 'admin' ? '👑 Administrator' : '👤 Member'}
              </p>
              <p className="network-mini-bio">
                {user?.bio?.slice(0, 80) || "Welcome to Swish! Connect with your college community."}
              </p>
            </div>
            <div className="network-mini-stats">
              <div className="network-stats-grid">
                <div className="network-stat-item" onClick={() => setActiveTab("connections")}>
                  <span className="network-stat-number">{connections.length}</span>
                  <span className="network-stat-label">Connections</span>
                </div>
                <div className="network-stat-item" onClick={() => setActiveTab("received")}>
                  <span className="network-stat-number">{incoming.length}</span>
                  <span className="network-stat-label">Pending</span>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="network-quick-actions-card">
            <h3 className="network-sidebar-title">
              <span>⚡ Quick Actions</span>
            </h3>
            <div className="network-quick-actions-grid">
              <button className="network-quick-action-btn" onClick={() => {
                setQuickActionFilter('mutual_connections');
                setSearchQuery('People with mutual connections');
              }}>
                <span className="network-action-icon">🤝</span>
                <span>Mutual Connections</span>
              </button>
              <button className="network-quick-action-btn" onClick={() => {
                setQuickActionFilter('recent_connections');
                setSearchQuery('Recent connections');
                setActiveTab('connections');
              }}>
                <span className="network-action-icon">🕒</span>
                <span>Recent</span>
              </button>
              <button className="network-quick-action-btn" onClick={() => {
                setQuickActionFilter('same_department');
                setSearchQuery(`People in ${user?.department || 'your department'}`);
              }}>
                <span className="network-action-icon">🎯</span>
                <span>Same Dept</span>
              </button>
              <button className="network-quick-action-btn" onClick={() => setActiveTab("received")}>
                <span className="network-action-icon">📥</span>
                <span>Requests</span>
              </button>
            </div>
          </div>
        </div>

        {/* ========== MAIN CONTENT ========== */}
        <div className="network-main-content">
          <div className="network-container">
            <div className="network-content-header">
              <h2 className="network-content-title">
                My Network
                {incoming.length > 0 && <span className="network-title-badge">{incoming.length} new</span>}
              </h2>
              <div className="network-header-actions">
                <button className="network-feature-btn" onClick={() => setShowNetworkGrowthModal(true)}>
                  Analytics
                </button>
                <button className="network-feature-btn" onClick={exportConnections}>
                  Export
                </button>
              </div>
            </div>

            {/* Search/Filter Bar */}
            {searchQuery && (
              <div className="network-filter-bar">
                <div className="network-filter-info">
                  <span className="network-filter-icon">🔍</span>
                  <span className="network-filter-text">Showing: {searchQuery}</span>
                  <span className="network-filter-count">({activeContent.length} results)</span>
                </div>
                <button className="network-clear-filter-btn" onClick={clearFilter}>
                  <span className="network-clear-icon">✕</span>
                  Clear Filter
                </button>
              </div>
            )}

            {/* Network Tabs */}
            <div className="network-tabs-container">
              <div 
                className={`network-tab-item ${activeTab === 'people' ? 'active' : ''}`} 
                onClick={() => { setActiveTab('people'); clearFilter(); }}
              >
                <span className="network-tab-icon">👥</span>
                <span className="network-tab-text">People</span>
              </div>

              <div 
                className={`network-tab-item ${activeTab === 'received' ? 'active' : ''}`} 
                onClick={() => { setActiveTab('received'); clearFilter(); }}
              >
                <span className="network-tab-icon">📥</span>
                <span className="network-tab-text">Received</span>
                {incoming.length > 0 && <span className="network-notification-badge">{incoming.length}</span>}
              </div>

              <div 
                className={`network-tab-item ${activeTab === 'sent' ? 'active' : ''}`} 
                onClick={() => { setActiveTab('sent'); clearFilter(); }}
              >
                <span className="network-tab-icon">📤</span>
                <span className="network-tab-text">Sent</span>
              </div>

              <div 
                className={`network-tab-item ${activeTab === 'connections' ? 'active' : ''}`} 
                onClick={() => { setActiveTab('connections'); clearFilter(); }}
              >
                <span className="network-tab-icon">🤝</span>
                <span className="network-tab-text">Connections</span>
              </div>
            </div>

            {/* Tab Content - People */}
            {activeTab === "people" && (
              <div className="network-tab-content active">
                {activeContent.length === 0 ? (
                  <div className="network-empty-state">
                    <div className="network-empty-icon">👥</div>
                    <h3>{searchQuery ? "No results found" : "No users to connect with"}</h3>
                    <p>{searchQuery ? "Try a different filter or clear the search" : "All users are already connected or have pending requests"}</p>
                    {searchQuery && (
                      <button className="network-connect-btn" onClick={clearFilter} style={{marginTop: '20px', maxWidth: '200px'}}>
                        Show All Users
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="network-users-list">
                    {activeContent.map(user => {
                      const mutualCount = quickActionFilter === 'mutual_connections' ? 
                        calculateMutualConnections(user)?.length || 0 : 0;
                      
                      return (
                        <div key={user._id} className="network-user-card">
                          <div className="network-card-left">
                            <div className="network-card-avatar">
                              {getUserAvatar(user)}
                            </div>
                            <div className="network-card-info">
                              <h3 className="network-card-name">{user.name}</h3>
                              <p className="network-card-details">{user.role}</p>
                              <span className="network-card-department">{user.department || "No department"}</span>
                              {mutualCount > 0 && (
                                <div className="network-mutual-connections-badge">
                                  <span className="network-mutual-icon">🤝</span>
                                  <span className="network-mutual-count">{mutualCount} mutual connection{mutualCount !== 1 ? 's' : ''}</span>
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="network-card-actions">
                            <button 
                              className="network-connect-btn" 
                              onClick={() => handleNetworkAction("request", user._id, user.name, user)}
                            >
                              Connect
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Tab Content - Received Requests */}
            {activeTab === "received" && (
              <div className="network-tab-content active">
                {activeContent.length === 0 ? (
                  <div className="network-empty-state">
                    <div className="network-empty-icon">📥</div>
                    <h3>No pending requests</h3>
                    <p>When someone sends you a request, it will appear here</p>
                  </div>
                ) : (
                  <div className="network-requests-list">
                    {activeContent.map(request => (
                      <div key={request._id} className="network-request-card">
                        <div className="network-card-left">
                          <div className="network-card-avatar">
                            {getUserAvatar(request)}
                          </div>
                          <div className="network-card-info">
                            <h3 className="network-card-name">{request.name}</h3>
                            <p className="network-card-details">{request.role}</p>
                            <span className="network-card-department">{request.department || "No department"}</span>
                          </div>
                        </div>
                        <div className="network-card-actions">
                          <button 
                            className="network-accept-btn" 
                            onClick={() => handleNetworkAction("accept", request._id, request.name, request)}
                          >
                            Accept
                          </button>
                          <button 
                            className="network-reject-btn" 
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

            {/* Tab Content - Sent Requests */}
            {activeTab === "sent" && (
              <div className="network-tab-content active">
                {activeContent.length === 0 ? (
                  <div className="network-empty-state">
                    <div className="network-empty-icon">📤</div>
                    <h3>No sent requests</h3>
                    <p>Connect with people to grow your network</p>
                  </div>
                ) : (
                  <div className="network-sent-list">
                    {activeContent.map(request => (
                      <div key={request._id} className="network-sent-card">
                        <div className="network-card-left">
                          <div className="network-card-avatar">
                            {getUserAvatar(request)}
                          </div>
                          <div className="network-card-info">
                            <h3 className="network-card-name">{request.name}</h3>
                            <p className="network-card-details">{request.role}</p>
                            <span className="network-card-department">{request.department || "No department"}</span>
                            <div className="network-sent-status">
                              <span className="network-status-icon">⏳</span>
                              <span className="network-status-text">Pending</span>
                            </div>
                          </div>
                        </div>
                        <div className="network-card-actions">
                          <button 
                            className="network-cancel-btn" 
                            onClick={() => handleNetworkAction("cancel", request._id, request.name)}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Tab Content - Connections */}
            {activeTab === "connections" && (
              <div className="network-tab-content active">
                {activeContent.length === 0 ? (
                  <div className="network-empty-state">
                    <div className="network-empty-icon">🤝</div>
                    <h3>No connections yet</h3>
                    <p>Start building your professional network</p>
                    <button className="network-connect-btn" onClick={() => setActiveTab("people")} style={{marginTop: '20px'}}>
                      Discover People to Connect With
                    </button>
                  </div>
                ) : (
                  <div className="network-connections-list">
                    {activeContent.map(connection => {
                      const connectionDateDisplay = getConnectionDateDisplay(connection);
                      
                      return (
                        <div key={connection._id} className="network-connection-card">
                          <div className="network-card-left">
                            <div className="network-card-avatar">
                              {getUserAvatar(connection)}
                            </div>
                            <div className="network-card-info">
                              <h3 className="network-card-name">{connection.name}</h3>
                              <p className="network-card-details">{connection.role}</p>
                              <span className="network-card-department">{connection.department || "No department"}</span>
                              {connectionDateDisplay && (
                                <div className="network-connection-date">
                                  <span className="network-date-icon">📅</span>
                                  <span className="network-date-text">Connected {connectionDateDisplay}</span>
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="network-card-actions">
                            <button 
                              className="network-remove-btn" 
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
        </div>

        {/* ========== RIGHT SIDEBAR ========== */}
        <div className="network-sidebar network-right-sidebar">
          {/* Network Analytics */}
          <div className="network-analytics-card">
            <h3 className="network-sidebar-title">
              <span>📊 Network Analytics</span>
            </h3>
            
            <div className="network-suggestions-list">
              {[
                ["📈", "Network Growth", `${networkInsights.networkGrowth.total} connections`, () => setShowNetworkGrowthModal(true)],
                ["🎯", "Common Fields", networkInsights.commonFields.topDepartment, () => setShowCommonFieldsModal(true)],
                ["🔧", "Top Skills", networkInsights.topSkills.topSkill, () => setShowTopSkillsModal(true)],
              ].map(([icon, title, value, onClick], idx) => (
                <div key={idx} className="network-suggestion-item" onClick={onClick}>
                  <div className="network-suggestion-avatar">
                    <span>{icon}</span>
                  </div>
                  <div className="network-suggestion-info">
                    <h4>{title}</h4>
                    <p className="network-suggestion-meta">{value}</p>
                  </div>
                </div>
              ))}
            </div>

            <button 
              className="network-view-all-btn"
              onClick={() => setShowNetworkGrowthModal(true)}
            >
              View all analytics →
            </button>
          </div>

          {/* Quick Stats */}
          <div className="network-analytics-card">
            <h3 className="network-sidebar-title">
              <span>⚡ Quick Stats</span>
            </h3>
            
            <div className="network-mini-stats">
              <div className="network-stats-grid">
                <div className="network-stat-item">
                  <span className="network-stat-number">{connections.length}</span>
                  <span className="network-stat-label">Total</span>
                </div>
                <div className="network-stat-item">
                  <span className="network-stat-number">{incoming.length}</span>
                  <span className="network-stat-label">Pending</span>
                </div>
                <div className="network-stat-item">
                  <span className="network-stat-number">{outgoing.length}</span>
                  <span className="network-stat-label">Sent</span>
                </div>
                <div className="network-stat-item">
                  <span className="network-stat-number">{networkInsights.networkGrowth.dailyChange > 0 ? '+' : ''}{networkInsights.networkGrowth.dailyChange}</span>
                  <span className="network-stat-label">Today</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 📊 NETWORK GROWTH MODAL */}
      {showNetworkGrowthModal && (
        <div className="network-modal-overlay" onClick={() => setShowNetworkGrowthModal(false)}>
          <div className="network-analytics-modal" onClick={e => e.stopPropagation()}>
            <div className="network-modal-header">
              <h3>📊 Network Growth Analytics</h3>
              <button className="network-modal-close" onClick={() => setShowNetworkGrowthModal(false)}>×</button>
            </div>
            
            <div className="network-modal-body">
              <div className="network-analytics-summary">
                <div className="network-timeframe-selector">
                  <h4>View Timeframe:</h4>
                  <div className="network-timeframe-buttons">
                    {[
                      { key: "7days", label: "7 Days" },
                      { key: "30days", label: "30 Days" },
                      { key: "90days", label: "90 Days" },
                      { key: "all", label: "All Time" }
                    ].map(({ key, label }) => (
                      <button
                        key={key}
                        className={`network-timeframe-btn ${graphTimeframe === key ? 'active' : ''}`}
                        onClick={() => handleTimeframeChange(key)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                
                <div className="network-summary-stats">
                  <div className="network-stat-item">
                    <div className="network-stat-number">{networkInsights.networkGrowth.total}</div>
                    <div className="network-stat-label">Total Connections</div>
                  </div>
                  <div className="network-stat-item">
                    <div className="network-stat-number">{networkInsights.networkGrowth.dailyChange > 0 ? '+' : ''}{networkInsights.networkGrowth.dailyChange}</div>
                    <div className="network-stat-label">Today</div>
                  </div>
                  <div className="network-stat-item">
                    <div className="network-stat-number">{networkInsights.networkGrowth.weeklyChange > 0 ? '+' : ''}{networkInsights.networkGrowth.weeklyChange}</div>
                    <div className="network-stat-label">This Week</div>
                  </div>
                  <div className="network-stat-item">
                    <div className="network-stat-number">{networkInsights.networkGrowth.monthlyChange > 0 ? '+' : ''}{networkInsights.networkGrowth.monthlyChange}</div>
                    <div className="network-stat-label">This Month</div>
                  </div>
                </div>
                
                <div className="network-growth-chart">
                  <h4>📈 Network Growth Timeline</h4>
                  <div className="network-line-chart-container">
                    <LineChart 
                      data={networkInsights.networkGrowth.historicalData}
                      maxValue={networkInsights.networkGrowth.maxHistoricalValue}
                      color="#a78bfa"
                      height={280}
                    />
                  </div>
                </div>
              </div>
            </div>
            
            <div className="network-modal-actions">
              <button className="network-modal-btn" onClick={() => {
                setShowNetworkGrowthModal(false);
                setQuickActionFilter('recent_connections');
                setSearchQuery("Recent connections");
                setActiveTab("connections");
              }}>
                <span className="network-modal-icon">🔄</span>
                View Recent Connections
              </button>
              <button className="network-modal-btn cancel" onClick={() => setShowNetworkGrowthModal(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🔵 COMMON FIELDS MODAL */}
      {showCommonFieldsModal && (
        <div className="network-modal-overlay" onClick={() => setShowCommonFieldsModal(false)}>
          <div className="network-analytics-modal" onClick={e => e.stopPropagation()}>
            <div className="network-modal-header">
              <h3>🎯 Common Fields Analysis</h3>
              <button className="network-modal-close" onClick={() => setShowCommonFieldsModal(false)}>×</button>
            </div>
            <div className="network-modal-body">
              <div className="network-analytics-summary">
                <div className="network-summary-stats">
                  <div className="network-stat-item">
                    <div className="network-stat-number">{networkInsights.commonFields.departments.length}</div>
                    <div className="network-stat-label">Common Fields</div>
                  </div>
                  <div className="network-stat-item">
                    <div className="network-stat-number">{networkInsights.commonFields.departments[0]?.count || 0}</div>
                    <div className="network-stat-label">In {networkInsights.commonFields.topDepartment}</div>
                  </div>
                </div>
                
                <div className="network-fields-list">
                  <h4>Top Fields in Your Network</h4>
                  {networkInsights.commonFields.departments.slice(0, 8).map((field, index) => (
                    <div key={index} className="network-field-item">
                      <div className="network-field-rank">{index + 1}</div>
                      <div className="network-field-name">{field.dept}</div>
                      <div className="network-field-count">{field.count} connections</div>
                      <div className="network-field-bar">
                        <div 
                          className="network-field-bar-fill" 
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
            <div className="network-modal-actions">
              <button className="network-modal-btn" onClick={() => {
                setShowCommonFieldsModal(false);
                if (networkInsights.commonFields.topDepartment !== "No common field") {
                  setQuickActionFilter('same_department');
                  setSearchQuery(`People in ${networkInsights.commonFields.topDepartment}`);
                  setActiveTab("people");
                }
              }}>
                <span className="network-modal-icon">🔗</span>
                Connect with {networkInsights.commonFields.topDepartment}
              </button>
              <button className="network-modal-btn cancel" onClick={() => setShowCommonFieldsModal(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🔵 TOP SKILLS MODAL */}
      {showTopSkillsModal && (
        <div className="network-modal-overlay" onClick={() => setShowTopSkillsModal(false)}>
          <div className="network-analytics-modal" onClick={e => e.stopPropagation()}>
            <div className="network-modal-header">
              <h3>🔧 Top Shared Skills Analysis</h3>
              <button className="network-modal-close" onClick={() => setShowTopSkillsModal(false)}>×</button>
            </div>
            <div className="network-modal-body">
              <div className="network-analytics-summary">
                <div className="network-summary-stats">
                  <div className="network-stat-item">
                    <div className="network-stat-number">{networkInsights.topSkills.skills.length}</div>
                    <div className="network-stat-label">Shared Skills</div>
                  </div>
                  <div className="network-stat-item">
                    <div className="network-stat-number">{networkInsights.topSkills.skills[0]?.count || 0}</div>
                    <div className="network-stat-label">Know {networkInsights.topSkills.topSkill}</div>
                  </div>
                </div>
                
                <div className="network-skills-list">
                  <h4>Skill Ranking</h4>
                  {networkInsights.topSkills.skills.slice(0, 10).map((skill, index) => (
                    <div key={index} className="network-skill-item-modal">
                      <div className="network-skill-rank">{index + 1}</div>
                      <div className="network-skill-name">{skill.skill}</div>
                      <div className="network-skill-count">{skill.count} connections</div>
                      <div className="network-skill-bar">
                        <div 
                          className="network-skill-bar-fill" 
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
            <div className="network-modal-actions">
              <button className="network-modal-btn" onClick={() => {
                setShowTopSkillsModal(false);
                if (networkInsights.topSkills.topSkill !== "No shared skills") {
                  setQuickActionFilter('top_skill');
                  setSearchQuery(`People with ${networkInsights.topSkills.topSkill} skill`);
                  setActiveTab("people");
                }
              }}>
                <span className="network-modal-icon">👥</span>
                Find People with {networkInsights.topSkills.topSkill}
              </button>
              <button className="network-modal-btn cancel" onClick={() => setShowTopSkillsModal(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Network;