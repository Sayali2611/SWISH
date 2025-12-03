export default function Toast({ notification, onClose }) {
  if (!notification) return null;

  return (
    <div className="toast">
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
