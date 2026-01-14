import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import "../styles/Login.css";

function Login() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    email: "",
    password: ""
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    // Validate university email
    if (!formData.email.endsWith('@sigce.edu')) {
      setError("Please use your SIGCE email address (@sigce.edu)");
      setLoading(false);
      return;
    }

    try {
      const response = await fetch('http://localhost:5000/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password
        })
      });

      const data = await response.json();

      if (response.ok) {
        // Save token and user data
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        
        // Show success message
        setError(""); // Clear any previous errors
        navigate("/feed");
      } else {
        setError(data.message || 'Login failed. Please check your credentials.');
      }
    } catch (error) {
      setError('Network error: Unable to connect to server.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page-container">
      <form className="login-form" onSubmit={handleLogin}>
        <div className="login-title">Welcome to Swish</div>
        <p className="login-subtitle">Connect with your campus community</p>
        
        {error && <div className="error-message">{error}</div>}
        
        <input 
          type="email" 
          className="login-input" 
          placeholder="📧 Enter your SIGCE email" 
          value={formData.email}
          onChange={(e) => setFormData({...formData, email: e.target.value})}
          required
        />
        <input 
          type="password" 
          className="login-input" 
          placeholder="🔒 Enter your password" 
          value={formData.password}
          onChange={(e) => setFormData({...formData, password: e.target.value})}
          required
        />
        <button 
          className="login-button" 
          type="submit"
          disabled={loading}
        >
          {loading ? '🔐 Logging in...' : '🎯 Login'}
        </button>
        <p className="login-footer">
          New to Swish? <Link to="/register" className="auth-link">Join now</Link>
        </p>
      </form>
    </div>
  );
}

export default Login;