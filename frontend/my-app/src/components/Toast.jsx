export default function Toast({ notification, onClose, onOpen }) {
  if (!notification) return null;

  const handleToastClick = () => {
    // If toast has a postId, trigger navigation
    if (notification.postId) {
      // Store highlighted post data
      const highlightData = {
        postId: notification.postId,
        timestamp: Date.now(),
        from: 'toast',
        notificationId: notification.id
      };
      
      localStorage.setItem('searchHighlightedPost', JSON.stringify(highlightData));
      
      // Trigger feed highlight
      window.dispatchEvent(new Event('feedHighlight'));
      
      // If onOpen callback exists, call it (for opening notifications panel)
      if (onOpen) {
        onOpen();
      }
    }
  };

  return (
    <div 
      className="toast"
      onClick={handleToastClick}
      style={{ cursor: notification.postId ? 'pointer' : 'default' }}
    >
      <div className="toast-left">
        <div className="toast-avatar">
          {notification.userImage ? (
            <img src={notification.userImage} alt={notification.userName} />
          ) : (
            <span>{notification.userName?.charAt(0).toUpperCase()}</span>
          )}
        </div>
        <div className="toast-body">
          <div className="toast-message">
            <strong>{notification.userName}</strong> {notification.message}
          </div>
          <div className="toast-time">{notification.timeAgo}</div>
          {notification.postId && (
            <div className="toast-hint">Click to view →</div>
          )}
        </div>
      </div>

      <button
        className="toast-close"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
      >
        ✕
      </button>
    </div>
  );
}