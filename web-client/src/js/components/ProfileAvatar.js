import React from "react";
import { useNavigate } from "react-router-dom";
import { API } from '../../utils/apiConfig';

function ProfileAvatar({ profileUrl, profileFullName, userData }) {
  const navigate = useNavigate();

  const handleProfileClick = async () => {
    const role = localStorage.getItem('role');
    const userId = userData?.id;

    if (role === 'admin') {
      if (userId) {
        navigate('/signup', {
          state: { userId }
        });
      }
    } else if (role === 'pharmacy') {
      if (userId) {
        try {
          const jwt = localStorage.getItem('jwt');
          const res = await fetch(
            API.pharmacyProfiles.listFiltered({ users_permissions_user: { id: { $eq: userId } } }),
            { headers: { Authorization: `Bearer ${jwt}` } }
          );
          const data = await res.json();
          const profile = data.data?.[0];
          if (profile?.documentId) {
            navigate(`/edit_pharmacist_admin/${profile.documentId}`, {
              state: { isSelfEdit: true }
            });
          } else {
            alert("ไม่พบข้อมูลโปรไฟล์เภสัชกร");
          }
        } catch (err) {
          alert("เกิดข้อผิดพลาดในการดึงข้อมูลเภสัชกร");
        }
      }
    } else if (role === 'staff') {
      navigate('/edit_staff_profile');
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