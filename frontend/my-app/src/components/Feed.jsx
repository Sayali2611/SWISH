import { useState, useEffect, useRef, useCallback } from "react";
import VideoPlayer from "../components/VideoPlayer";
import { useNavigate, useLocation } from "react-router-dom";
import "../styles/Feed.css";
// Import her notification components
import { getSocket } from "../components/NotificationBell";
import Toast from "../components/Toast";
import "../styles/Notifications.css";

/* --------------------
   ADDED: Search imports
   -------------------- */
import ExploreSearch from "../components/ExploreSearch";
import "../styles/ExploreSearch.css";

function Feed() {
  const [posts, setPosts] = useState([]);
  const [newPost, setNewPost] = useState("");
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [commentTexts, setCommentTexts] = useState({});
  const [commentLoading, setCommentLoading] = useState({});
  const [activeCommentSection, setActiveCommentSection] = useState(null);
  
  // Her notification states
  const [notifCount, setNotifCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  const [toastData, setToastData] = useState(null);
  
  // NEW: State for highlighted post from search
  const [highlightedPostId, setHighlightedPostId] = useState(null);
  const [searchPostData, setSearchPostData] = useState(null);
  const [isProcessingHighlight, setIsProcessingHighlight] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  
  // NEW: Media upload states
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [mediaPreviews, setMediaPreviews] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [showMediaUploader, setShowMediaUploader] = useState(false);
  
  // NEW: Event and Poll states
  const [postType, setPostType] = useState('text'); // 'text', 'event', 'poll'
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
  
  // NEW: Event RSVP and Poll voting states
  const [rsvpLoading, setRsvpLoading] = useState({});
  const [voteLoading, setVoteLoading] = useState({});
  
  const navigate = useNavigate();
  const location = useLocation();
  const hasCheckedHighlightRef = useRef(false);
  const isProcessingRef = useRef(false); // NEW: Track if we're currently processing
  const fileInputRef = useRef(null);
  const highlightTimeoutRef = useRef(null); // NEW: Timeout reference
  const lastHighlightTimeRef = useRef(0); // NEW: Track last highlight time

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

  // Listen for custom events from ExploreSearch - FIXED VERSION
  useEffect(() => {
    console.log("🎯 [Feed] Setting up event listeners");
    
    // Event listener for custom feedHighlight event
    const handleFeedHighlight = () => {
      // Prevent rapid consecutive highlights (debounce)
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
      
      // Clear any existing timeout
      if (highlightTimeoutRef.current) {
        clearTimeout(highlightTimeoutRef.current);
      }
      
      // Process highlight after a short delay
      highlightTimeoutRef.current = setTimeout(() => {
        fetchPosts(true); // Force refresh with highlight processing
      }, 100);
    };

    // Event listener for storage events (debounced)
    const handleStorageChange = (e) => {
      if (e.key === 'searchHighlightedPost' && e.newValue) {
        const now = Date.now();
        if (now - lastHighlightTimeRef.current > 1000) {
          console.log("📡 [Feed] Storage event detected!");
          handleFeedHighlight();
        }
      }
    };

    // Register event listeners
    window.addEventListener('feedHighlight', handleFeedHighlight);
    window.addEventListener('storage', handleStorageChange);

    // Make refresh function available globally
    window.triggerFeedHighlight = () => {
      console.log("🎯 [Feed] Global triggerFeedHighlight() called");
      handleFeedHighlight();
    };

    // Make manual refresh function available globally
    window.refreshFeedPosts = () => {
      console.log("🔄 [Feed] Global refreshFeedPosts() called");
      setRefreshTrigger(prev => prev + 1);
    };

    return () => {
      // Clean up event listeners
      window.removeEventListener('feedHighlight', handleFeedHighlight);
      window.removeEventListener('storage', handleStorageChange);
      
      // Clean up global functions
      delete window.triggerFeedHighlight;
      delete window.refreshFeedPosts;
      
      // Clear timeout
      if (highlightTimeoutRef.current) {
        clearTimeout(highlightTimeoutRef.current);
      }
    };
  }, []);

  // Combined scroll and highlight function - FIXED VERSION
  const scrollAndHighlightPost = useCallback((postId) => {
    if (!postId || isProcessingRef.current) {
      console.log("⏭️ [Feed] No post ID or already processing");
      return;
    }
    
    console.log("🎯 [Feed] Attempting to scroll and highlight post:", postId);
    
    isProcessingRef.current = true;
    const elementId = `post-${postId}`;
    
    // Clear any existing timeout
    if (highlightTimeoutRef.current) {
      clearTimeout(highlightTimeoutRef.current);
    }
    
    // Try after a short delay to ensure DOM is ready
    highlightTimeoutRef.current = setTimeout(() => {
      const element = document.getElementById(elementId);
      console.log("🔍 [Feed] Element found?", !!element);
      
      if (element) {
        console.log("✅ [Feed] Found element! Scrolling and highlighting...");
        
        // Add highlight styles
        element.style.border = '3px solid #007bff';
        element.style.backgroundColor = '#f0f8ff';
        element.style.boxShadow = '0 0 20px rgba(0, 123, 255, 0.3)';
        element.style.transition = 'all 0.3s ease';
        
        // Scroll to element
        element.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'center'
        });
        
        // Remove highlight after 4 seconds
        setTimeout(() => {
          element.style.boxShadow = '0 0 10px rgba(0, 123, 255, 0.1)';
          setTimeout(() => {
            element.style.border = '';
            element.style.backgroundColor = '';
            element.style.boxShadow = '';
            setIsProcessingHighlight(false);
            isProcessingRef.current = false;
            hasCheckedHighlightRef.current = true;
            console.log("✅ [Feed] Highlight complete and cleanup done");
          }, 2000);
        }, 4000);
        
        return;
      }
      
      // If not found, try one more time after a longer delay
      console.log("⏳ [Feed] Element not found, retrying...");
      highlightTimeoutRef.current = setTimeout(() => {
        const retryElement = document.getElementById(elementId);
        if (retryElement) {
          console.log("✅ [Feed] Found element on retry!");
          
          retryElement.style.border = '3px solid #007bff';
          retryElement.style.backgroundColor = '#f0f8ff';
          retryElement.style.boxShadow = '0 0 20px rgba(0, 123, 255, 0.3)';
          retryElement.style.transition = 'all 0.3s ease';
          
          retryElement.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'center'
          });
          
          setTimeout(() => {
            retryElement.style.boxShadow = '0 0 10px rgba(0, 123, 255, 0.1)';
            setTimeout(() => {
              retryElement.style.border = '';
              retryElement.style.backgroundColor = '';
              retryElement.style.boxShadow = '';
              setIsProcessingHighlight(false);
              isProcessingRef.current = false;
              hasCheckedHighlightRef.current = true;
              console.log("✅ [Feed] Highlight complete on retry");
            }, 2000);
          }, 4000);
        } else {
          console.log("❌ [Feed] Element not found after retry");
          setIsProcessingHighlight(false);
          isProcessingRef.current = false;
        }
      }, 500);
    }, 300);
  }, [setIsProcessingHighlight]);

  // Fetch posts with highlighted post handling - FIXED VERSION
  const fetchPosts = useCallback(async (forceHighlight = false) => {
    // Prevent multiple concurrent fetches
    if (isProcessingRef.current && !forceHighlight) {
      console.log("⏸️ [Feed] Already processing, skipping fetch");
      return;
    }
    
    try {
      isProcessingRef.current = true;
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:5000/api/posts', {
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
      
      // Check for highlighted post in localStorage
      const highlightData = localStorage.getItem('searchHighlightedPost');
      let postIdToHighlight = null;
      let highlightDataObj = null;
      
      if (highlightData && !hasCheckedHighlightRef.current) {
        try {
          highlightDataObj = JSON.parse(highlightData);
          console.log("✅ [Feed] Found highlighted post data:", {
            postId: highlightDataObj.postId,
            from: highlightDataObj.from || 'unknown',
            timestamp: new Date(highlightDataObj.timestamp).toLocaleTimeString()
          });
          
          // Check if data is recent (within 15 seconds) and not already processed
          if (highlightDataObj.postId && Date.now() - highlightDataObj.timestamp < 15000) {
            postIdToHighlight = highlightDataObj.postId;
            console.log("🎯 [Feed] Post is recent, will highlight it");
          } else {
            console.log("⏰ [Feed] Highlighted post data too old or already processed");
            localStorage.removeItem('searchHighlightedPost');
          }
        } catch (error) {
          console.error("❌ [Feed] Error parsing highlighted post:", error);
          localStorage.removeItem('searchHighlightedPost');
        }
      }
      
      if (postIdToHighlight) {
        setIsProcessingHighlight(true);
        hasCheckedHighlightRef.current = true;
        console.log("🎯 [Feed] Looking for post with ID:", postIdToHighlight);
        
        const highlightedIndex = data.findIndex(post => post._id === postIdToHighlight);
        
        if (highlightedIndex > -1) {
          console.log("✅ [Feed] Found highlighted post at index:", highlightedIndex);
          
          // Reorder posts: highlighted post goes to top
          const newPosts = [...data];
          const [highlightedPost] = newPosts.splice(highlightedIndex, 1);
          newPosts.unshift(highlightedPost);
          
          console.log("📊 [Feed] New order - First post ID:", newPosts[0]?._id);
          console.log("📊 [Feed] Target ID:", postIdToHighlight);
          console.log("📊 [Feed] Match?", newPosts[0]?._id === postIdToHighlight ? "✅ YES" : "❌ NO");
          
          // Set the highlighted post ID and data
          setHighlightedPostId(postIdToHighlight);
          setSearchPostData(highlightDataObj);
          
          // Set posts with highlighted post at top
          setPosts(newPosts);
          
          // Clear the localStorage since we've processed it
          localStorage.removeItem('searchHighlightedPost');
          sessionStorage.removeItem('highlightedPostId');
          console.log("🗑️ [Feed] Cleared highlighted post from storage");
          
          // Schedule scroll and highlight after render
          setTimeout(() => {
            scrollAndHighlightPost(postIdToHighlight);
          }, 200);
          
        } else {
          console.log("❌ [Feed] Highlighted post not found in fetched data");
          setPosts(data);
          setIsProcessingHighlight(false);
          isProcessingRef.current = false;
          hasCheckedHighlightRef.current = true;
        }
      } else {
        console.log("📭 [Feed] No highlighted post to process, setting normal order");
        setPosts(data);
        isProcessingRef.current = false;
      }
      
    } catch (error) {
      setError('Failed to fetch posts');
      console.error('Error fetching posts:', error);
      setIsProcessingHighlight(false);
      isProcessingRef.current = false;
    }
  }, [navigate, scrollAndHighlightPost, setError, setIsProcessingHighlight, setPosts, setHighlightedPostId, setSearchPostData]);

  // Main initialization effect - runs on mount AND when refreshTrigger changes
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
    
    // Reset processing state
    isProcessingRef.current = false;
    
    // Fetch posts
    fetchPosts();

    // --- SOCKET/NOTIFICATION LOGIC ---
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
  }, [navigate, refreshTrigger, fetchPosts]);

  // Also check URL for highlight parameters
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const highlightId = params.get('highlight');
    
    if (highlightId && !hasCheckedHighlightRef.current) {
      console.log("🔗 [Feed] Found highlight ID in URL:", highlightId);
      
      // Store in localStorage
      const highlightData = {
        postId: highlightId,
        timestamp: Date.now(),
        from: 'url'
      };
      localStorage.setItem('searchHighlightedPost', JSON.stringify(highlightData));
      
      // Trigger processing
      fetchPosts(true);
    }
  }, [location, fetchPosts]);

  // Add a useEffect to handle scroll when posts are set - FIXED VERSION
  useEffect(() => {
    if (highlightedPostId && posts.length > 0 && isProcessingHighlight) {
      console.log("🔄 [Feed] Posts updated, attempting to highlight:", highlightedPostId);
      
      // Find if the highlighted post is at the top
      const isAtTop = posts[0]?._id === highlightedPostId;
      console.log("📊 [Feed] Is highlighted post at top?", isAtTop ? "✅ YES" : "❌ NO");
      
      if (isAtTop) {
        // Clear any existing timeout
        if (highlightTimeoutRef.current) {
          clearTimeout(highlightTimeoutRef.current);
        }
        
        // Small delay to ensure DOM is updated
        highlightTimeoutRef.current = setTimeout(() => {
          scrollAndHighlightPost(highlightedPostId);
        }, 300);
      }
    }
  }, [posts, highlightedPostId, isProcessingHighlight, scrollAndHighlightPost]);

  // ==================== MEDIA UPLOAD FUNCTIONS ====================

  // Handle file selection
  const handleFileSelect = (e) => {
    const files = e.target.files;
    if (!files.length) return;

    const fileArray = Array.from(files);
    
    // Create preview URLs
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

  // Remove a file
  const handleRemoveFile = (index) => {
    // Revoke object URL to prevent memory leak
    if (mediaPreviews[index]?.url) {
      URL.revokeObjectURL(mediaPreviews[index].url);
    }
    
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
    setMediaPreviews(prev => prev.filter((_, i) => i !== index));
    
    if (mediaPreviews.length <= 1) {
      setShowMediaUploader(false);
    }
  };

  // Toggle media uploader
  const toggleMediaUploader = () => {
    setShowMediaUploader(!showMediaUploader);
  };

  // ==================== EVENT AND POLL FUNCTIONS ====================

  // Handle event input changes
  const handleEventChange = (field, value) => {
    setEventData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Handle poll input changes
  const handlePollChange = (field, value) => {
    setPollData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Handle poll option changes
  const handlePollOptionChange = (index, value) => {
    const newOptions = [...pollData.options];
    newOptions[index] = value;
    setPollData(prev => ({
      ...prev,
      options: newOptions
    }));
  };

  // Add new poll option
  const addPollOption = () => {
    if (pollData.options.length < 6) {
      setPollData(prev => ({
        ...prev,
        options: [...prev.options, '']
      }));
    }
  };

  // Remove poll option
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

  // Handle post creation with media - FIXED VERSION
  const handleCreatePost = async () => {
    console.log("🚀 [Feed] Post button clicked!");
    console.log("📝 Post content:", newPost);
    console.log("📋 Post type:", postType);
    console.log("📁 Selected files:", selectedFiles.length);
    console.log("👤 User:", user?.name);
    
    // Prepare post data
    let postData = { content: newPost.trim() };
    
    // Validate based on post type
    if (postType === 'event') {
      // Validate event data
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
      // Validate poll data
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
          options: validOptions, // Send just the string options
        }
      };
    }

    // Validate content for text posts only
    if (postType === 'text' && !postData.content.trim() && selectedFiles.length === 0) {
      setError('Post content or media is required for text posts');
      return;
    }

    // For event posts, content can be empty
    if (postType === 'event' && !postData.content.trim() && selectedFiles.length === 0) {
      // Allow empty content for events if no media
      postData.content = `Event: ${eventData.title}`;
    }

    // For poll posts, content can be empty
    if (postType === 'poll' && !postData.content.trim() && selectedFiles.length === 0) {
      // Allow empty content for polls if no media
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
        
        // Append all selected files
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
        // Text/Event/Poll post without media
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

  // Handle successful post creation
  const handlePostSuccess = (data) => {
    // Clear everything
    setNewPost("");
    setSelectedFiles([]);
    setMediaPreviews([]);
    setShowMediaUploader(false);
    
    // Clear event and poll forms
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
    
    // Reset to text post type
    setPostType('text');
    
    // Add new post to feed
    const newPostData = data.post || data;
    console.log("🎉 New post data to add:", newPostData);
    
    setPosts(prevPosts => [newPostData, ...prevPosts]);
    setSuccess('✅ Post created successfully!');
    setTimeout(() => setSuccess(""), 3000);
    
    console.log("🔄 Posts updated, new post count:", posts.length + 1);
  };

  // ==================== POST INTERACTIONS ====================

  // Handle event RSVP
  const handleEventRSVP = async (postId, status) => {
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

  // Handle poll voting
  const handlePollVote = async (postId, optionIndex) => {
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
      }
    } catch (error) {
      setError('Failed to like post');
    }
  };

  const handleAddComment = async (postId) => {
    const text = commentTexts[postId];
    if (!text?.trim() || !user) return;

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
          content: text
        })
      });

      const data = await response.json();

      if (response.ok) {
        setCommentTexts(prev => ({ ...prev, [postId]: "" }));
        setPosts(prevPosts => 
          prevPosts.map(post => 
            post._id === postId ? data.post : post
          )
        );
        setSuccess('Comment added successfully!');
        setTimeout(() => setSuccess(""), 2000);
      } else {
        setError('Failed to add comment');
      }
    } catch (error) {
      setError('Network error: Unable to add comment');
    } finally {
      setCommentLoading(prev => ({ ...prev, [postId]: false }));
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
    const reason = prompt("Please provide reason for reporting this post (harassment, spam, inappropriate content, etc.):");
    
    if (!reason || !reason.trim()) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:5000/api/posts/${postId}/report`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ reason })
      });

      const data = await response.json();
      
      if (response.ok) {
        setSuccess('✅ Post reported successfully! Admin will review it.');
        setTimeout(() => setSuccess(""), 3000);
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
    return post.likes?.includes(user?.id);
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

  // Render media grid with LinkedIn-style video player
  const renderMediaGrid = (media) => {
    if (!media || media.length === 0) return null;
    
    const count = media.length;
    
    return (
      <div className={`post-media-grid count-${count}`}>
        {media.map((mediaItem, index) => (
          <div key={index} className={`media-item ${count === 1 ? 'single' : 'multiple'}`}>
            {mediaItem.type === 'image' ? (
              <img 
                src={mediaItem.url} 
                alt={`Post media ${index + 1}`}
                className="post-media"
                loading="lazy"
              />
            ) : (
              <div className="video-container-linkedin">
                <VideoPlayer 
                  src={mediaItem.url}
                  format={mediaItem.format}
                  type={mediaItem.type}
                />
              </div>
            )}
          </div>
        ))}
      </div>
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
    <div className="feed-container">
      {/* Header */}
      <header className="feed-header">
        <div className="header-left">
          <div className="logo" onClick={() => navigate("/feed")}>💼 CampusConnect</div>
          
          {/* SEARCH BAR */}
          <div className="feed-search-wrapper">
             <ExploreSearch onUserSelect={handleUserSelectFromSearch} />
          </div>

          <div className="nav-items">
            <button className="nav-btn active">🏠 Feed</button>
            <button className="nav-btn" onClick={() => navigate("/profile")}>👤 Profile</button>
            <button className="nav-btn" onClick={() => navigate("/network")}>👥 Network</button>
            
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
                const isHighlighted = post._id === highlightedPostId;
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
                      
                      {/* Display Media */}
                      {post.media && post.media.length > 0 && renderMediaGrid(post.media)}
                      
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
                        👍 {post.likes?.length || 0}
                      </span>
                      <span className="stat-item">
                        💬 {post.comments?.length || 0}
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
                        {isPostLiked(post) ? '👍 Liked' : '🤍 Like'}
                      </button>
                      <button 
                        className={`action-btn comment-btn ${activeCommentSection === post._id ? 'active' : ''}`}
                        onClick={() => toggleCommentSection(post._id)}
                      >
                        💬 Comment
                      </button>
                      <button className="action-btn share-btn">
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

                    {/* Comments Section */}
                    {activeCommentSection === post._id && (
                      <div className="comments-section">
                        {/* Display Existing Comments */}
                        {post.comments && post.comments.length > 0 && (
                          <div className="comments-list">
                            <h4>Comments ({post.comments.length})</h4>
                            {post.comments.map((comment, index) => (
                              <div key={index} className="comment-item">
                                <div className="comment-avatar">
                                  {comment.userName?.charAt(0).toUpperCase() || "U"}
                                </div>
                                <div className="comment-content">
                                  <div className="comment-header">
                                    <span className="comment-author">{comment.userName}</span>
                                    <span className="comment-time">
                                      {new Date(comment.timestamp).toLocaleDateString()}
                                    </span>
                                  </div>
                                  <p className="comment-text">{comment.content}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Add Comment */}
                        <div className="add-comment">
                          <div className="comment-avatar-small">
                            {getUserAvatar(user)}
                          </div>
                          <input 
                            type="text" 
                            placeholder="Write a comment..." 
                            className="comment-input"
                            value={commentTexts[post._id] || ""}
                            onChange={(e) => handleCommentChange(post._id, e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && handleAddComment(post._id)}
                          />
                          <button 
                            className="comment-submit-btn"
                            onClick={() => handleAddComment(post._id)}
                            disabled={commentLoading[post._id] || !commentTexts[post._id]?.trim()}
                          >
                            {commentLoading[post._id] ? '...' : 'Post'}
                          </button>
                        </div>
                      </div>
                    )}
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