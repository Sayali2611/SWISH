import { useState, useEffect, useRef, useCallback, forwardRef } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import "../styles/Explore.css";
import { getSocket } from "../components/NotificationBell";
import Toast from "../components/Toast";
import "../styles/Notifications.css";
import ExploreSearch from "../components/ExploreSearch";
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
      }).catch(e => console.log("Auto-play prevented:", e));
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
          }).catch(e => console.log("Auto-play prevented:", e));
        }
      }, 100);
    }
  }, [currentIndex, media, clearProgressInterval, startProgressInterval]);

  const nextSlide = useCallback(() => {
    goToSlide(currentIndex === totalSlides - 1 ? 0 : currentIndex + 1);
  }, [currentIndex, totalSlides, goToSlide]);

  const prevSlide = useCallback(() => {
    goToSlide(currentIndex === 0 ? totalSlides - 1 : currentIndex - 1);
  }, [currentIndex, totalSlides, goToSlide]);

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

    observerRef.current = new IntersectionObserver(handleIntersection, {
      threshold: 0.3,
      rootMargin: '50px'
    });

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
            aria-label="Previous"
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
                  {isVideoPlaying ? '⏸' : '▶'}
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
            aria-label="Next"
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

// Post Card Component (UPDATED - Removed Save button, Added Share functionality)
const PostCard = forwardRef(({ 
  post, 
  currentUser, 
  onLike, 
  onComment, 
  onFollow, 
  isFollowing, 
  openPostModal,
  openShareModal 
}, ref) => {
  const [commentText, setCommentText] = useState("");
  const [isCommenting, setIsCommenting] = useState(false);
  const [localPost, setLocalPost] = useState(post);
  const [localLikes, setLocalLikes] = useState(post.likes || []);
  const [localComments, setLocalComments] = useState(post.comments || []);
  const [isLiked, setIsLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(post.likes?.length || 0);
  const [commentsCount, setCommentsCount] = useState(post.comments?.length || 0);
  
  const navigate = useNavigate();
  
  // Check if current user has liked the post
  useEffect(() => {
    if (!currentUser || !post) return;
    
    const userLiked = localLikes.some(like => {
      if (typeof like === 'string') {
        return like === currentUser.id || like === currentUser._id;
      } else if (like && typeof like === 'object') {
        return like._id === currentUser.id || 
               like.userId === currentUser.id ||
               like.userId === currentUser._id ||
               like._id === currentUser._id;
      }
      return false;
    });
    
    setIsLiked(userLiked);
    setLikesCount(localLikes.length);
    setCommentsCount(localComments.length);
  }, [currentUser, post, localLikes, localComments]);
  
  const handleLike = async () => {
    if (!currentUser) {
      navigate("/");
      return;
    }
    const updatedPost = await onLike(localPost._id);
    if (updatedPost) {
      setLocalPost(updatedPost);
      setLocalLikes(updatedPost.likes || []);
      setIsLiked(!isLiked);
      setLikesCount(prev => isLiked ? prev - 1 : prev + 1);
    }
  };
  
  const handleFollow = async () => {
    if (!currentUser) {
      navigate("/");
      return;
    }
    await onFollow(localPost.user?._id || localPost.userId);
  };
  
  const handleAddComment = async () => {
    if (!commentText.trim() || !currentUser) {
      navigate("/");
      return;
    }
    setIsCommenting(true);
    try {
      const updatedPost = await onComment(localPost._id, commentText);
      if (updatedPost) {
        setLocalPost(updatedPost);
        setLocalComments(updatedPost.comments || []);
        setCommentsCount(prev => prev + 1);
        setCommentText("");
      }
    } catch (error) {
      console.error("Error adding comment:", error);
    } finally {
      setIsCommenting(false);
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
  
  const formatNumber = (num) => {
    if (!num) return "0";
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };
  
  // Check if user has RSVPed to an event
  const getUserRSVPStatus = (post) => {
    if (!post.event?.attendees || !currentUser) return null;
    const userRSVP = post.event.attendees.find(a => a.userId === currentUser.id);
    return userRSVP ? userRSVP.status : null;
  };

  // Check if user has voted in a poll
  const getUserVoteStatus = (post) => {
    if (!post.poll?.voters || !currentUser) return null;
    return post.poll.voters.find(v => v.userId === currentUser.id);
  };

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
                onClick={() => !userVote && handlePollVote(postId, index)}
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
            <button 
              className="vote-btn"
              onClick={() => {}}
              style={{ opacity: 0.6, cursor: 'default' }}
            >
              Click an option to vote
            </button>
          )}
        </div>
      </div>
    );
  };

  const handlePollVote = async (postId, optionIndex) => {
    // This function would be passed as a prop if needed
    console.log('Voting on poll:', postId, optionIndex);
  };
  
  return (
    <div className="post-card" ref={ref}>
      {/* Post Header */}
      <div className="post-header">
        <div className="post-user">
          <div 
            className="user-avatar"
            onClick={() => navigate(`/profile/${localPost.user?._id || localPost.userId}`)}
            style={{ cursor: 'pointer' }}
          >
            {getUserAvatar(localPost.user)}
          </div>
          <div className="user-info">
            <div className="user-name">
              {localPost.user?.name || "Unknown User"}
              {localPost.user?.isPrivate && (
                <span className="private-badge" title="Private Account"> 🔒</span>
              )}
              {localPost.user?.role === 'faculty' && (
                <span className="verified-badge" title="Faculty Member"> 👨‍🏫</span>
              )}
              {localPost.user?.role === 'admin' && (
                <span className="admin-badge" title="Administrator"> 👑</span>
              )}
            </div>
            <div className="post-meta">
              <span className="post-time">
                {new Date(localPost.createdAt).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </span>
              {localPost.user?.department && (
                <span className="user-department">• {localPost.user.department}</span>
              )}
            </div>
          </div>
        </div>
        
        {localPost.user?._id !== currentUser?.id && (
          <button 
            className={`follow-btn ${isFollowing ? 'following' : ''}`}
            onClick={handleFollow}
          >
            {isFollowing ? 'Following' : 'Follow'}
          </button>
        )}
      </div>
      
      {/* Post Content */}
      <div className="post-content">
        <ReadMore text={localPost.content} maxLength={300} />
        
        {/* Display Event */}
        {localPost.type === 'event' && localPost.event && renderEventCard(localPost.event)}
        
        {/* Display Poll */}
        {localPost.type === 'poll' && localPost.poll && renderPollCard(localPost.poll, localPost._id)}
        
        {/* Media with Carousel */}
        {localPost.media && localPost.media.length > 0 && (
          <ImageCarousel 
            images={localPost.media.filter(m => m.type === 'image')} 
            videos={localPost.media.filter(m => m.type === 'video')} 
          />
        )}
        
        {/* Legacy imageUrl support */}
        {localPost.imageUrl && !localPost.media && (
          <div className="post-image">
            <img src={localPost.imageUrl} alt="Post content" />
          </div>
        )}
      </div>

      {/* Event RSVP Buttons */}
      {localPost.type === 'event' && localPost.event && (
        <div className="event-actions">
          {getUserRSVPStatus(localPost) === 'going' ? (
            <div className="rsvp-status">
              ✅ You're going to this event
            </div>
          ) : (
            <>
              <button 
                className="event-btn rsvp-btn"
                onClick={() => console.log('RSVP going:', localPost._id)}
              >
                ✅ Going
              </button>
              <button 
                className="event-btn maybe-btn"
                onClick={() => console.log('RSVP maybe:', localPost._id)}
              >
                🤔 Maybe
              </button>
            </>
          )}
        </div>
      )}
      
      {/* Post Stats */}
      <div className="post-stats">
        <span className="stat-item">👍 {formatNumber(likesCount)}</span>
        <span className="stat-item">💬 {formatNumber(commentsCount)}</span>
        {localPost.type === 'event' && localPost.event && (
          <span className="stat-item">
            👥 {localPost.event.rsvpCount || 0}
          </span>
        )}
        {localPost.type === 'poll' && localPost.poll && (
          <span className="stat-item">
            📊 {localPost.poll.totalVotes || 0}
          </span>
        )}
        {localPost.media && localPost.media.length > 0 && (
          <span className="stat-item">
            📷 {localPost.media.length}
          </span>
        )}
      </div>
      
      {/* Post Actions - REMOVED SAVE BUTTON, ADDED SHARE */}
      <div className="post-actions-buttons">
        <button 
          className={`action-btn like-btn ${isLiked ? 'liked' : ''}`}
          onClick={handleLike}
        >
          {isLiked ? '❤️ Liked' : '🤍 Like'}
        </button>
        <button 
          className="action-btn comment-btn"
          onClick={() => openPostModal(localPost)}
        >
          💬 Comment
        </button>
        <button 
          className="action-btn share-btn"
          onClick={() => openShareModal(localPost)}
        >
          🔄 Share
        </button>
      </div>
      
      {/* Add Comment - Simplified version */}
      <div className="add-comment">
        <div className="comment-avatar-small">
          {getUserAvatar(currentUser)}
        </div>
        <input 
          type="text" 
          placeholder="Write a comment..." 
          className="comment-input"
          value={commentText}
          onChange={(e) => setCommentText(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleAddComment()}
          disabled={isCommenting}
        />
        <button 
          className="comment-submit-btn"
          onClick={handleAddComment}
          disabled={isCommenting || !commentText.trim()}
        >
          {isCommenting ? '...' : 'Post'}
        </button>
      </div>
    </div>
  );
});

PostCard.displayName = 'PostCard';

// User Card Component
const UserCard = ({ userData, currentUser, onFollow, isFollowing }) => {
  const navigate = useNavigate();
  
  const getUserAvatar = (user) => {
    if (user?.profilePhoto) {
      return (
        <img 
          src={user.profilePhoto} 
          alt={user.name} 
          className="user-avatar-img"
        />
      );
    }
    return user?.name?.charAt(0).toUpperCase() || "U";
  };
  
  const formatNumber = (num) => {
    if (!num) return "0";
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };
  
  const followersCount = Array.isArray(userData.followers) ? userData.followers.length : 0;
  const connectionsCount = Array.isArray(userData.connections) ? userData.connections.length : 0;
  
  return (
    <div className="user-card">
      <div 
        className="user-avatar-large"
        onClick={() => navigate(`/profile/${userData._id || userData.id}`)}
        style={{ cursor: 'pointer' }}
      >
        {getUserAvatar(userData)}
      </div>
      <div className="user-info">
        <h4 
          className="user-name"
          onClick={() => navigate(`/profile/${userData._id || userData.id}`)}
          style={{ cursor: 'pointer' }}
        >
          {userData.name}
          {userData.isPrivate && (
            <span className="private-badge" title="Private Account"> 🔒</span>
          )}
          {userData.role === 'faculty' && (
            <span className="verified-badge" title="Faculty Member"> 👨‍🏫</span>
          )}
        </h4>
        <p className="user-department">{userData.department || userData.facultyDepartment || 'No department'}</p>
        <div className="user-stats">
          <span>{formatNumber(followersCount)} followers</span>
          <span>•</span>
          <span>{formatNumber(connectionsCount)} connections</span>
        </div>
      </div>
      {currentUser?.id !== (userData._id || userData.id) && (
        <button 
          className={`follow-btn ${isFollowing ? 'following' : ''}`}
          onClick={() => onFollow(userData._id || userData.id)}
        >
          {isFollowing ? 'Following' : 'Follow'}
        </button>
      )}
    </div>
  );
};

// Hashtag Card Component
const HashtagCard = ({ tag, count, onClick }) => {
  return (
    <div className="hashtag-card" onClick={() => onClick(tag)}>
      <div className="hashtag-icon">#</div>
      <div className="hashtag-content">
        <h4>#{tag}</h4>
        <p>{count.toLocaleString()} posts</p>
      </div>
    </div>
  );
};

function Explore() {
  const [activeTab, setActiveTab] = useState('trending');
  const [timeFilter, setTimeFilter] = useState('week');
  const [mediaFilter, setMediaFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  const [trendingPosts, setTrendingPosts] = useState([]);
  const [latestPosts, setLatestPosts] = useState([]);
  const [categoryPosts, setCategoryPosts] = useState([]);
  const [hashtagPosts, setHashtagPosts] = useState([]);
  const [mediaPosts, setMediaPosts] = useState([]);
  const [searchResults, setSearchResults] = useState({ posts: [], users: [], hashtags: [] });
  const [discoverUsers, setDiscoverUsers] = useState([]);
  const [trendingHashtags, setTrendingHashtags] = useState([]);
  
  // New states for connections and posts
  const [connections, setConnections] = useState([]);
  const [connectionPosts, setConnectionPosts] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  
  // Post Modal states (like Feed section)
  const [postModalOpen, setPostModalOpen] = useState(false);
  const [selectedPost, setSelectedPost] = useState(null);
  
  // SHARE STATES (like Feed section)
  const [showShareModal, setShowShareModal] = useState(false);
  const [postToShare, setPostToShare] = useState(null);
  const [shareConnections, setShareConnections] = useState([]);
  const [selectedConnections, setSelectedConnections] = useState([]);
  const [searchShareConnections, setSearchShareConnections] = useState("");
  const [shareMessage, setShareMessage] = useState("");
  const [shareLoading, setShareLoading] = useState(false);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [user, setUser] = useState(null);
  const [following, setFollowing] = useState({});
  const [userStats, setUserStats] = useState({
    posts: 0,
    connections: 0,
    followers: 0,
    following: 0
  });
  
  const navigate = useNavigate();
  const observerRef = useRef();
  const lastPostRef = useRef();
  const pageRef = useRef(1);
  const hasMoreRef = useRef(true);
  
  // Consolidated avatar function
  const getUserAvatar = (userObj) => {
    if (!userObj) return "U";
    
    if (userObj.profilePhoto && userObj.profilePhoto !== "null" && userObj.profilePhoto !== "undefined") {
      return (
        <img 
          src={userObj.profilePhoto} 
          alt={userObj.name || "User"} 
          className="user-avatar-img"
          onError={(e) => {
            e.target.style.display = 'none';
            e.target.parentElement.textContent = userObj?.name?.charAt(0).toUpperCase() || "U";
          }}
        />
      );
    }
    return userObj?.name?.charAt(0).toUpperCase() || "U";
  };
  
  // Fetch user data
  useEffect(() => {
    const userData = localStorage.getItem('user');
    const token = localStorage.getItem('token');
    
    if (!userData || !token) {
      navigate("/");
      return;
    }
    
    try {
      const parsedUser = JSON.parse(userData);
      setUser(parsedUser);
      
      fetchUserProfile(parsedUser.id, token);
      fetchUserStats(parsedUser.id, token);
      
      // NEW: Fetch connections and their posts
      fetchConnections(token);
      fetchAllUsers(token);
      
      // Initialize Socket for notifications
      const socket = getSocket();
      if (socket) {
        socket.on("new_notification", (payload) => {
          console.log("New notification:", payload);
        });
      }
      
      return () => {
        if (socket) {
          socket.off("new_notification");
        }
      };
    } catch (error) {
      console.error("Error parsing user data:", error);
      navigate("/");
    }
  }, [navigate]);
  
  // Fetch detailed user profile
  const fetchUserProfile = async (userId, token) => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/auth/profile`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setUser(data);
        localStorage.setItem('user', JSON.stringify(data));
      } else if (response.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        navigate("/");
      }
    } catch (error) {
      console.error('Error fetching user profile:', error);
    }
  };
  
  // Fetch user stats
  const fetchUserStats = async (userId, token) => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/auth/profile/stats`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setUserStats({
          posts: data.posts || 0,
          connections: data.connections || 0,
          followers: data.followers || 0,
          following: data.following || 0
        });
      } else {
        setUserStats({
          posts: 0,
          connections: 0,
          followers: 0,
          following: 0
        });
      }
    } catch (error) {
      console.error('Error fetching user stats:', error);
      setUserStats({
        posts: 0,
        connections: 0,
        followers: 0,
        following: 0
      });
    }
  };
  
  // NEW: Fetch connections
  const fetchConnections = async (token) => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/network/connections`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        const connectionsList = data.connections || data || [];
        setConnections(connectionsList);
        
        // Also set share connections
        setShareConnections(connectionsList);
        
        // Fetch posts from connections
        fetchConnectionPosts(connectionsList.map(conn => conn._id || conn.id), token);
      }
    } catch (error) {
      console.error('Error fetching connections:', error);
    }
  };
  
  // NEW: Fetch posts from connections
  const fetchConnectionPosts = async (connectionIds, token) => {
    if (!connectionIds || connectionIds.length === 0) {
      setConnectionPosts([]);
      return;
    }
    
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/posts?connections=${connectionIds.join(',')}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        setConnectionPosts(data);
      }
    } catch (error) {
      console.error('Error fetching connection posts:', error);
    }
  };
  
  // NEW: Fetch all users for PostModal
  const fetchAllUsers = async (token) => {
    try {
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
  
  // ==================== SHARE FUNCTIONS (like Feed section) ====================
  
  // Open share modal for a post
  const openShareModal = async (post) => {
    console.log("📤 Opening share modal for post:", post._id);
    
    setPostToShare(post);
    setSelectedConnections([]);
    setSearchShareConnections("");
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
        setShareConnections(connectionsList);
      } else {
        const errorData = await response.json();
        setError("Failed to load connections: " + (errorData.message || "Unknown error"));
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
    setSearchShareConnections("");
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
    if (selectedConnections.length === shareConnections.length) {
      setSelectedConnections([]);
    } else {
      const allConnectionIds = shareConnections.map(conn => conn._id || conn.id);
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
        
        // Refresh posts
        if (activeTab === 'connections') {
          fetchConnections(token);
        }
        
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
  const filteredShareConnections = shareConnections.filter(conn => {
    const searchLower = searchShareConnections.toLowerCase();
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
  
  // Fetch trending posts
  const fetchTrendingPosts = useCallback(async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/explore/trending?timeframe=${timeFilter}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );
      
      if (response.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        navigate("/");
        return;
      }
      
      const data = await response.json();
      if (response.ok) {
        setTrendingPosts(data);
      } else {
        setError(data.message || 'Failed to fetch trending posts');
      }
    } catch (error) {
      setError('Network error: ' + error.message);
    } finally {
      setLoading(false);
    }
  }, [user, timeFilter, navigate]);
  
  // Fetch latest posts
  const fetchLatestPosts = useCallback(async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/explore/latest?page=${pageRef.current}&limit=10`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );
      
      if (response.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        navigate("/");
        return;
      }
      
      const data = await response.json();
      if (response.ok) {
        if (pageRef.current === 1) {
          setLatestPosts(data.posts || []);
        } else {
          setLatestPosts(prev => [...prev, ...(data.posts || [])]);
        }
        hasMoreRef.current = data.currentPage < data.totalPages;
      } else {
        setError(data.message || 'Failed to fetch latest posts');
      }
    } catch (error) {
      setError('Network error: ' + error.message);
    } finally {
      setLoading(false);
    }
  }, [user, navigate]);
  
  // Fetch posts by category
  const fetchCategoryPosts = useCallback(async () => {
    if (!user || categoryFilter === 'all') return;
    
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/explore/category/${categoryFilter}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );
      
      if (response.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        navigate("/");
        return;
      }
      
      const data = await response.json();
      if (response.ok) {
        setCategoryPosts(data);
      } else {
        setError(data.message || 'Failed to fetch category posts');
      }
    } catch (error) {
      setError('Network error: ' + error.message);
    } finally {
      setLoading(false);
    }
  }, [user, categoryFilter, navigate]);
  
  // Fetch posts by media type
  const fetchMediaPosts = useCallback(async () => {
    if (!user || mediaFilter === 'all') return;
    
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/explore/media/${mediaFilter}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );
      
      if (response.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        navigate("/");
        return;
      }
      
      const data = await response.json();
      if (response.ok) {
        setMediaPosts(data);
      } else {
        setError(data.message || 'Failed to fetch media posts');
      }
    } catch (error) {
      setError('Network error: ' + error.message);
    } finally {
      setLoading(false);
    }
  }, [user, mediaFilter, navigate]);
  
  // Fetch discover users
  const fetchDiscoverUsers = useCallback(async () => {
    if (!user) return;
    
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/explore/people`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );
      
      if (response.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        navigate("/");
        return;
      }
      
      const data = await response.json();
      if (response.ok) {
        setDiscoverUsers(data);
        
        // Initialize following state
        const followingState = {};
        data.forEach(userData => {
          if (userData.followers && Array.isArray(userData.followers)) {
            followingState[userData._id] = userData.followers.some(
              follower => follower === user.id || 
                         (typeof follower === 'object' && follower._id === user.id)
            );
          } else {
            followingState[userData._id] = false;
          }
        });
        setFollowing(followingState);
      }
    } catch (error) {
      console.error('Error fetching discover users:', error);
    }
  }, [user, navigate]);
  
  // Fetch trending hashtags
  const fetchTrendingHashtags = useCallback(async () => {
    if (!user) return;
    
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/explore/hashtags/trending`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );
      
      if (response.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        navigate("/");
        return;
      }
      
      const data = await response.json();
      if (response.ok) {
        setTrendingHashtags(data);
      }
    } catch (error) {
      console.error('Error fetching trending hashtags:', error);
    }
  }, [user, navigate]);
  
  // Search posts and users
  const handleSearchFromNavbar = useCallback(async (query) => {
    if (!user || !query.trim()) return;
    
    setActiveTab('search');
    setSearchQuery(query);
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/explore/search?q=${encodeURIComponent(query)}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );
      
      if (response.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        navigate("/");
        return;
      }
      
      const data = await response.json();
      if (response.ok) {
        setSearchResults(data.results || { posts: [], users: [], hashtags: [] });
      } else {
        setError(data.message || 'Search failed');
      }
    } catch (error) {
      setError('Network error during search');
    } finally {
      setLoading(false);
    }
  }, [user, navigate]);
  
  // Listen for search events from navbar
  useEffect(() => {
    const handleNavbarSearch = (event) => {
      if (event.detail && event.detail.query) {
        handleSearchFromNavbar(event.detail.query);
      }
    };
    
    window.addEventListener('navbarSearch', handleNavbarSearch);
    
    return () => {
      window.removeEventListener('navbarSearch', handleNavbarSearch);
    };
  }, [handleSearchFromNavbar]);
  
  // Handle like
  const handleLike = async (postId) => {
    if (!user) {
      navigate("/");
      return null;
    }
    
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/posts/${postId}/like`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        navigate("/");
        return null;
      }
      
      if (response.ok) {
        const updatedPost = await response.json();
        setSuccess('Post liked!');
        setTimeout(() => setSuccess(""), 2000);
        return updatedPost;
      } else {
        const errorData = await response.json();
        setError(errorData.message || 'Failed to like post');
        return null;
      }
    } catch (error) {
      setError('Failed to like post');
      return null;
    }
  };
  
  // Handle follow
  const handleFollow = async (userId) => {
    if (!user) {
      navigate("/");
      return;
    }
    
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/network/request/${userId}`, {
        method: 'POST',
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
      if (response.ok) {
        setFollowing(prev => ({ ...prev, [userId]: true }));
        setSuccess(data.message || 'Connection request sent!');
        setTimeout(() => setSuccess(""), 2000);
        
        // Update discover users list
        setDiscoverUsers(prev => prev.map(u => 
          u._id === userId ? { ...u, followers: [...(u.followers || []), user.id] } : u
        ));
      } else {
        setError(data.message || 'Failed to send connection request');
      }
    } catch (error) {
      setError('Failed to send connection request');
    }
  };
  
  // Handle comment
  const handleComment = async (postId, content) => {
    if (!user) {
      navigate("/");
      return null;
    }
    
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/posts/${postId}/comment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ content })
      });
      
      if (response.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        navigate("/");
        return null;
      }
      
      if (response.ok) {
        const data = await response.json();
        const updatedPost = data.post;
        setSuccess('Comment added!');
        setTimeout(() => setSuccess(""), 2000);
        return updatedPost;
      } else {
        const errorData = await response.json();
        setError(errorData.message || 'Failed to add comment');
        throw new Error(errorData.message);
      }
    } catch (error) {
      setError('Failed to add comment');
      throw error;
    }
  };
  
  // Handle hashtag click
  const handleHashtagClick = async (tag) => {
    if (!user) {
      navigate("/");
      return;
    }
    
    setActiveTab('hashtag');
    const cleanTag = tag.startsWith('#') ? tag.substring(1) : tag;
    setSearchQuery(`#${cleanTag}`);
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/explore/hashtag/${encodeURIComponent(cleanTag)}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );
      
      if (response.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        navigate("/");
        return;
      }
      
      const data = await response.json();
      if (response.ok) {
        setHashtagPosts(data);
      } else {
        setError(data.message || 'Failed to fetch hashtag posts');
      }
    } catch (error) {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  };
  
  // NEW: Open post modal with comments and likes (like Feed section)
  const openPostModal = (post) => {
    setSelectedPost(post);
    setPostModalOpen(true);
  };

  // NEW: Close post modal
  const closePostModal = () => {
    setSelectedPost(null);
    setPostModalOpen(false);
  };
  
  // Infinite scroll observer
  useEffect(() => {
    if (!lastPostRef.current || !hasMoreRef.current || loading) return;
    
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMoreRef.current) {
          pageRef.current += 1;
          
          switch (activeTab) {
            case 'latest':
              fetchLatestPosts();
              break;
            default:
              break;
          }
        }
      },
      { threshold: 0.5 }
    );
    
    if (lastPostRef.current) {
      observer.observe(lastPostRef.current);
    }
    
    return () => {
      if (observer) observer.disconnect();
    };
  }, [activeTab, loading, fetchLatestPosts]);
  
  // Initial data fetch
  useEffect(() => {
    if (!user) return;
    
    pageRef.current = 1;
    hasMoreRef.current = true;
    
    switch (activeTab) {
      case 'trending':
        fetchTrendingPosts();
        break;
      case 'latest':
        fetchLatestPosts();
        break;
      case 'category':
        fetchCategoryPosts();
        break;
      case 'media':
        fetchMediaPosts();
        break;
      case 'hashtag':
        break;
      case 'search':
        break;
    }
    
    fetchDiscoverUsers();
    fetchTrendingHashtags();
  }, [
    user, 
    activeTab, 
    timeFilter, 
    categoryFilter, 
    mediaFilter, 
    fetchTrendingPosts, 
    fetchLatestPosts, 
    fetchCategoryPosts, 
    fetchMediaPosts, 
    fetchDiscoverUsers, 
    fetchTrendingHashtags
  ]);
  
  // Get current posts based on active tab
  const getCurrentPosts = () => {
    switch (activeTab) {
      case 'trending':
        return trendingPosts;
      case 'latest':
        return latestPosts;
      case 'category':
        return categoryPosts;
      case 'media':
        return mediaPosts;
      case 'hashtag':
        return hashtagPosts;
      case 'search':
        return searchResults.posts || [];
      default:
        return trendingPosts;
    }
  };
  
  // Get current users for search
  const getCurrentUsers = () => {
    if (activeTab !== 'search') return [];
    return searchResults.users || [];
  };
  
  if (!user) {
    return (
      <div className="explore-page-root">
        <Navbar />
        <div className="network-loading-container">
          <div className="network-loading-spinner"></div>
          <p>Loading Explore...</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="explore-page-root">
      <Navbar />

      {error && (
        <Toast message={error} type="error" onClose={() => setError("")} />
      )}
      {success && (
        <Toast message={success} type="success" onClose={() => setSuccess("")} />
      )}

      <div className="explore-layout-container">
        {/* ========== LEFT SIDEBAR ========== */}
        <div className="explore-sidebar explore-left-sidebar">
          {/* User Profile Card - DYNAMIC */}
          <div className="explore-profile-mini-card" onClick={() => navigate("/profile")}>
            <div className="explore-mini-avatar">
              {getUserAvatar(user)}
            </div>
            <div className="explore-mini-info">
              <h4>{user?.name || "User"}</h4>
              <p className="explore-mini-title">
                {user?.role === 'student' ? `🎓 ${user?.department || 'Student'}` : 
                 user?.role === 'faculty' ? `👨‍🏫 ${user?.department || 'Faculty'}` : 
                 user?.role === 'admin' ? '👑 Administrator' : '👤 Member'}
              </p>
              <p className="explore-mini-bio">
                {user?.bio?.slice(0, 80) || "Welcome to Swish! Explore trending content and connect with your community."}
              </p>
            </div>
          </div>

          {/* Quick Filters */}
          <div className="explore-quick-actions-card">
            <h3 className="explore-sidebar-title">
              <span>⚡ Quick Filters</span>
            </h3>
            <div className="explore-quick-actions-grid">
              <button className="explore-quick-action-btn" onClick={() => {
                setActiveTab('trending');
                setTimeFilter('day');
                setSearchQuery('Today\'s trending');
              }}>
                <span className="explore-action-icon">🔥</span>
                <span>Trending Today</span>
              </button>
              <button className="explore-quick-action-btn" onClick={() => {
                setActiveTab('media');
                setMediaFilter('video');
                setSearchQuery('Videos');
              }}>
                <span className="explore-action-icon">🎥</span>
                <span>Videos Only</span>
              </button>
              <button className="explore-quick-action-btn" onClick={() => {
                setActiveTab('category');
                setCategoryFilter('events');
                setSearchQuery('Events');
              }}>
                <span className="explore-action-icon">📅</span>
                <span>Events</span>
              </button>
              <button className="explore-quick-action-btn" onClick={() => {
                if (trendingHashtags.length > 0) {
                  handleHashtagClick(trendingHashtags[0].tag);
                }
              }}>
                <span className="explore-action-icon">#</span>
                <span>Top Hashtag</span>
              </button>
            </div>
          </div>

          {/* Trending Hashtags in Sidebar */}
          {trendingHashtags.length > 0 && (
            <div className="explore-analytics-card">
              <h3 className="explore-sidebar-title">
                <span>🔥 Trending Hashtags</span>
              </h3>
              <div className="explore-suggestions-list">
                {trendingHashtags.slice(0, 5).map((tag, index) => (
                  <div 
                    key={index} 
                    className="explore-suggestion-item" 
                    onClick={() => handleHashtagClick(tag.tag)}
                  >
                    <div className="explore-suggestion-avatar">
                      <span>#</span>
                    </div>
                    <div className="explore-suggestion-info">
                      <h4>#{tag.tag}</h4>
                      <p className="explore-suggestion-meta">{tag.count || tag.posts || 0} posts</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ========== MAIN CONTENT ========== */}
        <div className="explore-main-content">
          <div className="explore-container">
            <div className="explore-content-header">
              <h2 className="explore-content-title">
                Explore Content
                {connectionPosts.length > 0 && <span className="explore-title-badge">{connectionPosts.length} from connections</span>}
              </h2>
              <div className="explore-header-actions">
                <button className="explore-feature-btn" onClick={() => {
                  setActiveTab('trending');
                  setTimeFilter('week');
                }}>
                  🔥 Trending
                </button>
                <button className="explore-feature-btn" onClick={() => navigate("/feed")}>
                  ✨ Create Post
                </button>
              </div>
            </div>

            {/* Search/Filter Bar */}
            {searchQuery && (
              <div className="explore-filter-bar">
                <div className="explore-filter-info">
                  <span className="explore-filter-icon">🔍</span>
                  <span className="explore-filter-text">Showing: {searchQuery}</span>
                  <span className="explore-filter-count">({getCurrentPosts().length} results)</span>
                </div>
                <button className="explore-clear-filter-btn" onClick={() => {
                  setSearchQuery('');
                  setActiveTab('trending');
                  setTimeFilter('week');
                  setMediaFilter('all');
                  setCategoryFilter('all');
                }}>
                  <span className="explore-clear-icon">✕</span>
                  Clear Filter
                </button>
              </div>
            )}

            {/* Explore Tabs */}
            <div className="explore-tabs-container">
              <div 
                className={`explore-tab-item ${activeTab === 'connections' ? 'active' : ''}`} 
                onClick={() => { setActiveTab('connections'); setSearchQuery(''); }}
              >
                <span className="explore-tab-icon">👥</span>
                <span className="explore-tab-text">Connections</span>
              </div>

              <div 
                className={`explore-tab-item ${activeTab === 'trending' ? 'active' : ''}`} 
                onClick={() => { setActiveTab('trending'); setSearchQuery(''); }}
              >
                <span className="explore-tab-icon">🔥</span>
                <span className="explore-tab-text">Trending</span>
              </div>

              <div 
                className={`explore-tab-item ${activeTab === 'latest' ? 'active' : ''}`} 
                onClick={() => { setActiveTab('latest'); setSearchQuery(''); }}
              >
                <span className="explore-tab-icon">🕒</span>
                <span className="explore-tab-text">Latest</span>
              </div>

              <div 
                className={`explore-tab-item ${activeTab === 'category' ? 'active' : ''}`} 
                onClick={() => { setActiveTab('category'); setSearchQuery(''); }}
              >
                <span className="explore-tab-icon">🏷️</span>
                <span className="explore-tab-text">Categories</span>
              </div>

              <div 
                className={`explore-tab-item ${activeTab === 'media' ? 'active' : ''}`} 
                onClick={() => { setActiveTab('media'); setSearchQuery(''); }}
              >
                <span className="explore-tab-icon">📷</span>
                <span className="explore-tab-text">Media</span>
              </div>
            </div>

            {/* Tab Content */}
            <div className="explore-tab-content active">
              {loading && pageRef.current === 1 ? (
                // Skeleton Loaders
                Array.from({ length: 6 }).map((_, index) => (
                  <div key={index} className="post-card skeleton">
                    <div className="skeleton-header">
                      <div className="skeleton-avatar"></div>
                      <div className="skeleton-user">
                        <div className="skeleton-line short"></div>
                        <div className="skeleton-line shorter"></div>
                      </div>
                    </div>
                    <div className="skeleton-content">
                      <div className="skeleton-line"></div>
                      <div className="skeleton-line"></div>
                      <div className="skeleton-line half"></div>
                    </div>
                    <div className="skeleton-media"></div>
                    <div className="skeleton-actions">
                      <div className="skeleton-button"></div>
                      <div className="skeleton-button"></div>
                      <div className="skeleton-button"></div>
                    </div>
                  </div>
                ))
              ) : activeTab === 'connections' ? (
                // Connections Posts - LIKE FEED SECTION
                <>
                  {connectionPosts.length > 0 ? (
                    connectionPosts.map((post, index) => (
                      <PostCard
                        key={post._id}
                        ref={index === connectionPosts.length - 1 ? lastPostRef : null}
                        post={post}
                        currentUser={user}
                        onLike={handleLike}
                        onFollow={handleFollow}
                        onComment={handleComment}
                        isFollowing={following[post.user?._id || post.userId]}
                        openPostModal={openPostModal}
                        openShareModal={openShareModal}
                      />
                    ))
                  ) : (
                    <div className="explore-empty-state">
                      <div className="explore-empty-icon">👥</div>
                      <h3>No connection posts yet</h3>
                      <p>Connect with more people to see their posts here!</p>
                      <button 
                        className="explore-connect-btn"
                        onClick={() => navigate("/network")}
                        style={{marginTop: '20px', maxWidth: '200px'}}
                      >
                        👥 Find Connections
                      </button>
                    </div>
                  )}
                </>
              ) : activeTab === 'search' && getCurrentUsers().length > 0 ? (
                // Search Results - Users
                <div className="search-results">
                  <h3>👥 Users ({getCurrentUsers().length})</h3>
                  <div className="users-grid">
                    {getCurrentUsers().map((userResult) => (
                      <UserCard
                        key={userResult._id || userResult.id}
                        userData={userResult}
                        currentUser={user}
                        onFollow={handleFollow}
                        isFollowing={following[userResult._id]}
                      />
                    ))}
                  </div>
                  
                  {/* Search Results - Posts */}
                  {getCurrentPosts().length > 0 && (
                    <>
                      <h3>📝 Posts ({getCurrentPosts().length})</h3>
                      {getCurrentPosts().map((post, index) => (
                        <PostCard
                          key={post._id}
                          ref={index === getCurrentPosts().length - 1 ? lastPostRef : null}
                          post={post}
                          currentUser={user}
                          onLike={handleLike}
                          onFollow={handleFollow}
                          onComment={handleComment}
                          isFollowing={following[post.user?._id || post.userId]}
                          openPostModal={openPostModal}
                          openShareModal={openShareModal}
                        />
                      ))}
                    </>
                  )}
                </div>
              ) : getCurrentPosts().length > 0 ? (
                // Regular Posts - ONE BELOW ANOTHER
                <>
                  {getCurrentPosts().map((post, index) => (
                    <PostCard
                      key={post._id}
                      ref={index === getCurrentPosts().length - 1 ? lastPostRef : null}
                      post={post}
                      currentUser={user}
                      onLike={handleLike}
                      onFollow={handleFollow}
                      onComment={handleComment}
                      isFollowing={following[post.user?._id || post.userId]}
                      openPostModal={openPostModal}
                      openShareModal={openShareModal}
                    />
                  ))}
                  
                  {loading && pageRef.current > 1 && (
                    <div className="loading-more">
                      <div className="loading-spinner"></div>
                      <p>Loading more posts...</p>
                    </div>
                  )}
                </>
              ) : (
                // Empty State
                <div className="explore-empty-state">
                  <div className="explore-empty-icon">
                    {activeTab === 'trending' && '🔥'}
                    {activeTab === 'latest' && '🕒'}
                    {activeTab === 'category' && '🏷️'}
                    {activeTab === 'media' && '📷'}
                    {activeTab === 'search' && '🔍'}
                    {activeTab === 'hashtag' && '#'}
                  </div>
                  <h3>
                    {activeTab === 'trending' && 'No trending posts found'}
                    {activeTab === 'latest' && 'No posts yet'}
                    {activeTab === 'category' && `No posts in "${categoryFilter}" category`}
                    {activeTab === 'media' && `No "${mediaFilter}" posts found`}
                    {activeTab === 'search' && 'No results found'}
                    {activeTab === 'hashtag' && `No posts with "${searchQuery}" found`}
                  </h3>
                  <p>
                    {activeTab === 'trending' && 'Be the first to create trending content!'}
                    {activeTab === 'latest' && 'Create a post to get started!'}
                    {activeTab === 'category' && 'Be the first to post in this category!'}
                    {activeTab === 'media' && 'Create a post with this media type!'}
                    {activeTab === 'search' && 'Try a different search term'}
                    {activeTab === 'hashtag' && 'Try a different hashtag or create a post with this hashtag!'}
                  </p>
                  {(activeTab !== 'search' && activeTab !== 'hashtag') && (
                    <button 
                      className="explore-connect-btn"
                      onClick={() => navigate("/feed")}
                      style={{marginTop: '20px', maxWidth: '200px'}}
                    >
                      ✨ Create a Post
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ========== RIGHT SIDEBAR ========== */}
        <div className="explore-sidebar explore-right-sidebar">
          {/* Time Filter */}
          <div className="explore-analytics-card">
            <h3 className="explore-sidebar-title">
              <span>📅 Time Range</span>
            </h3>
            <div className="filter-options">
              {[
                { key: 'day', label: 'Today', icon: '☀️' },
                { key: 'week', label: 'This Week', icon: '📅' },
                { key: 'month', label: 'This Month', icon: '🗓️' }
              ].map((time) => (
                <button
                  key={time.key}
                  className={`filter-btn ${timeFilter === time.key ? 'active' : ''}`}
                  onClick={() => {
                    setTimeFilter(time.key);
                    if (activeTab === 'trending') {
                      fetchTrendingPosts();
                    }
                  }}
                >
                  <span className="filter-btn-icon">{time.icon}</span>
                  <span>{time.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Category Filter */}
          <div className="explore-analytics-card">
            <h3 className="explore-sidebar-title">
              <span>🏷️ Categories</span>
            </h3>
            <div className="filter-options">
              {[
                { key: 'all', label: 'All Categories', icon: '📋' },
                { key: 'events', label: 'Events', icon: '📅' },
                { key: 'polls', label: 'Polls', icon: '📊' },
                { key: 'media', label: 'Media', icon: '📷' },
                { key: 'announcements', label: 'Announcements', icon: '📢' },
                { key: 'discussions', label: 'Discussions', icon: '💬' }
              ].map((category) => (
                <button
                  key={category.key}
                  className={`filter-btn ${categoryFilter === category.key ? 'active' : ''}`}
                  onClick={() => {
                    setCategoryFilter(category.key);
                    setActiveTab('category');
                  }}
                >
                  <span className="filter-btn-icon">{category.icon}</span>
                  <span>{category.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Media Filter */}
          <div className="explore-analytics-card">
            <h3 className="explore-sidebar-title">
              <span>📷 Media Type</span>
            </h3>
            <div className="filter-options">
              {[
                { key: 'all', label: 'All Media', icon: '📱' },
                { key: 'image', label: 'Images Only', icon: '🖼️' },
                { key: 'video', label: 'Videos Only', icon: '🎥' }
              ].map((media) => (
                <button
                  key={media.key}
                  className={`filter-btn ${mediaFilter === media.key ? 'active' : ''}`}
                  onClick={() => {
                    setMediaFilter(media.key);
                    setActiveTab('media');
                  }}
                >
                  <span className="filter-btn-icon">{media.icon}</span>
                  <span>{media.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Quick Stats */}
          <div className="explore-analytics-card">
            <h3 className="explore-sidebar-title">
              <span>📊 Explore Stats</span>
            </h3>
            
            <div className="explore-mini-stats">
              <div className="explore-stats-grid">
                <div className="explore-stat-item">
                  <span className="explore-stat-number">{trendingPosts.length}</span>
                  <span className="explore-stat-label">Trending</span>
                </div>
                <div className="explore-stat-item">
                  <span className="explore-stat-number">{latestPosts.length}</span>
                  <span className="explore-stat-label">Latest</span>
                </div>
                <div className="explore-stat-item">
                  <span className="explore-stat-number">{discoverUsers.length}</span>
                  <span className="explore-stat-label">People</span>
                </div>
                <div className="explore-stat-item">
                  <span className="explore-stat-number">{connections.length}</span>
                  <span className="explore-stat-label">Connections</span>
                </div>
              </div>
            </div>
          </div>

          {/* Discover People */}
          {discoverUsers.length > 0 && (
            <div className="explore-analytics-card">
              <h3 className="explore-sidebar-title">
                <span>👥 Discover People</span>
              </h3>
              
              <div className="explore-suggestions-list">
                {discoverUsers.slice(0, 3).map((discoverUser) => (
                  <div 
                    key={discoverUser._id} 
                    className="explore-suggestion-item"
                    onClick={() => navigate(`/profile/${discoverUser._id}`)}
                  >
                    <div className="explore-suggestion-avatar">
                      {getUserAvatar(discoverUser)}
                    </div>
                    <div className="explore-suggestion-info">
                      <h4>{discoverUser.name}</h4>
                      <p className="explore-suggestion-meta">{discoverUser.department || 'No department'}</p>
                    </div>
                  </div>
                ))}
              </div>

              <button 
                className="explore-view-all-btn"
                onClick={() => navigate("/network")}
              >
                View all people →
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Post Modal (like Feed section) */}
      {postModalOpen && selectedPost && (
        <PostModal
          post={selectedPost}
          currentUser={user}
          users={allUsers}
          onClose={closePostModal}
          onAddComment={handleComment}
          onLike={handleLike}
        />
      )}

      {/* Share Modal (like Feed section) */}
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
                      value={searchShareConnections}
                      onChange={(e) => setSearchShareConnections(e.target.value)}
                    />
                  </div>
                </div>
                
                <div className="select-all-connections">
                  <label className="select-all-checkbox">
                    <input
                      type="checkbox"
                      checked={selectedConnections.length === shareConnections.length && shareConnections.length > 0}
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
                  ) : filteredShareConnections.length > 0 ? (
                    filteredShareConnections.map(conn => (
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
                      {searchShareConnections ? 'No connections match your search' : 'No connections found'}
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
    </div>
  );
}

export default Explore;