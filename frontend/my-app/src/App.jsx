import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import Login from "./components/Login";
import Register from "./components/Register";
import Feed from "./components/Feed";
import Profile from "./components/Profile";
import NotificationsPage from "./components/Notifications";
import AdminDashboard from "./components/AdminDashboard";
import Network from "./components/Network";
import IncomingRequests from "./components/IncomingRequests";  // FIXED
import Connections from "./components/Connections";            // FIXED
import "./styles/global.css";
import ProfilePage from "./components/ProfilePage";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Navigate to="/login" />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/feed" element={<Feed />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/notifications" element={<NotificationsPage />} />
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/network" element={<Network />} />
        <Route path="/requests" element={<IncomingRequests />} />   {/* FIXED */}
        <Route path="/connections" element={<Connections />} />     {/* FIXED */}
        <Route path="/profile/:userId" element={<ProfilePage />} />
      </Routes>
    </Router>
  );
}

export default App;
