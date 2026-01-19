// src/components/NotificationBell.jsx
import { io } from "socket.io-client";

let socketInstance = null;

export function getSocket() {
  if (!socketInstance) {
    const token = localStorage.getItem("token");
    if (!token) return null;

    socketInstance = io(`${import.meta.env.VITE_API_URL}`, {
      auth: { token }
    });

    socketInstance.on("connect_error", (err) => {
      console.error("Socket connect error:", err.message);
    });
  }
  return socketInstance;
}

