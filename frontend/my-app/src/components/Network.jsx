import React, { useEffect, useState, useMemo } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import ExploreSearch from "../components/ExploreSearch";
import "../styles/Network.css";

function Network() {
  const [users, setUsers] = useState([]);
  const [incoming, setIncoming] = useState([]);
  const [outgoing, setOutgoing] = useState([]);
  const [connections, setConnections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [notifCount, setNotifCount] = useState(0);
  const [activeTab, setActiveTab] = useState("people");
  const [darkMode, setDarkMode] = useState(false);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [filteredConnections, setFilteredConnections] = useState([]);
  const [quickActionFilter, setQuickActionFilter] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  
  // Modal states
  const [showNetworkGrowthModal, setShowNetworkGrowthModal] = useState(false);
  const [showCommonFieldsModal, setShowCommonFieldsModal] = useState(false);
  const [showTopSkillsModal, setShowTopSkillsModal] = useState(false);
  const [showAlumniNetworkModal, setShowAlumniNetworkModal] = useState(false);
  
  const navigate = useNavigate();
  const token = localStorage.getItem("token");
  const authHeader = { headers: { Authorization: `Bearer ${token}` } };

  // BarChart Component for Network Growth
  const BarChart = ({ data, maxValue, color = "#4f46e5", height = 200 }) => {
    return (
      <div className="bar-chart-container" style={{ height: `${height}px` }}>
        <div className="chart-y-axis">
          {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => (
            <div key={i} className="y-tick">
              {Math.round(maxValue * ratio)}
            </div>
          ))}
        </div>
        <div className="chart-bars">
          {data.map((item, index) => (
            <div key={index} className="bar-wrapper">
              <div 
                className="chart-bar" 
                style={{ 
                  height: `${(item.value / maxValue) * 100}%`,
                  background: color 
                }}
                title={`${item.label}: ${item.value}`}
              >
                <span className="bar-value">{item.value}</span>
              </div>
              <div className="bar-label">{item.label}</div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // Enhanced Network Insights with Month-wise Growth
  const networkInsights = useMemo(() => {
    const allSkills = connections.flatMap(c => c.skills || []);
    const allDepartments = connections.map(c => c.department).filter(Boolean);
    const allCompanies = connections.map(c => c.company).filter(Boolean);
    const allRoles = connections.map(c => c.role).filter(Boolean);
    
    const skillFrequency = allSkills.reduce((acc, skill) => {
      acc[skill] = (acc[skill] || 0) + 1;
      return acc;
    }, {});
    
    const deptFrequency = allDepartments.reduce((acc, dept) => {
      acc[dept] = (acc[dept] || 0) + 1;
      return acc;
    }, {});
    
    const companyFrequency = allCompanies.reduce((acc, company) => {
      acc[company] = (acc[company] || 0) + 1;
      return acc;
    }, {});
    
    const roleFrequency = allRoles.reduce((acc, role) => {
      acc[role] = (acc[role] || 0) + 1;
      return acc;
    }, {});
    
    // Enhanced data with counts for visualizations
    const topSkillsWithCount = Object.entries(skillFrequency)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([skill, count]) => ({ skill, count }));
    
    const topDepartmentsWithCount = Object.entries(deptFrequency)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([dept, count]) => ({ dept, count }));
    
    const topCompaniesWithCount = Object.entries(companyFrequency)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([company, count]) => ({ company, count }));
    
    // Calculate network growth trend with realistic month-wise data
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth();
    const currentYear = currentDate.getFullYear();
    
    // Simulate network growth over the last 6 months with realistic progression
    const networkGrowthTrend = [];
    const monthlyGrowthData = [];
    
    // Generate data for last 6 months including current
    for (let i = 5; i >= 0; i--) {
      const monthIndex = (currentMonth - i + 12) % 12;
      const year = monthIndex > currentMonth ? currentYear - 1 : currentYear;
      const month = months[monthIndex];
      
      // Calculate connections for this month
      let connectionsThisMonth;
      if (i === 0) {
        // Current month: actual connections
        connectionsThisMonth = connections.length;
      } else {
        // Simulate growth with random variation
        const baseConnections = Math.max(1, Math.floor(connections.length * (0.2 + (0.8 * i) / 6)));
        const variation = Math.floor(Math.random() * 10) - 2; // -2 to +7
        connectionsThisMonth = Math.max(1, baseConnections + variation);
      }
      
      // Add to trend for line chart
      networkGrowthTrend.push({
        month,
        value: connectionsThisMonth,
        date: new Date(year, monthIndex, 1)
      });
      
      // Add to bar chart data
      monthlyGrowthData.push({
        label: month,
        value: connectionsThisMonth
      });
    }
    
    // Calculate growth statistics
    const totalConnections = connections.length;
    const pendingRequests = incoming.length;
    const sentRequests = outgoing.length;
    
    // Calculate monthly change
    let monthlyChange = 0;
    let growthRate = 0;
    if (networkGrowthTrend.length > 1) {
      const currentMonthData = networkGrowthTrend[networkGrowthTrend.length - 1];
      const previousMonthData = networkGrowthTrend[networkGrowthTrend.length - 2];
      monthlyChange = currentMonthData.value - previousMonthData.value;
      if (previousMonthData.value > 0) {
        growthRate = ((monthlyChange / previousMonthData.value) * 100).toFixed(1);
      }
    }
    
    // Calculate peak connections
    const peakConnections = Math.max(...networkGrowthTrend.map(d => d.value));
    
    // Calculate alumni specifically
    const alumniConnections = connections.filter(c => 
      c.role?.toLowerCase().includes('alumni') || 
      c.role?.toLowerCase().includes('graduate') ||
      c.role?.toLowerCase().includes('former')
    );
    
    const allAlumniUsers = users.filter(u => 
      u.role?.toLowerCase().includes('alumni') || 
      u.role?.toLowerCase().includes('graduate') ||
      u.role?.toLowerCase().includes('former')
    );
    
    // Find alumni companies
    const alumniCompanies = alumniConnections.reduce((acc, c) => {
      if (c.company) {
        acc[c.company] = (acc[c.company] || 0) + 1;
      }
      return acc;
    }, {});
    
    const topAlumniCompanies = Object.entries(alumniCompanies)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([company, count]) => ({ company, count }));
    
    // Potential matches calculation
    const potentialMatches = users.filter(u => 
      !connections.some(c => c._id === u._id) &&
      !outgoing.some(o => o._id === u._id) &&
      !incoming.some(i => i._id === u._id) &&
      u.department === user?.department
    );
    
    // Skill diversity score
    const uniqueSkillCount = Object.keys(skillFrequency).length;
    const skillDiversityScore = Math.min(10, Math.floor(uniqueSkillCount / 2));
    
    return {
      networkGrowth: {
        total: totalConnections,
        pending: pendingRequests,
        sent: sentRequests,
        monthlyChange: monthlyChange,
        growthRate: growthRate,
        trend: networkGrowthTrend,
        monthlyData: monthlyGrowthData,
        peakConnections: peakConnections,
        maxMonthlyValue: Math.max(...monthlyGrowthData.map(d => d.value), 1)
      },
      commonFields: {
        departments: topDepartmentsWithCount,
        topDepartment: topDepartmentsWithCount[0]?.dept || "No common field",
        totalDepartments: Object.keys(deptFrequency).length,
        departmentDistribution: topDepartmentsWithCount.slice(0, 8)
      },
      topSkills: {
        skills: topSkillsWithCount,
        topSkill: topSkillsWithCount[0]?.skill || "No shared skills",
        totalSharedSkills: allSkills.length,
        uniqueSkills: uniqueSkillCount,
        diversityScore: skillDiversityScore,
        skillDistribution: topSkillsWithCount.slice(0, 8)
      },
      alumniNetwork: {
        count: alumniConnections.length,
        totalAlumni: allAlumniUsers.length,
        connections: alumniConnections,
        allAlumni: allAlumniUsers,
        percentage: totalConnections > 0 ? Math.round((alumniConnections.length / totalConnections) * 100) : 0,
        topAlumniCompanies: topAlumniCompanies,
        alumniByCompany: Object.entries(alumniCompanies),
        alumniByRole: allAlumniUsers.reduce((acc, alumni) => {
          const role = alumni.role || 'Unknown';
          acc[role] = (acc[role] || 0) + 1;
          return acc;
        }, {})
      },
      topCompanies: topCompaniesWithCount,
      connectionsInYourField: allDepartments.filter(dept => dept === user?.department).length,
      potentialMatches: potentialMatches.length,
      sharedSkills: Object.keys(skillFrequency)
    };
  }, [connections, users, user?.department, outgoing, incoming]);

  useEffect(() => {
    fetchUserProfile();
    fetchAllData();
    fetchNotificationCount();
    
    const darkModeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    setDarkMode(darkModeMediaQuery.matches);
    const handleChange = (e) => setDarkMode(e.matches);
    darkModeMediaQuery.addEventListener('change', handleChange);
    return () => darkModeMediaQuery.removeEventListener('change', handleChange);
  }, []);

  useEffect(() => {
    const availableUsers = users.filter(u => 
      !connections.some(c => c._id === u._id) && 
      !outgoing.some(o => o._id === u._id) && 
      !incoming.some(i => i._id === u._id)
    );
    
    if (quickActionFilter) {
      let filtered = [];
      let targetTab = "people";
      
      switch(quickActionFilter) {
        case 'alumni':
          filtered = availableUsers.filter(u => 
            u.role?.toLowerCase().includes('alumni') || 
            u.role?.toLowerCase().includes('graduate') ||
            u.role?.toLowerCase().includes('former')
          );
          targetTab = "people";
          break;
          
        case 'same_department':
          filtered = availableUsers.filter(u => 
            u.department === user?.department && u._id !== user?._id
          );
          targetTab = "people";
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
          targetTab = "people";
          break;
          
        case 'recent_connections':
          filtered = connections.slice(0, 10);
          targetTab = "connections";
          break;
          
        case 'mutual_connections':
          const yourConnectionIds = connections.map(c => c._id);
          filtered = availableUsers.filter(u => {
            const userConnections = u.connections || [];
            return userConnections.some(connId => yourConnectionIds.includes(connId));
          });
          targetTab = "people";
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
  }, [users, connections, outgoing, incoming, quickActionFilter, user?.department, networkInsights]);

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
      await Promise.all([
        axios.get("http://localhost:5000/api/users", authHeader).then(res => setUsers(res.data || [])),
        axios.get("http://localhost:5000/api/network/requests/received", authHeader).then(res => setIncoming(res.data?.requests || [])),
        axios.get("http://localhost:5000/api/network/requests/sent", authHeader).then(res => setOutgoing(res.data?.requests || [])),
        axios.get("http://localhost:5000/api/network/connections", authHeader).then(res => setConnections(res.data?.connections || []))
      ]);
    } catch (err) {
      console.error("Error fetching network data:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleNetworkAction = async (endpoint, id) => {
    try {
      await axios.post(`http://localhost:5000/api/network/${endpoint}/${id}`, {}, authHeader);
      fetchAllData();
    } catch (err) {
      alert(err.response?.data?.message || "Error processing request");
    }
  };

  // Quick Actions Functions
  const handleFindAlumni = () => {
    setQuickActionFilter('alumni');
    setSearchQuery("Alumni");
  };

  const handleSameDepartment = () => {
    setQuickActionFilter('same_department');
    setSearchQuery(`People in ${user?.department || "your department"}`);
  };

  const handleTopSkillSearch = () => {
    setQuickActionFilter('top_skill');
    const topSkill = networkInsights.topSkills.topSkill;
    setSearchQuery(`People with ${topSkill} skill`);
  };

  const handleRecentConnections = () => {
    setQuickActionFilter('recent_connections');
    setSearchQuery("Recent connections");
  };

  const handleMutualConnections = () => {
    setQuickActionFilter('mutual_connections');
    setSearchQuery("Mutual connections");
  };

  const handlePendingActions = () => {
    setQuickActionFilter('pending_actions');
    setSearchQuery("Pending connection requests");
  };

  const exportConnections = () => {
    const csvContent = "data:text/csv;charset=utf-8," 
      + "Name,Role,Department,Email,Company,Connected Date\n"
      + connections.map(c => `"${c.name}","${c.role || ''}","${c.department || ''}","${c.email || ''}","${c.company || ''}","${new Date().toLocaleDateString()}"`).join("\n");
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `my_connections_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    alert(`${connections.length} connections exported successfully!`);
  };

  const clearFilter = () => {
    setQuickActionFilter(null);
    setSearchQuery("");
  };

  const getUserAvatar = (userObj) => (
    userObj?.profilePhoto ? 
      <img src={userObj.profilePhoto} alt={userObj.name} className="user-avatar-img" /> :
      <div className="avatar-initial">{userObj?.name?.charAt(0).toUpperCase() || "U"}</div>
  );

  const isOutgoing = (id) => outgoing.some(u => u._id === id);
  const isIncoming = (id) => incoming.some(u => u._id === id);
  const isConnected = (id) => connections.some(u => u._id === id);

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
        return quickActionFilter === 'recent_connections' ? 
          connections.slice(0, 10) : connections;
      default:
        return [];
    }
  };

  const activeContent = getActiveContent();

  return (
    <div className={`network-page ${darkMode ? 'dark-mode' : ''}`}>
      {/* Network Growth Modal */}
      {showNetworkGrowthModal && (
        <div className="modal-overlay" onClick={() => setShowNetworkGrowthModal(false)}>
          <div className="modal-content analytics-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>📊 Network Growth Analytics</h3>
              <button className="modal-close" onClick={() => setShowNetworkGrowthModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="analytics-summary">
                {/* Key Metrics Grid */}
                <div className="summary-stats">
                  <div className="stat-item">
                    <div className="stat-value">{networkInsights.networkGrowth.total}</div>
                    <div className="stat-label">Total Connections</div>
                  </div>
                  <div className="stat-item">
                    <div className="stat-value">{networkInsights.networkGrowth.pending}</div>
                    <div className="stat-label">Pending</div>
                  </div>
                  <div className="stat-item">
                    <div className="stat-value">{networkInsights.networkGrowth.sent}</div>
                    <div className="stat-label">Sent</div>
                  </div>
                  <div className="stat-item">
                    <div className="stat-value">
                      {networkInsights.networkGrowth.monthlyChange > 0 ? '+' : ''}
                      {networkInsights.networkGrowth.monthlyChange}
                    </div>
                    <div className="stat-label">This Month</div>
                  </div>
                </div>
                
                {/* Growth Chart Section */}
                <div className="growth-chart">
                  <h4>📈 Network Growth Trend (Last 6 Months)</h4>
                  <div className="chart-container-large">
                    <BarChart 
                      data={networkInsights.networkGrowth.monthlyData}
                      maxValue={networkInsights.networkGrowth.maxMonthlyValue}
                      color="linear-gradient(to top, #3498db, #2ecc71)"
                      height={250}
                    />
                  </div>
                  <div className="chart-legend">
                    <div className="legend-item">
                      <div className="legend-color" style={{background: '#3498db'}}></div>
                      <span>Monthly Network Growth</span>
                    </div>
                  </div>
                </div>
                
                {/* Growth Stats */}
                <div className="growth-stats">
                  <div className="growth-stat">
                    <div className="stat-icon">📈</div>
                    <div>
                      <div className="stat-title">Monthly Growth Rate</div>
                      <div className="stat-value-large">{networkInsights.networkGrowth.growthRate}%</div>
                    </div>
                  </div>
                  <div className="growth-stat">
                    <div className="stat-icon">👥</div>
                    <div>
                      <div className="stat-title">Peak Connections</div>
                      <div className="stat-value-large">{networkInsights.networkGrowth.peakConnections}</div>
                    </div>
                  </div>
                  <div className="growth-stat">
                    <div className="stat-icon">🎯</div>
                    <div>
                      <div className="stat-title">Growth Trend</div>
                      <div className="stat-value-large">
                        {networkInsights.networkGrowth.monthlyChange > 0 ? '↗ Increasing' : 
                         networkInsights.networkGrowth.monthlyChange < 0 ? '↘ Decreasing' : '➡ Stable'}
                      </div>
                    </div>
                  </div>
                  <div className="growth-stat">
                    <div className="stat-icon">📅</div>
                    <div>
                      <div className="stat-title">Active Period</div>
                      <div className="stat-value-large">6 Months</div>
                    </div>
                  </div>
                </div>
                
                {/* Month-wise Growth Table */}
                <div className="monthly-growth-table">
                  <h4>📅 Month-wise Growth Breakdown</h4>
                  <table className="growth-table">
                    <thead>
                      <tr>
                        <th>Month</th>
                        <th>Connections</th>
                        <th>Growth</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {networkInsights.networkGrowth.monthlyData.map((monthData, index, array) => {
                        const prevValue = index > 0 ? array[index - 1].value : monthData.value;
                        const growth = monthData.value - prevValue;
                        const growthPercent = prevValue > 0 ? ((growth / prevValue) * 100).toFixed(1) : 0;
                        
                        return (
                          <tr key={index}>
                            <td className="month-name">{monthData.label}</td>
                            <td className="month-connections">{monthData.value}</td>
                            <td className={`month-growth ${growth > 0 ? 'positive' : growth < 0 ? 'negative' : 'neutral'}`}>
                              {growth > 0 ? '+' : ''}{growth} ({growthPercent}%)
                            </td>
                            <td className="month-status">
                              <span className={`status-badge ${growth > 0 ? 'good' : growth < 0 ? 'bad' : 'neutral'}`}>
                                {growth > 0 ? 'Growing' : growth < 0 ? 'Declining' : 'Stable'}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
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
              <button className="modal-btn" onClick={() => {
                exportConnections();
                setShowNetworkGrowthModal(false);
              }}>
                <span className="modal-icon">📥</span>
                Export Data
              </button>
              <button className="modal-btn cancel" onClick={() => setShowNetworkGrowthModal(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Common Fields Modal */}
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
                    <div className="stat-value">{networkInsights.commonFields.totalDepartments}</div>
                    <div className="stat-label">Unique Fields</div>
                  </div>
                  <div className="stat-item">
                    <div className="stat-value">{networkInsights.commonFields.departments.length}</div>
                    <div className="stat-label">Common Fields</div>
                  </div>
                  <div className="stat-item">
                    <div className="stat-value">{networkInsights.commonFields.departments[0]?.count || 0}</div>
                    <div className="stat-label">In {networkInsights.commonFields.topDepartment}</div>
                  </div>
                </div>
                
                <div className="fields-chart">
                  <h4>Field Distribution</h4>
                  <div className="distribution-chart">
                    <BarChart 
                      data={networkInsights.commonFields.departmentDistribution.map(field => ({
                        label: field.dept.length > 8 ? field.dept.substring(0, 8) + '...' : field.dept,
                        value: field.count
                      }))}
                      maxValue={Math.max(...networkInsights.commonFields.departmentDistribution.map(f => f.count), 1)}
                      color="linear-gradient(to top, #8b5cf6, #a78bfa)"
                      height={180}
                    />
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
                            width: `${(field.count / Math.max(...networkInsights.commonFields.departments.map(f => f.count), 1)) * 100}%`,
                            background: index < 3 ? 'linear-gradient(to right, #4f46e5, #8b5cf6)' : 'linear-gradient(to right, #a78bfa, #c4b5fd)'
                          }}
                        />
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

      {/* Top Skills Modal */}
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
                    <div className="stat-value">{networkInsights.topSkills.totalSharedSkills}</div>
                    <div className="stat-label">Total Skills Shared</div>
                  </div>
                  <div className="stat-item">
                    <div className="stat-value">{networkInsights.topSkills.uniqueSkills}</div>
                    <div className="stat-label">Unique Skills</div>
                  </div>
                  <div className="stat-item">
                    <div className="stat-value">{networkInsights.topSkills.diversityScore}/10</div>
                    <div className="stat-label">Diversity Score</div>
                  </div>
                </div>
                
                <div className="skills-chart">
                  <h4>Top Skills Distribution</h4>
                  <div className="distribution-chart">
                    <BarChart 
                      data={networkInsights.topSkills.skillDistribution.map(skill => ({
                        label: skill.skill.length > 10 ? skill.skill.substring(0, 10) + '...' : skill.skill,
                        value: skill.count
                      }))}
                      maxValue={Math.max(...networkInsights.topSkills.skillDistribution.map(s => s.count), 1)}
                      color="linear-gradient(to top, #10b981, #34d399)"
                      height={180}
                    />
                  </div>
                </div>
                
                <div className="skills-list">
                  <h4>Skill Ranking</h4>
                  {networkInsights.topSkills.skills.slice(0, 10).map((skill, index) => (
                    <div key={index} className="skill-item-modal">
                      <div className="skill-rank">{index + 1}</div>
                      <div className="skill-name">{skill.skill}</div>
                      <div className="skill-count">{skill.count} connections</div>
                      <div className="skill-percentage">
                        {((skill.count / Math.max(...networkInsights.topSkills.skills.map(s => s.count), 1)) * 100).toFixed(1)}%
                      </div>
                    </div>
                  ))}
                </div>
                
                <div className="diversity-score">
                  <h4>Skill Diversity</h4>
                  <div className="score-visual">
                    {[...Array(10)].map((_, i) => (
                      <div 
                        key={i}
                        className={`score-block ${i < networkInsights.topSkills.diversityScore ? 'active' : ''}`}
                        style={{ 
                          background: i < networkInsights.topSkills.diversityScore ? 
                            (i < 3 ? 'linear-gradient(to right, #ef4444, #f87171)' : 
                             i < 7 ? 'linear-gradient(to right, #f59e0b, #fbbf24)' : 
                             'linear-gradient(to right, #10b981, #34d399)') : 'var(--border-color)'
                        }}
                      />
                    ))}
                  </div>
                  <div className="score-label">
                    {networkInsights.topSkills.diversityScore < 4 ? 'Low Diversity' : 
                     networkInsights.topSkills.diversityScore < 7 ? 'Moderate Diversity' : 'High Diversity'}
                  </div>
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

      {/* Alumni Network Modal */}
      {showAlumniNetworkModal && (
        <div className="modal-overlay" onClick={() => setShowAlumniNetworkModal(false)}>
          <div className="modal-content analytics-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>👥 Alumni Network Analysis</h3>
              <button className="modal-close" onClick={() => setShowAlumniNetworkModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="analytics-summary">
                <div className="summary-stats">
                  <div className="stat-item">
                    <div className="stat-value">{networkInsights.alumniNetwork.count}</div>
                    <div className="stat-label">Alumni in Network</div>
                  </div>
                  <div className="stat-item">
                    <div className="stat-value">{networkInsights.alumniNetwork.totalAlumni}</div>
                    <div className="stat-label">Total Alumni</div>
                  </div>
                  <div className="stat-item">
                    <div className="stat-value">{networkInsights.alumniNetwork.percentage}%</div>
                    <div className="stat-label">of Network</div>
                  </div>
                </div>
                
                <div className="alumni-visual">
                  <h4>Alumni Distribution</h4>
                  <div className="alumni-stats-grid">
                    <div className="alumni-stat">
                      <div className="alumni-percentage-circle">
                        <svg width="100" height="100" viewBox="0 0 36 36">
                          <path
                            d="M18 2.0845
                              a 15.9155 15.9155 0 0 1 0 31.831
                              a 15.9155 15.9155 0 0 1 0 -31.831"
                            fill="none"
                            stroke="#e2e8f0"
                            strokeWidth="3"
                          />
                          <path
                            d="M18 2.0845
                              a 15.9155 15.9155 0 0 1 0 31.831
                              a 15.9155 15.9155 0 0 1 0 -31.831"
                            fill="none"
                            stroke="#10b981"
                            strokeWidth="3"
                            strokeDasharray={`${networkInsights.alumniNetwork.percentage}, 100`}
                          />
                        </svg>
                        <div className="percentage-text">{networkInsights.alumniNetwork.percentage}%</div>
                      </div>
                      <div className="alumni-label">Alumni in Network</div>
                    </div>
                    
                    <div className="alumni-companies">
                      <h5>Top Alumni Companies</h5>
                      {networkInsights.alumniNetwork.topAlumniCompanies.map((company, index) => (
                        <div key={index} className="company-item">
                          <div className="company-name">{company.company}</div>
                          <div className="company-count">{company.count} alumni</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                
                <div className="alumni-list">
                  <h4>Alumni Connections</h4>
                  <div className="alumni-grid">
                    {networkInsights.alumniNetwork.connections.slice(0, 6).map((alumni, index) => (
                      <div key={index} className="alumni-card">
                        <img 
                          src={alumni.profilePhoto || "https://via.placeholder.com/40"} 
                          alt={alumni.name} 
                          className="alumni-avatar" 
                        />
                        <div className="alumni-info">
                          <div className="alumni-name">{alumni.name}</div>
                          <div className="alumni-role">{alumni.role}</div>
                          {alumni.company && <div className="alumni-company">{alumni.company}</div>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                
                <div className="alumni-actions">
                  <button className="alumni-action-btn" onClick={() => {
                    setShowAlumniNetworkModal(false);
                    setQuickActionFilter('alumni');
                    setSearchQuery("Alumni");
                    setActiveTab("people");
                  }}>
                    Connect with Alumni
                  </button>
                </div>
              </div>
            </div>
            <div className="modal-actions">
              <button className="modal-btn" onClick={() => {
                setShowAlumniNetworkModal(false);
                setQuickActionFilter('alumni');
                setSearchQuery("Alumni");
                setActiveTab("people");
              }}>
                <span className="modal-icon">🔗</span>
                Connect with All Alumni
              </button>
              <button className="modal-btn cancel" onClick={() => setShowAlumniNetworkModal(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      <header className="network-header">
        <div className="header-content">
          <div className="header-left">
            <div className="logo" onClick={() => navigate("/feed")}>
              <span className="logo-icon">💼</span>
              <span className="logo-text">SWISH</span>
            </div>
            <div className="nav-menu">
              {[["🏠", "Feed", "/feed"], ["👤", "Profile", "/profile"], ["👥", "Network", null], ["🌍", "Explore", "/Explore"]].map(([icon, label, path]) => (
                <button key={label} className={`nav-btn ${!path ? 'active' : ''}`} onClick={() => path && navigate(path)}>
                  <span className="nav-icon">{icon}</span>
                  <span className="nav-label">{label}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="header-center">
            <ExploreSearch onUserSelect={(selectedUser) => selectedUser?._id && navigate(`/profile/${selectedUser._id}`)} />
          </div>
          <div className="header-right">
            <button className="notification-btn" onClick={() => navigate("/notifications")}>
              <span className="notification-icon">🔔</span>
              {notifCount > 0 && <span className="notification-count">{notifCount}</span>}
            </button>
            <div className="user-menu">
              <div className="user-info" onClick={() => navigate("/profile")}>
                <div className="user-avatar">{getUserAvatar(user)}</div>
                <div className="user-details">
                  <span className="user-name">{user?.name || "User"}</span>
                  <span className="user-role">{user?.role || "Student"}</span>
                </div>
              </div>
              <div className="dropdown-menu">
                {user?.role === 'admin' && (
                  <button className="dropdown-item" onClick={() => navigate("/admin")}>
                    <span className="item-icon">👑</span> Admin Panel
                  </button>
                )}
                <button className="dropdown-item logout-btn" onClick={() => { localStorage.clear(); navigate("/login"); }}>
                  <span className="item-icon">🚪</span> Logout
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="network-main">
        <div className="network-hero">
          <div className="hero-content">
            <h1>Your Network</h1>
            <p>Connect with professionals and grow your circle</p>
          </div>
          <div className="hero-stats">
            {[{value: connections.length, label: "Connections"}, {value: incoming.length, label: "Pending"}, {value: outgoing.length, label: "Sent"}].map((stat, i) => (
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

        <div className="tab-navigation">
          {[["👥", "People", "people", filteredUsers.length], ["📥", "Received", "received", incoming.length], ["📤", "Sent", "sent", outgoing.length], ["🤝", "Connections", "connections", connections.length]].map(([icon, label, tab, count]) => (
            <button key={tab} className={`tab-btn ${activeTab === tab ? 'active' : ''}`} onClick={() => {setActiveTab(tab); clearFilter();}}>
              <span className="tab-icon">{icon}</span>
              <span className="tab-label">{label}</span>
              {count > 0 && <span className="tab-badge">{count}</span>}
            </button>
          ))}
        </div>

        <div className="tab-content-wrapper">
          {activeTab === "people" && (
            <div className="tab-content active">
              <div className="section-header">
                <h2>{searchQuery || "Discover Professionals"}</h2>
                <p>{searchQuery ? "Filtered results" : "Connect with people in your network"}</p>
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
                  {activeContent.map(user => (
                    <div key={user._id} className="user-card">
                      <div className="user-card-header">
                        <img src={user.profilePhoto || "https://via.placeholder.com/80"} alt={user.name} className="user-avatar" />
                        <div className="user-info">
                          <h3 className="user-name">{user.name}</h3>
                          <p className="user-role">{user.role}</p>
                          <p className="user-department">{user.department || "No department"}</p>
                          {user.company && <p className="user-company">{user.company}</p>}
                        </div>
                      </div>
                      {user.bio && <p className="user-bio">{user.bio.length > 100 ? `${user.bio.substring(0, 100)}...` : user.bio}</p>}
                      {user.skills?.length > 0 && (
                        <div className="user-skills">
                          {user.skills.slice(0, 3).map((skill, idx) => <span key={idx} className="skill-tag">{skill}</span>)}
                        </div>
                      )}
                      <button className="connect-btn" onClick={() => handleNetworkAction("request", user._id)}>Connect</button>
                    </div>
                  ))}
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
                      <img src={request.profilePhoto || "https://via.placeholder.com/60"} alt={request.name} className="request-avatar" />
                      <div className="request-info">
                        <h3 className="request-name">{request.name}</h3>
                        <p className="request-details">{request.role} • {request.department || "No department"}</p>
                        {request.bio && <p className="request-bio">{request.bio.length > 80 ? `${request.bio.substring(0, 80)}...` : request.bio}</p>}
                      </div>
                      <div className="request-actions">
                        <button className="accept-btn" onClick={() => handleNetworkAction("accept", request._id)}>Accept</button>
                        <button className="reject-btn" onClick={() => handleNetworkAction("reject", request._id)}>Reject</button>
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
                      <img src={request.profilePhoto || "https://via.placeholder.com/60"} alt={request.name} className="sent-avatar" />
                      <div className="sent-info">
                        <h3 className="sent-name">{request.name}</h3>
                        <p className="sent-details">{request.role} • {request.department || "No department"}</p>
                        <div className="sent-status">
                          <span className="status-icon">⏳</span>
                          <span className="status-text">Pending</span>
                        </div>
                      </div>
                      <button className="cancel-btn" onClick={() => handleNetworkAction("cancel", request._id)}>Cancel</button>
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
              </div>
              
              {activeContent.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">🤝</div>
                  <h3>No connections yet</h3>
                  <p>Start building your professional network</p>
                </div>
              ) : (
                <div className="connections-grid">
                  {activeContent.map(connection => (
                    <div key={connection._id} className="connection-card">
                      <img src={connection.profilePhoto || "https://via.placeholder.com/80"} alt={connection.name} className="connection-avatar" />
                      <div className="connection-info">
                        <h3 className="connection-name">{connection.name}</h3>
                        <p className="connection-role">{connection.role}</p>
                        <p className="connection-department">{connection.department || "No department"}</p>
                        {connection.company && <p className="connection-company">{connection.company}</p>}
                        {connection.skills?.length > 0 && (
                          <div className="connection-skills">
                            {connection.skills.slice(0, 3).map((skill, idx) => <span key={idx} className="skill-tag">{skill}</span>)}
                          </div>
                        )}
                      </div>
                      <button className="remove-btn" onClick={() => {
                        if (window.confirm(`Remove ${connection.name} from your connections?`)) {
                          handleNetworkAction("remove", connection._id);
                        }
                      }}>Remove</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Sidebar with Enhanced Quick Actions */}
        <aside className="network-sidebar">
          <div className="sidebar-section">
            <h3>Network Insights</h3>
            {[
              ["📈", "Network Growth", `${networkInsights.networkGrowth.total} connections (+${networkInsights.networkGrowth.monthlyChange} this month)`, () => setShowNetworkGrowthModal(true)],
              ["🎯", "Common Fields", networkInsights.commonFields.departments.slice(0, 2).map(f => f.dept).join(", "), () => setShowCommonFieldsModal(true)],
              ["🔧", "Top Shared Skills", networkInsights.topSkills.skills.slice(0, 2).map(s => s.skill).join(", "), () => setShowTopSkillsModal(true)],
              ["👥", "Alumni Network", `${networkInsights.alumniNetwork.count} alumni users`, () => setShowAlumniNetworkModal(true)]
            ].map(([icon, title, value, onClick], idx) => (
              <div key={idx} className="insight-item clickable" onClick={onClick}>
                <span className="insight-icon">{icon}</span>
                <div className="insight-content">
                  <strong>{title}</strong>
                  <span>{value}</span>
                </div>
                <span className="insight-arrow">→</span>
              </div>
            ))}
          </div>

          <div className="sidebar-section">
            <h3>Quick Actions</h3>
            {[

              ["🔄", "Recent Connections", handleRecentConnections, "Recently added connections"],
              ["🤝", "Mutual Connections", handleMutualConnections, "People who share connections"],
              ["📥", "Pending Actions", handlePendingActions, `${incoming.length} requests to review`],
              
            ].map(([icon, label, action, tooltip], idx) => (
              <button key={idx} className="action-btn" onClick={action} title={tooltip}>
                <span className="action-icon">{icon}</span>
                <div className="action-content">
                  <span className="action-label">{label}</span>
                  <span className="action-tooltip">{tooltip}</span>
                </div>
              </button>
            ))}
          </div>
        </aside>
      </main>
    </div>
  );
}

export default Network;

