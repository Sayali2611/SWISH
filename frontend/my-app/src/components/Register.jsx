import { Link, useNavigate } from "react-router-dom";
import { useState, useRef, useEffect } from "react";
import "../styles/Register.css";

function Register() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    contact: "",
    role: "student",
    profilePhoto: null,
    studentId: "",
    department: "",
    year: "",
    employeeId: "",
    facultyDepartment: "",
    designation: "",
    adminCode: "",
    isPrivate: false,
    bio: "",
    secretCode: "", 
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [photoPreview, setPhotoPreview] = useState(null);
  const [progress, setProgress] = useState(25);
  const fileInputRef = useRef(null);

  // Update progress bar
  useEffect(() => {
    const newProgress = step * 25;
    setProgress(newProgress);
  }, [step]);

  const validateEmail = (email) => {
    return email.endsWith('@sigce.edu') || email.endsWith('@university.edu') || email.includes('@');
  };

  const handlePhotoUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        setError("Please upload an image file (JPG, PNG, etc.)");
        return;
      }
      
      if (file.size > 5 * 1024 * 1024) {
        setError("Image size should be less than 5MB");
        return;
      }

      setFormData({ ...formData, profilePhoto: file });
      
      const reader = new FileReader();
      reader.onload = (e) => {
        setPhotoPreview(e.target.result);
      };
      reader.readAsDataURL(file);
      setError("");
    }
  };

  const handleRemovePhoto = () => {
    setFormData({ ...formData, profilePhoto: null });
    setPhotoPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    // Validations
    if (!validateEmail(formData.email)) {
      setError("Please use your university email address (@sigce.edu)");
      setLoading(false);
      return;
    }

    if (formData.password.length < 6) {
      setError("Password must be at least 6 characters long");
      setLoading(false);
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match");
      setLoading(false);
      return;
    }

   if ((formData.role === 'admin' || formData.role === 'faculty') && !formData.secretCode) {
  setError("Registration code is required for Admin/Faculty registration");
  setLoading(false);
  return;
}

    try {
      const submitData = new FormData();
      submitData.append('name', formData.name);
      submitData.append('email', formData.email);
      submitData.append('password', formData.password);
      submitData.append('contact', formData.contact);
      submitData.append('role', formData.role);
      submitData.append('bio', formData.bio || "Campus community member");
      submitData.append('isPrivate', formData.isPrivate);

      submitData.append('secretCode', formData.secretCode || '');
      
      if (formData.profilePhoto) {
        submitData.append('profilePhoto', formData.profilePhoto);
      }

      // Add role-specific fields
      if (formData.role === 'student') {
        submitData.append('studentId', formData.studentId);
        submitData.append('department', formData.department);
        submitData.append('year', formData.year);
      } else if (formData.role === 'faculty') {
        submitData.append('employeeId', formData.employeeId);
        submitData.append('facultyDepartment', formData.facultyDepartment);
        submitData.append('designation', formData.designation);
      } else if (formData.role === 'admin') {
        submitData.append('adminCode', formData.adminCode);
      }

      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/auth/register`, {
        method: 'POST',
        body: submitData
      });

      const data = await response.json();

      if (response.ok) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        
        // Show success animation
        document.querySelector('.success-overlay')?.classList.add('active');
        setTimeout(() => navigate("/feed"), 2000);
      } else {
        setError(data.message || 'Registration failed. Please try again.');
      }
    } catch (error) {
      setError('Network error: Unable to connect to server.');
    } finally {
      setLoading(false);
    }
  };

  const nextStep = () => {
    if (step === 1) {
      if (!formData.name || !formData.email || !formData.password || !formData.confirmPassword || !formData.contact) {
        setError("Please fill all required fields");
        return;
      }
      if (!validateEmail(formData.email)) {
        setError("Please use your university email address");
        return;
      }
      if (formData.password !== formData.confirmPassword) {
        setError("Passwords do not match");
        return;
      }
      setStep(2);
      setError("");
    } else if (step === 2) {
      setStep(3);
      setError("");
    } else if (step === 3) {
      setStep(4);
      setError("");
    }
  };

  const prevStep = () => {
    setStep(step - 1);
    setError("");
  };

  const handleRoleSelect = (role) => {
    setFormData({ ...formData, role });
  };

  const skipPhoto = () => {
    setStep(4);
    setError("");
  };

  // Step titles
  const stepTitles = [
    "Personal Information",
    "Select Your Role",
    "Profile Picture",
    "Complete Profile"
  ];

  const stepSubtitles = [
    "Enter your basic details to get started",
    "Choose how you'll participate in campus community",
    "Upload a photo to personalize your profile",
    "Add role-specific information"
  ];

  return (
    <div className="register-container">
      {/* Success Overlay */}
      <div className="success-overlay">
        <div className="success-content">
          <div className="success-icon">🎉</div>
          <h2>Welcome to SWISH!</h2>
          <p>Your campus account has been created successfully</p>
          <div className="success-spinner"></div>
        </div>
      </div>

      {/* Left Panel */}
      <div className="register-left-panel">
        <div className="left-panel-content">
          <div className="brand-section">
            <div className="brand-logo">🎓</div>
            <h1 className="brand-title">SWISH</h1>
            <p className="brand-subtitle">Campus Social Platform</p>
          </div>
          
          <div className="features-list">
            <div className="feature-item">
              <div className="feature-icon">✨</div>
              <div className="feature-text">
                <h3>Exclusive Campus Network</h3>
                <p>Connect only with verified students, faculty & staff</p>
              </div>
            </div>
            
            <div className="feature-item">
              <div className="feature-icon">📸</div>
              <div className="feature-text">
                <h3>Photo Sharing</h3>
                <p>Share campus moments with your community</p>
              </div>
            </div>
            
            <div className="feature-item">
              <div className="feature-icon">🔒</div>
              <div className="feature-text">
                <h3>Secure Environment</h3>
                <p>Privacy-focused platform for academic communities</p>
              </div>
            </div>
            
            <div className="feature-item">
              <div className="feature-icon">📊</div>
              <div className="feature-text">
                <h3>Admin Dashboard</h3>
                <p>Content moderation and user management</p>
              </div>
            </div>
          </div>
          
          <div className="project-info">
            <p className="project-code">Project: SOC-WEB-2025-094</p>
            <p className="project-status">MERN Stack • Campus Exclusive</p>
          </div>
        </div>
      </div>

      {/* Right Panel - Registration Form */}
      <div className="register-right-panel">
        <div className="register-header">
          <div className="header-top">
            <Link to="/login" className="back-button">
              ← Back to Login
            </Link>
            <div className="step-counter">
              Step {step} of 4
            </div>
          </div>
          
          {/* Progress Bar */}
          <div className="progress-container">
            <div className="progress-bar">
              <div 
                className="progress-fill" 
                style={{ width: `${progress}%` }}
              ></div>
            </div>
            <div className="progress-labels">
              <span className={step >= 1 ? 'active' : ''}>Personal</span>
              <span className={step >= 2 ? 'active' : ''}>Role</span>
              <span className={step >= 3 ? 'active' : ''}>Photo</span>
              <span className={step >= 4 ? 'active' : ''}>Complete</span>
            </div>
          </div>
        </div>

        <div className="register-card">
          <div className="step-header">
            <h2 className="step-title">{stepTitles[step - 1]}</h2>
            <p className="step-subtitle">{stepSubtitles[step - 1]}</p>
          </div>

          {error && (
            <div className="error-message">
              <span className="error-icon">⚠️</span>
              {error}
            </div>
          )}

          <form className="register-form" onSubmit={step === 4 ? handleRegister : (e) => { e.preventDefault(); nextStep(); }}>
            
            {/* STEP 1: BASIC INFO */}
            {step === 1 && (
              <div className="step-content slide-in">
                <div className="form-grid">
                  <div className="input-group">
                    <label>Full Name *</label>
                    <input 
                      type="text" 
                      className="register-input" 
                      placeholder="Enter your full name" 
                      value={formData.name}
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                      required
                    />
                  </div>

                  <div className="input-group">
                    <label>University Email *</label>
                    <input 
                      type="email" 
                      className="register-input" 
                      placeholder="your.name@sigce.edu" 
                      value={formData.email}
                      onChange={(e) => setFormData({...formData, email: e.target.value})}
                      required
                    />
                    <div className="input-hint">Use your campus email address</div>
                  </div>

                  <div className="input-group">
                    <label>Password *</label>
                    <input 
                      type="password" 
                      className="register-input" 
                      placeholder="Create a strong password" 
                      value={formData.password}
                      onChange={(e) => setFormData({...formData, password: e.target.value})}
                      required
                      minLength={6}
                    />
                    <div className="input-hint">Minimum 6 characters</div>
                  </div>

                  <div className="input-group">
                    <label>Confirm Password *</label>
                    <input 
                      type="password" 
                      className="register-input" 
                      placeholder="Re-enter your password" 
                      value={formData.confirmPassword}
                      onChange={(e) => setFormData({...formData, confirmPassword: e.target.value})}
                      required
                    />
                  </div>

                  <div className="input-group">
                    <label>Contact Number *</label>
                    <input 
                      type="tel" 
                      className="register-input" 
                      placeholder="+91 9876543210" 
                      value={formData.contact}
                      onChange={(e) => setFormData({...formData, contact: e.target.value})}
                      required
                    />
                  </div>

                  <div className="input-group full-width">
                    <label>Bio (Optional)</label>
                    <textarea 
                      className="register-input textarea" 
                      placeholder="Tell us about yourself, interests, etc."
                      value={formData.bio}
                      onChange={(e) => setFormData({...formData, bio: e.target.value})}
                      rows="3"
                    />
                  </div>
                       {/* 👇 ADD THIS NEW FIELD */}
      <div className="input-group full-width">
        <label>Account Privacy</label>
        <div className="privacy-toggle">
          <label className="privacy-option">
            <input 
              type="radio"
              name="privacy"
              value="public"
              checked={formData.isPrivate === false}
              onChange={() => setFormData({...formData, isPrivate: false})}
            />
            <div className="privacy-content">
              <span className="privacy-icon">🌍</span>
              <div>
                <div className="privacy-title">Public Account</div>
                <div className="privacy-desc">Anyone can see your posts and profile</div>
              </div>
            </div>
          </label>
          
          <label className="privacy-option">
            <input 
              type="radio"
              name="privacy"
              value="private"
              checked={formData.isPrivate === true}
              onChange={() => setFormData({...formData, isPrivate: true})}
            />
            <div className="privacy-content">
              <span className="privacy-icon">🔒</span>
              <div>
                <div className="privacy-title">Private Account</div>
                <div className="privacy-desc">Only accepted connections can see your posts</div>
              </div>
            </div>
          </label>
        </div>
      </div>
    </div>
  </div>
)}

            {/* STEP 2: ROLE SELECTION */}
            {step === 2 && (
              <div className="step-content slide-in">
                <div className="role-selection">
                  <div className="role-label">Select your role in campus community:</div>
                  <div className="role-cards">
                    <div 
                      className={`role-card ${formData.role === 'student' ? 'active' : ''}`}
                      onClick={() => handleRoleSelect('student')}
                    >
                      <div className="role-icon">🎓</div>
                      <div className="role-info">
                        <div className="role-title">Student</div>
                        <div className="role-desc">Currently enrolled in academic programs</div>
                        <ul className="role-features">
                          <li>Access to student groups</li>
                          <li>Academic resources</li>
                          <li>Campus events</li>
                        </ul>
                      </div>
                    </div>

                    <div 
                      className={`role-card ${formData.role === 'faculty' ? 'active' : ''}`}
                      onClick={() => handleRoleSelect('faculty')}
                    >
                      <div className="role-icon">👨‍🏫</div>
                      <div className="role-info">
                        <div className="role-title">Faculty</div>
                        <div className="role-desc">Teaching & research staff member</div>
                        <ul className="role-features">
                          <li>Course announcements</li>
                          <li>Research collaboration</li>
                          <li>Student mentoring</li>
                        </ul>
                      </div>
                    </div>

                    <div 
                      className={`role-card ${formData.role === 'admin' ? 'active' : ''}`}
                      onClick={() => handleRoleSelect('admin')}
                    >
                      <div className="role-icon">⚙️</div>
                      <div className="role-info">
                        <div className="role-title">Admin</div>
                        <div className="role-desc">Platform administration & moderation</div>
                        <ul className="role-features">
                          <li>Content moderation</li>
                          <li>User management</li>
                          <li>Platform analytics</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 3: PROFILE PICTURE */}
            {step === 3 && (
              <div className="step-content slide-in">
                <div className="photo-upload-section">
                  <div className="upload-title">Profile Picture</div>
                  <div className="upload-subtitle">
                    Add a photo to help your campus community recognize you
                  </div>

                  <div className="upload-area">
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handlePhotoUpload}
                      accept="image/*"
                      className="file-input"
                      id="profilePhoto"
                    />
                    
                    {photoPreview ? (
                      <div className="photo-preview">
                        <img src={photoPreview} alt="Preview" className="preview-image" />
                        <div className="preview-overlay">
                          <button 
                            type="button" 
                            className="remove-photo-btn"
                            onClick={handleRemovePhoto}
                          >
                            ✕ Remove
                          </button>
                          <button 
                            type="button" 
                            className="change-photo-btn"
                            onClick={() => fileInputRef.current?.click()}
                          >
                            📁 Change Photo
                          </button>
                        </div>
                      </div>
                    ) : (
                      <label htmlFor="profilePhoto" className="upload-box">
                        <div className="upload-icon">📸</div>
                        <div className="upload-text">
                          <div className="upload-main">Click to upload photo</div>
                          <div className="upload-hint">or drag and drop</div>
                          <div className="upload-size">PNG, JPG, GIF up to 5MB</div>
                        </div>
                      </label>
                    )}
                  </div>

                  <div className="photo-tips">
                    <p className="tips-title">📝 Tips for a great profile picture:</p>
                    <ul className="tips-list">
                      <li>Use a clear, recent photo of yourself</li>
                      <li>Face the camera directly</li>
                      <li>Good lighting is important</li>
                      <li>Smile! 😊</li>
                    </ul>
                  </div>

                  <div className="skip-section">
                    <button 
                      type="button" 
                      className="skip-btn"
                      onClick={skipPhoto}
                    >
                      Skip for now - I'll add later
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 4: ROLE-SPECIFIC DETAILS */}
            {step === 4 && (
              <div className="step-content slide-in">
                <div className="role-details-section">
                  <div className="role-badge">
                    {formData.role === 'student' && '🎓 Student Registration'}
                    {formData.role === 'faculty' && '👨‍🏫 Faculty Registration'}
                    {formData.role === 'admin' && '⚙️ Admin Registration'}
                  </div>
                  
                  {/* STUDENT FIELDS */}
                  {formData.role === 'student' && (
                    <div className="form-grid">
                      <div className="input-group">
                        <label>Student ID *</label>
                        <input 
                          type="text" 
                          className="register-input" 
                          placeholder="Enter your student ID" 
                          value={formData.studentId}
                          onChange={(e) => setFormData({...formData, studentId: e.target.value})}
                          required
                        />
                      </div>

                      <div className="input-group">
                        <label>Department *</label>
                        <select 
                          className="register-input"
                          value={formData.department}
                          onChange={(e) => setFormData({...formData, department: e.target.value})}
                          required
                        >
                          <option value="">Select Department</option>
                          <option value="Computer Engineering">Computer Engineering</option>
                          <option value="Information Technology">Information Technology</option>
                          <option value="Electronics & Telecommunication">Electronics & Telecommunication</option>
                          <option value="Mechanical Engineering">Mechanical Engineering</option>
                          <option value="Civil Engineering">Civil Engineering</option>
                          <option value="Other">Other Department</option>
                        </select>
                      </div>

                      <div className="input-group">
                        <label>Academic Year *</label>
                        <select 
                          className="register-input"
                          value={formData.year}
                          onChange={(e) => setFormData({...formData, year: e.target.value})}
                          required
                        >
                          <option value="">Select Year</option>
                          <option value="First Year">First Year</option>
                          <option value="Second Year">Second Year</option>
                          <option value="Third Year">Third Year</option>
                          <option value="Fourth Year">Fourth Year</option>
                          <option value="Postgraduate">Postgraduate</option>
                          <option value="PhD">PhD</option>
                        </select>
                      </div>
                    </div>
                  )}

                  {/* FACULTY FIELDS */}
                  {formData.role === 'faculty' && (
                    <div className="form-grid">

                      <div className="input-group full-width">
                        <label>Campus Registration Code *</label>
                        <input 
                          type="password" 
                          className="register-input" 
                          placeholder="Enter Secret Code" 
                          value={formData.secretCode}
                          onChange={(e) => setFormData({...formData, secretCode: e.target.value})}
                          required
                        />
                        <div className="input-hint">Contact campus admin for the registration code</div>
                      </div>
                      <div className="input-group">
                        <label>Employee ID *</label>
                        <input 
                          type="text" 
                          className="register-input" 
                          placeholder="Enter your employee ID" 
                          value={formData.employeeId}
                          onChange={(e) => setFormData({...formData, employeeId: e.target.value})}
                          required
                        />
                      </div>

                      <div className="input-group">
                        <label>Department *</label>
                        <select 
                          className="register-input"
                          value={formData.facultyDepartment}
                          onChange={(e) => setFormData({...formData, facultyDepartment: e.target.value})}
                          required
                        >
                          <option value="">Select Department</option>
                          <option value="Computer Engineering">Computer Engineering</option>
                          <option value="Information Technology">Information Technology</option>
                          <option value="Electronics & Telecommunication">Electronics & Telecommunication</option>
                          <option value="Mechanical Engineering">Mechanical Engineering</option>
                          <option value="Civil Engineering">Civil Engineering</option>
                          <option value="Management">Management</option>
                          <option value="Sciences">Sciences</option>
                        </select>
                      </div>

                      <div className="input-group">
                        <label>Designation *</label>
                        <select 
                          className="register-input"
                          value={formData.designation}
                          onChange={(e) => setFormData({...formData, designation: e.target.value})}
                          required
                        >
                          <option value="">Select Designation</option>
                          <option value="Professor">Professor</option>
                          <option value="Associate Professor">Associate Professor</option>
                          <option value="Assistant Professor">Assistant Professor</option>
                          <option value="Head of Department">Head of Department</option>
                          <option value="Lab Incharge">Lab Incharge</option>
                          <option value="Visiting Faculty">Visiting Faculty</option>
                          <option value="Guest Lecturer">Guest Lecturer</option>
                        </select>
                      </div>
                    </div>
                  )}

                  {/* ADMIN FIELDS */}
                  {formData.role === 'admin' && (
                    <div className="admin-verification">
                      <div className="verification-note">
                        🔒 Administrative access requires special authorization
                      </div>

                      <div className="input-group">
                        <label>Campus Registration Code *</label>
                        <input 
                          type="password" 
                          className="register-input" 
                          placeholder="Enter Secret Code" 
                          value={formData.secretCode}
                          onChange={(e) => setFormData({...formData, secretCode: e.target.value})}
                          required
                        />
                        <div className="code-hint">Contact system administrator for the registration code</div>
                      </div>
                      <div className="input-group">
                        <label>Admin Access Code *</label>
                        <input 
                          type="password" 
                          className="register-input" 
                          placeholder="Enter admin access code" 
                          value={formData.adminCode}
                          onChange={(e) => setFormData({...formData, adminCode: e.target.value})}
                          required
                        />
                        <div className="code-hint">Contact system administrator for the access code</div>
                      </div>
                      <div className="admin-permissions">
                        <p className="permissions-title">Admin permissions include:</p>
                        <ul className="permissions-list">
                          <li>Content moderation and removal</li>
                          <li>User account management</li>
                          <li>Platform analytics access</li>
                          <li>System configuration</li>
                        </ul>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* FORM ACTIONS */}
            <div className="form-actions">
              {step > 1 && (
                <button 
                  type="button" 
                  className="btn-secondary"
                  onClick={prevStep}
                >
                  ← Previous Step
                </button>
              )}
              
              <div className="action-spacer"></div>
              
              <button 
                className="btn-primary"
                type="submit"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <div className="action-spinner"></div>
                    {step === 4 ? 'Creating Account...' : 'Processing...'}
                  </>
                ) : (
                  step === 4 ? '🎉 Create SWISH Account' : 'Continue →'
                )}
              </button>
            </div>
          </form>

          <div className="form-footer">
            <p className="footer-text">
              Already have an account?{' '}
              <Link to="/login" className="auth-link">Sign in here</Link>
            </p>
            <p className="security-note">
              🔒 Your data is secured. We follow campus privacy policies.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Register;