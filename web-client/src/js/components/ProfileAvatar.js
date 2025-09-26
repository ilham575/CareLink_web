import React from "react";
import { useNavigate } from "react-router-dom";

function ProfileAvatar({ profileUrl, profileFullName, userData }) {
  const navigate = useNavigate();

  const handleProfileClick = () => {
    const role = localStorage.getItem('role');
    const userId = userData?.id;
    
    console.log('Role:', role); // Debug
    console.log('UserId:', userId); // Debug
    console.log('UserData:', userData); // Debug
    
    if (role === 'admin') {
      if (userId) {
        console.log('Navigating to signup with userId:', userId); // Debug
        navigate('/signup', {
          state: { userId }
        });
      } else {
        console.log('No userId found'); // Debug
      }
    }
  };

  return (
    <div
      className="profile-avatar"
      title={profileFullName || "โปรไฟล์"}
      onClick={handleProfileClick}
      style={{ cursor: 'pointer' }}
    >
      {profileUrl ? (
        <img
          src={profileUrl}
          alt="profile"
          className="profile-avatar-img"
        />
      ) : (
        <span>
          {localStorage.getItem('profileInitial') ||
            (localStorage.getItem('username') &&
              localStorage.getItem('username')[0].toUpperCase()) ||
            'U'}
        </span>
      )}
    </div>
  );
}

export default ProfileAvatar;