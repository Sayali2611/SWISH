import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import '../styles/Feed.css';
import '../styles/ProfilePage.css';
import '../styles/PostModal.css';
import ExploreSearch from '../components/ExploreSearch';
import PostModal from './PostModal';

// ==================== IMAGE CAROUSEL COMPONENT ====================
// Copied exactly from Feed.jsx
const ImageCarousel = ({ images, videos }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [touchStartX, setTouchStartX] = useState(null);
  const [touchEndX, setTouchEndX] = useState(null);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [videoProgress, setVideoProgress] = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);
  const [videoCurrentTime, setVideoCurrentTime] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  
  const videoRefs = useRef([]);
  const carouselRef = useRef(null);
  const observerRef = useRef(null);
  const videoIntervalRef = useRef(null);
  const isInViewportRef = useRef(true);
  const scrollTimeoutRef = useRef(null);

  const media = [...(images || []), ...(videos || [])];
  
  if (!media || media.length === 0) return null;

  const isVideo = (item) => item.type === 'video';
  const totalSlides = media.length;

  const handleVideoPlayPause = useCallback(() => {
    const video = videoRefs.current[currentIndex];
    if (!video) return;
    
    if (video.paused) {
      video.play().then(() => {
        setIsVideoPlaying(true);
        startProgressInterval();
      }).catch(e => {
        console.log("Auto-play prevented:", e);
      });
    } else {
      video.pause();
      setIsVideoPlaying(false);
      clearProgressInterval();
    }
  }, [currentIndex]);

  const startProgressInterval = useCallback(() => {
    if (videoIntervalRef.current) {
      clearInterval(videoIntervalRef.current);
    }
    videoIntervalRef.current = setInterval(() => {
      const video = videoRefs.current[currentIndex];
      if (video && !video.paused && video.duration) {
        const progress = (video.currentTime / video.duration) * 100;
        setVideoProgress(progress);
        setVideoCurrentTime(video.currentTime);
      }
    }, 100);
  }, [currentIndex]);

  const clearProgressInterval = useCallback(() => {
    if (videoIntervalRef.current) {
      clearInterval(videoIntervalRef.current);
      videoIntervalRef.current = null;
    }
  }, []);

  const formatTime = useCallback((seconds) => {
    if (isNaN(seconds)) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }, []);

  const goToSlide = useCallback((index) => {
    if (isVideo(media[currentIndex])) {
      const video = videoRefs.current[currentIndex];
      if (video) {
        video.pause();
        setIsVideoPlaying(false);
        clearProgressInterval();
      }
    }
    
    setCurrentIndex(index);
    setVideoProgress(0);
    setVideoCurrentTime(0);
    setVideoDuration(0);
    
    if (isVideo(media[index]) && isInViewportRef.current) {
      setTimeout(() => {
        const video = videoRefs.current[index];
        if (video) {
          video.muted = false;
          setIsMuted(false);
          video.play().then(() => {
            setIsVideoPlaying(true);
            startProgressInterval();
          }).catch(e => {
            console.log("Auto-play prevented:", e);
          });
        }
      }, 100);
    }
  }, [currentIndex, media, clearProgressInterval, startProgressInterval]);

  const nextSlide = useCallback(() => {
    goToSlide((prevIndex) => 
      prevIndex === totalSlides - 1 ? 0 : prevIndex + 1
    );
  }, [totalSlides, goToSlide]);

  const prevSlide = useCallback(() => {
    goToSlide((prevIndex) => 
      prevIndex === 0 ? totalSlides - 1 : prevIndex - 1
    );
  }, [goToSlide]);

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

    if (isLeftSwipe) nextSlide();
    else if (isRightSwipe) prevSlide();

    setTouchStartX(null);
    setTouchEndX(null);
  };

  const handleVideoPlay = useCallback(() => {
    setIsVideoPlaying(true);
    startProgressInterval();
  }, [startProgressInterval]);

  const handleVideoPause = useCallback(() => {
    setIsVideoPlaying(false);
    clearProgressInterval();
  }, [clearProgressInterval]);

  const handleVideoEnded = useCallback(() => {
    setIsVideoPlaying(false);
    setVideoProgress(0);
    setVideoCurrentTime(0);
    clearProgressInterval();
  }, [clearProgressInterval]);

  const handleVideoLoadedMetadata = useCallback((e) => {
    const video = e.target;
    if (video) {
      setVideoDuration(video.duration);
      setVideoCurrentTime(0);
      setVideoProgress(0);
    }
  }, []);

  const handleVideoTimeUpdate = useCallback((e) => {
    const video = e.target;
    if (video && video.duration) {
      const progress = (video.currentTime / video.duration) * 100;
      setVideoProgress(progress);
      setVideoCurrentTime(video.currentTime);
    }
  }, []);

  const handleProgressChange = (e) => {
    const value = parseFloat(e.target.value);
    const video = videoRefs.current[currentIndex];
    if (video && video.duration) {
      const newTime = (value / 100) * video.duration;
      video.currentTime = newTime;
      setVideoProgress(value);
      setVideoCurrentTime(newTime);
    }
  };

  const handleToggleMute = () => {
    const video = videoRefs.current[currentIndex];
    if (video) {
      video.muted = !video.muted;
      setIsMuted(video.muted);
    }
  };

  useEffect(() => {
    if (!carouselRef.current) return;

    const handleIntersection = (entries) => {
      entries.forEach((entry) => {
        isInViewportRef.current = entry.isIntersecting;
        
        if (!entry.isIntersecting && isVideo(media[currentIndex])) {
          const video = videoRefs.current[currentIndex];
          if (video && !video.paused) {
            video.pause();
            setIsVideoPlaying(false);
            clearProgressInterval();
          }
        }
      });
    };

    observerRef.current = new IntersectionObserver(
      handleIntersection,
      {
        threshold: 0.3,
        rootMargin: '50px'
      }
    );

    observerRef.current.observe(carouselRef.current);

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [currentIndex, media, clearProgressInterval]);

  useEffect(() => {
    return () => {
      videoRefs.current.forEach(video => {
        if (video) {
          video.pause();
          video.src = '';
          video.load();
        }
      });
      
      clearProgressInterval();
      
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
      
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, [clearProgressInterval]);

  return (
    <div className="linkedin-carousel" ref={carouselRef}>
      <div 
        className="carousel-container"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {totalSlides > 1 && (
          <button 
            className="carousel-arrow left-arrow"
            onClick={prevSlide}
            aria-label="Previous image"
          >
            ‹
          </button>
        )}

        <div className="carousel-slide">
          {isVideo(media[currentIndex]) ? (
            <div className="video-slide">
              <video
                ref={el => {
                  videoRefs.current[currentIndex] = el;
                  if (el) {
                    el.onplay = null;
                    el.onpause = null;
                    el.onended = null;
                    el.ontimeupdate = null;
                    el.onloadedmetadata = null;
                    
                    el.onplay = handleVideoPlay;
                    el.onpause = handleVideoPause;
                    el.onended = handleVideoEnded;
                    el.ontimeupdate = handleVideoTimeUpdate;
                    el.onloadedmetadata = handleVideoLoadedMetadata;
                    
                    el.muted = false;
                    el.playsInline = true;
                    el.preload = "metadata";
                    el.controls = false;
                  }
                }}
                src={media[currentIndex].url}
                className="carousel-video"
                playsInline
                preload="metadata"
              />
              
              <div className="carousel-video-controls">
                <button 
                  className="video-control-btn play-pause-btn"
                  onClick={handleVideoPlayPause}
                  aria-label={isVideoPlaying ? "Pause" : "Play"}
                >
                  {isVideoPlaying ? '❚❚' : '▶'}
                </button>
                
                <div className="video-time-display">
                  {formatTime(videoCurrentTime)} / {formatTime(videoDuration)}
                </div>
                
                <div className="video-progress-container">
                  <input
                    type="range"
                    className="video-progress-slider"
                    min="0"
                    max="100"
                    step="0.1"
                    value={videoProgress}
                    onChange={handleProgressChange}
                    aria-label="Video progress"
                  />
                </div>
                
                <button 
                  className="video-control-btn mute-btn"
                  onClick={handleToggleMute}
                  aria-label={isMuted ? "Unmute" : "Mute"}
                >
                  {isMuted ? '🔇' : '🔊'}
                </button>
              </div>
              
              {!isVideoPlaying && (
                <div className="video-play-overlay">
                  <button 
                    className="video-play-button"
                    onClick={handleVideoPlayPause}
                    aria-label="Play video"
                  >
                    ▶
                  </button>
                </div>
              )}
            </div>
          ) : (
            <img
              src={media[currentIndex].url}
              alt={`Slide ${currentIndex + 1}`}
              className="carousel-image"
              loading="lazy"
            />
          )}
        </div>

        {totalSlides > 1 && (
          <button 
            className="carousel-arrow right-arrow"
            onClick={nextSlide}
            aria-label="Next image"
          >
            ›
          </button>
        )}

        {totalSlides > 1 && (
          <div className="image-counter">
            {currentIndex + 1} / {totalSlides}
          </div>
        )}
      </div>

      {totalSlides > 1 && (
        <div className="carousel-dots">
          {media.map((_, index) => (
            <button
              key={index}
              className={`carousel-dot ${index === currentIndex ? 'active' : ''}`}
              onClick={() => goToSlide(index)}
              aria-label={`Go to slide ${index + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
};

// ==================== READ MORE COMPONENT ====================
// Copied exactly from Feed.jsx
const ReadMore = ({ text, maxLength = 300 }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  
  if (!text || text.length <= maxLength) {
    return <p className="post-text">{text}</p>;
  }
  
  const displayText = isExpanded ? text : text.substring(0, maxLength) + '...';
  
  return (
    <div className="read-more-container">
      <p className="post-text">
        {displayText}
        {!isExpanded && (
          <span 
            className="read-more-btn"
            onClick={() => setIsExpanded(true)}
          >
            Read more
          </span>
        )}
      </p>
    </div>
  );
};

// ==================== MAIN PROFILE PAGE COMPONENT ====================
const ProfilePage = () => {
  const { userId } = useParams();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [connectionStatus, setConnectionStatus] = useState('none');
  const [currentUser, setCurrentUser] = useState(null);
  const [isLoadingConnection, setIsLoadingConnection] = useState(false);
  const [showMoreSkills, setShowMoreSkills] = useState(false);
  
  // Post functionality states - EXACTLY like Feed.jsx
  const [postModalOpen, setPostModalOpen] = useState(false);
  const [selectedPost, setSelectedPost] = useState(null);
  const [showShareModal, setShowShareModal] = useState(false);
  const [postToShare, setPostToShare] = useState(null);
  const [connections, setConnections] = useState([]);
  const [selectedConnections, setSelectedConnections] = useState([]);
  const [searchConnections, setSearchConnections] = useState("");
  const [shareMessage, setShareMessage] = useState("");
  const [shareLoading, setShareLoading] = useState(false);
  const [shareCounts, setShareCounts] = useState({});
  const [showReportModal, setShowReportModal] = useState(false);
  const [selectedPostId, setSelectedPostId] = useState(null);
  const [reportReason, setReportReason] = useState("");
  const [allUsers, setAllUsers] = useState([]);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');
    
    if (!token || !storedUser) {
      navigate('/');
      return;
    }

    const parsedUser = JSON.parse(storedUser);
    setCurrentUser(parsedUser);
    
    if (userId === parsedUser.id) {
      navigate('/profile');
      return;
    }
    
    fetchUserProfile();
    fetchUserPosts();
    fetchConnectionStatus();
    fetchAllUsers();
  }, [userId, navigate]);

  // ==================== API CALLS ====================
  const fetchUserProfile = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:5000/api/users/${userId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setUser(data);
      } else {
        setError('User not found or access denied');
      }
    } catch (error) {
      setError('Failed to load profile');
      console.error('Profile fetch error:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUserPosts = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:5000/api/users/${userId}/posts`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        // Filter to ensure we only get this user's posts
        const filteredPosts = data.filter(post => 
          post.user && (post.user._id === userId || post.user.id === userId)
        );
        setPosts(filteredPosts);
        
        // Fetch share counts for each post
        filteredPosts.forEach(post => fetchShareCount(post._id));
      }
    } catch (error) {
      console.error('Failed to fetch user posts:', error);
    }
  };

  const fetchConnectionStatus = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:5000/api/network/status/${userId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setConnectionStatus(data.status);
      }
    } catch (error) {
      console.error('Failed to fetch connection status:', error);
    }
  };

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

  const fetchShareCount = async (postId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:5000/api/posts/${postId}/shares`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        setShareCounts(prev => ({
          ...prev,
          [postId]: data.shareCount || 0
        }));
      }
    } catch (error) {
      console.warn("Could not fetch share count:", error);
    }
  };

  // ==================== POST INTERACTION FUNCTIONS ====================
  const handleLike = async (postId) => {
    if (!currentUser) return;

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
        setPosts(prevPosts => 
          prevPosts.map(post => 
            post._id === postId ? updatedPost : post
          )
        );
        if (selectedPost && selectedPost._id === postId) {
          setSelectedPost(updatedPost);
        }
      }
    } catch (error) {
      console.error('Failed to like post:', error);
    }
  };

  const handleAddComment = async (postId, commentText) => {
    if (!commentText?.trim() || !currentUser) return null;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:5000/api/posts/${postId}/comment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          content: commentText
        })
      });

      if (response.ok) {
        const data = await response.json();
        setPosts(prevPosts => 
          prevPosts.map(post => 
            post._id === postId ? data.post : post
          )
        );
        
        if (selectedPost && selectedPost._id === postId) {
          setSelectedPost(data.post);
        }
        
        return data.post;
      }
      return null;
    } catch (error) {
      console.error('Failed to add comment:', error);
      return null;
    }
  };

  const handleEditComment = async (postId, commentId, text) => {
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
        setPosts(prevPosts => 
          prevPosts.map(post => 
            post._id === postId ? data.post : post
          )
        );
        
        if (selectedPost && selectedPost._id === postId) {
          setSelectedPost(data.post);
        }
        
        return data.post;
      }
    } catch (error) {
      console.error('Failed to update comment:', error);
      return null;
    }
  };

  const handleDeleteComment = async (postId, commentId) => {
    if (!window.confirm('Delete this comment?')) return null;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:5000/api/posts/${postId}/comments/${commentId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setPosts(prevPosts => 
          prevPosts.map(post => 
            post._id === postId ? data.post : post
          )
        );
        
        if (selectedPost && selectedPost._id === postId) {
          setSelectedPost(data.post);
        }
        
        return data.post;
      } else {
        const errorData = await response.json();
        console.error('Failed to delete comment:', errorData.message);
        return null;
      }
    } catch (error) {
      console.error('Failed to delete comment:', error);
      return null;
    }
  };

  const handleLikeComment = async (postId, commentId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:5000/api/posts/${postId}/comments/${commentId}/like`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setPosts(prevPosts => 
          prevPosts.map(post => 
            post._id === postId ? data.post : post
          )
        );
        
        if (selectedPost && selectedPost._id === postId) {
          setSelectedPost(data.post);
        }
        return data.post;
      } else {
        const errorData = await response.json();
        console.error('Failed to like comment:', errorData.message);
        return null;
      }
    } catch (error) {
      console.error('Failed to like comment:', error);
      return null;
    }
  };

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
        setPosts(prevPosts => prevPosts.filter(post => post._id !== postId));
        alert('Post deleted successfully!');
      } else {
        const data = await response.json();
        alert(data.message || 'Failed to delete post');
      }
    } catch (error) {
      alert('Network error: Unable to delete post');
    }
  };

  const openPostModal = (post) => {
    setSelectedPost(post);
    setPostModalOpen(true);
  };

  const closePostModal = () => {
    setSelectedPost(null);
    setPostModalOpen(false);
  };

  // ==================== SHARE FUNCTIONS - EXACTLY from Feed.jsx ====================
  const openShareModal = async (post) => {
    console.log("📤 Opening share modal for post:", post._id);
    
    setPostToShare(post);
    setSelectedConnections([]);
    setSearchConnections("");
    setShareMessage("");
    setShareLoading(true);
    setError("");
    
    try {
      const token = localStorage.getItem('token');
      
      const response = await fetch('http://localhost:5000/api/network/connections', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        const connectionsList = data.connections || data || [];
        setConnections(connectionsList);
      } else {
        const errorData = await response.json();
        setError("Failed to load connections: " + (errorData.message || "Unknown error"));
      }
      
      // Fetch post share count
      try {
        const shareResponse = await fetch(`http://localhost:5000/api/posts/${post._id}/shares`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (shareResponse.ok) {
          const shareData = await shareResponse.json();
          setShareCounts(prev => ({
            ...prev,
            [post._id]: shareData.shareCount || 0
          }));
        }
      } catch (shareError) {
        console.warn("Could not fetch share count:", shareError);
      }
      
      setShowShareModal(true);
    } catch (error) {
      setError("Failed to load connections: " + error.message);
    } finally {
      setShareLoading(false);
    }
  };

  const closeShareModal = () => {
    setShowShareModal(false);
    setPostToShare(null);
    setSelectedConnections([]);
    setSearchConnections("");
    setShareMessage("");
  };

  const toggleConnectionSelect = (connectionId) => {
    setSelectedConnections(prev => {
      if (prev.includes(connectionId)) {
        return prev.filter(id => id !== connectionId);
      } else {
        return [...prev, connectionId];
      }
    });
  };

  const selectAllConnections = () => {
    if (selectedConnections.length === connections.length) {
      setSelectedConnections([]);
    } else {
      const allConnectionIds = connections.map(conn => conn._id || conn.id);
      setSelectedConnections(allConnectionIds);
    }
  };

  const handleSharePost = async () => {
    if (!postToShare || selectedConnections.length === 0) {
      setError("Please select at least one connection to share with");
      return;
    }

    setShareLoading(true);
    setError("");

    try {
      const token = localStorage.getItem('token');
      
      const response = await fetch(`http://localhost:5000/api/posts/${postToShare._id}/share`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          connectionIds: selectedConnections,
          message: shareMessage
        })
      });

      const data = await response.json();
      
      if (response.ok) {
        alert(`✅ Post shared with ${selectedConnections.length} connection(s)!`);
        
        setShareCounts(prev => ({
          ...prev,
          [postToShare._id]: (prev[postToShare._id] || 0) + selectedConnections.length
        }));

        fetchUserPosts();
        
        closeShareModal();
      } else {
        setError(data.message || 'Failed to share post. Please try again.');
      }
    } catch (error) {
      setError('Network error: Unable to share post. Please check your connection.');
    } finally {
      setShareLoading(false);
    }
  };

  const filteredConnections = connections.filter(conn => {
    const searchLower = searchConnections.toLowerCase();
    const connName = conn.name || '';
    const connDepartment = conn.department || '';
    const connRole = conn.role || '';
    const connEmail = conn.email || '';
    
    return (
      connName.toLowerCase().includes(searchLower) ||
      connDepartment.toLowerCase().includes(searchLower) ||
      connRole.toLowerCase().includes(searchLower) ||
      connEmail.toLowerCase().includes(searchLower)
    );
  });

  // ==================== REPORT FUNCTIONS ====================
  const handleReportPost = (postId) => {
    setSelectedPostId(postId);
    setShowReportModal(true);
    setReportReason("");
  };

  const handleSubmitReport = async () => {
    if (!selectedPostId || !reportReason.trim()) {
      setError("Please select a reason for reporting");
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:5000/api/posts/${selectedPostId}/report`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ reason: reportReason })
      });

      const data = await response.json();
      
      if (response.ok) {
        alert('✅ Post reported successfully! Admin will review it.');
        setShowReportModal(false);
        setSelectedPostId(null);
        setReportReason("");
      } else {
        setError(data.message || 'Failed to report post');
      }
    } catch (error) {
      setError('Network error');
    }
  };

  // ==================== NETWORK ACTIONS ====================
  const handleConnect = async () => {
    try {
      setIsLoadingConnection(true);
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:5000/api/network/send/${userId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        setConnectionStatus('request_sent');
        fetchUserProfile();
      } else {
        const data = await response.json();
        alert(data.message || 'Failed to send connection request');
      }
    } catch (error) {
      console.error('Failed to send connection request:', error);
      alert('Network error. Please try again.');
    } finally {
      setIsLoadingConnection(false);
    }
  };

  const handleAcceptRequest = async () => {
    try {
      setIsLoadingConnection(true);
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:5000/api/network/accept/${userId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        setConnectionStatus('connected');
        fetchUserProfile();
      } else {
        const data = await response.json();
        alert(data.message || 'Failed to accept connection');
      }
    } catch (error) {
      console.error('Failed to accept connection:', error);
      alert('Network error. Please try again.');
    } finally {
      setIsLoadingConnection(false);
    }
  };

  const handleRejectRequest = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:5000/api/network/reject/${userId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        setConnectionStatus('none');
        fetchUserProfile();
      }
    } catch (error) {
      console.error('Failed to reject connection:', error);
    }
  };

  const handleCancelRequest = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:5000/api/network/cancel/${userId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        setConnectionStatus('none');
        fetchUserProfile();
      }
    } catch (error) {
      console.error('Failed to cancel request:', error);
    }
  };

  const handleRemoveConnection = async () => {
    if (window.confirm('Are you sure you want to remove this connection?')) {
      try {
        const token = localStorage.getItem('token');
        const response = await fetch(`http://localhost:5000/api/network/reject/${userId}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        if (response.ok) {
          setConnectionStatus('none');
          fetchUserProfile();
        }
      } catch (error) {
        console.error('Failed to remove connection:', error);
      }
    }
  };

  const handleUserSelectFromSearch = (selectedUser) => {
    if (selectedUser && selectedUser._id) {
      navigate(`/profile/${selectedUser._id}`);
    }
  };

  // ==================== HELPER FUNCTIONS ====================
  const getRoleDisplay = (role) => {
    switch(role) {
      case 'student': return '🎓 Student';
      case 'faculty': return '👨‍🏫 Faculty';
      case 'admin': return '👑 Admin';
      default: return '👤 Member';
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
    return userData?.name?.charAt(0).toUpperCase() || "U";
  };

  const isPostLiked = (post) => {
    if (!currentUser || !post.likes) return false;
    
    const userId = currentUser.id;
    
    return post.likes.some(like => {
      if (typeof like === 'string') {
        return like === userId;
      }
      else if (like && typeof like === 'object' && like.userId) {
        return like.userId === userId;
      }
      return false;
    });
  };

  // Check if posts should be visible
  const shouldShowPosts = () => {
    if (!user) return false;
    
    if (user.isPrivate && connectionStatus !== 'connected') {
      return false;
    }
    
    return true;
  };

  const renderMedia = (media) => {
    if (!media || media.length === 0) return null;
    
    const images = media.filter(item => item.type === 'image');
    const videos = media.filter(item => item.type === 'video');
    
    return (
      <ImageCarousel images={images} videos={videos} />
    );
  };

  // ==================== LOADING & ERROR STATES ====================
  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner">Loading Profile...</div>
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className="profile-error-state">
        <div className="error-content">
          <h2>Profile Not Found</h2>
          <p>{error || "This profile doesn't exist or you don't have permission to view it."}</p>
          <button onClick={() => navigate('/feed')} className="post-submit-btn">
            Back to Feed
          </button>
        </div>
      </div>
    );
  }

  // ==================== MAIN RENDER ====================
  return (
    <div className="feed-layout">
      <header className="feed-header-bar">
        <div className="header-left">
          <div className="logo" onClick={() => navigate("/feed")}>
            <span className="logo-icon">💼</span>
            <span className="logo-text">Swish</span>
          </div>
          
          <div className="feed-search-wrapper">
            <ExploreSearch onUserSelect={handleUserSelectFromSearch} />
          </div>

          <div className="nav-items">
            <button className="nav-btn" onClick={() => navigate("/feed")}>
              <span className="nav-icon">🏠</span>
              <span className="nav-text">Feed</span>
            </button>
            
            <button className="nav-btn active">
              <span className="nav-icon">👤</span>
              <span className="nav-text">Profile</span>
            </button>
            <button className="nav-btn" onClick={() => navigate("/network")}>
              <span className="nav-icon">👥</span>
              <span className="nav-text">Network</span>
            </button>
            <button className="nav-btn" onClick={() => navigate("/Explore")}>
              <span className="nav-icon">🔥</span>
              <span className="nav-text">Explore</span>
            </button>
            <button className="nav-btn" onClick={() => navigate("/notifications")}>
              <span className="nav-icon">🔔</span>
              <span className="nav-text">Notifications</span>
            </button>
          </div>
        </div>
        
        <div className="header-right">
          {currentUser?.role === 'admin' && (
            <button className="admin-btn" onClick={() => navigate("/admin")}>
              <span className="admin-icon">👑</span>
              <span>Admin</span>
            </button>
          )}
          
          <div className="user-info" onClick={() => navigate("/profile")}>
            <div className="user-avatar">
              {getUserAvatar(currentUser)}
            </div>
          </div>
          
          <button className="logout-btn" onClick={() => {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            navigate("/");
          }}>
            <span className="logout-icon">🚪</span>
            <span>Logout</span>
          </button>
        </div>
      </header>

      {error && (
        <div className="notification error">
          {error}
          <button onClick={() => setError("")}>×</button>
        </div>
      )}

      <div className="feed-layout-container">
        {/* ========== LEFT SIDEBAR ========== */}
        <div className="sidebar left-sidebar">
          <div className="profile-mini-card" style={{ textAlign: 'left', cursor: 'default' }}>
            <div className="profile-header" style={{ display: 'flex', gap: '16px', alignItems: 'center', marginBottom: '20px' }}>
              <div className="mini-avatar" style={{ width: '80px', height: '80px' }}>
                {getUserAvatar(user)}
              </div>
              <div>
                <h4 style={{ margin: '0 0 6px 0', fontSize: '1.3rem', color: 'var(--text-main)' }}>{user.name}</h4>
                <p className="mini-title" style={{ color: 'var(--lavender)', fontWeight: '700' }}>
                  {getRoleDisplay(user.role)}
                </p>
                {user.isPrivate && (
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '4px', 
                    fontSize: '0.8rem',
                    color: 'var(--text-dim)',
                    marginTop: '4px'
                  }}>
                    <span>🔒</span>
                    <span>Private Account</span>
                  </div>
                )}
              </div>
            </div>
            
            <div className="mini-info">
              <div className="profile-stats" style={{ marginTop: '20px' }}>
                <div className="network-tabs-container">
                  <div className="network-tab-item active">
                    <span className="network-tab-text">Posts</span>
                    <span className="network-tab-badge">{posts.length}</span>
                  </div>
                  <div className="network-tab-item">
                    <span className="network-tab-text">Connections</span>
                    <span className="network-tab-badge">{user.connections?.length || 0}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="quick-actions-card">
            <h3 className="sidebar-title">
              <span>🔗 Connection</span>
            </h3>
            <div className="connection-actions">
              {connectionStatus === 'none' && (
                <button 
                  className="quick-action-btn"
                  onClick={handleConnect}
                  disabled={isLoadingConnection}
                  style={{ width: '100%', justifyContent: 'center' }}
                >
                  <span className="action-icon">🤝</span>
                  <span>{isLoadingConnection ? 'Connecting...' : 'Connect'}</span>
                </button>
              )}
              
              {connectionStatus === 'request_sent' && (
                <div className="connection-btn-group">
                  <button className="quick-action-btn" disabled style={{ flex: 1 }}>
                    <span className="action-icon">⏳</span>
                    <span>Request Sent</span>
                  </button>
                  <button 
                    className="quick-action-btn"
                    onClick={handleCancelRequest}
                    style={{ width: '50px', padding: '10px' }}
                  >
                    ×
                  </button>
                </div>
              )}
              
              {connectionStatus === 'request_received' && (
                <div className="connection-btn-group">
                  <button 
                    className="quick-action-btn"
                    onClick={handleAcceptRequest}
                    disabled={isLoadingConnection}
                    style={{ flex: 1 }}
                  >
                    <span className="action-icon">✓</span>
                    <span>{isLoadingConnection ? 'Accepting...' : 'Accept'}</span>
                  </button>
                  <button 
                    className="quick-action-btn"
                    onClick={handleRejectRequest}
                    style={{ flex: 1 }}
                  >
                    <span className="action-icon">✗</span>
                    <span>Reject</span>
                  </button>
                </div>
              )}
              
              {connectionStatus === 'connected' && (
                <div className="connection-btn-group">
                  <button className="quick-action-btn" disabled style={{ flex: 1 }}>
                    <span className="action-icon">✓</span>
                    <span>Connected</span>
                  </button>
                  <button 
                    className="quick-action-btn"
                    onClick={handleRemoveConnection}
                    style={{ flex: 1 }}
                  >
                    <span className="action-icon">🗑️</span>
                    <span>Remove</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {user.skills && user.skills.length > 0 && (
            <div className="trending-card">
              <h3 className="sidebar-title">
                <span>🛠️ Skills</span>
              </h3>
              <div className="trending-list">
                {(showMoreSkills ? user.skills : user.skills.slice(0, 5)).map((skill, index) => (
                  <div key={index} className="trending-item">
                    <div className="trending-info">
                      <h4>{skill}</h4>
                    </div>
                  </div>
                ))}
                {user.skills.length > 5 && (
                  <button 
                    className="view-more-btn"
                    onClick={() => setShowMoreSkills(!showMoreSkills)}
                  >
                    {showMoreSkills ? 'Show less' : `Show ${user.skills.length - 5} more`}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ========== MAIN CONTENT ========== */}
        <div className="main-content feed-main">
          <div className="create-post-card" style={{ padding: '30px', marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '24px', marginBottom: '20px' }}>
              <div className="user-avatar" style={{ width: '100px', height: '100px', fontSize: '36px' }}>
                {getUserAvatar(user)}
              </div>
              <div style={{ flex: 1 }}>
                <h1 style={{ margin: '0 0 8px 0', fontSize: '2rem', color: 'var(--text-main)' }}>{user.name}</h1>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px', flexWrap: 'wrap' }}>
                  <span style={{ color: 'var(--lavender)', fontWeight: '700' }}>
                    {getRoleDisplay(user.role)}
                  </span>
                  {user.department && (
                    <span style={{ color: 'var(--text-dim)', fontSize: '0.95rem' }}>
                      • {user.department}
                    </span>
                  )}
                  {user.year && (
                    <span style={{ color: 'var(--text-dim)', fontSize: '0.95rem' }}>
                      • {user.year} Year
                    </span>
                  )}
                  {user.isPrivate && (
                    <span style={{ 
                      color: 'var(--text-dim)', 
                      fontSize: '0.95rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}>
                      • 🔒 Private Account
                    </span>
                  )}
                </div>
                <div style={{ color: 'var(--text-dim)', fontSize: '0.9rem' }}>
                  {user.email && <span>📧 {user.email}</span>}
                  {user.contact && <span style={{ marginLeft: '12px' }}>📞 {user.contact}</span>}
                </div>
              </div>
            </div>

            {user.bio && (
              <div style={{ marginTop: '20px', paddingTop: '20px', borderTop: '1px solid var(--border)' }}>
                <h3 style={{ color: 'var(--lavender)', marginBottom: '12px', fontSize: '1rem' }}>📝 About</h3>
                <p style={{ color: 'var(--text-main)', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>
                  {user.bio}
                </p>
              </div>
            )}

            <div style={{ marginTop: '20px', paddingTop: '20px', borderTop: '1px solid var(--border)' }}>
              <h3 style={{ color: 'var(--lavender)', marginBottom: '12px', fontSize: '1rem' }}>🏛️ Campus Info</h3>
              <div className="campus-info-grid">
                <div className="campus-info-item">
                  <div className="campus-info-label">🏫 College</div>
                  <div className="campus-info-value">SIGCE</div>
                </div>
                {user.department && (
                  <div className="campus-info-item">
                    <div className="campus-info-label">🎓 Program</div>
                    <div className="campus-info-value">{user.department}</div>
                  </div>
                )}
                {user.year && (
                  <div className="campus-info-item">
                    <div className="campus-info-label">📅 Year</div>
                    <div className="campus-info-value">{user.year}</div>
                  </div>
                )}
                <div className="campus-info-item">
                  <div className="campus-info-label">👥 Connections</div>
                  <div className="campus-info-value" style={{ color: 'var(--lavender)', fontSize: '1.2rem' }}>
                    {user.connections?.length || 0}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="posts-container">
            <div className="profile-section">
              <h2 style={{ margin: '0 0 20px 0', color: 'var(--text-main)', fontSize: '1.2rem' }}>
                {user.name}'s Posts ({posts.length})
              </h2>
              
              {!shouldShowPosts() ? (
                <div className="notifications-empty">
                  <div className="empty-icon">🔒</div>
                  <h3>Private Profile</h3>
                  <p>
                    {user.isPrivate 
                      ? `This account is private. Connect with ${user.name} to see their posts.`
                      : "You need to be connected to view posts."}
                  </p>
                  {connectionStatus === 'none' && (
                    <button 
                      className="post-submit-btn"
                      onClick={handleConnect}
                      style={{ marginTop: '20px' }}
                    >
                      Send Connection Request
                    </button>
                  )}
                </div>
              ) : posts.length === 0 ? (
                <div className="notifications-empty">
                  <div className="empty-icon">📝</div>
                  <h3>No posts yet</h3>
                  <p>{user.name} hasn't shared any posts yet.</p>
                </div>
              ) : (
                <>
                  {posts.map(post => {
                    const isOwner = currentUser && post.user?.id === currentUser.id;
                    
                    return (
                      <div key={post._id} className="post-card">
                        <div className="post-header">
                          <div className="post-user">
                            <div className="post-avatar">
                              {getUserAvatar(post.user || user)}
                            </div>
                            <div className="post-user-info">
                              <div className="post-user-name">
                                {post.user?.name || user.name}
                                {user.isPrivate && (
                                  <span className="private-badge" title="Private Account"> 🔒</span>
                                )}
                                {post.user?.role === 'faculty' && (
                                  <span className="verified-badge" title="Faculty Member"> 👨‍🏫</span>
                                )}
                                {post.user?.role === 'admin' && (
                                  <span className="admin-badge" title="Administrator"> 👑</span>
                                )}
                              </div>
                              <div className="post-meta">
                                <span className="post-time">
                                  {new Date(post.createdAt).toLocaleDateString('en-US', {
                                    month: 'short',
                                    day: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  })}
                                </span>
                                {post.user?.department && (
                                  <span className="user-department">• {post.user.department}</span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="post-actions-right">
                            {(isOwner || currentUser?.role === 'admin') && (
                              <button 
                                className="delete-post-btn"
                                onClick={() => handleDeletePost(post._id)}
                                title="Delete Post"
                              >
                                🗑️
                              </button>
                            )}
                          </div>
                        </div>

                        <div className="post-content">
                          <ReadMore text={post.content} maxLength={300} />
                          
                          {post.media && post.media.length > 0 && renderMedia(post.media)}
                          
                          {post.imageUrl && !post.media && (
                            <div className="post-image">
                              <img src={post.imageUrl} alt="Post content" />
                            </div>
                          )}
                        </div>

                        <div className="post-stats">
                          <span className="stat-item">
                            👍 {(post.likes && post.likes.length) || 0}
                          </span>
                          <span className="stat-item">
                            💬 {post.comments?.length || 0}
                          </span>
                          <span className="stat-item">
                            🔄 {shareCounts[post._id] || 0}
                          </span>
                        </div>

                        <div className="post-actions-buttons">
                          <button 
                            className={`action-btn like-btn ${isPostLiked(post) ? 'liked' : ''}`}
                            onClick={() => handleLike(post._id)}
                          >
                            {isPostLiked(post) ? '❤️ Liked' : '🤍 Like'}
                          </button>
                          <button 
                            className="action-btn comment-btn"
                            onClick={() => openPostModal(post)}
                          >
                            💬 Comment
                          </button>
                          <button 
                            className="action-btn share-btn"
                            onClick={() => handleSharePost(post)}
                          >
                            🔄 Share
                          </button>
                          <button 
                            className="action-btn report-btn"
                            onClick={() => handleReportPost(post._id)}
                            title="Report inappropriate content"
                          >
                            🚨 Report
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </>
              )}
            </div>
          </div>
        </div>

        {/* ========== RIGHT SIDEBAR ========== */}
        <div className="sidebar right-sidebar">
          <div className="trending-card">
            <h3 className="sidebar-title">
              <span>📊 Profile Stats</span>
            </h3>
            
            <div className="profile-stats-grid">
              <div className="profile-stat-item">
                <span className="profile-stat-number">{posts.length}</span>
                <span className="profile-stat-label">Total Posts</span>
              </div>
              <div className="profile-stat-item">
                <span className="profile-stat-number">
                  {posts.reduce((acc, post) => acc + (post.likes?.length || 0), 0)}
                </span>
                <span className="profile-stat-label">Total Likes</span>
              </div>
              <div className="profile-stat-item">
                <span className="profile-stat-number">
                  {posts.reduce((acc, post) => acc + (post.comments?.length || 0), 0)}
                </span>
                <span className="profile-stat-label">Total Comments</span>
              </div>
              <div className="profile-stat-item">
                <span className="profile-stat-number">
                  {posts.reduce((acc, post) => acc + (shareCounts[post._id] || 0), 0)}
                </span>
                <span className="profile-stat-label">Total Shares</span>
              </div>
            </div>
          </div>

          <div className="quick-actions-card">
            <h3 className="sidebar-title">
              <span>⚡ Quick Actions</span>
            </h3>
            <div className="quick-actions-grid">
              <button className="quick-action-btn" onClick={() => navigate("/network")}>
                <span className="action-icon">👥</span>
                <span>My Network</span>
              </button>
              <button className="quick-action-btn" onClick={() => navigate("/explore")}>
                <span className="action-icon">🔍</span>
                <span>Find People</span>
              </button>
              <button className="quick-action-btn" onClick={() => navigate("/profile")}>
                <span className="action-icon">👤</span>
                <span>My Profile</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Post Modal */}
      {postModalOpen && selectedPost && (
        <PostModal
          post={selectedPost}
          currentUser={currentUser}
          onClose={closePostModal}
          onAddComment={handleAddComment}
          onLikePost={handleLike}
        />
      )}

      {/* Report Modal */}
      {showReportModal && (
        <div className="report-modal-overlay" onClick={() => setShowReportModal(false)}>
          <div className="report-modal" onClick={(e) => e.stopPropagation()}>
            <div className="report-modal-header">
              <h3>🚨 Report Post</h3>
              <button className="close-report-btn" onClick={() => setShowReportModal(false)}>×</button>
            </div>
            
            <div className="report-modal-content">
              <p className="report-instruction">Why are you reporting this post?</p>
              
              <div className="report-reasons-list">
                <select 
                  className="report-reason-select"
                  value={reportReason}
                  onChange={(e) => setReportReason(e.target.value)}
                >
                  <option value="">Select a reason</option>
                  <option value="spam">Spam or misleading content</option>
                  <option value="harassment">Harassment or bullying</option>
                  <option value="hate_speech">Hate speech or symbols</option>
                  <option value="nudity">Nudity or sexual content</option>
                  <option value="violence">Violence or dangerous content</option>
                  <option value="copyright">Copyright violation</option>
                  <option value="fake_news">Fake news or misinformation</option>
                  <option value="self_harm">Self-harm or suicide content</option>
                  <option value="scam">Scam or fraud</option>
                  <option value="other">Other (please specify)</option>
                </select>
                
                {reportReason === 'other' && (
                  <textarea
                    className="report-custom-reason"
                    placeholder="Please describe the issue..."
                    value={reportReason}
                    onChange={(e) => setReportReason(e.target.value)}
                    rows="3"
                  />
                )}
              </div>
              
              <div className="report-modal-actions">
                <button 
                  className="cancel-report-btn"
                  onClick={() => {
                    setShowReportModal(false);
                    setSelectedPostId(null);
                    setReportReason("");
                  }}
                >
                  Cancel
                </button>
                <button 
                  className="submit-report-btn"
                  onClick={handleSubmitReport}
                  disabled={!reportReason.trim()}
                >
                  Submit Report
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfilePage;