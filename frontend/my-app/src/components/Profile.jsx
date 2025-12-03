import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/Profile.css";

function Profile() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [photoPreview, setPhotoPreview] = useState(null);
  const fileInputRef = useRef(null);

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    contact: "",
    bio: "",
    skills: [],
    newSkill: "",
    studentId: "",
    department: "",
    year: "",
    employeeId: "",
    facultyDepartment: "",
    designation: "",
    profilePhoto: null
  });

  useEffect(() => {
    const userData = localStorage.getItem('user');
    const token = localStorage.getItem('token');
    
    if (!userData || !token) {
      navigate("/");
      return;
    }

    const userObj = JSON.parse(userData);
    setUser(userObj);
    
    // Initialize form data with user data
    setFormData({
      name: userObj.name || "",
      email: userObj.email || "",
      contact: userObj.contact || "",
      bio: userObj.bio || "Passionate about technology and innovation. Always eager to learn and grow.",
      skills: userObj.skills || ["JavaScript", "React", "Node.js", "Python"],
      newSkill: "",
      studentId: userObj.studentId || "",
      department: userObj.department || "",
      year: userObj.year || "",
      employeeId: userObj.employeeId || "",
      facultyDepartment: userObj.facultyDepartment || "",
      designation: userObj.designation || "",
      profilePhoto: userObj.profilePhoto || null
    });

    if (userObj.profilePhoto) {
      setPhotoPreview(userObj.profilePhoto);
    }
  }, [navigate]);

  const handlePhotoUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        setError("Please upload an image file (JPEG, PNG, etc.)");
        return;
      }
      
      if (file.size > 5 * 1024 * 1024) {
        setError("Image size should be less than 5MB");
        return;
      }

      setFormData({ ...formData, profilePhoto: file });
      
      // Create preview
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

  const handleAddSkill = () => {
    if (formData.newSkill.trim() && !formData.skills.includes(formData.newSkill.trim())) {
      setFormData({
        ...formData,
        skills: [...formData.skills, formData.newSkill.trim()],
        newSkill: ""
      });
    }
  };

  const handleRemoveSkill = (skillToRemove) => {
    setFormData({
      ...formData,
      skills: formData.skills.filter(skill => skill !== skillToRemove)
    });
  };

  // Upload photo to server separately
  const uploadProfilePhoto = async (file) => {
    if (!file) return null;
    
    try {
      setUploadingPhoto(true);
      const token = localStorage.getItem('token');
      const formDataToSend = new FormData();
      formDataToSend.append('profilePhoto', file);
      
      const response = await fetch('http://localhost:5000/api/auth/upload-photo', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formDataToSend
      });
      
      const data = await response.json();
      
      if (response.ok) {
        return data.photoUrl;
      } else {
        setError(data.message || 'Failed to upload photo');
        return null;
      }
    } catch (error) {
      setError('Network error: Unable to upload photo');
      return null;
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const token = localStorage.getItem('token');
      let photoUrl = user.profilePhoto;
      
      // Upload new photo if one was selected
      if (formData.profilePhoto && typeof formData.profilePhoto !== 'string') {
        const uploadedUrl = await uploadProfilePhoto(formData.profilePhoto);
        if (uploadedUrl) {
          photoUrl = uploadedUrl;
        }
      } else if (formData.profilePhoto === null) {
        // If photo was removed
        photoUrl = null;
      }
      
      const response = await fetch('http://localhost:5000/api/auth/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: formData.name,
          contact: formData.contact,
          bio: formData.bio,
          skills: JSON.stringify(formData.skills),
          studentId: formData.studentId,
          department: formData.department,
          year: formData.year,
          employeeId: formData.employeeId,
          facultyDepartment: formData.facultyDepartment,
          designation: formData.designation,
          profilePhoto: photoUrl
        })
      });

      const data = await response.json();

      if (response.ok) {
        // Update local storage with new user data
        localStorage.setItem('user', JSON.stringify(data.user));
        setUser(data.user);
        setIsEditing(false);
        setSuccess('Profile updated successfully!');
        setTimeout(() => setSuccess(""), 3000);
      } else {
        setError(data.message || 'Failed to update profile');
      }
    } catch (error) {
      setError('Network error: Unable to connect to server.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate("/");
  };

  const getRoleDisplay = () => {
    switch(user?.role) {
      case 'student': return '🎓 Student';
      case 'faculty': return '👨‍🏫 Faculty';
      case 'admin': return '⚙️ Admin';
      default: return 'User';
    }
  };

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

  if (!user) {
    return (
      <div className="loading-container">
        <div className="loading-spinner">Loading...</div>
      </div>
    );
  }

  return (
    <div className="profile-container">
      {/* Header */}
      <header className="profile-header">
        <div className="header-left">
          <div className="logo">💼 CampusConnect</div>
          <div className="nav-items">
            <button className="nav-btn" onClick={() => navigate("/feed")}>🏠 Feed</button>
            <button className="nav-btn active">👤 Profile</button>
            <button className="nav-btn">👥 Network</button>
            <button className="nav-btn">🔍 Explore</button>
            <button className="nav-btn">🔔Notifications</button>
          </div>
        </div>
        <div className="header-right">
          <div className="user-info" onClick={() => navigate("/feed")}>
            <span className="user-name">Welcome, {user.name}</span>
            <div className="user-avatar" title={user.name}>
              {getUserAvatar(user)}
            </div>
          </div>
          <button className="logout-btn" onClick={handleLogout}>🚪 Logout</button>
        </div>
      </header>

      {/* Notifications */}
      {error && (
        <div className="notification error">
          {error}
          <button onClick={() => setError("")}>×</button>
        </div>
      )}
      {success && (
        <div className="notification success">
          {success}
          <button onClick={() => setSuccess("")}>×</button>
        </div>
      )}

      <div className="profile-content">
        <div className="profile-card">
          {/* Profile Header */}
          <div className="profile-header-section">
            <div className="profile-photo-section">
              {photoPreview ? (
                <div className="photo-preview">
                  <img src={photoPreview} alt="Profile" className="profile-image" />
                  {isEditing && (
                    <button 
                      type="button" 
                      className="remove-photo-btn"
                      onClick={handleRemovePhoto}
                    >
                      ✕
                    </button>
                  )}
                </div>
              ) : (
                <div className="profile-image-placeholder">
                  {user.name?.charAt(0).toUpperCase()}
                </div>
              )}
              
              {isEditing && (
                <div className="photo-upload-actions">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handlePhotoUpload}
                    accept="image/*"
                    className="file-input"
                    id="profilePhoto"
                  />
                  <label htmlFor="profilePhoto" className="upload-photo-btn">
                    {uploadingPhoto ? '📤 Uploading...' : '📸 Change Photo'}
                  </label>
                  <p className="photo-hint">Max 5MB • JPG, PNG, GIF</p>
                </div>
              )}
            </div>

            <div className="profile-info">
              <h1 className="profile-name">{user.name}</h1>
              <div className="profile-role">{getRoleDisplay()}</div>
              <div className="profile-email">📧 {user.email}</div>
              {user.contact && <div className="profile-contact">📞 {user.contact}</div>}
              {user.bio && <div className="profile-bio-preview">{user.bio}</div>}
            </div>
          </div>

          {/* Edit/Save Buttons */}
          <div className="profile-actions">
            {!isEditing ? (
              <button 
                className="edit-profile-btn"
                onClick={() => setIsEditing(true)}
              >
                ✏️ Edit Profile
              </button>
            ) : (
              <div className="edit-actions">
                <button 
                  className="cancel-btn"
                  onClick={() => {
                    setIsEditing(false);
                    // Reset form data
                    setFormData({
                      name: user.name || "",
                      email: user.email || "",
                      contact: user.contact || "",
                      bio: user.bio || "Passionate about technology and innovation. Always eager to learn and grow.",
                      skills: user.skills || ["JavaScript", "React", "Node.js", "Python"],
                      newSkill: "",
                      studentId: user.studentId || "",
                      department: user.department || "",
                      year: user.year || "",
                      employeeId: user.employeeId || "",
                      facultyDepartment: user.facultyDepartment || "",
                      designation: user.designation || "",
                      profilePhoto: user.profilePhoto || null
                    });
                    setPhotoPreview(user.profilePhoto || null);
                  }}
                >
                  Cancel
                </button>
                <button 
                  className="save-profile-btn"
                  onClick={handleUpdateProfile}
                  disabled={loading || uploadingPhoto}
                >
                  {loading ? '💾 Saving...' : '💾 Save Changes'}
                </button>
              </div>
            )}
          </div>

          {/* Bio Section */}
          <div className="bio-section">
            <h3>📝 About Me</h3>
            {isEditing ? (
              <textarea
                className="bio-input"
                value={formData.bio}
                onChange={(e) => setFormData({...formData, bio: e.target.value})}
                placeholder="Tell us about yourself..."
                rows="3"
                maxLength="500"
              />
            ) : (
              <p className="bio-text">{formData.bio || "No bio yet. Tell us about yourself!"}</p>
            )}
          </div>

          {/* Skills Section */}
          <div className="skills-section">
            <h3>🛠️ Skills & Expertise</h3>
            <div className="skills-container">
              {formData.skills.length > 0 ? (
                formData.skills.map((skill, index) => (
                  <div key={index} className="skill-tag">
                    {skill}
                    {isEditing && (
                      <button 
                        className="remove-skill-btn"
                        onClick={() => handleRemoveSkill(skill)}
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))
              ) : (
                <p className="no-skills">No skills added yet</p>
              )}
            </div>
            {isEditing && (
              <div className="add-skill-section">
                <input
                  type="text"
                  className="skill-input"
                  value={formData.newSkill}
                  onChange={(e) => setFormData({...formData, newSkill: e.target.value})}
                  placeholder="Add a skill (press Enter to add)..."
                  onKeyPress={(e) => e.key === 'Enter' && handleAddSkill()}
                />
                <button className="add-skill-btn" onClick={handleAddSkill}>
                  Add
                </button>
              </div>
            )}
          </div>

          {/* Profile Details Form */}
          <div className="profile-details">
            <h3>📋 Profile Information</h3>
            
            <div className="form-grid">
              <div className="input-group">
                <label>Full Name</label>
                <input 
                  type="text" 
                  className="profile-input" 
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  disabled={!isEditing}
                />
              </div>

              <div className="input-group">
                <label>Email</label>
                <input 
                  type="email" 
                  className="profile-input" 
                  value={formData.email}
                  disabled
                  title="Email cannot be changed"
                />
              </div>

              <div className="input-group">
                <label>Contact Number</label>
                <input 
                  type="tel" 
                  className="profile-input" 
                  value={formData.contact}
                  onChange={(e) => setFormData({...formData, contact: e.target.value})}
                  disabled={!isEditing}
                  placeholder="Enter your phone number"
                />
              </div>

              {/* Student Specific Fields */}
              {user.role === 'student' && (
                <>
                  <div className="input-group">
                    <label>Student ID</label>
                    <input 
                      type="text" 
                      className="profile-input" 
                      value={formData.studentId}
                      onChange={(e) => setFormData({...formData, studentId: e.target.value})}
                      disabled={!isEditing}
                      placeholder="Enter student ID"
                    />
                  </div>

                  <div className="input-group">
                    <label>Department</label>
                    <select 
                      className="profile-input"
                      value={formData.department}
                      onChange={(e) => setFormData({...formData, department: e.target.value})}
                      disabled={!isEditing}
                    >
                      <option value="">Select Department</option>
                      <option value="Computer Engineering">Computer Engineering</option>
                      <option value="Information Technology">Information Technology</option>
                      <option value="Electronics & Telecommunication">Electronics & Telecommunication</option>
                      <option value="Mechanical Engineering">Mechanical Engineering</option>
                      <option value="Civil Engineering">Civil Engineering</option>
                    </select>
                  </div>

                  <div className="input-group">
                    <label>Academic Year</label>
                    <select 
                      className="profile-input"
                      value={formData.year}
                      onChange={(e) => setFormData({...formData, year: e.target.value})}
                      disabled={!isEditing}
                    >
                      <option value="">Select Year</option>
                      <option value="First Year">First Year</option>
                      <option value="Second Year">Second Year</option>
                      <option value="Third Year">Third Year</option>
                      <option value="Fourth Year">Fourth Year</option>
                      <option value="Postgraduate">Postgraduate</option>
                    </select>
                  </div>
                </>
              )}

              {/* Faculty Specific Fields */}
              {user.role === 'faculty' && (
                <>
                  <div className="input-group">
                    <label>Employee ID</label>
                    <input 
                      type="text" 
                      className="profile-input" 
                      value={formData.employeeId}
                      onChange={(e) => setFormData({...formData, employeeId: e.target.value})}
                      disabled={!isEditing}
                      placeholder="Enter employee ID"
                    />
                  </div>

                  <div className="input-group">
                    <label>Department</label>
                    <select 
                      className="profile-input"
                      value={formData.facultyDepartment}
                      onChange={(e) => setFormData({...formData, facultyDepartment: e.target.value})}
                      disabled={!isEditing}
                    >
                      <option value="">Select Department</option>
                      <option value="Computer Engineering">Computer Engineering</option>
                      <option value="Information Technology">Information Technology</option>
                      <option value="Electronics & Telecommunication">Electronics & Telecommunication</option>
                      <option value="Mechanical Engineering">Mechanical Engineering</option>
                      <option value="Civil Engineering">Civil Engineering</option>
                    </select>
                  </div>

                  <div className="input-group">
                    <label>Designation</label>
                    <select 
                      className="profile-input"
                      value={formData.designation}
                      onChange={(e) => setFormData({...formData, designation: e.target.value})}
                      disabled={!isEditing}
                    >
                      <option value="">Select Designation</option>
                      <option value="Professor">Professor</option>
                      <option value="Associate Professor">Associate Professor</option>
                      <option value="Assistant Professor">Assistant Professor</option>
                      <option value="Head of Department">Head of Department</option>
                      <option value="Lab Incharge">Lab Incharge</option>
                    </select>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Profile;