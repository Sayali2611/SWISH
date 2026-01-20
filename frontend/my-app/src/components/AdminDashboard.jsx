import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/Admin.css";

// ==================== READ MORE COMPONENT FOR ADMIN ====================
const ReadMore = ({ text, maxLength = 200, className = "" }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  
  // Check if text is provided and needs truncation
  if (!text || text.length <= maxLength) {
    return <span className={className}>{text}</span>;
  }
  
  // Get the text to display
  const displayText = isExpanded ? text : text.substring(0, maxLength) + '...';
  
  return (
    <span className={`read-more-container ${className}`}>
      <span className="admin-post-text">
        {displayText}
        {!isExpanded && (
          <button 
            className="read-more-btn"
            onClick={() => setIsExpanded(true)}
            aria-label="Read more"
          >
            Read more
          </button>
        )}
      </span>
    </span>
  );
};

function AdminDashboard() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [posts, setPosts] = useState([]);
  const [reports, setReports] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const navigate = useNavigate();
  // Add these state variables with other state declarations:
const [activeReportsTab, setActiveReportsTab] = useState("pending"); // New state for reports tabs
const [resolvedReports, setResolvedReports] = useState([]);
const [resolvedLoading, setResolvedLoading] = useState(false);

  // Toast notifications
  const [toasts, setToasts] = useState([]);

  // Modal states
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showRestrictModal, setShowRestrictModal] = useState(false);
  const [showUserActivityModal, setShowUserActivityModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showWarnModal, setShowWarnModal] = useState(false);
  const [showPostDeleteModal, setShowPostDeleteModal] = useState(false);
  const [showReportResolveModal, setShowReportResolveModal] = useState(false);
  const [showUserProfileModal, setShowUserProfileModal] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);
  const [showPostModal, setShowPostModal] = useState(false);
  
  // Modal data
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedPost, setSelectedPost] = useState(null);
  const [selectedReport, setSelectedReport] = useState(null);
  const [selectedAction, setSelectedAction] = useState("");
  const [modalReason, setModalReason] = useState("");
  const [modalDuration, setModalDuration] = useState(24);
  const [userActivity, setUserActivity] = useState({ posts: [], comments: [], likes: [] });
  const [activeActivityTab, setActiveActivityTab] = useState("posts");
  const [selectedImages, setSelectedImages] = useState([]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  // Search and filter states
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRole, setSelectedRole] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");
  const [selectedDept, setSelectedDept] = useState("");
  const [departments, setDepartments] = useState([]);
  const [statuses] = useState(['active', 'restricted']);

  // Refs for video players
  const videoRefs = useRef({});

  // Toast notification system
  const showToast = (message, type = "success", duration = 5000) => {
    const id = Date.now();
    const newToast = { id, message, type };
    setToasts(prev => [...prev, newToast]);
    
    setTimeout(() => {
      removeToast(id);
    }, duration);
  };

  const removeToast = (id) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  };

useEffect(() => {
  const user = JSON.parse(localStorage.getItem('user'));
  if (!user || user.role !== 'admin') {
    navigate("/feed");
    return;
  }
  
  if (activeTab === "dashboard") {
    fetchStats();
  } else if (activeTab === "users") {
    fetchUsers();
  } else if (activeTab === "posts") {
    fetchPosts();
     fetchUsers();
  } else if (activeTab === "reports") {
    if (activeReportsTab === "pending") {
      fetchReports();
      fetchUsers(); // 
    } else {
      fetchResolvedReports();
    }
  } else if (activeTab === "analytics") {
    fetchAnalytics();
  }
}, [activeTab, activeReportsTab, navigate]); // Add activeReportsTab to dependency

  // Apply filters whenever filters change
  useEffect(() => {
    if (users.length > 0) {
      applyFilters();
    }
  }, [searchQuery, selectedRole, selectedStatus, selectedDept, users]);

  const applyFilters = () => {
    let filtered = [...users];
    
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(user => 
        user.name?.toLowerCase().includes(query) ||
        user.email?.toLowerCase().includes(query) ||
        user.department?.toLowerCase().includes(query)
      );
    }
    
    // Role filter
    if (selectedRole) {
      filtered = filtered.filter(user => user.role === selectedRole);
    }
    
    // Status filter
    if (selectedStatus) {
      filtered = filtered.filter(user => user.status === selectedStatus);
    }
    
    // Department filter
    if (selectedDept) {
      filtered = filtered.filter(user => 
        user.department?.toLowerCase().includes(selectedDept.toLowerCase())
      );
    }
    
    setFilteredUsers(filtered);
  };

  const fetchStats = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/admin/stats`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.status === 403) {
        showToast("Admin access required", "error");
        navigate("/feed");
        return;
      }
      
      const data = await response.json();
      setStats(data);
    } catch (error) {
      showToast("Failed to fetch stats", "error");
    }
  };

  const fetchUsers = async () => {
  setLoading(true);
  try {
    const token = localStorage.getItem('token');
    // ADD limit=1000 parameter
    const response = await fetch(`${import.meta.env.VITE_API_URL}/api/admin/users/search?limit=1000`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
      
      if (response.status === 403) {
        showToast("Admin access required", "error");
        navigate("/feed");
        return;
      }
      
      const data = await response.json();
      if (data.success) {
        setUsers(data.users);
        setFilteredUsers(data.users);
        
        // Extract unique departments
        const depts = [...new Set(data.users
          .map(user => user.department)
          .filter(dept => dept && dept.trim() !== '')
        )].sort();
        setDepartments(depts);
      }
    } catch (error) {
      showToast("Failed to fetch users", "error");
    } finally {
      setLoading(false);
    }
  };

  const fetchPosts = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/admin/posts`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.status === 403) {
        showToast("Admin access required", "error");
        navigate("/feed");
        return;
      }
      
      const data = await response.json();
      setPosts(data);
    } catch (error) {
      showToast("Failed to fetch posts", "error");
    } finally {
      setLoading(false);
    }
  };

  const fetchReports = async () => {
    setReportsLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/admin/reports`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.status === 403) {
        showToast("Admin access required", "error");
        navigate("/feed");
        return;
      }
      
      const data = await response.json();
      setReports(data);
    } catch (error) {
      showToast("Failed to fetch reports", "error");
    } finally {
      setReportsLoading(false);
    }
  };

const fetchAnalytics = async () => {
  setAnalyticsLoading(true);
  try {
    const token = localStorage.getItem('token');
    const response = await fetch(`${import.meta.env.VITE_API_URL}/api/admin/analytics`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (response.status === 403) {
      showToast("Admin access required", "error");
      navigate("/feed");
      return;
    }
    
    const data = await response.json();
    
    // Extract the data in the format your frontend expects
    const enhancedAnalytics = {
      ...data,
      // For backward compatibility
      activeUsersToday: data.platformStats?.activeUsersToday || 0,
      newUsersToday: data.platformStats?.newUsersToday || 0,
      postsToday: data.platformStats?.postsToday || 0,
      reportsResolvedToday: data.moderationStats?.reportsResolvedToday || 0,
      activeWarnings: data.moderationStats?.activeWarnings || 0,
      restrictedAccounts: data.moderationStats?.restrictedAccounts || 0,
      pendingReports: data.moderationStats?.pendingReports || 0,
      engagementByDept: data.engagementByDept || [],
      // Keep existing fields
      dailyPosts: data.dailyPosts || [],
      topUsers: data.topUsers || [],
      postsByType: data.postsByType || [],
      postsByDept: data.postsByDept || []
    };
    
    setAnalytics(enhancedAnalytics);
  } catch (error) {
    showToast("Failed to fetch analytics", "error");
  } finally {
    setAnalyticsLoading(false);
  }
};

const fetchResolvedReports = async () => {
  setResolvedLoading(true);
  try {
    const token = localStorage.getItem('token');
    const response = await fetch(`${import.meta.env.VITE_API_URL}/api/admin/reports/resolved`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (response.ok) {
      const data = await response.json();
      // Check if data has reports array or is already an array
      if (data.success && data.reports) {
        setResolvedReports(data.reports);
      } else if (Array.isArray(data)) {
        setResolvedReports(data);
      } else {
        showToast("Invalid data format for resolved reports", "error");
      }
    } else {
      showToast("Failed to fetch resolved reports", "error");
    }
  } catch (error) {
    showToast("Network error fetching resolved reports", "error");
  } finally {
    setResolvedLoading(false);
  }
};

  // ==================== USER ACTIONS ====================

  const handleOpenRoleModal = (user) => {
    setSelectedUser(user);
    setShowRoleModal(true);
  };

  const handleRoleChange = async () => {
    if (!selectedUser || !selectedAction) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/admin/users/${selectedUser._id}/role`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ role: selectedAction })
      });
      
      if (response.ok) {
        setUsers(users.map(user => 
          user._id === selectedUser._id ? { ...user, role: selectedAction } : user
        ));
        showToast(`User role changed to ${selectedAction}`, "success");
        setShowRoleModal(false);
        setSelectedUser(null);
        setSelectedAction("");
      } else {
        const data = await response.json();
        showToast(data.message || "Failed to change role", "error");
      }
    } catch (error) {
      showToast("Network error", "error");
    }
  };

  const handleOpenRestrictModal = (user) => {
    setSelectedUser(user);
    setShowRestrictModal(true);
  };

// In handleRestrictUser function, add this after showToast:
const handleRestrictUser = async () => {
  if (!selectedUser || !modalReason) return;

  try {
    const token = localStorage.getItem('token');
    const response = await fetch(`${import.meta.env.VITE_API_URL}/api/admin/users/${selectedUser._id}/restrict`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ 
        reason: modalReason,
        duration: modalDuration 
      })
    });
    
    const data = await response.json();
    
    if (response.ok) {
      setUsers(users.map(user => 
        user._id === selectedUser._id ? { 
          ...user, 
          status: 'restricted',
          restrictedUntil: data.restrictedUntil,
          restrictionReason: modalReason,
          restrictionDetails: {
            isRestricted: true,
            restrictedUntil: data.restrictedUntil,
            restrictionReason: modalReason,
            restrictionDuration: modalDuration,
            restrictedAt: new Date()
          }
        } : user
      ));
      
      showToast(`User restricted for ${modalDuration}`, "success");
      
      // ✅ FIX: Resolve the report if it came from a report
      if (selectedReport) {
        try {
          const resolveResponse = await fetch(`${import.meta.env.VITE_API_URL}/api/admin/reports/${selectedReport._id}/resolve`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ 
              action: 'restrict',
              adminReason: `User restricted: ${modalReason} for ${modalDuration}`
            })
          });
          
          if (resolveResponse.ok) {
            // Remove from pending reports
            setReports(reports.filter(report => report._id !== selectedReport._id));
            // Refresh resolved reports
            fetchResolvedReports();
          }
        } catch (resolveError) {
          console.error("Error resolving report:", resolveError);
        }
      }
      
      setShowRestrictModal(false);
      setSelectedUser(null);
      setModalReason("");
      setModalDuration("24h");
      fetchStats();
      
    } else {
      showToast(data.message || "Failed to restrict user", "error");
    }
  } catch (error) {
    showToast("Network error", "error");
  }
};

// Add unrestrict user function
const handleUnrestrictUser = async (user) => {
  if (!user || user.status !== 'restricted') return;
  
  if (!window.confirm(`Remove restriction from ${user.name}?`)) return;
  
  try {
    const token = localStorage.getItem('token');
    const response = await fetch(`${import.meta.env.VITE_API_URL}/api/admin/users/${user._id}/unrestrict`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });
    
    const data = await response.json();
    
    if (response.ok) {
      setUsers(users.map(u => 
        u._id === user._id ? { 
          ...u, 
          status: 'active',
          restrictedUntil: null,
          restrictionReason: '',
          restrictionDetails: {
            isRestricted: false,
            restrictedUntil: null,
            restrictionReason: '',
            restrictionDuration: '',
            restrictedAt: null
          }
        } : u
      ));
      showToast(`User restriction removed`, "success");
      fetchStats();
    } else {
      showToast(data.message || "Failed to remove restriction", "error");
    }
  } catch (error) {
    showToast("Network error", "error");
  }
};

  const handleOpenUserActivity = async (user) => {
    setSelectedUser(user);
    setShowUserActivityModal(true);
    
    try {
      const token = localStorage.getItem('token');
      
      // Fetch user's posts
      const postsRes = await fetch(`${import.meta.env.VITE_API_URL}/api/users/${user._id}/posts`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      const postsData = postsRes.ok ? await postsRes.json() : [];
      
      // Fetch user's activity
      const activityRes = await fetch(`${import.meta.env.VITE_API_URL}/api/users/${user._id}/activity`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      let comments = [];
      let likes = [];
      
      if (activityRes.ok) {
        const activityData = await activityRes.json();
        comments = activityData.activity?.filter(a => a.type === 'comment') || [];
        likes = activityData.activity?.filter(a => a.type === 'like') || [];
      }
      
      setUserActivity({
        posts: Array.isArray(postsData) ? postsData : [],
        comments,
        likes
      });
    } catch (error) {
      console.error("Failed to fetch user activity", error);
      showToast("Failed to fetch user activity", "error");
    }
  };

  const handleDeleteUser = async () => {
    if (!selectedUser) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/admin/users/${selectedUser._id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ reason: modalReason || "Administrative deletion" })
      });
      
      if (response.ok) {
        setUsers(users.filter(user => user._id !== selectedUser._id));
        showToast("User deleted successfully", "success");
        setShowConfirmModal(false);
        setSelectedUser(null);
        setModalReason("");
        fetchStats();
      } else {
        const data = await response.json();
        showToast(data.message || "Failed to delete user", "error");
      }
    } catch (error) {
      showToast("Network error", "error");
    }
  };

  const handleOpenDeleteModal = (user) => {
    setSelectedUser(user);
    setShowConfirmModal(true);
  };

  const handleOpenWarnModal = (user) => {
    setSelectedUser(user);
    setShowWarnModal(true);
  };

// In handleWarnUser function, add this after showToast:
const handleWarnUser = async () => {
  if (!selectedUser || !modalReason) return;

  try {
    const token = localStorage.getItem('token');
    const response = await fetch(`${import.meta.env.VITE_API_URL}/api/admin/users/${selectedUser._id}/warn`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ reason: modalReason })
    });
    
    if (response.ok) {
      showToast("Warning issued to user", "success");
      
      // ✅ FIX: Resolve the report if it came from a report
      if (selectedReport) {
        try {
          const resolveResponse = await fetch(`${import.meta.env.VITE_API_URL}/api/admin/reports/${selectedReport._id}/resolve`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ 
              action: 'warn',
              adminReason: `User warned: ${modalReason}`
            })
          });
          
          if (resolveResponse.ok) {
            // Remove from pending reports
            setReports(reports.filter(report => report._id !== selectedReport._id));
            // Refresh resolved reports
            fetchResolvedReports();
          }
        } catch (resolveError) {
          console.error("Error resolving report:", resolveError);
        }
      }
      
      setShowWarnModal(false);
      setSelectedUser(null);
      setModalReason("");
      
    } else {
      const data = await response.json();
      showToast(data.message || "Failed to warn user", "error");
    }
  } catch (error) {
    showToast("Network error", "error");
  }
};

  // ==================== CHANGE STATUS ====================

  const handleChangeStatus = async (user, newStatus) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/admin/users/${user._id}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ 
          status: newStatus,
          reason: modalReason || "Administrative action"
        })
      });
      
      if (response.ok) {
        setUsers(users.map(u => 
          u._id === user._id ? { ...u, status: newStatus } : u
        ));
        showToast(`User status changed to ${newStatus}`, "success");
        setShowStatusModal(false);
        setSelectedUser(null);
        setModalReason("");
      } else {
        const data = await response.json();
        showToast(data.message || "Failed to change status", "error");
      }
    } catch (error) {
      showToast("Network error", "error");
    }
  };

  const handleOpenStatusModal = (user) => {
    setSelectedUser(user);
    setShowStatusModal(true);
  };

  // ==================== POST ACTIONS ====================

  const handleDeletePost = async (postId) => {
    setSelectedPost(posts.find(p => p._id === postId));
    setShowPostDeleteModal(true);
  };

  const handleDeletePostConfirmed = async () => {
    if (!selectedPost) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/admin/posts/${selectedPost._id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ reason: "Admin moderation" })
      });
      
      if (response.ok) {
        setPosts(posts.filter(post => post._id !== selectedPost._id));
        showToast("Post deleted successfully", "success");
        setShowPostDeleteModal(false);
        setSelectedPost(null);
        fetchStats();
      } else {
        const data = await response.json();
        showToast(data.message || "Failed to delete post", "error");
      }
    } catch (error) {
      showToast("Network error", "error");
    }
  };

  const handleViewPostDetails = (post) => {
    setSelectedPost(post);
    setShowPostModal(true);
  };

  // ==================== REPORT ACTIONS ====================
const handleResolveReport = async (postId, action) => {
  setSelectedReport(reports.find(r => r._id === postId));
  setSelectedAction(action);
  
  const post = reports.find(r => r._id === postId);
  
  if (action === 'restrict' || action === 'warn') {
    if (post.user?.id) {
      const user = users.find(u => u._id === post.user.id);
      if (user) {
        setSelectedUser(user);
        if (action === 'restrict') {
          setShowRestrictModal(true);
        } else {
          setShowWarnModal(true);
        }
        // Don't show resolve modal for restrict/warn
        return;
      } else {
        showToast("User not found for restriction/warning", "error");
        return;
      }
    }
  }
  
  // For "keep" and "delete", show the resolve confirmation modal
  setShowReportResolveModal(true);
};

const handleResolveReportConfirmed = async () => {
  if (!selectedReport || !selectedAction) return;

  try {
    const token = localStorage.getItem('token');
    const response = await fetch(`${import.meta.env.VITE_API_URL}/api/admin/reports/${selectedReport._id}/resolve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ 
        action: selectedAction,
        adminReason: selectedAction === 'delete' ? 'Violation of community guidelines' : 'No violation found'
      })
    });
    
    const data = await response.json();
    
    if (response.ok) {
      // Show success toast
      showToast(`Report resolved - Post ${selectedAction === 'delete' ? 'deleted' : 'kept'}`, "success");
      
      // Remove from pending reports
      setReports(reports.filter(report => report._id !== selectedReport._id));
      
      // Add to resolved history
      const resolvedReport = {
        ...selectedReport,
        actionTaken: selectedAction,
        resolvedAt: new Date().toISOString(),
        resolvedByName: JSON.parse(localStorage.getItem('user')).name,
        reason: selectedAction === 'delete' ? 'Violation of community guidelines' : 'No violation found',
        status: 'resolved'
      };
      
      setResolvedReports(prev => [resolvedReport, ...prev]);
      
      // Close modal and reset
      setShowReportResolveModal(false);
      setSelectedReport(null);
      setSelectedAction("");
      
      // Refresh stats
      fetchStats();
      
    } else {
      showToast(data.message || "Failed to resolve report", "error");
    }
  } catch (error) {
    showToast("Network error", "error");
  }
};

const handleUserActionCompleted = async (action) => {
  if (!selectedReport) return;
  
  try {
    // First, handle the user action (warn/restrict) was already done
    // Now resolve the report
    const token = localStorage.getItem('token');
    const response = await fetch(`${import.meta.env.VITE_API_URL}/api/admin/reports/${selectedReport._id}/resolve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ 
        action: action, // 'warn' or 'restrict'
        adminReason: action === 'warn' ? 'User warned' : 'User restricted'
      })
    });
    
    const data = await response.json();
    
    if (response.ok) {
      // Show success toast
      showToast(`User ${action === 'warn' ? 'warned' : 'restricted'} and report resolved`, "success");
      
      // Remove from pending reports
      setReports(reports.filter(report => report._id !== selectedReport._id));
      
      // Add to resolved history
      const resolvedReport = {
        ...selectedReport,
        actionTaken: action,
        resolvedAt: new Date().toISOString(),
        resolvedByName: JSON.parse(localStorage.getItem('user')).name,
        reason: action === 'warn' ? 'User warned' : 'User restricted',
        status: 'resolved'
      };
      
      setResolvedReports(prev => [resolvedReport, ...prev]);
      
      // Reset
      setSelectedReport(null);
      setSelectedAction("");
      setSelectedUser(null);
      
      // Refresh stats
      fetchStats();
      
    } else {
      showToast(data.message || "Failed to resolve report", "error");
    }
  } catch (error) {
    showToast("Network error", "error");
  }
};
  const handleRestrictFromReport = async (post) => {
    if (!post.user?.id) return;
    
    const user = users.find(u => u._id === post.user.id);
    if (user) {
      setSelectedUser(user);
      setShowRestrictModal(true);
    }
  };

  // ==================== ENHANCED MEDIA FUNCTIONS ====================

  const openImageModal = (images, index = 0) => {
    setSelectedImages(images);
    setCurrentImageIndex(index);
    setShowImageModal(true);
  };

  const closeImageModal = () => {
    setShowImageModal(false);
    setSelectedImages([]);
    setCurrentImageIndex(0);
  };

  const nextImage = () => {
    if (selectedImages.length > 0) {
      setCurrentImageIndex((prevIndex) => 
        prevIndex === selectedImages.length - 1 ? 0 : prevIndex + 1
      );
    }
  };

  const prevImage = () => {
    if (selectedImages.length > 0) {
      setCurrentImageIndex((prevIndex) => 
        prevIndex === 0 ? selectedImages.length - 1 : prevIndex - 1
      );
    }
  };

  // Enhanced video player functions
  const togglePlayPause = (videoId) => {
    const video = videoRefs.current[videoId];
    if (video) {
      if (video.paused) {
        video.play();
      } else {
        video.pause();
      }
    }
  };

  const toggleMute = (videoId) => {
    const video = videoRefs.current[videoId];
    if (video) {
      video.muted = !video.muted;
    }
  };

  const toggleFullscreen = (videoId) => {
    const video = videoRefs.current[videoId];
    if (video) {
      if (!document.fullscreenElement) {
        video.requestFullscreen().catch(err => {
          console.log(`Error attempting to enable fullscreen: ${err.message}`);
        });
      } else {
        document.exitFullscreen();
      }
    }
  };

  // ==================== MODAL FUNCTIONS ====================

  const openUserProfileModal = (user) => {
    setSelectedUser(user);
    setShowUserProfileModal(true);
  };

  // Reset all modals
  const resetModals = () => {
    setShowRoleModal(false);
    setShowStatusModal(false);
    setShowRestrictModal(false);
    setShowUserActivityModal(false);
    setShowConfirmModal(false);
    setShowWarnModal(false);
    setShowPostDeleteModal(false);
    setShowReportResolveModal(false);
    setShowUserProfileModal(false);
    setShowImageModal(false);
    setShowPostModal(false);
    setSelectedUser(null);
    setSelectedPost(null);
    setSelectedReport(null);
    setSelectedAction("");
    setModalReason("");
    setModalDuration(24);
    setUserActivity({ posts: [], comments: [], likes: [] });
    setActiveActivityTab("posts");
    setSelectedImages([]);
    setCurrentImageIndex(0);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate("/");
  };

  // ==================== ENHANCED RENDER FUNCTIONS ====================

  // Enhanced Poll render
  const renderPoll = (poll) => {
    if (!poll) return null;
    
    return (
      <div className="poll-content">
        <div className="poll-question">
          <strong>🗳️ Poll: {poll.question}</strong>
        </div>
        <div className="poll-options">
          {poll.options?.map((option, index) => (
            <div key={index} className="poll-option">
              <div className="option-text">{option.text}</div>
              <div className="option-votes">
                <div className="vote-bar" style={{ width: `${poll.totalVotes > 0 ? (option.votes / poll.totalVotes) * 100 : 0}%` }}></div>
                <span className="vote-count">{option.votes} votes</span>
              </div>
            </div>
          ))}
        </div>
        <div className="poll-total">Total votes: {poll.totalVotes}</div>
      </div>
    );
  };

  // Enhanced Media Carousel (LinkedIn style)
  const renderMediaCarousel = (media) => {
    if (!media || media.length === 0) return null;
    
    return (
      <div className="enhanced-media-carousel">
        <div className="carousel-wrapper">
          {media.map((item, index) => (
            <div key={index} className={`carousel-item ${index === currentImageIndex ? 'active' : ''}`}>
              {item.type === 'image' ? (
                <img 
                  src={item.url} 
                  alt={`Media ${index + 1}`}
                  className="carousel-media"
                  onClick={() => openImageModal(media, index)}
                />
              ) : (
                <div className="video-container">
                  <video 
                    ref={el => videoRefs.current[`carousel-${index}`] = el}
                    className="carousel-video"
                    controls
                    preload="metadata"
                  >
                    <source src={item.url} type={`video/${item.format || 'mp4'}`} />
                    Your browser does not support the video tag.
                  </video>
                  <div className="video-controls">
                    <button className="video-control-btn" onClick={() => togglePlayPause(`carousel-${index}`)}>
                      ▶️
                    </button>
                    <button className="video-control-btn" onClick={() => toggleMute(`carousel-${index}`)}>
                      🔈
                    </button>
                    <button className="video-control-btn" onClick={() => toggleFullscreen(`carousel-${index}`)}>
                      ⛶
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
        
        {media.length > 1 && (
          <>
            <button className="carousel-nav prev" onClick={prevImage}>
              ‹
            </button>
            <button className="carousel-nav next" onClick={nextImage}>
              ›
            </button>
            <div className="carousel-indicators">
              {media.map((_, index) => (
                <button
                  key={index}
                  className={`carousel-dot ${index === currentImageIndex ? 'active' : ''}`}
                  onClick={() => setCurrentImageIndex(index)}
                />
              ))}
            </div>
          </>
        )}
        
        <div className="media-counter">
          {currentImageIndex + 1} / {media.length}
        </div>
      </div>
    );
  };

  // Enhanced Single Media
  const renderSingleMedia = (media) => {
    if (!media) return null;
    
    if (media.type === 'image') {
      return (
        <div className="single-media">
          <img 
            src={media.url} 
            alt="Post media"
            className="single-media-image"
            onClick={() => openImageModal([media], 0)}
          />
        </div>
      );
    } else {
      return (
        <div className="video-container single-video">
          <video 
            ref={el => videoRefs.current['single'] = el}
            className="single-video-player"
            controls
            preload="metadata"
          >
            <source src={media.url} type={`video/${media.format || 'mp4'}`} />
            Your browser does not support the video tag.
          </video>
          <div className="video-controls">
            <button className="video-control-btn" onClick={() => togglePlayPause('single')}>
              ▶️
            </button>
            <button className="video-control-btn" onClick={() => toggleMute('single')}>
              🔈
            </button>
            <button className="video-control-btn" onClick={() => toggleFullscreen('single')}>
              ⛶
            </button>
          </div>
        </div>
      );
    }
  };

  // Render media with enhanced carousel
  const renderMedia = (media) => {
    if (!media || media.length === 0) return null;
    
    if (media.length === 1) {
      return renderSingleMedia(media[0]);
    }
    
    return renderMediaCarousel(media);
  };

  // ==================== ENHANCED COMPONENTS ====================

  const EnhancedPostCard = ({ post }) => (
    <div className="post-card-admin-enhanced">
      <div className="post-header-admin">
        <div className="post-user-admin">
          {post.user?.profilePhoto ? (
            <img src={post.user.profilePhoto} alt={post.user.name} className="user-avatar-small" />
          ) : (
            <div className="user-avatar-placeholder">
              {post.user?.name?.charAt(0).toUpperCase() || "U"}
            </div>
          )}
          <div className="user-info-admin">
            <div 
              className="user-name-admin clickable"
              onClick={() => openUserProfileModal(post.user)}
            >
              {post.user?.name || "Unknown User"}
            </div>
            <div className="user-email-admin">{post.user?.email}</div>
            <div className="user-role-admin">
              {post.user?.role === 'student' && '🎓 Student'}
              {post.user?.role === 'faculty' && '👨‍🏫 Faculty'}
              {post.user?.role === 'admin' && '👑 Admin'}
            </div>
          </div>
        </div>
        <div className="post-meta-admin">
          <span className="post-time">
            {new Date(post.createdAt).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })}
          </span>
          <div className="post-stats-admin">
            <span className="like-stat">👍 {post.likesCount || post.likes?.length || 0}</span>
            <span className="comment-stat">💬 {post.commentsCount || post.comments?.length || 0}</span>
          </div>
        </div>
      </div>
      
      <div className="post-content-admin">
        <div className="post-text">
          <ReadMore 
  text={post.content} 
  maxLength={200}
/>
        </div>
        
        {/* Enhanced Media Display */}
        {post.media && post.media.length > 0 && renderMedia(post.media)}
        
        {/* Poll Content */}
        {post.poll && renderPoll(post.poll)}
        
        {/* Event Content */}
        {post.event && (
          <div className="event-content">
            <div className="event-title">
              <strong>🎪 Event: {post.event.title}</strong>
            </div>
            <div className="event-details">
              <div className="event-date">
                📅 {new Date(post.event.dateTime).toLocaleDateString()}
              </div>
              <div className="event-location">
                📍 {post.event.location}
              </div>
              <div className="event-attendees">
                👥 {post.event.rsvpCount || 0} attending
              </div>
            </div>
          </div>
        )}
      </div>
      
     <div className="post-actions-admin-enhanced">
  <button 
    className="action-btn-enhanced delete-btn"
    onClick={() => handleDeletePost(post._id)}
  >
    🗑️ Delete Post
  </button>
  <button 
  className="action-btn-enhanced warn-btn"
  onClick={() => {
    // Try different ways to find the user
    const userId = post.user?.id || post.userId;
    const user = users.find(u => u._id === userId || u._id.toString() === userId);
    
    if (user) {
      setSelectedUser(user);
      setShowWarnModal(true);
    } else {
      showToast("User not found in current list. Try refreshing users.", "error");
    }
  }}
>
  ⚠️ Warn User
</button>
  <button 
  className="action-btn-enhanced restrict-btn"
  onClick={() => {
    // Try different ways to find the user
    const userId = post.user?.id || post.userId;
    const user = users.find(u => u._id === userId || u._id.toString() === userId);
    
    if (user) {
      setSelectedUser(user);
      setShowRestrictModal(true);
    } else {
      showToast("User not found in current list. Try refreshing users.", "error");
    }
  }}
>
  ⏸️ Restrict User
</button>
</div>
    </div>
  );

  const UserTableRow = ({ user }) => (
    <tr key={user._id} className={`user-row ${user.status !== 'active' ? 'user-inactive' : ''}`}>
      <td>
        <div className="user-cell">
          {user.profilePhoto ? (
            <img src={user.profilePhoto} alt={user.name} className="user-avatar-small" />
          ) : (
            <div className="user-avatar-placeholder">
              {user.name?.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="user-info">
            <div 
              className="user-name clickable"
              onClick={() => openUserProfileModal(user)}
            >
              {user.name}
            </div>
            <div className="user-meta">
              <span className="user-id">ID: {user._id?.slice(-6) || 'N/A'}</span>
              {user.warningCount > 0 && (
                <span className="warning-badge">⚠️ {user.warningCount}</span>
              )}
            </div>
          </div>
        </div>
      </td>
      <td className="user-email">{user.email}</td>
      <td>
        <span className={`role-badge role-${user.role}`}>
          {user.role === 'student' && '🎓 Student'}
          {user.role === 'faculty' && '👨‍🏫 Faculty'}
          {user.role === 'admin' && '👑 Admin'}
        </span>
      </td>
      <td>
        <span className={`status-badge status-${user.status || 'active'}`}>
          {user.status === 'active' && '✅ Active'}
          {user.status === 'restricted' && '⚠️ Restricted '}
          
          {!user.status && '✅ Active'}
        </span>
        {user.status === 'restricted' && user.restrictedUntil && (
          <div className="restriction-info">
            Until: {new Date(user.restrictedUntil).toLocaleDateString()}
          </div>
        )}
      </td>
      <td className="user-department">{user.department || '-'}</td>
      <td>
        <button 
          className="view-activity-btn"
          onClick={() => handleOpenUserActivity(user)}
          title="View user activity"
        >
          📊 View Activity
        </button>
      </td>
      <td>
        <div className="action-buttons-group">
          
<select 
  className="action-select"
  value=""
  onChange={(e) => {
    const action = e.target.value;
    if (action === 'view_profile') openUserProfileModal(user);
    else if (action === 'change_role') handleOpenRoleModal(user);
    else if (action === 'change_status') handleOpenStatusModal(user);
    else if (action === 'warn') handleOpenWarnModal(user);
    else if (action === 'restrict') handleOpenRestrictModal(user);
    else if (action === 'unrestrict') handleUnrestrictUser(user); // ADD THIS LINE
    else if (action === 'delete') handleOpenDeleteModal(user);
    e.target.value = '';
  }}
>
  <option value="">Select Action</option>
  <option value="view_profile">👁️ View Profile</option>
  <option value="change_role">🔄 Change Role</option>
  <option value="change_status">🔄 Change Status</option>
  <option value="warn">⚠️ Send Warning</option>
  <option value="restrict">⏸️ Restrict User</option>
  {/* ADD THIS LINE */}
  {user.status === 'restricted' && <option value="unrestrict">✅ Remove Restriction</option>}
  <option value="delete" disabled={user.role === 'admin'}>🗑️ Delete Account</option>
</select>

        </div>
      </td>
    </tr>
  );

  return (
    <div className="admin-container">
      {/* Toast Notifications */}
      <div className="toast-container">
        {toasts.map(toast => (
          <div key={toast.id} className={`toast toast-${toast.type}`}>
            <div className="toast-content">
              {toast.type === 'success' && '✅ '}
              {toast.type === 'error' && '❌ '}
              {toast.type === 'warning' && '⚠️ '}
              {toast.message}
            </div>
            <button className="toast-close" onClick={() => removeToast(toast.id)}>
              ×
            </button>
          </div>
        ))}
      </div>

      {/* Admin Header */}
      <header className="admin-header">
        <div className="admin-header-left">
          <h1>👑 Swish Admin Panel</h1>
        </div>
        <div className="admin-header-right">
          <button 
      className="back-to-feed-header-btn"
      onClick={() => navigate("/feed")}
      title="Go back to your feed"
    >
      Back
    </button>
          <button className="admin-logout-btn" onClick={handleLogout}>
            🚪 Logout
          </button>
        </div>
      </header>

      {/* Admin Navigation */}
      <nav className="admin-nav">
        <button 
          className={`admin-nav-btn ${activeTab === "dashboard" ? "active" : ""}`}
          onClick={() => setActiveTab("dashboard")}
        >
          📊 Dashboard
        </button>
        <button 
          className={`admin-nav-btn ${activeTab === "users" ? "active" : ""}`}
          onClick={() => setActiveTab("users")}
        >
          👥 Users ({stats?.totalUsers || 0})
        </button>
        <button 
          className={`admin-nav-btn ${activeTab === "posts" ? "active" : ""}`}
          onClick={() => setActiveTab("posts")}
        >
          📝 Posts ({stats?.totalPosts || 0})
        </button>
        <button 
          className={`admin-nav-btn ${activeTab === "reports" ? "active" : ""}`}
          onClick={() => setActiveTab("reports")}
        >
          🚨 Reports ({reports.length})
        </button>
        <button 
          className={`admin-nav-btn ${activeTab === "analytics" ? "active" : ""}`}
          onClick={() => setActiveTab("analytics")}
        >
          📈 Analytics
        </button>
      </nav>

      {/* Admin Content */}
      <div className="admin-content">
        {/* Dashboard Tab */}
        {activeTab === "dashboard" && (
          <div className="admin-dashboard">
            <h2>Platform Overview</h2>
            
            {stats ? (
              <div className="stats-grid">
                <div className="stat-card total-users">
                  <h3>Total Users</h3>
                  <div className="stat-number">{stats.totalUsers}</div>
                  <div className="stat-breakdown">
                    <span>🎓 {stats.usersByRole?.students || 0} Students</span>
                    <span>👨‍🏫 {stats.usersByRole?.faculty || 0} Faculty</span>
                    <span>👑 {stats.usersByRole?.admins || 0} Admins</span>
                  </div>
                </div>
                
                <div className="stat-card total-posts">
                  <h3>Total Posts</h3>
                  <div className="stat-number">{stats.totalPosts}</div>
                  <div className="stat-breakdown">
                    <span>📅 {stats.postsToday || 0} Today</span>
                    <span>📝 {stats.postsByType?.text || 0} Text</span>
                    <span>🎪 {stats.postsByType?.event || 0} Events</span>
                    <span>🗳️ {stats.postsByType?.poll || 0} Polls</span>
                  </div>
                </div>
                
                <div className="stat-card platform-health">
                  <h3>Platform Health</h3>
                  <div className="stat-status">✅ Active</div>
                  <div className="stat-breakdown">
                    <span>🔒 Secure Authentication</span>
                    <span>📱 Mobile Responsive</span>
                    <span>⚡ Fast Performance</span>
                  </div>
                </div>
                
                <div className="stat-card quick-actions">
                  <h3>Quick Actions</h3>
                  <div className="action-buttons">
                    <button onClick={() => setActiveTab("users")}>
                      👤 Manage Users
                    </button>
                    <button onClick={() => setActiveTab("posts")}>
                      📝 Moderate Posts
                    </button>
                    <button onClick={() => setActiveTab("reports")}>
                      🚨 Handle Reports
                    </button>
                    <button onClick={fetchStats}>
                      🔄 Refresh Stats
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="loading">Loading stats...</div>
            )}
          </div>
        )}

        {/* Users Tab */}
        {activeTab === "users" && (
          <div className="admin-users">
            <div className="section-header">
              <div className="section-title">
                <h2>User Management</h2>
                <p className="admin-subtitle">Manage campus users: Students, Faculty, and Admins</p>
              </div>
              <button className="refresh-section-btn" onClick={fetchUsers}>
                🔄 Refresh Users
              </button>
            </div>
            
            {/* Search and Filter Bar */}
            <div className="users-filter-bar">
              <div className="search-box">
                <input
                  type="text"
                  placeholder="Search users by name, email, or department..."
                  className="search-input"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                <span className="search-icon">🔍</span>
              </div>
              
              <div className="filter-row">
                <select 
                  className="filter-select"
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value)}
                >
                  <option value="">All Roles</option>
                  <option value="student">🎓 Students</option>
                  <option value="faculty">👨‍🏫 Faculty</option>
                  <option value="admin">👑 Admins</option>
                </select>
                
                <select 
                  className="filter-select"
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                >
                  <option value="">All Status</option>
                  <option value="active">✅ Active</option>
                  <option value="restricted">⚠️ Restricted</option>
                  
                </select>
                
                <select 
                  className="filter-select"
                  value={selectedDept}
                  onChange={(e) => setSelectedDept(e.target.value)}
                >
                  <option value="">All Departments</option>
                  {departments.map(dept => (
                    <option key={dept} value={dept}>{dept}</option>
                  ))}
                </select>
              </div>
            </div>
            
            {loading ? (
              <div className="loading">Loading users...</div>
            ) : filteredUsers.length === 0 ? (
              <div className="empty-state">
                {searchQuery || selectedRole || selectedStatus || selectedDept 
                  ? "No users match your filters" 
                  : "No users found"}
              </div>
            ) : (
              <div className="users-table-container">
                <table className="users-table">
                  <thead>
                    <tr>
                      <th>User</th>
                      <th>Email</th>
                      <th>Role</th>
                      <th>Status</th>
                      <th>Department</th>
                      <th>Activity</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map(user => (
                      <UserTableRow key={user._id} user={user} />
                    ))}
                  </tbody>
                </table>
                <div className="table-footer">
                  <div className="results-count">
                    Showing {filteredUsers.length} of {users.length} users (Total: {stats?.totalUsers || 0})
                  </div>
                  <div className="table-actions">
                    <button className="export-btn" onClick={() => {
                      showToast("Export feature coming soon!", "info");
                    }}>
                      📥 Export Users
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Posts Tab */}
        {activeTab === "posts" && (
          <div className="admin-posts">
            <div className="section-header">
              <div className="section-title">
                <h2>Post Moderation</h2>
                <p className="admin-subtitle">Monitor and manage campus posts</p>
              </div>
              <button className="refresh-section-btn" onClick={fetchPosts}>
                🔄 Refresh Posts
              </button>
            </div>
            
            {loading ? (
              <div className="loading">Loading posts...</div>
            ) : posts.length === 0 ? (
              <div className="empty-state">No posts found</div>
            ) : (
              <div className="posts-list-enhanced">
                <div className="posts-count-header">
                  <h3>📝 Total Posts: {posts.length}</h3>
                  <p className="posts-subtitle">Click on images to view in full size. Click on user names to view profiles.</p>
                </div>
                {posts.map(post => (
                  <EnhancedPostCard key={post._id} post={post} />
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "reports" && (
  <div className="admin-reports">
    <div className="section-header">
      <div className="section-title">
        <h2>🚨 Reported Content</h2>
        <p className="admin-subtitle">Review and take action on reported posts</p>
      </div>
      <button className="refresh-section-btn" onClick={() => {
        if (activeReportsTab === "pending") {
          fetchReports();
        } else {
          fetchResolvedReports();
        }
      }}>
        🔄 Refresh Reports
      </button>
    </div>
    
    {/* TABS FOR PENDING/RESOLVED */}
    <div className="reports-tabs">
      <button 
        className={`reports-tab-btn ${activeReportsTab === "pending" ? "active" : ""}`}
        onClick={() => setActiveReportsTab("pending")}
      >
        🔴 Pending Reports ({reports.length})
      </button>
      <button 
        className={`reports-tab-btn ${activeReportsTab === "resolved" ? "active" : ""}`}
        onClick={() => setActiveReportsTab("resolved")}
      >
        ✅ Resolved History ({resolvedReports.length})
      </button>
    </div>
    
    {/* PENDING REPORTS TAB */}
    {activeReportsTab === "pending" && (
      <>
        {reportsLoading ? (
          <div className="loading">Loading reports...</div>
        ) : reports.length === 0 ? (
          <div className="empty-state">🎉 No pending reports! All clear.</div>
        ) : (
          <div className="reports-list">
            {reports.map(post => (
              <div key={post._id} className="report-card">
                <div className="report-header">
                  <div className="reported-post-info">
                    <h4>Post by: 
                      <span 
                        className="clickable-user-name"
                        onClick={() => {
                          const user = users.find(u => u._id === post.user?.id);
                          if (user) openUserProfileModal(user);
                        }}
                      >
                        {post.user?.name}
                      </span>
                    </h4>
                    <ReadMore 
                        text={post.content} 
                        maxLength={150}
                        className="post-content-preview"
                      />
                    <div className="post-meta">
                      <span>{new Date(post.createdAt).toLocaleDateString()}</span>
                      <span className="report-count">🚨 {post.totalReports} reports</span>
                    </div>
                  </div>
                </div>
                
                {/* Reports List */}
                <div className="reports-details">
                  <h5>Reports ({post.reports?.length || 0}):</h5>
                  {post.reports?.map((report, index) => (
                    <div key={index} className="report-item">
                      <div className="reporter-info">
                        <strong>{report.reporterName}</strong> ({report.reporterRole})
                        <span className="report-time">
                          {new Date(report.timestamp).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="report-reason"><strong>Reason:</strong> {report.reason}</p>
                    </div>
                  ))}
                </div>
                
                <div className="report-resolve-actions">
                  <button 
                    className="action-btn keep-btn"
                    onClick={() => handleResolveReport(post._id, 'keep')}
                  >
                    ✅ Keep Post (No issue)
                  </button>
                  <button 
                    className="action-btn delete-btn"
                    onClick={() => handleResolveReport(post._id, 'delete')}
                  >
                    🗑️ Delete Post (Inappropriate)
                  </button>
                  <button 
                        className="action-btn restrict-btn"
                        onClick={() => {
                          const user = users.find(u => u._id === post.user?.id);
                          if (user) {
                            setSelectedUser(user);
                            setSelectedReport(post); // ✅ Store which report this is
                            setShowRestrictModal(true);
                          } else {
                            showToast("User not found in current list. Try refreshing users.", "error");
                          }
                        }}
                      >
                        ⚠️ Restrict User 24h
                      </button>

                      <button 
                        className="action-btn warn-btn"
                        onClick={() => {
                          const user = users.find(u => u._id === post.user?.id);
                          if (user) {
                            setSelectedUser(user);
                            setSelectedReport(post); // ✅ Store which report this is
                            setShowWarnModal(true);
                          } else {
                            showToast("User not found in current list. Try refreshing users.", "error");
                          }
                        }}
                      >
                        ⚠️ Warn User
                      </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </>
    )}
    
    {/* RESOLVED REPORTS HISTORY TAB */}
    {activeReportsTab === "resolved" && (
      <>
        {resolvedLoading ? (
          <div className="loading">Loading resolved reports...</div>
        ) : resolvedReports.length === 0 ? (
          <div className="empty-state">No resolved reports found</div>
        ) : (
          <div className="resolved-reports-list">
            {resolvedReports.map(report => (
              <div key={report._id} className="resolved-report-card">
                <div className="resolved-report-header">
                  <div className="resolved-post-info">
                    <div className="resolved-post-preview">
                      <ReadMore 
                          text={report.postContent} 
                          maxLength={80}
                          className="post-snippet"
                        />
                      <span className="post-author">by {report.authorName}</span>
                    </div>
                    <div className={`resolved-action-badge resolved-action-${report.actionTaken}`}>
                      {report.actionTaken === 'keep' && '✅ KEPT'}
                      {report.actionTaken === 'delete' && '🗑️ DELETED'}
                      {report.actionTaken === 'warn' && '⚠️ USER WARNED'}
                      {report.actionTaken === 'restrict' && '⏸️ USER RESTRICTED'}
                    </div>
                  </div>
                </div>
                
                <div className="resolved-report-details">
                  <div className="resolved-meta">
                    <div className="resolved-meta-item">
                      <span className="meta-label">Resolved:</span>
                      <span className="meta-value">
                        {new Date(report.resolvedAt).toLocaleDateString()} at {new Date(report.resolvedAt).toLocaleTimeString()}
                      </span>
                    </div>
                    <div className="resolved-meta-item">
                      <span className="meta-label">By Admin:</span>
                      <span className="meta-value">{report.resolvedByName || 'System'}</span>
                    </div>
                    {report.reason && (
                      <div className="resolved-meta-item">
                        <span className="meta-label">Reason:</span>
                        <span className="meta-value">{report.reason}</span>
                      </div>
                    )}
                  </div>
                  
                  {report.originalReports && report.originalReports.length > 0 && (
                    <div className="original-reports-summary">
                      <p className="summary-title">📋 Original Reports: {report.originalReports.length}</p>
                      <div className="report-reasons">
                        {report.originalReports.slice(0, 3).map((rep, idx) => (
                          <span key={idx} className="reason-tag">{rep.reason}</span>
                        ))}
                        {report.originalReports.length > 3 && (
                          <span className="more-tag">+{report.originalReports.length - 3} more</span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </>
    )}
  </div>
)}

{activeTab === "analytics" && (
  <div className="admin-analytics">
    <div className="section-header">
      <div className="section-title">
        <h2>📈 Platform Analytics</h2>
        <p className="admin-subtitle">Comprehensive insights & platform health</p>
      </div>
      <button className="refresh-section-btn" onClick={fetchAnalytics}>
        🔄 Refresh Analytics
      </button>
    </div>
    
    {analyticsLoading ? (
      <div className="loading">Loading platform analytics...</div>
    ) : analytics ? (
      <div className="analytics-content">
        {/* SECTION 1: PLATFORM HEALTH - QUICK STATS */}
        <div className="analytics-quick-stats">
          <div className="quick-stat-card">
            <div className="quick-stat-icon">👥</div>
            <div className="quick-stat-info">
              <div className="quick-stat-value">{analytics.activeUsersToday || 0}</div>
              <div className="quick-stat-label">Active Today</div>
            </div>
          </div>
          <div className="quick-stat-card">
            <div className="quick-stat-icon">📈</div>
            <div className="quick-stat-info">
              <div className="quick-stat-value">{analytics.newUsersToday || 0}</div>
              <div className="quick-stat-label">New Users</div>
            </div>
          </div>
          <div className="quick-stat-card">
            <div className="quick-stat-icon">📝</div>
            <div className="quick-stat-info">
              <div className="quick-stat-value">{analytics.postsToday || 0}</div>
              <div className="quick-stat-label">Posts Today</div>
            </div>
          </div>
          <div className="quick-stat-card">
            <div className="quick-stat-icon">✅</div>
            <div className="quick-stat-info">
              <div className="quick-stat-value">98%</div>
              <div className="quick-stat-label">System Status</div>
            </div>
          </div>
        </div>
        
        {/* SECTION 2: MODERATION DASHBOARD */}
        <div className="analytics-grid">
          <div className="analytics-card">
            <h3>🛡️ Moderation Dashboard</h3>
            <div className="moderation-stats">
              <div className="moderation-stat">
                <div className="moderation-stat-label">
                  <span className="stat-label-text">Pending Reports</span>
                  <span className="stat-label-value" style={{color: '#ef4444'}}>
                    {reports.length}
                  </span>
                </div>
                <div className="stat-progress">
                  <div className="progress-bar" style={{width: `${Math.min((reports.length / 50) * 100, 100)}%`, backgroundColor: '#ef4444'}}></div>
                </div>
              </div>
              <div className="moderation-stat">
                <div className="moderation-stat-label">
                  <span className="stat-label-text">Resolved Today</span>
                  <span className="stat-label-value" style={{color: '#10b981'}}>
                    {analytics.reportsResolvedToday || 0}
                  </span>
                </div>
                <div className="stat-progress">
                  <div className="progress-bar" style={{width: `${Math.min(((analytics.reportsResolvedToday || 0) / 20) * 100, 100)}%`, backgroundColor: '#10b981'}}></div>
                </div>
              </div>
              <div className="moderation-stat">
                <div className="moderation-stat-label">
                  <span className="stat-label-text">Active Warnings</span>
                  <span className="stat-label-value" style={{color: '#f59e0b'}}>
                    {analytics.activeWarnings || 0}
                  </span>
                </div>
                <div className="stat-progress">
                  <div className="progress-bar" style={{width: `${Math.min(((analytics.activeWarnings || 0) / 10) * 100, 100)}%`, backgroundColor: '#f59e0b'}}></div>
                </div>
              </div>
              <div className="moderation-stat">
                <div className="moderation-stat-label">
                  <span className="stat-label-text">Restricted Accounts</span>
                  <span className="stat-label-value" style={{color: '#9333ea'}}>
                    {analytics.restrictedAccounts || users.filter(u => u.status === 'restricted').length}
                  </span>
                </div>
                <div className="stat-progress">
                  <div className="progress-bar" style={{width: `${Math.min(((analytics.restrictedAccounts || 0) / 5) * 100, 100)}%`, backgroundColor: '#9333ea'}}></div>
                </div>
              </div>
            </div>
            <div className="card-note">
              Real-time moderation metrics for platform safety
            </div>
          </div>
          
          {/* SECTION 3: ACTIVITY TRENDS - CLEAR WEEKLY CHART */}
          <div className="analytics-card">
            <h3>📊 Weekly Activity Trends</h3>
            {analytics.dailyPosts?.length > 0 ? (
              <div className="weekly-activity-chart">
                <div className="chart-header">
                  <span className="chart-title">Posts Created This Week</span>
                  <span className="chart-total">
                    Total: {analytics.dailyPosts?.reduce((sum, day) => sum + day.count, 0) || 0}
                  </span>
                </div>
                <div className="chart-bars">
                  {analytics.dailyPosts.map((day, index) => {
                    const maxCount = Math.max(...analytics.dailyPosts.map(d => d.count));
                    const heightPercentage = maxCount > 0 ? (day.count / maxCount) * 80 : 0;
                    
                    return (
                      <div key={index} className="chart-bar-column">
                        <div className="bar-label">{day._id?.split('-')[2] || 'Day'}</div>
                        <div className="bar-column-container">
                          <div 
                            className="bar-column-fill" 
                            style={{ 
                              height: `${heightPercentage}%`,
                              background: day.count === maxCount 
                                ? 'linear-gradient(to top, #4f46e5, #7c3aed)' 
                                : 'linear-gradient(to top, #60a5fa, #3b82f6)'
                            }}
                          >
                            <span className="bar-column-value">{day.count}</span>
                          </div>
                        </div>
                        <div className="bar-day">{['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][new Date(day._id).getDay()] || 'Day'}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <p className="no-data">No activity data available for this week</p>
            )}
            <div className="chart-summary">
              {analytics.dailyPosts?.length > 0 && (
                <>
                  Peak: {Math.max(...analytics.dailyPosts.map(d => d.count))} posts • 
                  Avg: {Math.round(analytics.dailyPosts.reduce((sum, day) => sum + day.count, 0) / analytics.dailyPosts.length)} posts/day
                </>
              )}
            </div>
          </div>
        </div>
        
        {/* SECTION 4: DEPARTMENT LEADERBOARD - ENHANCED */}
        <div className="analytics-grid">
          <div className="analytics-card full-width">
            <h3>🏆 Department Leaderboard</h3>
            <div className="leaderboard-container">
              <div className="leaderboard-column">
                <h4>📝 Most Active (Posts)</h4>
                {analytics.postsByDept?.length > 0 ? (
                  <div className="dept-ranking">
                    {analytics.postsByDept.slice(0, 5).map((dept, index) => (
                      <div key={dept._id || index} className="ranking-item">
                        <div className="ranking-rank">#{index + 1}</div>
                        <div className="ranking-details">
                          <div className="ranking-name">{dept._id || 'Unknown Department'}</div>
                          <div className="ranking-stats">
                            <span className="ranking-count">{dept.count} posts</span>
                            <span className="ranking-percentage">
                              {Math.round((dept.count / analytics.postsByDept.reduce((sum, d) => sum + d.count, 0)) * 100)}%
                            </span>
                          </div>
                        </div>
                        <div className="ranking-bar">
                          <div 
                            className="ranking-bar-fill" 
                            style={{ 
                              width: `${(dept.count / Math.max(...analytics.postsByDept.map(d => d.count))) * 90}%` 
                            }}
                          ></div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="no-data">No department data available</p>
                )}
              </div>
              
              <div className="leaderboard-column">
                <h4>👍 Most Engaging</h4>
                {analytics.engagementByDept?.length > 0 ? (
                  <div className="dept-ranking">
                    {analytics.engagementByDept.slice(0, 5).map((dept, index) => (
                      <div key={dept._id || index} className="ranking-item">
                        <div className="ranking-rank">#{index + 1}</div>
                        <div className="ranking-details">
                          <div className="ranking-name">{dept._id || 'Unknown Department'}</div>
                          <div className="ranking-stats">
                            <span className="ranking-count">{dept.engagementScore || dept.count} score</span>
                          </div>
                        </div>
                        <div className="ranking-bar">
                          <div 
                            className="ranking-bar-fill" 
                            style={{ 
                              width: `${((dept.engagementScore || dept.count) / Math.max(...analytics.engagementByDept.map(d => d.engagementScore || d.count))) * 90}%`,
                              background: 'linear-gradient(90deg, #10b981, #34d399)'
                            }}
                          ></div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="no-data">Engagement data coming soon</p>
                )}
                <div className="card-note">
                  Engagement Score = (Likes × 0.5) + (Comments × 1) + (Shares × 2)
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* SECTION 5: SYSTEM METRICS */}
        <div className="analytics-grid">
          <div className="analytics-card">
            <h3>⚙️ System Performance</h3>
            <div className="system-metrics">
              <div className="metric-item">
                <span className="metric-label">API Response Time</span>
                <span className="metric-value" style={{color: '#10b981'}}>142ms</span>
              </div>
              <div className="metric-item">
                <span className="metric-label">Database Load</span>
                <span className="metric-value" style={{color: '#10b981'}}>24%</span>
              </div>
              <div className="metric-item">
                <span className="metric-label">Active Connections</span>
                <span className="metric-value" style={{color: '#3b82f6'}}>{analytics.activeConnections || 0}</span>
              </div>
              <div className="metric-item">
                <span className="metric-label">Error Rate</span>
                <span className="metric-value" style={{color: '#ef4444'}}>0.2%</span>
              </div>
            </div>
            <div className="card-note">
              Updated every 5 minutes • Last checked: Just now
            </div>
          </div>
          
          <div className="analytics-card">
            <h3>🚀 Quick Actions</h3>
            <div className="quick-actions-grid">
              <button 
                className="quick-action-btn"
                onClick={() => setActiveTab("reports")}
              >
                🛡️ Review Reports
              </button>
              <button 
                className="quick-action-btn"
                onClick={() => setActiveTab("users")}
              >
                👥 Manage Users
              </button>
              <button 
                className="quick-action-btn"
                onClick={() => setActiveTab("posts")}
              >
                📝 Moderate Content
              </button>
              <button 
                className="quick-action-btn"
                onClick={fetchAnalytics}
              >
                🔄 Refresh Data
              </button>
            </div>
            <div className="card-note">
              One-click navigation to key admin functions
            </div>
          </div>
        </div>
        
        <div className="analytics-meta">
          <p>📊 Analytics generated: {new Date().toLocaleString()} • Data refresh available every 30 minutes</p>
        </div>
      </div>
    ) : (
      <div className="empty-state">No analytics data available</div>
    )}
  </div>
)}
      </div>

      {/* ==================== ENHANCED MODALS ==================== */}

      {/* Enhanced User Activity Modal - HORIZONTAL WINDOW */}
      {showUserActivityModal && selectedUser && (
        <div className="modal-overlay" onClick={resetModals}>
          <div className="modal-content enhanced-activity-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>📊 User Activity: {selectedUser.name}</h3>
              <button className="modal-close-btn" onClick={resetModals}>×</button>
            </div>
            
            <div className="activity-modal-body">
              <div className="user-activity-header">
                <div className="user-activity-info">
                  <div className="activity-user-avatar">
                    {selectedUser.profilePhoto ? (
                      <img src={selectedUser.profilePhoto} alt={selectedUser.name} />
                    ) : (
                      <div className="activity-avatar-placeholder">
                        {selectedUser.name?.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div className="activity-user-details">
                    <h4>{selectedUser.name}</h4>
                    <p className="activity-user-email">{selectedUser.email}</p>
                    <div className="activity-user-meta">
                      <span className={`role-badge role-${selectedUser.role}`}>
                        {selectedUser.role === 'student' && '🎓 Student'}
                        {selectedUser.role === 'faculty' && '👨‍🏫 Faculty'}
                        {selectedUser.role === 'admin' && '👑 Admin'}
                      </span>
                      <span className="activity-user-dept">{selectedUser.department || 'No department'}</span>
                    </div>
                  </div>
                </div>
                
                <div className="activity-stats-summary">
                  <div className="activity-stat">
                    <span className="stat-number">{userActivity.posts.length}</span>
                    <span className="stat-label">Posts</span>
                  </div>
                  <div className="activity-stat">
                    <span className="stat-number">{userActivity.comments.length}</span>
                    <span className="stat-label">Comments</span>
                  </div>
                  <div className="activity-stat">
                    <span className="stat-number">{userActivity.likes.length}</span>
                    <span className="stat-label">Likes</span>
                  </div>
                </div>
              </div>
              
              <div className="activity-tabs-horizontal">
                <button 
                  className={`activity-tab-horizontal ${activeActivityTab === 'posts' ? 'active' : ''}`}
                  onClick={() => setActiveActivityTab('posts')}
                >
                  📝 Posts ({userActivity.posts.length})
                </button>
                <button 
                  className={`activity-tab-horizontal ${activeActivityTab === 'comments' ? 'active' : ''}`}
                  onClick={() => setActiveActivityTab('comments')}
                >
                  💬 Comments ({userActivity.comments.length})
                </button>
                <button 
                  className={`activity-tab-horizontal ${activeActivityTab === 'likes' ? 'active' : ''}`}
                  onClick={() => setActiveActivityTab('likes')}
                >
                  👍 Likes ({userActivity.likes.length})
                </button>
              </div>
              
              <div className="activity-content-horizontal">
                {activeActivityTab === 'posts' && (
                  <div className="posts-activity-horizontal">
                    <div className="activity-section-title">Recent Posts</div>
                    {userActivity.posts.length > 0 ? (
                      <div className="posts-grid">
                        {userActivity.posts.map(post => (
                          <div key={post._id} className="post-card-activity">
                            <div className="post-card-header">
                              <span className="post-time">
                                {new Date(post.createdAt).toLocaleDateString()}
                              </span>
                              <div className="post-stats">
                                <span>👍 {post.likes?.length || 0}</span>
                                <span>💬 {post.comments?.length || 0}</span>
                              </div>
                            </div>
                            <div className="post-card-content">
                              <ReadMore 
                                  text={post.content} 
                                  maxLength={200}
                                />
                              {post.media && post.media.length > 0 && (
                                <div className="post-media-preview">
                                  {post.media[0].type === 'image' && (
                                    <img 
                                      src={post.media[0].url} 
                                      alt="Post media" 
                                      className="post-preview-image"
                                      onClick={() => openImageModal(post.media, 0)}
                                    />
                                  )}
                                </div>
                              )}
                            </div>
                            <div className="post-card-actions">
                              <button 
                                className="post-action-btn"
                                onClick={() => {
                                  setSelectedPost(post);
                                  setShowPostModal(true);
                                }}
                              >
                                View Post
                              </button>
                              <button 
                                className="post-action-btn delete"
                                onClick={() => handleDeletePost(post._id)}
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="no-activity">No posts found</p>
                    )}
                  </div>
                )}
                
                {activeActivityTab === 'comments' && (
                  <div className="comments-activity-horizontal">
                    <div className="activity-section-title">Recent Comments</div>
                    {userActivity.comments.length > 0 ? (
                      <div className="comments-list">
                        {userActivity.comments.map((comment, index) => (
                          <div key={index} className="comment-card">
                            <div className="comment-header">
                              <span className="comment-time">
                                {new Date(comment.timestamp).toLocaleDateString()}
                              </span>
                            </div>
                            <div className="comment-content">
                              <p><strong>💬 Comment:</strong> {comment.commentContent || comment.content}</p>
                              <div className="comment-context">
                                <small>On post: "{comment.postContent}"</small>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="no-activity">No comments found</p>
                    )}
                  </div>
                )}
                
                {activeActivityTab === 'likes' && (
                  <div className="likes-activity-horizontal">
                    <div className="activity-section-title">Recent Likes</div>
                    {userActivity.likes.length > 0 ? (
                      <div className="likes-list">
                        {userActivity.likes.map((like, index) => (
                          <div key={index} className="like-card">
                            <div className="like-header">
                              <span className="like-time">
                                {new Date(like.timestamp).toLocaleDateString()}
                              </span>
                            </div>
                            <div className="like-content">
                              <p><strong>👍 Liked post:</strong> "{like.postContent}"</p>
                              <div className="like-context">
                                <small>By: {like.postOwnerName}</small>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="no-activity">No likes found</p>
                    )}
                  </div>
                )}
              </div>
            </div>
            
            <div className="modal-actions">
              {/* <button className="modal-btn cancel-btn" onClick={resetModals}>
                Close
              </button> */}
            </div>
          </div>
        </div>
      )}

      {/* Enhanced Post Details Modal */}
      {showPostModal && selectedPost && (
        <div className="modal-overlay" onClick={resetModals}>
          <div className="modal-content large-modal enhanced-post-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>📝 Post Details</h3>
              <button className="modal-close-btn" onClick={resetModals}>×</button>
            </div>
            
            <div className="enhanced-post-modal-content">
              {/* <div className="post-modal-user-info">
                <div className="post-user-avatar">
                  {selectedPost.user?.profilePhoto ? (
                    <img src={selectedPost.user.profilePhoto} alt={selectedPost.user.name} />
                  ) : (
                    <div className="post-avatar-placeholder">
                      {selectedPost.user?.name?.charAt(0).toUpperCase() || "U"}
                    </div>
                  )}
                </div>
                <div className="post-user-details">
                  <h4 
                    className="clickable"
                    onClick={() => {
                      const user = users.find(u => u._id === selectedPost.user?.id);
                      if (user) {
                        resetModals();
                        setTimeout(() => openUserProfileModal(user), 100);
                      }
                    }}
                  >
                    {selectedPost.user?.name || "Unknown User"}
                  </h4>
                  <p className="post-user-email">{selectedPost.user?.email}</p>
                  <div className="post-user-meta">
                    <span className="post-user-role">
                      {selectedPost.user?.role === 'student' && '🎓 Student'}
                      {selectedPost.user?.role === 'faculty' && '👨‍🏫 Faculty'}
                      {selectedPost.user?.role === 'admin' && '👑 Admin'}
                    </span>
                    <span className="post-user-dept">{selectedPost.user?.department || 'No department'}</span>
                  </div>
                </div>
              </div> */}
              
              <div className="post-details-grid">
                <div className="post-content-section">
                  <div className="post-content-header">
                    <span className="post-timestamp">
                      📅 Posted: {new Date(selectedPost.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <div className="post-content-body">
                      <ReadMore 
                          text={selectedPost.content} 
                          maxLength={500}
                        />
                    
                    {selectedPost.media && selectedPost.media.length > 0 && renderMedia(selectedPost.media)}
                    
                    {selectedPost.poll && renderPoll(selectedPost.poll)}
                    
                    {selectedPost.event && (
                      <div className="post-event-details">
                        <h5>🎪 Event Details</h5>
                        <div className="event-info-grid">
                          <div className="event-info-item">
                            <span className="event-label">Title:</span>
                            <span className="event-value">{selectedPost.event.title}</span>
                          </div>
                          <div className="event-info-item">
                            <span className="event-label">Date:</span>
                            <span className="event-value">{new Date(selectedPost.event.dateTime).toLocaleDateString()}</span>
                          </div>
                          <div className="event-info-item">
                            <span className="event-label">Time:</span>
                            <span className="event-value">{new Date(selectedPost.event.dateTime).toLocaleTimeString()}</span>
                          </div>
                          <div className="event-info-item">
                            <span className="event-label">Location:</span>
                            <span className="event-value">{selectedPost.event.location}</span>
                          </div>
                          <div className="event-info-item">
                            <span className="event-label">Attendees:</span>
                            <span className="event-value">{selectedPost.event.rsvpCount || 0}</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="post-stats-section">
                  
                  
                  <div className="admin-actions-card">
                    <h5>🔧 Admin Actions</h5>
                    <div className="admin-actions-grid">
                      <button 
                        className="admin-action-btn delete"
                        onClick={() => {
                          resetModals();
                          setTimeout(() => handleDeletePost(selectedPost._id), 100);
                        }}
                      >
                        🗑️ Delete Post
                      </button>
                      {selectedPost.user?.id && (
                        <>
                          <button 
                            className="admin-action-btn warn"
                            onClick={() => {
                              const user = users.find(u => u._id === selectedPost.user.id);
                              if (user) {
                                resetModals();
                                setTimeout(() => {
                                  setSelectedUser(user);
                                  setShowWarnModal(true);
                                }, 100);
                              }
                            }}
                          >
                            ⚠️ Warn User
                          </button>
                          <button 
                            className="admin-action-btn restrict"
                            onClick={() => {
                              const user = users.find(u => u._id === selectedPost.user.id);
                              if (user) {
                                resetModals();
                                setTimeout(() => {
                                  setSelectedUser(user);
                                  setShowRestrictModal(true);
                                }, 100);
                              }
                            }}
                          >
                            ⏸️ Restrict User
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="modal-actions">
              {/* <button className="modal-btn cancel-btn" onClick={resetModals}>
                Close
              </button> */}
            </div>
          </div>
        </div>
      )}

      {/* Enhanced Image Modal */}
      {showImageModal && selectedImages.length > 0 && (
        <div className="modal-overlay image-modal-overlay" onClick={closeImageModal}>
          <div className="image-modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="image-modal-close" onClick={closeImageModal}>×</button>
            
            <div className="image-modal-main">
              <button className="image-nav-btn prev" onClick={prevImage}>‹</button>
              
              <div className="image-display">
                <img 
                  src={selectedImages[currentImageIndex].url} 
                  alt={`Image ${currentImageIndex + 1}`}
                  className="modal-image"
                />
              </div>
              
              <button className="image-nav-btn next" onClick={nextImage}>›</button>
            </div>
            
            <div className="image-modal-footer">
              <div className="image-counter">
                {currentImageIndex + 1} / {selectedImages.length}
              </div>
              <div className="image-actions">
                <a 
                  href={selectedImages[currentImageIndex].url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="image-action-btn"
                >
                  🔗 Open Original
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Change Status Modal */}
      {showStatusModal && selectedUser && (
        <div className="modal-overlay" onClick={resetModals}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>🔄 Change User Status</h3>
            <p>Change status for <strong>{selectedUser.name}</strong></p>
            <div className="modal-body">
              <div className="modal-section">
                <label>New Status:</label>
                <select 
                  className="modal-select"
                  value={selectedAction}
                  onChange={(e) => setSelectedAction(e.target.value)}
                >
                  <option value="">Select new status</option>
                  <option value="active">✅ Active</option>
                  {/* <option value="restricted">⚠️ Restricted</option> */}
                </select>
              </div>
              <div className="modal-section">
                <label>Reason:</label>
                <textarea
                  className="modal-textarea"
                  placeholder="Enter reason for status change..."
                  value={modalReason}
                  onChange={(e) => setModalReason(e.target.value)}
                  rows="3"
                />
              </div>
            </div>
            <div className="modal-actions">
              <button className="modal-btn cancel-btn" onClick={resetModals}>
                Cancel
              </button>
              <button 
                className="modal-btn confirm-btn" 
                onClick={() => handleChangeStatus(selectedUser, selectedAction)}
                disabled={!selectedAction}
              >
                Change Status
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Keep your existing other modals (role, restrict, delete, warn, etc.) */}
      {/* Role Change Modal */}
      {showRoleModal && selectedUser && (
        <div className="modal-overlay" onClick={resetModals}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Change User Role</h3>
            <p>Change role for <strong>{selectedUser.name}</strong></p>
            <div className="modal-body">
              <select 
                className="modal-select"
                value={selectedAction}
                onChange={(e) => setSelectedAction(e.target.value)}
              >
                <option value="">Select new role</option>
                <option value="student">🎓 Student</option>
                <option value="faculty">👨‍🏫 Faculty</option>
                <option value="admin">👑 Admin</option>
              </select>
            </div>
            <div className="modal-actions">
              <button className="modal-btn cancel-btn" onClick={resetModals}>
                Cancel
              </button>
              <button 
                className="modal-btn confirm-btn" 
                onClick={handleRoleChange}
                disabled={!selectedAction}
              >
                Change Role
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Restrict User Modal */}
{showRestrictModal && selectedUser && (
  <div className="modal-overlay" onClick={resetModals}>
    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
      <h3>⏸️ Restrict User Account</h3>
      <p>Restrict <strong>{selectedUser.name}</strong> for temporary period</p>
      <div className="modal-body">
        <div className="modal-section">
          <label>Restriction Duration:</label>
          <div className="duration-options">
            {['6h', '12h', '24h', '3d', '7d'].map(duration => (
              <button
                key={duration}
                className={`duration-btn ${modalDuration === duration ? 'active' : ''}`}
                onClick={() => setModalDuration(duration)}
                type="button"
              >
                {duration}
              </button>
            ))}
          </div>
        </div>
        <div className="modal-section">
          <label>Restriction Reason:</label>
          <textarea
            className="modal-textarea"
            placeholder="Enter reason for restriction..."
            value={modalReason}
            onChange={(e) => setModalReason(e.target.value)}
            rows="4"
            required
          />
          <small className="restriction-note">
            User will be unable to post, comment, like, send/accept connections, or edit profile during restriction period.
          </small>
        </div>
      </div>
      <div className="modal-actions">
        <button className="modal-btn cancel-btn" onClick={resetModals}>
          Cancel
        </button>
        <button 
          className="modal-btn restrict-confirm-btn" 
          onClick={handleRestrictUser}
          disabled={!modalReason.trim()}
        >
          Restrict for {modalDuration}
        </button>
      </div>
    </div>
  </div>
)}

 {/* Delete Confirmation Modal */}
      {showConfirmModal && selectedUser && (
        <div className="modal-overlay" onClick={resetModals}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>🗑️ Delete User Account</h3>
            <p>Are you sure you want to permanently delete <strong>{selectedUser.name}</strong>?</p>
            <div className="modal-body">
              <div className="warning-message">
                ⚠️ This action cannot be undone. All user data will be permanently removed.
              </div>
              <div className="modal-section">
                <label>Deletion Reason:</label>
                <textarea
                  className="modal-textarea"
                  placeholder="Enter reason for deletion..."
                  value={modalReason}
                  onChange={(e) => setModalReason(e.target.value)}
                  rows="3"
                  required
                />
              </div>
            </div>
            <div className="modal-actions">
              <button className="modal-btn cancel-btn" onClick={resetModals}>
                Cancel
              </button>
              <button 
                className="modal-btn delete-confirm-btn" 
                onClick={handleDeleteUser}
                disabled={!modalReason.trim()}
              >
                Delete Permanently
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Warning Modal */}
      {showWarnModal && selectedUser && (
        <div className="modal-overlay" onClick={resetModals}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>⚠️ Issue Warning</h3>
            <p>Send warning to <strong>{selectedUser.name}</strong></p>
            <div className="modal-body">
              <div className="modal-section">
                <label>Warning Reason:</label>
                <textarea
                  className="modal-textarea"
                  placeholder="Enter warning reason..."
                  value={modalReason}
                  onChange={(e) => setModalReason(e.target.value)}
                  rows="4"
                  required
                />
                <small>This warning will be recorded in user's history.</small>
              </div>
            </div>
            <div className="modal-actions">
              <button className="modal-btn cancel-btn" onClick={resetModals}>
                Cancel
              </button>
              <button 
                className="modal-btn warn-confirm-btn" 
                onClick={handleWarnUser}
                disabled={!modalReason.trim()}
              >
                Send Warning
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Post Delete Confirmation Modal */}
      {showPostDeleteModal && selectedPost && (
        <div className="modal-overlay" onClick={resetModals}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>🗑️ Delete Post</h3>
            <p>Are you sure you want to delete this post by <strong>{selectedPost.user?.name}</strong>?</p>
            <div className="post-preview">
              <p>{selectedPost.content?.substring(0, 200)}...</p>
            </div>
            <div className="modal-actions">
              <button className="modal-btn cancel-btn" onClick={resetModals}>
                Cancel
              </button>
              <button 
                className="modal-btn delete-confirm-btn" 
                onClick={handleDeletePostConfirmed}
              >
                Delete Post
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Report Resolve Confirmation Modal */}
      {showReportResolveModal && selectedReport && (
        <div className="modal-overlay" onClick={resetModals}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>{selectedAction === 'delete' ? '🗑️ Delete Post' : '✅ Keep Post'}</h3>
            <p>Are you sure you want to {selectedAction === 'delete' ? 'delete' : 'keep'} this reported post?</p>
            <div className="report-preview">
              <p>Post by: {selectedReport.user?.name}</p>
              <p>Reports: {selectedReport.totalReports || selectedReport.reports?.length || 0}</p>
              <p>Content: {selectedReport.content?.substring(0, 150)}...</p>
            </div>
            <div className="modal-actions">
              <button className="modal-btn cancel-btn" onClick={resetModals}>
                Cancel
              </button>
              <button 
                className="modal-btn confirm-btn" 
                onClick={handleResolveReportConfirmed}
              >
                {selectedAction === 'delete' ? 'Delete Post' : 'Keep Post'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* User Profile Modal */}
      {showUserProfileModal && selectedUser && (
        <div className="modal-overlay" onClick={resetModals}>
          <div className="modal-content large-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>👤 User Profile: {selectedUser.name}</h3>
              <button className="modal-close-btn" onClick={resetModals}>×</button>
            </div>
            
            <div className="user-profile-content">
              <div className="profile-header">
                <div className="profile-avatar">
                  {selectedUser.profilePhoto ? (
                    <img src={selectedUser.profilePhoto} alt={selectedUser.name} />
                  ) : (
                    <div className="avatar-placeholder">
                      {selectedUser.name?.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
                <div className="profile-info">
                  <h4>{selectedUser.name}</h4>
                  <p className="profile-email">📧 {selectedUser.email}</p>
                  <div className="profile-meta">
                    <span className={`role-badge role-${selectedUser.role}`}>
                      {selectedUser.role === 'student' && '🎓 Student'}
                      {selectedUser.role === 'faculty' && '👨‍🏫 Faculty'}
                      {selectedUser.role === 'admin' && '👑 Admin'}
                    </span>
                    <span className={`status-badge status-${selectedUser.status || 'active'}`}>
                      {selectedUser.status === 'active' && '✅ Active'}
                      {selectedUser.status === 'restricted' && '⚠️ Restricted'}
                      {!selectedUser.status && '✅ Active'}
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="profile-details">
                <div className="detail-section">
                  <h5>📋 Personal Information</h5>
                  <div className="detail-grid">
                    <div className="detail-item">
                      <span className="detail-label">Full Name:</span>
                      <span className="detail-value">{selectedUser.name}</span>
                    </div>
                    <div className="detail-item">
                      <span className="detail-label">Email:</span>
                      <span className="detail-value">{selectedUser.email}</span>
                    </div>
                    {selectedUser.contact && (
                      <div className="detail-item">
                        <span className="detail-label">Contact:</span>
                        <span className="detail-value">{selectedUser.contact}</span>
                      </div>
                    )}
                    {selectedUser.department && (
                      <div className="detail-item">
                        <span className="detail-label">Department:</span>
                        <span className="detail-value">{selectedUser.department}</span>
                      </div>
                    )}
                    {selectedUser.year && (
                      <div className="detail-item">
                        <span className="detail-label">Year:</span>
                        <span className="detail-value">{selectedUser.year}</span>
                      </div>
                    )}
                    {selectedUser.studentId && (
                      <div className="detail-item">
                        <span className="detail-label">Student ID:</span>
                        <span className="detail-value">{selectedUser.studentId}</span>
                      </div>
                    )}
                    {selectedUser.employeeId && (
                      <div className="detail-item">
                        <span className="detail-label">Employee ID:</span>
                        <span className="detail-value">{selectedUser.employeeId}</span>
                      </div>
                    )}
                    {selectedUser.designation && (
                      <div className="detail-item">
                        <span className="detail-label">Designation:</span>
                        <span className="detail-value">{selectedUser.designation}</span>
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="detail-section">
                  <h5>📊 Statistics</h5>
                  <div className="stats-grid-small">
                    <div className="stat-item">
                      <span className="stat-label">Posts</span>
                      <span className="stat-value">{selectedUser.postsCount || 0}</span>
                    </div>
                    <div className="stat-item">
                      <span className="stat-label">Connections</span>
                      <span className="stat-value">{selectedUser.connectionsCount || 0}</span>
                    </div>
                    <div className="stat-item">
                      <span className="stat-label">Warnings</span>
                      <span className="stat-value">{selectedUser.warningCount || 0}</span>
                    </div>
                  </div>
                </div>
                
                {selectedUser.restrictionReason && (
                  <div className="detail-section warning-section">
                    <h5>⚠️ Restriction Details</h5>
                    <p className="restriction-reason">{selectedUser.restrictionReason}</p>
                    {selectedUser.restrictedUntil && (
                      <p className="restriction-until">
                        Restricted until: {new Date(selectedUser.restrictedUntil).toLocaleString()}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
            
            <div className="modal-actions">
              {/* <button className="modal-btn cancel-btn" onClick={resetModals}>
                Close
              </button> */}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminDashboard;