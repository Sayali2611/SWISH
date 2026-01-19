import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import "../styles/Feed.css";
import { getSocket } from "../components/NotificationBell";
import Toast from "../components/Toast";
import "../styles/Notifications.css";
import ExploreSearch from "../components/ExploreSearch";
import "../styles/ExploreSearch.css";
import PostModal from './PostModal';

// ==================== IMAGE CAROUSEL COMPONENT ====================
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

  // Combine images and videos into media array
  const media = [...(images || []), ...(videos || [])];
  
  if (!media || media.length === 0) return null;

  const isVideo = (item) => item.type === 'video';
  const totalSlides = media.length;

  // Function to handle video play/pause
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

  // Start progress update interval
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

  // Clear progress interval
  const clearProgressInterval = useCallback(() => {
    if (videoIntervalRef.current) {
      clearInterval(videoIntervalRef.current);
      videoIntervalRef.current = null;
    }
  }, []);

  // Format time helper
  const formatTime = useCallback((seconds) => {
    if (isNaN(seconds)) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }, []);

  const goToSlide = useCallback((index) => {
    // Stop any playing video before changing slide
    if (isVideo(media[currentIndex])) {
      const video = videoRefs.current[currentIndex];
      if (video) {
        video.pause();
        setIsVideoPlaying(false);
        clearProgressInterval();
      }
    }
    
    setCurrentIndex(index);
    
    // Reset video state for new slide
    setVideoProgress(0);
    setVideoCurrentTime(0);
    setVideoDuration(0);
    
    // Auto-play video if it's a video slide and carousel is in viewport
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

  // Handle video events
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

  // Handle progress bar change
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

  // Toggle mute
  const handleToggleMute = () => {
    const video = videoRefs.current[currentIndex];
    if (video) {
      video.muted = !video.muted;
      setIsMuted(video.muted);
    }
  };

  // Intersection Observer to pause video when not visible
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

  // Handle scroll events to pause videos
  useEffect(() => {
    const handleScroll = () => {
      if (!isInViewportRef.current && isVideo(media[currentIndex])) {
        const video = videoRefs.current[currentIndex];
        if (video && !video.paused) {
          video.pause();
          setIsVideoPlaying(false);
          clearProgressInterval();
        }
      }
    };

    // Throttle scroll events
    const throttledScroll = () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
      
      scrollTimeoutRef.current = setTimeout(() => {
        handleScroll();
        scrollTimeoutRef.current = null;
      }, 100);
    };

    window.addEventListener('scroll', throttledScroll, true);
    window.addEventListener('wheel', throttledScroll, true);
    
    return () => {
      window.removeEventListener('scroll', throttledScroll, true);
      window.removeEventListener('wheel', throttledScroll, true);
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, [currentIndex, media, clearProgressInterval]);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Check if user is typing in an input, textarea, or contenteditable
      const activeElement = document.activeElement;
      const isTyping = activeElement && (
        activeElement.tagName === 'INPUT' || 
        activeElement.tagName === 'TEXTAREA' ||
        activeElement.isContentEditable
      );
      
      // If user is typing in an input field, don't handle keyboard shortcuts
      if (isTyping) {
        return;
      }
      
      // Only handle keyboard events when not typing
      if (e.key === 'ArrowLeft') prevSlide();
      if (e.key === 'ArrowRight') nextSlide();
      if (e.key === ' ' || e.key === 'Spacebar') {
        e.preventDefault();
        if (isVideo(media[currentIndex])) {
          handleVideoPlayPause();
        }
      }
      if (e.key === 'Escape') {
        if (isVideo(media[currentIndex])) {
          const video = videoRefs.current[currentIndex];
          if (video) {
            video.pause();
            setIsVideoPlaying(false);
            clearProgressInterval();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [prevSlide, nextSlide, currentIndex, media, handleVideoPlayPause, clearProgressInterval]);

  // Clean up when component unmounts
  useEffect(() => {
    return () => {
      // Clean up video refs
      videoRefs.current.forEach(video => {
        if (video) {
          video.pause();
          video.src = '';
          video.load();
        }
      });
      
      // Clear intervals
      clearProgressInterval();
      
      // Clean up observer
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
      
      // Clear scroll timeout
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, [clearProgressInterval]);

  // Clean up video interval when slide changes
  useEffect(() => {
    return () => {
      clearProgressInterval();
    };
  }, [currentIndex, clearProgressInterval]);

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
                    // Clean up previous event listeners
                    el.onplay = null;
                    el.onpause = null;
                    el.onended = null;
                    el.ontimeupdate = null;
                    el.onloadedmetadata = null;
                    
                    // Add new event listeners
                    el.onplay = handleVideoPlay;
                    el.onpause = handleVideoPause;
                    el.onended = handleVideoEnded;
                    el.ontimeupdate = handleVideoTimeUpdate;
                    el.onloadedmetadata = handleVideoLoadedMetadata;
                    
                    // Set video attributes
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
const ReadMore = ({ text, maxLength = 300 }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  
  if (!text || text.length <= maxLength) {
    return <p>{text}</p>;
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

function Feed() {
  // Existing states
  const [postModalOpen, setPostModalOpen] = useState(false);
  const [selectedPost, setSelectedPost] = useState(null);
  const [allUsers, setAllUsers] = useState([]);
  const [posts, setPosts] = useState([]);
  const [newPost, setNewPost] = useState("");
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [commentTexts, setCommentTexts] = useState({});
  const [commentLoading, setCommentLoading] = useState({});
  const [activeCommentSection, setActiveCommentSection] = useState(null);
  
  const [notifCount, setNotifCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  const [toastData, setToastData] = useState(null);
  
  const [highlightedPostId, setHighlightedPostId] = useState(null);
  const [searchPostData, setSearchPostData] = useState(null);
  const [isProcessingHighlight, setIsProcessingHighlight] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [mediaPreviews, setMediaPreviews] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [showMediaUploader, setShowMediaUploader] = useState(false);
  
  const [postType, setPostType] = useState('text');
  const [showReportModal, setShowReportModal] = useState(false);
  const [selectedPostId, setSelectedPostId] = useState(null);
  const [reportReason, setReportReason] = useState("");

  const [eventData, setEventData] = useState({
    title: '',
    description: '',
    date: '',
    time: '',
    location: '',
    maxAttendees: ''
  });
  const [pollData, setPollData] = useState({
    question: '',
    options: ['', '']
  });
  
  const [rsvpLoading, setRsvpLoading] = useState({});
  const [voteLoading, setVoteLoading] = useState({});

  // SHARE STATES
  const [showShareModal, setShowShareModal] = useState(false);
  const [postToShare, setPostToShare] = useState(null);
  const [connections, setConnections] = useState([]);
  const [selectedConnections, setSelectedConnections] = useState([]);
  const [searchConnections, setSearchConnections] = useState("");
  const [shareMessage, setShareMessage] = useState("");
  const [shareLoading, setShareLoading] = useState(false);
  const [shareCounts, setShareCounts] = useState({});
  
  const navigate = useNavigate();
  const location = useLocation();
  const hasCheckedHighlightRef = useRef(false);
  const isProcessingRef = useRef(false);
  const fileInputRef = useRef(null);
  const highlightTimeoutRef = useRef(null);
  const lastHighlightTimeRef = useRef(0);
  const notificationHighlightRef = useRef(null);
  const notificationTimeoutRef = useRef(null);
  const scrollObserverRef = useRef(null);

  // Fetch user with restriction status
  const fetchUserWithRestriction = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/auth/profile`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const freshUser = await response.json();
        setUser(freshUser);
        localStorage.setItem('user', JSON.stringify(freshUser));
      }
    } catch (error) {
      console.error("Error fetching fresh user data:", error);
    }
  }, []);

  // UPDATED: Simplified restriction check
  const handleRestrictedAction = () => {
    if (!user) return false;
    
    const userStatus = user.status || 'active';
    const restrictedUntil = user.restrictedUntil || null;

    if (userStatus === 'restricted' && restrictedUntil) {
      const now = new Date();
      const restrictionEnd = new Date(restrictedUntil);
      
      if (restrictionEnd > now) {
        const formattedDate = restrictionEnd.toLocaleString();
        setError(`⏸️ Your account is restricted until ${formattedDate}. You cannot post, comment, like, or connect during this time.`);
        return true;
      } else {
        setUser(prev => ({
          ...prev,
          status: 'active',
          restrictedUntil: null
        }));
        return false;
      }
    }
    return false;
  };

  // Cleanup preview URLs
  useEffect(() => {
    return () => {
      mediaPreviews.forEach(preview => {
        if (preview.url && preview.url.startsWith('blob:')) {
          URL.revokeObjectURL(preview.url);
        }
      });
    };
  }, [mediaPreviews]);

  // Event listeners for highlights
  useEffect(() => {
    const handleFeedHighlight = () => {
      const now = Date.now();
      if (now - lastHighlightTimeRef.current < 1000) return;
      
      if (isProcessingRef.current) return;
      
      lastHighlightTimeRef.current = now;
      hasCheckedHighlightRef.current = false;
      isProcessingRef.current = false;
      
      if (highlightTimeoutRef.current) {
        clearTimeout(highlightTimeoutRef.current);
      }
      
      highlightTimeoutRef.current = setTimeout(() => {
        fetchPosts(true);
      }, 100);
    };

    const handleNotificationHighlight = (event) => {
      const postId = event.detail?.postId;
      if (!postId) return;
      
      const highlightData = {
        postId: postId,
        timestamp: Date.now(),
        from: 'notification'
      };
      localStorage.setItem('notificationHighlight', JSON.stringify(highlightData));
      
      if (notificationTimeoutRef.current) {
        clearTimeout(notificationTimeoutRef.current);
      }
      
      fetchPosts(true);
      
      notificationTimeoutRef.current = setTimeout(() => {
        localStorage.removeItem('notificationHighlight');
        notificationTimeoutRef.current = null;
      }, 15000);
    };

    const handleStorageChange = (e) => {
      if (e.key === 'searchHighlightedPost' && e.newValue) {
        const now = Date.now();
        if (now - lastHighlightTimeRef.current > 1000) {
          handleFeedHighlight();
        }
      }
    };

    window.addEventListener('feedHighlight', handleFeedHighlight);
    window.addEventListener('notificationHighlight', handleNotificationHighlight);
    window.addEventListener('storage', handleStorageChange);

    window.triggerFeedHighlight = handleFeedHighlight;
    window.refreshFeedPosts = () => {
      setRefreshTrigger(prev => prev + 1);
    };

    return () => {
      window.removeEventListener('feedHighlight', handleFeedHighlight);
      window.removeEventListener('notificationHighlight', handleNotificationHighlight);
      window.removeEventListener('storage', handleStorageChange);
      delete window.triggerFeedHighlight;
      delete window.refreshFeedPosts;
      
      if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current);
      if (notificationTimeoutRef.current) clearTimeout(notificationTimeoutRef.current);
    };
  }, []);

  // Highlight element function
  const highlightElement = (element, fromNotification = false) => {
    if (!element) return;
    
    element.scrollIntoView({ 
      behavior: 'smooth', 
      block: 'center'
    });
    
    element.classList.add('notification-highlighted');
    
    notificationTimeoutRef.current = setTimeout(() => {
      element.classList.remove('notification-highlighted');
      notificationHighlightRef.current = null;
    }, 15000);
    
    if (scrollObserverRef.current) {
      scrollObserverRef.current.disconnect();
    }
    
    scrollObserverRef.current = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting && element.classList.contains('notification-highlighted')) {
          element.classList.remove('notification-highlighted');
          scrollObserverRef.current?.disconnect();
        }
      });
    }, { threshold: 0.1 });
    
    scrollObserverRef.current.observe(element);
    
    setTimeout(() => {
      scrollObserverRef.current?.disconnect();
    }, 15000);
  };

  // Scroll and highlight post
  const scrollAndHighlightPost = useCallback((postId, fromNotification = false) => {
    if (!postId || isProcessingRef.current) return;
    
    isProcessingRef.current = true;
    const elementId = `post-${postId}`;
    
    if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current);
    
    highlightTimeoutRef.current = setTimeout(() => {
      const element = document.getElementById(elementId);
      
      if (element) {
        highlightElement(element, fromNotification);
        isProcessingRef.current = false;
        hasCheckedHighlightRef.current = true;
        return;
      }
      
      highlightTimeoutRef.current = setTimeout(() => {
        const retryElement = document.getElementById(elementId);
        if (retryElement) {
          highlightElement(retryElement, fromNotification);
          isProcessingRef.current = false;
          hasCheckedHighlightRef.current = true;
        } else {
          isProcessingRef.current = false;
        }
      }, 500);
    }, 300);
  }, [setIsProcessingHighlight]);

  // Fetch posts
  const fetchPosts = useCallback(async (forceHighlight = false) => {
    if (isProcessingRef.current && !forceHighlight) return;
    
    try {
      isProcessingRef.current = true;
      const token = localStorage.getItem('token');
      
      let queryParams = '';
      let highlightData = null;
      let highlightType = null;
      
      // Check notification highlight
      const notificationHighlight = localStorage.getItem('notificationHighlight');
      // Check search highlight
      const searchHighlight = localStorage.getItem('searchHighlightedPost');
      
      if (notificationHighlight) {
        try {
          const parsed = JSON.parse(notificationHighlight);
          if (Date.now() - parsed.timestamp < 15000) {
            highlightData = parsed;
            highlightType = 'notification';
          } else {
            localStorage.removeItem('notificationHighlight');
          }
        } catch (error) {
          localStorage.removeItem('notificationHighlight');
        }
      }
      
      if (!highlightData && searchHighlight) {
        try {
          const parsed = JSON.parse(searchHighlight);
          if (Date.now() - parsed.timestamp < 15000) {
            highlightData = parsed;
            highlightType = 'search';
          } else {
            localStorage.removeItem('searchHighlightedPost');
          }
        } catch (error) {
          localStorage.removeItem('searchHighlightedPost');
        }
      }
      
      // Send highlight to backend if we have one
      if (highlightData) {
        queryParams = `?highlight=${encodeURIComponent(JSON.stringify({
          postId: highlightData.postId,
          timestamp: highlightData.timestamp,
          type: highlightType,
          source: highlightData.from || highlightData.searchQuery || 'unknown'
        }))}`;
      }
      
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/posts${queryParams}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        navigate("/");
        return;
      }

      const data = await response.json();
      
      // Check for pinned post
      const pinnedPost = data.find(post => post.isPinned);
      if (pinnedPost) {
        setHighlightedPostId(pinnedPost._id);
        
        setTimeout(() => {
          scrollAndHighlightPost(pinnedPost._id, true);
        }, 300);
        
        if (highlightType === 'notification') {
          localStorage.removeItem('notificationHighlight');
        } else if (highlightType === 'search') {
          localStorage.removeItem('searchHighlightedPost');
          sessionStorage.removeItem('highlightedPostId');
        }
      }
      
      setPosts(data);
      isProcessingRef.current = false;
      
    } catch (error) {
      setError('Failed to fetch posts');
      console.error('Error fetching posts:', error);
      isProcessingRef.current = false;
    }
  }, [navigate, scrollAndHighlightPost, setError, setPosts, setHighlightedPostId]);

  // Fetch all users for PostModal
  const fetchAllUsers = useCallback(async () => {
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
  }, []);
  
  // ==================== SHARE FUNCTIONS ====================

  // Open share modal for a post
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
      
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/network/connections`, {
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
        const shareResponse = await fetch(`${import.meta.env.VITE_API_URL}/api/posts/${post._id}/shares`, {
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

  // Close share modal
  const closeShareModal = () => {
    setShowShareModal(false);
    setPostToShare(null);
    setSelectedConnections([]);
    setSearchConnections("");
    setShareMessage("");
  };

  // Toggle connection selection
  const toggleConnectionSelect = (connectionId) => {
    setSelectedConnections(prev => {
      if (prev.includes(connectionId)) {
        return prev.filter(id => id !== connectionId);
      } else {
        return [...prev, connectionId];
      }
    });
  };

  // Select all connections
  const selectAllConnections = () => {
    if (selectedConnections.length === connections.length) {
      setSelectedConnections([]);
    } else {
      const allConnectionIds = connections.map(conn => conn._id || conn.id);
      setSelectedConnections(allConnectionIds);
    }
  };

  // Handle share post
  const handleSharePost = async () => {
    if (!postToShare || selectedConnections.length === 0) {
      setError("Please select at least one connection to share with");
      return;
    }

    setShareLoading(true);
    setError("");

    try {
      const token = localStorage.getItem('token');
      
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/posts/${postToShare._id}/share`, {
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
        setSuccess(`✅ Post shared with ${selectedConnections.length} connection(s)!`);
        
        setShareCounts(prev => ({
          ...prev,
          [postToShare._id]: (prev[postToShare._id] || 0) + selectedConnections.length
        }));

        fetchPosts();
        
        closeShareModal();
        setTimeout(() => setSuccess(""), 3000);
      } else {
        setError(data.message || 'Failed to share post. Please try again.');
      }
    } catch (error) {
      setError('Network error: Unable to share post. Please check your connection.');
    } finally {
      setShareLoading(false);
    }
  };

  // Filter connections based on search
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

  // Main initialization effect
  useEffect(() => {
    const userData = localStorage.getItem('user');
    const token = localStorage.getItem('token');
    
    if (!userData || !token) {
      navigate("/");
      return;
    }

    const userObj = JSON.parse(userData);
    setUser(userObj);
    
    if (userObj.status === 'restricted') {
      fetchUserWithRestriction();
    }

    isProcessingRef.current = false;
    fetchPosts();
    fetchAllUsers();

    // SOCKET/NOTIFICATION LOGIC
    const socket = getSocket();
    if (socket) {
      socket.on("new_notification", (payload) => {
        setNotifCount(c => c + 1);
        setToastData({
          userName: payload.userName || "New Activity",
          message: payload.message || "You have a new notification.",
          userImage: payload.userImage,
          timeAgo: "just now",
          postId: payload.postId
        });
      });

      const fetchInitialCount = async () => {
        try {
          const response = await fetch(`${import.meta.env.VITE_API_URL}/api/notifications/unread/count`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          const data = await response.json();
          setNotifCount(data.count || 0);
        } catch (error) {
          console.error("Failed to fetch initial notification count:", error);
        }
      };
      fetchInitialCount();
    }

    return () => {
      if (socket) socket.off("new_notification");
    };
  }, [navigate, refreshTrigger, fetchPosts, fetchAllUsers, fetchUserWithRestriction]);

  // Check URL for highlight parameters
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const highlightId = params.get('highlight');
    
    if (highlightId && !hasCheckedHighlightRef.current) {
      const highlightData = {
        postId: highlightId,
        timestamp: Date.now(),
        from: 'url'
      };
      localStorage.setItem('searchHighlightedPost', JSON.stringify(highlightData));
      fetchPosts(true);
    }
  }, [location, fetchPosts]);

  // Handle scroll when posts are set
  useEffect(() => {
    if (highlightedPostId && posts.length > 0 && isProcessingHighlight) {
      const isAtTop = posts[0]?._id === highlightedPostId;
      
      if (isAtTop) {
        if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current);
        
        highlightTimeoutRef.current = setTimeout(() => {
          scrollAndHighlightPost(highlightedPostId);
        }, 300);
      }
    }
  }, [posts, highlightedPostId, isProcessingHighlight, scrollAndHighlightPost]);

  // Cleanup effect
  useEffect(() => {
    return () => {
      localStorage.removeItem('notificationHighlight');
      localStorage.removeItem('searchHighlightedPost');
      sessionStorage.removeItem('highlightedPostId');
    };
  }, []);

  // ==================== MEDIA UPLOAD FUNCTIONS ====================
  const handleFileSelect = (e) => {
    const files = e.target.files;
    if (!files.length) return;

    const fileArray = Array.from(files);
    
    const newPreviews = fileArray.map(file => {
      return {
        file: file,
        url: URL.createObjectURL(file),
        type: file.type.startsWith('image/') ? 'image' : 'video',
        name: file.name,
        size: file.size
      };
    });
    
    setSelectedFiles(prev => [...prev, ...fileArray]);
    setMediaPreviews(prev => [...prev, ...newPreviews]);
    setShowMediaUploader(true);
  };

  const handleRemoveFile = (index) => {
    if (mediaPreviews[index]?.url) {
      URL.revokeObjectURL(mediaPreviews[index].url);
    }
    
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
    setMediaPreviews(prev => prev.filter((_, i) => i !== index));
    
    if (mediaPreviews.length <= 1) {
      setShowMediaUploader(false);
    }
  };

  const toggleMediaUploader = () => {
    setShowMediaUploader(!showMediaUploader);
  };

  // ==================== EVENT AND POLL FUNCTIONS ====================
  const handleEventChange = (field, value) => {
    setEventData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handlePollChange = (field, value) => {
    setPollData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handlePollOptionChange = (index, value) => {
    const newOptions = [...pollData.options];
    newOptions[index] = value;
    setPollData(prev => ({
      ...prev,
      options: newOptions
    }));
  };

  const addPollOption = () => {
    if (pollData.options.length < 6) {
      setPollData(prev => ({
        ...prev,
        options: [...prev.options, '']
      }));
    }
  };

  const removePollOption = (index) => {
    if (pollData.options.length > 2) {
      const newOptions = pollData.options.filter((_, i) => i !== index);
      setPollData(prev => ({
        ...prev,
        options: newOptions
      }));
    }
  };

  // ==================== POST CREATION ====================
  const handleCreatePost = async () => {
    if (user?.status === 'restricted') {
      if (handleRestrictedAction()) return;
    }

      let postData = { content: newPost };

       if (postType === 'text' && !newPost.trim() && selectedFiles.length === 0) {
    setError('Post content or media is required for text posts');
    return;
  }
    
    if (postType === 'event') {
      if (!eventData.title || !eventData.date || !eventData.time || !eventData.location) {
        setError('Please fill all required event fields');
        return;
      }
      
      postData = {
        ...postData,
        type: 'event',
        event: {
          ...eventData,
          dateTime: new Date(`${eventData.date}T${eventData.time}`).toISOString(),
          attendees: [],
          rsvpCount: 0
        }
      };
    } else if (postType === 'poll') {
      const validOptions = pollData.options.filter(opt => opt && opt.trim());
      if (!pollData.question || validOptions.length < 2) {
        setError('Poll must have a question and at least 2 options');
        return;
      }
      
      postData = {
        ...postData,
        type: 'poll',
        poll: {
          question: pollData.question,
          options: validOptions,
        }
      };
    }

    if (postType === 'text' && !postData.content.trim() && selectedFiles.length === 0) {
      setError('Post content or media is required for text posts');
      return;
    }

    if (postType === 'event' && !postData.content.trim() && selectedFiles.length === 0) {
      postData.content = `Event: ${eventData.title}`;
    }

    if (postType === 'poll' && !postData.content.trim() && selectedFiles.length === 0) {
      postData.content = `Poll: ${pollData.question}`;
    }

    setLoading(true);
    setIsUploading(true);
    setError("");

    try {
      const token = localStorage.getItem('token');
      let response;
      let result;
      
      if (selectedFiles.length > 0) {
        const formData = new FormData();
        formData.append('content', postData.content);
        formData.append('type', postType);
        
        if (postType === 'event') {
          formData.append('event', JSON.stringify(postData.event));
        } else if (postType === 'poll') {
          formData.append('poll', JSON.stringify(postData.poll));
        }
        
        selectedFiles.forEach((file) => {
          formData.append('media', file);
        });

        response = await fetch(`${import.meta.env.VITE_API_URL}/api/posts/upload`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` },
          body: formData
        });

        result = await response.json();
      } else {
        response = await fetch(`${import.meta.env.VITE_API_URL}/api/posts`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(postData)
        });

        result = await response.json();
      }
      
      if (response.ok) {
        handlePostSuccess(result);
      } else {
        setError(result.message || 'Failed to create post. Please try again.');
      }
    } catch (error) {
      setError('Network error: ' + error.message);
    } finally {
      setLoading(false);
      setIsUploading(false);
    }
  };

  const handlePostSuccess = (data) => {
    setNewPost("");
    setSelectedFiles([]);
    setMediaPreviews([]);
    setShowMediaUploader(false);
    
    if (postType === 'event') {
      setEventData({
        title: '',
        description: '',
        date: '',
        time: '',
        location: '',
        maxAttendees: ''
      });
    } else if (postType === 'poll') {
      setPollData({
        question: '',
        options: ['', '']
      });
    }
    
    setPostType('text');
    
    const newPostData = data.post || data;
    setPosts(prevPosts => [newPostData, ...prevPosts]);
    setSuccess('✅ Post created successfully!');
    setTimeout(() => setSuccess(""), 3000);
  };

  // ==================== POST INTERACTIONS ====================
  const handleEventRSVP = async (postId, status) => {
    if (user?.status === 'restricted') {
      if (handleRestrictedAction()) return;
    }
    if (!user) return;

    setRsvpLoading(prev => ({ ...prev, [postId]: true }));
    
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/posts/${postId}/rsvp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status })
      });

      const data = await response.json();
      
      if (response.ok) {
        setPosts(prevPosts => 
          prevPosts.map(post => 
            post._id === postId ? data.post : post
          )
        );
        setSuccess(`RSVP ${status} successful!`);
        setTimeout(() => setSuccess(""), 2000);
      } else {
        setError(data.message || 'Failed to RSVP');
      }
    } catch (error) {
      setError('Network error: Unable to RSVP');
    } finally {
      setRsvpLoading(prev => ({ ...prev, [postId]: false }));
    }
  };

  const handlePollVote = async (postId, optionIndex) => {
    if (user?.status === 'restricted') {
      if (handleRestrictedAction()) return;
    }
    if (!user) return;

    setVoteLoading(prev => ({ ...prev, [postId]: true }));
    
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/posts/${postId}/vote`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ optionIndex })
      });

      const data = await response.json();
      
      if (response.ok) {
        setPosts(prevPosts => 
          prevPosts.map(post => 
            post._id === postId ? data.post : post
          )
        );
        setSuccess('Vote submitted!');
        setTimeout(() => setSuccess(""), 2000);
      } else {
        setError(data.message || 'Failed to vote');
      }
    } catch (error) {
      setError('Network error: Unable to vote');
    } finally {
      setVoteLoading(prev => ({ ...prev, [postId]: false }));
    }
  };

  const handleLike = async (postId) => {
    if (user?.status === 'restricted') {
      if (handleRestrictedAction()) return;
    }
    if (!user) return;

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
      // Silent catch
    }
  };

  const handleAddComment = async (postId, commentText) => {
    if (user?.status === 'restricted') {
      if (handleRestrictedAction()) return;
    }
    if (!commentText?.trim() || !user) return;

    setCommentLoading(prev => ({ ...prev, [postId]: true }));
    
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/posts/${postId}/comment`, {
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
        setCommentTexts(prev => ({ ...prev, [postId]: "" }));
        setPosts(prevPosts => 
          prevPosts.map(post => 
            post._id === postId ? data.post : post
          )
        );
        
        if (selectedPost && selectedPost._id === postId) {
          setSelectedPost(data.post);
        }
        
        setSuccess('Comment added successfully!');
        setTimeout(() => setSuccess(""), 2000);
        return data.post;
      }
    } catch (error) {
      return null;
    } finally {
      setCommentLoading(prev => ({ ...prev, [postId]: false }));
    }
  };

  // Open post modal with comments and likes
  const openPostModal = (post) => {
    setSelectedPost(post);
    setPostModalOpen(true);
  };

  // Close post modal
  const closePostModal = () => {
    setSelectedPost(null);
    setPostModalOpen(false);
  };

  // Handle edit comment
  const handleEditComment = async (postId, commentId, text) => {
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
        setPosts(prevPosts => 
          prevPosts.map(post => 
            post._id === postId ? data.post : post
          )
        );
        
        if (selectedPost && selectedPost._id === postId) {
          setSelectedPost(data.post);
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

  const handleDeleteComment = async (postId, commentId) => {
    if (!window.confirm('Delete this comment?')) return;

    try {
      const token = localStorage.getItem('token');
      
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/posts/${postId}/comments/${commentId}`, {
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
        
        setSuccess('Comment deleted!');
        setTimeout(() => setSuccess(""), 2000);
        return data.post;
      } else {
        const errorData = await response.json();
        setError(errorData.message || 'Failed to delete comment');
        return null;
      }
    } catch (error) {
      setError('Failed to delete comment');
      return null;
    }
  };

  const handleLikeComment = async (postId, commentId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/posts/${postId}/comments/${commentId}/like`, {
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
        setError(errorData.message || 'Failed to like comment');
        return null;
      }
    } catch (error) {
      setError('Failed to like comment');
      return null;
    }
  };

  // ==================== POST DELETE FUNCTION ====================
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
        setPosts(prevPosts => prevPosts.filter(post => post._id !== postId));
        setSuccess('Post deleted successfully!');
        setTimeout(() => setSuccess(""), 3000);
      } else {
        const data = await response.json();
        setError(data.message || 'Failed to delete post');
      }
    } catch (error) {
      setError('Network error: Unable to delete post');
    }
  };

  // Report post function
  const handleReportPost = async (postId) => {
    setSelectedPostId(postId);
    setShowReportModal(true);
    setReportReason("");
  };

  // New function to submit the report
  const handleSubmitReport = async () => {
    if (!selectedPostId || !reportReason.trim()) {
      setError("Please select a reason for reporting");
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/posts/${selectedPostId}/report`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ reason: reportReason })
      });

      const data = await response.json();
      
      if (response.ok) {
        setSuccess('✅ Post reported successfully! Admin will review it.');
        setTimeout(() => setSuccess(""), 3000);
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

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate("/");
  };

  const isPostLiked = (post) => {
    if (!user || !post.likes) return false;
    
    const userId = user.id;
    
    // Check if current user liked this post
    return post.likes.some(like => {
      // Handle string format (old): like = "userId"
      if (typeof like === 'string') {
        return like === userId;
      }
      // Handle object format (new): like = {userId: "123", userName: "John", ...}
      else if (like && typeof like === 'object' && like.userId) {
        return like.userId === userId;
      }
      return false;
    });
  };

  // Check if user has RSVPed to an event
  const getUserRSVPStatus = (post) => {
    if (!post.event?.attendees || !user) return null;
    const userRSVP = post.event.attendees.find(a => a.userId === user.id);
    return userRSVP ? userRSVP.status : null;
  };

  // Check if user has voted in a poll
  const getUserVoteStatus = (post) => {
    if (!post.poll?.voters || !user) return null;
    return post.poll.voters.find(v => v.userId === user.id);
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

  const handleCommentChange = (postId, text) => {
    setCommentTexts(prev => ({
      ...prev,
      [postId]: text
    }));
  };

  const toggleCommentSection = (postId) => {
    setActiveCommentSection(activeCommentSection === postId ? null : postId);
  };

  // Notification click handler
  const handleClickNotification = async () => {
    const token = localStorage.getItem("token");

    setToastData(null);

    if (notifCount > 0) {
      try {
        await fetch(`${import.meta.env.VITE_API_URL}/api/notifications/read-all`, {
          method: "PUT",
          headers: { Authorization: `Bearer ${token}` }
        });
      } catch (err) {
        console.error("Failed to mark as read:", err);
      }
    }

    setNotifCount(0);
    navigate("/notifications");
  };

  // Handler for user selected from search
  const handleUserSelectFromSearch = (selectedUser) => {
    if (selectedUser && selectedUser._id) {
      navigate(`/profile/${selectedUser._id}`); 
    }
  };

  // Manual refresh function
  const handleManualRefresh = () => {
    hasCheckedHighlightRef.current = false;
    setIsProcessingHighlight(false);
    setRefreshTrigger(prev => prev + 1);
  };

  // ==================== RENDER FUNCTIONS ====================

  // Render event card
  const renderEventCard = (event) => {
    if (!event) return null;
    
    const eventDate = new Date(event.dateTime);
    const now = new Date();
    const isPastEvent = eventDate < now;
    
    return (
      <div className="event-card">
        <div className="event-header">
          <div className="event-title">{event.title}</div>
          <div className="event-date-badge">
            {eventDate.toLocaleDateString('en-US', { 
              weekday: 'short', 
              month: 'short', 
              day: 'numeric' 
            })}
          </div>
        </div>
        
        {event.description && (
          <p className="event-description">{event.description}</p>
        )}
        
        <div className="event-details">
          <div className="event-detail">
            <span className="event-icon">🕒</span>
            <span>{eventDate.toLocaleTimeString('en-US', { 
              hour: '2-digit', 
              minute: '2-digit' 
            })}</span>
          </div>
          
          <div className="event-detail">
            <span className="event-icon">📍</span>
            <span>{event.location}</span>
          </div>
          
          {event.maxAttendees && (
            <div className="event-detail">
              <span className="event-icon">👥</span>
              <span>Max: {event.maxAttendees}</span>
            </div>
          )}
        </div>
        
        <div className="event-stats">
          <div className="going-count">
            <span className="going-badge">{event.rsvpCount || 0} going</span>
            {event.maxAttendees && (
              <span className="capacity">
                ({event.attendees?.length || 0}/{event.maxAttendees})
              </span>
            )}
          </div>
        </div>
      </div>
    );
  };

  // Render poll card
  const renderPollCard = (poll, postId) => {
    if (!poll) return null;
    
    const userVote = getUserVoteStatus({ poll });
    const totalVotes = poll.totalVotes || 0;
    
    return (
      <div className="poll-card">
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
                onClick={() => !userVote && !voteLoading[postId] && handlePollVote(postId, index)}
                style={{ cursor: userVote || voteLoading[postId] ? 'default' : 'pointer' }}
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
            <button 
              className="vote-btn"
              onClick={() => {}}
              disabled={voteLoading[postId]}
              style={{ opacity: 0.6, cursor: 'default' }}
            >
              Click an option to vote
            </button>
          )}
        </div>
      </div>
    );
  };

  // Updated renderMedia function to use carousel
  const renderMedia = (media) => {
    if (!media || media.length === 0) return null;
    
    // Separate images and videos for the carousel
    const images = media.filter(item => item.type === 'image');
    const videos = media.filter(item => item.type === 'video');
    
    return (
      <ImageCarousel images={images} videos={videos} />
    );
  };

  if (!user) {
    return (
      <div className="loading-container">
        <div className="loading-spinner">Loading...</div>
      </div>
    );
  }

  return (
    <div className="feed-layout">
      {/* Header */}
      <header className="feed-header-bar">
        <div className="header-left">
          <div className="logo" onClick={() => navigate("/feed")}>
            <span className="logo-icon">💼</span>
            <span className="logo-text">Swish</span>
          </div>
          
          {/* SEARCH BAR */}
          <div className="feed-search-wrapper">
            <ExploreSearch onUserSelect={handleUserSelectFromSearch} />
          </div>

          <div className="nav-items">
            <button className="nav-btn active">
              <span className="nav-icon">🏠</span>
              <span className="nav-text">Feed</span>
            </button>
            <button className="nav-btn" onClick={() => navigate("/profile")}>
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
            <button 
              className={`nav-btn notification-bell-btn`}
              onClick={handleClickNotification}
              title="Notifications"
            >
              <span className="nav-icon">🔔</span>
              <span className="nav-text">Notifications</span>
              {notifCount > 0 && <span className="notif-badge">{notifCount}</span>}
            </button>
          </div>
        </div>
        
        <div className="header-right">
          {user.role === 'admin' && (
            <button 
              className="admin-btn"
              onClick={() => navigate("/admin")}
            >
              <span className="admin-icon">👑</span>
              <span>Admin</span>
            </button>
          )}
          
          <div className="user-info">
            <div 
              className="user-avatar" 
              title="View Profile"
              onClick={() => navigate("/profile")}
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

      {/* Error/Success Notifications */}
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

      <div className="feed-layout-container">
        {/* ========== ENHANCED LEFT SIDEBAR ========== */}
        <div className="sidebar left-sidebar">
          <div className="profile-mini-card" onClick={() => navigate("/profile")}>
            <div className="mini-avatar">
              {getUserAvatar(user)}
            </div>
            <div className="mini-info">
              <h4>{user?.name || "User"}</h4>
              <p className="mini-title">
                {user?.role === 'student' ? `🎓 ${user?.department || 'Student'}` : 
                 user?.role === 'faculty' ? `👨‍🏫 ${user?.department || 'Faculty'}` : 
                 user?.role === 'admin' ? '👑 Administrator' : '👤 Member'}
              </p>
              <p className="mini-bio">
                {user?.bio?.slice(0, 80) || "Welcome to Swish! Connect with your college community."}
              </p>
            </div>
            <div className="mini-stats">
              {/* UPDATED: Changed to network tabs style */}
              <div className="network-tabs-container" style={{ marginTop: '20px' }}>
                <div className="network-tab-item active">
                  <span className="network-tab-text">Posts</span>
                  <span className="network-tab-badge">{posts.filter(p => p.user?.id === user.id).length}</span>
                </div>
                <div className="network-tab-item">
                  <span className="network-tab-text">Likes</span>
                  <span className="network-tab-badge">{posts.reduce((acc, post) => acc + (post.likes?.length || 0), 0)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="quick-actions-card">
            <h3 className="sidebar-title">
              <span>⚡ Quick Actions</span>
            </h3>
            <div className="quick-actions-grid">
              <button className="quick-action-btn" onClick={() => document.querySelector('.post-input-section input')?.focus()}>
                <span className="action-icon">✏️</span>
                <span>Create Post</span>
              </button>
              <button className="quick-action-btn" onClick={() => navigate("/explore")}>
                <span className="action-icon">🔍</span>
                <span>Find People</span>
              </button>
              <button className="quick-action-btn" onClick={() => navigate("/network")}>
                <span className="action-icon">👥</span>
                <span>My Network</span>
              </button>
              <button className="quick-action-btn" onClick={() => navigate("/explore?tab=events")}>
                <span className="action-icon">📅</span>
                <span>Events</span>
              </button>
            </div>
          </div>

          
        </div>

        {/* ========== MAIN CONTENT: FEED ========== */}
        <div className="main-content feed-main">
          {/* Create Post Card */}
          <div className="create-post-card">
            <div className="post-input-section">
              <div className="user-avatar-small">
                {getUserAvatar(user)}
              </div>
                <textarea  // ✅ CHANGE TO TEXTAREA
                  placeholder="What's happening on campus? Share updates, events, or thoughts... 🎓"
                  value={newPost}
                  onChange={(e) => setNewPost(e.target.value)}
                  onKeyDown={(e) => {
                    // Submit on Ctrl+Enter or Cmd+Enter
                    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                      handleCreatePost();
                    }
                  }}
                  maxLength={2000}
                  disabled={isUploading}
                  rows={4} // Add this
                  style={{
                    resize: 'vertical',
                    minHeight: '100px',
                    fontFamily: 'inherit',
                    fontSize: '16px',
                    lineHeight: '1.5',
                    whiteSpace: 'pre-wrap', // This preserves line breaks
                    overflowWrap: 'break-word',
                    padding: '15px 24px',
                    width: '100%'
                  }}
                />
            </div>
            
            {/* Event Creation Form */}
            {postType === 'event' && (
              <div className="event-form">
                <div className="form-row">
                  <div className="form-group">
                    <label>Event Title *</label>
                    <input 
                      type="text" 
                      placeholder="e.g., Sports Day"
                      value={eventData.title}
                      onChange={(e) => handleEventChange('title', e.target.value)}
                      disabled={isUploading}
                    />
                  </div>
                  <div className="form-group">
                    <label>Location *</label>
                    <input 
                      type="text" 
                      placeholder="e.g., Main Ground"
                      value={eventData.location}
                      onChange={(e) => handleEventChange('location', e.target.value)}
                      disabled={isUploading}
                    />
                  </div>
                </div>
                
                <div className="form-row">
                  <div className="form-group">
                    <label>Date *</label>
                    <input 
                      type="date" 
                      value={eventData.date}
                      onChange={(e) => handleEventChange('date', e.target.value)}
                      disabled={isUploading}
                    />
                  </div>
                  <div className="form-group">
                    <label>Time *</label>
                    <input 
                      type="time" 
                      value={eventData.time}
                      onChange={(e) => handleEventChange('time', e.target.value)}
                      disabled={isUploading}
                    />
                  </div>
                </div>
                
                <div className="form-group">
                  <label>Description</label>
                  <textarea 
                      placeholder="Describe your event..."
                      value={eventData.description}
                      onChange={(e) => handleEventChange('description', e.target.value)}
                      disabled={isUploading}
                      rows={3}
                      style={{
                        whiteSpace: 'pre-wrap',
                        overflowWrap: 'break-word',
                        resize: 'vertical'
                      }}
                    />
                </div>
                
                <div className="form-group">
                  <label>Max Attendees (optional)</label>
                  <input 
                    type="number" 
                    placeholder="Leave empty for unlimited"
                    value={eventData.maxAttendees}
                    onChange={(e) => handleEventChange('maxAttendees', e.target.value)}
                    disabled={isUploading}
                    min="1"
                  />
                </div>
              </div>
            )}
            
            {/* Poll Creation Form */}
            {postType === 'poll' && (
              <div className="poll-form">
                <div className="form-group">
                  <label>Poll Question *</label>
                  <textarea  // Change from input to textarea
                      placeholder={`Option ${index + 1}`}
                      value={option}
                      onChange={(e) => handlePollOptionChange(index, e.target.value)}
                      disabled={isUploading}
                      rows={2}
                      style={{
                        whiteSpace: 'pre-wrap',
                        overflowWrap: 'break-word',
                        resize: 'vertical'
                      }}
                    />
                </div>
                
                <div className="poll-options">
                  <label>Options (minimum 2) *</label>
                  {pollData.options.map((option, index) => (
                    <div key={index} className="poll-option">
                      <input 
                        type="text" 
                        placeholder={`Option ${index + 1}`}
                        value={option}
                        onChange={(e) => handlePollOptionChange(index, e.target.value)}
                        disabled={isUploading}
                      />
                      {pollData.options.length > 2 && (
                        <button 
                          type="button" 
                          className="remove-option-btn"
                          onClick={() => removePollOption(index)}
                          disabled={isUploading}
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  ))}
                  
                  {pollData.options.length < 6 && (
                    <button 
                      type="button" 
                      className="add-option-btn"
                      onClick={addPollOption}
                      disabled={isUploading}
                    >
                      + Add Option
                    </button>
                  )}
                </div>
              </div>
            )}
            
            {/* Media Upload Section (only for text posts) */}
            {postType === 'text' && showMediaUploader && (
              <div className="media-upload-section">
                <div className="media-preview-container">
                  {mediaPreviews.map((preview, index) => (
                    <div key={index} className="media-preview-item">
                      {preview.type === 'image' ? (
                        <img src={preview.url} alt={`Preview ${index}`} />
                      ) : (
                        <div className="video-preview">
                          <video src={preview.url} />
                          <span className="video-icon">🎥</span>
                        </div>
                      )}
                      <button 
                        className="remove-media-btn"
                        onClick={() => handleRemoveFile(index)}
                        disabled={isUploading}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
                <div className="media-upload-controls">
                  <input
                    type="file"
                    id="media-upload"
                    multiple
                    accept="image/*,video/*"
                    onChange={handleFileSelect}
                    style={{ display: 'none' }}
                    disabled={isUploading}
                  />
                  <label htmlFor="media-upload" className="add-more-btn">
                    + Add More
                  </label>
                  <button 
                    className="clear-all-btn"
                    onClick={() => {
                      mediaPreviews.forEach(preview => {
                        if (preview.url) URL.revokeObjectURL(preview.url);
                      });
                      setSelectedFiles([]);
                      setMediaPreviews([]);
                      setShowMediaUploader(false);
                    }}
                    disabled={isUploading}
                  >
                    Clear All
                  </button>
                </div>
              </div>
            )}
            
            <div className="post-actions">
              <div className="post-features" style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                {/* Media upload button (only for text posts) */}
                {postType === 'text' && (
                  <button 
                    className="feature-btn" 
                    title="Add Photos/Videos"
                    onClick={toggleMediaUploader}
                    disabled={isUploading}
                    style={{ 
                      backgroundColor: showMediaUploader ? 'rgba(167, 139, 250, 0.1)' : 'transparent',
                      color: showMediaUploader ? '#c4b5fd' : '#9ca3af',
                      border: '1px solid #374151',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      transition: 'all 0.2s'
                    }}
                  >
                    {mediaPreviews.length > 0 ? `🖼️ ${mediaPreviews.length}` : '🖼️ Media'}
                  </button>
                )}
                
                {/* Event Button */}
                <button 
                  className="feature-btn" 
                  title="Create Event"
                  onClick={() => setPostType(postType === 'event' ? 'text' : 'event')}
                  disabled={isUploading}
                  style={{ 
                    backgroundColor: postType === 'event' ? 'rgba(167, 139, 250, 0.1)' : 'transparent',
                    color: postType === 'event' ? '#c4b5fd' : '#9ca3af',
                    border: '1px solid #374151',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                    transition: 'all 0.2s'
                  }}
                >
                  📅 Event
                </button>
                
                {/* Poll Button */}
                <button 
                  className="feature-btn" 
                  title="Create Poll"
                  onClick={() => setPostType(postType === 'poll' ? 'text' : 'poll')}
                  disabled={isUploading}
                  style={{ 
                    backgroundColor: postType === 'poll' ? 'rgba(167, 139, 250, 0.1)' : 'transparent',
                    color: postType === 'poll' ? '#c4b5fd' : '#9ca3af',
                    border: '1px solid #374151',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                    transition: 'all 0.2s'
                  }}
                >
                  📊 Poll
                </button>
                
                {/* Hidden file input for media upload */}
                <input
                  type="file"
                  id="media-upload-hidden"
                  multiple
                  accept="image/*,video/*"
                  onChange={handleFileSelect}
                  style={{ display: 'none' }}
                  disabled={isUploading}
                />
              </div>
              
              <div className="post-submit-section">
                <div className="char-count">{newPost.length}/2000</div>
                <button 
                  className="post-submit-btn" 
                  onClick={handleCreatePost}
                  disabled={(loading || isUploading) || 
                    (postType === 'text' && !newPost.trim() && selectedFiles.length === 0) ||
                    (postType === 'event' && (!eventData.title || !eventData.date || !eventData.time || !eventData.location)) ||
                    (postType === 'poll' && (!pollData.question || pollData.options.filter(opt => opt && opt.trim()).length < 2))
                  }
                >
                  {loading || isUploading ? (
                    <>
                      <div className="btn-spinner"></div>
                      {isUploading ? 'Uploading...' : 'Posting...'}
                    </>
                  ) : (
                    postType === 'text' ? (selectedFiles.length > 0 ? `📷 Post (${selectedFiles.length})` : '📝 Post') :
                    postType === 'event' ? (selectedFiles.length > 0 ? `📅 Create Event (${selectedFiles.length})` : '📅 Create Event') :
                    '📊 Create Poll'
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Posts Feed */}
          <div className="posts-container">
            {posts.length === 0 ? (
              <div className="notifications-empty">
                <div className="empty-icon">📝</div>
                <h3>No posts yet</h3>
                <p>Be the first to share something with your campus community!</p>
                <button 
                  className="feature-btn"
                  onClick={() => document.querySelector('.post-input-section input')?.focus()}
                  style={{ marginTop: '20px' }}
                >
                  Create Your First Post
                </button>
              </div>
            ) : (
              posts.map(post => {
                const isHighlighted = post._id === highlightedPostId || 
                post._id === notificationHighlightRef.current;
                const isOwner = user && post.user?.id === user.id;
                const userRSVPStatus = getUserRSVPStatus(post);
                
                return (
                  <div 
                    key={post._id} 
                    id={`post-${post._id}`}
                    className={`post-card ${isHighlighted ? 'notification-highlighted' : ''}`}
                  >
                    {isHighlighted && (
                      <div className="highlight-badge" style={{
                        position: 'absolute',
                        top: '15px',
                        right: '15px',
                        background: 'linear-gradient(135deg, var(--lavender), var(--royal-blue))',
                        color: 'var(--black)',
                        padding: '6px 12px',
                        borderRadius: '20px',
                        fontSize: '12px',
                        fontWeight: 'bold',
                        zIndex: 10,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px'
                      }}>
                        <span>🔍</span>
                        <span>From Search</span>
                      </div>
                    )}
                    
                    <div className="post-header">
                      <div className="post-user">
                        <div className="post-avatar">
                          {getUserAvatar(post.user)}
                        </div>
                        <div className="post-user-info">
                          <div className="post-user-name">
                            {post.user?.name || "Unknown User"}
                            {post.user?.isPrivate && (
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
                        {/* Delete Button (only for owner or admin) */}
                        {(isOwner || user?.role === 'admin') && (
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
                      
                      {/* Display Event */}
                      {post.type === 'event' && post.event && renderEventCard(post.event)}
                      
                      {/* Display Poll */}
                      {post.type === 'poll' && post.poll && renderPollCard(post.poll, post._id)}
                      
                      {/* Display Media with LinkedIn-style Carousel */}
                      {post.media && post.media.length > 0 && renderMedia(post.media)}
                      
                      {/* Legacy imageUrl support */}
                      {post.imageUrl && !post.media && (
                        <div className="post-image">
                          <img src={post.imageUrl} alt="Post content" />
                        </div>
                      )}
                    </div>

                    {/* Event RSVP Buttons */}
                    {post.type === 'event' && post.event && (
                      <div className="event-actions">
                        {userRSVPStatus === 'going' ? (
                          <div className="rsvp-status">
                            ✅ You're going to this event
                          </div>
                        ) : (
                          <>
                            <button 
                              className="event-btn rsvp-btn"
                              onClick={() => handleEventRSVP(post._id, 'going')}
                              disabled={rsvpLoading[post._id]}
                            >
                              {rsvpLoading[post._id] ? '...' : '✅ Going'}
                            </button>
                            <button 
                              className="event-btn maybe-btn"
                              onClick={() => handleEventRSVP(post._id, 'maybe')}
                              disabled={rsvpLoading[post._id]}
                            >
                              {rsvpLoading[post._id] ? '...' : '🤔 Maybe'}
                            </button>
                          </>
                        )}
                      </div>
                    )}

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
                      {post.type === 'event' && post.event && (
                        <span className="stat-item">
                          👥 {post.event.rsvpCount || 0}
                        </span>
                      )}
                      {post.type === 'poll' && post.poll && (
                        <span className="stat-item">
                          📊 {post.poll.totalVotes || 0}
                        </span>
                      )}
                      {post.media && post.media.length > 0 && (
                        <span className="stat-item">
                          📷 {post.media.length}
                        </span>
                      )}
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
                        onClick={() => openShareModal(post)}
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
              })
            )}
          </div>
        </div>

        {/* ========== RIGHT SIDEBAR ========== */}
        <div className="sidebar right-sidebar">
          {/* Campus Stats */}
          <div className="trending-card">
            <h3 className="sidebar-title">
              <span>📊 Campus Stats</span>
            </h3>
            
            <div className="clean-network-stats">
              <div className="clean-network-stat">
                <span className="clean-stat-main">{posts.length}</span>
                <span className="clean-stat-sub">Total Posts</span>
              </div>
              <div className="clean-network-stat">
                <span className="clean-stat-main">{new Set(posts.map(p => p.user?.id)).size}</span>
                <span className="clean-stat-sub">Active Users</span>
              </div>
              <div className="clean-network-stat">
                <span className="clean-stat-main">{(posts.reduce((acc, post) => acc + (post.likes?.length || 0), 0))}</span>
                <span className="clean-stat-sub">Total Likes</span>
              </div>
              <div className="clean-network-stat">
                <span className="clean-stat-main">{(posts.reduce((acc, post) => acc + (post.comments?.length || 0), 0))}</span>
                <span className="clean-stat-sub">Total Comments</span>
              </div>
            </div>
          </div>

          {/* Upcoming Events Sidebar - UPDATED: Changed to use network-suggestion-item */}
          {posts.filter(post => post.type === 'event' && post.event).length > 0 && (
            <div className="trending-card">
              <h3 className="sidebar-title">
                <span>📅 Upcoming Events</span>
              </h3>
              
              <div className="network-suggestions-list">
                {posts
                  .filter(post => post.type === 'event' && post.event)
                  .slice(0, 3)
                  .map(post => {
                    const eventDate = new Date(post.event.dateTime);
                    return (
                      <div 
                        key={post._id} 
                        className="network-suggestion-item" 
                        onClick={() => {
                          // Scroll to the post in the feed
                          const element = document.getElementById(`post-${post._id}`);
                          if (element) {
                            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            element.classList.add('notification-highlighted');
                            setTimeout(() => {
                              element.classList.remove('notification-highlighted');
                            }, 3000);
                          }
                        }}
                      >
                        <div className="network-suggestion-avatar">
                          {getUserAvatar(post.user)}
                        </div>
                        <div className="network-suggestion-info">
                          <h4>{post.event.title}</h4>
                          <p className="network-suggestion-meta">
                            <span>📅 {eventDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                            <span>👥 {post.event.rsvpCount || 0} going</span>
                          </p>
                        </div>
                      </div>
                    );
                  })
                }
              </div>
            </div>
          )}

          {/* Active Polls Sidebar - UPDATED: Changed to use network-suggestion-item */}
          {posts.filter(post => post.type === 'poll' && post.poll).length > 0 && (
            <div className="suggestions-card">
              <h3 className="sidebar-title">
                <span>📊 Active Polls</span>
              </h3>
              
              <div className="network-suggestions-list">
                {posts
                  .filter(post => post.type === 'poll' && post.poll)
                  .slice(0, 3)
                  .map(post => (
                    <div 
                      key={post._id} 
                      className="network-suggestion-item"
                      onClick={() => {
                        // Scroll to the post in the feed
                        const element = document.getElementById(`post-${post._id}`);
                        if (element) {
                          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                          element.classList.add('notification-highlighted');
                          setTimeout(() => {
                            element.classList.remove('notification-highlighted');
                          }, 3000);
                        }
                      }}
                    >
                      <div className="network-suggestion-avatar">
                        {getUserAvatar(post.user)}
                      </div>
                      <div className="network-suggestion-info">
                        <h4>{post.poll.question}</h4>
                        <p className="network-suggestion-meta">
                          <span>{post.poll.totalVotes || 0} votes</span>
                          <span>{post.poll.options.length} options</span>
                        </p>
                      </div>
                    </div>
                  ))
                }
              </div>
            </div>
          )}
        </div>
      </div>

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

      {/* Share Modal - UPDATED: Increased width to match network modal */}
      {showShareModal && postToShare && (
        <div className="network-modal-overlay" onClick={closeShareModal}>
          <div className="network-analytics-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '900px' }}>
            <div className="network-modal-header">
              <h3>Share Post</h3>
              <button 
                className="network-modal-close" 
                onClick={closeShareModal}
              >
                ×
              </button>
            </div>
            
            <div className="network-modal-body">
              <div className="share-post-preview">
                <div className="share-post-header">
                  <div className="share-post-user">
                    <div className="share-post-avatar">
                      {getUserAvatar(postToShare.user)}
                    </div>
                    <div>
                      <div className="share-post-username">
                        {postToShare.user?.name || "Unknown User"}
                      </div>
                      <div className="share-post-time">
                        {new Date(postToShare.createdAt).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric'
                        })}
                      </div>
                    </div>
                  </div>
                  <div className="share-post-text">
                    {postToShare.content.length > 150 
                      ? postToShare.content.substring(0, 150) + '...'
                      : postToShare.content}
                  </div>
                </div>
              </div>
              
              <div className="share-message-section">
                <label>Add a message (optional):</label>
                <textarea
                  placeholder="Say something about this post..."
                  value={shareMessage}
                  onChange={(e) => setShareMessage(e.target.value)}
                  maxLength={200}
                  rows={3}
                />
                <div className="char-count-share">
                  {shareMessage.length}/200
                </div>
              </div>
              
              <div className="share-connections-section">
                <div className="share-section-header">
                  <h4>Share with Connections</h4>
                  <div className="connections-search">
                    <input
                      type="text"
                      placeholder="Search connections by name, department, or email..."
                      value={searchConnections}
                      onChange={(e) => setSearchConnections(e.target.value)}
                    />
                  </div>
                </div>
                
                <div className="select-all-connections">
                  <label className="select-all-checkbox">
                    <input
                      type="checkbox"
                      checked={selectedConnections.length === connections.length && connections.length > 0}
                      onChange={selectAllConnections}
                    />
                    <span>Select All</span>
                  </label>
                  <span className="selected-count">
                    {selectedConnections.length} selected
                  </span>
                </div>
                
                <div className="connections-list">
                  {shareLoading ? (
                    <div className="loading-connections">
                      Loading connections...
                    </div>
                  ) : filteredConnections.length > 0 ? (
                    filteredConnections.map(conn => (
                      <div 
                        key={conn._id || conn.id} 
                        className={`connection-item ${selectedConnections.includes(conn._id || conn.id) ? 'selected' : ''}`}
                      >
                        <label className="connection-checkbox">
                          <input
                            type="checkbox"
                            checked={selectedConnections.includes(conn._id || conn.id)}
                            onChange={() => toggleConnectionSelect(conn._id || conn.id)}
                          />
                          <div className="connection-avatar">
                            {conn.profilePhoto ? (
                              <img 
                                src={conn.profilePhoto} 
                                alt={conn.name} 
                              />
                            ) : (
                              <div className="avatar-placeholder">
                                {conn.name?.charAt(0).toUpperCase() || 'U'}
                              </div>
                            )}
                          </div>
                          <div className="connection-details">
                            <div className="connection-name">
                              {conn.name || 'Unknown User'}
                            </div>
                            <div className="connection-meta">
                              {conn.department && <span>{conn.department}</span>}
                              {conn.role && <span>{conn.role}</span>}
                            </div>
                          </div>
                        </label>
                      </div>
                    ))
                  ) : (
                    <div className="no-connections">
                      {searchConnections ? 'No connections match your search' : 'No connections found'}
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            <div className="network-modal-actions">
              <button 
                className="network-modal-btn cancel" 
                onClick={closeShareModal}
              >
                Cancel
              </button>
              <button 
                className="network-modal-btn confirm"
                onClick={handleSharePost}
                disabled={selectedConnections.length === 0 || shareLoading}
              >
                {shareLoading ? 'Sharing...' : `Share with ${selectedConnections.length} connection(s)`}
              </button>
            </div>
          </div>
        </div>    
      )}

      {/* Post Modal */}
      {postModalOpen && selectedPost && (
        <PostModal
          post={selectedPost}
          currentUser={user}
          users={allUsers}
          onClose={closePostModal}
          onAddComment={handleAddComment}
          onEditComment={handleEditComment}
          onDeleteComment={handleDeleteComment}
          onLikeComment={handleLikeComment}
          onLikePost={handleLike}
        />
      )}

      {/* Toast Component */}
      <Toast
        notification={toastData}
        onClose={() => setToastData(null)}
        onOpen={() => {
          setToastData(null);
          setNotifCount(0);
          setShowNotifications(true);
        }}
      />
    </div>
  );
}

export default Feed;