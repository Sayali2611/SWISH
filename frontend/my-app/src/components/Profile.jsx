import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/Profile.css";
import ExploreSearch from "../components/ExploreSearch";
import "../styles/ExploreSearch.css";
import axios from "axios";
import PostModal from "../components/PostModal"; // or the correct path

function Profile() {

const [postModalOpen, setPostModalOpen] = useState(false);
const [selectedPostForModal, setSelectedPostForModal] = useState(null);
const [allUsers, setAllUsers] = useState([]);
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [photoPreview, setPhotoPreview] = useState(null);
  const [notifCount, setNotifCount] = useState(0);
  const [stats, setStats] = useState({
    connections: 0,
    posts: 0,
    likes: 0,
    receivedRequests: 0,
    sentRequests: 0
  });
  const [connections, setConnections] = useState([]);
  const [userPosts, setUserPosts] = useState([]);
  const [userActivity, setUserActivity] = useState([]);
  const [activeTab, setActiveTab] = useState("posts"); // "posts", "activity", "about"
  const [loadingActivity, setLoadingActivity] = useState(false);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [showAllPosts, setShowAllPosts] = useState(false);
  const [showAllActivity, setShowAllActivity] = useState(false);
  const [selectedPost, setSelectedPost] = useState(null);
  const [isViewingPost, setIsViewingPost] = useState(false);
  const [editingPost, setEditingPost] = useState(null);
  const [editPostContent, setEditPostContent] = useState("");
  const fileInputRef = useRef(null);

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    contact: "",
    bio: "",
    skills: [],
    newSkill: "",
    studentId: "",
    department: "",
    year: "",
    employeeId: "",
    facultyDepartment: "",
    designation: "",
    profilePhoto: null
  });

  useEffect(() => {
    const userData = localStorage.getItem('user');
    const token = localStorage.getItem('token');
    
    if (!userData || !token) {
      navigate("/");
      return;
    }

    const userObj = JSON.parse(userData);
    setUser(userObj);
    
    // Initialize form data with user data
    setFormData({
      name: userObj.name || "",
      email: userObj.email || "",
      contact: userObj.contact || "",
      bio: userObj.bio || "Passionate about technology and innovation. Always eager to learn and grow.",
      skills: userObj.skills || ["JavaScript", "React", "Node.js", "Python"],
      newSkill: "",
      studentId: userObj.studentId || "",
      department: userObj.department || "",
      year: userObj.year || "",
      employeeId: userObj.employeeId || "",
      facultyDepartment: userObj.facultyDepartment || "",
      designation: userObj.designation || "",
      profilePhoto: userObj.profilePhoto || null,
      isPrivate: userObj.isPrivate || false
    });

    if (userObj.profilePhoto) {
      setPhotoPreview(userObj.profilePhoto);
    }

    // Fetch all data
    fetchNotificationCount();
    fetchNetworkStats();
    fetchUserConnections();
    fetchUserPosts();
    fetchUserActivity();
    fetchAllUsers(); 
  }, [navigate]);

  // Open modal when clicking comments button
const openPostModal = (post) => {
  setSelectedPostForModal(post);
  setPostModalOpen(true);
};

// Close modal
const closePostModal = () => {
  setSelectedPostForModal(null);
  setPostModalOpen(false);
};

// Fetch all users (for showing who liked)
const fetchAllUsers = async () => {
  try {
    const token = localStorage.getItem('token');
    const response = await fetch('http://localhost:5000/api/users', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (response.ok) {
      const users = await response.json();
      setAllUsers(users);
    }
  } catch (error) {
    console.error('Error fetching users:', error);
  }
};

// Handle like from modal
const handleLikePost = async (postId) => {
  try {
    const token = localStorage.getItem('token');
    const response = await fetch(`http://localhost:5000/api/posts/${postId}/like`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });

    if (response.ok) {
      const updatedPost = await response.json();
      
      // Update in user posts list
      setUserPosts(prevPosts => 
        prevPosts.map(post => 
          post._id === postId ? updatedPost : post
        )
      );
      
      // Update in selected post (full view)
      if (selectedPost && selectedPost._id === postId) {
        setSelectedPost(updatedPost);
      }
      
      // Update in modal
      if (selectedPostForModal && selectedPostForModal._id === postId) {
        setSelectedPostForModal(updatedPost);
      }
    }
  } catch (error) {
    console.error('Error liking post:', error);
  }
};

// Add comment from modal
const handleAddCommentFromModal = async (postId, commentText) => {
  try {
    const token = localStorage.getItem('token');
    const response = await fetch(`http://localhost:5000/api/posts/${postId}/comment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ content: commentText })
    });

    if (response.ok) {
      const data = await response.json();
      
      setUserPosts(prevPosts => 
        prevPosts.map(post => 
          post._id === postId ? data.post : post
        )
      );
      
      if (selectedPost && selectedPost._id === postId) {
        setSelectedPost(data.post);
      }
      
      if (selectedPostForModal && selectedPostForModal._id === postId) {
        setSelectedPostForModal(data.post);
      }
      
      setSuccess('Comment added!');
      setTimeout(() => setSuccess(""), 2000);
      return data.post;
    }
  } catch (error) {
    setError('Failed to add comment');
    return null;
  }
};

// Edit comment from modal
const handleEditCommentFromModal = async (postId, commentId, text) => {
  try {
    const token = localStorage.getItem('token');
    const response = await fetch(`http://localhost:5000/api/posts/${postId}/comments/${commentId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ content: text })
    });

    if (response.ok) {
      const data = await response.json();
      
      setUserPosts(prevPosts => 
        prevPosts.map(post => 
          post._id === postId ? data.post : post
        )
      );
      
      if (selectedPost && selectedPost._id === postId) {
        setSelectedPost(data.post);
      }
      
      if (selectedPostForModal && selectedPostForModal._id === postId) {
        setSelectedPostForModal(data.post);
      }
      
      setSuccess('Comment updated!');
      setTimeout(() => setSuccess(""), 2000);
      return data.post;
    }
  } catch (error) {
    setError('Failed to update comment');
    return null;
  }
};

// Delete comment from modal
const handleDeleteCommentFromModal = async (postId, commentId) => {
  if (!window.confirm('Delete this comment?')) return;

  try {
    const token = localStorage.getItem('token');
    const response = await fetch(`http://localhost:5000/api/posts/${postId}/comments/${commentId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (response.ok) {
      const data = await response.json();
      
      setUserPosts(prevPosts => 
        prevPosts.map(post => 
          post._id === postId ? data.post : post
        )
      );
      
      if (selectedPost && selectedPost._id === postId) {
        setSelectedPost(data.post);
      }
      
      if (selectedPostForModal && selectedPostForModal._id === postId) {
        setSelectedPostForModal(data.post);
      }
      
      setSuccess('Comment deleted!');
      setTimeout(() => setSuccess(""), 2000);
      return data.post;
    }
  } catch (error) {
    setError('Failed to delete comment');
    return null;
  }
};

// Like comment from modal
const handleLikeCommentFromModal = async (postId, commentId) => {
  try {
    const token = localStorage.getItem('token');
    const response = await fetch(`http://localhost:5000/api/posts/${postId}/comments/${commentId}/like`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (response.ok) {
      const data = await response.json();
      
      setUserPosts(prevPosts => 
        prevPosts.map(post => 
          post._id === postId ? data.post : post
        )
      );
      
      if (selectedPost && selectedPost._id === postId) {
        setSelectedPost(data.post);
      }
      
      if (selectedPostForModal && selectedPostForModal._id === postId) {
        setSelectedPostForModal(data.post);
      }
      
      return data.post;
    }
  } catch (error) {
    setError('Failed to like comment');
    return null;
  }
};

  // Fetch notification count
  const fetchNotificationCount = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch("http://localhost:5000/api/notifications/unread/count", {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      setNotifCount(data.count || 0);
    } catch (error) {
      console.error("Failed to fetch notification count:", error);
    }
  };

  // Fetch network stats
  const fetchNetworkStats = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch("http://localhost:5000/api/network/stats", {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.success) {
        setStats(data.stats);
      }
    } catch (error) {
      console.error("Failed to fetch network stats:", error);
    }
  };

  // Fetch user connections
  const fetchUserConnections = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch("http://localhost:5000/api/network/connections", {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.success && data.connections) {
        setConnections(data.connections.slice(0, 9)); // Show only 9 for preview
      }
    } catch (error) {
      console.error("Failed to fetch connections:", error);
    }
  };

  // Fetch user posts
  const fetchUserPosts = async () => {
    try {
      setLoadingPosts(true);
      const token = localStorage.getItem('token');
      const userId = JSON.parse(localStorage.getItem('user')).id;
      const response = await fetch(`http://localhost:5000/api/users/${userId}/posts`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setUserPosts(data);
        
        // Calculate total likes from posts
        let totalLikes = 0;
        data.forEach(post => {
          totalLikes += post.likes?.length || 0;
        });
        
        setStats(prev => ({ ...prev, posts: data.length, likes: totalLikes }));
      }
    } catch (error) {
      console.error("Failed to fetch user posts:", error);
    } finally {
      setLoadingPosts(false);
    }
  };

  // Fetch user activity (likes and comments)
  const fetchUserActivity = async () => {
    try {
      setLoadingActivity(true);
      const token = localStorage.getItem('token');
      const userId = JSON.parse(localStorage.getItem('user')).id;
      const response = await fetch(`http://localhost:5000/api/users/${userId}/activity`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setUserActivity(data.activity || []);
        }
      }
    } catch (error) {
      console.error("Failed to fetch user activity:", error);
    } finally {
      setLoadingActivity(false);
    }
  };

  // Handler for user selected from search
  const handleUserSelectFromSearch = (selectedUser) => {
    if (selectedUser && selectedUser._id) {
      navigate(`/profile/${selectedUser._id}`); 
    }
  };

  // Handle notification click
  const handleClickNotification = () => {
    navigate("/notifications");
  };

  const handlePhotoUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        setError("Please upload an image file (JPEG, PNG, etc.)");
        return;
      }
      
      if (file.size > 5 * 1024 * 1024) {
        setError("Image size should be less than 5MB");
        return;
      }

      setFormData({ ...formData, profilePhoto: file });
      
      // Create preview
      const reader = new FileReader();
      reader.onload = (e) => {
        setPhotoPreview(e.target.result);
      };
      reader.readAsDataURL(file);
      setError("");
    }
  };

  const handleRemovePhoto = () => {
    setFormData({ ...formData, profilePhoto: null });
    setPhotoPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleAddSkill = () => {
    if (formData.newSkill.trim() && !formData.skills.includes(formData.newSkill.trim())) {
      setFormData({
        ...formData,
        skills: [...formData.skills, formData.newSkill.trim()],
        newSkill: ""
      });
    }
  };

  const handleRemoveSkill = (skillToRemove) => {
    setFormData({
      ...formData,
      skills: formData.skills.filter(skill => skill !== skillToRemove)
    });
  };

  // Upload photo to server
  const uploadProfilePhoto = async (file) => {
    if (!file) return null;
    
    try {
      setUploadingPhoto(true);
      const token = localStorage.getItem('token');
      const formDataToSend = new FormData();
      formDataToSend.append('profilePhoto', file);
      
      const response = await axios.post('http://localhost:5000/api/auth/upload-photo', formDataToSend, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.data.success) {
        return response.data.photoUrl;
      } else {
        setError(response.data.message || 'Failed to upload photo');
        return null;
      }
    } catch (error) {
      console.error('Upload error:', error);
      setError(error.response?.data?.message || 'Network error: Unable to upload photo');
      return null;
    } finally {
      setUploadingPhoto(false);
    }
  };

  // Update profile function
  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const token = localStorage.getItem('token');
      let photoUrl = user.profilePhoto;
      
      // Upload new photo if one was selected
      if (formData.profilePhoto && typeof formData.profilePhoto !== 'string') {
        const uploadedUrl = await uploadProfilePhoto(formData.profilePhoto);
        if (uploadedUrl) {
          photoUrl = uploadedUrl;
        }
      } else if (formData.profilePhoto === null) {
        // If photo was removed
        photoUrl = null;
      }
      
      const updatePayload = {
        name: formData.name,
        contact: formData.contact,
        bio: formData.bio,
        skills: JSON.stringify(formData.skills),
        studentId: formData.studentId,
        department: formData.department,
        year: formData.year,
        employeeId: formData.employeeId,
        facultyDepartment: formData.facultyDepartment,
        designation: formData.designation,
        profilePhoto: photoUrl,
        isPrivate: formData.isPrivate
      };

      const response = await fetch('http://localhost:5000/api/auth/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(updatePayload)
      });

      const data = await response.json();

      if (response.ok) {
        // Update local storage with new user data
        const updatedUser = { ...user, ...formData, profilePhoto: photoUrl ,isPrivate: formData.isPrivate };
        localStorage.setItem('user', JSON.stringify(updatedUser));
        setUser(updatedUser);
        setIsEditing(false);
        setSuccess('Profile updated successfully!');
        setTimeout(() => setSuccess(""), 3000);
        
        // Refresh stats
        fetchNetworkStats();
      } else {
        setError(data.message || 'Failed to update profile');
      }
    } catch (error) {
      console.error('Update error:', error);
      setError('Network error: Unable to update profile.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate("/");
  };

  const getRoleDisplay = () => {
    switch(user?.role) {
      case 'student': return '🎓 Student';
      case 'faculty': return '👨‍🏫 Faculty';
      case 'admin': return '⚙️ Admin';
      default: return 'User';
    }
  };

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

  // Calculate profile completion percentage
  const calculateProfileCompletion = () => {
    let score = 0;
    const totalFields = 8; // name, email, contact, bio, skills, profilePhoto, role-specific fields
    
    if (user?.name) score++;
    if (user?.email) score++;
    if (user?.contact) score++;
    if (user?.bio && user.bio.length > 10) score++;
    if (user?.skills && user.skills.length > 0) score++;
    if (user?.profilePhoto) score++;
    if ((user?.role === 'student' && user?.department && user?.year) || 
        (user?.role === 'faculty' && user?.facultyDepartment && user?.designation)) {
      score += 2;
    }
    
    return Math.round((score / totalFields) * 100);
  };

  // Handle post click (open full post view in profile)
  const handlePostClick = (post) => {
    setSelectedPost(post);
    setIsViewingPost(true);
    setEditingPost(null);
    setEditPostContent("");
  };

  // Handle activity click (go to feed and highlight)
  const handleActivityClick = (postId) => {
    // Store post ID to highlight
    const highlightData = {
      postId: postId,
      timestamp: Date.now(),
      from: 'profile'
    };
    localStorage.setItem('searchHighlightedPost', JSON.stringify(highlightData));
    
    // Navigate to feed
    navigate("/feed");
    
    // Trigger refresh if needed
    if (window.triggerFeedHighlight) {
      setTimeout(() => {
        window.triggerFeedHighlight();
      }, 500);
    }
  };

  // Handle delete post
  const handleDeletePost = async (postId) => {
    if (!window.confirm('Are you sure you want to delete this post? This action cannot be undone.')) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:5000/api/posts/${postId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        setUserPosts(prevPosts => prevPosts.filter(post => post._id !== postId));
        setSuccess('Post deleted successfully!');
        setTimeout(() => setSuccess(""), 3000);
        
        // Refresh stats
        setStats(prev => ({ ...prev, posts: prev.posts - 1 }));
        
        // Close post view if open
        if (selectedPost && selectedPost._id === postId) {
          setIsViewingPost(false);
          setSelectedPost(null);
        }
      } else {
        const data = await response.json();
        setError(data.message || 'Failed to delete post');
      }
    } catch (error) {
      setError('Network error: Unable to delete post');
    }
  };

  // Start editing post
  const handleEditPost = (post) => {
    setEditingPost(post);
    setEditPostContent(post.content);
  };

// Save edited post
const handleSaveEdit = async () => {
  if (!editingPost || !editPostContent.trim()) return;

  try {
    const token = localStorage.getItem('token');
    const response = await fetch(`http://localhost:5000/api/posts/${editingPost._id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        content: editPostContent.trim()
      })
    });

    if (response.ok) {
      const updatedPost = await response.json();
      
      // Update posts list
      setUserPosts(prevPosts => 
        prevPosts.map(post => 
          post._id === editingPost._id ? {
            ...post,
            content: editPostContent.trim(),
            updatedAt: new Date()
          } : post
        )
      );
      
      // Update selected post if open
      if (selectedPost && selectedPost._id === editingPost._id) {
        setSelectedPost({
          ...selectedPost,
          content: editPostContent.trim(),
          updatedAt: new Date()
        });
      }
      
      setEditingPost(null);
      setEditPostContent("");
      setSuccess('Post updated successfully!');
      setTimeout(() => setSuccess(""), 3000);
    } else {
      const data = await response.json();
      setError(data.message || 'Failed to update post');
    }
  } catch (error) {
    setError('Network error: Unable to update post');
  }
};

  // Cancel editing
  const handleCancelEdit = () => {
    setEditingPost(null);
    setEditPostContent("");
  };

  if (!user) {
    return (
      <div className="feed-container">
        <header className="feed-header">
          <div className="header-left">
            <div className="logo" onClick={() => navigate("/feed")}>💼 CampusConnect</div>
            <div className="feed-search-wrapper">
              <ExploreSearch onUserSelect={handleUserSelectFromSearch} />
            </div>
            <div className="nav-items">
              <button className="nav-btn" onClick={() => navigate("/feed")}>🏠 Feed</button>
              <button className="nav-btn active">👤 Profile</button>
              <button className="nav-btn" onClick={() => navigate("/network")}>👥 Network</button>
              <button className="nav-btn" onClick={() => navigate("/Explore")}>🔥 Explore</button>
              <button 
                className={`nav-btn notification-bell-btn`}
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
            {user?.role === 'admin' && (
              <button className="admin-btn" onClick={() => navigate("/admin")}>👑 Admin</button>
            )}
            <button className="logout-btn" onClick={handleLogout}>🚪 Logout</button>
          </div>
        </header>
        <div className="loading-container">
          <div className="loading-spinner">Loading...</div>
        </div>
      </div>
    );
  }

  const profileCompletion = calculateProfileCompletion();

  // Display posts (limited to 3 unless showAllPosts is true)
  const displayedPosts = showAllPosts ? userPosts : userPosts.slice(0, 3);

  // Display activity (limited to 4 unless showAllActivity is true)
  const displayedActivity = showAllActivity ? userActivity : userActivity.slice(0, 4);

  // Render "My Posts" Tab
  const renderPostsTab = () => (
    <div className="my-posts-tab">
      {isViewingPost && selectedPost ? (
        <div className="post-full-view">
          <div className="post-full-header">
            <button 
              className="back-to-posts-btn"
              onClick={() => {
                setIsViewingPost(false);
                setSelectedPost(null);
                setEditingPost(null);
              }}
            >
              ← Back to Posts
            </button>
            <h3>Your Post</h3>
          </div>
          
          <div className="post-full-card">
            <div className="post-full-user">
              <div className="user-avatar-small">
                {getUserAvatar(user)}
              </div>
              <div className="user-info-small">
                <div className="user-name-small">{user.name}</div>
                <div className="post-time-full">
                  {new Date(selectedPost.createdAt).toLocaleDateString('en-US', {
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </div>
              </div>
            </div>
            
            {editingPost && editingPost._id === selectedPost._id ? (
              <div className="edit-post-section">
                <textarea
                  className="edit-post-input"
                  value={editPostContent}
                  onChange={(e) => setEditPostContent(e.target.value)}
                  rows={4}
                  placeholder="Edit your post..."
                />
                <div className="edit-post-actions">
                  <button 
                    className="cancel-edit-btn"
                    onClick={handleCancelEdit}
                  >
                    Cancel
                  </button>
                  <button 
                    className="save-edit-btn"
                    onClick={handleSaveEdit}
                    disabled={!editPostContent.trim()}
                  >
                    Save Changes
                  </button>
                </div>
              </div>
            ) : (
              <div className="post-content-full">
                <p>{selectedPost.content}</p>
                
                {selectedPost.media && selectedPost.media.length > 0 && (
                  <div className="post-media-full">
                    {selectedPost.media.map((media, index) => (
                      media.type === 'image' ? (
                        <img 
                          key={index}
                          src={media.url} 
                          alt={`Post media ${index + 1}`}
                          className="post-media-image"
                        />
                      ) : (
                        <div key={index} className="post-media-video">
                          <video controls className="post-video-player">
                            <source src={media.url} type={`video/${media.format}`} />
                          </video>
                        </div>
                      )
                    ))}
                  </div>
                )}
                
                {selectedPost.type === 'event' && selectedPost.event && (
                  <div className="post-event-full">
                    <div className="event-full-header">
                      <span className="event-full-tag">📅 Event</span>
                      <h4 className="event-full-title">{selectedPost.event.title}</h4>
                    </div>
                    {selectedPost.event.description && (
                      <p className="event-full-description">{selectedPost.event.description}</p>
                    )}
                    <div className="event-full-details">
                      <div className="event-detail">
                        <span className="event-icon">📅</span>
                        <span>{new Date(selectedPost.event.dateTime).toLocaleDateString('en-US', { 
                          weekday: 'long', 
                          month: 'long', 
                          day: 'numeric',
                          year: 'numeric'
                        })}</span>
                      </div>
                      <div className="event-detail">
                        <span className="event-icon">🕒</span>
                        <span>{new Date(selectedPost.event.dateTime).toLocaleTimeString('en-US', { 
                          hour: '2-digit', 
                          minute: '2-digit' 
                        })}</span>
                      </div>
                      <div className="event-detail">
                        <span className="event-icon">📍</span>
                        <span>{selectedPost.event.location}</span>
                      </div>
                    </div>
                  </div>
                )}
                
                {selectedPost.type === 'poll' && selectedPost.poll && (
                  <div className="post-poll-full">
                    <div className="poll-full-header">
                      <span className="poll-full-tag">📊 Poll</span>
                      <h4 className="poll-full-question">{selectedPost.poll.question}</h4>
                    </div>
                    <div className="poll-full-stats">
                      <span className="poll-total-votes">{selectedPost.poll.totalVotes || 0} votes</span>
                    </div>
                  </div>
                )}
              </div>
            )}
            
            <div className="post-stats-full">
              <div className="stat-full">
                <span className="stat-icon-full">👍</span>
                <span className="stat-count-full">{selectedPost.likes?.length || 0}</span>
                <span className="stat-label-full">Likes</span>
              </div>
              <div className="stat-full">
                  <button 
                    className="stat-button-comment-full"
                    onClick={() => openPostModal(selectedPost)}
                    title="View comments and likes"
                  >
                    <span className="stat-icon-full">💬</span>
                    <span className="stat-count-full">{selectedPost.comments?.length || 0}</span>
                    <span className="stat-label-full">Comments</span>
                  </button>
                </div>
              {selectedPost.type === 'event' && (
                <div className="stat-full">
                  <span className="stat-icon-full">👥</span>
                  <span className="stat-count-full">{selectedPost.event?.rsvpCount || 0}</span>
                  <span className="stat-label-full">Going</span>
                </div>
              )}
              {selectedPost.type === 'poll' && (
                <div className="stat-full">
                  <span className="stat-icon-full">📊</span>
                  <span className="stat-count-full">{selectedPost.poll?.totalVotes || 0}</span>
                  <span className="stat-label-full">Votes</span>
                </div>
              )}
            </div>
            
            <div className="post-actions-full">
              <button 
                className="action-btn-full edit-btn"
                onClick={() => handleEditPost(selectedPost)}
              >
                ✏️ Edit Post
              </button>
              <button 
                className="action-btn-full delete-btn"
                onClick={() => handleDeletePost(selectedPost._id)}
              >
                🗑️ Delete Post
              </button>
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="tab-header">
            <h3>📝 My Posts ({userPosts.length})</h3>
            <button 
              className="refresh-btn"
              onClick={fetchUserPosts}
              disabled={loadingPosts}
            >
              {loadingPosts ? '🔄 Refreshing...' : '🔄 Refresh'}
            </button>
          </div>
          
          {loadingPosts ? (
            <div className="loading-posts">
              <div className="loading-spinner">Loading your posts...</div>
            </div>
          ) : userPosts.length === 0 ? (
            <div className="no-posts">
              <div className="no-posts-icon">📝</div>
              <h4>No posts yet</h4>
              <p>Share your first post with the campus community!</p>
              <button 
                className="create-post-btn"
                onClick={() => navigate("/feed")}
              >
                Create Your First Post
              </button>
            </div>
          ) : (
            <>
              <div className="posts-grid">
                {displayedPosts.map(post => (
                  <div 
                    key={post._id} 
                    className="post-card-mini"
                    onClick={() => handlePostClick(post)}
                  >
                    <div className="post-card-header">
                      <div className="post-date">
                        {new Date(post.createdAt).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric'
                        })}
                      </div>
                      <div className="post-type-badge">
                        {post.type === 'event' && '📅 Event'}
                        {post.type === 'poll' && '📊 Poll'}
                        {post.type === 'text' && '📝 Post'}
                      </div>
                    </div>
                    
                    <div className="post-content-mini">
                      <p>{post.content.length > 120 ? post.content.substring(0, 120) + '...' : post.content}</p>
                      
                      {post.media && post.media.length > 0 && (
                        <div className="post-media-mini">
                          {post.media[0].type === 'image' ? (
                            <img 
                              src={post.media[0].url} 
                              alt="Post media" 
                              className="post-media-thumbnail"
                            />
                          ) : (
                            <div className="video-thumbnail">
                              <span>🎥 Video</span>
                            </div>
                          )}
                          {post.media.length > 1 && (
                            <div className="media-count">+{post.media.length - 1} more</div>
                          )}
                        </div>
                      )}
                    </div>
                    
                    <div className="post-stats-mini">
                      <div className="stat-mini">
                        <span className="stat-icon-mini">👍</span>
                        <span className="stat-count">{post.likes?.length || 0}</span>
                      </div>
                      <div className="stat-mini">
                        <button 
                          className="stat-button-comment"
                          onClick={(e) => {
                            e.stopPropagation(); // Don't open full post view
                            openPostModal(post);
                          }}
                          title="View comments"
                        >
                          <span className="stat-icon-mini">💬</span>
                          <span className="stat-count">{post.comments?.length || 0}</span>
                        </button>
                      </div>
                      {post.type === 'event' && (
                        <div className="stat-mini">
                          <span className="stat-icon-mini">👥</span>
                          <span className="stat-count">{post.event?.rsvpCount || 0}</span>
                        </div>
                      )}
                      {post.type === 'poll' && (
                        <div className="stat-mini">
                          <span className="stat-icon-mini">📊</span>
                          <span className="stat-count">{post.poll?.totalVotes || 0}</span>
                        </div>
                      )}
                    </div>
                    
                    <div className="post-click-hint">
                      Click to view full post • {post.type === 'event' ? 'Event' : post.type === 'poll' ? 'Poll' : 'Post'}
                    </div>
                  </div>
                ))}
              </div>
              
              {userPosts.length > 3 && (
                <div className="view-all-section">
                  <button 
                    className="view-all-btn"
                    onClick={() => setShowAllPosts(!showAllPosts)}
                  >
                    {showAllPosts ? '↑ Show Less' : `↓ View All Posts (${userPosts.length})`}
                  </button>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );

  // Render "My Activity" Tab
  const renderActivityTab = () => (
    <div className="my-activity-tab">
      <div className="tab-header">
        <h3>📊 My Activity ({userActivity.length})</h3>
        <button 
          className="refresh-btn"
          onClick={fetchUserActivity}
          disabled={loadingActivity}
        >
          {loadingActivity ? '🔄 Refreshing...' : '🔄 Refresh'}
        </button>
      </div>
      
      {loadingActivity ? (
        <div className="loading-activity">
          <div className="loading-spinner">Loading your activity...</div>
        </div>
      ) : userActivity.length === 0 ? (
        <div className="no-activity">
          <div className="no-activity-icon">📊</div>
          <h4>No activity yet</h4>
          <p>Start interacting with posts by liking and commenting!</p>
          <button 
            className="explore-btn"
            onClick={() => navigate("/feed")}
          >
            Explore Posts
          </button>
        </div>
      ) : (
        <>
          <div className="activity-timeline">
            {displayedActivity.map((activity, index) => (
              <div 
                key={index} 
                className={`activity-item ${activity.type}`}
                onClick={() => handleActivityClick(activity.postId)}
              >
                <div className="activity-icon-wrapper">
                  {activity.type === 'like' ? (
                    <div className="activity-icon-like">👍</div>
                  ) : (
                    <div className="activity-icon-comment">💬</div>
                  )}
                </div>
                
                <div className="activity-content-wrapper">
                  <div className="activity-text">
                    {activity.type === 'like' ? (
                      <>You liked <strong>{activity.postOwnerName}'s</strong> post</>
                    ) : (
                      <>You commented on <strong>{activity.postOwnerName}'s</strong> post</>
                    )}
                  </div>
                  
                  <div className="activity-preview">
                    <div className="post-preview">
                      "{activity.postContent}"
                    </div>
                    {activity.type === 'comment' && (
                      <div className="comment-preview">
                        Your comment: "{activity.commentContent}"
                      </div>
                    )}
                  </div>
                  
                  <div className="activity-meta">
                    <span className="activity-type">
                      {activity.type === 'like' ? 'Liked' : 'Commented'} • 
                      {activity.postType === 'event' && ' 📅 Event'}
                      {activity.postType === 'poll' && ' 📊 Poll'}
                      {activity.postType === 'text' && ' 📝 Post'}
                    </span>
                    <span className="activity-time">
                      {new Date(activity.timestamp).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                  </div>
                </div>
                
                <div className="activity-arrow">
                  →
                </div>
              </div>
            ))}
          </div>
          
          {userActivity.length > 4 && (
            <div className="view-all-section">
              <button 
                className="view-all-btn"
                onClick={() => setShowAllActivity(!showAllActivity)}
              >
                {showAllActivity ? '↑ Show Less Activity' : `↓ View All Activity (${userActivity.length})`}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );

  // Render "About" Tab
  const renderAboutTab = () => (
    <div className="profile-about-tab">
      <div className="tab-header">
        <h3>👤 Profile Information</h3>
        <button 
          className="edit-profile-tab-btn"
          onClick={() => setIsEditing(!isEditing)}
        >
          {isEditing ? '✏️ Editing...' : '✏️ Edit Profile'}
        </button>
      </div>
      
      <div className="profile-layout">
        {/* Left Sidebar - Profile Info */}
        <div className="profile-sidebar">
          <div className="profile-card">
            {/* Profile Photo Section */}
            <div className="profile-photo-section">
              {photoPreview ? (
                <div className="photo-preview">
                  <img src={photoPreview} alt="Profile" className="profile-image" />
                  {isEditing && (
                    <button 
                      type="button" 
                      className="remove-photo-btn"
                      onClick={handleRemovePhoto}
                    >
                      ✕
                    </button>
                  )}
                </div>
              ) : (
                <div className="profile-image-placeholder">
                  {user.name?.charAt(0).toUpperCase()}
                </div>
              )}
              
              {isEditing && (
                <div className="photo-upload-actions">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handlePhotoUpload}
                    accept="image/*"
                    className="file-input"
                    id="profilePhoto"
                  />
                  <label htmlFor="profilePhoto" className="upload-photo-btn">
                    {uploadingPhoto ? '📤 Uploading...' : '📸 Change Photo'}
                  </label>
                  <p className="photo-hint">Max 5MB • JPG, PNG, GIF</p>
                </div>
              )}
            </div>

            {/* Profile Info */}
            <div className="profile-info">
              <h1 className="profile-name">{user.name}</h1>
              <div className="profile-role">{getRoleDisplay()}</div>
              <div className="profile-email">📧 {user.email}</div>
              {user.contact && <div className="profile-contact">📞 {user.contact}</div>}
            </div>

            {/* Edit/Save Buttons */}
            <div className="profile-actions">
              {!isEditing ? (
                <button 
                  className="edit-profile-btn"
                  onClick={() => setIsEditing(true)}
                >
                  ✏️ Edit Profile
                </button>
              ) : (
                <div className="edit-actions">
                  <button 
                    className="cancel-btn"
                    onClick={() => {
                      setIsEditing(false);
                      // Reset form data
                      setFormData({
                        name: user.name || "",
                        email: user.email || "",
                        contact: user.contact || "",
                        bio: user.bio || "Passionate about technology and innovation. Always eager to learn and grow.",
                        skills: user.skills || ["JavaScript", "React", "Node.js", "Python"],
                        newSkill: "",
                        studentId: user.studentId || "",
                        department: user.department || "",
                        year: user.year || "",
                        employeeId: user.employeeId || "",
                        facultyDepartment: user.facultyDepartment || "",
                        designation: user.designation || "",
                        profilePhoto: user.profilePhoto || null,
                        isPrivate: Boolean(user.isPrivate) 
                      });
                      setPhotoPreview(user.profilePhoto || null);
                    }}
                  >
                    Cancel
                  </button>
                  <button 
                    className="save-profile-btn"
                    onClick={handleUpdateProfile}
                    disabled={loading || uploadingPhoto}
                  >
                    {loading ? '💾 Saving...' : '💾 Save Changes'}
                  </button>
                </div>
              )}
            </div>

            {/* Bio Section */}
            <div className="bio-section">
              <h3>📝 About Me</h3>
              {isEditing ? (
                <textarea
                  className="bio-input"
                  value={formData.bio}
                  onChange={(e) => setFormData({...formData, bio: e.target.value})}
                  placeholder="Tell us about yourself..."
                  rows="3"
                  maxLength="500"
                />
              ) : (
                <p className="bio-text">{formData.bio || "No bio yet. Tell us about yourself!"}</p>
              )}
            </div>

            {/* Skills Section */}
            <div className="skills-section">
              <h3>🛠️ Skills & Expertise</h3>
              <div className="skills-container">
                {formData.skills.length > 0 ? (
                  formData.skills.map((skill, index) => (
                    <div key={index} className="skill-tag">
                      {skill}
                      {isEditing && (
                        <button 
                          className="remove-skill-btn"
                          onClick={() => handleRemoveSkill(skill)}
                        >
                          ×
                        </button>
                      )}
                    </div>
                  ))
                ) : (
                  <p className="no-skills">No skills added yet</p>
                )}
              </div>
              {isEditing && (
                <div className="add-skill-section">
                  <input
                    type="text"
                    className="skill-input"
                    value={formData.newSkill}
                    onChange={(e) => setFormData({...formData, newSkill: e.target.value})}
                    placeholder="Add a skill (press Enter to add)..."
                    onKeyPress={(e) => e.key === 'Enter' && handleAddSkill()}
                  />
                  <button className="add-skill-btn" onClick={handleAddSkill}>
                    Add
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Main Content - Profile Details */}
        <div className="profile-main">
          {/* Profile Details Form */}
          <div className="profile-details-card">
            <h3>📋 Profile Details</h3>
            <div className="form-grid">
              <div className="input-group">
                <label>Full Name</label>
                <input 
                  type="text" 
                  className="profile-input" 
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  disabled={!isEditing}
                />
              </div>

              <div className="input-group">
                <label>Email</label>
                <input 
                  type="email" 
                  className="profile-input" 
                  value={formData.email}
                  disabled
                  title="Email cannot be changed"
                />
              </div>

              <div className="input-group">
                <label>Contact Number</label>
                <input 
                  type="tel" 
                  className="profile-input" 
                  value={formData.contact}
                  onChange={(e) => setFormData({...formData, contact: e.target.value})}
                  disabled={!isEditing}
                  placeholder="Enter your phone number"
                />
              </div>

              {/* Student Specific Fields */}
              {user.role === 'student' && (
                <>
                  <div className="input-group">
                    <label>Student ID</label>
                    <input 
                      type="text" 
                      className="profile-input" 
                      value={formData.studentId}
                      onChange={(e) => setFormData({...formData, studentId: e.target.value})}
                      disabled={!isEditing}
                      placeholder="Enter student ID"
                    />
                  </div>

                  <div className="input-group">
                    <label>Department</label>
                    <select 
                      className="profile-input"
                      value={formData.department}
                      onChange={(e) => setFormData({...formData, department: e.target.value})}
                      disabled={!isEditing}
                    >
                      <option value="">Select Department</option>
                      <option value="Computer Engineering">Computer Engineering</option>
                      <option value="Information Technology">Information Technology</option>
                      <option value="Electronics & Telecommunication">Electronics & Telecommunication</option>
                      <option value="Mechanical Engineering">Mechanical Engineering</option>
                      <option value="Civil Engineering">Civil Engineering</option>
                    </select>
                  </div>

                  <div className="input-group">
                    <label>Academic Year</label>
                    <select 
                      className="profile-input"
                      value={formData.year}
                      onChange={(e) => setFormData({...formData, year: e.target.value})}
                      disabled={!isEditing}
                    >
                      <option value="">Select Year</option>
                      <option value="First Year">First Year</option>
                      <option value="Second Year">Second Year</option>
                      <option value="Third Year">Third Year</option>
                      <option value="Fourth Year">Fourth Year</option>
                      <option value="Postgraduate">Postgraduate</option>
                    </select>
                  </div>
                </>
              )}

              {/* Faculty Specific Fields */}
              {user.role === 'faculty' && (
                <>
                  <div className="input-group">
                    <label>Employee ID</label>
                    <input 
                      type="text" 
                      className="profile-input" 
                      value={formData.employeeId}
                      onChange={(e) => setFormData({...formData, employeeId: e.target.value})}
                      disabled={!isEditing}
                      placeholder="Enter employee ID"
                    />
                  </div>

                  <div className="input-group">
                    <label>Department</label>
                    <select 
                      className="profile-input"
                      value={formData.facultyDepartment}
                      onChange={(e) => setFormData({...formData, facultyDepartment: e.target.value})}
                      disabled={!isEditing}
                    >
                      <option value="">Select Department</option>
                      <option value="Computer Engineering">Computer Engineering</option>
                      <option value="Information Technology">Information Technology</option>
                      <option value="Electronics & Telecommunication">Electronics & Telecommunication</option>
                      <option value="Mechanical Engineering">Mechanical Engineering</option>
                      <option value="Civil Engineering">Civil Engineering</option>
                    </select>
                  </div>

                  <div className="input-group">
                    <label>Designation</label>
                    <select 
                      className="profile-input"
                      value={formData.designation}
                      onChange={(e) => setFormData({...formData, designation: e.target.value})}
                      disabled={!isEditing}
                    >
                      <option value="">Select Designation</option>
                      <option value="Professor">Professor</option>
                      <option value="Associate Professor">Associate Professor</option>
                      <option value="Assistant Professor">Assistant Professor</option>
                      <option value="Head of Department">Head of Department</option>
                      <option value="Lab Incharge">Lab Incharge</option>
                    </select>
                  </div>
                </>
              )}

              {/* 👇 ADD PRIVACY TOGGLE RIGHT HERE 👇 */}
              <div className="input-group full-width">
                <label>Account Privacy</label>
                <div className="privacy-toggle-profile">
                  <label className="privacy-switch">
                    <input
                      type="checkbox"
                      checked={formData.isPrivate || false}
                      onChange={(e) => setFormData({...formData, isPrivate: e.target.checked})}
                      disabled={!isEditing}
                    />
                    <span className="privacy-slider"></span>
                  </label>
                  <div className="privacy-info">
                    <div className="privacy-title">
                      {formData.isPrivate ? '🔒 Private Account' : '🌍 Public Account'}
                    </div>
                    <div className="privacy-description">
                      {formData.isPrivate 
                        ? 'Only your connections can see your posts'
                        : 'Anyone can see your posts'
                      }
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="feed-container">
      {/* Header */}
      <header className="feed-header">
        <div className="header-left">
          <div className="logo" onClick={() => navigate("/feed")}>💼 CampusConnect</div>
          <div className="feed-search-wrapper">
            <ExploreSearch onUserSelect={handleUserSelectFromSearch} />
          </div>
          <div className="nav-items">
            <button className="nav-btn" onClick={() => navigate("/feed")}>🏠 Feed</button>
            <button className="nav-btn active">👤 Profile</button>
            <button className="nav-btn" onClick={() => navigate("/network")}>👥 Network</button>
            <button className="nav-btn" onClick={() => navigate("/Explore")}>🔥 Explore</button>
            <button 
              className={`nav-btn notification-bell-btn`}
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
          {user?.role === 'admin' && (
            <button className="admin-btn" onClick={() => navigate("/admin")}>👑 Admin</button>
          )}
          <button className="logout-btn" onClick={handleLogout}>🚪 Logout</button>
        </div>
      </header>

      {/* Notifications */}
      {error && (
        <div className="notification error">
          {error}
          <button onClick={() => setError("")}>×</button>
        </div>
      )}
      {success && (
        <div className="notification success">
          {success}
          <button onClick={() => setSuccess("")}>×</button>
        </div>
      )}

      <div className="profile-content">
        {/* Profile Completion Meter */}
        {profileCompletion < 100 && (
          <div className="profile-completion-card">
            <div className="completion-header">
              <span>🔄 Profile Strength</span>
              <span className="completion-percentage">{profileCompletion}%</span>
            </div>
            <div className="completion-bar">
              <div 
                className="completion-fill" 
                style={{ width: `${profileCompletion}%` }}
              ></div>
            </div>
            <p className="completion-hint">
              {profileCompletion < 50 
                ? "Add more details to complete your profile!" 
                : profileCompletion < 80 
                ? "Great progress! Add a few more details."
                : "Almost there! Just a few more details needed."}
            </p>
          </div>
        )}

        {/* Stats Dashboard */}
        <div className="stats-dashboard">
          <div className="stat-card">
            <div className="stat-icon">👥</div>
            <div className="stat-content">
              <div className="stat-number">{stats.connections}</div>
              <div className="stat-label">Connections</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">📝</div>
            <div className="stat-content">
              <div className="stat-number">{stats.posts}</div>
              <div className="stat-label">Posts</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">👍</div>
            <div className="stat-content">
              <div className="stat-number">{stats.likes}</div>
              <div className="stat-label">Likes Received</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">📊</div>
            <div className="stat-content">
              <div className="stat-number">{userActivity.length}</div>
              <div className="stat-label">Activities</div>
            </div>
          </div>
        </div>

        {/* Profile Tabs */}
        <div className="profile-tabs">
          <div className="tabs-container">
            <button 
              className={`profile-tab ${activeTab === 'posts' ? 'active' : ''}`}
              onClick={() => setActiveTab('posts')}
            >
              📝 My Posts ({userPosts.length})
            </button>
            <button 
              className={`profile-tab ${activeTab === 'activity' ? 'active' : ''}`}
              onClick={() => setActiveTab('activity')}
            >
              📊 My Activity ({userActivity.length})
            </button>
            <button 
              className={`profile-tab ${activeTab === 'about' ? 'active' : ''}`}
              onClick={() => setActiveTab('about')}
            >
              👤 About
            </button>
          </div>
        </div>

        {/* Tab Content */}
        <div className="tab-content">
          {activeTab === 'posts' && renderPostsTab()}
          {activeTab === 'activity' && renderActivityTab()}
          {activeTab === 'about' && renderAboutTab()}
        </div>
{/* Post Modal for Comments/Likes */}
{postModalOpen && selectedPostForModal && (
  <PostModal
    post={selectedPostForModal}
    currentUser={user}
    users={allUsers}
    onClose={closePostModal}
    onAddComment={handleAddCommentFromModal}
    onEditComment={handleEditCommentFromModal}
    onDeleteComment={handleDeleteCommentFromModal}
    onLikeComment={handleLikeCommentFromModal}
    onLikePost={handleLikePost}
  />
)}

      </div>
    </div>
  );
}

export default Profile;