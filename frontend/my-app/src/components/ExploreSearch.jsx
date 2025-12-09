import React, { useState, useEffect, useRef, useCallback } from 'react';
import { debounce } from 'lodash';
import { IoSearchOutline, IoCloseOutline } from 'react-icons/io5';
import { useNavigate } from 'react-router-dom';

const SEARCH_HISTORY_KEY = 'campusConnectSearchHistory';
const MAX_HISTORY = 10;

// Helper function to get initials for avatar
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

// --- ExploreSearch Component ---
const ExploreSearch = ({ onUserSelect }) => {
    const [query, setQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [history, setHistory] = useState([]);
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [searchType, setSearchType] = useState('users'); // 'users' or 'posts'
    const [searchError, setSearchError] = useState('');

    const wrapperRef = useRef(null);
    const token = localStorage.getItem('token');
    const navigate = useNavigate();

    // 1. Load History on Mount
    useEffect(() => {
        const storedHistory = localStorage.getItem(SEARCH_HISTORY_KEY);
        if (storedHistory) {
            setHistory(JSON.parse(storedHistory));
        }
    }, []);

    // 2. Click Outside to Close Dropdown
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
                setDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    // 3. Search API Call (Debounced) - UPDATED with DEBUGGING
    const fetchResults = useCallback(debounce(async (value, type) => {
        console.log("🔍 fetchResults called with:", { value, type });
        
        if (value.length < 2) {
            setSearchResults([]);
            setLoading(false);
            setSearchError('');
            return;
        }

        setLoading(true);
        setSearchError('');
        
        try {
            let response;
            let data;
            
            if (type === 'users') {
                // User search
                const url = `http://localhost:5000/api/users/search?name=${encodeURIComponent(value)}`;
                
                console.log("📡 Making user search request to:", url);
                console.log("📝 Search query:", value);
                console.log("🔑 Token exists:", !!token);
                console.log("🔑 Token preview:", token ? `${token.substring(0, 20)}...` : 'No token');
                
                response = await fetch(url, {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Accept': 'application/json',
                        'Content-Type': 'application/json'
                    }
                });
                
                console.log("📡 Response status:", response.status);
                console.log("📡 Response status text:", response.statusText);
                
                // Handle different response statuses
                if (!response.ok) {
                    let errorMessage = '';
                    
                    // Try to parse JSON error first
                    try {
                        const errorData = await response.json();
                        console.log("❌ Error data:", errorData);
                        errorMessage = errorData.message || errorData.error || `Server error (${response.status})`;
                    } catch (jsonError) {
                        console.log("❌ Could not parse error as JSON:", jsonError);
                        // If not JSON, use status text
                        const responseText = await response.text();
                        console.log("❌ Raw response text:", responseText);
                        errorMessage = `Server error: ${response.status} ${response.statusText}`;
                    }
                    
                    throw new Error(errorMessage);
                }
                
                data = await response.json();
                console.log("✅ User search results data:", data);
                
                // Ensure data is an array
                if (!Array.isArray(data)) {
                    console.warn("⚠️ Search response is not an array:", data);
                    data = [];
                }
                
                // Add type to each result
                data = data.map(user => ({ ...user, type: 'user' }));
                
            } else {
                // Post search - FIXED: Remove # from query if present
                let searchQuery = value;
                
                // Remove # symbol if user typed it
                if (searchQuery.startsWith('#')) {
                    searchQuery = searchQuery.substring(1);
                }
                
                const url = `http://localhost:5000/api/posts/search?q=${encodeURIComponent(searchQuery)}`;
                
                console.log("🔍 Making post search request to:", url);
                console.log("📝 Post search query:", searchQuery);
                console.log("🔑 Token exists:", !!token);
                
                response = await fetch(url, {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Accept': 'application/json',
                        'Content-Type': 'application/json'
                    }
                });
                
                console.log("📡 Post response status:", response.status);
                console.log("📡 Post response status text:", response.statusText);
                
                if (!response.ok) {
                    let errorMessage = '';
                    try {
                        const errorData = await response.json();
                        console.log("❌ Post error data:", errorData);
                        errorMessage = errorData.message || errorData.error || `Server error (${response.status})`;
                    } catch (jsonError) {
                        console.log("❌ Could not parse error as JSON:", jsonError);
                        const responseText = await response.text();
                        console.log("❌ Raw post response text:", responseText);
                        errorMessage = `Server error: ${response.status} ${response.statusText}`;
                    }
                    throw new Error(errorMessage);
                }
                
                const result = await response.json();
                console.log("✅ Post search results:", result);
                
                // Handle different response formats
                if (result.results && Array.isArray(result.results)) {
                    data = result.results.map(post => ({ 
                        ...post, 
                        type: 'post',
                        // Ensure user object exists
                        user: post.user || {
                            id: 'unknown',
                            name: "Unknown User",
                            profilePhoto: null,
                            role: 'user',
                            department: ''
                        }
                    }));
                } else if (Array.isArray(result)) {
                    data = result.map(post => ({ 
                        ...post, 
                        type: 'post',
                        // Ensure user object exists
                        user: post.user || {
                            id: 'unknown',
                            name: "Unknown User",
                            profilePhoto: null,
                            role: 'user',
                            department: ''
                        }
                    }));
                } else {
                    data = [];
                }
            }
            
            setSearchResults(data);
            setSearchError('');
            
        } catch (error) {
            console.error('🔥 Search error details:', error);
            console.error('🔥 Error stack:', error.stack);
            
            // Provide user-friendly error messages
            let userErrorMessage = 'Search failed. ';
            
            if (error.message.includes('401') || error.message.includes('unauthorized')) {
                userErrorMessage += 'Please login again.';
            } else if (error.message.includes('500')) {
                userErrorMessage += 'Server error. Please try again later.';
            } else if (error.message.includes('Network Error') || error.message.includes('Failed to fetch')) {
                userErrorMessage += 'Network error. Check your connection.';
            } else {
                userErrorMessage += error.message;
            }
            
            setSearchError(userErrorMessage);
            setSearchResults([]);
        } finally {
            setLoading(false);
        }
    }, 500), [token]);

    // 4. Input Change Handler - FIXED: Better search type detection
    const handleSearchChange = (event) => {
        const value = event.target.value;
        console.log("⌨️ Input changed to:", value);
        setQuery(value);
        setDropdownOpen(true);
        
        // Determine search type based on query
        let newSearchType = 'users';
        
        // If query starts with # OR contains keywords like "post", search posts
        if (value.startsWith('#') || 
            value.toLowerCase().includes('post') || 
            value.toLowerCase().includes('blog') ||
            value.toLowerCase().includes('content') ||
            value.toLowerCase().includes('status') ||
            value.toLowerCase().includes('update')) {
            newSearchType = 'posts';
        }
        
        console.log("🔍 Search type set to:", newSearchType);
        setSearchType(newSearchType);
        fetchResults(value, newSearchType);
    };

    // 5. History Management Functions
    const saveToHistory = (searchTerm) => {
        if (!searchTerm.trim()) return;

        let updatedHistory = history.filter(item => item.toLowerCase() !== searchTerm.toLowerCase());
        updatedHistory.unshift(searchTerm);
        updatedHistory = updatedHistory.slice(0, MAX_HISTORY);
        
        setHistory(updatedHistory);
        localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(updatedHistory));
    };

    const deleteHistoryItem = (itemToDelete) => {
        const updatedHistory = history.filter(item => item !== itemToDelete);
        setHistory(updatedHistory);
        localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(updatedHistory));
    };

    const clearHistory = () => {
        setHistory([]);
        localStorage.removeItem(SEARCH_HISTORY_KEY);
    };

    // 6. Click Handler for History Item
    const handleHistoryClick = (term) => {
        console.log("📚 History item clicked:", term);
        setQuery(term);
        setDropdownOpen(true);
        // Determine search type for history click
        let newSearchType = 'users';
        if (term.startsWith('#') || term.toLowerCase().includes('post')) {
            newSearchType = 'posts';
        }
        setSearchType(newSearchType);
        fetchResults(term, newSearchType);
    };

    // 7. Click Handler for User Result - FIXED: Proper navigation
    const handleUserClick = (user) => {
        console.log("👤 User clicked:", user.name, "ID:", user._id);
        saveToHistory(query);
        
        // ✅ Navigate to user profile page using the user's ID
        if (user._id) {
            navigate(`/profile/${user._id}`);
        } else if (user.id) {
            navigate(`/profile/${user.id}`);
        } else {
            console.error("❌ No user ID found:", user);
            alert("Cannot navigate: User ID not found");
        }
        
        // ✅ Also call the prop function if it exists
        if (onUserSelect) {
            onUserSelect(user);
        }
        
        setDropdownOpen(false);
    };

    // 8. Click Handler for Post Result - FIXED: Store in localStorage for Feed to read
    const handlePostClick = (post) => {
        console.log("📝 Post clicked:", post._id);
        
        saveToHistory(query);
        
        // Store post data for highlighting
        const postHighlightData = {
            postId: post._id,
            postContent: post.content,
            postUser: post.user?.name || "Unknown User",
            timestamp: Date.now(),
            searchQuery: query
        };
        
        // DEBUG: Check what's being stored
        console.log("🔍 DEBUG - Storing post data to localStorage:");
        console.log("  Post ID:", post._id);
        console.log("  Post Content:", post.content?.substring(0, 50));
        console.log("  User:", post.user?.name);
        console.log("  Search Query:", query);
        
        // Store in localStorage (will be read by Feed component)
        localStorage.setItem('searchHighlightedPost', JSON.stringify(postHighlightData));
        console.log("✅ Stored to localStorage as 'searchHighlightedPost'");
        
        // Also store in sessionStorage for immediate access
        sessionStorage.setItem('highlightedPostId', post._id);
        console.log("✅ Also stored to sessionStorage as 'highlightedPostId'");
        
        // Navigate to feed WITH query parameter
        navigate(`/feed?highlight=${post._id}&from=search&t=${Date.now()}`);
        
        setDropdownOpen(false);
        
        // 🔥 IMPORTANT: Trigger multiple events to ensure Feed catches it
        setTimeout(() => {
            // Method 1: Dispatch storage event (for storage event listeners)
            try {
                window.dispatchEvent(new StorageEvent('storage', {
                    key: 'searchHighlightedPost',
                    newValue: JSON.stringify(postHighlightData),
                    oldValue: null,
                    url: window.location.href
                }));
            } catch (e) {
                // Some browsers don't allow creating StorageEvent directly
                const event = new Event('storage');
                event.key = 'searchHighlightedPost';
                event.newValue = JSON.stringify(postHighlightData);
                window.dispatchEvent(event);
            }
            
            // Method 2: Dispatch custom feedHighlight event
            window.dispatchEvent(new CustomEvent('feedHighlight', {
                detail: { postId: post._id }
            }));
            
            // Method 3: Call global function if exists
            if (window.triggerFeedHighlight) {
                console.log("🎯 Calling window.triggerFeedHighlight()");
                window.triggerFeedHighlight();
            }
            
            // Method 4: Force a refresh via global function
            if (window.refreshFeedPosts) {
                console.log("🔄 Calling window.refreshFeedPosts()");
                window.refreshFeedPosts();
            }
            
            console.log("🎯 All highlight triggers dispatched");
        }, 200); // Increased delay to ensure navigation completes
    };

    // 9. Get search result content - FIXED: Better post display
    const renderSearchResult = (item) => {
        if (item.type === 'user') {
            return (
                <div 
                    key={item._id || item.id} 
                    className="result-item user-result" 
                    onClick={() => handleUserClick(item)}
                >
                    <div className="result-avatar">
                        {getUserAvatar(item)}
                    </div>
                    <div className="result-details">
                        <span className="result-name">{item.name || 'Unknown User'}</span>
                        <span className="result-email">{item.email || ''}</span>
                        {item.department && (
                            <span className="result-department">🏛️ {item.department}</span>
                        )}
                        <span className="result-type">👤 User</span>
                    </div>
                </div>
            );
        } else if (item.type === 'post') {
            const user = item.user || {};
            return (
                <div 
                    key={item._id} 
                    className="result-item post-result" 
                    onClick={() => handlePostClick(item)}
                >
                    <div className="post-avatar">
                        {getUserAvatar(user)}
                    </div>
                    <div className="post-details">
                        <div className="post-header">
                            <span className="post-author">{user.name || "Unknown User"}</span>
                            <span className="post-type">📝 Post</span>
                        </div>
                        <p className="post-content-preview">
                            {item.content && item.content.length > 100 
                                ? `${item.content.substring(0, 100)}...` 
                                : item.content || 'No content'}
                        </p>
                        <div className="post-stats-preview">
                            <span>👍 {item.likes?.length || 0}</span>
                            <span>💬 {item.comments?.length || 0}</span>
                            <span className="post-time">
                                {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : ''}
                            </span>
                        </div>
                    </div>
                </div>
            );
        }
        return null;
    };

    // Determine what content to show in the dropdown
    const getDropdownContent = () => {
        if (loading) {
            return (
                <div className="dropdown-status-message">
                    <span className="search-spinner"></span> Searching for "{query}"...
                </div>
            );
        }

        if (searchError) {
            return (
                <div className="dropdown-error-message">
                    ⚠️ {searchError}
                    <div className="error-tips">
                        <small>• Check your internet connection</small><br/>
                        <small>• Make sure you're logged in</small><br/>
                        <small>• Try again in a moment</small>
                    </div>
                </div>
            );
        }

        if (query.trim().length > 1) {
            // --- Show Live Results ---
            if (searchResults.length > 0) {
                return (
                    <>
                        <div className="search-type-indicator">
                            Searching in: <strong>{searchType === 'users' ? '👥 Users' : '📝 Posts'}</strong>
                            <small style={{marginLeft: '10px', opacity: 0.7}}>
                                ({searchResults.length} results)
                            </small>
                        </div>
                        {searchResults.map(renderSearchResult)}
                    </>
                );
            } else {
                return (
                    <div className="dropdown-status-message">
                        No {searchType === 'users' ? 'users' : 'posts'} found for "{query}".
                        <div className="search-tips">
                            <small>• Try different keywords</small><br/>
                            <small>• Use # to search posts (e.g., #DSA, #exam)</small>
                        </div>
                    </div>
                );
            }
        } else {
            // --- Show Search History ---
            if (history.length > 0) {
                return (
                    <>
                        <div className="dropdown-history-header">
                            Recent Searches
                            <button 
                                className="clear-history-btn-small"
                                onClick={clearHistory}
                                style={{marginLeft: 'auto', fontSize: '12px'}}
                            >
                                Clear All
                            </button>
                        </div>
                        {history.map(item => (
                            <div key={item} className="history-item">
                                <div 
                                    className="history-content" 
                                    onClick={() => handleHistoryClick(item)}
                                >
                                    <IoSearchOutline className="search-icon-small" />
                                    <span>{item}</span>
                                    <span className="history-type-badge">
                                        {item.startsWith('#') ? '📝' : '👤'}
                                    </span>
                                </div>
                                <button 
                                    className="delete-history-btn"
                                    onClick={(e) => { e.stopPropagation(); deleteHistoryItem(item); }}
                                >
                                    <IoCloseOutline />
                                </button>
                            </div>
                        ))}
                    </>
                );
            } else {
                return (
                    <div className="dropdown-status-message">
                        Start typing to search for users or posts...
                        <div className="search-tips">
                            <small>• Type names to search users</small><br/>
                            <small>• Use # to search posts (e.g., #DSA, #exam)</small><br/>
                            <small>• Or type "post" followed by keywords</small>
                        </div>
                    </div>
                );
            }
        }
    };

    // Clear search results when dropdown closes
    const handleClearSearch = () => {
        console.log("🗑️ Clearing search");
        setQuery('');
        setSearchResults([]);
        setSearchError('');
        setDropdownOpen(true);
    };

    // Debug function to test the endpoints
    const testEndpoints = async () => {
        console.log("🧪 Testing search endpoints...");
        console.log("Token exists:", !!token);
        
        // Test user search
        try {
            const userResponse = await fetch('http://localhost:5000/api/users/search?name=test', {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Accept': 'application/json'
                }
            });
            console.log("👤 User search status:", userResponse.status);
            if (userResponse.ok) {
                const userData = await userResponse.json();
                console.log("👤 User search results:", userData.length, "users found");
            }
        } catch (error) {
            console.error("👤 User search test failed:", error);
        }
        
        // Test post search
        try {
            const postResponse = await fetch('http://localhost:5000/api/posts/search?q=test', {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Accept': 'application/json'
                }
            });
            console.log("📝 Post search status:", postResponse.status);
            if (postResponse.ok) {
                const postData = await postResponse.json();
                console.log("📝 Post search results:", postData);
            }
        } catch (error) {
            console.error("📝 Post search test failed:", error);
        }
    };

    // Add test button for debugging
    useEffect(() => {
        // Add test button to console for quick debugging
        console.log("🚀 ExploreSearch component mounted");
        console.log("🔧 Available commands:");
        console.log("  - testEndpoints(): Test both search endpoints");
        console.log("  - Type in search box to trigger search");
        
        // Make testEndpoint available globally for console testing
        window.testSearchEndpoints = testEndpoints;
        
        return () => {
            delete window.testSearchEndpoints;
        };
    }, []);

    return (
        <div className="explore-wrapper" ref={wrapperRef}>
            <div className="explore-input-container">
                <IoSearchOutline className="search-icon" />
                <input
                    type="text"
                    placeholder="Search for people or posts... (use # for posts)"
                    className="explore-input"
                    value={query}
                    onChange={handleSearchChange}
                    onFocus={() => setDropdownOpen(true)}
                />
                {query && (
                    <button 
                        className="clear-search-btn"
                        onClick={handleClearSearch}
                    >
                        <IoCloseOutline />
                    </button>
                )}
            </div>

            {dropdownOpen && (query.trim().length > 1 || history.length > 0) && (
                <div className="explore-dropdown">
                    {getDropdownContent()}
                </div>
            )}
        </div>
    );
};

export default ExploreSearch;




