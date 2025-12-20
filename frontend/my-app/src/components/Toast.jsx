import React from 'react';

export default function Toast({ notification, onClose, onOpen, currentUserId }) {
  if (!notification) return null;

  // Only show toast if notification is meant for current user
  if (notification.recipientId && notification.recipientId !== currentUserId) {
    return null;
  }

  const handleToastClick = () => {
    if (notification.postId) {
      const highlightData = {
        postId: notification.postId,
        timestamp: Date.now(),
        from: 'toast',
        notificationId: notification.id
      };
      
      localStorage.setItem('searchHighlightedPost', JSON.stringify(highlightData));
      window.dispatchEvent(new Event('feedHighlight'));
      
      if (onOpen) {
        onOpen();
      }
    }
  };

  return (
    <>
      <style jsx>{`
        .toast-notification {
          position: fixed;
          top: 20px;
          right: 20px;
          z-index: 9999;
          background: white;
          border-radius: 12px;
          box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1), 0 5px 10px rgba(0, 0, 0, 0.04);
          width: 380px;
          max-width: calc(100vw - 40px);
          overflow: hidden;
          animation: toastSlideIn 0.3s ease-out;
          border: 1px solid #e9ecef;
          transition: all 0.3s ease;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }

        .toast-notification:hover {
          box-shadow: 0 15px 30px rgba(0, 0, 0, 0.12), 0 8px 15px rgba(0, 0, 0, 0.06);
          transform: translateY(-2px);
        }

        .toast-content {
          display: flex;
          align-items: flex-start;
          padding: 16px;
          gap: 12px;
        }

        .toast-avatar {
          flex-shrink: 0;
          width: 40px;
          height: 40px;
          border-radius: 50%;
          overflow: hidden;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .toast-avatar img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .toast-avatar-fallback {
          color: white;
          font-weight: 600;
          font-size: 16px;
          line-height: 1;
        }

        .toast-body {
          flex: 1;
          min-width: 0;
        }

        .toast-message {
          font-size: 14px;
          line-height: 1.4;
          color: #2d3748;
          margin-bottom: 4px;
          word-wrap: break-word;
        }

        .toast-username {
          font-weight: 600;
          color: #1a202c;
        }

        .toast-action {
          margin-left: 4px;
          color: #4a5568;
        }

        .toast-time {
          font-size: 12px;
          color: #718096;
          margin-bottom: 6px;
          font-weight: 400;
        }

        .toast-hint {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 12px;
          color: #4299e1;
          font-weight: 500;
          opacity: 0.9;
          transition: opacity 0.2s ease;
        }

        .toast-notification:hover .toast-hint {
          opacity: 1;
        }

        .toast-arrow {
          transition: transform 0.2s ease;
        }

        .toast-notification:hover .toast-arrow {
          transform: translateX(2px);
        }

        .toast-close {
          position: absolute;
          top: 10px;
          right: 10px;
          width: 28px;
          height: 28px;
          border-radius: 50%;
          border: none;
          background: transparent;
          color: #a0aec0;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s ease;
          padding: 0;
        }

        .toast-close:hover {
          background: #f7fafc;
          color: #4a5568;
        }

        .toast-close:active {
          transform: scale(0.95);
        }

        @keyframes toastSlideIn {
          from {
            opacity: 0;
            transform: translateX(100%);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }

        @keyframes toastSlideOut {
          from {
            opacity: 1;
            transform: translateX(0);
          }
          to {
            opacity: 0;
            transform: translateX(100%);
          }
        }

        .toast-notification.exiting {
          animation: toastSlideOut 0.3s ease-in forwards;
        }

        @media (max-width: 480px) {
          .toast-notification {
            width: calc(100vw - 40px);
            right: 20px;
            left: 20px;
            top: 20px;
          }
          
          .toast-content {
            padding: 14px;
          }
          
          .toast-avatar {
            width: 36px;
            height: 36px;
          }
        }

        @media (prefers-color-scheme: dark) {
          .toast-notification {
            background: #2d3748;
            border-color: #4a5568;
            box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2), 0 5px 10px rgba(0, 0, 0, 0.1);
          }
          
          .toast-message {
            color: #e2e8f0;
          }
          
          .toast-username {
            color: #f7fafc;
          }
          
          .toast-action {
            color: #cbd5e0;
          }
          
          .toast-time {
            color: #a0aec0;
          }
          
          .toast-close:hover {
            background: #4a5568;
            color: #e2e8f0;
          }
          
          .toast-hint {
            color: #63b3ed;
          }
        }
      `}</style>

      <div 
        className="toast-notification"
        onClick={handleToastClick}
        style={{ cursor: notification.postId ? 'pointer' : 'default' }}
      >
        <div className="toast-content">
          <div className="toast-avatar">
            {notification.userImage ? (
              <img src={notification.userImage} alt={notification.userName} />
            ) : (
              <span className="toast-avatar-fallback">
                {notification.userName?.charAt(0).toUpperCase()}
              </span>
            )}
          </div>
          <div className="toast-body">
            <div className="toast-message">
              <strong className="toast-username">{notification.userName}</strong> 
              <span className="toast-action">{notification.message}</span>
            </div>
            <div className="toast-time">{notification.timeAgo}</div>
            {notification.postId && (
              <div className="toast-hint">
                <span>Click to view</span>
                <svg className="toast-arrow" width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M6 12L10 8L6 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
            )}
          </div>
        </div>

        <button
          className="toast-close"
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          aria-label="Close notification"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M13 1L1 13M1 1L13 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>
    </>
  );
}