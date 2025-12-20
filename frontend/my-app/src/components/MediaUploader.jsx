import React, { useState, useRef, useEffect, useCallback } from 'react';
import '../styles/MediaUploader.css';

// LinkedIn-style Video Player Component (merged into MediaUploader)
const LinkedInVideoPlayer = ({ src, format = 'mp4', type = 'video' }) => {
  const videoRef = useRef(null);
  const containerRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showControls, setShowControls] = useState(false);
  const [volume, setVolume] = useState(0);
  const [isInView, setIsInView] = useState(false);

  // Initialize video metadata
  useEffect(() => {
    if (videoRef.current) {
      const handleLoadedMetadata = () => {
        setDuration(videoRef.current.duration);
        videoRef.current.muted = true; // LinkedIn default: muted
        videoRef.current.volume = 0;
      };
      
      const handleTimeUpdate = () => {
        setCurrentTime(videoRef.current.currentTime);
      };

      videoRef.current.addEventListener('loadedmetadata', handleLoadedMetadata);
      videoRef.current.addEventListener('timeupdate', handleTimeUpdate);

      return () => {
        if (videoRef.current) {
          videoRef.current.removeEventListener('loadedmetadata', handleLoadedMetadata);
          videoRef.current.removeEventListener('timeupdate', handleTimeUpdate);
        }
      };
    }
  }, [src]);

  // LinkedIn-style: Auto-play when in viewport, auto-pause when out
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          setIsInView(entry.isIntersecting);
          
          if (entry.isIntersecting) {
            // Video entered viewport - try to play
            if (videoRef.current) {
              videoRef.current.muted = true; // LinkedIn default: muted
              const playPromise = videoRef.current.play();
              if (playPromise !== undefined) {
                playPromise
                  .then(() => {
                    setIsPlaying(true);
                  })
                  .catch(error => {
                    console.log("Auto-play prevented:", error);
                    // Browser blocked auto-play, show play button
                  });
              }
            }
          } else {
            // Video left viewport - pause
            if (videoRef.current && !videoRef.current.paused) {
              videoRef.current.pause();
              setIsPlaying(false);
            }
          }
        });
      },
      {
        threshold: 0.5, // 50% of video should be visible
        rootMargin: '100px' // Start loading when 100px away
      }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => {
      if (containerRef.current) {
        observer.unobserve(containerRef.current);
      }
    };
  }, []);

  // Handle video click (LinkedIn: click to mute/unmute)
  const handleVideoClick = () => {
    if (videoRef.current) {
      if (isMuted) {
        videoRef.current.muted = false;
        videoRef.current.volume = 0.5;
        setIsMuted(false);
        setVolume(0.5);
      } else {
        videoRef.current.muted = true;
        videoRef.current.volume = 0;
        setIsMuted(true);
        setVolume(0);
      }
    }
  };

  // Handle play/pause
  const handlePlayPause = (e) => {
    e.stopPropagation();
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
        setIsPlaying(false);
      } else {
        videoRef.current.play();
        setIsPlaying(true);
      }
    }
  };

  // Handle video ended
  const handleVideoEnded = () => {
    setIsPlaying(false);
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
    }
  };

  // Handle video play
  const handleVideoPlay = () => {
    setIsPlaying(true);
  };

  // Handle video pause
  const handleVideoPause = () => {
    setIsPlaying(false);
  };

  // Handle progress bar click
  const handleProgressClick = (e) => {
    e.stopPropagation();
    if (videoRef.current) {
      const rect = e.currentTarget.getBoundingClientRect();
      const percent = (e.clientX - rect.left) / rect.width;
      videoRef.current.currentTime = percent * videoRef.current.duration;
    }
  };

  // Handle volume change
  const handleVolumeChange = (e) => {
    e.stopPropagation();
    const newVolume = parseFloat(e.target.value);
    if (videoRef.current) {
      videoRef.current.volume = newVolume;
      videoRef.current.muted = newVolume === 0;
      setIsMuted(newVolume === 0);
      setVolume(newVolume);
    }
  };

  // Format time to MM:SS
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <div 
      className="linkedin-video-container"
      ref={containerRef}
      onMouseEnter={() => setShowControls(true)}
      onMouseLeave={() => setShowControls(false)}
    >
      <video
        ref={videoRef}
        className="linkedin-video"
        preload="metadata"
        muted={isMuted}
        loop
        playsInline
        onClick={handleVideoClick}
        onEnded={handleVideoEnded}
        onPlay={handleVideoPlay}
        onPause={handleVideoPause}
      >
        <source src={src} type={`${type}/${format}`} />
        Your browser does not support the video tag.
      </video>

      {/* LinkedIn-style Controls */}
      <div className={`video-controls ${showControls ? 'visible' : ''}`}>
        {/* Play/Pause Button - Using clean icons */}
        <button 
          className="control-btn play-pause-btn"
          onClick={handlePlayPause}
        >
          {isPlaying ? '❚❚' : '▶'}
        </button>

        {/* Progress Bar */}
        <div className="progress-container" onClick={handleProgressClick}>
          <div className="progress-track">
            <div 
              className="progress-played" 
              style={{ width: `${(currentTime / duration) * 100 || 0}%` }}
            />
            <div 
              className="progress-buffered" 
              style={{ width: '100%' }}
            />
          </div>
          <input
            type="range"
            className="progress-slider"
            min="0"
            max="100"
            value={(currentTime / duration) * 100 || 0}
            onChange={(e) => {
              if (videoRef.current) {
                const time = (e.target.value / 100) * videoRef.current.duration;
                videoRef.current.currentTime = time;
              }
            }}
          />
        </div>

        {/* Time Display */}
        <span className="time-display">
          {formatTime(currentTime)} / {formatTime(duration)}
        </span>

        {/* Mute/Unmute Button - Using clean icons */}
        <button 
          className="control-btn mute-btn"
          onClick={(e) => {
            e.stopPropagation();
            handleVideoClick();
          }}
        >
          {isMuted ? '🔇' : '🔊'}
        </button>

        {/* Volume Slider */}
        <input
          type="range"
          className="volume-slider"
          min="0"
          max="1"
          step="0.1"
          value={volume}
          onChange={handleVolumeChange}
        />
      </div>

      {/* Overlay when not playing */}
      {!isPlaying && (
        <div className="video-overlay" onClick={handlePlayPause}>
          <div className="play-button-large">
            <span className="play-icon">▶</span>
          </div>
        </div>
      )}

      {/* Mute indicator - subtle dot */}
      {isMuted && (
        <div className="mute-indicator">
          <span className="mute-icon">🔇</span>
        </div>
      )}
    </div>
  );
};

// Main MediaUploader Component
const MediaUploader = ({ 
  onFilesSelect, 
  onRemoveFile, 
  previews = [], 
  isUploading = false, 
  progress = 0 
}) => {
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState('');

  // File validation constants
  const FILE_LIMITS = {
    MAX_FILES: 10,
    MAX_IMAGE_SIZE: 10 * 1024 * 1024, // 10MB
    MAX_VIDEO_SIZE: 100 * 1024 * 1024, // 100MB
    ACCEPTED_TYPES: {
      images: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
      videos: ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/x-matroska']
    }
  };

  // Get all accepted MIME types
  const acceptedTypes = [
    ...FILE_LIMITS.ACCEPTED_TYPES.images,
    ...FILE_LIMITS.ACCEPTED_TYPES.videos
  ].join(',');

  const validateFiles = (files) => {
    const fileArray = Array.from(files);
    let totalSize = 0;
    
    // Check number of files
    if (previews.length + fileArray.length > FILE_LIMITS.MAX_FILES) {
      setError(`Maximum ${FILE_LIMITS.MAX_FILES} files allowed`);
      return false;
    }

    // Validate each file
    for (const file of fileArray) {
      // Check file type
      const isImage = FILE_LIMITS.ACCEPTED_TYPES.images.includes(file.type);
      const isVideo = FILE_LIMITS.ACCEPTED_TYPES.videos.includes(file.type);
      
      if (!isImage && !isVideo) {
        setError(`File type not supported: ${file.name}`);
        return false;
      }

      // Check file size
      if (isImage && file.size > FILE_LIMITS.MAX_IMAGE_SIZE) {
        setError(`Image ${file.name} is too large (max ${FILE_LIMITS.MAX_IMAGE_SIZE/1024/1024}MB)`);
        return false;
      }

      if (isVideo && file.size > FILE_LIMITS.MAX_VIDEO_SIZE) {
        setError(`Video ${file.name} is too large (max ${FILE_LIMITS.MAX_VIDEO_SIZE/1024/1024}MB)`);
        return false;
      }

      totalSize += file.size;
    }

    // Check total size (optional)
    if (totalSize > 500 * 1024 * 1024) { // 500MB total limit
      setError('Total files size exceeds 500MB limit');
      return false;
    }

    setError('');
    return true;
  };

  const handleFileSelect = (e) => {
    const files = e.target.files;
    if (!files.length) return;

    if (validateFiles(files)) {
      onFilesSelect(files);
      e.target.value = ''; // Reset input
    }
  };

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    
    const files = e.dataTransfer.files;
    if (files.length && validateFiles(files)) {
      onFilesSelect(files);
    }
  }, [onFilesSelect]);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
  }, []);

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="media-uploader-container">
      {/* Upload Zone */}
      <div 
        className={`upload-zone ${dragOver ? 'drag-over' : ''} ${isUploading ? 'uploading' : ''}`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        <input
          type="file"
          id="media-upload"
          multiple
          accept={acceptedTypes}
          onChange={handleFileSelect}
          style={{ display: 'none' }}
          disabled={isUploading}
        />
        
        <label htmlFor="media-upload" className="upload-label">
          <div className="upload-icon">
            {isUploading ? '⏳' : '📁'}
          </div>
          <div className="upload-text">
            {isUploading ? (
              <div className="upload-progress">
                <div className="progress-bar">
                  <div 
                    className="progress-fill" 
                    style={{ width: `${progress}%` }}
                  ></div>
                </div>
                <span>{progress}% Uploading...</span>
              </div>
            ) : (
              <>
                <h3>📸 Add Photos & Videos</h3>
                <p>Drag & drop or click to browse</p>
                <p className="upload-hint">
                  Supports: JPG, PNG, GIF, WebP, MP4, MOV, AVI
                </p>
                <p className="upload-limits">
                  📏 Max: 10 files • 🖼️ 10MB/image • 🎥 100MB/video
                </p>
              </>
            )}
          </div>
        </label>
      </div>

      {/* Error Message */}
      {error && (
        <div className="upload-error">
          ⚠️ {error}
          <button onClick={() => setError('')}>×</button>
        </div>
      )}

      {/* Preview Grid */}
      {previews.length > 0 && (
        <div className="preview-grid">
          <div className="preview-header">
            <h4>Selected Media ({previews.length}/{FILE_LIMITS.MAX_FILES})</h4>
            <button 
              className="clear-all-btn"
              onClick={() => {
                previews.forEach((_, index) => onRemoveFile(index));
              }}
              disabled={isUploading}
            >
              Clear All
            </button>
          </div>
          
          <div className="preview-items">
            {previews.map((preview, index) => (
              <div key={index} className="preview-item">
                <div className="preview-content">
                  {preview.type === 'image' ? (
                    <img 
                      src={preview.url} 
                      alt={`Preview ${index + 1}`}
                      className="preview-image"
                    />
                  ) : (
                    <div className="preview-video">
                      <LinkedInVideoPlayer 
                        src={preview.url}
                        format={preview.name?.split('.').pop() || 'mp4'}
                      />
                    </div>
                  )}
                  
                  <div className="preview-info">
                    <span className="file-name">
                      {preview.name?.substring(0, 15)}...
                    </span>
                    <span className="file-size">
                      {formatFileSize(preview.size)}
                    </span>
                  </div>
                </div>
                
                <button
                  className="remove-preview-btn"
                  onClick={() => onRemoveFile(index)}
                  disabled={isUploading}
                  title="Remove"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// Export both components
export { LinkedInVideoPlayer };
export default MediaUploader;