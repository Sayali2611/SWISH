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

  // NEW STATES FOR SHARE FUNCTIONALITY - UPDATED WITH FIXES
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
      const response = await fetch('http://localhost:5000/api/auth/profile', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const freshUser = await response.json();
        console.log("🔄 Fresh user data with restriction:", {
          status: freshUser.status,
          restrictedUntil: freshUser.restrictedUntil,
          restrictionReason: freshUser.restrictionReason
        });
        
        setUser(freshUser);
        localStorage.setItem('user', JSON.stringify(freshUser));
      }
    } catch (error) {
      console.error("Error fetching fresh user data:", error);
    }
  }, []);

  // UPDATED: Simplified restriction check - only blocks if there's clear evidence of restriction
  const handleRestrictedAction = () => {
    console.log("🔍 Checking restriction for user:", user?.name);
    
    if (!user) {
      console.log("🔍 No user found");
      return false; // Changed to false to allow action
    }
    
    // Check if user is explicitly restricted
    const userStatus = user.status || 'active';
    const restrictedUntil = user.restrictedUntil || null;

    // Only block if user is explicitly marked as restricted AND has a valid restriction date
    if (userStatus === 'restricted' && restrictedUntil) {
      const now = new Date();
      const restrictionEnd = new Date(restrictedUntil);
    
      console.log("🔍 Now:", now);
      console.log("🔍 Restriction end:", restrictionEnd);
      console.log("🔍 Is restricted?", restrictionEnd > now);
      
      if (restrictionEnd > now) {
        const formattedDate = restrictionEnd.toLocaleString();
        const message = `⏸️ Your account is restricted until ${formattedDate}. You cannot post, comment, like, or connect during this time.`;
        
        console.log("🔍 Showing restriction message:", message);
        setError(message);
        return true; // Block action
      } else {
        console.log("🔍 Restriction expired, auto-removing");
        // Restriction expired, update user status
        setUser(prev => ({
          ...prev,
          status: 'active',
          restrictedUntil: null
        }));
        return false; // Allow action
      }
    } else {
      console.log("🔍 User is not restricted - status:", userStatus, "restrictedUntil:", restrictedUntil);
      // If status is undefined or null, treat as active
      return false; // Allow action
    }
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

  // Block ALL alerts
  useEffect(() => {
    const originalAlert = window.alert;
    window.alert = function(msg) {
      console.log("Alert blocked:", msg);
      return;
    };

    return () => {
      window.alert = originalAlert;
    };
  }, []);

// Listen for custom events from ExploreSearch
useEffect(() => {
  console.log("🎯 [Feed] Setting up event listeners");
  
  const handleFeedHighlight = () => {
    const now = Date.now();
    if (now - lastHighlightTimeRef.current < 1000) {
      console.log("⏸️ [Feed] Too soon since last highlight, skipping");
      return;
    }
    
    if (isProcessingRef.current) {
      console.log("⏸️ [Feed] Already processing, skipping duplicate event");
      return;
    }
    
    console.log("🚀 [Feed] Received feedHighlight event");
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
  
  console.log("🔔 [Feed] Received notification highlight for post:", postId);
  
  // Store in localStorage for the fetchPosts function
  const highlightData = {
    postId: postId,
    timestamp: Date.now(),
    from: 'notification'
  };
  localStorage.setItem('notificationHighlight', JSON.stringify(highlightData));
  
  // Clear any existing timeout
  if (notificationTimeoutRef.current) {
    clearTimeout(notificationTimeoutRef.current);
  }
  
  // Fetch posts (this will send the highlight to backend)
  fetchPosts(true);
  
  // Clean up after 15 seconds
  notificationTimeoutRef.current = setTimeout(() => {
    localStorage.removeItem('notificationHighlight');
    notificationTimeoutRef.current = null;
  }, 15000);
};

  const handleStorageChange = (e) => {
    if (e.key === 'searchHighlightedPost' && e.newValue) {
      const now = Date.now();
      if (now - lastHighlightTimeRef.current > 1000) {
        console.log("📡 [Feed] Storage event detected!");
        handleFeedHighlight();
      }
    }
  };

  window.addEventListener('feedHighlight', handleFeedHighlight);
  window.addEventListener('notificationHighlight', handleNotificationHighlight); // ADD THIS LINE
  window.addEventListener('storage', handleStorageChange);

  window.triggerFeedHighlight = () => {
    console.log("🎯 [Feed] Global triggerFeedHighlight() called");
    handleFeedHighlight();
  };

  window.refreshFeedPosts = () => {
    console.log("🔄 [Feed] Global refreshFeedPosts() called");
    setRefreshTrigger(prev => prev + 1);
  };

  return () => {
    window.removeEventListener('feedHighlight', handleFeedHighlight);
    window.removeEventListener('notificationHighlight', handleNotificationHighlight); // ADD THIS LINE
    window.removeEventListener('storage', handleStorageChange);
    
    delete window.triggerFeedHighlight;
    delete window.refreshFeedPosts;
    
    if (highlightTimeoutRef.current) {
      clearTimeout(highlightTimeoutRef.current);
    }
    
    // Clean up notification timeout too
    if (notificationTimeoutRef.current) {
      clearTimeout(notificationTimeoutRef.current);
    }
  };
}, []);

// Find the scrollAndHighlightPost function and UPDATE it:

const scrollAndHighlightPost = useCallback((postId, fromNotification = false) => {
  if (!postId || isProcessingRef.current) {
    console.log("⏭️ [Feed] No post ID or already processing");
    return;
  }
  
  console.log("🎯 [Feed] Attempting to scroll and highlight post:", postId);
  
  isProcessingRef.current = true;
  const elementId = `post-${postId}`;
  
  if (highlightTimeoutRef.current) {
    clearTimeout(highlightTimeoutRef.current);
  }
  
  highlightTimeoutRef.current = setTimeout(() => {
    const element = document.getElementById(elementId);
    console.log("🔍 [Feed] Element found?", !!element);
    
    if (element) {
      console.log("✅ [Feed] Found element! Scrolling and highlighting...");
      
      // Use the new highlight function
      highlightElement(element, fromNotification);
      
      // Keep your existing cleanup logic
      isProcessingRef.current = false;
      hasCheckedHighlightRef.current = true;
      console.log("✅ [Feed] Highlight complete");
      
      return;
    }
    
    console.log("⏳ [Feed] Element not found, retrying...");
    highlightTimeoutRef.current = setTimeout(() => {
      const retryElement = document.getElementById(elementId);
      if (retryElement) {
        console.log("✅ [Feed] Found element on retry!");
        
        // Use the new highlight function
        highlightElement(retryElement, fromNotification);
        
        isProcessingRef.current = false;
        hasCheckedHighlightRef.current = true;
        console.log("✅ [Feed] Highlight complete on retry");
      } else {
        console.log("❌ [Feed] Element not found after retry");
        isProcessingRef.current = false;
      }
    }, 500);
  }, 300);
}, [setIsProcessingHighlight]);

const fetchPosts = useCallback(async (forceHighlight = false) => {
  if (isProcessingRef.current && !forceHighlight) {
    console.log("⏸️ [Feed] Already processing, skipping fetch");
    return;
  }
  
  try {
    isProcessingRef.current = true;
    const token = localStorage.getItem('token');
    
    // ============ CHECK FOR ALL TYPES OF HIGHLIGHTS ============
    let queryParams = '';
    
    // 1. Check for NOTIFICATION highlight
    const notificationHighlight = localStorage.getItem('notificationHighlight');
    // 2. Check for SEARCH highlight
    const searchHighlight = localStorage.getItem('searchHighlightedPost');
    
    // Prioritize notification highlight (most recent), then search highlight
    let highlightData = null;
    let highlightType = null;
    
    if (notificationHighlight) {
      try {
        const parsed = JSON.parse(notificationHighlight);
        // Check if highlight is still valid (less than 15 seconds old)
        if (Date.now() - parsed.timestamp < 15000) {
          highlightData = parsed;
          highlightType = 'notification';
        } else {
          // Remove expired highlight
          localStorage.removeItem('notificationHighlight');
        }
      } catch (error) {
        console.error("❌ [Feed] Error parsing notification highlight:", error);
        localStorage.removeItem('notificationHighlight');
      }
    }
    
    if (!highlightData && searchHighlight) {
      try {
        const parsed = JSON.parse(searchHighlight);
        // Check if highlight is still valid (less than 15 seconds old)
        if (Date.now() - parsed.timestamp < 15000) {
          highlightData = parsed;
          highlightType = 'search';
        } else {
          // Remove expired highlight
          localStorage.removeItem('searchHighlightedPost');
        }
      } catch (error) {
        console.error("❌ [Feed] Error parsing search highlight:", error);
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
      console.log(`🎯 [Feed] Sending ${highlightType} highlight to backend`);
    }
    
    // ============ FETCH WITH QUERY PARAM ============
    const response = await fetch(`http://localhost:5000/api/posts${queryParams}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (response.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      navigate("/");
      return;
    }

    const data = await response.json();
    console.log("📝 [Feed] Fetched", data.length, "posts");
    
    // Check for pinned post
    const pinnedPost = data.find(post => post.isPinned);
    if (pinnedPost) {
      console.log("🎯 [Feed] Found pinned post at index:", data.indexOf(pinnedPost));
      console.log("🎯 [Feed] Pinned post ID:", pinnedPost._id);
      console.log("🎯 [Feed] Pinned from:", pinnedPost.pinnedFromNotification ? 'notification' : 'search');
      
      // Highlight the pinned post
      setHighlightedPostId(pinnedPost._id);
      
      setTimeout(() => {
        scrollAndHighlightPost(pinnedPost._id, true);
      }, 300);
      
      // Clear the highlight after processing
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
      const response = await fetch('http://localhost:5000/api/users', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const users = await response.json();
        setAllUsers(users);
      }
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  }, []);
  
  // ==================== SHARE FUNCTIONS - UPDATED ====================

  // Open share modal for a post
  const openShareModal = async (post) => {
    // UPDATED: Don't check restriction for sharing - allow all users to share
    console.log("📤 Opening share modal for post:", post._id);
    
    setPostToShare(post);
    setSelectedConnections([]);
    setSearchConnections("");
    setShareMessage("");
    setShareLoading(true);
    setError("");
    
    try {
      const token = localStorage.getItem('token');
      
      // Fetch user's connections
      const response = await fetch('http://localhost:5000/api/network/connections', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log("🔗 Connections fetched:", data);
        const connectionsList = data.connections || data || [];
        console.log("🔗 Connections list:", connectionsList);
        setConnections(connectionsList);
      } else {
        const errorData = await response.json();
        console.error("Failed to fetch connections:", errorData);
        setError("Failed to load connections: " + (errorData.message || "Unknown error"));
      }
      
      // Fetch post share count
      try {
        const shareResponse = await fetch(`http://localhost:5000/api/posts/${post._id}/shares`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
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
      console.log("✅ Share modal opened");
    } catch (error) {
      console.error("Error opening share modal:", error);
      setError("Failed to load connections: " + error.message);
    } finally {
      setShareLoading(false);
    }
  };

  // Close share modal
  const closeShareModal = () => {
    console.log("📤 Closing share modal");
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
      
      // Log the data being sent
      console.log("📤 Sharing post data:", {
        postId: postToShare._id,
        connectionIds: selectedConnections,
        message: shareMessage
      });
      
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
      console.log("📥 Share response:", data);
      
      if (response.ok) {
        setSuccess(`✅ Post shared with ${selectedConnections.length} connection(s)!`);
        
        // Update share count in local state
        setShareCounts(prev => ({
          ...prev,
          [postToShare._id]: (prev[postToShare._id] || 0) + selectedConnections.length
        }));

        // Refresh posts to update share count
        fetchPosts();
        
        closeShareModal();
        setTimeout(() => setSuccess(""), 3000);
      } else {
        setError(data.message || 'Failed to share post. Please try again.');
      }
    } catch (error) {
      console.error("❌ Share error:", error);
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
    console.log("🔍 [Feed] Component mounted or refreshTrigger changed", { refreshTrigger });
    
    const userData = localStorage.getItem('user');
    const token = localStorage.getItem('token');
    
    if (!userData || !token) {
      navigate("/");
      return;
    }

    const userObj = JSON.parse(userData);
    setUser(userObj);
    
    // Only fetch user restriction data if needed
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
          const response = await fetch("http://localhost:5000/api/notifications/unread/count", {
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
      if (socket) {
        socket.off("new_notification");
      }
    };
  }, [navigate, refreshTrigger, fetchPosts, fetchAllUsers, fetchUserWithRestriction]);

  // Check URL for highlight parameters
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const highlightId = params.get('highlight');
    
    if (highlightId && !hasCheckedHighlightRef.current) {
      console.log("🔗 [Feed] Found highlight ID in URL:", highlightId);
      
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
      console.log("🔄 [Feed] Posts updated, attempting to highlight:", highlightedPostId);
      
      const isAtTop = posts[0]?._id === highlightedPostId;
      console.log("📊 [Feed] Is highlighted post at top?", isAtTop ? "✅ YES" : "❌ NO");
      
      if (isAtTop) {
        if (highlightTimeoutRef.current) {
          clearTimeout(highlightTimeoutRef.current);
        }
        
        highlightTimeoutRef.current = setTimeout(() => {
          scrollAndHighlightPost(highlightedPostId);
        }, 300);
      }
    }
  }, [posts, highlightedPostId, isProcessingHighlight, scrollAndHighlightPost]);

    // ADD THE CLEANUP EFFECT HERE:
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
    // UPDATED: Only check restriction if user has explicit restriction data
    if (user?.status === 'restricted') {
      if (handleRestrictedAction()) return;
    }

    console.log("🚀 [Feed] Post button clicked!");
    console.log("📝 Post content:", newPost);
    console.log("📋 Post type:", postType);
    console.log("📁 Selected files:", selectedFiles.length);
    console.log("👤 User:", user?.name);
    
    let postData = { content: newPost.trim() };
    
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
      console.log("🔑 Token exists:", !!token);
      console.log("📦 Post data to send:", JSON.stringify(postData, null, 2));
      
      let response;
      let result;
      
      if (selectedFiles.length > 0) {
        console.log("📤 Uploading post with media...");
        
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

        console.log("📦 FormData created, sending to server...");
        
        response = await fetch('http://localhost:5000/api/posts/upload', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          },
          body: formData
        });

        result = await response.json();
        console.log("📡 Media upload response:", result);
      } else {
        console.log("📝 Creating post without media...");
        console.log("📦 Post data:", JSON.stringify(postData, null, 2));
        
        response = await fetch('http://localhost:5000/api/posts', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(postData)
        });

        result = await response.json();
        console.log("📡 Post response:", result);
      }

      console.log("✅ Response status:", response.status);
      console.log("✅ Response data:", result);
      
      if (response.ok) {
        handlePostSuccess(result);
      } else {
        console.error("❌ Post creation failed:", result);
        setError(result.message || 'Failed to create post. Please try again.');
      }
    } catch (error) {
      console.error('❌ Create post error:', error);
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
    console.log("🎉 New post data to add:", newPostData);
    
    setPosts(prevPosts => [newPostData, ...prevPosts]);
    setSuccess('✅ Post created successfully!');
    setTimeout(() => setSuccess(""), 3000);
    
    console.log("🔄 Posts updated, new post count:", posts.length + 1);
  };

  // ==================== POST INTERACTIONS ====================
  const handleEventRSVP = async (postId, status) => {
    // UPDATED: Only check restriction if user has explicit restriction data
    if (user?.status === 'restricted') {
      if (handleRestrictedAction()) return;
    }
    if (!user) return;

    setRsvpLoading(prev => ({ ...prev, [postId]: true }));
    
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:5000/api/posts/${postId}/rsvp`, {
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
    // UPDATED: Only check restriction if user has explicit restriction data
    if (user?.status === 'restricted') {
      if (handleRestrictedAction()) return;
    }
    if (!user) return;

    setVoteLoading(prev => ({ ...prev, [postId]: true }));
    
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:5000/api/posts/${postId}/vote`, {
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
    // UPDATED: Only check restriction if user has explicit restriction data
    if (user?.status === 'restricted') {
      if (handleRestrictedAction()) return;
    }
    if (!user) return;

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
        // Update selectedPost if modal is open
        if (selectedPost && selectedPost._id === postId) {
          setSelectedPost(updatedPost);
        }
      }
    } catch (error) {
      // Silent catch
    }
  };

  const handleAddComment = async (postId, commentText) => {
    // UPDATED: Only check restriction if user has explicit restriction data
    if (user?.status === 'restricted') {
      if (handleRestrictedAction()) return;
    }
    if (!commentText?.trim() || !user) return;

    setCommentLoading(prev => ({ ...prev, [postId]: true }));
    
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
        setCommentTexts(prev => ({ ...prev, [postId]: "" }));
        setPosts(prevPosts => 
          prevPosts.map(post => 
            post._id === postId ? data.post : post
          )
        );
        
        // Update selectedPost if modal is open
        if (selectedPost && selectedPost._id === postId) {
          setSelectedPost(data.post);
        }
        
        setSuccess('Comment added successfully!');
        setTimeout(() => setSuccess(""), 2000);
        return data.post;
      }
    } catch (error) {
      // Silent catch
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
      
      console.log("Deleting comment:", { postId, commentId });
      
      const response = await fetch(`http://localhost:5000/api/posts/${postId}/comments/${commentId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        console.log("Comment deleted successfully:", data);
        
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
        console.error("Delete comment failed:", errorData);
        setError(errorData.message || 'Failed to delete comment');
        return null;
      }
    } catch (error) {
      console.error("Error deleting comment:", error);
      setError('Failed to delete comment');
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
      const response = await fetch(`http://localhost:5000/api/posts/${postId}`, {
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
        await fetch("http://localhost:5000/api/notifications/read-all", {
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
    console.log("🔄 [Feed] Manual refresh triggered");
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
 // ==================== HIGHLIGHT HELPER FUNCTION ====================
  const highlightElement = (element, fromNotification = false) => {
    console.log("✨ [Feed] Highlighting element:", element.id);
    
    if (!element) return;
    
    // Scroll to element
    element.scrollIntoView({ 
      behavior: 'smooth', 
      block: 'center'
    });
    
    // Add highlight class
    element.classList.add('notification-highlighted');
    
    // Remove highlight after 15 seconds
    notificationTimeoutRef.current = setTimeout(() => {
      element.classList.remove('notification-highlighted');
      notificationHighlightRef.current = null;
      console.log("✅ [Feed] Highlight removed after 15 seconds");
    }, 15000);
    
    // Also remove highlight if user scrolls away
    if (scrollObserverRef.current) {
      scrollObserverRef.current.disconnect();
    }
    
    scrollObserverRef.current = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting && element.classList.contains('notification-highlighted')) {
          element.classList.remove('notification-highlighted');
          scrollObserverRef.current?.disconnect();
          console.log("↕️ [Feed] Highlight removed due to scrolling away");
        }
      });
    }, { threshold: 0.1 });
    
    scrollObserverRef.current.observe(element);
    
    // Clean up observer after highlight timeout
    setTimeout(() => {
      scrollObserverRef.current?.disconnect();
    }, 15000);
  };


  if (!user) {
    return (
      <div className="loading-container">
        <div className="loading-spinner">Loading...</div>
      </div>
    );
  }

  return (
    <div className="feed-container">
      {/* Header */}
      <header className="feed-header">
        <div className="header-left">
          <div className="logo" onClick={() => navigate("/feed")}>💼 Swish</div>
          
          {/* SEARCH BAR */}
          <div className="feed-search-wrapper">
             <ExploreSearch onUserSelect={handleUserSelectFromSearch} />
          </div>

          <div className="nav-items">
            <button className="nav-btn active">🏠 Feed</button>
            <button className="nav-btn" onClick={() => navigate("/profile")}>👤 Profile</button>
            <button className="nav-btn" onClick={() => navigate("/network")}>👥 Network</button>
            <button className="nav-btn" onClick={() => navigate("/Explore")}>🔥 Explore</button>
            <button 
              className={`nav-btn notification-bell-btn ${showNotifications ? 'active-bell' : ''}`}
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
            <span className="user-name">Welcome, {user.name}</span>
            <div 
              className="user-avatar" 
              title="View Profile"
              onClick={() => navigate("/profile")}
            >
              {getUserAvatar(user)}
            </div>
          </div>
          
          {user.role === 'admin' && (
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
          
          <button className="logout-btn" onClick={handleLogout}>🚪 Logout</button>
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

      {/* Notification Panel */}
      {showNotifications && (
        <div className="notification-panel-overlay" onClick={() => setShowNotifications(false)}>
          <div className="notification-panel" onClick={(e) => e.stopPropagation()}>
            <div className="panel-header">
              <h3>Notifications</h3>
              <button onClick={() => setShowNotifications(false)} className="close-panel-btn">×</button>
            </div>
            <div className="panel-content">
              <p className="empty-message">You have no new notifications to display (Placeholder).</p>
              <p>The badge has been reset. You can now fetch your notification list here.</p>
              <button 
                onClick={() => { setShowNotifications(false); navigate("/notifications"); }}
                className="view-all-notifs-btn"
              >
                View Full Notification Page
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="feed-content">
        <div className="main-feed">
          {/* User Welcome Card */}
          <div className="welcome-card">
            <div className="welcome-content">
              <div className="welcome-avatar">
                {getUserAvatar(user)}
              </div>
              <div className="welcome-text">
                <h2>Hello, {user.name}! 👋</h2>
                <p>Share your thoughts with the campus community...</p>
              </div>
            </div>
            <div className="user-role-badge">
              {user.role === 'student' && '🎓 Student'}
              {user.role === 'faculty' && '👨‍🏫 Faculty'}
              {user.role === 'admin' && '👑 Admin'}
            </div>
          </div>

          {/* Create Post Card */}
          <div className="create-post-card">
            <div className="post-input-section">
              <div className="user-avatar-small">
                {getUserAvatar(user)}
              </div>
              <input 
                type="text" 
                placeholder={
                  postType === 'text' ? "What's happening on campus? Share updates, events, or thoughts... 🎓" :
                  postType === 'event' ? "Describe your event (optional)..." :
                  "Ask a question for your poll (optional)..."
                }
                value={newPost}
                onChange={(e) => setNewPost(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleCreatePost()}
                maxLength={500}
                disabled={isUploading}
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
                  <input 
                    type="text" 
                    placeholder="e.g., Which programming language should we learn next?"
                    value={pollData.question}
                    onChange={(e) => handlePollChange('question', e.target.value)}
                    disabled={isUploading}
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
                      backgroundColor: showMediaUploader ? '#f1f5f9' : 'transparent',
                      color: showMediaUploader ? '#4f46e5' : '#64748b',
                      border: '1px solid #e2e8f0',
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
                    backgroundColor: postType === 'event' ? '#f1f5f9' : 'transparent',
                    color: postType === 'event' ? '#4f46e5' : '#64748b',
                    border: '1px solid #e2e8f0',
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
                    backgroundColor: postType === 'poll' ? '#f1f5f9' : 'transparent',
                    color: postType === 'poll' ? '#4f46e5' : '#64748b',
                    border: '1px solid #e2e8f0',
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
                <div className="char-count">{newPost.length}/500</div>
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
              <div className="empty-state">
                <div className="empty-icon">📝</div>
                <h3>No posts yet</h3>
                <p>Be the first to share something with your campus community!</p>
                <button 
                  className="create-first-post-btn"
                  onClick={() => document.querySelector('.post-input-section input')?.focus()}
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
                    className={`post-card ${isHighlighted ? 'highlighted-post' : ''}`}
                    style={isHighlighted ? {
                      border: '3px solid #007bff',
                      backgroundColor: '#f0f8ff',
                      boxShadow: '0 0 15px rgba(0, 123, 255, 0.2)',
                      position: 'relative',
                      marginBottom: '25px',
                      transition: 'all 0.3s ease'
                    } : {}}
                  >
                    {isHighlighted && (
                      <div className="highlight-badge" style={{
                        position: 'absolute',
                        top: '15px',
                        right: '15px',
                        background: '#007bff',
                        color: 'white',
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
                        <div className="user-avatar">
                          {getUserAvatar(post.user)}
                        </div>
                        <div className="user-info">
                          <div className="user-name">
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
                        <button className="post-options-btn" title="More options">⋯</button>
                      </div>
                    </div>

                    <div className="post-content">
                      <p>{post.content}</p>
                      
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

        {/* Sidebar */}
        <div className="sidebar">
          {/* User Profile Card */}
          <div className="sidebar-card user-profile-card">
            <div className="profile-header">
              <div className="profile-avatar">
                {getUserAvatar(user)}
              </div>
              <div className="profile-info">
                <h3>{user.name}</h3>
                <p className="profile-role">
                  {user.role === 'student' && '🎓 Student'}
                  {user.role === 'faculty' && '👨‍🏫 Faculty'}
                  {user.role === 'admin' && '👑 Administrator'}
                </p>
                {user.department && (
                  <p className="profile-department">{user.department}</p>
                )}
                <div className="profile-stats">
                  <span>{posts.filter(p => p.user?.id === user.id).length} posts</span>
                  <span>•</span>
                  <span>{(posts.reduce((acc, post) => acc + (post.likes?.length || 0), 0))} likes</span>
                </div>
              </div>
            </div>
            <button 
              className="view-profile-btn"
              onClick={() => navigate("/profile")}
            >
              👤 View Profile
            </button>
          </div>

          <div className="sidebar-card">
            <h3>📊 Campus Stats</h3>
            <div className="stats">
              <div className="stat">
                <strong>{posts.length}</strong>
                <span>Total Posts</span>
              </div>
              <div className="stat">
                <strong>{new Set(posts.map(p => p.user?.id)).size}</strong>
                <span>Active Users</span>
              </div>
              <div className="stat">
                <strong>{(posts.reduce((acc, post) => acc + (post.likes?.length || 0), 0))}</strong>
                <span>Total Likes</span>
              </div>
              <div className="stat">
                <strong>{(posts.reduce((acc, post) => acc + (post.comments?.length || 0), 0))}</strong>
                <span>Total Comments</span>
              </div>
            </div>
          </div>

          {/* Upcoming Events Sidebar */}
          {posts.filter(post => post.type === 'event' && post.event).length > 0 && (
            <div className="sidebar-card">
              <h3>📅 Upcoming Events</h3>
              <div className="upcoming-events">
                {posts
                  .filter(post => post.type === 'event' && post.event)
                  .slice(0, 3)
                  .map(post => {
                    const eventDate = new Date(post.event.dateTime);
                    return (
                      <div key={post._id} className="upcoming-event">
                        <div className="event-sidebar-header">
                          <div className="event-sidebar-title">{post.event.title}</div>
                          <div className="event-sidebar-date">
                            {eventDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </div>
                        </div>
                        <div className="event-sidebar-time">
                          {eventDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    );
                  })
                }
              </div>
            </div>
          )}

          {/* Active Polls Sidebar */}
          {posts.filter(post => post.type === 'poll' && post.poll).length > 0 && (
            <div className="sidebar-card">
              <h3>📊 Active Polls</h3>
              <div className="active-polls">
                {posts
                  .filter(post => post.type === 'poll' && post.poll)
                  .slice(0, 3)
                  .map(post => (
                    <div key={post._id} className="active-poll">
                      <div className="poll-sidebar-title">{post.poll.question}</div>
                      <div className="poll-sidebar-stats">
                        <span>{post.poll.totalVotes || 0} votes</span>
                        <span>{post.poll.options.length} options</span>
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

      {/* Share Modal - UPDATED WITH PROPER VISIBILITY AND CSS CLASSES */}
        {showShareModal && postToShare && (
          <div className="share-popup-overlay" onClick={closeShareModal}>
            <div className="share-popup" onClick={(e) => e.stopPropagation()}>
              <div className="share-popup-header">
                <h3>Share Post</h3>
                <button 
                  className="close-share-btn" 
                  onClick={closeShareModal}
                  aria-label="Close share modal"
                >
                  ×
                </button>
              </div>
              
              <div className="share-content">
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
                                {conn.email && <span className="connection-email">{conn.email}</span>}
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
              
              <div className="share-popup-footer">
                <button 
                  className="cancel-share-btn" 
                  onClick={closeShareModal}
                >
                  Cancel
                </button>
                <button 
                  className="share-post-btn"
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