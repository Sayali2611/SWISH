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

// Format time for posts
const formatTimeAgo = (date) => {
    const now = new Date();
    const postDate = new Date(date);
    const diffMs = now - postDate;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) {
        return `${diffMins}m ago`;
    } else if (diffHours < 24) {
        return `${diffHours}h ago`;
    } else if (diffDays < 7) {
        return `${diffDays}d ago`;
    } else {
        return postDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
};

// --- ExploreSearch Component ---
const ExploreSearch = ({ onUserSelect, onSearch }) => {
    const [query, setQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [history, setHistory] = useState([]);
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [searchType, setSearchType] = useState('users'); // 'users' or 'posts' or 'explore'
    const [searchError, setSearchError] = useState('');

    const wrapperRef = useRef(null);
    const token = localStorage.getItem('token');
    const navigate = useNavigate();

    // 1. Load History on Mount
    useEffect(() => {
        const storedHistory = localStorage.getItem(SEARCH_HISTORY_KEY);
        if (storedHistory) {
            try {
                const parsed = JSON.parse(storedHistory);
                if (Array.isArray(parsed)) {
                    setHistory(parsed);
                }
            } catch (e) {
                console.error('Failed to parse search history:', e);
                localStorage.removeItem(SEARCH_HISTORY_KEY);
            }
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

    // 3. Unified Search API Call (Debounced) - UPDATED FOR EXPLORE PAGE
    const fetchResults = useCallback(debounce(async (value, type) => {
        console.log("🔍 [ExploreSearch] fetchResults called with:", { value, type });
        
        if (value.length < 2) {
            setSearchResults([]);
            setLoading(false);
            setSearchError('');
            return;
        }

        setLoading(true);
        setSearchError('');
        
        try {
            // USE EXPLORE SEARCH ENDPOINT FOR BOTH USERS AND POSTS
            const url = `http://localhost:5000/api/explore/search?q=${encodeURIComponent(value)}`;
            
            console.log("📡 [ExploreSearch] Making unified search request to:", url);
            console.log("📝 [ExploreSearch] Search query:", value);
            console.log("🔑 [ExploreSearch] Token exists:", !!token);
            
            const response = await fetch(url, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                }
            });
            
            console.log("📡 [ExploreSearch] Response status:", response.status);
            console.log("📡 [ExploreSearch] Response status text:", response.statusText);
            
            if (!response.ok) {
                let errorMessage = '';
                
                try {
                    const errorData = await response.json();
                    console.log("❌ [ExploreSearch] Error data:", errorData);
                    errorMessage = errorData.message || errorData.error || `Server error (${response.status})`;
                } catch (jsonError) {
                    console.log("❌ [ExploreSearch] Could not parse error as JSON:", jsonError);
                    const responseText = await response.text();
                    console.log("❌ [ExploreSearch] Raw response text:", responseText);
                    errorMessage = `Server error: ${response.status} ${response.statusText}`;
                }
                
                throw new Error(errorMessage);
            }
            
            const data = await response.json();
            console.log("✅ [ExploreSearch] Unified search results:", data);
            
            // Process results from explore endpoint
            if (data.results && Array.isArray(data.results)) {
                // Format results for display
                const formattedResults = data.results.map(item => {
                    if (item.type === 'user') {
                        return {
                            type: 'user',
                            _id: item._id,
                            name: item.name,
                            email: item.email,
                            profilePhoto: item.profilePhoto,
                            department: item.department || item.facultyDepartment,
                            role: item.role,
                            isPrivate: item.isPrivate,
                            followers: item.followers || [],
                            connections: item.connections || []
                        };
                    } else if (item.type === 'post') {
                        return {
                            type: 'post',
                            _id: item._id,
                            content: item.content,
                            createdAt: item.createdAt,
                            likes: item.likes || [],
                            comments: item.comments || [],
                            media: item.media || [],
                            tags: item.tags || [],
                            category: item.category,
                            user: item.user || {
                                name: "Unknown User",
                                profilePhoto: null,
                                role: 'user',
                                department: ''
                            }
                        };
                    } else if (item.type === 'hashtag') {
                        return {
                            type: 'hashtag',
                            tag: item.tag,
                            count: item.count,
                            lastUsed: item.lastUsed
                        };
                    }
                    return item;
                });
                
                setSearchResults(formattedResults);
            } else {
                console.warn("⚠️ [ExploreSearch] Unexpected response format:", data);
                setSearchResults([]);
            }
            
            setSearchError('');
            
        } catch (error) {
            console.error('🔥 [ExploreSearch] Search error details:', error);
            console.error('🔥 [ExploreSearch] Error stack:', error.stack);
            
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

    // 4. Input Change Handler - IMPROVED for Explore page
    const handleSearchChange = (event) => {
        const value = event.target.value;
        console.log("⌨️ [ExploreSearch] Input changed to:", value);
        setQuery(value);
        setDropdownOpen(true);
        
        // Always use 'explore' search type which searches everything
        setSearchType('explore');
        
        // Trigger search
        if (value.trim().length >= 2) {
            fetchResults(value, 'explore');
        } else {
            setSearchResults([]);
            setLoading(false);
        }
    };

    // 5. Handle Enter key press - Navigate to Explore page with search
    const handleKeyPress = (event) => {
        if (event.key === 'Enter' && query.trim().length >= 2) {
            console.log("↵ [ExploreSearch] Enter pressed with query:", query);
            
            // Save to history
            saveToHistory(query);
            
            // Close dropdown
            setDropdownOpen(false);
            
            // If we're not on Explore page, navigate there
            if (!window.location.pathname.includes('/explore')) {
                console.log("🧭 [ExploreSearch] Navigating to Explore page with search query");
                
                // Dispatch event for Explore page to handle
                const searchEvent = new CustomEvent('navbarSearch', {
                    detail: { query: query.trim() }
                });
                window.dispatchEvent(searchEvent);
                
                // Navigate to Explore page
                navigate(`/explore?search=${encodeURIComponent(query.trim())}`);
            } else {
                // If already on Explore page, just trigger the search
                console.log("🎯 [ExploreSearch] Already on Explore page, triggering search");
                const searchEvent = new CustomEvent('navbarSearch', {
                    detail: { query: query.trim() }
                });
                window.dispatchEvent(searchEvent);
            }
        }
    };

    // 6. History Management Functions
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

    // 7. Click Handler for History Item
    const handleHistoryClick = (term) => {
        console.log("📚 [ExploreSearch] History item clicked:", term);
        setQuery(term);
        setDropdownOpen(true);
        setSearchType('explore');
        fetchResults(term, 'explore');
    };

    // 8. Click Handler for User Result
    const handleUserClick = (user) => {
        console.log("👤 [ExploreSearch] User clicked:", user.name, "ID:", user._id);
        saveToHistory(query);
        
        // Close dropdown
        setDropdownOpen(false);
        
        // Clear search
        setQuery('');
        setSearchResults([]);
        
        // Navigate to user profile
        if (user._id) {
            navigate(`/profile/${user._id}`);
        } else {
            console.error("❌ [ExploreSearch] No user ID found:", user);
        }
        
        // Call prop function if exists
        if (onUserSelect) {
            onUserSelect(user);
        }
    };

    // 9. Click Handler for Post Result - For Explore page, we stay on Explore
    const handlePostClick = (post) => {
        console.log("📝 [ExploreSearch] Post clicked:", post._id);
        
        saveToHistory(query);
        
        // Close dropdown
        setDropdownOpen(false);
        
        // Clear search
        setQuery('');
        setSearchResults([]);
        
        // If we're on Explore page, just trigger a search for this post's content
        if (window.location.pathname.includes('/explore')) {
            console.log("🎯 [ExploreSearch] On Explore page, triggering post highlight");
            
            // Dispatch event for Explore page to handle
            const postEvent = new CustomEvent('explorePostClick', {
                detail: { 
                    postId: post._id,
                    content: post.content,
                    searchQuery: query
                }
            });
            window.dispatchEvent(postEvent);
            
            // Also trigger hashtag search if post has tags
            if (post.tags && post.tags.length > 0) {
                const tagEvent = new CustomEvent('exploreHashtagClick', {
                    detail: { tag: post.tags[0] }
                });
                window.dispatchEvent(tagEvent);
            }
        } else {
            // If not on Explore page, navigate there with post context
            console.log("🧭 [ExploreSearch] Navigating to Explore page with post context");
            
            // Store post data for Explore page
            const postData = {
                postId: post._id,
                type: 'post',
                searchQuery: query,
                timestamp: Date.now()
            };
            
            localStorage.setItem('exploreSearchData', JSON.stringify(postData));
            
            // Navigate to Explore page
            navigate(`/explore?post=${post._id}&search=${encodeURIComponent(query)}`);
        }
    };

    // 10. Click Handler for Hashtag Result
    const handleHashtagClick = (hashtag) => {
        console.log("🏷️ [ExploreSearch] Hashtag clicked:", hashtag.tag);
        
        const tagText = `#${hashtag.tag}`;
        saveToHistory(tagText);
        
        // Close dropdown
        setDropdownOpen(false);
        
        // Clear search
        setQuery('');
        setSearchResults([]);
        
        // If we're on Explore page, trigger hashtag search
        if (window.location.pathname.includes('/explore')) {
            console.log("🎯 [ExploreSearch] On Explore page, triggering hashtag search");
            
            const hashtagEvent = new CustomEvent('exploreHashtagClick', {
                detail: { tag: hashtag.tag }
            });
            window.dispatchEvent(hashtagEvent);
        } else {
            // Navigate to Explore page with hashtag
            console.log("🧭 [ExploreSearch] Navigating to Explore page with hashtag");
            navigate(`/explore?hashtag=${encodeURIComponent(hashtag.tag)}`);
        }
    };

    // 11. Get search result content - UPDATED for Explore page
    const renderSearchResult = (item) => {
        if (item.type === 'user') {
            return (
                <div 
                    key={`user-${item._id}`} 
                    className="result-item user-result" 
                    onClick={() => handleUserClick(item)}
                >
                    <div className="result-avatar">
                        {getUserAvatar(item)}
                    </div>
                    <div className="result-details">
                        <div className="result-header">
                            <span className="result-name">{item.name || 'Unknown User'}</span>
                            {item.role === 'faculty' && (
                                <span className="verified-badge"> 👨‍🏫</span>
                            )}
                            {item.role === 'admin' && (
                                <span className="admin-badge"> 👑</span>
                            )}
                        </div>
                        {item.department && (
                            <span className="result-department">🏛️ {item.department}</span>
                        )}
                        <div className="result-stats">
                            <span>{item.followers?.length || 0} followers</span>
                            <span>•</span>
                            <span>{item.connections?.length || 0} connections</span>
                        </div>
                        <span className="result-type">👤 User</span>
                    </div>
                </div>
            );
        } else if (item.type === 'post') {
            const user = item.user || {};
            return (
                <div 
                    key={`post-${item._id}`} 
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
                            {item.content && item.content.length > 120 
                                ? `${item.content.substring(0, 120)}...` 
                                : item.content || 'No content'}
                        </p>
                        {item.tags && item.tags.length > 0 && (
                            <div className="post-tags-preview">
                                {item.tags.slice(0, 3).map(tag => (
                                    <span key={tag} className="post-tag">#{tag}</span>
                                ))}
                                {item.tags.length > 3 && (
                                    <span className="more-tags">+{item.tags.length - 3} more</span>
                                )}
                            </div>
                        )}
                        <div className="post-stats-preview">
                            <span>👍 {item.likes?.length || 0}</span>
                            <span>💬 {item.comments?.length || 0}</span>
                            <span className="post-time">
                                {item.createdAt ? formatTimeAgo(item.createdAt) : ''}
                            </span>
                        </div>
                    </div>
                </div>
            );
        } else if (item.type === 'hashtag') {
            return (
                <div 
                    key={`hashtag-${item.tag}`} 
                    className="result-item hashtag-result" 
                    onClick={() => handleHashtagClick(item)}
                >
                    <div className="hashtag-icon">#</div>
                    <div className="hashtag-details">
                        <div className="hashtag-header">
                            <span className="hashtag-tag">#{item.tag}</span>
                            <span className="hashtag-type">🏷️ Hashtag</span>
                        </div>
                        <span className="hashtag-count">{item.count.toLocaleString()} posts</span>
                        {item.lastUsed && (
                            <span className="hashtag-last-used">
                                Last used: {formatTimeAgo(item.lastUsed)}
                            </span>
                        )}
                    </div>
                </div>
            );
        }
        return null;
    };

    // 12. Determine what content to show in the dropdown
    const getDropdownContent = () => {
        if (loading) {
            return (
                <div className="dropdown-status-message">
                    <div className="search-spinner"></div>
                    <span>Searching for "{query}"...</span>
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
                // Group results by type
                const userResults = searchResults.filter(item => item.type === 'user');
                const postResults = searchResults.filter(item => item.type === 'post');
                const hashtagResults = searchResults.filter(item => item.type === 'hashtag');

                return (
                    <>
                        <div className="search-summary">
                            Found {searchResults.length} results for "{query}"
                        </div>
                        
                        {userResults.length > 0 && (
                            <div className="result-section">
                                <div className="result-section-title">👥 Users ({userResults.length})</div>
                                {userResults.slice(0, 3).map(renderSearchResult)}
                                {userResults.length > 3 && (
                                    <div className="view-all-link" onClick={() => {
                                        saveToHistory(query);
                                        navigate(`/explore?search=${encodeURIComponent(query)}&type=users`);
                                        setDropdownOpen(false);
                                    }}>
                                        View all {userResults.length} users →
                                    </div>
                                )}
                            </div>
                        )}
                        
                        {postResults.length > 0 && (
                            <div className="result-section">
                                <div className="result-section-title">📝 Posts ({postResults.length})</div>
                                {postResults.slice(0, 3).map(renderSearchResult)}
                                {postResults.length > 3 && (
                                    <div className="view-all-link" onClick={() => {
                                        saveToHistory(query);
                                        navigate(`/explore?search=${encodeURIComponent(query)}&type=posts`);
                                        setDropdownOpen(false);
                                    }}>
                                        View all {postResults.length} posts →
                                    </div>
                                )}
                            </div>
                        )}
                        
                        {hashtagResults.length > 0 && (
                            <div className="result-section">
                                <div className="result-section-title">🏷️ Hashtags ({hashtagResults.length})</div>
                                {hashtagResults.slice(0, 3).map(renderSearchResult)}
                            </div>
                        )}
                        
                        <div className="search-footer">
                            <small>Press Enter to view all results in Explore page</small>
                        </div>
                    </>
                );
            } else {
                return (
                    <div className="dropdown-status-message">
                        No results found for "{query}".
                        <div className="search-tips">
                            <small>• Try different keywords</small><br/>
                            <small>• Search for people by name</small><br/>
                            <small>• Use # to search hashtags (e.g., #DSA, #exam)</small>
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
                            <span>Recent Searches</span>
                            <button 
                                className="clear-history-btn-small"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    clearHistory();
                                }}
                            >
                                Clear All
                            </button>
                        </div>
                        {history.slice(0, 5).map(item => (
                            <div key={item} className="history-item">
                                <div 
                                    className="history-content" 
                                    onClick={() => handleHistoryClick(item)}
                                >
                                    <IoSearchOutline className="search-icon-small" />
                                    <span className="history-text">{item}</span>
                                    <span className="history-type-badge">
                                        {item.startsWith('#') ? '🏷️' : '👤'}
                                    </span>
                                </div>
                                <button 
                                    className="delete-history-btn"
                                    onClick={(e) => { 
                                        e.stopPropagation(); 
                                        deleteHistoryItem(item); 
                                    }}
                                >
                                    <IoCloseOutline />
                                </button>
                            </div>
                        ))}
                        <div className="search-tips" style={{ padding: '10px', fontSize: '12px', color: '#666' }}>
                            <small>Tip: Start typing to search users, posts, or hashtags</small>
                        </div>
                    </>
                );
            } else {
                return (
                    <div className="dropdown-status-message">
                        <div className="search-tips">
                            <h4>Search Tips:</h4>
                            <small>• Type names to search users</small><br/>
                            <small>• Use # to search hashtags (e.g., #DSA, #exam)</small><br/>
                            <small>• Search for posts by content</small><br/>
                            <small>• Press Enter for advanced search in Explore page</small>
                        </div>
                    </div>
                );
            }
        }
    };

    // 13. Clear search
    const handleClearSearch = () => {
        console.log("🗑️ [ExploreSearch] Clearing search");
        setQuery('');
        setSearchResults([]);
        setSearchError('');
        setDropdownOpen(false);
    };

    // 14. Focus on input
    const handleInputFocus = () => {
        setDropdownOpen(true);
    };

    return (
        <div className="explore-search-wrapper" ref={wrapperRef}>
            <div className="explore-input-container">
                <IoSearchOutline className="search-icon" />
                <input
                    type="text"
                    placeholder="Search users, posts, hashtags... Press Enter for Explore"
                    className="explore-input"
                    value={query}
                    onChange={handleSearchChange}
                    onKeyPress={handleKeyPress}
                    onFocus={handleInputFocus}
                />
                {query && (
                    <button 
                        className="clear-search-btn"
                        onClick={handleClearSearch}
                        type="button"
                    >
                        <IoCloseOutline />
                    </button>
                )}
            </div>

            {dropdownOpen && (
                <div className="explore-search-dropdown">
                    {getDropdownContent()}
                </div>
            )}
        </div>
    );
};

export default ExploreSearch;