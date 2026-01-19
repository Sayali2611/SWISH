import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/Profile.css";
import ExploreSearch from "../components/ExploreSearch";
import "../styles/ExploreSearch.css";
import axios from "axios";
import PostModal from "../components/PostModal";
import Navbar from "../components/Navbar";

// ==================== READ MORE COMPONENT ====================
const ReadMore = ({ text, maxLength = 300, showFadeEffect = true }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isTruncated, setIsTruncated] = useState(false);
  
  useEffect(() => {
    if (text && text.length > maxLength) {
      setIsTruncated(true);
    }
  }, [text, maxLength]);

  if (!text) return null;
  
  // If text is already short, show full text
  if (text.length <= maxLength) {
    return (
      <div className="profile-read-more-container">
        <p className="profile-post-text">
          {text}
        </p>
      </div>
    );
  }
  
  const displayText = isExpanded ? text : text.substring(0, maxLength) + '...';
  
  return (
    <div className={`profile-read-more-container ${isExpanded ? 'expanded' : 'collapsed'}`}>
      <p className="profile-post-text">
        {displayText}
        {!isExpanded && (
          <button 
            className="profile-read-more-btn"
            onClick={() => setIsExpanded(true)}
            aria-label="Read more"
            style={{
    color: '#a78bfa',
    fontWeight: '700',
    backgroundColor: 'rgba(167, 139, 250, 0.1)',
    border: '1px solid rgba(167, 139, 250, 0.2)'
  }}
          >
            Read more
          </button>
        )}
        {isExpanded && (
          <button 
            className="profile-read-less-btn"
            onClick={() => setIsExpanded(false)}
            aria-label="Read less"
            style={{
    color: '#a78bfa',
    fontWeight: '700',
    backgroundColor: 'rgba(167, 139, 250, 0.1)',
    border: '1px solid rgba(167, 139, 250, 0.2)'
  }}
          >
            Show less
          </button>
        )}
      </p>
    </div>
  );
};


// ==================== IMAGE CAROUSEL COMPONENT ====================
const ImageCarousel = ({ images, videos }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [touchStartX, setTouchStartX] = useState(null);
  const [touchEndX, setTouchEndX] = useState(null);
  
  // Combine images and videos into media array
  const media = [...(images || []), ...(videos || [])];
  
  if (!media || media.length === 0) return null;

  const isVideo = (item) => item.type === 'video';
  const totalSlides = media.length;

  const goToSlide = (index) => {
    setCurrentIndex(index);
  };

  const nextSlide = () => {
    goToSlide((prevIndex) => 
      prevIndex === totalSlides - 1 ? 0 : prevIndex + 1
    );
  };

  const prevSlide = () => {
    goToSlide((prevIndex) => 
      prevIndex === 0 ? totalSlides - 1 : prevIndex - 1
    );
  };

  // Handle touch events for mobile swipe
  const handleTouchStart = (e) => {
    setTouchStartX(e.touches[0].clientX);
  };

  const handleTouchMove = (e) => {
    setTouchEndX(e.touches[0].clientX);
  };

  const handleTouchEnd = () => {
    if (!touchStartX || !touchEndX) return;
    
    const distance = touchStartX - touchEndX;
    const isLeftSwipe = distance > 50;
    const isRightSwipe = distance < -50;

    if (isLeftSwipe) {
      nextSlide();
    } else if (isRightSwipe) {
      prevSlide();
    }

    setTouchStartX(null);
    setTouchEndX(null);
  };

  return (
    <div className="linkedin-carousel profile-carousel">
      <div 
        className="carousel-container profile-carousel-container"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {totalSlides > 1 && (
          <button 
            className="carousel-arrow left-arrow profile-carousel-arrow profile-left-arrow"
            onClick={prevSlide}
            aria-label="Previous image"
          >
            ‹
          </button>
        )}

        <div className="carousel-slide profile-carousel-slide">
          {isVideo(media[currentIndex]) ? (
  <div className="video-slide profile-video-slide">
    <video
      src={media[currentIndex].url}
      className="carousel-video profile-carousel-video"
      playsInline
      preload="metadata"
      controls
    />
  </div>
) : (
  <img
    src={media[currentIndex].url}
    alt={`Slide ${currentIndex + 1}`}
    className="carousel-image profile-carousel-image"
    loading="lazy"
  />
)}
        </div>

        {totalSlides > 1 && (
          <button 
            className="carousel-arrow right-arrow profile-carousel-arrow profile-right-arrow"
            onClick={nextSlide}
            aria-label="Next image"
          >
            ›
          </button>
        )}

        {totalSlides > 1 && (
          <div className="image-counter profile-image-counter">
            {currentIndex + 1} / {totalSlides}
          </div>
        )}
      </div>

      {totalSlides > 1 && (
        <div className="carousel-dots profile-carousel-dots">
          {media.map((_, index) => (
            <button
              key={index}
              className={`carousel-dot profile-carousel-dot ${index === currentIndex ? 'active' : ''}`}
              onClick={() => goToSlide(index)}
              aria-label={`Go to slide ${index + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
};
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
  const [activeTab, setActiveTab] = useState("posts");
  const [loadingActivity, setLoadingActivity] = useState(false);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [showAllPosts, setShowAllPosts] = useState(false);
  const [showAllActivity, setShowAllActivity] = useState(false);
  const [selectedPost, setSelectedPost] = useState(null);
  const [isViewingPost, setIsViewingPost] = useState(false);
  const [editingPost, setEditingPost] = useState(null);
  const [editPostContent, setEditPostContent] = useState("");
  const fileInputRef = useRef(null);
  const [editFormData, setEditFormData] = useState({
    caption: '',
    media: [],
    pollQuestion: '',
    pollOptions: []
  });
  const editMediaInputRef = useRef(null);

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

    fetchNotificationCount();
    fetchNetworkStats();
    fetchUserConnections();
    fetchUserPosts();
    fetchUserActivity();
    fetchAllUsers(); 
  }, [navigate]);

  const openPostModal = (post) => {
    setSelectedPostForModal(post);
    setPostModalOpen(true);
  };

  const closePostModal = () => {
    setSelectedPostForModal(null);
    setPostModalOpen(false);
  };

  const fetchAllUsers = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/users`, {
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

  const handleLikePost = async (postId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/posts/${postId}/like`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const updatedPost = await response.json();
        setUserPosts(prevPosts => 
          prevPosts.map(post => 
            post._id === postId ? updatedPost : post
          )
        );
        
        if (selectedPost && selectedPost._id === postId) {
          setSelectedPost(updatedPost);
        }
        
        if (selectedPostForModal && selectedPostForModal._id === postId) {
          setSelectedPostForModal(updatedPost);
        }
      }
    } catch (error) {
      console.error('Error liking post:', error);
    }
  };

  const handleAddCommentFromModal = async (postId, commentText) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/posts/${postId}/comment`, {
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

  const handleEditCommentFromModal = async (postId, commentId, text) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/posts/${postId}/comments/${commentId}`, {
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

  const handleDeleteCommentFromModal = async (postId, commentId) => {
    if (!window.confirm('Delete this comment?')) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/posts/${postId}/comments/${commentId}`, {
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

  const handleLikeCommentFromModal = async (postId, commentId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/posts/${postId}/comments/${commentId}/like`, {
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

  const fetchNotificationCount = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/notifications/unread/count`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      setNotifCount(data.count || 0);
    } catch (error) {
      console.error("Failed to fetch notification count:", error);
    }
  };

  const fetchNetworkStats = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/network/stats`, {
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

  const fetchUserConnections = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/network/connections`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.success && data.connections) {
        setConnections(data.connections.slice(0, 9));
      }
    } catch (error) {
      console.error("Failed to fetch connections:", error);
    }
  };

  const fetchUserPosts = async () => {
    try {
      setLoadingPosts(true);
      const token = localStorage.getItem('token');
      const userId = JSON.parse(localStorage.getItem('user')).id;
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/users/${userId}/posts`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setUserPosts(data);
        
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

  const fetchUserActivity = async () => {
    try {
      setLoadingActivity(true);
      const token = localStorage.getItem('token');
      const userId = JSON.parse(localStorage.getItem('user')).id;
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/users/${userId}/activity`, {
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

  const handleUserSelectFromSearch = (selectedUser) => {
    if (selectedUser && selectedUser._id) {
      navigate(`/profile/${selectedUser._id}`); 
    }
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

  const uploadProfilePhoto = async (file) => {
    if (!file) return null;
    
    try {
      setUploadingPhoto(true);
      const token = localStorage.getItem('token');
      const formDataToSend = new FormData();
      formDataToSend.append('profilePhoto', file);
      
      const response = await axios.post(`${import.meta.env.VITE_API_URL}/api/auth/upload-photo`, formDataToSend, {
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

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const token = localStorage.getItem('token');
      let photoUrl = user.profilePhoto;
      
      if (formData.profilePhoto && typeof formData.profilePhoto !== 'string') {
        const uploadedUrl = await uploadProfilePhoto(formData.profilePhoto);
        if (uploadedUrl) {
          photoUrl = uploadedUrl;
        }
      } else if (formData.profilePhoto === null) {
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

      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/auth/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(updatePayload)
      });

      const data = await response.json();

      if (response.ok) {
        const updatedUser = { ...user, ...formData, profilePhoto: photoUrl ,isPrivate: formData.isPrivate };
        localStorage.setItem('user', JSON.stringify(updatedUser));
        setUser(updatedUser);
        setIsEditing(false);
        setSuccess('Profile updated successfully!');
        setTimeout(() => setSuccess(""), 3000);
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
          className="profile-user-avatar-img"
        />
      );
    }
    return <span className="profile-avatar-initial">{userData?.name?.charAt(0).toUpperCase() || "U"}</span>;
  };

  const calculateProfileCompletion = () => {
    let score = 0;
    const totalFields = 8;
    
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

  // ==================== ADD THIS FUNCTION ====================
const renderPollCard = (poll, postId) => {
  if (!poll) return null;
  
  // Check if user has voted in this poll
  const getUserVoteStatus = (pollObj) => {
    if (!pollObj?.voters || !user) return null;
    return pollObj.voters.find(v => v.userId === user.id);
  };
  
  const userVote = getUserVoteStatus(poll);
  const totalVotes = poll.totalVotes || 0;
  
  return (
    <div className="poll-card profile-poll-card">
      <div className="poll-header">
        <div className="poll-title">{poll.question}</div>
        <div className="poll-stats">
          <span className="vote-count">{totalVotes} votes</span>
        </div>
      </div>
      
      <div className="poll-options-list">
        {poll.options.map((option, index) => {
          const percentage = totalVotes > 0 ? Math.round((option.votes / totalVotes) * 100) : 0;
          const isUserVote = userVote?.optionIndex === index;
          
          return (
            <div 
              key={index} 
              className={`poll-option-item ${isUserVote ? 'selected' : ''}`}
              style={{ cursor: userVote ? 'default' : 'pointer' }}
            >
              <div className="poll-option-radio">
                {isUserVote && <div className="selected-dot"></div>}
              </div>
              <div className="poll-option-text">{option.text}</div>
              <div className="poll-option-percentage">{percentage}%</div>
              
              {totalVotes > 0 && (
                <div 
                  className="poll-progress-bar"
                  style={{ width: `${percentage}%` }}
                />
              )}
            </div>
          );
        })}
      </div>
      
      <div className="poll-footer">
        {userVote ? (
          <div className="voted-message">
            ✅ You voted for "{poll.options[userVote.optionIndex]?.text}"
          </div>
        ) : (
          <div className="vote-btn" style={{ opacity: 0.6, cursor: 'default' }}>
            Click an option to vote (visit Feed page)
          </div>
        )}
      </div>
    </div>
  );
};

  const handlePostClick = (post) => {
    setSelectedPost(post);
    setIsViewingPost(true);
    setEditingPost(null);
    setEditPostContent("");
  };

  const handleActivityClick = (postId) => {
    const highlightData = {
      postId: postId,
      timestamp: Date.now(),
      from: 'profile'
    };
    localStorage.setItem('searchHighlightedPost', JSON.stringify(highlightData));
    
    navigate("/feed");
    
    if (window.triggerFeedHighlight) {
      setTimeout(() => {
        window.triggerFeedHighlight();
      }, 500);
    }
  };

  const handleDeletePost = async (postId) => {
    if (!window.confirm('Are you sure you want to delete this post? This action cannot be undone.')) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/posts/${postId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        setUserPosts(prevPosts => prevPosts.filter(post => post._id !== postId));
        setSuccess('Post deleted successfully!');
        setTimeout(() => setSuccess(""), 3000);
        
        setStats(prev => ({ ...prev, posts: prev.posts - 1 }));
        
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

const handleEditPost = (post) => {
  setEditingPost(post);
  
  // For poll posts, extract poll data
  let pollQuestion = '';
  let pollOptions = [];
  
  if (post.type === 'poll' && post.poll) {
    pollQuestion = post.poll.question || '';
    pollOptions = post.poll.options?.map(opt => opt.text) || [];
  }
  
  // Set all edit form data
  setEditFormData({
    caption: post.content || '',
    media: post.media || [],
    pollQuestion: pollQuestion,
    pollOptions: pollOptions
  });
  
  // Keep backward compatibility
  setEditPostContent(post.content);
};

const handleSaveEdit = async () => {
  if (!editingPost) return;

  try {
    const token = localStorage.getItem('token');
    const payload = {
      content: editPostContent.trim()
    };

    // Add poll data if editing a poll
    if (editingPost.type === 'poll' && (editFormData.pollQuestion || editFormData.pollOptions.length > 0)) {
      payload.poll = {
        question: editFormData.pollQuestion,
        options: editFormData.pollOptions.map(opt => ({ text: opt }))
      };
    }

    // Note: Media editing would require file uploads
    // For now, we'll keep it simple - you can extend this later

    const response = await fetch(`${import.meta.env.VITE_API_URL}/api/posts/${editingPost._id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });

    if (response.ok) {
      const updatedPost = await response.json();
      
      // Update posts list
      setUserPosts(prevPosts => 
        prevPosts.map(post => 
          post._id === editingPost._id ? updatedPost : post
        )
      );
      
      // Update selected post if viewing
      if (selectedPost && selectedPost._id === editingPost._id) {
        setSelectedPost(updatedPost);
      }
      
      // Reset editing state
      setEditingPost(null);
      setEditPostContent("");
      setEditFormData({
        caption: '',
        media: [],
        pollQuestion: '',
        pollOptions: []
      });
      
      setSuccess('Post updated successfully!');
      setTimeout(() => setSuccess(""), 3000);
    }
  } catch (error) {
    setError('Network error: Unable to update post');
  }
};

  const handleCancelEdit = () => {
    setEditingPost(null);
    setEditPostContent("");
  };

  if (!user) {
    return (
      <div className="profile-page-root">
        <Navbar />
        <div className="profile-loading-container">
          <div className="profile-loading-spinner"></div>
          <p>Loading Profile...</p>
        </div>
      </div>
    );
  }

  const profileCompletion = calculateProfileCompletion();
  const displayedPosts = showAllPosts ? userPosts : userPosts.slice(0, 3);
  const displayedActivity = showAllActivity ? userActivity : userActivity.slice(0, 4);

  const renderPostsTab = () => (
    <div className="profile-main-content">
      {isViewingPost && selectedPost ? (
        <div className="profile-post-full-view">
          <div className="profile-post-full-header">
            <button 
              className="profile-back-to-posts-btn"
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
          
          <div className="profile-post-full-card">
            <div className="profile-post-full-user">
              <div className="profile-user-avatar-small">
                {getUserAvatar(user)}
              </div>
              <div className="profile-user-info-small">
                <div className="profile-user-name-small">{user.name}</div>
                <div className="profile-post-time-full">
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
  <div className="profile-edit-post-section">
    {/* Text Content */}
    <textarea
      className="profile-edit-textarea"
      value={editPostContent}
      onChange={(e) => setEditPostContent(e.target.value)}
      placeholder="Edit your post..."
      rows={4}
    />
    
    {/* Poll Editing */}
    {selectedPost.type === 'poll' && (
      <div className="profile-edit-poll-section">
        <div className="profile-edit-poll-title">
          📊 Edit Poll
        </div>
        
        <input
          type="text"
          className="profile-poll-question-input"
          value={editFormData.pollQuestion}
          onChange={(e) => setEditFormData({...editFormData, pollQuestion: e.target.value})}
          placeholder="Edit poll question..."
        />
        
        <div className="profile-poll-options-list">
          <div className="profile-edit-poll-title">
            Options:
          </div>
          {editFormData.pollOptions.map((option, index) => (
            <div key={index} className="profile-poll-option-row">
              <input
                type="text"
                value={option}
                onChange={(e) => {
                  const newOptions = [...editFormData.pollOptions];
                  newOptions[index] = e.target.value;
                  setEditFormData({...editFormData, pollOptions: newOptions});
                }}
                placeholder={`Option ${index + 1}`}
                className="profile-poll-option-input"
              />
              <button 
                type="button"
                className="profile-remove-option-btn"
                onClick={() => {
                  const newOptions = editFormData.pollOptions.filter((_, i) => i !== index);
                  setEditFormData({...editFormData, pollOptions: newOptions});
                }}
              >
                ×
              </button>
            </div>
          ))}
          
          <button 
            type="button"
            className="profile-add-option-btn"
            onClick={() => setEditFormData({
              ...editFormData, 
              pollOptions: [...editFormData.pollOptions, '']
            })}
          >
            + Add Option
          </button>
        </div>
      </div>
    )}
    
    {/* Media Editing */}
    <div className="profile-edit-media-section">
      <div className="profile-edit-media-title">
        🖼️ Current Media
      </div>
      
      {selectedPost.media && selectedPost.media.length > 0 ? (
        <>
          <div className="profile-current-media-grid">
            {selectedPost.media.map((media, index) => (
              <div key={index} className="profile-media-preview-box">
                {media.type === 'image' ? (
                  <img 
                    src={media.url} 
                    alt={`Media ${index + 1}`}
                    className="profile-media-preview-img"
                  />
                ) : (
                  <div className="profile-media-preview-video">
                    ▶️ Video
                  </div>
                )}
              </div>
            ))}
          </div>
          
          <button 
            type="button"
            className="profile-change-media-btn"
            onClick={() => editMediaInputRef.current?.click()}
          >
            📷 Change Media
          </button>
        </>
      ) : (
        <button 
          type="button"
          className="profile-change-media-btn"
          onClick={() => editMediaInputRef.current?.click()}
        >
          📷 Add Media
        </button>
      )}
    </div>
    
    {/* Action Buttons */}
    <div className="profile-edit-actions-row">
      <button 
        className="profile-cancel-edit-btn"
        onClick={handleCancelEdit}
      >
        Cancel
      </button>
      <button 
        className="profile-save-edit-btn"
        onClick={handleSaveEdit}
        disabled={!editPostContent.trim()}
      >
        💾 Save Changes
      </button>
    </div>
  </div>
) : (

              <div className="profile-post-content-full">
                  <ReadMore text={selectedPost.content} maxLength={500} />
                  {selectedPost.media && selectedPost.media.length > 0 && (
  <div className="profile-post-media-full">
    <ImageCarousel 
      images={selectedPost.media.filter(m => m.type === 'image')}
      videos={selectedPost.media.filter(m => m.type === 'video')}
    />
  </div>
)}
                
                {selectedPost.type === 'event' && selectedPost.event && (
                  <div className="profile-post-event-full">
                    <div className="profile-event-full-header">
                      <span className="profile-event-full-tag">📅 Event</span>
                      <h4 className="profile-event-full-title">{selectedPost.event.title}</h4>
                    </div>
                    {selectedPost.event.description && (
                      <p className="profile-event-full-description">{selectedPost.event.description}</p>
                    )}
                    <div className="profile-event-full-details">
                      <div className="profile-event-detail">
                        <span className="profile-event-icon">📅</span>
                        <span>{new Date(selectedPost.event.dateTime).toLocaleDateString('en-US', { 
                          weekday: 'long', 
                          month: 'long', 
                          day: 'numeric',
                          year: 'numeric'
                        })}</span>
                      </div>
                      <div className="profile-event-detail">
                        <span className="profile-event-icon">🕒</span>
                        <span>{new Date(selectedPost.event.dateTime).toLocaleTimeString('en-US', { 
                          hour: '2-digit', 
                          minute: '2-digit' 
                        })}</span>
                      </div>
                      <div className="profile-event-detail">
                        <span className="profile-event-icon">📍</span>
                        <span>{selectedPost.event.location}</span>
                      </div>
                    </div>
                  </div>
                )}
                
                {selectedPost.type === 'poll' && selectedPost.poll && renderPollCard(selectedPost.poll, selectedPost._id)}
              </div>
            )}
            
            <div className="profile-post-stats-full">
              <div className="profile-stat-full">
                <span className="profile-stat-icon-full">👍</span>
                <span className="profile-stat-count-full">{selectedPost.likes?.length || 0}</span>
                <span className="profile-stat-label-full">Likes</span>
              </div>
              <div className="profile-stat-full">
                <button 
                  className="profile-stat-button-comment-full"
                  onClick={() => openPostModal(selectedPost)}
                  title="View comments and likes"
                >
                  <span className="profile-stat-icon-full">💬</span>
                  <span className="profile-stat-count-full">{selectedPost.comments?.length || 0}</span>
                  <span className="profile-stat-label-full">Comments</span>
                </button>
              </div>
              {selectedPost.type === 'event' && (
                <div className="profile-stat-full">
                  <span className="profile-stat-icon-full">👥</span>
                  <span className="profile-stat-count-full">{selectedPost.event?.rsvpCount || 0}</span>
                  <span className="profile-stat-label-full">Going</span>
                </div>
              )}
              {selectedPost.type === 'poll' && (
                <div className="profile-stat-full">
                  <span className="profile-stat-icon-full">📊</span>
                  <span className="profile-stat-count-full">{selectedPost.poll?.totalVotes || 0}</span>
                  <span className="profile-stat-label-full">Votes</span>
                </div>
              )}
            </div>
            
            <div className="profile-post-actions-full">
              <button 
                className="profile-action-btn-full edit-btn"
                onClick={() => handleEditPost(selectedPost)}
              >
                ✏️ Edit Post
              </button>
              <button 
                className="profile-action-btn-full delete-btn"
                onClick={() => handleDeletePost(selectedPost._id)}
              >
                🗑️ Delete Post
              </button>
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="profile-tab-header">
            <h3>📝 My Posts ({userPosts.length})</h3>
            <button 
              className="profile-refresh-btn"
              onClick={fetchUserPosts}
              disabled={loadingPosts}
            >
              {loadingPosts ? '🔄 Refreshing...' : '🔄 Refresh'}
            </button>
          </div>
          
          {loadingPosts ? (
            <div className="profile-loading-posts">
              <div className="profile-loading-spinner">Loading your posts...</div>
            </div>
          ) : userPosts.length === 0 ? (
            <div className="profile-no-posts">
              <div className="profile-no-posts-icon">📝</div>
              <h4>No posts yet</h4>
              <p>Share your first post with the campus community!</p>
              <button 
                className="profile-create-post-btn"
                onClick={() => navigate("/feed")}
              >
                Create Your First Post
              </button>
            </div>
          ) : (
            <>
              <div className="profile-posts-grid">
                {displayedPosts.map(post => (
                  <div 
                    key={post._id} 
                    className="profile-post-card-mini"
                    onClick={() => handlePostClick(post)}
                  >
                    <div className="profile-post-card-header">
                      <div className="profile-post-date">
                        {new Date(post.createdAt).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric'
                        })}
                      </div>
                      <div className="profile-post-type-badge">
                        {post.type === 'event' && '📅 Event'}
                        {post.type === 'poll' && '📊 Poll'}
                        {post.type === 'text' && '📝 Post'}
                      </div>
                    </div>
                    
                    <div className="profile-post-content-mini">
                        <ReadMore text={post.content} maxLength={120} showFadeEffect={false} />
                        {post.type === 'poll' && post.poll && renderPollCard(post.poll, post._id)}
                        
                       {post.media && post.media.length > 0 && (
                          <div className="profile-post-media-mini">
                            <ImageCarousel 
                              images={post.media.filter(m => m.type === 'image')}
                              videos={post.media.filter(m => m.type === 'video')}
                            />
                          </div>
                        )}
                    </div>
                    
                    <div className="profile-post-stats-mini">
                      <div className="profile-stat-mini">
                        <span className="profile-stat-icon-mini">👍</span>
                        <span className="profile-stat-count">{post.likes?.length || 0}</span>
                      </div>
                      <div className="profile-stat-mini">
                        <button 
                          className="profile-stat-button-comment"
                          onClick={(e) => {
                            e.stopPropagation();
                            openPostModal(post);
                          }}
                          title="View comments"
                        >
                          <span className="profile-stat-icon-mini">💬</span>
                          <span className="profile-stat-count">{post.comments?.length || 0}</span>
                        </button>
                      </div>
                      {post.type === 'event' && (
                        <div className="profile-stat-mini">
                          <span className="profile-stat-icon-mini">👥</span>
                          <span className="profile-stat-count">{post.event?.rsvpCount || 0}</span>
                        </div>
                      )}
                      {post.type === 'poll' && (
                        <div className="profile-stat-mini">
                          <span className="profile-stat-icon-mini">📊</span>
                          <span className="profile-stat-count">{post.poll?.totalVotes || 0}</span>
                        </div>
                      )}
                    </div>
                    
                    <div className="profile-post-click-hint">
                      Click to view full post • {post.type === 'event' ? 'Event' : post.type === 'poll' ? 'Poll' : 'Post'}
                    </div>
                  </div>
                ))}
              </div>
              
              {userPosts.length > 3 && (
                <div className="profile-view-all-section">
                  <button 
                    className="profile-view-all-btn"
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

  const renderActivityTab = () => (
    <div className="profile-main-content">
      <div className="profile-tab-header">
        <h3>📊 My Activity ({userActivity.length})</h3>
        <button 
          className="profile-refresh-btn"
          onClick={fetchUserActivity}
          disabled={loadingActivity}
        >
          {loadingActivity ? '🔄 Refreshing...' : '🔄 Refresh'}
        </button>
      </div>
      
      {loadingActivity ? (
        <div className="profile-loading-activity">
          <div className="profile-loading-spinner">Loading your activity...</div>
        </div>
      ) : userActivity.length === 0 ? (
        <div className="profile-no-activity">
          <div className="profile-no-activity-icon">📊</div>
          <h4>No activity yet</h4>
          <p>Start interacting with posts by liking and commenting!</p>
          <button 
            className="profile-explore-btn"
            onClick={() => navigate("/feed")}
          >
            Explore Posts
          </button>
        </div>
      ) : (
        <>
          <div className="profile-activity-timeline">
            {displayedActivity.map((activity, index) => (
              <div 
                key={index} 
                className={`profile-activity-item ${activity.type}`}
                onClick={() => handleActivityClick(activity.postId)}
              >
                <div className="profile-activity-icon-wrapper">
                  {activity.type === 'like' ? (
                    <div className="profile-activity-icon-like">👍</div>
                  ) : (
                    <div className="profile-activity-icon-comment">💬</div>
                  )}
                </div>
                
                <div className="profile-activity-content-wrapper">
                  <div className="profile-activity-text">
                    {activity.type === 'like' ? (
                      <>You liked <strong>{activity.postOwnerName}'s</strong> post</>
                    ) : (
                      <>You commented on <strong>{activity.postOwnerName}'s</strong> post</>
                    )}
                  </div>
                  
                  <div className="profile-activity-preview">
                    <div className="profile-post-preview">
                      "{activity.postContent}"
                    </div>
                    {activity.type === 'comment' && (
                      <div className="profile-comment-preview">
                        Your comment: "{activity.commentContent}"
                      </div>
                    )}
                  </div>
                  
                  <div className="profile-activity-meta">
                    <span className="profile-activity-type">
                      {activity.type === 'like' ? 'Liked' : 'Commented'} • 
                      {activity.postType === 'event' && ' 📅 Event'}
                      {activity.postType === 'poll' && ' 📊 Poll'}
                      {activity.postType === 'text' && ' 📝 Post'}
                    </span>
                    <span className="profile-activity-time">
                      {new Date(activity.timestamp).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                  </div>
                </div>
                
                <div className="profile-activity-arrow">
                  →
                </div>
              </div>
            ))}
          </div>
          
          {userActivity.length > 4 && (
            <div className="profile-view-all-section">
              <button 
                className="profile-view-all-btn"
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

  const renderAboutTab = () => (
    <div className="profile-main-content">
      <div className="profile-tab-header">
        <h3>👤 Profile Information</h3>
        {/* <button 
          className="profile-edit-profile-tab-btn"
          onClick={() => setIsEditing(!isEditing)}
        >
          {isEditing ? '✏️ Editing...' : '✏️ Edit Profile'}
        </button> */}
      </div>
      
      <div className="profile-about-layout">
        {/* Left Column - Personal Info */}
        <div className="profile-personal-info-card">
          <div className="profile-photo-section">
            {photoPreview ? (
              <div className="profile-photo-preview">
                <img src={photoPreview} alt="Profile" className="profile-image" />
                {isEditing && (
                  <button 
                    type="button" 
                    className="profile-remove-photo-btn"
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
              <div className="profile-photo-upload-actions">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handlePhotoUpload}
                  accept="image/*"
                  className="profile-file-input"
                  id="profilePhoto"
                />
                <label htmlFor="profilePhoto" className="profile-upload-photo-btn">
                  {uploadingPhoto ? '📤 Uploading...' : '📸 Change Photo'}
                </label>
                <p className="profile-photo-hint">Max 5MB • JPG, PNG, GIF</p>
              </div>
            )}
          </div>

          <div className="profile-info-section">
            <h1 className="profile-name">{user.name}</h1>
            <div className="profile-role-badge">{getRoleDisplay()}</div>
            <div className="profile-contact-info">
              <div className="profile-contact-item">
                <span className="profile-contact-icon">📧</span>
                <span className="profile-contact-text">{user.email}</span>
              </div>
              {user.contact && (
                <div className="profile-contact-item">
                  <span className="profile-contact-icon">📞</span>
                  <span className="profile-contact-text">{user.contact}</span>
                </div>
              )}
            </div>
          </div>

          <div className="profile-bio-section">
            <h3>📝 About Me</h3>
            {isEditing ? (
              <textarea
                className="profile-bio-input"
                value={formData.bio}
                onChange={(e) => setFormData({...formData, bio: e.target.value})}
                placeholder="Tell us about yourself..."
                rows="3"
                maxLength="500"
              />
            ) : (
              <p className="profile-bio-text">{formData.bio || "No bio yet. Tell us about yourself!"}</p>
            )}
          </div>

          <div className="profile-skills-section">
            <h3>🛠️ Skills & Expertise</h3>
            <div className="profile-skills-container">
              {formData.skills.length > 0 ? (
                formData.skills.map((skill, index) => (
                  <div key={index} className="profile-skill-tag">
                    {skill}
                    {isEditing && (
                      <button 
                        className="profile-remove-skill-btn"
                        onClick={() => handleRemoveSkill(skill)}
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))
              ) : (
                <p className="profile-no-skills">No skills added yet</p>
              )}
            </div>
            {isEditing && (
              <div className="profile-add-skill-section">
                <input
                  type="text"
                  className="profile-skill-input"
                  value={formData.newSkill}
                  onChange={(e) => setFormData({...formData, newSkill: e.target.value})}
                  placeholder="Add a skill (press Enter to add)..."
                  onKeyPress={(e) => e.key === 'Enter' && handleAddSkill()}
                />
                <button className="profile-add-skill-btn" onClick={handleAddSkill}>
                  Add
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right Column - Form Details */}
        <div className="profile-form-card">
          <h3>📋 Profile Details</h3>
          <div className="profile-form-grid">
            <div className="profile-input-group">
              <label>Full Name</label>
              <input 
                type="text" 
                className="profile-input" 
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                disabled={!isEditing}
              />
            </div>

            <div className="profile-input-group">
              <label>Email</label>
              <input 
                type="email" 
                className="profile-input" 
                value={formData.email}
                disabled
                title="Email cannot be changed"
              />
            </div>

            <div className="profile-input-group">
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
                <div className="profile-input-group">
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

                <div className="profile-input-group">
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

                <div className="profile-input-group">
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
                <div className="profile-input-group">
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

                <div className="profile-input-group">
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

                <div className="profile-input-group">
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

            {/* Privacy Toggle */}
            <div className="profile-input-group full-width">
              <label>Account Privacy</label>
              <div className="profile-privacy-toggle">
                <label className="profile-privacy-switch">
                  <input
                    type="checkbox"
                    checked={formData.isPrivate || false}
                    onChange={(e) => setFormData({...formData, isPrivate: e.target.checked})}
                    disabled={!isEditing}
                  />
                  <span className="profile-privacy-slider"></span>
                </label>
                <div className="profile-privacy-info">
                  <div className="profile-privacy-title">
                    {formData.isPrivate ? '🔒 Private Account' : '🌍 Public Account'}
                  </div>
                  <div className="profile-privacy-description">
                    {formData.isPrivate 
                      ? 'Only your connections can see your posts'
                      : 'Anyone can see your posts'
                    }
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          {/* Edit/Save Buttons */}
          <div className="profile-form-actions">
            {!isEditing ? (
              <button 
                className="profile-edit-form-btn"
                onClick={() => setIsEditing(true)}
              >
                ✏️ Edit Profile
              </button>
            ) : (
              <div className="profile-edit-actions">
                <button 
                  className="profile-cancel-form-btn"
                  onClick={() => {
                    setIsEditing(false);
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
                  className="profile-save-form-btn"
                  onClick={handleUpdateProfile}
                  disabled={loading || uploadingPhoto}
                >
                  {loading ? '💾 Saving...' : '💾 Save Changes'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="profile-page-root">
      {/* Use the same Navbar component */}
      <Navbar />

      {/* Notifications */}
      {error && (
        <div className="profile-notification error">
          {error}
          <button onClick={() => setError("")}>×</button>
        </div>
      )}
      {success && (
        <div className="profile-notification success">
          {success}
          <button onClick={() => setSuccess("")}>×</button>
        </div>
      )}

      <div className="profile-layout-container">
        {/* ========== LEFT SIDEBAR ========== */}
        <div className="profile-sidebar profile-left-sidebar">
          {/* Profile Mini Card */}
          <div className="profile-mini-card">
            <div className="profile-mini-avatar">
              {getUserAvatar(user)}
            </div>
            <div className="profile-mini-info">
              <h4>{user?.name || "User"}</h4>
              <p className="profile-mini-title">
                {getRoleDisplay()}
              </p>
              <p className="profile-mini-bio">
                {user?.bio?.slice(0, 80) || "Complete your profile to get started!"}
              </p>
            </div>
            <div className="profile-mini-stats">
              <div className="profile-stats-grid">
                <div className="profile-stat-item">
                  <span className="profile-stat-number">{stats.connections}</span>
                  <span className="profile-stat-label">Connections</span>
                </div>
                <div className="profile-stat-item">
                  <span className="profile-stat-number">{stats.posts}</span>
                  <span className="profile-stat-label">Posts</span>
                </div>
                <div className="profile-stat-item">
                  <span className="profile-stat-number">{stats.likes}</span>
                  <span className="profile-stat-label">Likes</span>
                </div>
                <div className="profile-stat-item">
                  <span className="profile-stat-number">{userActivity.length}</span>
                  <span className="profile-stat-label">Activities</span>
                </div>
              </div>
            </div>
            
            {/* Profile Completion */}
            <div className="profile-completion-section">
              <div className="profile-completion-header">
                <span>Profile Completion</span>
                <span className="profile-completion-percentage">{profileCompletion}%</span>
              </div>
              <div className="profile-completion-bar">
                <div 
                  className="profile-completion-fill" 
                  style={{ width: `${profileCompletion}%` }}
                ></div>
              </div>
              <p className="profile-completion-hint">
                Complete your profile to unlock all features
              </p>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="profile-quick-actions-card">
            <h3 className="profile-sidebar-title">
              <span>⚡ Quick Actions</span>
            </h3>
            <div className="profile-quick-actions-grid">
              <button className="profile-quick-action-btn" onClick={() => navigate("/feed")}>
                <span className="profile-action-icon">📝</span>
                <span>Create Post</span>
              </button>
              <button className="profile-quick-action-btn" onClick={() => navigate("/network")}>
                <span className="profile-action-icon">👥</span>
                <span>Network</span>
              </button>
              <button className="profile-quick-action-btn" onClick={() => setIsEditing(true)}>
                <span className="profile-action-icon">✏️</span>
                <span>Edit Profile</span>
              </button>
              <button className="profile-quick-action-btn" onClick={() => setActiveTab("posts")}>
                <span className="profile-action-icon">📊</span>
                <span>My Posts</span>
              </button>
            </div>
          </div>
        </div>

        {/* ========== MAIN CONTENT ========== */}
        <div className="profile-main-wrapper">
          <div className="profile-container">
            {/* Profile Tabs */}
            <div className="profile-tabs-container">
              <div 
                className={`profile-tab-item ${activeTab === 'posts' ? 'active' : ''}`}
                onClick={() => setActiveTab('posts')}
              >
                <span className="profile-tab-icon">📝</span>
                <span className="profile-tab-text">My Posts ({userPosts.length})</span>
              </div>
              <div 
                className={`profile-tab-item ${activeTab === 'activity' ? 'active' : ''}`}
                onClick={() => setActiveTab('activity')}
              >
                <span className="profile-tab-icon">📊</span>
                <span className="profile-tab-text">My Activity ({userActivity.length})</span>
              </div>
              <div 
                className={`profile-tab-item ${activeTab === 'about' ? 'active' : ''}`}
                onClick={() => setActiveTab('about')}
              >
                <span className="profile-tab-icon">👤</span>
                <span className="profile-tab-text">About</span>
              </div>
            </div>

            {/* Tab Content */}
            <div className="profile-tab-content-wrapper">
              {activeTab === 'posts' && renderPostsTab()}
              {activeTab === 'activity' && renderActivityTab()}
              {activeTab === 'about' && renderAboutTab()}
            </div>
          </div>
        </div>

        {/* ========== RIGHT SIDEBAR ========== */}
        <div className="profile-sidebar profile-right-sidebar">
          {/* Recent Activity */}
          <div className="profile-analytics-card">
            <h3 className="profile-sidebar-title">
              <span>📈 Profile Analytics</span>
            </h3>
            
            <div className="profile-suggestions-list">
              {[
                ["📝", "Posts Created", `${stats.posts} posts`],
                ["👍", "Likes Received", `${stats.likes} likes`],
                ["💬", "Comments Made", `${userActivity.filter(a => a.type === 'comment').length} comments`],
                ["🔥", "Engagement Rate", `${stats.posts > 0 ? Math.round((stats.likes + userActivity.length) / stats.posts) : 0} per post`],
              ].map(([icon, title, value], idx) => (
                <div key={idx} className="profile-suggestion-item">
                  <div className="profile-suggestion-avatar">
                    <span>{icon}</span>
                  </div>
                  <div className="profile-suggestion-info">
                    <h4>{title}</h4>
                    <p className="profile-suggestion-meta">{value}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Connections Preview */}
          <div className="profile-analytics-card">
            <h3 className="profile-sidebar-title">
              <span>🤝 Connections</span>
            </h3>
            
            <div className="profile-connections-preview">
              <div className="profile-connections-grid">
                {connections.slice(0, 6).map(connection => (
                  <div 
                    key={connection._id} 
                    className="profile-connection-avatar"
                    onClick={() => navigate(`/profile/${connection._id}`)}
                    title={connection.name}
                  >
                    {getUserAvatar(connection)}
                  </div>
                ))}
                {connections.length > 6 && (
                  <div 
                    className="profile-connection-avatar profile-more-connections"
                    onClick={() => navigate("/network")}
                  >
                    +{connections.length - 6}
                  </div>
                )}
              </div>
              <button 
                className="profile-view-all-connections"
                onClick={() => navigate("/network")}
              >
                View All Connections →
              </button>
            </div>
          </div>
        </div>
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
  );
}

export default Profile;