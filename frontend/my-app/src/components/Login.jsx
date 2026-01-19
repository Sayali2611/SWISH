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

    if (!formData.email.endsWith('@sigce.edu')) {
      setError("Please use your SIGCE institutional email (@sigce.edu)");
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/auth/login`, {
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
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        navigate("/feed");
      } else {
        setError(data.message || 'Invalid credentials. Please try again.');
      }
    } catch (error) {
      setError('Connection error. Please check your network.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page-container">
      <form className="login-form" onSubmit={handleLogin}>
        {/* Clean header without emoji */}
        <div className="login-header">
          <div className="login-title">Swish</div>
          <p className="login-subtitle">
            SIGCE Campus Network
          </p>
        </div>
        
        {/* Error Display */}
        {error && <div className="error-message">⚠️ {error}</div>}
        
        {/* Input Fields */}
        <div className="input-group">
          <label className="input-label">SIGCE Email Address</label>
          <input 
            type="email" 
            className="login-input" 
            placeholder="username@sigce.edu" 
            value={formData.email}
            onChange={(e) => setFormData({...formData, email: e.target.value})}
            required
          />
        </div>
        
        <div className="input-group">
          <label className="input-label">Password</label>
          <input 
            type="password" 
            className="login-input" 
            placeholder="Enter your password" 
            value={formData.password}
            onChange={(e) => setFormData({...formData, password: e.target.value})}
            required
          />
        </div>
        
        {/* Login Button */}
        <button 
          className="login-button" 
          type="submit"
          disabled={loading}
        >
          {loading ? (
            <span className="button-loading">
              <span className="spinner"></span> Signing in...
            </span>
          ) : 'Sign In to Swish'}
        </button>
        
        {/* Registration Link */}
        <p className="login-footer">
          New to campus? <Link to="/register" className="auth-link">Create your account</Link>
        </p>
        
      </form>
    </div>
  );
}

export default Login;